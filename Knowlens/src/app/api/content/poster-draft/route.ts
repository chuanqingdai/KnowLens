import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { buildContentDraftPrompt } from "@/lib/prompts/content-draft";
import { buildMockDraftPayload } from "@/lib/prompts/content-draft-mock";
import { rateLimitOrThrow } from "@/lib/server/rate-limit";
import { RATE_LIMIT_CONFIG } from "@/lib/server/rate-limit-config";
import { incrementAndCheckUsageLimit, getUsageCounter } from "@/lib/server/guard";
import { logOpsEvent } from "@/lib/server/store";
import { nextAuthOptions } from "@/lib/nextAuth";
import {
  getLanguageTag,
  isChineseLanguage,
  resolveOutputLanguage,
  type OutputLanguage,
} from "@/lib/language";

export const runtime = "nodejs";

type PosterDraft = {
  headline: string;
  subtitle: string;
  body: string;
  points: string[];
  cta: string;
  size?: string;
  visualType?: string;
  layoutSuggestion?: string;
  visualElements?: string[];
};

type PosterPlanItem = {
  index: number;
  title: string;
  focus: string;
  role?: string;
  keyFacts?: string[];
  visualType?: string;
  visualElements?: string[];
  layoutHint?: string;
  imagePrompt?: string;
  imagePromptDraft?: string;
};

type PosterSeedItem = {
  title: string;
  focus: string;
  visualType?: string;
  visualElements?: string[];
  layoutHint?: string;
};

type PosterDraftRequest = {
  topic?: string;
  prompt?: string;
  textModel?: string;
  posterCount?: number;
  posterSizeLabel?: string;
  direction?: "poster" | "ppt" | "video";
  normalizedDirection?: "poster" | "ppt" | "video";
  normalizedCount?: number;
  normalizedRatio?: string;
  draftMode?: "mock" | "auto";
  outputLanguage?: OutputLanguage;
};

type PptSlideDraft = {
  page?: number;
  title?: string;
  mainPoint?: string;
  body?: string;
  supportNote?: string;
  visual?: string;
  imagePrompt?: string;
  imagePromptDraft?: string;
  isCover?: boolean;
};

type VideoStoryboardDraft = {
  index?: number;
  title?: string;
  durationSec?: number;
  narration?: string;
  visual?: string;
  onScreenText?: string;
  imagePrompt?: string;
  imagePromptDraft?: string;
  isCover?: boolean;
};

type GptsApiGenerateResponse = {
  candidates?: Array<{
    content?: {
      role?: string;
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  modelVersion?: string;
  responseId?: string;
};

type OpenAICompatChatCompletionResponse = {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: Array<{
    index?: number;
    message?: {
      role?: string;
      content?: string;
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

type DraftLlmUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  source: "provider" | "estimated";
  model?: string;
};
type DraftProviderPath = "gptsapi" | "openai-compat" | "fallback";

const FREE_MODEL_IDS = new Set(["gemini-2.5", "deepseek-v4"]);
const PAID_MODEL_IDS = new Set(["gpt-5.5", "gpt-5.4", "gemini-3.1-pro", "claude-sonnet-4.6"]);

const GPTSAPI_MODEL_MAP: Record<string, string> = {
  "gemini-2.5": process.env.GPTSAPI_MODEL_GEMINI_25 || "gemini-2.5-flash",
  "deepseek-v4": process.env.GPTSAPI_MODEL_DEEPSEEK_V4 || "deepseek-v4",
};

const PAID_MODEL_MAP: Record<string, string> = {
  "gpt-5.5": process.env.PAID_MODEL_GPT_55 || "gpt-5.5",
  "gpt-5.4": process.env.PAID_MODEL_GPT_54 || "gpt-5.4",
  "gemini-3.1-pro": process.env.PAID_MODEL_GEMINI_31_PRO || "gemini-3.1-pro",
  "claude-sonnet-4.6": process.env.PAID_MODEL_CLAUDE_SONNET_46 || "claude-sonnet-4.6",
};
const DRAFT_MODEL_TIMEOUT_MS = Number.parseInt(process.env.DRAFT_MODEL_TIMEOUT_MS || "", 10) || 90000;
const GPTSAPI_BASE_URL = (process.env.GPTSAPI_BASE_URL || "https://api.gptsapi.net/v1").replace(/\/+$/, "");
const GPTSAPI_CHAT_COMPLETIONS_URL =
  process.env.GPTSAPI_CHAT_COMPLETIONS_URL ||
  process.env.GPTSAPI_OPENAI_COMPAT_CHAT_COMPLETIONS_URL ||
  `${GPTSAPI_BASE_URL}/chat/completions`;

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function isFreeTextModel(textModel?: string) {
  if (!textModel) {
    return false;
  }
  return FREE_MODEL_IDS.has(textModel);
}

function resolvePaidModel(textModel?: string) {
  const normalized = (textModel || "").trim().toLowerCase();
  if (normalized && FREE_MODEL_IDS.has(normalized)) {
    return GPTSAPI_MODEL_MAP[normalized] || normalized;
  }
  if (normalized && PAID_MODEL_IDS.has(normalized)) {
    return PAID_MODEL_MAP[normalized] || normalized;
  }
  return process.env.PAID_TEXT_MODEL_DEFAULT || process.env.OPENAI_TEXT_MODEL || process.env.GPTSAPI_MODEL_GEMINI_25 || "gemini-2.5-flash";
}

function getGptsApiKeyForModel(textModel: string) {
  if (textModel === "gemini-2.5") {
    return (
      process.env.GPTSAPI_GEMINI_API_KEY ||
      process.env.GPTSAPI_FREE_API_KEY ||
      process.env.GPTSAPI_API_KEY ||
      ""
    );
  }
  if (textModel === "deepseek-v4") {
    return (
      process.env.GPTSAPI_DEEPSEEK_API_KEY ||
      process.env.GPTSAPI_FREE_API_KEY ||
      process.env.GPTSAPI_API_KEY ||
      ""
    );
  }
  return process.env.GPTSAPI_API_KEY || "";
}

function getPaidChatCompletionsApiKey() {
  return (
    process.env.PAID_LLM_API_KEY ||
    process.env.OPENAI_API_KEY ||
    ""
  );
}

function getPaidChatCompletionsUrl() {
  const explicitUrl =
    process.env.PAID_LLM_CHAT_COMPLETIONS_URL ||
    process.env.OPENAI_COMPAT_CHAT_COMPLETIONS_URL;
  if (explicitUrl) {
    return explicitUrl;
  }
  return process.env.OPENAI_API_KEY ? "https://api.openai.com/v1/chat/completions" : "";
}

function hasOpenAICompatDraftProvider() {
  return Boolean(getPaidChatCompletionsApiKey() && getPaidChatCompletionsUrl());
}

function estimateTokenCount(text: string) {
  const normalized = (text || "").trim();
  if (!normalized) {
    return 1;
  }
  return Math.max(1, Math.ceil(normalized.length / 4));
}

function normalizeDraftLlmUsage(input: {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  model?: string;
  source?: "provider" | "estimated";
}): DraftLlmUsage {
  const normalizedInput = Number.isFinite(input.inputTokens)
    ? Math.max(0, Math.round(input.inputTokens as number))
    : 0;
  const normalizedOutput = Number.isFinite(input.outputTokens)
    ? Math.max(0, Math.round(input.outputTokens as number))
    : 0;
  const normalizedTotal = Number.isFinite(input.totalTokens)
    ? Math.max(0, Math.round(input.totalTokens as number))
    : 0;
  const total = normalizedTotal > 0 ? normalizedTotal : normalizedInput + normalizedOutput;
  return {
    inputTokens: normalizedInput,
    outputTokens: normalizedOutput,
    totalTokens: Math.max(1, total),
    source: input.source || "provider",
    model: input.model,
  };
}

function buildEstimatedDraftLlmUsage(input: {
  promptBundle: { systemPrompt: string; userPrompt: string };
  generatedText?: string;
  model?: string;
}): DraftLlmUsage {
  const inputTokens = estimateTokenCount(
    `${input.promptBundle.systemPrompt}\n${input.promptBundle.userPrompt}`,
  );
  const outputTokens = estimateTokenCount(input.generatedText || "");
  return normalizeDraftLlmUsage({
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    model: input.model,
    source: "estimated",
  });
}

async function requestDraftFromGptsApi(input: {
  textModel: string;
  promptBundle: { systemPrompt: string; userPrompt: string };
}) {
  const providerModel = GPTSAPI_MODEL_MAP[input.textModel] || input.textModel;
  const apiKey = getGptsApiKeyForModel(input.textModel);
  if (!apiKey) {
    return { ok: false as const, error: `Missing API key for model ${input.textModel}.` };
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(
      GPTSAPI_CHAT_COMPLETIONS_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: providerModel,
          temperature: 0.2,
          messages: [
            { role: "system", content: input.promptBundle.systemPrompt },
            { role: "user", content: input.promptBundle.userPrompt },
          ],
          response_format: { type: "json_object" },
        }),
      },
      DRAFT_MODEL_TIMEOUT_MS,
    );
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    return {
      ok: false as const,
      error: isTimeout
        ? `Model request timed out after ${DRAFT_MODEL_TIMEOUT_MS}ms.`
        : `Model request failed: ${error instanceof Error ? error.message : "unknown network error"}`,
    };
  }

  if (!response.ok) {
    const errText = await response.text();
    return {
      ok: false as const,
      error: `Model request failed (${response.status}): ${errText.slice(0, 220)}`,
    };
  }

  const data = (await response.json()) as OpenAICompatChatCompletionResponse;
  const text = data.choices?.[0]?.message?.content?.trim() || "";
  if (!text) {
    return { ok: false as const, error: "Empty model response." };
  }

  const usage = normalizeDraftLlmUsage({
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
    totalTokens: data.usage?.total_tokens,
    model: data.model ?? providerModel,
    source: "provider",
  });

  return { ok: true as const, text, modelVersion: data.model ?? providerModel, usage };
}

async function requestDraftFromPaidModels(input: {
  textModel?: string;
  promptBundle: { systemPrompt: string; userPrompt: string };
}) {
  const apiKey = getPaidChatCompletionsApiKey();
  if (!apiKey) {
    return { ok: false as const, error: "Missing paid model API key." };
  }

  const model = resolvePaidModel(input.textModel);
  const endpoint = getPaidChatCompletionsUrl();
  if (!endpoint) {
    return { ok: false as const, error: "Missing paid model chat completions URL." };
  }
  let response: Response;
  try {
    response = await fetchWithTimeout(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.6,
          messages: [
            { role: "system", content: input.promptBundle.systemPrompt },
            { role: "user", content: input.promptBundle.userPrompt },
          ],
          response_format: { type: "json_object" },
        }),
      },
      DRAFT_MODEL_TIMEOUT_MS,
    );
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    return {
      ok: false as const,
      error: isTimeout
        ? `Paid model request timed out after ${DRAFT_MODEL_TIMEOUT_MS}ms.`
        : `Paid model request failed: ${error instanceof Error ? error.message : "unknown network error"}`,
    };
  }

  if (!response.ok) {
    const errText = await response.text();
    return {
      ok: false as const,
      error: `Paid model request failed (${response.status}): ${errText.slice(0, 220)}`,
    };
  }

  const data = (await response.json()) as OpenAICompatChatCompletionResponse;
  const text = data.choices?.[0]?.message?.content?.trim() || "";
  if (!text) {
    return { ok: false as const, error: "Paid model returned empty content." };
  }

  const usage = normalizeDraftLlmUsage({
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
    totalTokens: data.usage?.total_tokens,
    model: data.model ?? model,
    source: "provider",
  });

  return { ok: true as const, text, modelVersion: data.model ?? model, usage };
}

type PosterRenderSpec = {
  version: "v1";
  language: string;
  layoutTemplate: "three-column-causal-infographic";
  ratio: string;
  title: string;
  subtitle: string;
  topic: string;
  visualType: string;
  sections: {
    leftPanel: {
      title: string;
      objective: string;
      exampleItems: string[];
      emphasis: string;
    };
    middlePanel: {
      title: string;
      causalSteps: string[];
      visualAnchors: string[];
    };
    rightPanel: {
      title: string;
      beforeState: string[];
      afterState: string[];
      conclusion: string;
    };
    bottomSummary: {
      chain: string[];
      finalTakeaway: string;
    };
  };
  renderingConstraints: {
    maxTextLinesPerBlock: number;
    avoidLongParagraph: boolean;
    emphasizeNumbers: boolean;
    iconStyle: "flat-illustration";
    chartStyle: "simple-high-contrast";
  };
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeDraftConfig(payload: PosterDraftRequest) {
  const normalizedDirection = payload.normalizedDirection || payload.direction || "poster";
  const normalizedCountRaw =
    Number.isFinite(payload.normalizedCount) && Number(payload.normalizedCount) > 0
      ? Number(payload.normalizedCount)
      : Number(payload.posterCount || (normalizedDirection === "poster" ? 1 : 6));
  const normalizedCount = clamp(
    Math.round(normalizedCountRaw),
    normalizedDirection === "poster" ? 1 : 6,
    normalizedDirection === "poster" ? 10 : 24,
  );
  const normalizedRatio =
    (payload.normalizedRatio || payload.posterSizeLabel || "").trim() ||
    (normalizedDirection === "video" || normalizedDirection === "ppt" ? "16:9" : "9:16");
  return {
    normalizedDirection,
    normalizedCount,
    normalizedRatio,
  } as const;
}

function cleanSentence(input: string) {
  return input.replace(/\s+/g, "").trim();
}

function normalizeDraftTopic(input: string, outputLanguage: OutputLanguage) {
  const fallback = isChineseLanguage(outputLanguage) ? "知识主题" : "Knowledge Topic";
  const raw = (input || "").trim();
  if (!raw) {
    return fallback;
  }
  const cleaned = raw
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/^(?:主题是|主题为|主题|topic(?:\s*is)?|topic)\s*[:：]?\s*/i, "")
    .replace(/^(?:请|请帮我|帮我|麻烦)?\s*(?:做成?|生成|输出|创建|制作|写)\s*/i, "")
    .replace(/^(?:\d+\s*(?:页|张|个分镜|帧)\s*)/i, "")
    .replace(/^(?:海报|PPT|视频|视频分镜|poster|ppt|video|storyboard)\s*/i, "")
    .replace(/^\s*(?:成)\s*\d+\s*(?:页|张|个分镜|帧)\s*/i, "")
    .replace(/^\s*(?:第\s*)?\d+\s*(?:页|张|个分镜|帧)\s*/i, "")
    .trim();
  const firstSentence = cleaned
    .split(/[。！？!?]/)
    .map((part) => part.trim())
    .filter(Boolean)[0];
  const normalized = (firstSentence || cleaned)
    .replace(/^(?:成)\s*\d+\s*(?:页|张|个分镜|帧)\s*/i, "")
    .replace(/^(?:做成?|生成|输出)\s*\d+\s*(?:页|张|个分镜|帧)\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return fallback;
  }
  return normalized.slice(0, isChineseLanguage(outputLanguage) ? 28 : 48);
}

function isDataSummaryInput(topic: string, prompt: string) {
  const source = `${topic}\n${prompt}`.trim();
  if (!source) {
    return false;
  }
  const dataCueCount = [
    /指标|数据|同比|环比|营收|净利润|每股收益|EPS|财报|收入|利润|亏损|增长|广告收入|Cloud|Other Bets/i,
    /\d[\d,.]*\s*(?:亿|万|美元|元|%|百分点|million|billion)/i,
    /Q[1-4]|季度|全年|截至|20\d{2}年/i,
  ].filter((pattern) => pattern.test(source)).length;
  return dataCueCount >= 2;
}

function isDenseSourceInput(prompt: string) {
  const source = (prompt || "").trim();
  if (!source) {
    return false;
  }
  const sentenceCount = (source.match(/[。！？.!?\n]/g)?.length ?? 0);
  const numberCount = (source.match(/\d/g)?.length ?? 0);
  return source.length >= 380 || sentenceCount >= 8 || numberCount >= 20;
}

function buildSinglePosterDataFocus(topic: string, outputLanguage: OutputLanguage) {
  if (!isChineseLanguage(outputLanguage)) {
    return ensureSentenceEnding(
      `One-page investor brief for ${topic}: cover core metrics, business structure shifts, growth drivers, risk points, and next-quarter guidance`,
      outputLanguage,
    );
  }
  return ensureSentenceEnding(
    `一页聚焦${topic}的核心业绩、业务结构变化、增长驱动、风险点与下季度指引`,
    outputLanguage,
  );
}

function buildSinglePosterModuleFacts(topic: string, outputLanguage: OutputLanguage) {
  if (!isChineseLanguage(outputLanguage)) {
    return [
      ensureSentenceEnding("Module 1: Core metrics and growth snapshot", outputLanguage),
      ensureSentenceEnding("Module 2: Data center and segment structure changes", outputLanguage),
      ensureSentenceEnding("Module 3: New reporting structure and platform narrative", outputLanguage),
      ensureSentenceEnding("Module 4: Capital return, next-quarter guidance, and growth assumptions", outputLanguage),
      ensureSentenceEnding("Module 5: Investor watchlist: growth durability, margin, customer capex, and regional risk", outputLanguage),
    ];
  }
  return [
    ensureSentenceEnding("模块1：核心财务数据与增长快照", outputLanguage),
    ensureSentenceEnding("模块2：数据中心与业务结构变化", outputLanguage),
    ensureSentenceEnding("模块3：新业务口径与平台叙事变化", outputLanguage),
    ensureSentenceEnding("模块4：股东回报、下季度指引与增长假设", outputLanguage),
    ensureSentenceEnding("模块5：投资者关注点：增长持续性、毛利率、客户资本开支与区域风险", outputLanguage),
  ];
}

function cleanDataSummaryFactLine(line: string, outputLanguage: OutputLanguage) {
  const cleaned = line
    .replace(/(?:做成|生成|制作|输出)\s*\d+\s*(?:张|页|个分镜|帧)?\s*(?:信息图|图片|海报|PPT|ppt|视频)?[。.!！?？]*$/i, "")
    .replace(/(?:做成|生成|制作|输出)\s*(?:信息图|图片|海报|PPT|ppt|视频)?[。.!！?？]*$/i, "")
    .replace(/[；;、,\s]+$/g, "")
    .replace(/[。.!！?？]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? ensureSentenceEnding(cleaned, outputLanguage) : "";
}

function trimDataSummaryFactLine(line: string, outputLanguage: OutputLanguage) {
  const cleaned = line.trim();
  if (!cleaned) {
    return "";
  }
  const maxLength = isChineseLanguage(outputLanguage) ? 180 : 260;
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  const punctuationPattern = isChineseLanguage(outputLanguage) ? /[。！？；;]/g : /[.!?;]/g;
  let lastSafeIndex = -1;
  let match: RegExpExecArray | null;
  while ((match = punctuationPattern.exec(cleaned)) !== null) {
    if (match.index >= Math.floor(maxLength * 0.55) && match.index <= maxLength) {
      lastSafeIndex = match.index + 1;
    }
  }
  if (lastSafeIndex > 0) {
    return cleaned.slice(0, lastSafeIndex).trim();
  }
  return cleaned.slice(0, maxLength).replace(/[，。！？；、,.;:：\-\s]+$/g, "").trim();
}

function findDataChunkEnd(source: string, start: number, nextIndex?: number) {
  if (typeof nextIndex === "number") {
    return nextIndex;
  }
  const searchStart = Math.min(source.length, start + 100);
  const punctuationMatch = source.slice(searchStart).match(/[。！？；;]/);
  if (punctuationMatch?.index != null) {
    return searchStart + punctuationMatch.index + 1;
  }
  return Math.min(source.length, start + 220);
}

function splitDataSummarySentences(source: string) {
  const normalized = source
    .replace(/\r/g, "\n")
    .replace(/[📅📊]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (!normalized) {
    return [];
  }
  const matches = normalized.match(/[^。！？!?;\n]+[。！？!?;]?/g) ?? [];
  return matches.map((line) => line.trim()).filter(Boolean);
}

function isDataSummarySentenceCandidate(line: string) {
  const normalized = line.trim();
  if (!normalized) {
    return false;
  }
  const hasMetricValue =
    /\d[\d,.]*\s*(?:亿|万|美元|元|%|百分点|基点|million|billion|trillion|B|M)/i.test(normalized) ||
    /同比|环比|增长|下降|收窄|亏损|刷新历史纪录|创历史新高/i.test(normalized);
  const hasBusinessTerm =
    /财报|季度|截至|营收|收入|净利润|毛利率|每股收益|EPS|Data Center|数据中心|计算收入|网络收入|Hyperscale|ACIE|Edge Computing|股票回购|现金分红|回购授权|股息|下季度|第二季度|指引|中国|AI|Cloud|广告收入|Other Bets/i.test(
      normalized,
    );
  const hasStrategicTerm =
    /业务拆分|业务披露|商业叙事|卖 GPU|AI 计算平台|从云到边缘|护城河|投资者关注|增长持续性|客户资本开支|区域风险/i.test(
      normalized,
    );
  return (hasMetricValue && hasBusinessTerm) || hasStrategicTerm;
}

function extractDataSummaryFacts(topic: string, prompt: string, outputLanguage: OutputLanguage) {
  const source = (prompt || topic)
    .replace(/[📅📊]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!source) {
    return [];
  }

  const metricAnchors = [
    "总营收",
    "季度实现营收",
    "实现营收",
    "营收",
    "净利润",
    "GAAP 净利润",
    "GAAP 毛利率",
    "Non-GAAP 毛利率",
    "GAAP 稀释后每股收益",
    "Non-GAAP 稀释后每股收益",
    "每股收益（EPS）",
    "每股收益",
    "EPS",
    "Data Center",
    "数据中心业务",
    "数据中心计算",
    "数据中心网络",
    "Hyperscale",
    "ACIE",
    "Edge Computing",
    "股票回购",
    "现金分红",
    "回购授权",
    "季度现金股息",
    "下季度",
    "第二季度收入",
    "中国的数据中心计算收入",
    "Google 广告收入",
    "广告收入",
    "搜索广告",
    "YouTube 广告",
    "Google Cloud",
    "Cloud",
    "Other Bets",
    "2024年Q4营收",
    "2024全年营收",
    "2024全年净利润",
    "全年营收",
    "全年净利润",
    "收入",
    "利润",
    "亏损",
  ];
  const anchorPositions = metricAnchors
    .flatMap((anchor) => {
      const positions: Array<{ anchor: string; index: number }> = [];
      let cursor = source.indexOf(anchor);
      while (cursor >= 0) {
        positions.push({ anchor, index: cursor });
        cursor = source.indexOf(anchor, cursor + anchor.length);
      }
      return positions;
    })
    .sort((a, b) => (a.index === b.index ? b.anchor.length - a.anchor.length : a.index - b.index))
    .filter((position, idx, positions) => {
      const previous = positions[idx - 1];
      if (!previous) return true;
      return position.index >= previous.index + previous.anchor.length;
    });

  const chunks: string[] = [];
  for (let idx = 0; idx < anchorPositions.length; idx += 1) {
    const current = anchorPositions[idx];
    const next = anchorPositions[idx + 1];
    const end = findDataChunkEnd(source, current.index, next?.index);
    const chunk = source.slice(current.index, end).trim();
    if (/\d|两位数|收窄|增长|下降|亏损/.test(chunk)) {
      chunks.push(chunk);
    }
  }

  const sentenceChunks = source
    .split(/[。；;\n]/)
    .map((line) => line.trim())
    .filter((line) => line && /(?:\d|同比|环比|营收|净利润|收入|利润|增长|亏损|EPS|Cloud)/i.test(line));

  const fullSentenceFacts = splitDataSummarySentences(prompt || topic)
    .filter(isDataSummarySentenceCandidate)
    .map((line) => trimDataSummaryFactLine(line, outputLanguage));

  const normalized = dedupeLines([...fullSentenceFacts, ...chunks, ...sentenceChunks])
    .map((line) => cleanDataSummaryFactLine(trimDataSummaryFactLine(line, outputLanguage), outputLanguage))
    .filter(Boolean)
    .slice(0, 16);
  return normalized;
}

function buildDataSummaryPosterDraft(
  topic: string,
  sizeLabel: string | undefined,
  prompt: string,
  outputLanguage: OutputLanguage,
): PosterDraft {
  const facts = extractDataSummaryFacts(topic, prompt, outputLanguage);
  if (!isChineseLanguage(outputLanguage)) {
    const points = facts.length
      ? facts.slice(0, 5)
      : [
          "Summarize the provided metrics without inventing new numbers.",
          "Separate headline performance, segment performance, and comparison context.",
          "Use only numbers and dates supplied by the user.",
        ];
    return {
      headline: `${topic}: key metrics summary`,
      subtitle: "Source-preserving data infographic",
      body: points.slice(0, 3).join(" "),
      points,
      cta: "Use the supplied figures only.",
      size: sizeLabel,
      visualType: "Metrics summary infographic",
      layoutSuggestion: "Integrated hero metric + supporting metric clusters + concise takeaway.",
      visualElements: ["hero metric", "growth labels", "segment cards", "comparison strip", "takeaway line"],
    };
  }

  const points = facts.length
    ? facts.slice(0, 5)
    : [
        "仅整理用户提供的数据，不新增未经来源确认的数字。",
        "把核心指标、分业务表现和对比背景分层展示。",
        "结论只基于输入中已经出现的金额、日期和百分比。",
      ];
  return {
    headline: `${topic}：核心数据摘要`,
    subtitle: "保留原始数字，提炼关键指标与变化方向",
    body: points.slice(0, 3).join(""),
    points,
    cta: "先看核心指标，再看分业务变化。",
    size: sizeLabel,
    visualType: "指标摘要图",
    layoutSuggestion: "一个核心指标主视觉 + 分业务指标组 + 底部对比与结论",
    visualElements: ["核心指标主卡", "同比增长标签", "分业务指标组", "对比条", "结论提示"],
  };
}

function buildDataSummaryPlanListByLanguage(
  topic: string,
  count: number,
  prompt: string,
  outputLanguage: OutputLanguage,
): PosterPlanItem[] {
  const facts = extractDataSummaryFacts(topic, prompt, outputLanguage);
  const fallbackFacts = isChineseLanguage(outputLanguage)
    ? [
        "仅使用输入中提供的数字、日期、金额和百分比。",
        "先展示核心指标，再展示分业务表现，最后给出基于数据的判断框架。",
      ]
    : [
        "Use only numbers, dates, amounts, and percentages supplied by the user.",
        "Start with headline metrics, then segment performance, then a data-based judgment frame.",
      ];
  const factBank = facts.length ? facts : fallbackFacts.map((line) => ensureSentenceEnding(line, outputLanguage));
  const roles = count <= 1
    ? ["data-summary"]
    : count === 2
      ? ["data-summary", "insight"]
      : ["data-summary", "metrics", "comparison", "insight", "checklist", "system-model"];

  return Array.from({ length: count }, (_, idx) => {
    const role = roles[idx] ?? roles[(idx - 1) % Math.max(roles.length - 1, 1)] ?? "metrics";
    const primary = factBank[idx % factBank.length] ?? factBank[0] ?? "";
    const secondary = factBank[(idx + 1) % factBank.length] ?? primary;
    const title = (() => {
      if (!isChineseLanguage(outputLanguage)) {
        if (idx === 0) return `${topic}: Metric Overview`;
        if (role === "comparison") return `${topic}: Comparison Context`;
        if (role === "checklist") return `${topic}: Reading Checklist`;
        if (role === "system-model") return `${topic}: Judgment Frame`;
        return `${topic}: Key Metric ${idx + 1}`;
      }
      if (idx === 0) return `${topic}：数据总览`;
      if (role === "comparison") return `${topic}：对比背景`;
      if (role === "checklist") return `${topic}：阅读清单`;
      if (role === "system-model") return `${topic}：判断框架`;
      return `${topic}：关键指标 ${idx + 1}`;
    })();
    const keyFacts = isChineseLanguage(outputLanguage)
      ? [
          ensureSentenceEnding(`关键发现：${primary.replace(/^关键发现[:：]/, "")}`, outputLanguage),
          ensureSentenceEnding(`事实证据：${secondary.replace(/^事实证据[:：]/, "")}`, outputLanguage),
          ensureSentenceEnding("结论启发：只基于已提供数据做归纳，不补充未经确认的新数字。", outputLanguage),
        ]
      : [
          ensureSentenceEnding(`Insight: ${primary.replace(/^Insight[:：]/i, "")}`, outputLanguage),
          ensureSentenceEnding(`Evidence: ${secondary.replace(/^Evidence[:：]/i, "")}`, outputLanguage),
          ensureSentenceEnding("Takeaway: summarize only from supplied data without adding unverified figures", outputLanguage),
        ];
    return {
      index: idx + 1,
      role,
      title,
      focus: primary,
      keyFacts,
      visualType: isChineseLanguage(outputLanguage) ? "指标摘要图" : "metrics summary infographic",
      visualElements: isChineseLanguage(outputLanguage)
        ? ["核心指标主卡", "分业务指标组", "同比增长标签", "对比条", "结论提示"]
        : ["hero metric", "segment metric clusters", "growth labels", "comparison strip", "takeaway cue"],
      layoutHint: isChineseLanguage(outputLanguage)
        ? "一张整合式指标信息图，减少硬卡片堆叠，突出一个核心数据主视觉"
        : "integrated metrics infographic with one hero metric, soft grouping, and minimal hard panels",
      imagePromptDraft: "",
      imagePrompt: "",
    };
  });
}

function buildFallbackPosterDraft(
  topic: string,
  sizeLabel: string | undefined,
  prompt: string,
  outputLanguage: OutputLanguage,
): PosterDraft {
  if (!isChineseLanguage(outputLanguage)) {
    const vivid = /vivid|engaging|story|playful/i.test(prompt);
    const formal = /professional|formal|rigorous|academic/i.test(prompt);
    const subtitle = vivid ? "More vivid tone" : formal ? "Professional tone" : "Clear explainer tone";
    return {
      headline: `${topic}: key mechanism and real-world impact`,
      subtitle,
      body: `${topic} directly affects day-to-day decisions and tradeoffs. With the same budget, people usually get fewer resources and must rebalance speed, price, and risk.`,
      points: [
        `${topic} usually starts from upstream variables and then propagates to end-user outcomes.`,
        "As costs rise, people often shift from flexible spending to essential spending.",
        "When income growth lags behind cost growth, real purchasing power declines.",
        "Tracking one core indicator over multiple periods helps validate whether the trend is persistent.",
      ],
      cta: "Save this visual for a 1-minute review.",
      size: sizeLabel,
      visualType: "Causal flow diagram",
      layoutSuggestion: "Headline on top, mechanism flow in the center, and key takeaway at the bottom.",
      visualElements: ["upstream drivers", "transmission arrows", "outcome comparison", "action takeaway"],
    };
  }

  if (/洋流|海流/.test(topic)) {
    return {
      headline: "洋流循环如何影响全球气候？",
      subtitle: "三条链路看懂“海洋输送带”",
      body: "洋流把热量和水汽从低纬输送到高纬，直接改变沿海地区的温度、降水和渔业分布。海温异常时，这些影响会在一个季节内被放大。",
      points: [
        "热量输送：暖流让高纬沿海更温和。",
        "降水变化：洋流改变水汽路径与降雨带。",
        "生态与渔业：海温变化会推动鱼群迁移。",
        "极端事件：异常海温会放大局地气候波动。",
      ],
      cta: "先画三条箭头：热量、水汽、鱼群迁移。",
      size: sizeLabel,
      visualType: "路径流向图",
      layoutSuggestion: "上方标题 + 中部三链路箭头 + 下方影响结论",
      visualElements: ["海洋环流箭头", "低纬/高纬温差", "降水带变化", "渔业迁移路径"],
    };
  }

  if (/通货膨胀/.test(topic)) {
    return {
      headline: "通货膨胀为什么会影响日常生活？",
      subtitle: "同样的钱，为什么越花越不经用",
      body: "通货膨胀不是抽象名词，它会直接改变你每天的消费体验。比如去年 20 元能买到一份午餐，今年可能需要 24 元；同样预算下，能买到的商品和服务变少，这就是购买力下降。",
      points: [
        "食品和交通价格上涨最先被感知：买菜、打车、外卖会更贵。",
        "固定工资人群压力更大：收入不变，但房租、水电和日用品持续涨价。",
        "储蓄会被“慢慢稀释”：如果存款利率低于通胀率，钱的实际价值会下降。",
        "消费结构会变化：家庭会优先保留刚需支出。",
      ],
      cta: "学会看 CPI、控制不必要支出、优先配置抗通胀资产。",
      size: sizeLabel,
      visualType: "因果流图",
      layoutSuggestion: "左侧价格变化示例 + 中部四节点因果链 + 右侧家庭预算变化",
      visualElements: ["20元→24元价格标签", "工资与物价对比线", "储蓄购买力下降", "刚需占比上升饼图"],
    };
  }

  if (/沙漠|昼夜|白天|晚上|温差/.test(topic) && isChineseLanguage(outputLanguage)) {
    return {
      headline: "为什么沙漠白天热、夜晚冷？",
      subtitle: "从辐射、水汽到地表热惯量看昼夜温差",
      body: "沙漠地区白天接收太阳辐射强、升温快；夜间云量和水汽少，地表热量更容易向外辐射散失。再加上沙地热惯量较低，受热和失热都快，最终形成显著昼夜温差。",
      points: [
        "辐射输入：白天云层少、遮挡弱，地表吸热效率高。",
        "辐射输出：夜间回辐弱，长波辐射更易散失。",
        "水汽作用：空气干燥导致“保温层”能力较弱。",
        "地表性质：沙地和裸岩热惯量低，温度变化更快。",
        "对比验证：湿润地区通常昼夜温差更小。",
      ],
      cta: "先看“辐射—水汽—地表”三因子，再判断温差变化。",
      size: sizeLabel,
      visualType: "机制流程图",
      layoutSuggestion: "上方现象对比 + 中部机制链路 + 下方验证结论",
      visualElements: ["昼夜温度对比", "太阳辐射箭头", "长波辐射散失", "水汽与云层对比", "地表材质示意"],
    };
  }

  return {
    headline: `${topic}：机制讲解`,
    subtitle: isChineseLanguage(outputLanguage)
      ? "从现象到机制，再到验证与应用"
      : "From observable pattern to mechanism and verification",
    body: isChineseLanguage(outputLanguage)
      ? `${topic}可以按“可观察现象—关键机制—验证线索—应用判断”来解释。先确认最先变化的现象，再说明变量如何传导，最后用可观测指标验证结论是否成立。`
      : `${topic} can be explained through observable pattern, mechanism path, verification cues, and practical judgment.`,
    points: [
      isChineseLanguage(outputLanguage)
        ? `先定义${topic}中最先出现的可观察变化。`
        : `Define the earliest observable change in ${topic}.`,
      isChineseLanguage(outputLanguage)
        ? "用3-4步机制链路解释“为什么会这样”。"
        : "Use a 3-4 step mechanism chain to explain why it happens.",
      isChineseLanguage(outputLanguage)
        ? "提炼2-3个关键变量作为判断依据。"
        : "Extract 2-3 key variables as validation cues.",
      isChineseLanguage(outputLanguage)
        ? "给出一个现实场景验证机制是否成立。"
        : "Use one real scenario to validate the mechanism.",
      isChineseLanguage(outputLanguage)
        ? "最后沉淀为可执行判断和应对建议。"
        : "Conclude with an actionable judgment and response.",
    ],
    cta: isChineseLanguage(outputLanguage)
      ? "收藏这张图，按“现象→机制→验证”快速复盘。"
      : "Save this visual and review via pattern -> mechanism -> validation.",
    size: sizeLabel,
    visualType: isChineseLanguage(outputLanguage) ? "机制流程图" : "mechanism flow",
    layoutSuggestion: isChineseLanguage(outputLanguage)
      ? "上方现象区 + 中部机制链路 + 下方验证与结论"
      : "top pattern area + middle mechanism chain + bottom verification and takeaway",
    visualElements: isChineseLanguage(outputLanguage)
      ? ["可观察现象", "机制路径箭头", "关键变量标签", "对比区", "结论区"]
      : ["observable pattern", "mechanism arrows", "key variable labels", "comparison block", "takeaway block"],
  };
}

function buildFallbackPlanList(topic: string, count: number): PosterPlanItem[] {
  return buildFallbackPlanListByLanguage(topic, count, "zh");
}

function buildExtendedPosterSeed(
  base: PosterSeedItem[],
  count: number,
  topic: string,
  outputLanguage: OutputLanguage,
) {
  if (base.length >= count) {
    return base.slice(0, count);
  }
  const result = [...base];
  const extensionStagesZh = [
    { title: "变量联动", focus: "多个关键变量并非独立变化，联动关系通常决定结果放大或减弱。", visualType: "机制流程图" },
    { title: "区域差异", focus: "同一机制在不同区域会因地形、湿度或背景条件而呈现差异。", visualType: "对比图" },
    { title: "时间变化", focus: "关键变量在不同时间尺度上变化速度不同，短期与长期结论可能不一致。", visualType: "路径示意图" },
    { title: "应用判断", focus: "把机制转成可执行判断时，应先看最先变化的指标，再看传导方向。", visualType: "指标看板图" },
    { title: "复盘总结", focus: "复盘时可按“现象—机制—验证”顺序检查，避免只记结论不记过程。", visualType: "总结图" },
    { title: "进阶问题", focus: "进一步追问边界条件与反例，有助于判断机制在哪些场景会失效。", visualType: "误区-事实卡" },
  ];
  const extensionStagesEn = [
    {
      title: "Variable Coupling",
      focus: "Key variables usually move together, and the coupling pattern amplifies or weakens the outcome.",
      visualType: "mechanism flow",
    },
    {
      title: "Regional Difference",
      focus: "The same mechanism can look different across regions due to terrain, humidity, and local context.",
      visualType: "comparison view",
    },
    {
      title: "Time Dynamics",
      focus: "Variables evolve at different speeds, so short-term and long-term conclusions may diverge.",
      visualType: "pathway diagram",
    },
    {
      title: "Applied Judgment",
      focus: "For practical decisions, track the earliest changing signal before downstream effects.",
      visualType: "indicator panel",
    },
    {
      title: "Recap",
      focus: "A strong recap links observable pattern, mechanism path, and validation cues in one chain.",
      visualType: "summary chart",
    },
    {
      title: "Advanced Question",
      focus: "Boundary conditions and counterexamples help identify where the mechanism may fail.",
      visualType: "myth-vs-fact card",
    },
  ];
  for (let idx = base.length; idx < count; idx += 1) {
    const step = idx - base.length;
    if (isChineseLanguage(outputLanguage)) {
      const stage = extensionStagesZh[step % extensionStagesZh.length];
      result.push({
        title: `${topic}：${stage.title}`,
        focus: stage.focus,
        visualType: stage.visualType,
      });
    } else {
      const stage = extensionStagesEn[step % extensionStagesEn.length];
      result.push({
        title: `${topic}: ${stage.title}`,
        focus: stage.focus,
        visualType: stage.visualType,
      });
    }
  }
  return result.slice(0, count);
}

function inferFallbackMechanismLine(item: PosterSeedItem, topic: string, outputLanguage: OutputLanguage) {
  const title = `${item.title} ${item.focus}`;
  if (!isChineseLanguage(outputLanguage)) {
    if (/desert|day|night|temperature/i.test(title)) {
      if (/sun|day|heating/i.test(title)) return "Clear skies let solar energy reach the ground directly, so surface temperature rises fast.";
      if (/night|cooling|heat loss/i.test(title)) return "After sunset, heat escapes upward quickly because there is little cloud or moisture to hold it near the ground.";
      if (/moisture|dry|air/i.test(title)) return "Dry air acts like a thin blanket, so it keeps less heat near the surface overnight.";
      if (/surface|sand|rock|storage/i.test(title)) return "Sand and bare rock store heat poorly, so they warm and cool faster than water-rich surfaces.";
      return "The large temperature swing comes from fast daytime heat input and fast nighttime heat loss happening in the same place.";
    }
    return `The mechanism is visible when ${item.focus.replace(/[.!?]\s*$/, "")} changes the next observable result.`;
  }
  if (/沙漠|昼夜|白天|晚上|夜晚|夜间|温差|水汽/.test(title)) {
    if (/核心现象/.test(title)) return "白天吸热快与夜间散热快同时发生，才会把同一天内的温差拉大。";
    if (/夜晚|降温|散热|长波/.test(title)) return "没有太阳继续输入能量后，地表热量会更快跑向天空，少云层也难以把热量拦回来。";
    if (/白天|太阳|太阳辐射|升温/.test(title)) return "少云少遮挡让太阳能量更直接到达地表，地表温度因此快速上升。";
    if (/空气|干燥|水汽|保温/.test(title)) return "水汽少就像少了一层保温被，夜间很难把热量留在近地面。";
    if (/地表|材质|热惯量|沙地|裸岩/.test(title)) return "沙地和裸岩不擅长储热，所以温度会跟着能量输入和散失快速变化。";
    if (/湿润|对比/.test(title)) return "湿润地区有更多水汽、云层和水体储热，升温与降温都会更缓慢。";
    if (/误区|一直很热/.test(title)) return "真正差异不是全天都热，而是白天热量来得快、夜间热量走得也快。";
    if (/总结|判断/.test(title)) return "云量、水汽和地表材质分别影响热量输入、热量保存和热量散失。";
    return "白天吸热快与夜间散热快同时发生，才会把同一天内的温差拉大。";
  }
  return `这个机制可以从“${item.focus.replace(/[。！？]\s*$/, "")}”这一变化继续观察到结果。`;
}

function inferFallbackMemoryLine(item: PosterSeedItem, topic: string, outputLanguage: OutputLanguage) {
  const title = `${item.title} ${item.focus}`;
  if (!isChineseLanguage(outputLanguage)) {
    if (/desert|day|night|temperature/i.test(title)) {
      return "Memory cue: less cloud, less moisture, less heat storage means a larger day-night temperature swing.";
    }
    return `Memory cue: connect ${topic} with one observable contrast, not just a definition.`;
  }
  if (/沙漠|昼夜|白天|晚上|夜晚|夜间|温差|水汽/.test(title)) {
    if (/核心现象/.test(title)) return "把沙漠温差记成一句话：热来得快，也走得快。";
    if (/白天|太阳|升温/.test(title)) return "记住：白天升温快，先看云少不遮阳。";
    if (/夜晚|降温|散热/.test(title)) return "记住：夜晚降温快，先看有没有云层保温。";
    if (/空气|干燥|水汽/.test(title)) return "可以把水汽理解成空气里的“保温被”，越少越不保温。";
    if (/地表|材质|热惯量/.test(title)) return "沙地像薄铁片，水体像厚锅，前者更容易快速变热又变冷。";
    if (/湿润|对比/.test(title)) return "同样晒太阳，湿润地区更像有缓冲垫，温度变化没那么猛。";
    if (/误区/.test(title)) return "判断一句话：沙漠不是一直热，而是温度起落大。";
    if (/总结|判断/.test(title)) return "判断口诀：看云量、看水汽、看地表能不能储热。";
    return "把沙漠温差记成一句话：热来得快，也走得快。";
  }
  return `用一个前后对比或生活例子记住“${item.focus.replace(/[。！？]\s*$/, "")}”。`;
}

function buildQuestionTopicSeed(topic: string, outputLanguage: OutputLanguage): PosterSeedItem[] | null {
  const normalized = topic.replace(/\s+/g, "");
  const isQuestion =
    /^(为什么|为何|怎么|如何|why|how)/i.test(topic.trim()) || /[？?]$/.test(topic.trim());
  if (!isQuestion) {
    return null;
  }

  if (/沙漠|昼夜|白天|晚上|温差/.test(normalized) && isChineseLanguage(outputLanguage)) {
    return [
      {
        title: "沙漠昼夜温差：核心现象",
        focus: "同一地点在一天内温度可大幅波动，白天升温快、夜晚降温也快。",
        visualType: "对比图",
      },
      {
        title: "白天升温快：太阳辐射强",
        focus: "沙漠云量少、遮挡弱，地表直接吸收强太阳辐射，升温速度更快。",
        visualType: "机制流程图",
      },
      {
        title: "夜晚降温快：散热更直接",
        focus: "夜间缺少云层保温，地表长波辐射更容易散失，温度迅速下降。",
        visualType: "路径示意图",
      },
      {
        title: "空气干燥：保温能力弱",
        focus: "水汽少意味着大气储热和回辐能力弱，难以在夜间保留热量。",
        visualType: "分层结构图",
      },
      {
        title: "地表材质：热惯量较低",
        focus: "沙地和裸岩热惯量较低，受热和失热都更快，放大昼夜温差。",
        visualType: "机制流程图",
      },
      {
        title: "与湿润地区对比",
        focus: "湿润地区因水汽和云层更强，白天升温较慢、夜晚降温也更缓。",
        visualType: "对比图",
      },
      {
        title: "常见误区澄清",
        focus: "“沙漠一直很热”并不准确，关键差异在于昼夜温差而非全天高温。",
        visualType: "误区-事实卡",
      },
      {
        title: "总结与判断",
        focus: "判断昼夜温差大小，可优先看云量、水汽和地表热惯量三个因素。",
        visualType: "总结图",
      },
    ];
  }

  if (isChineseLanguage(outputLanguage)) {
    return [
      { title: `${topic}：核心现象`, focus: "先定义可直接观察到的现象，再明确要解释的问题。", visualType: "对比图" },
      { title: `${topic}：关键触发`, focus: "识别最先变化的上游条件，并给出触发阈值。", visualType: "机制流程图" },
      { title: `${topic}：机制传导`, focus: "用3-4步链路说明从起因到结果如何逐步形成。", visualType: "路径示意图" },
      { title: `${topic}：关键变量`, focus: "提炼2-3个可观测变量作为判断依据。", visualType: "指标看板图" },
      { title: `${topic}：对比验证`, focus: "通过前后或A/B对比验证机制是否成立。", visualType: "对比图" },
      { title: `${topic}：案例场景`, focus: "放入一个真实场景，解释结论如何落地。", visualType: "案例图解" },
      { title: `${topic}：误区澄清`, focus: "纠正常见误解，避免把相关性误判为因果。", visualType: "误区-事实卡" },
      { title: `${topic}：结论应用`, focus: "用一句可执行判断总结“如何识别、如何应对”。", visualType: "总结图" },
    ];
  }

  return [
    { title: `${topic}: Observable Pattern`, focus: "Define the visible pattern first, then state the question clearly.", visualType: "comparison view" },
    { title: `${topic}: Trigger`, focus: "Identify the first upstream trigger and practical threshold.", visualType: "mechanism flow" },
    { title: `${topic}: Propagation`, focus: "Explain the cause-to-effect chain in 3-4 steps.", visualType: "pathway diagram" },
    { title: `${topic}: Key Variables`, focus: "List 2-3 measurable variables for verification.", visualType: "indicator panel" },
    { title: `${topic}: Contrast`, focus: "Use before/after or A/B contrast to validate the mechanism.", visualType: "comparison view" },
    { title: `${topic}: Case`, focus: "Use one realistic case to ground the explanation.", visualType: "case visual" },
    { title: `${topic}: Misconception`, focus: "Correct one common misconception with factual contrast.", visualType: "myth-vs-fact card" },
    { title: `${topic}: Practical Rule`, focus: "Close with one actionable rule for recognition and response.", visualType: "summary chart" },
  ];
}

function buildSeedKeyFacts(seed: PosterSeedItem[], index: number, outputLanguage: OutputLanguage) {
  const sectionLabel = (section: "core" | "mechanism" | "memory") => {
    if (!isChineseLanguage(outputLanguage)) {
      if (section === "core") return "coreMessage";
      if (section === "mechanism") return "mechanism";
      return "memoryHook";
    }
    if (section === "core") return "核心结论";
    if (section === "mechanism") return "机制解释";
    return "记忆点";
  };
  const formatSectionLine = (section: "core" | "mechanism" | "memory", content: string) =>
    isChineseLanguage(outputLanguage)
      ? `${sectionLabel(section)}：${content}`
      : `${sectionLabel(section)}: ${content}`;

  const current = seed[index]?.focus || "";
  if (!seed.length) {
    return [
      ensureSentenceEnding(
        formatSectionLine(
          "core",
          isChineseLanguage(outputLanguage)
            ? "先描述现象。"
            : "start from one observable pattern.",
        ),
        outputLanguage,
      ),
      ensureSentenceEnding(
        formatSectionLine(
          "mechanism",
          isChineseLanguage(outputLanguage)
            ? "解释关键变量如何变化并传导。"
            : "explain how key variables shift and propagate.",
        ),
        outputLanguage,
      ),
      ensureSentenceEnding(
        formatSectionLine(
          "memory",
          isChineseLanguage(outputLanguage)
            ? "用一句可复述判断收束本页。"
            : "close with one repeatable judgment cue.",
        ),
        outputLanguage,
      ),
    ];
  }
  return [
    ensureSentenceEnding(
      formatSectionLine("core", current),
      outputLanguage,
    ),
    ensureSentenceEnding(
      formatSectionLine("mechanism", inferFallbackMechanismLine(seed[index], current, outputLanguage)),
      outputLanguage,
    ),
    ensureSentenceEnding(
      formatSectionLine("memory", inferFallbackMemoryLine(seed[index], current, outputLanguage)),
      outputLanguage,
    ),
  ];
}

function buildFallbackPlanListByLanguage(topic: string, count: number, outputLanguage: OutputLanguage): PosterPlanItem[] {
  const topicSpecificSeed = buildQuestionTopicSeed(topic, outputLanguage);
  if (topicSpecificSeed?.length) {
    const expanded = buildExtendedPosterSeed(topicSpecificSeed, count, topic, outputLanguage);
    return expanded.map((item, idx) => ({
      index: idx + 1,
      title: item.title,
      focus: ensureSentenceEnding(item.focus, outputLanguage),
      role: idx === 0 ? "cover" : idx === count - 1 ? "system-model" : "mechanism",
      keyFacts: buildSeedKeyFacts(expanded, idx, outputLanguage),
      visualType: item.visualType,
      visualElements: item.visualElements,
      layoutHint: item.layoutHint,
    }));
  }

  if (!isChineseLanguage(outputLanguage)) {
    const seed = buildExtendedPosterSeed([
      { title: `${topic} · Core framing`, focus: "Start from one observable signal and define the core mechanism." },
      { title: `${topic} · Trigger conditions`, focus: "Identify upstream conditions and the practical trigger threshold." },
      { title: `${topic} · Mechanism path`, focus: "Use a step-by-step chain to explain how effects propagate." },
      { title: `${topic} · Key variables`, focus: "Track 2-3 variables to verify whether the mechanism is active." },
      { title: `${topic} · Comparative view`, focus: "Compare before vs after states to reveal practical impact." },
      { title: `${topic} · Typical case`, focus: "Use one concrete scenario to validate the mechanism." },
      { title: `${topic} · Misconception check`, focus: "Correct one common misconception with a clear contrast." },
      { title: `${topic} · Conclusion`, focus: "Close with one actionable judgment rule." },
    ], count, topic, outputLanguage);
  return seed.map((seedItem, idx) => {
      return {
        index: idx + 1,
        title: seedItem.title,
        focus: ensureSentenceEnding(seedItem.focus, outputLanguage),
        role: idx === 0 ? "cover" : idx === count - 1 ? "system-model" : "mechanism",
        keyFacts: buildSeedKeyFacts(seed, idx, outputLanguage),
        visualType: seedItem.visualType,
        visualElements: seedItem.visualElements,
        layoutHint: seedItem.layoutHint,
      };
    });
  }
  const seed = buildExtendedPosterSeed([
    { title: `${topic}：整体框架`, focus: `${topic}通常由“触发条件—机制传导—结果呈现”三段主线组成。` },
    { title: `${topic}：触发条件`, focus: "出现前通常先有上游条件变化，并形成可识别的启动阈值。"},
    { title: `${topic}：机制路径`, focus: `关键变量会沿着链路逐步传导，最终形成可观察结果。` },
    { title: `${topic}：关键变量`, focus: "抓住2-3个核心变量，能更快判断机制是否正在演化。"},
    { title: `${topic}：对比视角`, focus: "对比变化前后状态，可更清楚识别真实影响。"},
    { title: `${topic}：案例验证`, focus: `结合一个具体场景，能验证机制是否与现实观测一致。` },
    { title: `${topic}：误区澄清`, focus: `常见误解通常来自把相关性当因果，需要用链路纠偏。` },
    { title: `${topic}：结论应用`, focus: `最终应沉淀为可执行判断：何时发生、如何识别、如何应对。` },
  ], count, topic, outputLanguage);
  return seed.map((seedItem, idx) => {
    return {
      index: idx + 1,
      title: seedItem.title,
      focus: ensureSentenceEnding(seedItem.focus, outputLanguage),
      role: idx === 0 ? "cover" : idx === count - 1 ? "system-model" : "mechanism",
      keyFacts: buildSeedKeyFacts(seed, idx, outputLanguage),
      visualType: seedItem.visualType,
      visualElements: seedItem.visualElements,
      layoutHint: seedItem.layoutHint,
    };
  });
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripListPrefix(value: string) {
  return value.replace(/^\s*(?:[-*•·]\s*|\d+[.)、\s-]+)/, "").trim();
}

function stripPromptCommandPrefix(value: string, outputLanguage: OutputLanguage) {
  const compact = value.trim();
  if (!compact) {
    return "";
  }
  if (isChineseLanguage(outputLanguage)) {
    return compact
      .replace(/^(?:海报|PPT|视频分镜)\s*\d+\s*/i, "")
      .replace(/^(?:做成?|生成|输出|成)\s*\d+\s*(?:页|张|个分镜|帧)\s*[，,:：]?\s*/i, "")
      .replace(/^(?:第\s*)?\d+\s*(?:页|张|个分镜|帧)\s*[，,:：]?\s*/i, "")
      .replace(/^(?:主题是|主题为)\s*/i, "")
      .trim();
  }
  return compact
    .replace(/^(?:poster|slide|frame)\s*\d+\s*/i, "")
    .replace(/^(?:make|generate|create)\s*\d+\s*(?:posters|slides|frames)\s*[,:-]?\s*/i, "")
    .replace(/^(?:topic is|topic:)\s*/i, "")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toConciseDraftTitle(value: string, topic: string, outputLanguage: OutputLanguage) {
  const maxZhChars = 18;
  const maxEnWords = 8;
  let candidate = normalizeWhitespace(
    stripPromptCommandPrefix(stripListPrefix(value), outputLanguage),
  )
    .replace(/^[“”"'`]+|[“”"'`]+$/g, "")
    .replace(/^(?:本页重点|页面内容|讲解文稿|画面文字|画面设计|画面结构|main\s*point|core\s*message|mechanism|memory\s*hook|narration|visual)\s*[：:]\s*/i, "")
    .split(/\n+/)[0]
    ?.trim();

  if (!candidate) {
    return "";
  }

  if (topic) {
    const topicPrefix = new RegExp(`^${escapeRegExp(topic)}\\s*[：:·\\-–—|｜]?\\s*`, "i");
    if (candidate.length > (isChineseLanguage(outputLanguage) ? maxZhChars : 48) && topicPrefix.test(candidate)) {
      const withoutTopic = candidate.replace(topicPrefix, "").trim();
      if (withoutTopic.length >= 2) {
        candidate = withoutTopic;
      }
    }
  }

  const conciseSegment = candidate
    .split(/[：:|｜，,；;。.!?！？]/)
    .map((item) => item.trim())
    .find((item) => item.length >= 2);
  if (conciseSegment && conciseSegment.length < candidate.length) {
    candidate = conciseSegment;
  }

  if (isChineseLanguage(outputLanguage)) {
    if (candidate.length > maxZhChars) {
      candidate = candidate.slice(0, maxZhChars).replace(/[，。！？；、,.;:：\-\s]+$/g, "").trim();
    }
    return candidate || topic;
  }

  const words = candidate.split(/\s+/).filter(Boolean);
  if (words.length > maxEnWords) {
    candidate = words.slice(0, maxEnWords).join(" ");
  }
  if (candidate.length > 72) {
    candidate = candidate.slice(0, 72).replace(/[.,;:!?-\s]+$/g, "").trim();
  }
  return candidate || topic;
}

function isMetaInstructionLine(value: string, outputLanguage: OutputLanguage) {
  const line = value.replace(/\s+/g, "").toLowerCase();
  if (!line) {
    return true;
  }
  if (isChineseLanguage(outputLanguage)) {
    return /用一句话|先.*再|补充|展开|复习|延展|速记|图解总结|本页重点|画面结构|讲解文稿|输出格式|写作/.test(
      line,
    );
  }
  return /one sentence|first.*then|add more|expand|quick review|extended reading|visual summary|page focus|writing/.test(
    line,
  );
}

function removeStagePrefix(value: string, outputLanguage: OutputLanguage) {
  const source = value.trim();
  if (!source) {
    return "";
  }
  if (isChineseLanguage(outputLanguage)) {
    return source.replace(
      /^(?:起点|阶段|步骤|触发|上升|储集|触发点|机制|结论|对比|案例|误区|总结)\s*[：:]\s*/i,
      "",
    );
  }
  return source.replace(/^(?:step|phase|stage|trigger|mechanism|summary)\s*\d*\s*[：:]\s*/i, "");
}

function splitDraftSentences(text: string, outputLanguage: OutputLanguage) {
  if (!text.trim()) {
    return [] as string[];
  }
  const segments = text
    .split(isChineseLanguage(outputLanguage) ? /[。！？\n]/ : /[.!?\n]/)
    .map((segment) => normalizeWhitespace(stripListPrefix(removeStagePrefix(segment, outputLanguage))))
    .filter(Boolean);
  return segments;
}

function dedupeLines(lines: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of lines) {
    const key = line.replace(/[，。,.!?！？;；:：\s]/g, "").toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(line);
  }
  return result;
}

function ensureSentenceEnding(value: string, outputLanguage: OutputLanguage) {
  const line = value.trim();
  if (!line) {
    return "";
  }
  if (isChineseLanguage(outputLanguage)) {
    return /[。！？]$/.test(line) ? line : `${line}。`;
  }
  return /[.!?]$/.test(line) ? line : `${line}.`;
}

function sanitizePlanTitle(value: string, topic: string, index: number, outputLanguage: OutputLanguage) {
  const cleaned = normalizeWhitespace(stripPromptCommandPrefix(stripListPrefix(value), outputLanguage)).replace(
    /^\d+\s*[.)、-]\s*/,
    "",
  );
  if (cleaned) {
    return toConciseDraftTitle(cleaned, topic, outputLanguage) || cleaned;
  }
  if (isChineseLanguage(outputLanguage)) {
    return index === 1
      ? toConciseDraftTitle(`${topic}：整体框架`, topic, outputLanguage)
      : toConciseDraftTitle(`${topic}：第${index}部分`, topic, outputLanguage);
  }
  return index === 1
    ? toConciseDraftTitle(`${topic}: Overview`, topic, outputLanguage)
    : toConciseDraftTitle(`${topic}: Part ${index}`, topic, outputLanguage);
}

function sanitizePlanFocus(
  value: string,
  fallback: string,
  topic: string,
  outputLanguage: OutputLanguage,
) {
  const raw = normalizeWhitespace(
    stripPromptCommandPrefix(removeStagePrefix(stripListPrefix(value), outputLanguage), outputLanguage),
  );
  const fallbackNormalized = normalizeWhitespace(removeStagePrefix(stripListPrefix(fallback), outputLanguage));
  const candidate = raw || fallbackNormalized;
  if (!candidate) {
    return ensureSentenceEnding(
      isChineseLanguage(outputLanguage)
        ? `围绕${topic}给出一个可观测事实，并说明其机制含义`
        : `Provide one observable fact about ${topic} and explain the mechanism implication`,
      outputLanguage,
    );
  }
  if (isMetaInstructionLine(candidate, outputLanguage)) {
    return ensureSentenceEnding(fallbackNormalized || candidate, outputLanguage);
  }
  return ensureSentenceEnding(candidate, outputLanguage);
}

function sanitizePlanFactList(
  values: string[] | undefined,
  topic: string,
  outputLanguage: OutputLanguage,
  maxItems = 5,
) {
  const normalized = dedupeLines(
    (values || [])
      .map((value) =>
        normalizeWhitespace(stripPromptCommandPrefix(removeStagePrefix(stripListPrefix(value), outputLanguage), outputLanguage)),
      )
      .filter((value) => value && !isMetaInstructionLine(value, outputLanguage)),
  );
  if (normalized.length) {
    return normalized.slice(0, maxItems).map((value) => ensureSentenceEnding(value, outputLanguage));
  }
  return [
    ensureSentenceEnding(
      isChineseLanguage(outputLanguage)
        ? `${topic}可以通过关键变量变化来验证机制是否成立`
        : `${topic} can be verified through key variable changes`,
      outputLanguage,
    ),
  ];
}

function sanitizePlanVisualElements(
  values: string[] | undefined,
  topic: string,
  outputLanguage: OutputLanguage,
) {
  const normalized = dedupeLines(
    (values || [])
      .map((value) => normalizeWhitespace(stripListPrefix(value)))
      .filter(Boolean),
  );
  if (normalized.length) {
    return normalized.slice(0, 6);
  }
  if (isChineseLanguage(outputLanguage)) {
    return [`${topic}主图`, "关键变量标签", "箭头链路", "结论区"];
  }
  return [`${topic} main visual`, "key variable labels", "causal arrows", "summary block"];
}

function collectFactBankFromPosterDraft(draft: PosterDraft, topic: string, outputLanguage: OutputLanguage) {
  const candidates = [
    ...splitDraftSentences(draft.subtitle || "", outputLanguage),
    ...splitDraftSentences(draft.body || "", outputLanguage),
    ...draft.points.flatMap((point) => splitDraftSentences(point, outputLanguage)),
  ].filter((line) => !isMetaInstructionLine(line, outputLanguage));

  const deduped = dedupeLines(candidates).slice(0, 12);
  if (deduped.length) {
    return deduped;
  }
  if (isChineseLanguage(outputLanguage)) {
    return [
      `${topic}通常由触发条件、机制传导与结果呈现三段主线组成。`,
      `关键变量先在上游变化，再逐步传导到下游结果。`,
      `通过连续观测关键指标可以判断${topic}是否持续。`,
    ];
  }
  return [
    `${topic} is usually explained by triggers, mechanism propagation, and observed outcomes.`,
    `Key variables tend to change upstream before downstream effects appear.`,
    `Tracking key indicators over time helps verify whether ${topic} persists.`,
  ];
}

type PosterPageRole =
  | "cover"
  | "mechanism"
  | "layered-diagram"
  | "comparison"
  | "misconception-fact"
  | "checklist"
  | "system-model";

function simplifyTechnicalTerms(value: string, outputLanguage: OutputLanguage) {
  if (!isChineseLanguage(outputLanguage)) {
    return value.trim();
  }
  return value
    .replace(/长波辐射(?:更容易)?散失/g, "热量更容易跑向天空")
    .replace(/水汽回辐能力弱/g, "空气保温能力弱")
    .replace(/水汽回辐弱/g, "空气保温能力弱")
    .replace(/热惯量低/g, "不擅长储热")
    .trim();
}

function isShortKnowledgeModule(value: string, outputLanguage: OutputLanguage) {
  const compact = value.replace(/\s+/g, "");
  if (!compact) {
    return true;
  }
  if (isChineseLanguage(outputLanguage)) {
    return compact.length <= 12;
  }
  return compact.length <= 24;
}

function buildKnowledgeModulesFromDraft(args: {
  topic: string;
  draft: PosterDraft;
  outputLanguage: OutputLanguage;
}) {
  const { topic, draft, outputLanguage } = args;
  const baseFacts = collectFactBankFromPosterDraft(draft, topic, outputLanguage)
    .map((line) => simplifyTechnicalTerms(line, outputLanguage))
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);
  const merged: string[] = [];
  for (let i = 0; i < baseFacts.length; i += 1) {
    const current = baseFacts[i];
    if (!current) {
      continue;
    }
    if (isShortKnowledgeModule(current, outputLanguage) && i + 1 < baseFacts.length) {
      const next = baseFacts[i + 1];
      const joined = isChineseLanguage(outputLanguage) ? `${current}，${next}` : `${current}; ${next}`;
      merged.push(normalizeWhitespace(joined));
      i += 1;
      continue;
    }
    merged.push(current);
  }
  const deduped = dedupeLines(merged).slice(0, 14);
  if (deduped.length) {
    return deduped;
  }
  if (isChineseLanguage(outputLanguage)) {
    return [
      `${topic}先表现为可观察现象。`,
      `${topic}背后有可解释的变量变化机制。`,
      `${topic}可通过对比或案例验证结论是否成立。`,
    ];
  }
  return [
    `${topic} first appears as an observable pattern.`,
    `${topic} is driven by explainable variable changes.`,
    `${topic} can be validated through comparison or case evidence.`,
  ];
}

function buildRoleFunctionalModule(args: {
  topic: string;
  role: PosterPageRole;
  pageIndex: number;
  outputLanguage: OutputLanguage;
}) {
  const { topic, role, pageIndex, outputLanguage } = args;
  if (!isChineseLanguage(outputLanguage)) {
    if (role === "cover") return `${topic} can be framed by one observable pattern and one key question.`;
    if (role === "mechanism") return `The ${topic} mechanism depends on variable order and propagation path.`;
    if (role === "layered-diagram") return `${topic} should be explained in three layers: condition, process, outcome.`;
    if (role === "comparison") return `Comparing two conditions reveals how ${topic} changes in magnitude and speed.`;
    if (role === "misconception-fact") return `A common misconception about ${topic} can be corrected by checking causal order.`;
    if (role === "checklist") return `Use a quick checklist to judge whether ${topic} is active right now.`;
    return `Build one system model to decide when ${topic} needs action and how to respond.`;
  }
  if (role === "cover") return `${topic}可以先用一个可观察现象和一个核心问题来总起。`;
  if (role === "mechanism") return `${topic}的关键机制取决于变量先后顺序和传导路径。`;
  if (role === "layered-diagram") return `${topic}建议按“条件层—过程层—结果层”分层解释。`;
  if (role === "comparison") return `对比两个场景能看清${topic}在强度和速度上的差异。`;
  if (role === "misconception-fact") return `${topic}常见误区可通过核对因果先后顺序来纠偏。`;
  if (role === "checklist") return `用一张清单可以快速判断${topic}当前是否正在发生。`;
  return `把${topic}放进系统联动模型，才能判断何时应对与如何应对。`;
}

function buildRoleModuleSequence(args: {
  topic: string;
  modules: string[];
  roles: PosterPageRole[];
  outputLanguage: OutputLanguage;
}) {
  const { topic, modules, roles, outputLanguage } = args;
  const result: string[] = [];
  const used = new Set<string>();
  let cursor = 0;
  for (let i = 0; i < roles.length; i += 1) {
    let chosen = "";
    while (cursor < modules.length) {
      const candidate = normalizeWhitespace(modules[cursor] || "");
      cursor += 1;
      const key = candidate.replace(/[，。,.!?！？;；:：\s]/g, "").toLowerCase();
      if (!candidate || !key || used.has(key)) {
        continue;
      }
      chosen = candidate;
      used.add(key);
      break;
    }
    if (!chosen) {
      chosen = buildRoleFunctionalModule({
        topic,
        role: roles[i],
        pageIndex: i + 1,
        outputLanguage,
      });
      const key = chosen.replace(/[，。,.!?！？;；:：\s]/g, "").toLowerCase();
      if (key) {
        used.add(key);
      }
    }
    result.push(chosen);
  }
  return result;
}

function buildPosterRoleBlueprint(count: number): PosterPageRole[] {
  if (count <= 1) {
    return ["cover"];
  }
  if (count === 2) {
    return ["cover", "system-model"];
  }
  if (count === 3) {
    return ["cover", "mechanism", "system-model"];
  }
  if (count === 4) {
    return ["cover", "mechanism", "comparison", "system-model"];
  }
  if (count === 5) {
    return ["cover", "mechanism", "layered-diagram", "comparison", "system-model"];
  }
  if (count === 6) {
    return ["cover", "mechanism", "layered-diagram", "comparison", "misconception-fact", "system-model"];
  }
  if (count === 7) {
    return ["cover", "mechanism", "layered-diagram", "comparison", "misconception-fact", "checklist", "system-model"];
  }
  const roles: PosterPageRole[] = [
    "cover",
    "mechanism",
    "layered-diagram",
    "comparison",
    "misconception-fact",
    "checklist",
  ];
  const middleCycle: PosterPageRole[] = [
    "mechanism",
    "layered-diagram",
    "comparison",
    "misconception-fact",
    "checklist",
  ];
  while (roles.length < count - 1) {
    const idx = roles.length - 1;
    roles.push(middleCycle[idx % middleCycle.length]);
  }
  roles.push("system-model");
  return roles;
}

function buildRoleTitle(
  topic: string,
  role: PosterPageRole,
  pageIndex: number,
  outputLanguage: OutputLanguage,
) {
  if (!isChineseLanguage(outputLanguage)) {
    if (role === "cover") return `${topic}: Core Overview`;
    if (role === "mechanism") return `${topic}: Mechanism`;
    if (role === "layered-diagram") return `${topic}: Layered Diagram`;
    if (role === "comparison") return `${topic}: Comparison`;
    if (role === "misconception-fact") return `${topic}: Misconception vs Fact`;
    if (role === "checklist") return `${topic}: Quick Checklist`;
    return `${topic}: System Model`;
  }
  if (role === "cover") return `${topic}：核心总览`;
  if (role === "mechanism") return `${topic}：关键机制`;
  if (role === "layered-diagram") return `${topic}：分层图解`;
  if (role === "comparison") return `${topic}：对比验证`;
  if (role === "misconception-fact") return `${topic}：误区-事实`;
  if (role === "checklist") return `${topic}：判断清单`;
  return `${topic}：系统模型`;
}

function buildRoleVisualType(role: PosterPageRole, outputLanguage: OutputLanguage) {
  if (!isChineseLanguage(outputLanguage)) {
    if (role === "cover") return "overview map";
    if (role === "mechanism") return "mechanism flow";
    if (role === "layered-diagram") return "layered mechanism diagram";
    if (role === "comparison") return "comparison view";
    if (role === "misconception-fact") return "myth-vs-fact card";
    if (role === "checklist") return "checklist card";
    return "system model chart";
  }
  if (role === "cover") return "总览图";
  if (role === "mechanism") return "机制流程图";
  if (role === "layered-diagram") return "分层机制图";
  if (role === "comparison") return "对比图";
  if (role === "misconception-fact") return "误区-事实卡";
  if (role === "checklist") return "判断清单图";
  return "系统模型图";
}

function buildRoleLayoutHint(role: PosterPageRole, outputLanguage: OutputLanguage) {
  if (!isChineseLanguage(outputLanguage)) {
    if (role === "cover") return "title area + one overview visual + 2 support labels";
    if (role === "system-model") return "title area + system model + judgment framework";
    if (role === "checklist") return "title area + checklist grid + one quick decision cue";
    if (role === "misconception-fact") return "left misconception card + right fact card + short correction line";
    if (role === "layered-diagram") return "top title + middle layered process + bottom key variables";
    return "title area + single-core visual + short evidence strip";
  }
  if (role === "cover") return "标题区 + 一张总览主图 + 2条辅助标签";
  if (role === "system-model") return "标题区 + 系统联动模型 + 判断框架";
  if (role === "checklist") return "标题区 + 清单卡片区 + 1条决策提示";
  if (role === "misconception-fact") return "左误区右事实 + 底部纠偏结论";
  if (role === "layered-diagram") return "标题区 + 中部分层图 + 底部变量区";
  return "标题区 + 单核心主图 + 简短证据区";
}

function buildRoleSpecificCoreMessage(args: {
  role: PosterPageRole;
  moduleText: string;
  topic: string;
  pageIndex: number;
  outputLanguage: OutputLanguage;
}) {
  const { role, moduleText, topic, pageIndex, outputLanguage } = args;
  if (!isChineseLanguage(outputLanguage)) {
    if (role === "cover") return `${topic} overview: ${moduleText}`;
    if (role === "layered-diagram") return `Layered view ${pageIndex}: ${moduleText}`;
    if (role === "comparison") return `Comparison view ${pageIndex}: ${moduleText}`;
    if (role === "misconception-fact") return `Misconception-fact check ${pageIndex}: ${moduleText}`;
    if (role === "checklist") return `Checklist ${pageIndex}: ${moduleText}`;
    if (role === "system-model") return `${topic} system model: ${moduleText}`;
    return `Mechanism focus ${pageIndex}: ${moduleText}`;
  }
  if (role === "cover") return `${topic}核心现象：${moduleText}`;
  if (role === "layered-diagram") return `分层图解 ${pageIndex}：${moduleText}`;
  if (role === "comparison") return `对比视角 ${pageIndex}：${moduleText}`;
  if (role === "misconception-fact") return `误区事实 ${pageIndex}：${moduleText}`;
  if (role === "checklist") return `判断清单 ${pageIndex}：${moduleText}`;
  if (role === "system-model") return `${topic}系统模型：${moduleText}`;
  return `机制拆解 ${pageIndex}：${moduleText}`;
}

function buildPageCoreBundle(args: {
  topic: string;
  role: PosterPageRole;
  moduleText: string;
  outputLanguage: OutputLanguage;
}) {
  const { topic, role, moduleText, outputLanguage } = args;
  const coreMessage = ensureSentenceEnding(simplifyTechnicalTerms(moduleText, outputLanguage), outputLanguage);
  const formatSectionLine = (section: "core" | "mechanism" | "memory", content: string) => {
    if (isChineseLanguage(outputLanguage)) {
      if (section === "core") return `核心结论：${content}`;
      if (section === "mechanism") return `机制解释：${content}`;
      return `记忆点：${content}`;
    }
    if (section === "core") return `coreMessage: ${content}`;
    if (section === "mechanism") return `mechanism: ${content}`;
    return `memoryHook: ${content}`;
  };
  if (isChineseLanguage(outputLanguage)) {
    if (role === "system-model") {
      return {
        coreMessage,
        keyFacts: [
          formatSectionLine("core", coreMessage),
          formatSectionLine("mechanism", "把关键变量按“上游触发→中游传导→下游结果”放进一个联动模型。"),
          formatSectionLine("memory", `判断框架=现象是否持续出现→机制证据是否一致→${topic}是否需要立即应对。`),
        ],
      };
    }
    if (role === "misconception-fact") {
      return {
        coreMessage,
        keyFacts: [
          formatSectionLine("core", coreMessage),
          formatSectionLine("mechanism", "误区常把相关性当因果，先核对变量先后顺序再下结论。"),
          formatSectionLine("memory", "三连问=谁先变→为什么变→怎么验证。"),
        ],
      };
    }
    if (role === "checklist") {
      return {
        coreMessage,
        keyFacts: [
          formatSectionLine("core", coreMessage),
          formatSectionLine("mechanism", "把机制拆成可打勾步骤，逐条核对是否满足。"),
          formatSectionLine("memory", "清单法=看信号、看链路、看证据、看行动。"),
        ],
      };
    }
    if (role === "comparison") {
      return {
        coreMessage,
        keyFacts: [
          formatSectionLine("core", coreMessage),
          formatSectionLine("mechanism", "同一机制在不同条件下会放大或减弱结果。"),
          formatSectionLine("memory", "对比法=前后并排看，A/B成对看。"),
        ],
      };
    }
    if (role === "layered-diagram") {
      return {
        coreMessage,
        keyFacts: [
          formatSectionLine("core", coreMessage),
          formatSectionLine("mechanism", "按“条件层→过程层→结果层”分层展示，不跨层跳结论。"),
          formatSectionLine("memory", "三层记忆=先条件、再过程、后结果。"),
        ],
      };
    }
    return {
      coreMessage,
      keyFacts: [
        formatSectionLine("core", coreMessage),
        formatSectionLine("mechanism", "抓住关键变量变化链路，解释结果如何形成。"),
        formatSectionLine("memory", "用一个可观察场景快速验证这条机制。"),
      ],
    };
  }
  if (role === "system-model") {
    return {
      coreMessage,
      keyFacts: [
        formatSectionLine("core", coreMessage),
        formatSectionLine("mechanism", "place key variables in one linked model from upstream trigger to downstream outcome."),
        formatSectionLine("memory", `judgment frame = recurring pattern -> mechanism evidence -> whether ${topic} needs immediate action.`),
      ],
    };
  }
  if (role === "misconception-fact") {
    return {
      coreMessage,
      keyFacts: [
        formatSectionLine("core", coreMessage),
        formatSectionLine("mechanism", "misconceptions often treat correlation as causation; verify variable order first."),
        formatSectionLine("memory", "who changed first -> why it changed -> how to verify."),
      ],
    };
  }
  if (role === "checklist") {
    return {
      coreMessage,
      keyFacts: [
        formatSectionLine("core", coreMessage),
        formatSectionLine("mechanism", "convert the mechanism into a checklist of observable checks."),
        formatSectionLine("memory", "checklist = signal, pathway, evidence, action."),
      ],
    };
  }
  if (role === "comparison") {
    return {
      coreMessage,
      keyFacts: [
        formatSectionLine("core", coreMessage),
        formatSectionLine("mechanism", "the same process amplifies or weakens under different conditions."),
        formatSectionLine("memory", "compare before/after and A/B side-by-side."),
      ],
    };
  }
  if (role === "layered-diagram") {
    return {
      coreMessage,
      keyFacts: [
        formatSectionLine("core", coreMessage),
        formatSectionLine("mechanism", "show condition layer -> process layer -> outcome layer without cross-layer jumps."),
        formatSectionLine("memory", "three layers = condition, process, outcome."),
      ],
    };
  }
  return {
    coreMessage,
    keyFacts: [
      formatSectionLine("core", coreMessage),
      formatSectionLine("mechanism", "follow the key variable chain to explain outcome formation."),
      formatSectionLine("memory", "validate this mechanism with one observable scenario."),
    ],
  };
}

function composeRichFocusFromFactBank(args: {
  factBank: string[];
  index: number;
  topic: string;
  outputLanguage: OutputLanguage;
}) {
  const { factBank, index, topic, outputLanguage } = args;
  const current = factBank[index % Math.max(factBank.length, 1)] || "";
  const next = factBank[(index + 1) % Math.max(factBank.length, 1)] || "";
  const prev = factBank[(index - 1 + Math.max(factBank.length, 1)) % Math.max(factBank.length, 1)] || "";
  const candidate = [current, next, prev].map((line) => line.trim()).filter(Boolean);
  if (!candidate.length) {
    return ensureSentenceEnding(
      isChineseLanguage(outputLanguage)
        ? `围绕${topic}补充“现象、机制、验证”三个层次的解释`
        : `Explain ${topic} with pattern, mechanism, and validation in one focus block`,
      outputLanguage,
    );
  }
  if (isChineseLanguage(outputLanguage)) {
    const head = ensureSentenceEnding(candidate[0], outputLanguage);
    const tail = candidate[1]
      ? ensureSentenceEnding(`机制解释：${candidate[1]}`, outputLanguage)
      : ensureSentenceEnding("机制解释：补充关键变量变化与验证线索", outputLanguage);
    return `${head} ${tail}`.trim();
  }
  const head = ensureSentenceEnding(candidate[0], outputLanguage);
  const tail = candidate[1]
    ? ensureSentenceEnding(`Mechanism note: ${candidate[1]}`, outputLanguage)
    : ensureSentenceEnding("Mechanism note: add key variable shifts and one validation cue", outputLanguage);
  return `${head} ${tail}`.trim();
}

function getPosterVisualTypePool(baseVisualType: string | undefined, outputLanguage: OutputLanguage) {
  const defaults = isChineseLanguage(outputLanguage)
    ? ["机制流程图", "分层结构图", "对比图", "路径示意图", "指标看板图", "总结图"]
    : ["mechanism flow", "layered structure", "comparison view", "pathway diagram", "indicator panel", "summary chart"];
  if (!baseVisualType?.trim()) {
    return defaults;
  }
  return dedupeLines([baseVisualType.trim(), ...defaults]);
}

function isPlanListLowQuality(planList: PosterPlanItem[], outputLanguage: OutputLanguage) {
  if (!planList.length) {
    return true;
  }
  const focusValues = planList.map((item) => item.focus.trim()).filter(Boolean);
  const distinctFocus = dedupeLines(focusValues);
  const metaFocusCount = focusValues.filter((line) => isMetaInstructionLine(line, outputLanguage)).length;
  if (distinctFocus.length < Math.ceil(planList.length * 0.85)) {
    return true;
  }
  if (metaFocusCount > 0) {
    return true;
  }
  const compactPrefix = focusValues.map((line) =>
    line.replace(/[，。,.!?！？;；:：\s]/g, "").slice(0, 16).toLowerCase(),
  );
  let adjacentNearDup = 0;
  for (let i = 1; i < compactPrefix.length; i += 1) {
    if (compactPrefix[i] && compactPrefix[i] === compactPrefix[i - 1]) {
      adjacentNearDup += 1;
    }
  }
  if (adjacentNearDup >= 1) {
    return true;
  }
  const badTitleCount = planList.filter((item) =>
    /(?:做成|成)\s*\d+\s*(?:页|张|个分镜|帧)|生成\s*\d+|主题是|本页重点|海报\s*\d|第\s*\d+\s*(?:页|张)|poster\s*\d/i.test(item.title),
  ).length;
  const visualTypes = planList.map((item) => (item.visualType || "").trim()).filter(Boolean);
  const uniqueVisualTypes = dedupeLines(visualTypes);
  const lowVisualDiversity = planList.length >= 4 && visualTypes.length >= 4 && uniqueVisualTypes.length <= 1;
  const overlyGenericFocusCount = planList.filter((item) =>
    /三段主线|关键变量会沿着链路|可执行判断|trigger.*propagation|key variables/i.test(item.focus),
  ).length;
  return badTitleCount > 0 || lowVisualDiversity || overlyGenericFocusCount >= Math.ceil(planList.length * 0.5);
}

function buildFallbackPosterPlanFromDraft(args: {
  topic: string;
  count: number;
  posterDraft: PosterDraft;
  outputLanguage: OutputLanguage;
  baseVisualType?: string;
}) {
  const { topic, count, posterDraft, outputLanguage } = args;
  const modules = buildKnowledgeModulesFromDraft({
    topic,
    draft: posterDraft,
    outputLanguage,
  });
  const roles = buildPosterRoleBlueprint(count);
  const roleModules = buildRoleModuleSequence({
    topic,
    modules,
    roles,
    outputLanguage,
  });

  return Array.from({ length: count }, (_, idx) => {
    const index = idx + 1;
    const role = roles[idx] || (idx === 0 ? "cover" : idx === count - 1 ? "system-model" : "mechanism");
    const moduleText = roleModules[idx] || buildRoleFunctionalModule({
      topic,
      role,
      pageIndex: index,
      outputLanguage,
    });
    const roleCore = buildRoleSpecificCoreMessage({
      role,
      moduleText,
      topic,
      pageIndex: index,
      outputLanguage,
    });
    const bundle = buildPageCoreBundle({
      topic,
      role,
      moduleText: roleCore,
      outputLanguage,
    });
    return {
      index,
      title: buildRoleTitle(topic, role, index, outputLanguage),
      focus: bundle.coreMessage,
      role,
      keyFacts: sanitizePlanFactList(bundle.keyFacts, topic, outputLanguage),
      visualType: buildRoleVisualType(role, outputLanguage),
      visualElements: sanitizePlanVisualElements(posterDraft.visualElements, topic, outputLanguage),
      layoutHint: buildRoleLayoutHint(role, outputLanguage),
      imagePromptDraft: "",
      imagePrompt: "",
    } as PosterPlanItem;
  });
}

function parseJsonContent(content: string) {
  const parseTypedJson = (raw: string) => {
    return JSON.parse(raw) as {
      headline?: string;
      subtitle?: string;
      body?: string;
      points?: string[];
      cta?: string;
      visualType?: string;
      layoutSuggestion?: string;
      visualElements?: string[];
      posterDraft?: {
        headline?: string;
        subtitle?: string;
        body?: string;
        points?: string[];
        cta?: string;
        visualType?: string;
        layoutSuggestion?: string;
        visualElements?: string[];
      };
      legacyCompat?: {
        headline?: string;
        subtitle?: string;
        body?: string;
        points?: string[];
        cta?: string;
        visualType?: string;
        layoutSuggestion?: string;
        visualElements?: string[];
      };
      planList?: Array<{
        index?: number;
        role?: string;
        title?: string;
        focus?: string;
        keyFacts?: string[];
        visualType?: string;
        visualElements?: string[];
        layoutHint?: string;
        imagePromptDraft?: string;
        imagePrompt?: string;
      }>;
      outlineItems?: string[];
      slideDrafts?: PptSlideDraft[];
      storyboardDrafts?: VideoStoryboardDraft[];
    };
  };

  const unwrapFence = (raw: string) =>
    raw
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

  const extractJsonSlice = (raw: string) => {
    const source = raw.trim();
    const start = source.indexOf("{");
    if (start < 0) {
      return "";
    }
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < source.length; i += 1) {
      const char = source[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (inString) {
        continue;
      }
      if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          return source.slice(start, i + 1);
        }
      }
    }
    return "";
  };

  const candidates = [
    content.trim(),
    unwrapFence(content),
    extractJsonSlice(content),
    extractJsonSlice(unwrapFence(content)),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return parseTypedJson(candidate);
    } catch {
      // try next candidate
    }
  }

  const loose = content
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2018|\u2019/g, "'")
    .trim();
  const looseSlice = extractJsonSlice(loose);
  if (looseSlice) {
    try {
      return parseTypedJson(looseSlice);
    } catch {
      // fall through
    }
  }

  return null;
}

function normalizeTextItem(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isTemplateInstructionText(value: string) {
  const compact = value.replace(/\s+/g, "").toLowerCase();
  if (!compact) {
    return true;
  }
  return /讲解目标|机制说明|应用收束|版式建议|口播目标|口播顺序|字幕规则|画面建议|学习目标|个人、行业|行动建议|进阶补充|扩展主题|advancedextension|narrationobjective|narrationorder|captions?rule|layoutsuggestion|teachingobjective/.test(
    compact,
  );
}

function buildGenericMediaSeed(topic: string, count: number, direction: "ppt" | "video", outputLanguage: OutputLanguage) {
  const topicSeed = buildQuestionTopicSeed(topic, outputLanguage);
  if (topicSeed?.length) {
    const expanded = buildExtendedPosterSeed(topicSeed, count, topic, outputLanguage);
    return expanded.map((item, idx) => {
      const facts = buildSeedKeyFacts(expanded, idx, outputLanguage);
      const core = facts[0]?.replace(/^(核心结论|coreMessage)\s*[：:]\s*/, "") || item.focus;
      const mechanism = facts[1]?.replace(/^(机制解释|mechanism)\s*[：:]\s*/, "") || item.focus;
      const memory = facts[2]?.replace(/^(记忆点|memoryHook)\s*[：:]\s*/, "") || "";
      return {
        title: item.title.replace(new RegExp(`^${topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[:：·\\s]*`), ""),
        mainPoint: core,
        body: [core, mechanism, memory].filter(Boolean).join("\n"),
        narration: core,
        visual: item.visualType || (isChineseLanguage(outputLanguage) ? "机制信息图" : "mechanism infographic"),
        imagePrompt:
          direction === "video"
            ? `Educational explainer still frame about ${item.title}, ${item.visualType || "clear visual beat"}, no subtitles, no dense text.`
            : `Educational slide infographic about ${item.title}, ${item.visualType || "clear diagram"}, concise visual hierarchy.`,
      };
    });
  }

  const isZh = isChineseLanguage(outputLanguage);
  const isDesertTopic = isZh && /沙漠|昼夜|白天|晚上|温差/.test(topic.replace(/\s+/g, ""));
  if (isDesertTopic) {
    const desertSeed = [
      ["沙漠昼夜温差", "同一地点在一天内温度可大幅波动，白天升温快、夜晚降温也快。\n关键不是沙漠一直热，而是它不擅长保温。", "沙漠最反常的地方，不是白天很热，而是夜里会迅速变冷。理解这个昼夜反差，才能抓住沙漠气候的关键。", "左右分屏：左侧烈日下沙地快速升温，右侧夜空下热量向上散走，中间用温度曲线表现陡升陡降。"],
      ["白天升温快", "沙漠云量少、遮挡弱，太阳辐射更直接到达地表。\n地表吸收能量快，温度上升也更快。", "白天沙漠上空云量少，太阳能量几乎直接打到地表。沙地吸收得快，所以温度会在短时间内明显升高。", "太阳占据画面上方，粗箭头穿过稀薄云层直达沙地，地表温度计快速上升，突出白天能量输入。"],
      ["地表不擅长储热", "沙地和裸岩不像水体那样擅长储热，受热快、失热也快。\n这会放大一天内的温度波动。", "沙地和裸岩不像水体那样擅长储热。它们白天热得快，到了晚上也凉得快，于是温差被进一步拉大。", "沙地与湖水并排对比：沙地温度计剧烈波动，水体温度计变化平缓，用储热能力差异解释温差。"],
      ["夜晚散热更直接", "入夜后没有太阳继续输入能量，地表热量更容易向天空散走。\n云层少时，夜间保温效果更弱。", "到了晚上，太阳不再继续输入能量，地表开始向天空散热。因为云层少，热量更容易离开近地面。", "夜晚沙漠地表变暗，红色热量箭头从地面向星空散出，稀少云层无法形成保温层。"],
      ["空气干燥不保温", "水汽少意味着空气保温能力弱，夜里难以把热量留在近地面。\n少云少水汽共同削弱了夜间保温层。", "沙漠空气很干燥，水汽少，保温能力就弱。你可以把它理解成少了一层保温被，夜里热量留不住。", "把湿润空气画成厚保温层、沙漠干空气画成稀薄透明层，热量从薄层中快速逃逸。"],
      ["湿润地区更缓和", "湿润地区云层和水汽更多，白天升温较慢，夜晚降温也更缓。\n对比后更容易看出沙漠温差大的原因。", "湿润地区有更多水汽和云层，白天能缓冲升温，夜里也能减慢降温。对比之后，沙漠的温差就更明显。", "左侧沙漠温度曲线陡升陡降，右侧湿润地区曲线平缓，云层和水汽作为缓冲层显示。"],
      ["常见误区", "“沙漠一直很热”并不准确。\n更准确的说法是：沙漠昼夜温差大，白天热、夜晚冷。", "所以说沙漠一直很热，其实并不准确。更准确的说法是：沙漠白天热得快，夜晚也冷得快。", "误区卡片被划掉：沙漠一直很热；事实卡片突出：白天热、夜晚冷，旁边配昼夜温度对比。"],
      ["三因素判断", "判断昼夜温差，优先看三件事：云量、水汽、地表材质。\n云少、水汽少、地表不储热，温差通常更大。", "判断一个地方昼夜温差大不大，可以先看三件事：云量、水汽和地表材质。云少、水汽少、地表不储热，温差通常更大。", "三个节点依次出现：云量、水汽、地表材质，最终汇聚到昼夜温差结果，箭头清晰、文字极少。"],
      ["变量如何联动", "少云让白天更容易升温，少水汽让夜晚更难保温。\n地表不擅长储热，会把这种昼夜差异进一步放大。", "云量、水汽和地表材质不是各自独立发挥作用。它们会一起影响升温和散热，最终把昼夜温差放大。", "云量少、水汽少、地表储热弱三个变量同时亮起，箭头汇聚到一个放大的温差计。"],
      ["一天温度时间线", "清晨温度较低，中午快速升高，日落后又迅速下降。\n把一天拆成时间线，可以更直观看到升温和降温速度。", "把一天摊开看，沙漠温度常像一条陡升陡降的曲线。中午升得快，日落后降得也快。", "横向时间线从清晨到夜晚，温度曲线先陡升再陡降，背景光线从日出过渡到星空。"],
      ["怎么快速判断", "看到晴朗、干燥、裸露地表，就要警惕昼夜温差更大。\n如果云层厚、水汽多或地表含水量高，温差通常会被削弱。", "快速判断时，可以先看天空、空气和地表。天空少云、空气干燥、地表裸露，通常就意味着更大的昼夜温差。", "画面依次检查天空、空气、地表三个图标，每个图标连接到温差大小判断，不出现长段文字。"],
      ["迁移到其他地区", "类似逻辑也能解释干旱内陆、高原荒漠等地区的昼夜温差。\n关键不是名字叫不叫沙漠，而是云量、水汽和储热能力。", "这套逻辑不只适用于沙漠，也能迁移到高原和干旱内陆。只要少云、干燥、地表储热弱，温差就容易变大。", "地图式小场景并列展示沙漠、高原、干旱内陆，用同一套三因素模型连接这些地区。"],
      ["真实场景应用", "沙漠旅行常需要同时准备防晒和保暖用品。\n白天应防强日照，夜间则要应对快速降温。", "这也是为什么去沙漠旅行，白天要防晒，晚上还要保暖。你面对的不是单纯高温，而是剧烈的温度切换。", "旅行背包分成白天和夜晚两侧：一侧是帽子、防晒，另一侧是外套、保暖装备，呼应昼夜温差。"],
      ["一页复盘模型", "沙漠昼夜温差大的判断公式：白天强输入，夜晚弱保温，地表不储热。\n这三点同时出现，昼夜温差就容易被拉大。", "最后用一句话记住：白天强输入，夜晚弱保温，地表又不擅长储热。三点叠加，沙漠昼夜温差就会变大。", "结尾总模型：强输入、弱保温、不储热三个模块围绕一个大温差计排列，形成清晰收束画面。"],
    ] as const;
    return Array.from({ length: count }, (_, idx) => {
      const item = desertSeed[idx];
      if (item) {
        const [title, pptBody, narration, visual] = item;
        return {
          title,
          mainPoint: direction === "video" ? narration : pptBody.split("\n")[0],
          body: direction === "ppt" ? pptBody : narration,
          narration,
          visual: direction === "video" ? visual : visual.replace(/^.*?：/, ""),
          imagePrompt:
            direction === "video"
              ? `Educational explainer still frame for ${title}. ${visual} No subtitles, no dense text.`
              : `Educational slide infographic for ${title}. ${visual} Concise hierarchy.`,
        };
      }
      const extraIndex = idx - desertSeed.length + 1;
      return {
        title: direction === "video" ? `补充镜头 ${extraIndex}` : `${topic}延展页 ${extraIndex}`,
        mainPoint: `${topic}补充一个新的观察角度，避免重复前文结论。`,
        body: `${topic}补充一个新的观察角度，避免重复前文结论。\n本页应服务于对比、误区、判断、案例或迁移应用中的一种功能。`,
        narration: `${topic}在这一帧补充一个新的观察角度，只围绕一个变化点展开。先说明画面中的变化，再给出它对结果的影响。`,
        visual: "单一重点的信息图模块，围绕新视角给出一个明确主体、一个动作和一个结果。",
        imagePrompt: `Educational ${direction === "video" ? "storyboard frame" : "slide infographic"} for ${topic}, one new perspective, single clear visual focus, no repetition.`,
      };
    });
  }
  const pptRoles = isZh
    ? [
        ["核心问题", `${topic}的关键是把可观察现象、触发条件和最终结果连接起来。`, "主题主视觉 + 一句话结论"],
        ["现象观察", `${topic}先表现为一个可直接感知的变化，而不是抽象概念。`, "现象对比图"],
        ["关键机制", `解释${topic}时，应抓住最先变化的变量和它带来的连锁反应。`, "因果链路图"],
        ["变量路径", `2-3个关键变量通常决定${topic}会被放大还是减弱。`, "变量框架图"],
        ["对比验证", `通过前后或A/B对比，可以判断机制解释是否成立。`, "对比卡片"],
        ["误区澄清", `常见误解往往来自只看结果、不看形成过程。`, "误区-事实卡"],
        ["判断框架", `最终可按“现象、变量、结果”三步复盘${topic}。`, "三步判断框架"],
      ]
    : [
        ["Core Question", `${topic} is best explained by linking the visible pattern, trigger, and outcome.`, "hero visual + one takeaway"],
        ["Observable Pattern", `${topic} starts from a visible change rather than an abstract label.`, "before-after comparison"],
        ["Key Mechanism", `The explanation should track the first changing variable and the chain reaction it creates.`, "causal chain diagram"],
        ["Variable Path", `Two or three key variables usually decide whether the effect grows or weakens.`, "variable framework"],
        ["Contrast Check", `A/B contrast helps verify whether the mechanism explains the result.`, "comparison cards"],
        ["Misconception", `Misunderstandings often come from seeing the outcome without the process.`, "myth-fact card"],
        ["Judgment Framework", `Use pattern, variables, and outcome as the final review frame.`, "three-step framework"],
      ];
  const videoRoles = isZh
    ? [
        ["冲突开场", `${topic}先用一个强反差画面抓住注意力，让观众立刻知道矛盾在哪里。接着用一句话点出本集要解释的关键机制。`, "强对比封面画面"],
        ["现象镜头", `观众先看到${topic}最直观的变化，再理解这个变化为什么值得解释。画面要把现象讲清楚，而不是只给概念标签。`, "现实场景特写"],
        ["第一原因", `先锁定第一个发生变化的关键变量，它通常决定后续链路怎么展开。把起点讲清楚，后面的因果才不会散。`, "单变量动作画面"],
        ["机制传导", `变化不会停在第一步，而是会沿着因果链继续传导。这个镜头要说明中间过程如何把结果一步步推出来。`, "箭头路径和主体动作"],
        ["对比镜头", `通过变化前后或两种场景的对比，观众能更快看出差异。这个镜头要用对比帮助理解，而不是重复前一帧。`, "左右分屏对比"],
        ["误区纠偏", `很多误解来自只看表面结果，却忽略形成过程。先指出常见误区，再用一个清楚事实把它纠正过来。`, "误区与事实对照"],
        ["结尾模型", `最后把${topic}压缩成一个容易记住的判断模型。观众看完这一帧，应该能复述核心逻辑并迁移使用。`, "三节点总结模型"],
      ]
    : [
        ["Opening Tension", `${topic} begins with one strong visual contrast that makes the question obvious. Then name the mechanism the viewer should watch for.`, "high-contrast hook frame"],
        ["Visible Pattern", `The viewer first sees the most observable change and why it matters. Keep the explanation concrete, not just a concept label.`, "real-world close-up"],
        ["First Cause", `Identify the first variable that changes, because it sets the direction for the whole chain. This frame should make the starting point easy to remember.`, "single-variable action"],
        ["Mechanism Path", `Show how the change travels through a cause-effect chain. The narration should explain the middle step that connects the trigger to the result.`, "arrow path with main subject"],
        ["Contrast Beat", `Use a before-after or A/B comparison so the viewer can see the difference immediately. This frame should add contrast, not repeat the previous beat.`, "split-screen contrast"],
        ["Myth Correction", `State the common misconception first, then correct it with one clear fact. The viewer should leave with a cleaner mental model.`, "myth versus fact visual"],
        ["Final Model", `${topic} closes as one memorable judgment model. The viewer should be able to repeat the core logic and use it elsewhere.`, "three-node recap model"],
      ];
  const roles = direction === "video" ? videoRoles : pptRoles;
  return Array.from({ length: count }, (_, idx) => {
    const fallbackExtra = isZh
      ? [
          direction === "video" ? `补充镜头 ${idx - roles.length + 1}` : `${topic}延展页 ${idx - roles.length + 1}`,
          `${topic}补充一个新的观察角度，避免重复前文结论。`,
          "单一重点的信息图模块，围绕新视角给出一个明确主体、一个动作和一个结果。",
        ]
      : [
          direction === "video" ? `Extension Frame ${idx - roles.length + 1}` : `${topic}: extension ${idx - roles.length + 1}`,
          `Add one new perspective on ${topic} without repeating earlier conclusions.`,
          "single-focus infographic module with one subject, one action, and one outcome",
        ];
    const [title, core, visual] = roles[idx] || fallbackExtra;
    return {
      title,
      mainPoint: core,
      body: direction === "ppt" ? [core, isZh ? "本页只保留一个解释重点，配一个主视觉帮助理解。" : "Keep one explanation point with one dominant supporting visual."].join("\n") : core,
      narration: core,
      visual,
      imagePrompt:
        direction === "video"
          ? `Educational explainer still frame for ${title}, ${visual}, no subtitles, no dense text.`
          : `Educational slide infographic for ${title}, ${visual}, concise hierarchy.`,
    };
  });
}

function normalizeOutlineItems(
  raw: unknown,
  count: number,
  topic: string,
  direction: "poster" | "ppt" | "video" = "poster",
  outputLanguage: OutputLanguage = "zh",
) {
  const list = Array.isArray(raw)
    ? raw.map((item) => normalizeTextItem(item)).filter(Boolean)
    : [];
  if (direction === "ppt" || direction === "video") {
    const fallback = buildGenericMediaSeed(topic, count, direction, outputLanguage).map((item) => item.title);
    const badCount = list.filter((item) => isTemplateInstructionText(item)).length;
    if (!list.length || badCount >= Math.max(1, Math.ceil(list.length / 2))) {
      return fallback;
    }
    return Array.from({ length: count }, (_, idx) => {
      const item = list[idx];
      if (!item || isTemplateInstructionText(item)) {
        return toConciseDraftTitle(fallback[idx] || `${topic} · ${idx + 1}`, topic, outputLanguage);
      }
      return toConciseDraftTitle(item, topic, outputLanguage) || item;
    });
  }
  if (list.length >= count) {
    return list.slice(0, count);
  }
  const filled = [...list];
  for (let i = list.length; i < count; i += 1) {
    filled.push(`${topic} · Section ${i + 1}`);
  }
  return filled;
}

function normalizeSlideDrafts(
  raw: unknown,
  outlineItems: string[],
  count: number,
  topic = "Knowledge Topic",
  outputLanguage: OutputLanguage = "zh",
) {
  const fallbackSlides = buildGenericMediaSeed(topic, count, "ppt", outputLanguage);
  const list = Array.isArray(raw) ? raw : [];
  const drafts = list
    .map((item, idx) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const row = item as PptSlideDraft;
      const fallback = fallbackSlides[idx] || fallbackSlides[fallbackSlides.length - 1];
      const rawTitle = normalizeTextItem(row.title) || outlineItems[idx] || fallback?.title || `Slide ${idx + 1}`;
      const titleCandidate = isTemplateInstructionText(rawTitle) ? fallback?.title || rawTitle : rawTitle;
      const title = toConciseDraftTitle(titleCandidate, topic, outputLanguage) || titleCandidate;
      const mainPoint = normalizeTextItem(row.mainPoint);
      const body = normalizeTextItem(row.body);
      const support = normalizeTextItem(row.supportNote);
      const visual = normalizeTextItem(row.visual);
      const imagePromptDraft = normalizeTextItem(row.imagePromptDraft || row.imagePrompt);
      const isCover = row.isCover === true;
      const bodyLines = isCover ? [body || mainPoint].filter(Boolean) : [mainPoint, body, support].filter(Boolean);
      const safeBody = !bodyLines.length || bodyLines.some((line) => isTemplateInstructionText(line))
        ? isCover
          ? ""
          : fallback?.body || fallback?.mainPoint || ""
        : bodyLines.join("\n");
      return {
        page: Number.isFinite(row.page) ? Number(row.page) : idx + 1,
        title,
        body: safeBody,
        visual: visual && !isTemplateInstructionText(visual) ? visual : fallback?.visual || "",
        imagePromptDraft: imagePromptDraft || fallback?.imagePrompt || "",
        imagePrompt: imagePromptDraft || fallback?.imagePrompt || "",
        isCover,
      };
    })
    .filter((item): item is { page: number; title: string; body: string; visual: string; imagePromptDraft: string; imagePrompt: string; isCover: boolean } => Boolean(item));

  if (drafts.length >= count) {
    return drafts.slice(0, count);
  }
  return outlineItems.slice(0, count).map((title, idx) => {
    const existing = drafts[idx];
    if (existing) {
      return existing;
    }
    return {
      page: idx + 1,
      title: toConciseDraftTitle(title || fallbackSlides[idx]?.title || `Slide ${idx + 1}`, topic, outputLanguage)
        || title || fallbackSlides[idx]?.title || `Slide ${idx + 1}`,
      body: fallbackSlides[idx]?.body || "",
      visual: fallbackSlides[idx]?.visual || "",
      imagePromptDraft: fallbackSlides[idx]?.imagePrompt || "",
      imagePrompt: fallbackSlides[idx]?.imagePrompt || "",
      isCover: false,
    };
  });
}

function normalizeStoryboardDrafts(
  raw: unknown,
  outlineItems: string[],
  count: number,
  topic = "Knowledge Topic",
  outputLanguage: OutputLanguage = "zh",
) {
  const fallbackFrames = buildGenericMediaSeed(topic, count, "video", outputLanguage);
  const list = Array.isArray(raw) ? raw : [];
  const drafts = list
    .map((item, idx) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const row = item as VideoStoryboardDraft;
      const fallback = fallbackFrames[idx] || fallbackFrames[fallbackFrames.length - 1];
      const rawTitle = normalizeTextItem(row.title) || outlineItems[idx] || fallback?.title || `Frame ${idx + 1}`;
      const titleCandidate = isTemplateInstructionText(rawTitle) ? fallback?.title || rawTitle : rawTitle;
      const title = toConciseDraftTitle(titleCandidate, topic, outputLanguage) || titleCandidate;
      const narration = normalizeTextItem(row.narration);
      const visual = normalizeTextItem(row.visual);
      const imagePromptDraft = normalizeTextItem(row.imagePromptDraft || row.imagePrompt);
      const isCover = row.isCover === true;
      const safeNarration = isCover
        ? ""
        : narration && !isTemplateInstructionText(narration)
        ? narration
        : fallback?.narration || fallback?.mainPoint || "";
      return {
        index: Number.isFinite(row.index) ? Number(row.index) : idx + 1,
        title,
        narration: safeNarration,
        visual: visual && !isTemplateInstructionText(visual) ? visual : fallback?.visual || "",
        imagePromptDraft: imagePromptDraft || fallback?.imagePrompt || "",
        imagePrompt: imagePromptDraft || fallback?.imagePrompt || "",
        isCover,
      };
    })
    .filter((item): item is { index: number; title: string; narration: string; visual: string; imagePromptDraft: string; imagePrompt: string; isCover: boolean } => Boolean(item));

  if (drafts.length >= count) {
    return drafts.slice(0, count);
  }
  return outlineItems.slice(0, count).map((title, idx) => {
    const existing = drafts[idx];
    if (existing) {
      return existing;
    }
    return {
      index: idx + 1,
      title: toConciseDraftTitle(title || fallbackFrames[idx]?.title || `Frame ${idx + 1}`, topic, outputLanguage)
        || title || fallbackFrames[idx]?.title || `Frame ${idx + 1}`,
      narration: fallbackFrames[idx]?.narration || "",
      visual: fallbackFrames[idx]?.visual || "",
      imagePromptDraft: fallbackFrames[idx]?.imagePrompt || "",
      imagePrompt: fallbackFrames[idx]?.imagePrompt || "",
      isCover: false,
    };
  });
}

function enforcePosterSpecificity(draft: PosterDraft, topic: string): PosterDraft {
  return enforcePosterSpecificityByLanguage(draft, topic, "zh");
}

function enforcePosterSpecificityByLanguage(
  draft: PosterDraft,
  topic: string,
  outputLanguage: OutputLanguage,
): PosterDraft {
  if (!isChineseLanguage(outputLanguage)) {
    return draft;
  }
  const genericPointPatterns = [/关键变量/, /变化结果/, /行动建议/, /机制链路/, /补充指标/, /可执行/];
  const hasGenericPoint = draft.points.some((point) => genericPointPatterns.some((rule) => rule.test(point)));
  if (!hasGenericPoint) {
    return draft;
  }

  if (/通货膨胀/.test(topic)) {
    return {
      ...draft,
      headline: "通货膨胀为什么会影响日常生活？",
      subtitle: "同样的钱，为什么越花越不经用",
      body: "通货膨胀会直接改变你的日常开销。比如去年 20 元能买到一份午餐，今年可能需要 24 元；同样预算下，买到的东西更少，这就是购买力下降。",
      points: [
        "菜价、外卖、交通费用上涨最先被感知。",
        "工资增速跟不上物价时，家庭可支配收入会被压缩。",
        "存款利率低于通胀率时，钱的实际价值会被慢慢稀释。",
        "家庭预算会向刚需倾斜，非必要消费被延后。",
      ],
      visualType: "因果流图",
      layoutSuggestion: "左侧价格变化示例 + 中部四节点因果链 + 右侧家庭预算变化",
      visualElements: ["20元→24元价格标签", "工资与物价对比线", "储蓄购买力下降", "刚需占比上升饼图"],
    };
  }

  return {
    ...draft,
    points: draft.points.map((item) => item.replace(/关键变量|变化结果|行动建议/g, topic)),
  };
}

function buildPosterRenderSpec(params: {
  topic: string;
  sizeLabel?: string;
  draft: PosterDraft;
  outputLanguage: OutputLanguage;
}): PosterRenderSpec {
  const { topic, sizeLabel, draft, outputLanguage } = params;
  const chainItems =
    draft.points.length >= 4
      ? draft.points.slice(0, 4).map((item) => cleanSentence(item))
      : [
          `${topic}先体现在高频消费价格变化`,
          "工资与物价增速差拉低可支配收入",
          "储蓄实际购买力持续下降",
          "家庭预算向刚需倾斜并压缩非必要消费",
        ];

  return {
    version: "v1",
    language: getLanguageTag(outputLanguage),
    layoutTemplate: "three-column-causal-infographic",
    ratio: sizeLabel || "9:16",
    title: draft.headline,
    subtitle: draft.subtitle,
    topic,
    visualType: draft.visualType || "因果流图",
    sections: {
      leftPanel: {
        title: "价格变化示例",
        objective: "用 2-4 个日常高频项目建立通胀感知",
        exampleItems: [
          "午餐价格：去年 20 元 → 今年 24 元",
          "蔬菜价格：去年 3.5 元 → 今年 4.6 元",
          "外卖咖啡：去年 16 元 → 今年 20 元",
          "地铁单程：去年 2 元 → 今年 2.5 元",
        ],
        emphasis: "同样预算下可购买数量下降，购买力下滑。",
      },
      middlePanel: {
        title: draft.layoutSuggestion || "通胀影响链路（四步因果）",
        causalSteps: chainItems,
        visualAnchors: draft.visualElements?.length
          ? draft.visualElements
          : ["价格标签对比", "工资/物价双线", "利率与通胀对比", "预算结构变化"],
      },
      rightPanel: {
        title: "家庭预算变化",
        beforeState: ["住房 30%", "食品 20%", "交通 15%", "其他 35%"],
        afterState: ["住房 32%", "食品 25%", "交通 18%", "其他 25%"],
        conclusion: "刚需占比上升，非必要消费占比下降。",
      },
      bottomSummary: {
        chain: ["物价上涨", "收入跟不上", "储蓄贬值", "预算收紧"],
        finalTakeaway: draft.cta || "通胀不止是数字变化，它会改变你的生活选择。",
      },
    },
    renderingConstraints: {
      maxTextLinesPerBlock: 3,
      avoidLongParagraph: true,
      emphasizeNumbers: true,
      iconStyle: "flat-illustration",
      chartStyle: "simple-high-contrast",
    },
  };
}

function buildInternalModelPrompt(spec: PosterRenderSpec) {
  return [
    "You are generating one knowledge infographic poster.",
    `Topic: ${spec.topic}`,
    `Title: ${spec.title}`,
    `Subtitle: ${spec.subtitle}`,
    `Layout: ${spec.layoutTemplate}`,
    `Visual type: ${spec.visualType}`,
    `Aspect ratio: ${spec.ratio}`,
    "Panel rules:",
    `1) Left panel = ${spec.sections.leftPanel.title}; show concrete price changes with arrows and numeric deltas.`,
    `2) Middle panel = ${spec.sections.middlePanel.title}; render 4-step causal chain with downward flow arrows.`,
    `3) Right panel = ${spec.sections.rightPanel.title}; show before/after budget composition using pie charts.`,
    `4) Bottom summary chain = ${spec.sections.bottomSummary.chain.join(" -> ")}.`,
    "Constraints: high legibility, strong hierarchy, concise Chinese labels, no decorative clutter, no extra narrative blocks.",
    "Use flat illustration icons and simple high-contrast charts.",
  ].join("\n");
}

function hasAbstractPosterDraft(posterDraft: PosterDraft) {
  const body = posterDraft.body.replace(/\s+/g, "");
  const abstractBody =
    /问题引入|机制解释|关键结论|写作结构|用一句话|拆解原理|建议补充|展开|可感知场景|先给一个可观察现象/.test(
      body,
    );
  const templateBody =
    /围绕|先.*再.*最后|便于|用于|建议|可执行结论|可观察现象|直接绘制|图文内容|结构化/.test(body);
  const abstractPoint = posterDraft.points.some((point) =>
    /用一句话|解释背后|拆解|给出|建议补充|写作|结构|关键原因\d|供给端变化|需求端变化|外部冲击|现象：|原因：|结论：|提示：|补充指标/.test(
      point.replace(/\s+/g, ""),
    ),
  );
  return abstractBody || templateBody || abstractPoint;
}

function isDataSummaryPlanMismatch(planList: PosterPlanItem[]) {
  const joined = planList
    .map((item) => `${item.title} ${item.focus} ${(item.keyFacts ?? []).join(" ")} ${item.visualType ?? ""}`)
    .join(" ")
    .replace(/\s+/g, "");
  if (!joined) {
    return true;
  }
  const genericMechanism =
    /先明确|必要条件|放大因素|3-4步|机制链路|可观测指标|判断机制是否|触发条件—机制传导—结果呈现|因果流图|现象—机制—验证/.test(
      joined,
    );
  const hasSuppliedDataShape = /营收|净利润|收入|利润|EPS|同比|环比|增长|美元|亿元|%|Q[1-4]|季度|全年|Cloud|广告/.test(joined);
  return genericMechanism || !hasSuppliedDataShape;
}

function getRequestScope(req: NextRequest, email: string) {
  const forwardedFor = req.headers.get("x-forwarded-for") ?? "";
  const ip = forwardedFor.split(",")[0]?.trim() || "unknown";
  return email ? `user:${email}` : `ip:${ip}`;
}

function ensureSafeOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) {
    return true;
  }
  return origin === req.nextUrl.origin;
}

function parseIntEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const value = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
}

export async function POST(request: NextRequest) {
  try {
    if (!ensureSafeOrigin(request)) {
      return NextResponse.json({ error: "Forbidden request origin." }, { status: 403 });
    }

    const session = await getServerSession(nextAuthOptions);
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) {
      logOpsEvent({
        category: "llm",
        action: "draft_generation_failed",
        status: "error",
        source: "unknown",
        code: "DRAFT_AUTH_REQUIRED",
        message: "Draft generation requested without sign-in session.",
      });
      return NextResponse.json({ error: "Please sign in before generating draft content." }, { status: 401 });
    }

    const scopeKey = getRequestScope(request, email);
    await rateLimitOrThrow({
      scopeKey: `poster-draft:${scopeKey}`,
      endpoint: "content-poster-draft",
      limit: RATE_LIMIT_CONFIG.contentPosterDraft.limit,
      windowMs: RATE_LIMIT_CONFIG.contentPosterDraft.windowMs,
    });

    const dailyChatOnlyLimit = parseIntEnv("ABUSE_GUARD_DAILY_CHAT_ONLY_LIMIT", 120);
    const todayDraftCount = (await incrementAndCheckUsageLimit({
      scopeKey,
      metricKey: "workspace:draft_request",
      limit: Math.max(dailyChatOnlyLimit, 10_000),
    })).current;
    const todayGenerationCount = await getUsageCounter({
      scopeKey,
      metricKey: "workspace:generation_confirmed",
    });
    const unconvertedRequests = Math.max(0, todayDraftCount - todayGenerationCount);
    if (unconvertedRequests > dailyChatOnlyLimit) {
      return NextResponse.json(
        {
          error:
            "Daily draft attempts exceeded before generation confirmation. Please complete generation or retry tomorrow.",
        },
        { status: 429 },
      );
    }

    const payload = (await request.json()) as PosterDraftRequest;
    const prompt = (payload.prompt ?? "").trim();
    const rawTopic = (payload.topic ?? "").trim();
    const textModel = (payload.textModel ?? "").trim().toLowerCase();
    const normalized = normalizeDraftConfig(payload);
    const direction = normalized.normalizedDirection;
    const outputCount = normalized.normalizedCount;
    const posterSizeLabel = normalized.normalizedRatio;
    const outputLanguage = resolveOutputLanguage({
      userPrompt: prompt,
      sourceText: rawTopic || prompt,
      fallback: payload.outputLanguage ?? "en",
    });
    const topic = normalizeDraftTopic(rawTopic || prompt || "Knowledge Topic", outputLanguage);
    const dataSummaryMode = isDataSummaryInput(rawTopic || topic, prompt);
    const preserveHighFidelityDraft =
      outputCount === 1 && isDenseSourceInput(prompt) && (dataSummaryMode || prompt.length >= 520);
    const draftMode =
      payload.draftMode ?? (process.env.KNOWLENS_DRAFT_MODE === "mock" ? "mock" : "auto");

    if (draftMode === "mock" && direction === "poster") {
      const mock = buildMockDraftPayload({
        direction,
        topic,
        count: outputCount,
      });
      return NextResponse.json({
        ...mock,
        outputLanguage,
        source: "mock",
        providerPath: "fallback" as DraftProviderPath,
      });
    }

    const fallbackDraft = dataSummaryMode
      ? buildDataSummaryPosterDraft(topic, posterSizeLabel, prompt, outputLanguage)
      : buildFallbackPosterDraft(topic, posterSizeLabel, prompt, outputLanguage);
    const fallbackPlan = dataSummaryMode
      ? buildDataSummaryPlanListByLanguage(topic, outputCount, prompt, outputLanguage)
      : buildFallbackPlanListByLanguage(topic, outputCount, outputLanguage);
    const promptBundle = buildContentDraftPrompt({
      direction,
      topic,
      userPrompt: prompt,
      count: outputCount,
      ratioOrSize: posterSizeLabel,
      outputLanguage,
    });

    let content = "";
    let llmUsage: DraftLlmUsage | null = null;
    let providerPath: DraftProviderPath = "fallback";
    const modelForLog = textModel || "paid-default";
    if (isFreeTextModel(textModel)) {
      const freeResult = await requestDraftFromGptsApi({ textModel, promptBundle });
      if (freeResult.ok) {
        content = freeResult.text;
        llmUsage = freeResult.usage ?? null;
        providerPath = "gptsapi";
      } else {
        const compatResult = hasOpenAICompatDraftProvider()
          ? await requestDraftFromPaidModels({ textModel, promptBundle })
          : null;
        if (compatResult?.ok) {
          content = compatResult.text;
          llmUsage = compatResult.usage ?? null;
          providerPath = "openai-compat";
        } else {
          if (compatResult && !compatResult.ok) {
            logOpsEvent({
              category: "llm",
              action: "draft_generation_failed",
              status: "error",
              source: modelForLog,
              userEmail: email,
              code: "OPENAI_COMPAT_MODEL_REQUEST_FAILED",
              message: compatResult.error,
              details: { stage: "draft_model_request_openai_compat", direction, outputCount },
            });
          }
          logOpsEvent({
            category: "llm",
            action: "draft_generation_failed",
            status: "error",
            source: modelForLog,
            userEmail: email,
            code: "FREE_MODEL_REQUEST_FAILED",
            message: freeResult.error,
            details: { stage: "draft_model_request_free", direction, outputCount },
          });
          if (direction === "poster") {
            return NextResponse.json(
              {
                posterDraft: fallbackDraft,
                planList: fallbackPlan,
                source: "fallback",
                providerPath: "fallback" as DraftProviderPath,
                error: freeResult.error,
              },
              { status: 200 },
            );
          }
          return NextResponse.json(
            { error: freeResult.error, providerPath: "fallback" as DraftProviderPath },
            { status: 502 },
          );
        }
      }
    } else {
      const paidResult = await requestDraftFromPaidModels({ textModel, promptBundle });
      if (!paidResult.ok) {
        logOpsEvent({
          category: "llm",
          action: "draft_generation_failed",
          status: "error",
          source: modelForLog,
          userEmail: email,
          code: "PAID_MODEL_REQUEST_FAILED",
          message: paidResult.error,
          details: { stage: "draft_model_request_paid", direction, outputCount },
        });
        if (direction === "poster") {
          return NextResponse.json(
            {
              posterDraft: fallbackDraft,
              planList: fallbackPlan,
              source: "fallback",
              providerPath: "fallback" as DraftProviderPath,
              error: paidResult.error,
            },
            { status: 200 },
          );
        }
        return NextResponse.json(
          { error: paidResult.error, providerPath: "fallback" as DraftProviderPath },
          { status: 502 },
        );
      }
      content = paidResult.text;
      llmUsage = paidResult.usage ?? null;
      providerPath = "openai-compat";
    }

    if (!content) {
      logOpsEvent({
        category: "llm",
        action: "draft_generation_failed",
        status: "error",
        source: modelForLog,
        userEmail: email,
        code: "DRAFT_EMPTY_RESPONSE",
        message: "Model response is empty.",
        details: { stage: "draft_response_empty", direction, outputCount },
      });
      if (direction === "poster") {
        return NextResponse.json(
          {
            posterDraft: fallbackDraft,
            planList: fallbackPlan,
            source: "fallback",
            providerPath: "fallback" as DraftProviderPath,
            error: "Model response is empty.",
          },
          { status: 200 },
        );
      }
      return NextResponse.json(
        { error: "Model response is empty.", providerPath: "fallback" as DraftProviderPath },
        { status: 502 },
      );
    }
    const parsed = parseJsonContent(content);

    if (!parsed) {
      logOpsEvent({
        category: "llm",
        action: "draft_generation_failed",
        status: "error",
        source: modelForLog,
        userEmail: email,
        code: "DRAFT_INVALID_JSON",
        message: "Model response is not valid JSON.",
        details: {
          stage: "draft_response_parsing",
          direction,
          outputCount,
          rawSnippet: content.slice(0, 1200),
        },
      });
      if (direction !== "poster") {
        return NextResponse.json(
          { error: "Model response is not valid JSON.", providerPath: "fallback" as DraftProviderPath },
          { status: 502 },
        );
      }
      return NextResponse.json({
        posterDraft: fallbackDraft,
        planList: fallbackPlan,
        outputLanguage,
        source: "fallback",
        providerPath: "fallback" as DraftProviderPath,
      });
    }

    if (direction !== "poster") {
      logOpsEvent({
        category: "llm",
        action: "draft_generation_success",
        status: "ok",
        source: modelForLog,
        userEmail: email,
        details: { direction, outputCount, providerPath },
      });
      const outlineItems = normalizeOutlineItems(parsed.outlineItems, outputCount, topic, direction, outputLanguage);
      if (direction === "ppt") {
        const slideDrafts = normalizeSlideDrafts(parsed.slideDrafts, outlineItems, outputCount, topic, outputLanguage);
        return NextResponse.json({
          direction,
          normalizedDirection: direction,
          normalizedCount: outputCount,
          normalizedRatio: posterSizeLabel,
          outlineItems,
          slideDrafts,
          outputLanguage,
          source: "llm",
          providerPath,
          llmUsage:
            llmUsage ??
            buildEstimatedDraftLlmUsage({
              promptBundle,
              generatedText: content,
              model: modelForLog,
            }),
        });
      }
      const storyboardDrafts = normalizeStoryboardDrafts(parsed.storyboardDrafts, outlineItems, outputCount, topic, outputLanguage);
      return NextResponse.json({
        direction,
        normalizedDirection: direction,
        normalizedCount: outputCount,
        normalizedRatio: posterSizeLabel,
        outlineItems,
        storyboardDrafts,
        outputLanguage,
        source: "llm",
        providerPath,
        llmUsage:
          llmUsage ??
          buildEstimatedDraftLlmUsage({
            promptBundle,
            generatedText: content,
            model: modelForLog,
          }),
      });
    }

    const mergedPosterDraft = parsed.posterDraft ?? parsed.legacyCompat ?? parsed;
    const posterDraft: PosterDraft = {
      headline: mergedPosterDraft.headline?.trim() || fallbackDraft.headline,
      subtitle: mergedPosterDraft.subtitle?.trim() || fallbackDraft.subtitle,
      body: mergedPosterDraft.body?.trim() || fallbackDraft.body,
      points:
        Array.isArray(mergedPosterDraft.points) && mergedPosterDraft.points.length
          ? mergedPosterDraft.points.slice(0, preserveHighFidelityDraft ? 8 : 5).map((item) => item.trim()).filter(Boolean)
          : fallbackDraft.points,
      cta: mergedPosterDraft.cta?.trim() || fallbackDraft.cta,
      size: posterSizeLabel,
      visualType: mergedPosterDraft.visualType?.trim() || fallbackDraft.visualType,
      layoutSuggestion: mergedPosterDraft.layoutSuggestion?.trim() || fallbackDraft.layoutSuggestion,
      visualElements:
        Array.isArray(mergedPosterDraft.visualElements) && mergedPosterDraft.visualElements.length
          ? mergedPosterDraft.visualElements.slice(0, 6).map((item) => item.trim()).filter(Boolean)
          : fallbackDraft.visualElements,
    };

    if (hasAbstractPosterDraft(posterDraft)) {
      posterDraft.body = fallbackDraft.body;
      posterDraft.points = fallbackDraft.points;
    }

    const specificPosterDraft = enforcePosterSpecificityByLanguage(posterDraft, topic, outputLanguage);

    if (preserveHighFidelityDraft) {
      specificPosterDraft.body = normalizeWhitespace(
        simplifyTechnicalTerms(specificPosterDraft.body || fallbackDraft.body, outputLanguage),
      );
    } else {
      const compactBody = specificPosterDraft.body
        .split(/[。！？.!?]/)
        .map((part) => simplifyTechnicalTerms(part.trim(), outputLanguage))
        .filter(Boolean)
        .slice(0, 3)
        .join(isChineseLanguage(outputLanguage) ? "。" : ". ");
      specificPosterDraft.body = compactBody
        ? `${compactBody}${isChineseLanguage(outputLanguage) ? "。" : "."}`
        : fallbackDraft.body;
    }
    specificPosterDraft.points = (specificPosterDraft.points.length ? specificPosterDraft.points : fallbackDraft.points)
      .slice(0, preserveHighFidelityDraft ? 8 : 5)
      .map((point) => simplifyTechnicalTerms(point.trim(), outputLanguage))
      .filter(Boolean);
    if (dataSummaryMode && preserveHighFidelityDraft) {
      const sourceFacts = extractDataSummaryFacts(topic, prompt, outputLanguage);
      if (sourceFacts.length >= 4) {
        specificPosterDraft.points = dedupeLines([
          ...sourceFacts,
          ...specificPosterDraft.points,
        ]).slice(0, 10);
        specificPosterDraft.body = sourceFacts.slice(0, 5).join(isChineseLanguage(outputLanguage) ? "" : " ");
      }
    }
    if (!specificPosterDraft.visualType) {
      specificPosterDraft.visualType = fallbackDraft.visualType;
    }
    if (!specificPosterDraft.layoutSuggestion) {
      specificPosterDraft.layoutSuggestion = fallbackDraft.layoutSuggestion;
    }
    if (!specificPosterDraft.visualElements?.length) {
      specificPosterDraft.visualElements = fallbackDraft.visualElements;
    }

    const renderSpec = buildPosterRenderSpec({
      topic,
      sizeLabel: posterSizeLabel,
      draft: specificPosterDraft,
      outputLanguage,
    });
    const internalModelPrompt = buildInternalModelPrompt(renderSpec);

    const llmPlanList = Array.isArray(parsed.planList) && parsed.planList.length ? parsed.planList : null;
    const mappedPlanListRaw: PosterPlanItem[] = llmPlanList
      ? Array.from({ length: outputCount }, (_, idx) => {
          const item = llmPlanList[idx] ?? llmPlanList[llmPlanList.length - 1];
          const fallback = fallbackPlan[idx] ?? fallbackPlan[fallbackPlan.length - 1];
          const rawVisualElements = Array.isArray(item?.visualElements)
            ? item.visualElements.map((value) => String(value || "").trim()).filter(Boolean).slice(0, 6)
            : [];
          const rawKeyFacts = Array.isArray(item?.keyFacts)
            ? item.keyFacts.map((value) => String(value || "").trim()).filter(Boolean).slice(0, 5)
            : [];
          return {
            index: idx + 1,
            title: sanitizePlanTitle(item?.title?.trim() || fallback.title, topic, idx + 1, outputLanguage),
            focus: sanitizePlanFocus(
              simplifyTechnicalTerms(item?.focus?.trim() || "", outputLanguage),
              fallback.focus,
              topic,
              outputLanguage,
            ),
            role: item?.role?.trim() || (idx === 0 ? "cover" : idx === outputCount - 1 ? "system-model" : "mechanism"),
            keyFacts: sanitizePlanFactList(
              (rawKeyFacts.length ? rawKeyFacts : specificPosterDraft.points.slice(0, 3))
                .map((line) => simplifyTechnicalTerms(line, outputLanguage)),
              topic,
              outputLanguage,
            ),
            visualType:
              item?.visualType?.trim() ||
              specificPosterDraft.visualType ||
              fallbackDraft.visualType ||
              fallback.visualType,
            visualElements: sanitizePlanVisualElements(
              rawVisualElements.length
                ? rawVisualElements
                : specificPosterDraft.visualElements ?? fallbackDraft.visualElements,
              topic,
              outputLanguage,
            ),
            layoutHint:
              item?.layoutHint?.trim() ||
              specificPosterDraft.layoutSuggestion ||
              fallbackDraft.layoutSuggestion ||
              (isChineseLanguage(outputLanguage)
                ? "标题区 + 主图链路区 + 结论区"
                : "title area + main mechanism area + conclusion area"),
            imagePromptDraft: item?.imagePromptDraft?.trim() || item?.imagePrompt?.trim() || "",
            imagePrompt: item?.imagePromptDraft?.trim() || item?.imagePrompt?.trim() || "",
          };
        })
      : fallbackPlan.map((item, idx) => ({
          ...item,
          role: idx === 0 ? "cover" : idx === outputCount - 1 ? "system-model" : "mechanism",
          keyFacts: sanitizePlanFactList(
            specificPosterDraft.points.slice(0, 3).map((line) => simplifyTechnicalTerms(line, outputLanguage)),
            topic,
            outputLanguage,
          ),
          visualType: specificPosterDraft.visualType || fallbackDraft.visualType,
          visualElements: sanitizePlanVisualElements(
            specificPosterDraft.visualElements ?? fallbackDraft.visualElements,
            topic,
            outputLanguage,
          ),
          layoutHint:
            specificPosterDraft.layoutSuggestion ||
            fallbackDraft.layoutSuggestion ||
            (isChineseLanguage(outputLanguage)
              ? "标题区 + 主图链路区 + 结论区"
              : "title area + main mechanism area + conclusion area"),
          imagePromptDraft: "",
          imagePrompt: "",
        }));

    const roleBlueprint = buildPosterRoleBlueprint(outputCount);
    const moduleBank = buildKnowledgeModulesFromDraft({
      topic,
      draft: specificPosterDraft,
      outputLanguage,
    });
    const roleModules = buildRoleModuleSequence({
      topic,
      modules: moduleBank,
      roles: roleBlueprint,
      outputLanguage,
    });
    const usedCoreMessages = new Set<string>();
    const mappedPlanList: PosterPlanItem[] = dataSummaryMode ? mappedPlanListRaw.map((item, idx) => {
      const fallback = fallbackPlan[idx] ?? fallbackPlan[fallbackPlan.length - 1];
      const maxDataFacts = outputCount === 1 && preserveHighFidelityDraft ? 10 : preserveHighFidelityDraft ? 8 : 5;
      const factBank = collectFactBankFromPosterDraft(specificPosterDraft, topic, outputLanguage);
      const singlePageFacts =
        outputCount === 1 && preserveHighFidelityDraft
          ? [...buildSinglePosterModuleFacts(topic, outputLanguage), ...factBank.slice(0, 6)]
          : null;
      const keyFacts = sanitizePlanFactList(
        singlePageFacts ?? (item.keyFacts?.length ? item.keyFacts : fallback?.keyFacts),
        topic,
        outputLanguage,
        maxDataFacts,
      );
      const normalizedFocus =
        outputCount === 1 && preserveHighFidelityDraft
          ? buildSinglePosterDataFocus(topic, outputLanguage)
          : sanitizePlanFocus(item.focus || "", fallback?.focus || specificPosterDraft.body, topic, outputLanguage);
      return {
        ...item,
        index: idx + 1,
        role: item.role || fallback?.role || (idx === 0 ? "data-summary" : "metrics"),
        title: sanitizePlanTitle(item.title || fallback?.title || topic, topic, idx + 1, outputLanguage),
        focus: normalizedFocus,
        keyFacts,
        visualType: item.visualType || fallback?.visualType || (isChineseLanguage(outputLanguage) ? "指标摘要图" : "metrics summary infographic"),
        visualElements: item.visualElements?.length
          ? item.visualElements
          : fallback?.visualElements ?? specificPosterDraft.visualElements ?? fallbackDraft.visualElements,
        layoutHint: item.layoutHint || fallback?.layoutHint || specificPosterDraft.layoutSuggestion,
      };
    }) : mappedPlanListRaw.map((item, idx) => {
      const role = roleBlueprint[idx] || (idx === 0 ? "cover" : idx === outputCount - 1 ? "system-model" : "mechanism");
      const moduleText = roleModules[idx] || buildRoleFunctionalModule({
        topic,
        role,
        pageIndex: idx + 1,
        outputLanguage,
      });
      const roleCore = buildRoleSpecificCoreMessage({
        role,
        moduleText,
        topic,
        pageIndex: idx + 1,
        outputLanguage,
      });
      const fallbackBundle = buildPageCoreBundle({
        topic,
        role,
        moduleText: roleCore,
        outputLanguage,
      });
      let coreMessage = simplifyTechnicalTerms(item.focus || "", outputLanguage).trim() || fallbackBundle.coreMessage;
      const compactKey = coreMessage.replace(/[，。,.!?！？;；:：\s]/g, "").toLowerCase();
      if (!compactKey || usedCoreMessages.has(compactKey)) {
        coreMessage = ensureSentenceEnding(roleCore, outputLanguage);
      }
      usedCoreMessages.add(coreMessage.replace(/[，。,.!?！？;；:：\s]/g, "").toLowerCase());
      const itemFact = simplifyTechnicalTerms((item.keyFacts?.[0] || "").trim(), outputLanguage);
      const roleStructuredFacts = [...fallbackBundle.keyFacts];
      if (itemFact) {
        // Keep fixed structure: coreMessage + mechanism + memoryHook.
        if (/^(?:memoryhook|记忆点)[:：]/i.test(roleStructuredFacts[2])) {
          roleStructuredFacts[2] = ensureSentenceEnding(
            isChineseLanguage(outputLanguage)
              ? `记忆点：${itemFact}`
              : `memoryHook: ${itemFact}`,
            outputLanguage,
          );
        } else {
          roleStructuredFacts[2] = ensureSentenceEnding(itemFact, outputLanguage);
        }
      }
      const keyFacts = sanitizePlanFactList(
        roleStructuredFacts.map((line) =>
          simplifyTechnicalTerms(line, outputLanguage),
        ),
        topic,
        outputLanguage,
      );
      return {
        ...item,
        index: idx + 1,
        role,
        title: sanitizePlanTitle(item.title || buildRoleTitle(topic, role, idx + 1, outputLanguage), topic, idx + 1, outputLanguage),
        focus: ensureSentenceEnding(coreMessage, outputLanguage),
        keyFacts,
        visualType: item.visualType || buildRoleVisualType(role, outputLanguage),
        layoutHint: item.layoutHint || buildRoleLayoutHint(role, outputLanguage),
      };
    });

    const shouldUseFallbackPlan =
      isPlanListLowQuality(mappedPlanList, outputLanguage) ||
      (dataSummaryMode && isDataSummaryPlanMismatch(mappedPlanList));
    const planList = shouldUseFallbackPlan
      ? dataSummaryMode
        ? buildDataSummaryPlanListByLanguage(topic, outputCount, prompt, outputLanguage)
        : buildFallbackPosterPlanFromDraft({
            topic,
            count: outputCount,
            posterDraft: specificPosterDraft,
            outputLanguage,
            baseVisualType: specificPosterDraft.visualType || fallbackDraft.visualType,
          })
      : mappedPlanList;

    void renderSpec;
    void internalModelPrompt;

    logOpsEvent({
      category: "llm",
      action: "draft_generation_success",
      status: "ok",
      source: modelForLog,
      userEmail: email,
      details: { direction, outputCount, providerPath },
    });

    return NextResponse.json({
      direction,
      normalizedDirection: direction,
      normalizedCount: outputCount,
      normalizedRatio: posterSizeLabel,
      posterDraft: specificPosterDraft,
      planList,
      outputLanguage,
      source: "llm",
      providerPath,
      llmUsage:
        llmUsage ??
        buildEstimatedDraftLlmUsage({
          promptBundle,
          generatedText: content,
          model: modelForLog,
        }),
    });
  } catch (error) {
    const retryAfter = (error as Error & { retryAfterSeconds?: number }).retryAfterSeconds;
    if (retryAfter) {
      logOpsEvent({
        category: "llm",
        action: "draft_generation_failed",
        status: "error",
        source: "unknown",
        code: "DRAFT_RATE_LIMIT",
        message: "Too many draft requests.",
      });
      return NextResponse.json(
        { error: "Too many draft requests. Please retry later.", providerPath: "fallback" as DraftProviderPath },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    logOpsEvent({
      category: "llm",
      action: "draft_generation_failed",
      status: "error",
      source: "unknown",
      code: "DRAFT_INTERNAL",
      message,
    });
    return NextResponse.json({ error: message, providerPath: "fallback" as DraftProviderPath }, { status: 500 });
  }
}
