import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { buildContentDraftPrompt } from "@/lib/prompts/content-draft";
import { buildMockDraftPayload } from "@/lib/prompts/content-draft-mock";
import { rateLimitOrThrow } from "@/lib/server/rate-limit";
import { RATE_LIMIT_CONFIG } from "@/lib/server/rate-limit-config";
import { incrementAndCheckUsageLimit, getUsageCounter } from "@/lib/server/guard";
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
};

type PosterDraftRequest = {
  topic?: string;
  prompt?: string;
  textModel?: string;
  posterCount?: number;
  posterSizeLabel?: string;
  direction?: "poster" | "ppt" | "video";
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
};

type VideoStoryboardDraft = {
  index?: number;
  title?: string;
  durationSec?: number;
  narration?: string;
  visual?: string;
  onScreenText?: string;
  imagePrompt?: string;
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

  return { ok: true as const, text, modelVersion: data.modelVersion ?? providerModel };
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

  return { ok: true as const, text, modelVersion: data.model ?? model };
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

function cleanSentence(input: string) {
  return input.replace(/\s+/g, "").trim();
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

  const tone = /生动|趣味|轻松/.test(prompt) ? "更生动" : /专业|严谨/.test(prompt) ? "更专业" : "更清晰";
  return {
    headline: `${topic}：关键机制与现实影响`,
    subtitle: tone,
    body: `${topic}会直接改变日常决策与成本结构。典型表现是同样预算下可获得资源减少、选择范围变窄，个体需要在效率、价格和风险之间重新平衡。`,
    points: [
      `${topic}的上游变量变化会先体现在成本端，并在短周期内传导到终端价格。`,
      "终端价格上行后，用户通常会从高弹性消费转向刚需消费，消费结构出现收缩。",
      "当收入增速低于相关成本增速时，实际购买力下降，储蓄和消费决策会同步调整。",
      "可跟踪一个核心指标作为判断基准，并结合连续周期变化评估趋势是否延续。",
    ],
    cta: "收藏这张图，1 分钟复习知识主线",
    size: sizeLabel,
    visualType: "因果流图",
    layoutSuggestion: "上方标题 + 中部机制链路 + 下方结论区",
    visualElements: ["关键变量A", "关键变量B", "变化结果", "行动建议"],
  };
}

function buildFallbackPlanList(topic: string, count: number): PosterPlanItem[] {
  return buildFallbackPlanListByLanguage(topic, count, "zh");
}

function buildFallbackPlanListByLanguage(topic: string, count: number, outputLanguage: OutputLanguage): PosterPlanItem[] {
  if (!isChineseLanguage(outputLanguage)) {
    const seed = [
      { title: `${topic} · Core question`, focus: "Frame the key question in one sentence." },
      { title: `${topic} · Mechanism`, focus: "Explain the mechanism with a concrete causal chain." },
      { title: `${topic} · Conclusion and use case`, focus: "Summarize key takeaway and practical relevance." },
      { title: `${topic} · Quick review`, focus: "Condense the topic into high-signal recap points." },
      { title: `${topic} · Real-world case`, focus: "Add one realistic scenario to improve retention." },
      { title: `${topic} · Common misconceptions`, focus: "Clarify misconceptions and correct framing." },
      { title: `${topic} · Visual summary`, focus: "Compress key insights into one visual summary." },
      { title: `${topic} · Further exploration`, focus: "Suggest extension questions for deeper learning." },
      { title: `${topic} · Comparison angle`, focus: "Use contrast to highlight critical differences." },
      { title: `${topic} · Final recap`, focus: "Complete a one-screen recap of the full topic." },
    ];
    const list = Array.from({ length: count }, (_, idx) => seed[idx % seed.length]);
    return list.map((item, idx) => ({
      index: idx + 1,
      title: item.title,
      focus: item.focus,
    }));
  }
  const seed = [
    { title: `${topic} · 核心问题`, focus: "用一句话提出问题并建立兴趣" },
    { title: `${topic} · 关键机制`, focus: "拆解机制过程，突出因果关系" },
    { title: `${topic} · 结论与应用`, focus: "总结重点并给出应用场景" },
    { title: `${topic} · 复习速记`, focus: "高密度关键词速查版" },
    { title: `${topic} · 关键案例`, focus: "增加真实场景案例，提高理解与记忆" },
    { title: `${topic} · 误区澄清`, focus: "澄清常见误解，避免概念混淆" },
    { title: `${topic} · 图解总结`, focus: "将重点压缩成可视化结论" },
    { title: `${topic} · 延展阅读`, focus: "补充延伸问题与探索方向" },
    { title: `${topic} · 对比视角`, focus: "通过对比强化关键差异" },
    { title: `${topic} · 快速复盘`, focus: "用一屏完成核心要点复习" },
  ];
  const list = Array.from({ length: count }, (_, idx) => seed[idx % seed.length]);
  return list.map((item, idx) => ({
    index: idx + 1,
    title: item.title,
    focus: item.focus,
  }));
}

function parseJsonContent(content: string) {
  try {
    return JSON.parse(content) as {
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
      planList?: Array<{ title?: string; focus?: string }>;
      outlineItems?: string[];
      slideDrafts?: PptSlideDraft[];
      storyboardDrafts?: VideoStoryboardDraft[];
    };
  } catch {
    return null;
  }
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
      return {
        page: Number.isFinite(row.page) ? Number(row.page) : idx + 1,
        title,
        body: [body, support].filter(Boolean).join("\n"),
        visual,
      };
    })
    .filter((item): item is { page: number; title: string; body: string; visual: string } => Boolean(item));

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
      return {
        index: Number.isFinite(row.index) ? Number(row.index) : idx + 1,
        title,
        narration: [narration, onScreenText].filter(Boolean).join("\n"),
        visual,
      };
    })
    .filter((item): item is { index: number; title: string; narration: string; visual: string } => Boolean(item));

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
    const topic = (payload.topic ?? "知识主题").trim() || "知识主题";
    const prompt = (payload.prompt ?? "").trim();
    const textModel = (payload.textModel ?? "").trim().toLowerCase();
    const direction = payload.direction ?? "poster";
    const outputCount = clamp(
      Math.round(payload.posterCount ?? (direction === "poster" ? 1 : 6)),
      direction === "poster" ? 1 : 6,
      direction === "poster" ? 10 : 24,
    );
    const posterSizeLabel = payload.posterSizeLabel?.trim();
    const outputLanguage = resolveOutputLanguage({
      userPrompt: prompt,
      sourceText: topic,
      fallback: payload.outputLanguage ?? "en",
    });
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
    if (isFreeTextModel(textModel)) {
      const freeResult = await requestDraftFromGptsApi({ textModel, promptBundle });
      if (!freeResult.ok) {
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
    } else {
      const paidResult = await requestDraftFromPaidModels({ textModel, promptBundle });
      if (!paidResult.ok) {
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
    }

    if (!content) {
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
      const outlineItems = normalizeOutlineItems(parsed.outlineItems, outputCount, topic);
      if (direction === "ppt") {
        const slideDrafts = normalizeSlideDrafts(parsed.slideDrafts, outlineItems, outputCount);
        return NextResponse.json({
          direction,
          outlineItems,
          slideDrafts,
          outputLanguage,
          source: "llm",
        });
      }
      const storyboardDrafts = normalizeStoryboardDrafts(parsed.storyboardDrafts, outlineItems, outputCount);
      return NextResponse.json({
        direction,
        outlineItems,
        storyboardDrafts,
        outputLanguage,
        source: "llm",
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
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(isChineseLanguage(outputLanguage) ? "。" : ". ");
    specificPosterDraft.body = compactBody
      ? `${compactBody}${isChineseLanguage(outputLanguage) ? "。" : "."}`
      : fallbackDraft.body;
    specificPosterDraft.points = (specificPosterDraft.points.length ? specificPosterDraft.points : fallbackDraft.points)
      .slice(0, 5)
      .map((point) => point.trim())
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

    const planList: PosterPlanItem[] =
      Array.isArray(parsed.planList) && parsed.planList.length
        ? Array.from({ length: outputCount }, (_, idx) => {
            const item = parsed.planList?.[idx] ?? parsed.planList?.[parsed.planList.length - 1];
            const fallback = fallbackPlan[idx];
            return {
              index: idx + 1,
              title: item?.title?.trim() || fallback.title,
              focus: item?.focus?.trim() || fallback.focus,
            };
          })
        : fallbackPlan;

    void renderSpec;
    void internalModelPrompt;

    return NextResponse.json({
      posterDraft: specificPosterDraft,
      planList,
      outputLanguage,
      source: "llm",
    });
  } catch (error) {
    const retryAfter = (error as Error & { retryAfterSeconds?: number }).retryAfterSeconds;
    if (retryAfter) {
      return NextResponse.json(
        { error: "Too many draft requests. Please retry later." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
