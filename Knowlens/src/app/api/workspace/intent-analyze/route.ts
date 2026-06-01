import { NextRequest, NextResponse } from "next/server";
import { buildWorkspaceIntentPrompt } from "@/lib/prompts/workspace-intent";

export const runtime = "nodejs";

type AnalyzeDirection = "poster" | "ppt" | "video" | "unknown";
type AnalyzeClassification = "invalid" | "need_topic_clarification" | "needs_fresh_sources" | "ready";
type ClarifyMode = "none" | "topic" | "fresh_sources";

type IntentAnalysis = {
  classification: AnalyzeClassification;
  direction: AnalyzeDirection;
  confidence: number;
  topic: string;
  reason: string;
  clarifyMode: ClarifyMode;
  needsFreshSources: boolean;
  suggestions: string[];
  assistantHint: string;
};

type RequestBody = {
  input?: string;
  outputLanguage?: string;
  sources?: Array<{
    kind?: "file" | "web" | "youtube" | "podcast";
    name?: string;
    origin?: string;
    excerpt?: string;
  }>;
};

const DEFAULT_MODEL = process.env.GPTSAPI_INTENT_ANALYZE_MODEL || process.env.GPTSAPI_INTENT_TRIAGE_MODEL || "gemini-2.5-flash";
const DEFAULT_ENDPOINT = process.env.GPTSAPI_INTENT_ANALYZE_ENDPOINT || process.env.GPTSAPI_INTENT_TRIAGE_ENDPOINT || "https://api.gptsapi.net/v1beta/models";
const DEFAULT_KEY =
  process.env.GPTSAPI_GEMINI_API_KEY ||
  process.env.GPTSAPI_FREE_API_KEY ||
  process.env.GPTSAPI_API_KEY ||
  "";
const OPENAI_COMPAT_KEY =
  process.env.PAID_LLM_API_KEY ||
  process.env.OPENAI_API_KEY ||
  process.env.IMAGE2_TUZI_PROVIDER_API_KEY ||
  "";
const OPENAI_COMPAT_ENDPOINT =
  process.env.PAID_LLM_CHAT_COMPLETIONS_URL ||
  process.env.OPENAI_COMPAT_CHAT_COMPLETIONS_URL ||
  (process.env.IMAGE2_TUZI_PROVIDER_API_KEY &&
  (process.env.IMAGE2_TUZI_PROVIDER_ENDPOINT || "").startsWith("https://api.tu-zi.com/")
    ? "https://api.tu-zi.com/v1/chat/completions"
    : "");
const OPENAI_COMPAT_MODEL =
  process.env.PAID_TEXT_MODEL_DEFAULT ||
  process.env.OPENAI_TEXT_MODEL ||
  process.env.GPTSAPI_INTENT_ANALYZE_MODEL ||
  process.env.GPTSAPI_INTENT_TRIAGE_MODEL ||
  "gemini-2.5-flash";

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function cleanTopicText(value: string) {
  const raw = value.trim();
  if (!raw) {
    return "";
  }
  const withoutGreeting = raw
    .replace(/^(hello|hi|hey|test|你好|在吗|测试|请问|麻烦|help)\b[:：]?\s*/i, "")
    .replace(/^(please|pls|can you|could you|i want to|need to|help me)\b[:：]?\s*/i, "")
    .trim();
  const withoutFiller = withoutGreeting
    .replace(/[\u3000\s]+/g, " ")
    .replace(/^(关于|帮我|请帮我|我想要|我想|需要|请生成|请制作)\s*/i, "")
    .replace(/^(a|an|the|one|some)\s+/i, "")
    .trim();
  return withoutFiller || raw;
}

function buildTopic(input: string) {
  const explicitTopic = input.match(/(?:主题是|主题为|主题[:：]|topic\s*(?:is|:)|about)\s*[“"']?([^，。；,.;\n]+)/i);
  if (explicitTopic?.[1]) {
    const picked = cleanTopicText(explicitTopic[1].replace(/[”"']$/g, "").trim()).replace(/[的之]+$/g, "");
    if (picked.length >= 2) {
      return picked.slice(0, 64);
    }
  }
  const questionTopic = input.match(/((?:为什么|为何|怎么|如何|why|how)[^，。；,.;\n]+)/i);
  if (questionTopic?.[1]) {
    const picked = cleanTopicText(questionTopic[1].replace(/[？?]$/g, "").trim()).replace(/[的之]+$/g, "");
    if (picked.length >= 2) {
      return picked.slice(0, 64);
    }
  }
  const dataSummaryTopic = input.match(/^([A-Za-z][\w .-]{1,40}|[\u4e00-\u9fa5A-Za-z][\u4e00-\u9fa5A-Za-z .-]{1,30})\s+(20\d{2}\s*)?(Q[1-4]|第[一二三四1-4]季度)\b/i);
  if (dataSummaryTopic?.[0] && /(财报|营收|净利润|收入|利润|EPS|同比|环比|增长|亏损)/i.test(input)) {
    const picked = cleanTopicText(dataSummaryTopic[0].trim()).replace(/[的之]+$/g, "");
    if (picked.length >= 2) {
      return `${picked} 财报摘要`.slice(0, 64);
    }
  }
  const cleaned = cleanTopicText(
    input
      .replace(/^(please|help me|can you|i want to|need to|请|帮我|麻烦|我想|需要)?\s*(做成|generate|create|make|build|生成|制作|做|创建)?/i, "")
      .replace(/\d+\s*(?:页|张|个分镜|帧|slides?|posters?|frames?)/gi, " ")
      .replace(/\b(?:ppt|slides?|video|poster|infographic)\b/gi, " ")
      .replace(/(?:信息图图片|信息图片|长图|视频|海报|图片|信息图|分镜|课件|幻灯片)/g, " ")
      .replace(/(?:主题是|主题为|主题[:：]|做成|生成|制作|输出|解释|讲解|分析|总结)/g, " ")
      .replace(/[，。；,.]/g, " ")
      .trim(),
  ).replace(/[的之]+$/g, "");
  if (cleaned.length >= 2) {
    return cleaned.slice(0, 64);
  }
  return cleanTopicText(input).slice(0, 64);
}

function pickDirection(input: string): AnalyzeDirection {
  const text = normalizeText(input);
  if (/(视频|分镜|口播|video|storyboard|voiceover)/i.test(text)) {
    return "video";
  }
  if (/(ppt|slide|slides|课件|幻灯)/i.test(text)) {
    return "ppt";
  }
  if (/(海报|长图|poster|infographic|封面|信息图|图片)/i.test(text)) {
    return "poster";
  }
  return "unknown";
}

function containsLatestSignal(input: string) {
  return /(最新|最近|当日|今日|本周|本月|今年|实时|快讯|news|latest|newest|recent|today|thisweek|thismonth|current|earnings|quarterly|10-k|10q|财报|业绩)/i.test(
    input,
  );
}

function extractJsonObject(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || trimmed;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    return null;
  }
  return candidate.slice(firstBrace, lastBrace + 1);
}

function buildTopicRelatedSuggestions(topic: string, outputLanguage?: string) {
  const isZh = (outputLanguage || "").toLowerCase().startsWith("zh");
  const seed = cleanTopicText(topic) || (isZh ? "这个主题" : "this topic");
  if (/(volcano|eruption|火山|喷发)/i.test(seed)) {
    return isZh
      ? [
          "火山形成的过程是什么？从地幔熔融到喷发如何推进",
          "火山喷发前有哪些普通人能理解的预警信号",
          "爆炸式喷发和溢流式喷发有什么区别",
          "火山灰、熔岩和气体会怎样影响生活和交通",
        ]
      : [
          "How does a volcano form from mantle melting to eruption?",
          "What warning signs can appear before a volcanic eruption?",
          "What is the difference between explosive and effusive eruptions?",
          "How do ash, lava, and volcanic gases affect daily life?",
      ];
  }
  if (/(train|rail|railway|metro|subway|火车|列车|高铁|地铁|轨道交通)/i.test(seed)) {
    return isZh
      ? [
          "火车为什么能又快又稳地运行",
          "高铁和普通列车到底有什么区别",
          "从进站到上车，乘火车的流程是怎样的",
          "一条线路上多列火车如何避免冲突",
        ]
      : [
          "How trains stay stable and safe at high speed",
          "What makes high-speed rail different from regular trains",
          "What happens from station entry to boarding in simple steps",
          "How train dispatching keeps many trains on time",
        ];
  }
  if (/(desert|沙漠)/i.test(seed)) {
    return isZh
      ? [
          "为什么沙漠白天很热、晚上却很冷",
          "云量和水汽会怎样改变昼夜温差",
          "沙地和水体在储热能力上有什么差异",
          "如何用三个因素快速判断温差大小",
        ]
      : [
          "Why are deserts hot in the day and cold at night?",
          "How do clouds and moisture change day-night temperature swings?",
          "How does sand store heat differently from water?",
          "How can we quickly judge temperature range with three factors?",
        ];
  }
  return isZh
    ? [
        `${seed}最关键的知识点是什么`,
        `${seed}背后的原理可以怎么通俗理解`,
        `${seed}在生活里最常见的场景是什么`,
        `围绕${seed}，最容易出现的误解有哪些`,
      ]
    : [
        `What is the key idea behind ${seed}?`,
        `How can ${seed} be explained in plain language?`,
        `What is a common real-life situation for ${seed}?`,
        `What is one common misunderstanding about ${seed}?`,
      ];
}

function buildLatestHint(outputLanguage?: string) {
  const isZh = (outputLanguage || "").toLowerCase().startsWith("zh");
  return isZh
    ? "该需求可能涉及最新或需来源核验的信息。Prompt2 应保留用户已提供事实；如无可靠数据，则生成框架型或来源感知文稿，避免编造具体数字。"
    : "This request may involve current or source-sensitive facts. Prompt2 should preserve supplied facts; if reliable data is unavailable, continue with a framework-style or source-aware draft without inventing specifics.";
}

function heuristicAnalyze(input: string, sourcesCount: number, outputLanguage?: string): IntentAnalysis {
  const text = input.trim();
  const direction = pickDirection(text);
  const topic = buildTopic(text);
  const normalized = normalizeText(text);
  const hasLatest = containsLatestSignal(text);
  const explicitSignal =
    /(生成|制作|做成|输出|讲解|解释|分析|总结|create|generate|make|build|explain|analyze|summarize|poster|video|ppt|slide|storyboard|海报|视频|分镜|课件)/i.test(
      text,
    ) || /(?:\d+\s*(?:页|张|个分镜|帧|slides?|posters?|frames?))/.test(text);
  const tokenCount = text
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean).length;

  if (!text || /^(hello|hi|hey|test|你好|在吗|测试)$/i.test(text)) {
    return {
      classification: "invalid",
      direction: "unknown",
      confidence: 0.86,
      topic,
      reason: "Input is missing a clear topic.",
      clarifyMode: "topic",
      needsFreshSources: false,
      suggestions: buildTopicRelatedSuggestions(topic, outputLanguage),
      assistantHint: (outputLanguage || "").toLowerCase().startsWith("zh")
        ? "我还没拿到明确主题。先告诉我你想解释什么，或从下方选一个通俗话题。"
        : "I still need a clear topic. Tell me what to explain, or pick one topic below.",
    };
  }

  if (hasLatest && sourcesCount === 0) {
    return {
      classification: "ready",
      direction,
      confidence: direction === "unknown" ? 0.72 : 0.86,
      topic,
      reason: "Request is clear enough to continue, with a fresh-source risk flagged for downstream drafting.",
      clarifyMode: "none",
      needsFreshSources: true,
      suggestions: [],
      assistantHint: buildLatestHint(outputLanguage),
    };
  }

  if ((normalized.length < 8 && !explicitSignal) || (tokenCount <= 2 && text.length < 20)) {
    return {
      classification: "need_topic_clarification",
      direction: direction === "unknown" ? "unknown" : direction,
      confidence: 0.74,
      topic,
      reason: "Topic looks too short for direct generation.",
      clarifyMode: "topic",
      needsFreshSources: false,
      suggestions: buildTopicRelatedSuggestions(topic, outputLanguage),
      assistantHint: (outputLanguage || "").toLowerCase().startsWith("zh")
        ? "这个输入太短，我先给你 4 个更好展开的通俗选题。"
        : "This input is too short. Here are 4 easier topic options to continue.",
    };
  }

  return {
    classification: "ready",
    direction,
    confidence: direction === "unknown" ? 0.67 : 0.9,
    topic,
    reason: "Request is clear enough to continue.",
    clarifyMode: "none",
    needsFreshSources: false,
    suggestions: [],
    assistantHint: (outputLanguage || "").toLowerCase().startsWith("zh")
      ? `已理解主题“${topic || "知识主题"}”，可继续确认方向与配置。`
      : `Understood topic "${topic || "Knowledge Topic"}". You can continue with direction and configuration.`,
  };
}

function normalizeAnalyzeResult(raw: Partial<IntentAnalysis>, fallback: IntentAnalysis): IntentAnalysis {
  const direction =
    raw.direction === "poster" || raw.direction === "ppt" || raw.direction === "video" || raw.direction === "unknown"
      ? raw.direction
      : fallback.direction;
  const classification =
    raw.classification === "invalid" ||
    raw.classification === "need_topic_clarification" ||
    raw.classification === "needs_fresh_sources" ||
    raw.classification === "ready"
      ? raw.classification
      : fallback.classification;
  const clarifyMode =
    classification === "ready"
      ? "none"
      : raw.clarifyMode === "none" || raw.clarifyMode === "topic" || raw.clarifyMode === "fresh_sources"
        ? raw.clarifyMode
        : classification === "needs_fresh_sources"
          ? "fresh_sources"
          : classification === "need_topic_clarification" || classification === "invalid"
            ? "topic"
            : "none";
  const confidence =
    typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
      ? Math.max(0.1, Math.min(0.99, raw.confidence))
      : fallback.confidence;
  const topic = typeof raw.topic === "string" && raw.topic.trim() ? raw.topic.trim().slice(0, 64) : fallback.topic;
  const reason = typeof raw.reason === "string" && raw.reason.trim() ? raw.reason.trim().slice(0, 300) : fallback.reason;
  const assistantHint =
    typeof raw.assistantHint === "string" && raw.assistantHint.trim()
      ? raw.assistantHint.trim().slice(0, 320)
      : fallback.assistantHint;
  const rawSuggestions = Array.isArray(raw.suggestions)
    ? raw.suggestions
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
        .slice(0, 4)
    : [];
  const suggestions =
    classification === "need_topic_clarification" || classification === "invalid"
      ? rawSuggestions.length
        ? rawSuggestions
        : fallback.suggestions
      : [];

  return {
    classification,
    direction,
    confidence,
    topic,
    reason,
    clarifyMode,
    needsFreshSources:
      typeof raw.needsFreshSources === "boolean"
        ? raw.needsFreshSources
        : clarifyMode === "fresh_sources" || classification === "needs_fresh_sources",
    suggestions,
    assistantHint,
  };
}

async function requestAnalyzeFromModel(input: string, sourcesSummary: string, outputLanguage?: string) {
  const { systemPrompt, userPrompt } = buildWorkspaceIntentPrompt({
    userInput: input,
    sourcesSummary,
    outputLanguage,
  });
  if (!DEFAULT_KEY) {
    return requestAnalyzeFromOpenAICompat(systemPrompt, userPrompt);
  }

  const response = await fetch(`${DEFAULT_ENDPOINT}/${encodeURIComponent(DEFAULT_MODEL)}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": DEFAULT_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
        },
      ],
    }),
  });
  if (!response.ok) {
    return requestAnalyzeFromOpenAICompat(systemPrompt, userPrompt);
  }
  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const rawText =
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("\n")
      .trim() || "";
  const jsonText = extractJsonObject(rawText);
  if (!jsonText) {
    return requestAnalyzeFromOpenAICompat(systemPrompt, userPrompt);
  }
  try {
    return JSON.parse(jsonText) as Partial<IntentAnalysis>;
  } catch {
    return requestAnalyzeFromOpenAICompat(systemPrompt, userPrompt);
  }
}

async function requestAnalyzeFromOpenAICompat(systemPrompt: string, userPrompt: string) {
  if (!OPENAI_COMPAT_KEY || !OPENAI_COMPAT_ENDPOINT) {
    return null;
  }
  const response = await fetch(OPENAI_COMPAT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_COMPAT_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_COMPAT_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) {
    return null;
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const rawText = data.choices?.[0]?.message?.content?.trim() || "";
  const jsonText = extractJsonObject(rawText);
  if (!jsonText) {
    return null;
  }
  try {
    return JSON.parse(jsonText) as Partial<IntentAnalysis>;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as RequestBody;
    const input = (body.input || "").trim().slice(0, 8000);
    const outputLanguage = (body.outputLanguage || "en").trim().slice(0, 24);
    const sources = Array.isArray(body.sources) ? body.sources : [];
    const fallback = heuristicAnalyze(input, sources.length, outputLanguage);
    if (!input && !sources.length) {
      return NextResponse.json({
        ok: true,
        analysis: fallback,
      });
    }
    const sourcesSummary = sources
      .slice(0, 6)
      .map((item, index) => {
        const kind = item.kind || "file";
        const name = (item.name || "").slice(0, 120);
        const origin = (item.origin || "").slice(0, 220);
        const excerpt = (item.excerpt || "").slice(0, 220);
        return `${index + 1}. [${kind}] ${name} ${origin} ${excerpt}`.trim();
      })
      .join("\n");

    const modelResult = await requestAnalyzeFromModel(input, sourcesSummary, outputLanguage);
    const analysis = normalizeAnalyzeResult(modelResult || {}, fallback);
    return NextResponse.json({
      ok: true,
      analysis,
    });
  } catch {
    return NextResponse.json(
      {
        ok: true,
        analysis: heuristicAnalyze("", 0, "en"),
      },
      { status: 200 },
    );
  }
}
