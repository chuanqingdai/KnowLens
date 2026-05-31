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

function isFreeTextModel(textModel?: string) {
  if (!textModel) {
    return false;
  }
  return FREE_MODEL_IDS.has(textModel);
}

function resolvePaidModel(textModel?: string) {
  const normalized = (textModel || "").trim().toLowerCase();
  if (normalized && PAID_MODEL_IDS.has(normalized)) {
    return PAID_MODEL_MAP[normalized] || normalized;
  }
  return process.env.PAID_TEXT_MODEL_DEFAULT || process.env.OPENAI_TEXT_MODEL || "gpt-5.4";
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
  return process.env.PAID_LLM_API_KEY || process.env.OPENAI_API_KEY || "";
}

function getPaidChatCompletionsUrl() {
  return (
    process.env.PAID_LLM_CHAT_COMPLETIONS_URL ||
    process.env.OPENAI_COMPAT_CHAT_COMPLETIONS_URL ||
    "https://api.openai.com/v1/chat/completions"
  );
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

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${input.promptBundle.systemPrompt}\n\n${input.promptBundle.userPrompt}`,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  };

  const response = await fetch(
    `https://api.gptsapi.net/v1beta/models/${encodeURIComponent(providerModel)}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    return {
      ok: false as const,
      error: `Model request failed (${response.status}): ${errText.slice(0, 220)}`,
    };
  }

  const data = (await response.json()) as GptsApiGenerateResponse;
  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text?.trim() ?? "")
      .filter(Boolean)
      .join("\n") ?? "";
  if (!text) {
    return { ok: false as const, error: "Empty model response." };
  }

  const usage = normalizeDraftLlmUsage({
    inputTokens: data.usageMetadata?.promptTokenCount,
    outputTokens: data.usageMetadata?.candidatesTokenCount,
    totalTokens: data.usageMetadata?.totalTokenCount,
    model: data.modelVersion ?? providerModel,
    source: "provider",
  });

  return { ok: true as const, text, modelVersion: data.modelVersion ?? providerModel, usage };
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
  const response = await fetch(endpoint, {
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
  });

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
      formatSectionLine(
        "mechanism",
        isChineseLanguage(outputLanguage)
          ? "围绕当前标题补充关键变量的变化路径。"
          : "add the key-variable pathway for this page title only.",
      ),
      outputLanguage,
    ),
    ensureSentenceEnding(
      formatSectionLine(
        "memory",
        isChineseLanguage(outputLanguage)
          ? "给出一个对比、例子或判断口诀。"
          : "add one contrast, example, or recall cue.",
      ),
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
  return value.replace(/^[\s\-*•·\d]+[.)、\s-]*/, "").trim();
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
    return cleaned;
  }
  if (isChineseLanguage(outputLanguage)) {
    return index === 1 ? `${topic}：整体框架` : `${topic}：第${index}部分`;
  }
  return index === 1 ? `${topic}: Overview` : `${topic}: Part ${index}`;
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
) {
  const normalized = dedupeLines(
    (values || [])
      .map((value) =>
        normalizeWhitespace(stripPromptCommandPrefix(removeStagePrefix(stripListPrefix(value), outputLanguage), outputLanguage)),
      )
      .filter((value) => value && !isMetaInstructionLine(value, outputLanguage)),
  );
  if (normalized.length) {
    return normalized.slice(0, 5).map((value) => ensureSentenceEnding(value, outputLanguage));
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

function normalizeOutlineItems(raw: unknown, count: number, topic: string) {
  const list = Array.isArray(raw)
    ? raw.map((item) => normalizeTextItem(item)).filter(Boolean)
    : [];
  if (list.length >= count) {
    return list.slice(0, count);
  }
  const filled = [...list];
  for (let i = list.length; i < count; i += 1) {
    filled.push(`${topic} · Section ${i + 1}`);
  }
  return filled;
}

function normalizeSlideDrafts(raw: unknown, outlineItems: string[], count: number) {
  const list = Array.isArray(raw) ? raw : [];
  const drafts = list
    .map((item, idx) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const row = item as PptSlideDraft;
      const title = normalizeTextItem(row.title) || outlineItems[idx] || `Slide ${idx + 1}`;
      const body = normalizeTextItem(row.body);
      const support = normalizeTextItem(row.supportNote);
      const visual = normalizeTextItem(row.visual);
      const imagePromptDraft = normalizeTextItem(row.imagePromptDraft || row.imagePrompt);
      return {
        page: Number.isFinite(row.page) ? Number(row.page) : idx + 1,
        title,
        body: [body, support].filter(Boolean).join("\n"),
        visual,
        imagePromptDraft,
        imagePrompt: imagePromptDraft,
      };
    })
    .filter((item): item is { page: number; title: string; body: string; visual: string; imagePromptDraft: string; imagePrompt: string } => Boolean(item));

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
      title,
      body: "",
      visual: "",
      imagePromptDraft: "",
      imagePrompt: "",
    };
  });
}

function normalizeStoryboardDrafts(raw: unknown, outlineItems: string[], count: number) {
  const list = Array.isArray(raw) ? raw : [];
  const drafts = list
    .map((item, idx) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const row = item as VideoStoryboardDraft;
      const title = normalizeTextItem(row.title) || outlineItems[idx] || `Frame ${idx + 1}`;
      const narration = normalizeTextItem(row.narration);
      const onScreenText = normalizeTextItem(row.onScreenText);
      const visual = normalizeTextItem(row.visual);
      const imagePromptDraft = normalizeTextItem(row.imagePromptDraft || row.imagePrompt);
      return {
        index: Number.isFinite(row.index) ? Number(row.index) : idx + 1,
        title,
        narration: [narration, onScreenText].filter(Boolean).join("\n"),
        visual,
        imagePromptDraft,
        imagePrompt: imagePromptDraft,
      };
    })
    .filter((item): item is { index: number; title: string; narration: string; visual: string; imagePromptDraft: string; imagePrompt: string } => Boolean(item));

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
      title,
      narration: "",
      visual: "",
      imagePromptDraft: "",
      imagePrompt: "",
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
    rateLimitOrThrow({
      scopeKey: `poster-draft:${scopeKey}`,
      endpoint: "content-poster-draft",
      limit: RATE_LIMIT_CONFIG.contentPosterDraft.limit,
      windowMs: RATE_LIMIT_CONFIG.contentPosterDraft.windowMs,
    });

    const dailyChatOnlyLimit = parseIntEnv("ABUSE_GUARD_DAILY_CHAT_ONLY_LIMIT", 120);
    const todayDraftCount = incrementAndCheckUsageLimit({
      scopeKey,
      metricKey: "workspace:draft_request",
      limit: Math.max(dailyChatOnlyLimit, 10_000),
    }).current;
    const todayGenerationCount = getUsageCounter({
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
      });
    }

    const fallbackDraft = buildFallbackPosterDraft(topic, posterSizeLabel, prompt, outputLanguage);
    const fallbackPlan = buildFallbackPlanListByLanguage(topic, outputCount, outputLanguage);
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
    const modelForLog = textModel || "paid-default";
    if (isFreeTextModel(textModel)) {
      const freeResult = await requestDraftFromGptsApi({ textModel, promptBundle });
      if (!freeResult.ok) {
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
              error: freeResult.error,
            },
            { status: 200 },
          );
        }
        return NextResponse.json({ error: freeResult.error }, { status: 502 });
      }
      content = freeResult.text;
      llmUsage = freeResult.usage ?? null;
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
              error: paidResult.error,
            },
            { status: 200 },
          );
        }
        return NextResponse.json({ error: paidResult.error }, { status: 502 });
      }
      content = paidResult.text;
      llmUsage = paidResult.usage ?? null;
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
            error: "Model response is empty.",
          },
          { status: 200 },
        );
      }
      return NextResponse.json({ error: "Model response is empty." }, { status: 502 });
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
        return NextResponse.json({ error: "Model response is not valid JSON." }, { status: 502 });
      }
      return NextResponse.json({
        posterDraft: fallbackDraft,
        planList: fallbackPlan,
        outputLanguage,
        source: "fallback",
      });
    }

    if (direction !== "poster") {
      logOpsEvent({
        category: "llm",
        action: "draft_generation_success",
        status: "ok",
        source: modelForLog,
        userEmail: email,
        details: { direction, outputCount },
      });
      const outlineItems = normalizeOutlineItems(parsed.outlineItems, outputCount, topic);
      if (direction === "ppt") {
        const slideDrafts = normalizeSlideDrafts(parsed.slideDrafts, outlineItems, outputCount);
        return NextResponse.json({
          direction,
          normalizedDirection: direction,
          normalizedCount: outputCount,
          normalizedRatio: posterSizeLabel,
          outlineItems,
          slideDrafts,
          outputLanguage,
          source: "llm",
          llmUsage:
            llmUsage ??
            buildEstimatedDraftLlmUsage({
              promptBundle,
              generatedText: content,
              model: modelForLog,
            }),
        });
      }
      const storyboardDrafts = normalizeStoryboardDrafts(parsed.storyboardDrafts, outlineItems, outputCount);
      return NextResponse.json({
        direction,
        normalizedDirection: direction,
        normalizedCount: outputCount,
        normalizedRatio: posterSizeLabel,
        outlineItems,
        storyboardDrafts,
        outputLanguage,
        source: "llm",
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
          ? mergedPosterDraft.points.slice(0, 5).map((item) => item.trim()).filter(Boolean)
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

    const compactBody = specificPosterDraft.body
      .split(/[。！？.!?]/)
      .map((part) => simplifyTechnicalTerms(part.trim(), outputLanguage))
      .filter(Boolean)
      .slice(0, 3)
      .join(isChineseLanguage(outputLanguage) ? "。" : ". ");
    specificPosterDraft.body = compactBody
      ? `${compactBody}${isChineseLanguage(outputLanguage) ? "。" : "."}`
      : fallbackDraft.body;
    specificPosterDraft.points = (specificPosterDraft.points.length ? specificPosterDraft.points : fallbackDraft.points)
      .slice(0, 5)
      .map((point) => simplifyTechnicalTerms(point.trim(), outputLanguage))
      .filter(Boolean);
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
    const mappedPlanList: PosterPlanItem[] = mappedPlanListRaw.map((item, idx) => {
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

    const planList = isPlanListLowQuality(mappedPlanList, outputLanguage)
      ? buildFallbackPosterPlanFromDraft({
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
      details: { direction, outputCount },
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
        { error: "Too many draft requests. Please retry later." },
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
