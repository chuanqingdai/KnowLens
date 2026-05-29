"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, ArrowUp, LoaderCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";

import {
  ChatPanel,
  type ChatTurnMeta,
  type ChatTurn,
  type WorkspaceIntent,
} from "@/components/workspace/ChatPanel";
import { StoryboardCanvas } from "@/components/workspace/StoryboardCanvas";
import { PosterCanvas } from "@/components/workspace/PosterCanvas";
import { TopBar } from "@/components/workspace/TopBar";
import { PaywallDialog } from "@/components/billing/PaywallDialog";
import { outlineItems as volcanoOutlineItems, slideDrafts as volcanoSlideDrafts } from "@/components/workspace/mockData";
import {
  appendCreditRecord,
  getCreditRecords,
  getSubscriptionByUser,
} from "@/lib/billing";
import {
  STANDARD_OUTPUT_PROMO_CREDITS,
  STANDARD_OUTPUT_REGULAR_CREDITS,
} from "@/lib/credit-pricing";
import {
  ensureUserProjectByEmail,
  getAdminProjects,
  getAdminUserByEmail,
  getProjectsByUser,
} from "@/lib/admin";
import { getVisualizationRecommendation } from "@/lib/prompts/content-draft";
import {
  isChineseLanguage,
  resolveOutputLanguage,
  type OutputLanguage,
} from "@/lib/language";

type HomeSourceKind = "file" | "web" | "youtube" | "podcast";
type HomeSourceItem = {
  id: string;
  kind: HomeSourceKind;
  name: string;
  origin: string;
  status:
    | "queued"
    | "uploading"
    | "extracting"
    | "processing"
    | "ready"
    | "failed";
  excerpt: string;
  contentText?: string;
  errorMessage?: string | null;
  errorCode?: string | null;
  progress?: number;
};
type HomeDraftPayload = {
  prompt?: string;
  textModel?: string;
  imageModel?: string;
  sources?: HomeSourceItem[];
  project?: {
    projectId?: string;
    projectTraceId?: string;
    projectUserId?: string;
    projectTitle?: string;
  };
};

type SlideDraft = {
  page: number;
  title: string;
  body: string;
  visual: string;
};

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

type FlowStage = "intent" | "config" | "content" | "style" | "billing" | "generate";

type ParsedContentEditCommand = {
  target:
    | { kind: "slide"; index: number }
    | { kind: "poster"; index: number }
    | { kind: "all" };
  action: "shorten" | "enhance" | "append";
  payload: string;
};

type WorkspaceSessionPrefs = {
  intent: Exclude<WorkspaceIntent, "unknown">;
  posterCount: number;
  posterSizeId: string | null;
  pptPageCount: number;
  pptRatio: "16:9" | "4:3";
  videoStoryboardCount: number;
  videoRatio: "16:9" | "9:16";
  styleId: string;
};

type ConfirmedConfigSnapshot = {
  intent: Exclude<WorkspaceIntent, "unknown">;
  posterCount: number;
  posterSizeId: string | null;
  pptPageCount: number;
  pptRatio: "16:9" | "4:3";
  videoStoryboardCount: number;
  videoRatio: "16:9" | "9:16";
};

type LanguageAwareContext = {
  outputLanguage: OutputLanguage;
};

type ImageGenerationTask = {
  index: number;
  outputType: "poster" | "ppt" | "video";
  aspectRatio: string;
  styleId: string;
  styleName: string;
  stylePrompt: string;
  contentTitle: string;
  contentBody: string;
  visualHint: string;
  composedPrompt: string;
};

type GenerationTaskUiStatus = "queued" | "generating" | "retrying" | "success" | "failed";

type GenerationTaskUiState = {
  index: number;
  status: GenerationTaskUiStatus;
  attempts: number;
  maxAttempts: number;
  imageUrl?: string;
  error?: string;
};

type GenerationConfirmResponse = {
  ok?: boolean;
  error?: string;
  generation?: {
    providerCalled?: boolean;
    results?: Array<{
      index?: number;
      ok?: boolean;
      imageUrl?: string;
      rawImageUrl?: string;
      error?: string;
      errorCode?: string;
    }>;
  };
};

type StructuredWorkspaceError = {
  userMessage: string;
  code?: string;
};

const HOME_DRAFT_KEY = "knowlens-home-draft";
const WORKSPACE_DRAFT_CACHE_KEY = "knowlens-workspace-draft-v1";
const WORKSPACE_SESSION_PREFS_KEY = "knowlens-workspace-session-prefs-v1";
const WORKSPACE_CHAT_HISTORY_KEY = "knowlens-workspace-chat-history-v1";
const MEMBERSHIP_SOURCE_KEY = "knowlens:membership-source";
const GENERATION_REQUEST_TIMEOUT_MS = 180000;
const GENERATION_MAX_RETRY_ATTEMPTS = 3;
const GENERATION_RETRY_DELAYS_MS = [1100, 2300];

type StyleDirection = "ppt" | "poster" | "video";
type StyleOption = {
  id: string;
  name: string;
  englishName: string;
  fit: string;
  prompt: string;
  suitableTopics: string;
  carrierPriority: StyleDirection[];
  topicKeywords: string[];
  palette: [string, string, string];
  coverImage: string;
};

const styleCoverFileById: Record<string, string> = {
  "clean-science-infographic": "Clean Science Infographic Style.jpg",
  "premium-editorial-infographic": "Premium Editorial Infographic Style.jpg",
  "youtube-science-thumbnail": "Hero Science Cover Style.jpg",
  "minimal-line-art": "Minimal Line Art Style.jpg",
  "hand-drawn-explainer": "Hand-drawn Explainer Style.jpg",
  "cute-3d-educational": "Cute 3D Educational Style.jpg",
  "3d-isometric-tech": "3D Isometric Tech Style.jpg",
  "dark-premium-tech": "Dark Premium Tech Style.jpg",
  "technical-blueprint": "Technical Blueprint Style.jpg",
  "medical-educational-illustration": "Medical Educational Illustration Style.jpg",
  "cinematic-science-illustration": "Cinematic Science Illustration Style.jpg",
  "premium-sketchnote-science": "Premium Sketchnote Science Style.jpg",
};

function styleCoverById(styleId: string) {
  const filename = styleCoverFileById[styleId] ?? styleCoverFileById["clean-science-infographic"];
  return `/style/${encodeURIComponent(filename)}?v=20260529a`;
}

const styleOptions = [
  {
    id: "clean-science-infographic",
    name: "简洁科普信息图风",
    englishName: "Clean Science Infographic",
    fit: "Clear structure and high readability, ideal for mechanism explainers and general science topics.",
    prompt:
      "Clean scientific infographic aesthetic, bright neutral canvas, disciplined visual hierarchy, precise spacing system, restrained color contrast, crisp line quality, subtle depth separation, modular composition, high legibility, modern editorial clarity, polished professional finish.",
    suitableTopics: "通用科普、自然科学、物理、地理、人体、机制解释",
    carrierPriority: ["ppt", "poster", "video"],
    topicKeywords: ["科普", "自然", "物理", "地理", "人体", "机制", "原理", "解释"],
    palette: ["#1f2937", "#3b82f6", "#e5e7eb"],
    coverImage: styleCoverById("clean-science-infographic"),
  },
  {
    id: "youtube-science-thumbnail",
    name: "大主体科普封面风",
    englishName: "Hero Science Cover Style",
    fit: "High-impact visual style, ideal for trending topics and attention-grabbing distribution.",
    prompt:
      "Hero-cover visual direction, high-impact focal emphasis, cinematic contrast control, dramatic but clean tonal separation, bold negative space strategy, premium depth rendering, concise headline-safe layout zone, striking first-screen presence, polished contemporary finish.",
    suitableTopics: "宇宙、AI、深海、灾难、人体、科技热点",
    carrierPriority: ["poster", "video", "ppt"],
    topicKeywords: ["宇宙", "ai", "深海", "灾难", "人体", "热点", "火山", "科技"],
    palette: ["#111827", "#ef4444", "#f8fafc"],
    coverImage: styleCoverById("youtube-science-thumbnail"),
  },
  {
    id: "cinematic-science-illustration",
    name: "电影级科普视觉风",
    englishName: "Cinematic Science Illustration",
    fit: "Immersive cinematic atmosphere, ideal for space, disaster, and large-scale science themes.",
    prompt:
      "Cinematic scientific illustration direction, high-detail realism, atmospheric depth grading, dramatic light shaping, premium documentary-like finish, controlled dynamic range, elegant contrast transitions, immersive but clean composition, visually powerful professional polish.",
    suitableTopics: "宇宙、深海、火山、恐龙、灾难、未来城市",
    carrierPriority: ["poster", "video", "ppt"],
    topicKeywords: ["宇宙", "深海", "火山", "恐龙", "灾难", "未来城市", "史前", "行星"],
    palette: ["#111827", "#7c3aed", "#e2e8f0"],
    coverImage: styleCoverById("cinematic-science-illustration"),
  },
  {
    id: "minimal-line-art",
    name: "极简线稿风",
    englishName: "Minimal Line Art",
    fit: "Minimal linework with generous whitespace, ideal for core concepts and structural explanations.",
    prompt:
      "Minimal line-art system, ultra-clean monochrome discipline, fine contour precision, generous negative space, low-noise layout, subtle tonal hierarchy, technical calmness, lightweight visual density, balanced geometric rhythm, understated professional clarity.",
    suitableTopics: "基础概念、产品说明、AI原理、简单科学机制",
    carrierPriority: ["ppt", "poster", "video"],
    topicKeywords: ["基础", "概念", "产品", "ai原理", "机制", "结构", "说明"],
    palette: ["#111827", "#64748b", "#f8fafc"],
    coverImage: styleCoverById("minimal-line-art"),
  },
  {
    id: "hand-drawn-explainer",
    name: "手绘教学风",
    englishName: "Hand-drawn Explainer Style",
    fit: "Friendly and approachable, ideal for kids and beginner-friendly educational content.",
    prompt:
      "Hand-drawn explainer aesthetic, organic stroke character, soft texture feel, approachable visual tone, loose-but-structured composition rhythm, warm contrast profile, lightweight annotation style, humanized educational polish, clean readability with relaxed visual energy.",
    suitableTopics: "儿童科普、生活常识、健康知识、基础物理、心理学",
    carrierPriority: ["video", "ppt", "poster"],
    topicKeywords: ["儿童", "生活常识", "健康", "基础物理", "心理", "入门", "低龄"],
    palette: ["#334155", "#f59e0b", "#fef3c7"],
    coverImage: styleCoverById("hand-drawn-explainer"),
  },
  {
    id: "cute-3d-educational",
    name: "3D 可爱教育风",
    englishName: "Cute 3D Educational Style",
    fit: "Rounded forms and playful tone, ideal for early-age health and animal education topics.",
    prompt:
      "Soft 3D educational direction, rounded form language, gentle global illumination, warm pastel tonal environment, smooth material response, playful yet orderly composition, high-fidelity render polish, accessible emotional tone, clean and friendly visual communication.",
    suitableTopics: "儿童科普、动物、人体健康、营养、低龄教育",
    carrierPriority: ["video", "poster", "ppt"],
    topicKeywords: ["儿童", "动物", "人体健康", "营养", "低龄", "亲子", "启蒙"],
    palette: ["#0f172a", "#22d3ee", "#dbeafe"],
    coverImage: styleCoverById("cute-3d-educational"),
  },
  {
    id: "3d-isometric-tech",
    name: "3D 等距科技风",
    englishName: "3D Isometric Tech Style",
    fit: "Strong spatial clarity, ideal for systems, cities, and data infrastructure narratives.",
    prompt:
      "Isometric technology visualization style, precise spatial layering, clean modular geometry, structured depth mapping, cool futuristic palette control, luminous accent restraint, high-detail but organized composition, professional product-grade rendering, systematic visual logic.",
    suitableTopics: "AI系统、数据中心、芯片、城市系统、互联网、能源",
    carrierPriority: ["ppt", "poster", "video"],
    topicKeywords: ["ai系统", "数据中心", "芯片", "城市系统", "互联网", "能源", "架构", "模块"],
    palette: ["#0f172a", "#10b981", "#d1fae5"],
    coverImage: styleCoverById("3d-isometric-tech"),
  },
  {
    id: "dark-premium-tech",
    name: "黑金高端科技风",
    englishName: "Dark Premium Tech Style",
    fit: "High-contrast and premium texture, ideal for fintech and future-tech storytelling.",
    prompt:
      "Dark premium tech visual language, deep low-key tonal base, controlled high-contrast highlights, sleek reflective finish, cinematic shadow sculpting, luxury-grade color accents, sharp edge definition, futuristic interface atmosphere, dramatic yet disciplined composition.",
    suitableTopics: "AI、芯片、金融科技、机器人、数据、未来科技",
    carrierPriority: ["poster", "ppt", "video"],
    topicKeywords: ["ai", "芯片", "金融科技", "机器人", "数据", "未来科技", "前沿"],
    palette: ["#09090b", "#f59e0b", "#1d4ed8"],
    coverImage: styleCoverById("dark-premium-tech"),
  },
  {
    id: "technical-blueprint",
    name: "科技蓝图风",
    englishName: "Technical Blueprint Style",
    fit: "Engineering-driven blueprint aesthetic, ideal for aerospace, mechanical, and structural topics.",
    prompt:
      "Technical blueprint aesthetic, engineered grid discipline, precision drafting linework, schematic layout logic, measurement-style visual cadence, cool monochromatic technical palette, clean annotation rhythm, industrial presentation rigor, high-clarity structural communication.",
    suitableTopics: "航空航天、机械、潜艇、机器人、军事科技、工程结构",
    carrierPriority: ["poster", "ppt", "video"],
    topicKeywords: ["航天", "机械", "潜艇", "机器人", "军事", "工程", "结构", "蓝图"],
    palette: ["#0b2447", "#38bdf8", "#bfdbfe"],
    coverImage: styleCoverById("technical-blueprint"),
  },
  {
    id: "medical-educational-illustration",
    name: "医学科普插画风",
    englishName: "Medical Educational Illustration",
    fit: "Professional yet accessible, ideal for anatomy and disease-mechanism explainers.",
    prompt:
      "Clinical educational illustration style, sterile clean tonal environment, precise form definition, soft realistic shading, trusted professional visual tone, balanced informational clarity, restrained medical palette accents, calm and accurate presentation quality.",
    suitableTopics: "心血管、人体器官、代谢、疾病机制、营养健康",
    carrierPriority: ["ppt", "video", "poster"],
    topicKeywords: ["心血管", "器官", "代谢", "疾病", "营养", "医学", "健康", "人体"],
    palette: ["#0f172a", "#14b8a6", "#e0f2fe"],
    coverImage: styleCoverById("medical-educational-illustration"),
  },
  {
    id: "premium-editorial-infographic",
    name: "高级报告信息图风",
    englishName: "Premium Editorial Infographic",
    fit: "Professional report and magazine layout feel, ideal for business and trend analysis.",
    prompt:
      "Premium editorial information design, refined composition rhythm, elegant proportional balance, sophisticated typography tone, restrained luxury palette, soft micro-contrast, subtle shadow layering, high-end publication quality, minimalist but information-dense structure, calm professional visual authority.",
    suitableTopics: "商业分析、经济学、产业研究、AI趋势、社会议题",
    carrierPriority: ["ppt", "poster", "video"],
    topicKeywords: ["商业", "经济", "产业", "趋势", "社会", "市场", "报告", "分析"],
    palette: ["#111827", "#f59e0b", "#f3f4f6"],
    coverImage: styleCoverById("premium-editorial-infographic"),
  },
  {
    id: "premium-sketchnote-science",
    name: "精致手账科普风",
    englishName: "Premium Sketchnote Science Style",
    fit: "Refined sketchnote feel, ideal for visual notes, learning cards, and structured study content.",
    prompt:
      "Premium sketchnote aesthetic, refined sketch texture, controlled spontaneity, structured note-like layout rhythm, tasteful accent coloration, handcrafted but polished finish, balanced density, friendly professional tone, clear visual sequencing, elegant educational character.",
    suitableTopics: "心理学、健康、生活科学、儿童科普、学习方法、认知科学、经济学入门",
    carrierPriority: ["poster", "ppt", "video"],
    topicKeywords: ["心理学", "健康", "生活科学", "儿童科普", "学习方法", "认知科学", "经济学", "入门"],
    palette: ["#1f2937", "#ec4899", "#dbeafe"],
    coverImage: styleCoverById("premium-sketchnote-science"),
  },
] as StyleOption[];

const intentOptions: { id: "ppt" | "video" | "poster"; label: string; desc: string }[] = [
  { id: "poster", label: "Generate Poster", desc: "Best for one-page visual explainers and social sharing." },
  { id: "video", label: "Generate Video", desc: "Best for narration-based short-form content." },
  { id: "ppt", label: "Generate PPT", desc: "Best for teaching, workshops, and presentations." },
];

const OUTPUT_COUNT_OPTIONS = [6, 10, 14, 16, 20, 24] as const;

const posterSizeOptions = [
  { id: "poster-9-16", label: "9:16 Portrait", desc: "Great for mobile-first vertical delivery." },
  { id: "poster-1-1", label: "1:1 Square", desc: "Great for card-based publishing." },
  { id: "poster-16-9", label: "16:9 Landscape", desc: "Great for horizontal explainers and covers." },
  { id: "poster-4-3", label: "4:3 Landscape", desc: "Balanced for presentation and educational visuals." },
  { id: "poster-3-4", label: "3:4 Portrait", desc: "Balances readability and information density." },
];

function normalizePosterSizeId(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  if (posterSizeOptions.some((item) => item.id === value)) {
    return value;
  }
  if (value === "poster-9-21") {
    return "poster-9-16";
  }
  if (value === "poster-2-3" || value === "poster-4-5" || value === "poster-a4") {
    return "poster-3-4";
  }
  return null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(input: string) {
  return input.toLowerCase().replace(/\s+/g, "");
}

function containsAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function cleanTopicText(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }
  const withoutGreeting = trimmed.replace(
    /^(?:hello|hi|hey|yo|test|testing|pls|please|你好|您好|哈喽|嗨|测试|开始|在吗|麻烦|请问)[\s,，。.!！？?：:;；-]*/i,
    "",
  );
  const withoutDirectionWords = withoutGreeting
    .replace(/\b(?:generate|create|make|build|write|draft|produce)\b/gi, " ")
    .replace(/\b(?:ppt|slides?|slide\s*deck|video|poster|infographic|storyboard)\b/gi, " ")
    .replace(/(?:生成|制作|创建|做|输出|海报|视频|分镜|课件|长图|图文卡片|文稿)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return withoutDirectionWords || withoutGreeting || trimmed;
}

type SuggestionTheme =
  | "volcano"
  | "black-hole"
  | "photosynthesis"
  | "tide"
  | "tectonics"
  | "inflation"
  | "immune"
  | "dna"
  | "printing"
  | "electrolysis"
  | "generic";

function sanitizeSuggestionTopic(topic: string, outputLanguage: OutputLanguage) {
  const cleaned = cleanTopicText(topic)
    .replace(/[，。；,.!?！？]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length >= 2) {
    return cleaned.slice(0, 36);
  }
  return isChineseLanguage(outputLanguage) ? "这个主题" : "this topic";
}

function isLowSignalSuggestionInput(seedTopic: string) {
  const raw = seedTopic.trim();
  if (!raw) {
    return true;
  }
  const cleaned = cleanTopicText(raw)
    .replace(/[，。；,.!?！？]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return true;
  }
  const compact = cleaned
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
  if (!compact) {
    return true;
  }
  if (
    /^(?:hello|hi|hey|yo|test|testing|pls|please|ok|okay|你好|您好|哈喽|嗨|测试|开始|在吗)$/.test(
      compact,
    )
  ) {
    return true;
  }
  return false;
}

function detectSuggestionTheme(topic: string): SuggestionTheme {
  const raw = cleanTopicText(topic);
  const bag = normalizeText(raw);
  const zhBag = raw.replace(/\s+/g, "");
  if (containsAny(bag, ["火山", "volcano", "magma", "eruption"])) {
    return "volcano";
  }
  if (containsAny(zhBag, ["火山爆发", "喷发"])) {
    return "volcano";
  }
  if (containsAny(bag, ["黑洞", "blackhole", "eventhorizon", "奇点"])) {
    return "black-hole";
  }
  if (containsAny(zhBag, ["黑洞形成", "事件视界"])) {
    return "black-hole";
  }
  if (containsAny(bag, ["光合作用", "photosynthesis", "叶绿体", "chlorophyll"])) {
    return "photosynthesis";
  }
  if (containsAny(bag, ["潮汐", "潮水", "tide", "moon", "月球引力"])) {
    return "tide";
  }
  if (containsAny(bag, ["板块", "地震", "tectonic", "plateboundary", "fault"])) {
    return "tectonics";
  }
  if (containsAny(bag, ["通货膨胀", "cpi", "inflation", "物价上涨", "购买力"])) {
    return "inflation";
  }
  if (containsAny(bag, ["免疫", "抗体", "immune", "vaccine", "炎症"])) {
    return "immune";
  }
  if (containsAny(bag, ["dna", "基因", "遗传", "mutation", "双螺旋"])) {
    return "dna";
  }
  if (containsAny(bag, ["印刷术", "活字", "printing", "movabletype"])) {
    return "printing";
  }
  if (containsAny(bag, ["电解", "electrolysis", "阴极", "阳极"])) {
    return "electrolysis";
  }
  return "generic";
}

function buildSpecificTopicSuggestions(seedTopic: string, outputLanguage: OutputLanguage) {
  const topic = sanitizeSuggestionTopic(seedTopic, outputLanguage);
  const theme = detectSuggestionTheme(topic);
  const isZh = isChineseLanguage(outputLanguage);
  const lowSignalInput = isLowSignalSuggestionInput(seedTopic);

  if (!isZh) {
    if (lowSignalInput) {
      return [
        "How plate tectonics drives both earthquakes and volcano distribution",
        "How black holes bend light and change time near the event horizon",
        "How the immune system identifies pathogens while protecting normal cells",
        "How deep-sea organisms adapt to high pressure and low-temperature habitats",
      ];
    }
    if (theme === "volcano") {
      return [
        "How pressure buildup in a magma chamber triggers eruption timing",
        "Which precursor signals (seismicity, gas, ground uplift) are most reliable",
        "Why some eruptions become explosive while others stay effusive",
        "How ash, lava, and volcanic gases affect climate, health, and infrastructure",
      ];
    }
    if (theme === "black-hole") {
      return [
        "How a black hole forms from stellar collapse and mass threshold",
        "What the event horizon changes for light, time, and information",
        "How accretion disks and jets make black holes observable",
        "How scientists estimate black-hole mass from orbit and radiation data",
      ];
    }
    if (theme === "photosynthesis") {
      return [
        "How light reactions convert photon energy into ATP and NADPH",
        "How the Calvin cycle stores carbon into sugars step by step",
        "Which factors (light, CO2, temperature) limit photosynthesis first",
        "How photosynthesis links plant growth, food webs, and carbon balance",
      ];
    }
    if (theme === "tide") {
      return [
        "How Moon-Sun gravity creates periodic high and low tides",
        "Why spring tides and neap tides differ in range",
        "How coastline shape and seabed depth amplify local tide height",
        "How tides influence navigation safety, ecosystems, and energy use",
      ];
    }
    if (theme === "tectonics") {
      return [
        "How plate boundaries control earthquake and volcano distribution",
        "How stress accumulates and releases along active faults",
        "How subduction, collision, and rifting shape landforms differently",
        "How tectonic evidence is measured with seismic and GPS data",
      ];
    }
    if (theme === "inflation") {
      return [
        "How demand-pull and cost-push inflation follow different mechanisms",
        "How inflation changes real wages, savings value, and household budgets",
        "How CPI is built and why different baskets show different inflation views",
        "How rate policy transmits from central banks to jobs and consumption",
      ];
    }
    if (theme === "immune") {
      return [
        "How innate immunity reacts within hours before adaptive response starts",
        "How B cells and T cells coordinate targeted pathogen elimination",
        "How vaccines build memory cells without causing full disease",
        "How chronic inflammation differs from short protective inflammation",
      ];
    }
    if (theme === "dna") {
      return [
        "How DNA replication maintains accuracy and where mutations arise",
        "How transcription and translation convert genes into proteins",
        "How dominant and recessive inheritance appears across generations",
        "How gene variants influence disease risk and treatment response",
      ];
    }
    if (theme === "printing") {
      return [
        "How movable type changed speed, cost, and scale of knowledge spread",
        "How printing innovation reshaped education and scientific communication",
        "How East-West printing paths differed in materials and workflow",
        "How printing technology evolved from manual press to modern systems",
      ];
    }
    if (theme === "electrolysis") {
      return [
        "How ion migration at anode/cathode drives electrolysis reactions",
        "How voltage, concentration, and electrode material change product yield",
        "How Faraday's law predicts output mass from current and time",
        "How electrolysis is applied in hydrogen production and metal refining",
      ];
    }
    return [
      `${topic}: formation conditions and trigger thresholds`,
      `${topic}: first-changing signal and measurable key variables`,
      `${topic}: step-by-step mechanism chain from cause to outcome`,
      `${topic}: one data-backed real-world case and practical implication`,
    ];
  }

  if (lowSignalInput) {
    return [
      "板块运动如何共同决定地震和火山的空间分布",
      "黑洞的事件视界为什么会改变光与时间的行为",
      "免疫系统如何识别病原体并避免攻击自身细胞",
      "深海生物如何适应高压、低温与弱光环境",
    ];
  }

  if (theme === "volcano") {
    return [
      "岩浆房压力如何累积到触发喷发阈值",
      "地震活动、火山气体和地表隆起哪些最能预警喷发",
      "爆炸式喷发和溢流式喷发的触发条件有什么差别",
      "火山灰、熔岩和火山气体分别会造成哪些连锁影响",
    ];
  }
  if (theme === "black-hole") {
    return [
      "恒星坍缩到什么质量条件才会形成黑洞",
      "事件视界对光、时间和信息传递意味着什么",
      "吸积盘和喷流如何帮助我们间接观测黑洞",
      "科学家如何用轨道和辐射数据估算黑洞质量",
    ];
  }
  if (theme === "photosynthesis") {
    return [
      "光反应如何把光能转成 ATP 和 NADPH",
      "卡尔文循环如何把二氧化碳固定成糖",
      "光照、温度和 CO2 浓度谁最先限制光合作用效率",
      "光合作用如何影响食物链和碳循环平衡",
    ];
  }
  if (theme === "tide") {
    return [
      "月球和太阳引力如何形成周期性的涨潮与落潮",
      "大潮和小潮为什么会出现明显潮差",
      "海岸线形状和水深如何放大局地潮位变化",
      "潮汐变化如何影响航运、沿海生态与潮汐能利用",
    ];
  }
  if (theme === "tectonics") {
    return [
      "板块边界类型如何决定地震和火山分布",
      "断层应力如何累积并在地震中瞬时释放",
      "俯冲、碰撞与张裂三类构造会形成哪些不同地貌",
      "地震波和 GPS 数据如何用于板块运动监测",
    ];
  }
  if (theme === "inflation") {
    return [
      "需求拉动型和成本推动型通胀的机制区别",
      "通胀如何影响工资购买力、储蓄实际价值和预算结构",
      "CPI 的构成与统计口径为什么会影响通胀感知",
      "加息政策如何传导到消费、就业和企业融资",
    ];
  }
  if (theme === "immune") {
    return [
      "先天免疫与适应性免疫在时间和作用上的分工",
      "B 细胞和 T 细胞如何协同识别并清除病原体",
      "疫苗如何在不致病的前提下建立免疫记忆",
      "急性炎症和慢性炎症在风险和意义上有何区别",
    ];
  }
  if (theme === "dna") {
    return [
      "DNA 复制如何保证高保真并减少突变累积",
      "转录与翻译如何把基因信息转为蛋白质功能",
      "显性与隐性遗传在家系中如何呈现分布规律",
      "基因变异如何影响疾病风险与个体化治疗",
    ];
  }
  if (theme === "printing") {
    return [
      "活字印刷如何改变知识传播速度与成本结构",
      "印刷术如何推动教育普及与科学交流",
      "中西方印刷技术路线在材料与工艺上的差异",
      "从手工排印到现代印刷的关键技术演进",
    ];
  }
  if (theme === "electrolysis") {
    return [
      "电解过程中阴极与阳极分别发生哪些反应",
      "电压、溶液浓度和电极材料如何影响产物选择",
      "法拉第定律如何用于计算电解产物质量",
      "电解在制氢和金属精炼中的典型应用路径",
    ];
  }
  return [
    `${topic}的形成条件与关键触发阈值`,
    `${topic}中最先变化的可观测指标与核心变量`,
    `${topic}从起因到结果的机制链路拆解`,
    `${topic}在现实中的一个数据化案例及实际影响`,
  ];
}

function detectIntent(
  prompt: string,
  sources: HomeSourceItem[],
): { intent: WorkspaceIntent; confidence: number; reason: string } {
  const text = normalizeText(prompt);
  const scores: Record<Exclude<WorkspaceIntent, "unknown">, number> = {
    ppt: 0,
    video: 0,
    poster: 0,
  };

  if (containsAny(text, ["ppt", "幻灯", "课件", "演示"])) {
    scores.ppt += 4;
  }
  if (containsAny(text, ["视频", "口播", "配音", "短片", "剪辑"])) {
    scores.video += 4;
  }
  if (containsAny(text, ["海报", "长图", "poster", "封面", "图文卡片"])) {
    scores.poster += 4;
  }

  if (containsAny(text, ["10页", "12页", "每页"])) {
    scores.ppt += 2;
  }
  if (containsAny(text, ["分镜", "镜头", "音轨", "tts", "时长"])) {
    scores.video += 2;
  }
  if (containsAny(text, ["尺寸", "9:16", "4:5", "1:1", "a4"])) {
    scores.poster += 2;
  }

  sources.forEach((source) => {
    const sourceText = normalizeText(`${source.name} ${source.origin}`);
    if (source.kind === "youtube") {
      scores.video += 3;
    }
    if (/\.pptx?|课件/.test(sourceText)) {
      scores.ppt += 2;
    }
    if (/\.mp4|\.mov|视频/.test(sourceText)) {
      scores.video += 2;
    }
    if (/\.png|\.jpg|\.jpeg|\.webp|海报|封面|长图/.test(sourceText)) {
      scores.poster += 2;
    }
  });

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  const second = sorted[1];
  const topScore = top?.[1] ?? 0;
  const secondScore = second?.[1] ?? 0;

  if (topScore <= 0) {
    return {
      intent: "unknown",
      confidence: 0.2,
      reason: "没有检测到明确输出类型关键词。",
    };
  }

  if (topScore < 3 || topScore - secondScore <= 1) {
    return {
      intent: "unknown",
      confidence: clamp(0.35 + topScore * 0.08, 0.35, 0.62),
      reason: "检测到多种可能输出方向，需要进一步确认。",
    };
  }

  const intent = top[0] as Exclude<WorkspaceIntent, "unknown">;
  const confidence = clamp(0.5 + (topScore - secondScore) * 0.08 + topScore * 0.03, 0.58, 0.95);
  return {
    intent,
    confidence,
    reason: `已根据关键词和素材类型判断为${intent === "ppt" ? "PPT" : intent === "video" ? "视频" : "海报"}生成。`,
  };
}

function inferRecommendedIntent(
  prompt: string,
  sources: HomeSourceItem[],
): "ppt" | "video" | "poster" {
  const text = normalizeText(prompt);
  if (containsAny(text, ["海报", "长图", "poster", "封面"])) {
    return "poster";
  }
  if (containsAny(text, ["视频", "口播", "分镜", "短片"]) || sources.some((item) => item.kind === "youtube")) {
    return "video";
  }
  return "ppt";
}

function extractTopic(prompt: string, sources: HomeSourceItem[], outputLanguage: OutputLanguage) {
  const trimmed = cleanTopicText(prompt) || prompt.trim();
  if (trimmed) {
    const cleaned = trimmed
      .replace(/^(please|help me|can you|i want to|need to|请|帮我|麻烦|我想|需要)?\s*(generate|create|make|build|生成|制作|做|创建)?/i, "")
      .replace(/(a|an|one|一个|一份|一套|一个关于)/gi, "")
      .replace(/(的)?(ppt|slides?|video|poster|infographic|长图|视频|海报).*/i, "")
      .replace(/[，。；,.]/g, " ")
      .trim();
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 26);
    }
    return trimmed.slice(0, 26);
  }
  const source = sources[0];
  if (source) {
    return source.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 26);
  }
  return isChineseLanguage(outputLanguage) ? "知识主题" : "Knowledge Topic";
}

function isWeakPrompt(prompt: string, sources: HomeSourceItem[]) {
  const text = prompt.trim().toLowerCase();
  if (sources.length > 0) {
    return false;
  }
  if (!text) {
    return true;
  }
  if (text.length <= 2) {
    return true;
  }
  const weakPatterns = [
    /^hello\b/,
    /^hi\b/,
    /^hey\b/,
    /^hello world\b/,
    /^test\b/,
    /^你好\b/,
    /^在吗\b/,
    /^测试\b/,
    /^开始\b/,
  ];
  if (weakPatterns.some((pattern) => pattern.test(text))) {
    return true;
  }
  const tokenCount = text
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  if (tokenCount <= 2 && text.length < 20) {
    return true;
  }
  return false;
}

function topicHintText(value: string, outputLanguage: OutputLanguage) {
  return value.trim() || (isChineseLanguage(outputLanguage) ? "知识主题" : "Knowledge Topic");
}

function extractPageCount(prompt: string) {
  const match = prompt.match(/(\d+)\s*(页|pages?|slides?)/i);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return clamp(Math.round(value), 6, 24);
}

function extractVideoStoryboardCount(prompt: string) {
  const text = normalizeText(prompt);
  const storyboardMatch = text.match(/(\d+)\s*(个?分镜|frames?|scenes?)/i);
  if (storyboardMatch) {
    const value = Number(storyboardMatch[1]);
    if (Number.isFinite(value) && value > 0) {
      return clamp(Math.round(value), 6, 24);
    }
  }
  const durationMatch = text.match(/(\d+)\s*秒/);
  if (durationMatch) {
    const seconds = Number(durationMatch[1]);
    if (Number.isFinite(seconds) && seconds > 0) {
      return clamp(Math.max(1, Math.round(seconds / 10)), 6, 24);
    }
  }
  return null;
}

function extractPosterSize(prompt: string) {
  const text = normalizeText(prompt);
  if (text.includes("9:21") || text.includes("longportrait")) {
    return "poster-9-16";
  }
  if (text.includes("9:16")) {
    return "poster-9-16";
  }
  if (text.includes("2:3") || text.includes("4:5") || text.includes("a4")) {
    return "poster-3-4";
  }
  if (text.includes("4:3")) {
    return "poster-4-3";
  }
  if (text.includes("3:4")) {
    return "poster-3-4";
  }
  if (text.includes("1:1") || text.includes("方图") || text.includes("square")) {
    return "poster-1-1";
  }
  if (text.includes("16:9") || text.includes("横版") || text.includes("landscape")) {
    return "poster-16-9";
  }
  if (text.includes("竖版") || text.includes("手机全屏") || text.includes("portrait")) {
    return "poster-9-16";
  }
  return null;
}

function buildMissingHints(
  intent: WorkspaceIntent,
  prompt: string,
  posterSizeId: string | null,
  outputLanguage: OutputLanguage,
) {
  const hints: string[] = [];
  const text = normalizeText(prompt);
  const isZh = isChineseLanguage(outputLanguage);
  const hasStyle = containsAny(text, [
    "风格",
    "语气",
    "视觉",
    "简洁",
    "生动",
    "专业",
    "图解",
    "style",
    "tone",
    "visual",
    "clean",
    "professional",
  ]);

  if (intent === "unknown") {
    hints.push(
      isZh ? "你想生成哪种内容：PPT、视频，还是海报" : "Choose an output type: PPT, video, or poster.",
    );
    return hints;
  }
  if (intent === "ppt") {
    if (!extractPageCount(prompt)) {
      hints.push(isZh ? "建议补充页数（例如：10页）" : "Add slide count (e.g. 10 slides).");
    }
    if (!hasStyle) {
      hints.push(isZh ? "建议补充风格偏好（例如：图解化、简洁）" : "Add a style preference (e.g. clean, explanatory).");
    }
  }
  if (intent === "video") {
    if (!containsAny(text, ["分镜", "秒", "时长", "frame", "scene", "seconds"])) {
      hints.push(
        isZh ? "建议补充分镜数量（按每个分镜 10 秒估算）" : "Add storyboard count (estimated at ~10 seconds per frame).",
      );
    }
    if (!containsAny(text, ["口播", "旁白", "配音", "节奏", "narration", "voiceover", "pace"])) {
      hints.push(isZh ? "建议补充口播或节奏偏好" : "Add narration or pacing preference.");
    }
  }
  if (intent === "poster") {
    if (!posterSizeId) {
      hints.push(
        isZh
          ? "请选择海报尺寸（1:1 / 9:16 / 16:9 / 4:3 / 3:4）"
          : "Choose poster size (1:1 / 9:16 / 16:9 / 4:3 / 3:4).",
      );
    }
    if (!hasStyle) {
      hints.push(isZh ? "建议补充文案风格（例如：专业、简洁、生动）" : "Add content tone (e.g. professional, concise, vivid).");
    }
  }
  return hints;
}

function buildGenericOutline(topic: string, intent: WorkspaceIntent, count: number, outputLanguage: OutputLanguage) {
  if (!isChineseLanguage(outputLanguage)) {
    const pptSeed = [
      `${topic}: core question and learning objective`,
      `${topic}: practical context and use cases`,
      `${topic}: key concepts to understand first`,
      `${topic}: mechanism path from trigger to outcome`,
      `${topic}: critical variables and transmission path`,
      `${topic}: major types and contrasts`,
      `${topic}: one explainable real-world case`,
      `${topic}: impact at personal, industry, and system levels`,
      `${topic}: common misconceptions and corrections`,
      `${topic}: summary and next actions`,
    ];
    const videoSeed = [
      `${topic}: opening hook and tension`,
      `${topic}: context scene that viewers can relate to`,
      `${topic}: mechanism breakdown part 1`,
      `${topic}: mechanism breakdown part 2`,
      `${topic}: before vs after contrast`,
      `${topic}: real-world case frame`,
      `${topic}: concise conclusion`,
      `${topic}: actionable next step`,
    ];
    const defaultSeed = [
      `What is ${topic}?`,
      `Context and background of ${topic}`,
      `Core mechanism of ${topic}`,
      `Impact and application of ${topic}`,
    ];
    const seed = intent === "video" ? videoSeed : intent === "ppt" ? pptSeed : defaultSeed;
    if (count <= seed.length) {
      return seed.slice(0, count);
    }
    const extra = Array.from(
      { length: count - seed.length },
      (_, idx) => `${topic}: advanced extension ${idx + 1}`,
    );
    return [...seed, ...extra];
  }
  const pptSeed = [
    `${topic}的核心问题与学习目标`,
    `${topic}在现实中的典型场景`,
    `${topic}需要先理解的关键概念`,
    `${topic}的机制链路：触发条件到结果`,
    `${topic}的关键变量与变化路径`,
    `${topic}的常见类型与对比差异`,
    `${topic}案例拆解：一个可复述的真实情境`,
    `${topic}影响评估：个人、行业与系统层面`,
    `${topic}常见误区与纠偏方法`,
    `${topic}总结与行动建议`,
  ];
  const videoSeed = [
    `${topic}开场钩子：一句话提出冲突`,
    `${topic}场景建立：观众可感知的变化`,
    `${topic}机制拆解①：第一层因果`,
    `${topic}机制拆解②：关键变量如何传导`,
    `${topic}对比视角：变化前后差异`,
    `${topic}案例镜头：真实情境复现`,
    `${topic}结论收束：可执行判断`,
    `${topic}行动建议：下一步怎么做`,
  ];
  const defaultSeed = [
    `${topic}是什么`,
    `${topic}的背景与场景`,
    `${topic}的关键机制`,
    `${topic}的影响与应用`,
  ];
  const seed = intent === "video" ? videoSeed : intent === "ppt" ? pptSeed : defaultSeed;
  if (count <= seed.length) {
    return seed.slice(0, count);
  }
  const extra = Array.from({ length: count - seed.length }, (_, idx) => `${topic}进阶补充：扩展主题 ${idx + 1}`);
  return [...seed, ...extra];
}

function buildGenericSlides(
  topic: string,
  outline: string[],
  intent: WorkspaceIntent,
  outputLanguage: OutputLanguage,
) {
  if (!isChineseLanguage(outputLanguage)) {
    return outline.map((title, index) => {
      if (intent === "video") {
        return {
          page: index + 1,
          title,
          body: [
            `Narration objective: explain "${title}" within ~10 seconds and keep one clear conclusion.`,
            "Narration order: start from an observable scene, then explain the mechanism, then close with one practical takeaway.",
            "On-screen text rule: keep captions to one short line (ideally <= 8 words) to avoid tiny text and preserve readability.",
          ].join("\n"),
          visual: `Visual direction: centered main subject + one directional cue (arrow/contrast); frame ${index + 1} should focus on one change only, with high-contrast labels.`,
        };
      }
      return {
        page: index + 1,
        title,
        body: [
          `Core explanation: define "${title}" in one precise sentence and anchor it in a real context.`,
          "Mechanism breakdown: explain why it happens, which variable changes first, and how the effect propagates.",
          "Practical example: provide one concrete scenario and end with one learner-facing takeaway.",
        ].join("\n"),
        visual: `Layout suggestion: title + 3 key bullets + 1 supporting diagram; slide ${index + 1} should keep one dominant conclusion and avoid text overload.`,
      };
    });
  }
  return outline.map((title, index) => {
    if (intent === "video") {
      return {
        page: index + 1,
        title,
        body: [
          `口播目标：在约 10 秒内讲清“${title}”，并落到一个明确结论。`,
          "口播顺序：先说可观察现象，再解释机制，再给一个可执行判断。",
          "字幕规则：每镜头只保留 1 行关键词（建议 8 字以内），避免小字堆叠影响观看。",
        ].join("\n"),
        visual: `画面建议：主体居中 + 单一箭头或对比元素；第 ${index + 1} 镜头只突出一个关键变化，标签高对比、少装饰。`,
      };
    }
    return {
      page: index + 1,
      title,
      body: [
        `讲解目标：围绕“${title}”先给定义或现象，让读者在 5 秒内进入主题。`,
        "机制说明：解释关键变量如何变化、为何会导致当前结果，并指出容易混淆的点。",
        "应用收束：给一个生活化或行业化案例，最后用一句话总结本页核心结论。",
      ].join("\n"),
      visual: `版式建议：标题 + 3 要点 + 1 个示意图；第 ${index + 1} 页突出单一结论，避免信息分散与文本堆叠。`,
    };
  });
}

function makePptDensitySlides(slides: SlideDraft[]) {
  return slides.map((slide) => ({
    ...slide,
    body: slide.body.trim(),
  }));
}

function makeVideoDensitySlides(slides: SlideDraft[]) {
  return slides.map((slide) => ({
    ...slide,
    body: slide.body.trim(),
    visual: slide.visual.replace(/，/g, "、"),
  }));
}

function parseContentEditCommand(input: string, outputLanguage: OutputLanguage): ParsedContentEditCommand {
  const raw = input.trim();
  const normalized = normalizeText(raw);
  const isZh = isChineseLanguage(outputLanguage);
  const slideMatch = raw.match(/(?:第\s*)?(\d+)\s*(页|段|个分镜|slide|slides|frame|frames|scene|scenes)/i);
  const posterMatch = raw.match(/(?:第\s*)?(\d+)\s*(张|poster|posters)/i);
  const target: ParsedContentEditCommand["target"] = slideMatch
    ? { kind: "slide", index: Number(slideMatch[1]) - 1 }
    : posterMatch
      ? { kind: "poster", index: Number(posterMatch[1]) - 1 }
      : { kind: "all" };

  if (containsAny(normalized, ["缩短", "简化", "精简", "短一点", "shorten", "concise", "trim"])) {
    return { target, action: "shorten", payload: raw };
  }
  if (containsAny(normalized, ["更生动", "趣味", "案例", "口语化", "vivid", "engaging", "add case"])) {
    return { target, action: "enhance", payload: raw };
  }
  if (!isZh && containsAny(normalized, ["rewrite", "update", "expand", "polish"])) {
    return { target, action: "append", payload: raw };
  }
  return { target, action: "append", payload: raw };
}

function buildPosterDraft(
  topic: string,
  sizeLabel: string | undefined,
  prompt: string,
  outputLanguage: OutputLanguage,
): PosterDraft {
  if (!isChineseLanguage(outputLanguage)) {
    const vivid = /vivid|engaging|story|playful/i.test(prompt);
    const formal = /professional|rigorous|formal|academic/i.test(prompt);
    const tone = vivid ? "More vivid" : formal ? "More professional" : "Clear and concise";
    return {
      headline: `${topic}: key mechanism and practical impact`,
      subtitle: tone,
      body: `${topic} can directly influence real-world decisions and tradeoffs. A practical explanation usually starts from observable signals, then shows the mechanism path and downstream impact.`,
      points: [
        `Start with one observable phenomenon related to ${topic}.`,
        "Explain the mechanism with a short causal chain and one key variable.",
        "Add a realistic case to improve understanding and retention.",
        "Close with one actionable takeaway for the audience.",
      ],
      cta: "Save this visual for a quick review.",
      size: sizeLabel,
      visualType: "Causal flow diagram",
      layoutSuggestion: "Headline on top, mechanism chain in the center, takeaway at the bottom.",
      visualElements: ["observable signal", "causal arrows", "key variable marker", "practical takeaway"],
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
      body: "通货膨胀会直接改变你的日常开销。比如去年 20 元能买到一份午餐，今年可能需要 24 元；同样预算下，买到的东西更少，这就是购买力下降。",
      points: [
        "菜价、外卖、交通费用上涨最先被感知。",
        "工资增速跟不上物价时，家庭可支配收入会被压缩。",
        "存款利率低于通胀率时，钱的实际价值会被慢慢稀释。",
        "家庭预算会向刚需倾斜，非必要消费被延后。",
      ],
      cta: "学会看 CPI，优先保留刚需预算，减少冲动消费。",
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

function hasAbstractPosterDraft(draft: PosterDraft, outputLanguage: OutputLanguage) {
  if (!isChineseLanguage(outputLanguage)) {
    const body = draft.body.replace(/\s+/g, "").toLowerCase();
    const abstractBody = /write|draft|first|then|finally|structure|expand|supplement|suggest/.test(body);
    const abstractPoint = draft.points.some((point) =>
      /write|draft|first|then|finally|structure|expand|supplement|suggest/.test(
        point.replace(/\s+/g, "").toLowerCase(),
      ),
    );
    return abstractBody || abstractPoint;
  }
  const body = draft.body.replace(/\s+/g, "");
  const abstractBody =
    /问题引入|机制解释|关键结论|写作结构|用一句话|拆解原理|建议补充|展开|可感知场景|先给一个可观察现象/.test(
      body,
    );
  const templateBody =
    /围绕|先.*再.*最后|便于|用于|建议|可执行结论|可观察现象|直接绘制|图文内容|结构化/.test(body);
  const abstractPoint = draft.points.some((point) =>
    /用一句话|解释背后|拆解|给出|建议补充|写作|结构|关键原因\d|供给端变化|需求端变化|外部冲击|现象：|原因：|结论：|提示：|补充指标/.test(
      point.replace(/\s+/g, ""),
    ),
  );
  return abstractBody || templateBody || abstractPoint;
}

function pickSmartStyle(prompt: string, sources: HomeSourceItem[]) {
  return pickSmartStyleByIntent(prompt, sources, "poster");
}

function pickSmartStyleByIntent(
  prompt: string,
  sources: HomeSourceItem[],
  intent: Exclude<WorkspaceIntent, "unknown">,
) {
  const bag = normalizeText(`${prompt} ${sources.map((item) => `${item.name} ${item.excerpt}`).join(" ")}`);
  const intentRankWeight: Record<StyleDirection, number> = {
    poster: 12,
    ppt: 12,
    video: 12,
  };
  const typeSignalWeight = 3;
  const baseScore = 1;

  let best = styleOptions[0];
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const style of styleOptions) {
    let score = baseScore;

    const intentRank = style.carrierPriority.indexOf(intent);
    if (intentRank >= 0) {
      score += (style.carrierPriority.length - intentRank) * intentRankWeight[intent];
    }

    for (const keyword of style.topicKeywords) {
      if (bag.includes(normalizeText(keyword))) {
        score += typeSignalWeight;
      }
    }

    if (score > bestScore) {
      best = style;
      bestScore = score;
    }
  }

  return best;
}

function readHomeDraftPayload() {
  const empty = {
    prompt: "",
    sources: [] as HomeSourceItem[],
    models: null as { textModel: string; imageModel: string } | null,
    project: null as {
      projectId: string;
      projectTraceId: string;
      projectUserId: string;
      projectTitle: string;
    } | null,
  };

  if (typeof window === "undefined") {
    return empty;
  }

  const raw =
    window.sessionStorage.getItem(HOME_DRAFT_KEY) ||
    window.localStorage.getItem(WORKSPACE_DRAFT_CACHE_KEY);
  if (!raw) {
    return empty;
  }

  try {
    const payload = JSON.parse(raw) as HomeDraftPayload;
    const normalizedSources: HomeSourceItem[] = Array.isArray(payload.sources)
      ? payload.sources
          .filter((item): item is HomeSourceItem => Boolean(item && typeof item === "object"))
          .map((item, idx): HomeSourceItem => {
            const normalizedKind: HomeSourceKind =
              item.kind === "youtube" || item.kind === "web" || item.kind === "podcast"
                ? item.kind
                : "file";
            return {
              id: (item.id || `source-${idx}`).toString(),
              kind: normalizedKind,
              name: (item.name || "Untitled Source").toString(),
              origin: (item.origin || "").toString(),
              status: item.status,
              excerpt: (item.excerpt || "").toString(),
              contentText: (item.contentText || "").toString(),
              errorMessage: item.errorMessage ?? null,
              errorCode: item.errorCode ?? null,
              progress: typeof item.progress === "number" ? item.progress : undefined,
            };
          })
          .filter((item) => item.status === "ready")
          .slice(0, 6)
      : [];
    const next = {
      prompt: (payload.prompt ?? "").trim(),
      sources: normalizedSources,
      models:
        payload.textModel || payload.imageModel
          ? {
              textModel: payload.textModel ?? "gpt-4.1",
            imageModel: payload.imageModel ?? "gpt-image2",
          }
          : null,
      project:
        payload.project &&
        typeof payload.project === "object" &&
        (payload.project.projectId || payload.project.projectTraceId)
          ? {
              projectId: (payload.project.projectId || "").trim(),
              projectTraceId: (payload.project.projectTraceId || "").trim(),
              projectUserId: (payload.project.projectUserId || "").trim(),
              projectTitle: (payload.project.projectTitle || "").trim(),
            }
          : null,
    };
    window.localStorage.setItem(WORKSPACE_DRAFT_CACHE_KEY, JSON.stringify(payload));
    return next;
  } catch {
    return empty;
  }
}

function buildWorkspaceSessionScopeKey(entry: { prompt: string; sources: HomeSourceItem[] }) {
  const base = `${entry.prompt}|${entry.sources.map((item) => `${item.kind}:${item.origin}`).join("|")}`;
  let hash = 0;
  for (let i = 0; i < base.length; i += 1) {
    hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
  }
  return `${WORKSPACE_SESSION_PREFS_KEY}:${hash.toString(16)}`;
}

function formatSourceItemsForChat(sources: HomeSourceItem[]) {
  if (!sources.length) {
    return "";
  }
  return sources
    .map((item, index) => {
      const typeLabel =
        item.kind === "youtube"
          ? "YouTube"
          : item.kind === "podcast"
            ? "Podcast"
            : item.kind === "web"
              ? "Web"
              : "File";
      const origin = item.origin?.trim() ? item.origin.trim() : "N/A";
      return `${index + 1}. ${item.name} (${typeLabel})\n   ${origin}`;
    })
    .join("\n");
}

function readWorkspaceSessionPrefs(scopeKey: string) {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.sessionStorage.getItem(scopeKey);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as Partial<WorkspaceSessionPrefs>;
  } catch {
    return null;
  }
}

function buildWorkspaceChatHistoryStorageKey(scopeKey: string) {
  return `${WORKSPACE_CHAT_HISTORY_KEY}:${scopeKey}`;
}

function normalizeChatHistory(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((item) => item && typeof item === "object")
    .map((item, index) => {
      const turn = item as Partial<ChatTurn>;
      const role = turn.role === "assistant" ? "assistant" : "user";
      const moduleName = typeof turn.module === "string" ? turn.module.slice(0, 120) : "Workspace";
      const content = typeof turn.content === "string" ? turn.content.slice(0, 8000) : "";
      return {
        id: typeof turn.id === "string" && turn.id ? turn.id : `restored-${index}`,
        role,
        module: moduleName,
        content,
        meta:
          turn.meta && typeof turn.meta === "object"
            ? (turn.meta as ChatTurnMeta)
            : undefined,
      } satisfies ChatTurn;
    })
    .filter((turn) => turn.content.trim().length > 0);
}

function readWorkspaceChatHistory(scopeKey: string) {
  if (typeof window === "undefined") {
    return [] as ChatTurn[];
  }
  const key = buildWorkspaceChatHistoryStorageKey(scopeKey);
  const raw = window.sessionStorage.getItem(key) || window.localStorage.getItem(key);
  if (!raw) {
    return [] as ChatTurn[];
  }
  try {
    return normalizeChatHistory(JSON.parse(raw)).slice(-160);
  } catch {
    return [] as ChatTurn[];
  }
}

function writeWorkspaceChatHistory(scopeKey: string, updates: ChatTurn[]) {
  if (typeof window === "undefined") {
    return;
  }
  const key = buildWorkspaceChatHistoryStorageKey(scopeKey);
  const safeMeta = (meta: ChatTurnMeta | undefined) => {
    if (!meta || typeof meta !== "object") {
      return undefined;
    }
    if (meta.kind === "llm_error") {
      return {
        kind: "llm_error" as const,
        source: "draft_generation" as const,
        code: typeof meta.code === "string" ? meta.code.slice(0, 120) : undefined,
        retryable: meta.retryable !== false,
      };
    }
    if (meta.kind === "image_error") {
      return {
        kind: "image_error" as const,
        source: "image_generation" as const,
        code: typeof meta.code === "string" ? meta.code.slice(0, 120) : undefined,
        taskIndex: Number.isFinite(meta.taskIndex) ? Number(meta.taskIndex) : undefined,
        retryable: meta.retryable !== false,
      };
    }
    return undefined;
  };
  const payload = JSON.stringify(
    updates
      .slice(-160)
      .map((item) => ({
        id: item.id,
        role: item.role,
        module: item.module,
        content: item.content,
        meta: safeMeta(item.meta),
      })),
  );
  window.sessionStorage.setItem(key, payload);
  window.localStorage.setItem(key, payload);
}

export default function WorkspacePage() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const currentEmail = session?.user?.email?.trim().toLowerCase() ?? "";
  const [initialEntry] = useState(() => readHomeDraftPayload());
  const [sessionPrefsScopeKey] = useState(() => buildWorkspaceSessionScopeKey(initialEntry));
  const [sessionPrefs] = useState(() => readWorkspaceSessionPrefs(sessionPrefsScopeKey));
  const [topicContextPrompt, setTopicContextPrompt] = useState(() => initialEntry.prompt);
  const [creditVersion, setCreditVersion] = useState(0);
  const credits = useMemo(() => {
    void creditVersion;
    return getCreditRecords(currentEmail)[0]?.balance ?? 80;
  }, [currentEmail, creditVersion]);
  const isFreeUser = useMemo(() => {
    const subscription = getSubscriptionByUser(currentEmail);
    if (!subscription) {
      return true;
    }
    return !(subscription.status === "active" || subscription.status === "canceling");
  }, [currentEmail]);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [updates, setUpdates] = useState<ChatTurn[]>(() => {
    const history = readWorkspaceChatHistory(sessionPrefsScopeKey);
    if (!initialEntry.sources.length) {
      return history;
    }
    if (history.some((item) => item.module === "Source Inputs")) {
      return history;
    }
    return [
      ...history,
      {
        id: `source-${Date.now()}`,
        role: "assistant",
        module: "Source Inputs",
        content: `Attached sources:\n${formatSourceItemsForChat(initialEntry.sources)}`,
      },
    ];
  });
  const updatesRef = useRef<ChatTurn[]>(updates);
  const retryingErrorTurnIdsRef = useRef<Record<string, boolean>>({});
  const [chatInput, setChatInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [selectedTopicSuggestion, setSelectedTopicSuggestion] = useState<string | null>(null);
  const [topicSuggestionLocked, setTopicSuggestionLocked] = useState(false);
  const [lockedTopicSuggestion, setLockedTopicSuggestion] = useState<string | null>(null);
  const [topicSuggestionLockReason, setTopicSuggestionLockReason] = useState<"selected" | "manual_retry" | null>(null);
  const [generationTaskStateByIndex, setGenerationTaskStateByIndex] = useState<Record<number, GenerationTaskUiState>>({});
  const [generationConfirmError, setGenerationConfirmError] = useState<string | null>(null);
  const [retryingErrorTurnIds, setRetryingErrorTurnIds] = useState<Record<string, boolean>>({});
  const [creditsPaywallOpen, setCreditsPaywallOpen] = useState(false);

  const [manualIntent, setManualIntent] = useState<Exclude<WorkspaceIntent, "unknown"> | null>(
    sessionPrefs?.intent === "ppt" || sessionPrefs?.intent === "video" || sessionPrefs?.intent === "poster"
      ? sessionPrefs.intent
      : "poster",
  );
  const [posterSizeId, setPosterSizeId] = useState<string | null>(() =>
    normalizePosterSizeId(
      sessionPrefs?.posterSizeId ?? extractPosterSize(initialEntry.prompt) ?? "poster-9-16",
    ) ?? "poster-9-16",
  );
  const [posterCount, setPosterCount] = useState(() =>
    clamp(sessionPrefs?.posterCount ?? 1, 1, 10),
  );
  const [pptPageCount, setPptPageCount] = useState(() =>
    clamp(sessionPrefs?.pptPageCount ?? extractPageCount(initialEntry.prompt) ?? 10, 6, 24),
  );
  const [pptRatio, setPptRatio] = useState<"16:9" | "4:3">(() => {
    if (sessionPrefs?.pptRatio === "16:9" || sessionPrefs?.pptRatio === "4:3") {
      return sessionPrefs.pptRatio;
    }
    const text = normalizeText(initialEntry.prompt);
    if (text.includes("4:3")) {
      return "4:3";
    }
    return "16:9";
  });
  const [videoStoryboardCount, setVideoStoryboardCount] = useState<number>(() => {
    return clamp(sessionPrefs?.videoStoryboardCount ?? extractVideoStoryboardCount(initialEntry.prompt) ?? 6, 6, 24);
  });
  const [videoRatio, setVideoRatio] = useState<"16:9" | "9:16">(() => {
    if (sessionPrefs?.videoRatio === "16:9" || sessionPrefs?.videoRatio === "9:16") {
      return sessionPrefs.videoRatio;
    }
    const text = normalizeText(initialEntry.prompt);
    if (text.includes("9:16")) {
      return "9:16";
    }
    return "16:9";
  });

  const [flowStage, setFlowStage] = useState<FlowStage>("intent");
  const [selectedStyleId, setSelectedStyleId] = useState(() => {
    const preferredId = sessionPrefs?.styleId;
    if (preferredId && styleOptions.some((item) => item.id === preferredId)) {
      return preferredId;
    }
    return pickSmartStyle(initialEntry.prompt, initialEntry.sources).id;
  });
  const [billingConfirmed, setBillingConfirmed] = useState(false);
  const [isPlanningNextStep, setIsPlanningNextStep] = useState(false);
  const [isPlanningStyleStep, setIsPlanningStyleStep] = useState(false);
  const [isPlanningBillingStep, setIsPlanningBillingStep] = useState(false);
  const [configConfirmed, setConfigConfirmed] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [mobileWorkspaceView, setMobileWorkspaceView] = useState<"chat" | "canvas">("chat");
  const [confirmedConfigSnapshot, setConfirmedConfigSnapshot] = useState<ConfirmedConfigSnapshot | null>(null);

  const [thinkingState, setThinkingState] = useState<{
    active: boolean;
    module: string;
    text: string;
  }>({
    active: false,
    module: "",
    text: "",
  });
  const [isExportingPpt, setIsExportingPpt] = useState(false);
  const [isComposingVideo, setIsComposingVideo] = useState(false);
  const posterDraftRequestRef = useRef(0);

  const modeActionsRef = useRef<{
    exportPpt: () => void;
    downloadVideo: () => void;
  }>({
    exportPpt: () => {},
    downloadVideo: () => {},
  });
  const storyboardPanelRef = useRef<HTMLElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const projectIdRef = useRef<string | null>(null);
  const projectTraceIdRef = useRef<string | null>(null);

  const logClientEvent = useCallback(
    (input: {
      category: string;
      action: string;
      status?: "ok" | "error" | "info";
      source?: string;
      code?: string;
      message?: string;
      details?: unknown;
      projectId?: string | null;
      projectTraceId?: string | null;
    }) => {
      void fetch("/api/telemetry/client-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category: input.category,
          action: input.action,
          status: input.status ?? "info",
          source: input.source,
          code: input.code,
          message: input.message,
          projectId: input.projectId ?? projectIdRef.current ?? undefined,
          details: {
            ...(input.details && typeof input.details === "object"
              ? (input.details as Record<string, unknown>)
              : {}),
            projectTraceId: input.projectTraceId ?? projectTraceIdRef.current ?? undefined,
          },
        }),
      }).catch(() => undefined);
    },
    [],
  );

  useEffect(() => {
    if (initialEntry.project?.projectId) {
      projectIdRef.current = initialEntry.project.projectId;
    }
    if (initialEntry.project?.projectTraceId) {
      projectTraceIdRef.current = initialEntry.project.projectTraceId;
    }
  }, [initialEntry.project]);

  const openCreditsPaywall = useCallback(() => {
    setCreditsPaywallOpen(true);
  }, []);
  const openMembershipFromWorkspace = useCallback(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("membership:return-path", pathname || "/workspace");
      window.sessionStorage.setItem(MEMBERSHIP_SOURCE_KEY, "workspace_credits");
    }
    router.push("/membership");
  }, [pathname, router]);

  const entryPrompt = initialEntry.prompt;
  const contextPrompt = topicContextPrompt;
  const entrySources = initialEntry.sources;
  const sourcePromptContext = useMemo(
    () =>
      entrySources
        .map((item, index) => {
          const sourceText = (item.contentText || item.excerpt || "").trim();
          if (!sourceText) {
            return "";
          }
          const clipped = sourceText.slice(0, 2400);
          return `Source ${index + 1} (${item.kind} · ${item.name}):\n${clipped}`;
        })
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 12000),
    [entrySources],
  );
  const draftPrompt = useMemo(() => {
    if (!sourcePromptContext) {
      return contextPrompt;
    }
    const topicLine = contextPrompt.trim() || "Please process the uploaded source content.";
    return `${topicLine}\n\n[Source content]\n${sourcePromptContext}`;
  }, [contextPrompt, sourcePromptContext]);
  const sourceLanguageSeed = useMemo(
    () => entrySources.map((item) => `${item.name} ${item.contentText || item.excerpt}`).join("\n"),
    [entrySources],
  );
  const outputLanguage = useMemo(
    () =>
      resolveOutputLanguage({
        userPrompt: contextPrompt,
        sourceText: sourceLanguageSeed,
        fallback: "en",
      }),
    [contextPrompt, sourceLanguageSeed],
  );
  const uiLanguage: "en" | "zh" = "en";
  const isZhOutput = false;
  const tr = (en: string, _zh: string) => en;

  const detectedIntent = useMemo(
    () => detectIntent(contextPrompt, entrySources),
    [contextPrompt, entrySources],
  );
  const [weakPromptResolved, setWeakPromptResolved] = useState(() => !isWeakPrompt(initialEntry.prompt, initialEntry.sources));
  const weakPrompt = useMemo(
    () => isWeakPrompt(contextPrompt, entrySources) && !weakPromptResolved,
    [contextPrompt, entrySources, weakPromptResolved],
  );
  const recommendedIntent = useMemo(
    () => inferRecommendedIntent(contextPrompt, entrySources),
    [contextPrompt, entrySources],
  );
  const effectiveIntent: WorkspaceIntent = manualIntent ?? detectedIntent.intent;
  const topic = useMemo(
    () => extractTopic(contextPrompt, entrySources, outputLanguage),
    [contextPrompt, entrySources, outputLanguage],
  );
  const posterSizeLabel = useMemo(
    () => posterSizeOptions.find((item) => item.id === posterSizeId)?.label,
    [posterSizeId],
  );
  const missingHints = useMemo(
    () => buildMissingHints(effectiveIntent, contextPrompt, posterSizeId, outputLanguage),
    [effectiveIntent, contextPrompt, posterSizeId, outputLanguage],
  );
  const shouldClarifyIntent = weakPrompt || effectiveIntent === "unknown" || detectedIntent.confidence < 0.58;
  const waitingTopicSuggestionConfirm = weakPrompt;
  const showPosterSizeSelector = effectiveIntent === "poster" && !posterSizeId;
  const canProceed = configConfirmed && !showPosterSizeSelector;
  const showDirectionGuide = flowStage === "intent" || flowStage === "config";
  const showStyleStage = flowStage === "style";
  const showBillingConfirm = flowStage === "billing";
  const showBillingRecord = flowStage === "billing" || flowStage === "generate";
  const showStoryboard = flowStage === "generate" && (effectiveIntent === "ppt" || effectiveIntent === "video");
  const showPosterCanvas = flowStage === "generate" && effectiveIntent === "poster";
  const hasCanvasPanel = showStoryboard || showPosterCanvas;
  const showChatPanelInLayout = !isMobileViewport || !hasCanvasPanel || mobileWorkspaceView === "chat";
  const showCanvasPanelInLayout = hasCanvasPanel && (!isMobileViewport || mobileWorkspaceView === "canvas");
  const targetSectionCount =
    effectiveIntent === "poster" ? posterCount : effectiveIntent === "video" ? videoStoryboardCount : pptPageCount;

  const baseOutlineItems = useMemo(() => {
    if (effectiveIntent !== "ppt" && effectiveIntent !== "video") {
      return [] as string[];
    }
    if (/火山/.test(topic)) {
      if (targetSectionCount <= volcanoOutlineItems.length) {
        return volcanoOutlineItems.slice(0, targetSectionCount);
      }
      const extra = buildGenericOutline(
        topic,
        effectiveIntent,
        targetSectionCount - volcanoOutlineItems.length,
        outputLanguage,
      ).map(
        (item, idx) => `${volcanoOutlineItems.length + idx + 1}. ${item}`,
      );
      return [...volcanoOutlineItems, ...extra.map((item) => item.replace(/^\d+\.\s*/, ""))];
    }
    return buildGenericOutline(topic, effectiveIntent, targetSectionCount, outputLanguage);
  }, [effectiveIntent, outputLanguage, targetSectionCount, topic]);

  const baseSlideDrafts = useMemo(() => {
    if (effectiveIntent !== "ppt" && effectiveIntent !== "video") {
      return [] as SlideDraft[];
    }
    if (/火山/.test(topic)) {
      const base = volcanoSlideDrafts.slice(0, targetSectionCount).map((item) => ({ ...item }));
      if (base.length >= targetSectionCount) {
        return base;
      }
      const extraOutline = buildGenericOutline(topic, effectiveIntent, targetSectionCount - base.length, outputLanguage);
      const extraSlides = buildGenericSlides(topic, extraOutline, effectiveIntent, outputLanguage).map((slide, idx) => ({
        ...slide,
        page: base.length + idx + 1,
      }));
      return [...base, ...extraSlides];
    }
    return buildGenericSlides(topic, baseOutlineItems, effectiveIntent, outputLanguage);
  }, [effectiveIntent, baseOutlineItems, outputLanguage, targetSectionCount, topic]);

  const basePosterDraft = useMemo(() => {
    if (effectiveIntent !== "poster" || showPosterSizeSelector) {
      return null;
    }
    return buildPosterDraft(topic, posterSizeLabel, contextPrompt, outputLanguage);
  }, [contextPrompt, effectiveIntent, outputLanguage, posterSizeLabel, showPosterSizeSelector, topic]);

  const summaryText = useMemo(() => {
    if (!contextPrompt && !entrySources.length) {
      return tr(
        "No source content yet. Enter a topic directly, or go back to Home and upload files, webpages, or YouTube links.",
        "你还没有传入素材。可以直接输入主题，或返回首页上传文件、网页链接、YouTube 链接。",
      );
    }
    const sourcePart = entrySources.length
      ? tr(`I received ${entrySources.length} source item(s). `, `我收到了 ${entrySources.length} 条素材。`)
      : tr("Current input is text-only. ", "当前是纯文本输入。");
    const intentPart = shouldClarifyIntent
      ? tr("Your request is still incomplete. I need to confirm the output direction first.", "你的需求还不够完整，我先和你确认一下生成方向。")
      : tr("I recognized your output direction and prepared the base configuration.", "我已识别你的目标方向，并完成基础配置。");
    if (manualIntent === "ppt") {
      return isZhOutput
        ? `${sourcePart}${intentPart} 默认按 ${pptPageCount} 页、${pptRatio} 比例生成。`
        : `${sourcePart}${intentPart} Default: ${pptPageCount} slides at ${pptRatio}.`;
    }
    if (manualIntent === "video") {
      return isZhOutput
        ? `${sourcePart}${intentPart} 默认按 ${videoStoryboardCount} 个分镜（约 ${
            videoStoryboardCount * 10
          } 秒）、${videoRatio} 比例生成。`
        : `${sourcePart}${intentPart} Default: ${videoStoryboardCount} storyboard frames (~${
            videoStoryboardCount * 10
          }s) at ${videoRatio}.`;
    }
    if (manualIntent === "poster") {
      const sizeLabel = posterSizeOptions.find((item) => item.id === posterSizeId)?.label ?? tr("Size not selected", "未选尺寸");
      return isZhOutput
        ? `${sourcePart}${intentPart} 默认生成 ${posterCount} 张，尺寸 ${sizeLabel}。`
        : `${sourcePart}${intentPart} Default: ${posterCount} poster(s), size ${sizeLabel}.`;
    }
    return `${sourcePart}${intentPart}`;
  }, [
    contextPrompt,
    entrySources.length,
    isZhOutput,
    manualIntent,
    posterCount,
    posterSizeId,
    pptPageCount,
    pptRatio,
    shouldClarifyIntent,
    tr,
    videoStoryboardCount,
    videoRatio,
  ]);

  const analysisText = useMemo(() => {
    if (weakPrompt) {
      return tr(
        "I still need a clear topic before generation. Tell me what you want to explain, or choose an output direction first.",
        "我还没有收到可用于生成的明确主题。你可以告诉我想讲解什么知识点，或先选择生成方向，我会给你一版可直接继续的草稿。",
      );
    }
    if (!contextPrompt && !entrySources.length) {
      return tr(
        "I have not received a clear request yet. Choose an output direction first and I will guide the configuration.",
        "我还没有收到明确需求。你可以先选择生成方向，我会引导你补齐配置并开始生成。",
      );
    }
    return tr(
      `I understood the topic "${topicHintText(topic, outputLanguage)}". Next, choose output direction and confirm configuration to generate structured content.`,
      `我已理解主题“${topicHintText(topic, outputLanguage)}”。接下来请选择生成方向并确认配置，我会据此生成对应的结构化内容。`,
    );
  }, [contextPrompt, entrySources.length, outputLanguage, topic, tr, weakPrompt]);

  const basePosterPlanList = useMemo(() => {
    if (effectiveIntent !== "poster" || !basePosterDraft || !configConfirmed) {
      return [] as PosterPlanItem[];
    }
    const base = isZhOutput
      ? [
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
        ]
      : [
          { title: `${topic} · Core question`, focus: "Frame the central question in one line." },
          { title: `${topic} · Key mechanism`, focus: "Explain the mechanism with clear causality." },
          { title: `${topic} · Conclusion and use case`, focus: "Summarize takeaway and practical use." },
          { title: `${topic} · Quick review`, focus: "Provide a high-density recap version." },
          { title: `${topic} · Real-world case`, focus: "Add one realistic case to improve retention." },
          { title: `${topic} · Misconceptions`, focus: "Clarify common misconceptions and correct framing." },
          { title: `${topic} · Visual summary`, focus: "Compress key insights into visual conclusions." },
          { title: `${topic} · Extended reading`, focus: "Add extension questions and exploration paths." },
          { title: `${topic} · Comparison view`, focus: "Use contrast to reinforce critical differences." },
          { title: `${topic} · Final recap`, focus: "Finish with a one-screen complete review." },
        ];
    const list = Array.from({ length: posterCount }, (_, idx) => base[idx % base.length]);
    return list.map((item, idx) => ({
      index: idx + 1,
      title: item.title,
      focus: item.focus,
    }));
  }, [basePosterDraft, configConfirmed, effectiveIntent, isZhOutput, posterCount, topic]);

  const [editableOutlineItems, setEditableOutlineItems] = useState<string[]>([]);
  const [editableSlideDrafts, setEditableSlideDrafts] = useState<SlideDraft[]>([]);
  const [editablePosterDraft, setEditablePosterDraft] = useState<PosterDraft | null>(null);
  const [editablePosterPlanList, setEditablePosterPlanList] = useState<PosterPlanItem[]>([]);

  const outlineItems = editableOutlineItems.length ? editableOutlineItems : baseOutlineItems;
  const slideDrafts = editableSlideDrafts.length ? editableSlideDrafts : baseSlideDrafts;
  const densityAdjustedSlideDrafts = useMemo(() => {
    if (effectiveIntent === "video") {
      return makeVideoDensitySlides(slideDrafts);
    }
    if (effectiveIntent === "ppt") {
      return makePptDensitySlides(slideDrafts);
    }
    return slideDrafts;
  }, [effectiveIntent, slideDrafts]);
  const posterDraftRaw = editablePosterDraft ?? basePosterDraft;
  const posterDraft =
    posterDraftRaw && hasAbstractPosterDraft(posterDraftRaw, outputLanguage)
      ? buildPosterDraft(topic, posterSizeLabel, contextPrompt, outputLanguage)
      : posterDraftRaw;
  const selectedStyle =
    styleOptions.find((style) => style.id === selectedStyleId) ?? styleOptions[0];
  const visualizationRecommendation = useMemo(() => {
    if (!configConfirmed || effectiveIntent === "unknown") {
      return null;
    }
    return getVisualizationRecommendation({
      direction: effectiveIntent,
      topic,
      userPrompt: contextPrompt,
    });
  }, [configConfirmed, contextPrompt, effectiveIntent, topic]);
  const visualizationTypeHint = posterDraft?.visualType || visualizationRecommendation?.label || null;

  const standardOutputCount =
    effectiveIntent === "poster"
      ? posterCount
      : effectiveIntent === "ppt"
        ? pptPageCount
        : effectiveIntent === "video"
          ? videoStoryboardCount
          : 0;
  const draftOutputCharCount = useMemo(() => {
    if (effectiveIntent === "poster" && posterDraft) {
      const posterText = [
        posterDraft.headline,
        posterDraft.subtitle,
        posterDraft.body,
        posterDraft.points.join(" "),
      ]
        .filter(Boolean)
        .join(" ");
      return posterText.length;
    }
    if (effectiveIntent === "ppt" || effectiveIntent === "video") {
      const outlineText = outlineItems.join(" ");
      const slidesText = densityAdjustedSlideDrafts
        .map((slide) => `${slide.title} ${slide.body} ${slide.visual}`)
        .join(" ");
      return `${outlineText} ${slidesText}`.trim().length;
    }
    return 0;
  }, [densityAdjustedSlideDrafts, effectiveIntent, outlineItems, posterDraft]);
  const outputTokenEstimate = Math.max(1, Math.ceil(draftOutputCharCount / 4));
  const languageModelCredits = Math.max(1, Math.ceil(outputTokenEstimate / 1000));
  const imageModelCredits = standardOutputCount * STANDARD_OUTPUT_PROMO_CREDITS;
  const billingCost = languageModelCredits + imageModelCredits;
  const imageGenerationTasks = useMemo(() => {
    const isChineseOutput = isChineseLanguage(outputLanguage);
    const styleName = selectedStyle.englishName ?? selectedStyle.name;
    const stylePrompt = selectedStyle.prompt.trim();
    const posterPlanList = editablePosterPlanList.length ? editablePosterPlanList : basePosterPlanList;
    const languageRule = isChineseOutput
      ? "Language rule: Render all visible text in Simplified Chinese only. Do not mix with English."
      : "Language rule: Render all visible text in English only. Do not use Chinese.";
    const promptFieldLabels = isChineseOutput
      ? {
          style: "风格提示",
          outputType: "输出类型",
          aspectRatio: "画面比例",
          title: "标题",
          content: "内容",
          visualHint: "视觉提示",
        }
      : {
          style: "Style prompt",
          outputType: "Output type",
          aspectRatio: "Aspect ratio",
          title: "Title",
          content: "Content",
          visualHint: "Visual hint",
        };

    const createComposedPrompt = (task: Omit<ImageGenerationTask, "composedPrompt">) =>
      [
        `${promptFieldLabels.style}: ${task.stylePrompt}`,
        `${promptFieldLabels.outputType}: ${task.outputType}`,
        `${promptFieldLabels.aspectRatio}: ${task.aspectRatio}`,
        `${promptFieldLabels.title}: ${task.contentTitle}`,
        `${promptFieldLabels.content}:`,
        task.contentBody,
        `${promptFieldLabels.visualHint}: ${task.visualHint}`,
        languageRule,
      ].join("\n");

    if (effectiveIntent === "poster" && posterDraft) {
      const aspectRatio = posterSizeLabel || "9:16";
      return Array.from({ length: Math.max(1, posterCount) }, (_, idx) => {
        const plan = posterPlanList[idx];
        const contentTitle = posterCount === 1
          ? posterDraft.headline
          : `${plan?.title || posterDraft.headline} (${idx + 1}/${posterCount})`;
        const contentBody = [
          posterDraft.subtitle,
          posterDraft.body,
          plan?.focus ? (isChineseOutput ? `聚焦要点：${plan.focus}` : `Focus: ${plan.focus}`) : "",
          posterDraft.points.length
            ? isChineseOutput
              ? `关键要点：${posterDraft.points.join(" | ")}`
              : `Key points: ${posterDraft.points.join(" | ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n");
        const visualHint = [
          posterDraft.visualType || "",
          posterDraft.layoutSuggestion || "",
          posterDraft.visualElements?.join(", ") || "",
        ]
          .filter(Boolean)
          .join(" · ");
        const baseTask: Omit<ImageGenerationTask, "composedPrompt"> = {
          index: idx + 1,
          outputType: "poster",
          aspectRatio,
          styleId: selectedStyle.id,
          styleName,
          stylePrompt,
          contentTitle,
          contentBody,
          visualHint,
        };
        return {
          ...baseTask,
          composedPrompt: createComposedPrompt(baseTask),
        } satisfies ImageGenerationTask;
      });
    }

    if (effectiveIntent === "ppt" || effectiveIntent === "video") {
      const requestedCount = effectiveIntent === "ppt" ? pptPageCount : videoStoryboardCount;
      const aspectRatio = effectiveIntent === "ppt" ? pptRatio : videoRatio;
      return Array.from({ length: Math.max(1, requestedCount) }, (_, idx) => {
        const slide = densityAdjustedSlideDrafts[idx];
        const contentTitle =
          slide?.title?.trim() ||
          outlineItems[idx]?.trim() ||
          `${effectiveIntent === "ppt" ? "Slide" : "Frame"} ${idx + 1}`;
        const contentBody = slide?.body?.trim() || outlineItems[idx]?.trim() || contextPrompt;
        const visualHint = slide?.visual?.trim() || "";
        const baseTask: Omit<ImageGenerationTask, "composedPrompt"> = {
          index: idx + 1,
          outputType: effectiveIntent === "ppt" ? "ppt" : "video",
          aspectRatio,
          styleId: selectedStyle.id,
          styleName,
          stylePrompt,
          contentTitle,
          contentBody,
          visualHint,
        };
        return {
          ...baseTask,
          composedPrompt: createComposedPrompt(baseTask),
        } satisfies ImageGenerationTask;
      });
    }

    return [] as ImageGenerationTask[];
  }, [
    basePosterPlanList,
    contextPrompt,
    densityAdjustedSlideDrafts,
    editablePosterPlanList,
    effectiveIntent,
    outlineItems,
    posterCount,
    posterDraft,
    posterSizeLabel,
    pptPageCount,
    pptRatio,
    selectedStyle.englishName,
    selectedStyle.id,
    selectedStyle.name,
    selectedStyle.prompt,
    outputLanguage,
    videoRatio,
    videoStoryboardCount,
  ]);
  const canConfirmBilling = credits >= billingCost;
  const lockedCanvasMode: "free" | "ppt" = effectiveIntent === "ppt" ? "ppt" : "free";
  const imageGenerationTaskByIndex = useMemo(() => {
    return new Map(imageGenerationTasks.map((task) => [task.index, task] as const));
  }, [imageGenerationTasks]);
  const imageModel = initialEntry.models?.imageModel || "gpt-image2";
  const buildGenerationRequestPayload = useCallback(
    (tasks: ImageGenerationTask[]) => ({
      intent: effectiveIntent,
      projectId: projectIdRef.current ?? undefined,
      projectTraceId: projectTraceIdRef.current ?? undefined,
      outputs: standardOutputCount,
      style: {
        id: selectedStyle.id,
        name: selectedStyle.englishName ?? selectedStyle.name,
        prompt: selectedStyle.prompt,
      },
      ratio:
        effectiveIntent === "poster"
          ? posterSizeLabel || "9:16"
          : effectiveIntent === "ppt"
            ? pptRatio
            : videoRatio,
      imageModel,
      tasks,
    }),
    [
      effectiveIntent,
      imageModel,
      posterSizeLabel,
      pptRatio,
      selectedStyle.englishName,
      selectedStyle.id,
      selectedStyle.name,
      selectedStyle.prompt,
      standardOutputCount,
      videoRatio,
    ],
  );
  const runGenerationBatch = useCallback(
    async (tasks: ImageGenerationTask[], isRetry = false) => {
      if (!tasks.length) {
        return;
      }

      const maxAttempts = GENERATION_MAX_RETRY_ATTEMPTS;
      const pendingTaskMap = new Map(tasks.map((task) => [task.index, task]));
      let attempt = 0;
      let lastError: string | null = null;

      setGenerationConfirmError(null);
      setGenerationTaskStateByIndex((prev) => {
        const next = { ...prev };
        tasks.forEach((task) => {
          next[task.index] = {
            index: task.index,
            status: isRetry ? "retrying" : "queued",
            attempts: 0,
            maxAttempts,
          };
        });
        return next;
      });

      while (attempt < maxAttempts && pendingTaskMap.size > 0) {
        const currentTasks = [...pendingTaskMap.values()];
        for (const task of currentTasks) {
          if (!pendingTaskMap.has(task.index)) {
            continue;
          }

          setGenerationTaskStateByIndex((prev) => ({
            ...prev,
            [task.index]: {
              ...(prev[task.index] ?? {
                index: task.index,
                status: "queued",
                attempts: 0,
                maxAttempts,
              }),
              status: attempt === 0 ? "generating" : "retrying",
              attempts: attempt + 1,
              maxAttempts,
              error: undefined,
            },
          }));

          const controller = new AbortController();
          const timeoutId = window.setTimeout(() => controller.abort(), GENERATION_REQUEST_TIMEOUT_MS);
          try {
            const response = await fetch("/api/workspace/generation-confirm", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(buildGenerationRequestPayload([task])),
              signal: controller.signal,
            });
            const payload = (await response.json().catch(() => null)) as GenerationConfirmResponse | null;
            if (!response.ok) {
              const failureMessage = payload?.error || `generation confirm failed (${response.status})`;
              const nonRetryable = response.status >= 400 && response.status < 500;
              logClientEvent({
                category: "image",
                action: "image_generation_request_failed",
                status: "error",
                source: imageModel,
                code: String(response.status),
                message: failureMessage,
                details: {
                  taskIndex: task.index,
                  statusCode: response.status,
                  payload,
                },
              });
              if (nonRetryable) {
                pendingTaskMap.delete(task.index);
                lastError = failureMessage;
                setGenerationTaskStateByIndex((prev) => ({
                  ...prev,
                  [task.index]: {
                    index: task.index,
                    status: "failed",
                    attempts: attempt + 1,
                    maxAttempts,
                    error: failureMessage,
                  },
                }));
                upsertImageErrorCard(task, failureMessage);
                continue;
              }
              throw new Error(failureMessage);
            }

            const result = (payload?.generation?.results ?? []).find(
              (item) => Number(item.index ?? 0) === task.index,
            );
            const resolvedImageUrl =
              (typeof result?.imageUrl === "string" && result.imageUrl.trim()) ||
              (typeof result?.rawImageUrl === "string" && result.rawImageUrl.trim()) ||
              "";

            if ((result?.ok || resolvedImageUrl) && resolvedImageUrl) {
              pendingTaskMap.delete(task.index);
              removeImageErrorCardByTaskIndex(task.index);
              setGenerationTaskStateByIndex((prev) => ({
                ...prev,
                [task.index]: {
                  index: task.index,
                  status: "success",
                  attempts: attempt + 1,
                  maxAttempts,
                  imageUrl: resolvedImageUrl,
                },
              }));
              logClientEvent({
                category: "image",
                action: "image_generation_success",
                status: "ok",
                source: imageModel,
                message: "Image generation completed successfully.",
                projectId: projectIdRef.current ?? null,
                details: {
                  taskIndex: task.index,
                  imageUrl: resolvedImageUrl,
                  outputType: task.outputType,
                },
              });
            } else {
              const nextError = result?.errorCode
                ? `${result.error || tr("Generation failed.", "生成失败。")} (${result.errorCode})`
                : result?.error || tr("Generation failed.", "生成失败。");
              const nonRetryableErrorCode = (result?.errorCode || "").toUpperCase();
              const shouldStopRetry =
                nonRetryableErrorCode === "IMAGE_PROVIDER_KEY_MISSING" ||
                nonRetryableErrorCode === "GENERATION_TASKS_REQUIRED";
              lastError = nextError || lastError;
              logClientEvent({
                category: "image",
                action: "image_generation_result_failed",
                status: "error",
                source: imageModel,
                code: result?.errorCode || undefined,
                message: nextError || tr("Generation failed.", "生成失败。"),
                projectId: projectIdRef.current ?? null,
                details: {
                  taskIndex: task.index,
                  result,
                  outputType: task.outputType,
                },
              });
              upsertImageErrorCard(task, nextError || tr("Generation failed.", "生成失败。"));
              if (shouldStopRetry) {
                pendingTaskMap.delete(task.index);
                setGenerationTaskStateByIndex((prev) => ({
                  ...prev,
                  [task.index]: {
                    index: task.index,
                    status: "failed",
                    attempts: attempt + 1,
                    maxAttempts,
                    error: nextError || tr("Generation failed.", "生成失败。"),
                  },
                }));
              }
            }
          } catch (error) {
            lastError =
              error instanceof DOMException && error.name === "AbortError"
                ? tr("Generation timed out.", "生成超时。")
                : error instanceof Error
                  ? error.message
                  : tr("Generation failed.", "生成失败。");
            logClientEvent({
              category: "image",
              action: "image_generation_exception",
              status: "error",
              source: imageModel,
              message: lastError || tr("Generation failed.", "生成失败。"),
              projectId: projectIdRef.current ?? null,
              details: {
                taskIndex: task.index,
                outputType: task.outputType,
                stack: error instanceof Error ? error.stack : undefined,
              },
            });
            upsertImageErrorCard(task, lastError || tr("Generation failed.", "生成失败。"));
          } finally {
            window.clearTimeout(timeoutId);
          }
        }

        if (attempt < maxAttempts - 1) {
          const delay = GENERATION_RETRY_DELAYS_MS[Math.min(attempt, GENERATION_RETRY_DELAYS_MS.length - 1)];
          await new Promise((resolve) => window.setTimeout(resolve, delay));
        }
        attempt += 1;
      }

      if (pendingTaskMap.size > 0) {
        const finalError = lastError || tr("Generation failed.", "生成失败。");
        pendingTaskMap.forEach((task) => {
          upsertImageErrorCard(task, finalError);
        });
        setGenerationTaskStateByIndex((prev) => {
          const next = { ...prev };
          pendingTaskMap.forEach((task) => {
            next[task.index] = {
              index: task.index,
              status: "failed",
              attempts: maxAttempts,
              maxAttempts,
              error: finalError,
            };
          });
          return next;
        });
        setGenerationConfirmError(finalError);
      } else {
        setGenerationConfirmError(null);
      }
    },
    [buildGenerationRequestPayload, tr],
  );
  const handleRetryGenerationTask = useCallback(
    (index: number) => {
      const task = imageGenerationTaskByIndex.get(index);
      if (!task) {
        return;
      }
      void runGenerationBatch([task], true);
    },
    [imageGenerationTaskByIndex, runGenerationBatch],
  );

  const stageLabel = useMemo(() => {
    if (flowStage === "intent" || flowStage === "config") {
      return tr("Step 2/7 · Direction", "第 2/7 步 · 生成方向");
    }
    if (flowStage === "content") {
      return tr("Step 3/7 · Draft Content", "第 3/7 步 · 文稿");
    }
    if (flowStage === "style") {
      return tr("Step 4/7 · Style", "第 4/7 步 · 风格");
    }
    if (flowStage === "billing") {
      return tr("Step 5/7 · Billing", "第 5/7 步 · 账单");
    }
    if (flowStage === "generate") {
      return tr("Step 6/7 · Generate & Download", "第 6/7 步 · 生成与下载");
    }
    return tr("Step 1/7 · Input", "第 1/7 步 · 输入");
  }, [flowStage, tr]);
  const projectTitle = isZhOutput
    ? `${topicHintText(topic, outputLanguage)} · 用户意图总结`
    : `${topicHintText(topic, outputLanguage)} · Intent Summary`;
  const topicSuggestions = useMemo(() => {
    const suggestionSeed = topicContextPrompt || topic;
    return buildSpecificTopicSuggestions(suggestionSeed, outputLanguage);
  }, [outputLanguage, topic, topicContextPrompt]);

  const isHydrated = useSyncExternalStore(
    useCallback(() => () => undefined, []),
    () => true,
    () => false,
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const onWindowError = (event: ErrorEvent) => {
      logClientEvent({
        category: "frontend",
        action: "window_error",
        status: "error",
        source: "workspace",
        message: event.message || "Unhandled window error.",
        details: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error instanceof Error ? event.error.stack : undefined,
        },
      });
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const reasonText =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Unhandled promise rejection.";
      logClientEvent({
        category: "frontend",
        action: "unhandled_rejection",
        status: "error",
        source: "workspace",
        message: reasonText,
        details: {
          stack: reason instanceof Error ? reason.stack : undefined,
        },
      });
    };
    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, [logClientEvent]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!manualIntent) {
      return;
    }
    const payload: WorkspaceSessionPrefs = {
      intent: manualIntent,
      posterCount,
      posterSizeId,
      pptPageCount,
      pptRatio,
      videoStoryboardCount,
      videoRatio,
      styleId: selectedStyleId,
    };
    window.sessionStorage.setItem(sessionPrefsScopeKey, JSON.stringify(payload));
  }, [
    manualIntent,
    posterCount,
    posterSizeId,
    pptPageCount,
    pptRatio,
    selectedStyleId,
    sessionPrefsScopeKey,
    videoRatio,
    videoStoryboardCount,
  ]);

  useEffect(() => {
    updatesRef.current = updates;
    writeWorkspaceChatHistory(sessionPrefsScopeKey, updates);
  }, [sessionPrefsScopeKey, updates]);

  useEffect(() => {
    retryingErrorTurnIdsRef.current = retryingErrorTurnIds;
  }, [retryingErrorTurnIds]);

  function pushAssistantMessage(content: string, module = "内容改写") {
    setUpdates((prev) => [
      ...prev,
      {
        id: `a-${Date.now()}-${Math.round(Math.random() * 9999)}`,
        role: "assistant",
        module,
        content,
      },
    ]);
    logClientEvent({
      category: "chat",
      action: "assistant_message",
      status: "info",
      source: module,
      message: content.slice(0, 480),
      details: {
        module,
        content: content.slice(0, 4000),
      },
    });
  }

  const pushAssistantErrorMessage = useCallback((
    content: string,
    module: string,
    meta: ChatTurnMeta,
  ) => {
    const turn: ChatTurn = {
      id: `err-${Date.now()}-${Math.round(Math.random() * 9999)}`,
      role: "assistant",
      module,
      content,
      meta,
    };
    setUpdates((prev) => [...prev, turn]);
    return turn.id;
  }, []);

  const upsertAssistantErrorMessage = useCallback((
    turnId: string | null | undefined,
    content: string,
    module: string,
    meta: ChatTurnMeta,
  ) => {
    if (!turnId) {
      return pushAssistantErrorMessage(content, module, meta);
    }
    setUpdates((prev) => {
      const next = [...prev];
      const foundIndex = next.findIndex((item) => item.id === turnId);
      if (foundIndex < 0) {
        next.push({
          id: turnId,
          role: "assistant",
          module,
          content,
          meta,
        });
        return next;
      }
      next[foundIndex] = {
        ...next[foundIndex],
        role: "assistant",
        module,
        content,
        meta,
      };
      return next;
    });
    return turnId;
  }, [pushAssistantErrorMessage]);

  const removeErrorTurn = useCallback((turnId: string) => {
    setUpdates((prev) => prev.filter((item) => item.id !== turnId));
    setRetryingErrorTurnIds((prev) => {
      if (!prev[turnId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[turnId];
      return next;
    });
  }, []);

  const removeImageErrorCardByTaskIndex = useCallback((taskIndex: number) => {
    setUpdates((prev) =>
      prev.filter(
        (item) => !(item.meta?.kind === "image_error" && item.meta.taskIndex === taskIndex),
      ),
    );
  }, []);

  const parseStructuredError = useCallback((error: unknown): StructuredWorkspaceError => {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        userMessage: "The request timed out. Please retry.",
        code: "LM_TIMEOUT",
      };
    }
    const message = error instanceof Error ? error.message : "Unknown request error.";
    const codeMatch = message.match(/\b([A-Z][A-Z0-9_]{2,})\b/);
    return {
      userMessage: message,
      code: codeMatch?.[1],
    };
  }, []);

  const upsertImageErrorCard = useCallback((task: ImageGenerationTask, errorText: string) => {
    const codeMatch = errorText.match(/\(([A-Z0-9_:-]+)\)\s*$/);
    const code = codeMatch?.[1] ?? undefined;
    const nextMessage = `Image ${task.index} failed to generate. ${errorText}`;
    setUpdates((prev) => {
      const next = [...prev];
      const foundIndex = next.findIndex(
        (item) => item.meta?.kind === "image_error" && item.meta.taskIndex === task.index,
      );
      const nextTurn: ChatTurn = {
        id:
          foundIndex >= 0
            ? next[foundIndex].id
            : `err-img-${task.index}-${Date.now()}-${Math.round(Math.random() * 9999)}`,
        role: "assistant",
        module: "Image Generation Error",
        content: nextMessage,
        meta: {
          kind: "image_error",
          source: "image_generation",
          code,
          taskIndex: task.index,
          retryable: true,
        },
      };
      if (foundIndex >= 0) {
        next[foundIndex] = nextTurn;
      } else {
        next.push(nextTurn);
      }
      return next;
    });
  }, []);

  function pushUserMessage(content: string, module = "内容改写") {
    setUpdates((prev) => [
      ...prev,
      {
        id: `u-${Date.now()}-${Math.round(Math.random() * 9999)}`,
        role: "user",
        module,
        content,
      },
    ]);
    logClientEvent({
      category: "chat",
      action: "user_message",
      status: "info",
      source: module,
      message: content.slice(0, 480),
      details: {
        module,
        content: content.slice(0, 4000),
      },
    });
  }

  function startThinking(module: string, text: string) {
    setThinkingState({ active: true, module, text });
  }

  function stopThinking() {
    setThinkingState({ active: false, module: "", text: "" });
  }

  function resetToConfigStage(_reason: "direction-change" | "config-change") {
    setConfigConfirmed(false);
    setFlowStage("config");
    setBillingConfirmed(false);
    setEditableOutlineItems([]);
    setEditableSlideDrafts([]);
    setEditablePosterDraft(null);
    setEditablePosterPlanList([]);
    setConfirmedConfigSnapshot(null);
  }

  function handleSelectIntentOption(intent: Exclude<WorkspaceIntent, "unknown">) {
    setManualIntent(intent);
    if (intent === "poster" && !posterSizeId) {
      setPosterSizeId("poster-9-16");
    }
    resetToConfigStage("direction-change");
  }

  function handleSelectTopicSuggestion(text: string) {
    if (!text || isSending || topicSuggestionLocked) {
      return;
    }
    setSelectedTopicSuggestion(text);
  }

  async function handleConfirmTopicSuggestion() {
    if (!selectedTopicSuggestion || isSending || topicSuggestionLocked) {
      return;
    }
    const text = selectedTopicSuggestion;
    setTopicSuggestionLocked(true);
    setTopicSuggestionLockReason("selected");
    setLockedTopicSuggestion(text);
    setSelectedTopicSuggestion(null);
    setTopicContextPrompt(text);
    setWeakPromptResolved(true);
    setFlowStage("intent");
    setConfigConfirmed(false);
    setBillingConfirmed(false);
    setEditableOutlineItems([]);
    setEditableSlideDrafts([]);
    setEditablePosterDraft(null);
    setEditablePosterPlanList([]);
    await handleSendInput(text, { source: "suggestion" });
  }

  function handleSelectPosterSize(sizeId: string) {
    setPosterSizeId(sizeId);
    if (configConfirmed) {
      resetToConfigStage("config-change");
      return;
    }
    setConfigConfirmed(false);
  }

  function handlePosterCountChange(count: number) {
    setPosterCount(count);
    if (configConfirmed) {
      resetToConfigStage("config-change");
      return;
    }
    setConfigConfirmed(false);
  }

  function handlePptPageCountChange(count: number) {
    setPptPageCount(count);
    if (configConfirmed) {
      resetToConfigStage("config-change");
      return;
    }
    setConfigConfirmed(false);
  }

  function handlePptRatioChange(ratio: "16:9" | "4:3") {
    setPptRatio(ratio);
    if (configConfirmed) {
      resetToConfigStage("config-change");
      return;
    }
    setConfigConfirmed(false);
  }

  function handleVideoStoryboardCountChange(count: number) {
    setVideoStoryboardCount(count);
    if (configConfirmed) {
      resetToConfigStage("config-change");
      return;
    }
    setConfigConfirmed(false);
  }

  function handleVideoRatioChange(ratio: "16:9" | "9:16") {
    setVideoRatio(ratio);
    if (configConfirmed) {
      resetToConfigStage("config-change");
      return;
    }
    setConfigConfirmed(false);
  }

  const handleConfirmConfig = useCallback(async (existingErrorTurnId?: string | null): Promise<boolean> => {
    logClientEvent({
      category: "llm",
      action: "draft_generation_started",
      status: "info",
      source: effectiveIntent,
      message: "Draft generation requested from workspace configuration.",
      details: {
        intent: effectiveIntent,
        posterCount,
        posterSizeId,
        pptPageCount,
        pptRatio,
        videoStoryboardCount,
        videoRatio,
      },
    });
    setConfigConfirmed(true);
    setFlowStage("content");
    if (manualIntent) {
      setConfirmedConfigSnapshot({
        intent: manualIntent,
        posterCount,
        posterSizeId,
        pptPageCount,
        pptRatio,
        videoStoryboardCount,
        videoRatio,
      });
    }
    startThinking(
      effectiveIntent === "poster"
        ? tr("Poster Draft", "海报文案草稿")
        : effectiveIntent === "ppt"
          ? tr("PPT Draft", "PPT 文稿草稿")
          : tr("Video Draft", "视频分镜草稿"),
      effectiveIntent === "poster"
        ? tr("Generating poster draft with the language model...", "正在调用语言模型生成海报文案草稿...")
        : effectiveIntent === "ppt"
          ? tr("Generating PPT draft with the language model...", "正在调用语言模型生成 PPT 文稿草稿...")
          : tr("Generating video storyboard draft with the language model...", "正在调用语言模型生成视频分镜草稿..."),
    );
    const thinkingStartedAt = Date.now();
    const ensureThinkingVisible = async () => {
      const minVisibleMs = 1000;
      const elapsed = Date.now() - thinkingStartedAt;
      const remaining = minVisibleMs - elapsed;
      if (remaining > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, remaining));
      }
      stopThinking();
    };

    if (effectiveIntent !== "poster") {
      let requestSucceeded = true;
      setEditableOutlineItems([]);
      setEditableSlideDrafts([]);
      setEditablePosterDraft(basePosterDraft);
      setEditablePosterPlanList(basePosterPlanList);
      try {
        const count = effectiveIntent === "ppt" ? pptPageCount : videoStoryboardCount;
        const ratioOrSize = effectiveIntent === "ppt" ? pptRatio : videoRatio;
        const response = await fetch("/api/content/poster-draft", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            topic,
            prompt: draftPrompt,
            textModel: initialEntry.models?.textModel || "gemini-2.5",
            posterCount: count,
            posterSizeLabel: ratioOrSize,
            direction: effectiveIntent,
            outputLanguage,
            draftMode: "auto",
          }),
        });
        if (!response.ok) {
          let errorMessage = `content draft request failed: ${response.status}`;
          try {
            const errData = (await response.json()) as { error?: string };
            if (errData?.error) {
              errorMessage = errData.error;
            }
          } catch {
            // ignore json parse error
          }
          throw new Error(errorMessage);
        }
        const data = (await response.json()) as {
          outlineItems?: string[];
          slideDrafts?: SlideDraft[];
          storyboardDrafts?: Array<{
            index: number;
            title: string;
            narration?: string;
            visual?: string;
          }>;
        };
        const nextOutline = Array.isArray(data.outlineItems) && data.outlineItems.length
          ? data.outlineItems.map((item) => String(item || "").trim()).filter(Boolean)
          : baseOutlineItems;
        let nextSlides: SlideDraft[] = [];
        if (effectiveIntent === "ppt" && Array.isArray(data.slideDrafts) && data.slideDrafts.length) {
          nextSlides = data.slideDrafts.map((item, idx) => ({
            page: Number.isFinite(item.page) ? item.page : idx + 1,
            title: item.title?.trim() || nextOutline[idx] || `Slide ${idx + 1}`,
            body: item.body?.trim() || "",
            visual: item.visual?.trim() || "",
          }));
        } else if (
          effectiveIntent === "video" &&
          Array.isArray(data.storyboardDrafts) &&
          data.storyboardDrafts.length
        ) {
          nextSlides = data.storyboardDrafts.map((item, idx) => ({
            page: Number.isFinite(item.index) ? item.index : idx + 1,
            title: item.title?.trim() || nextOutline[idx] || `Frame ${idx + 1}`,
            body: item.narration?.trim() || "",
            visual: item.visual?.trim() || "",
          }));
        }
        setEditableOutlineItems(nextOutline.length ? nextOutline : baseOutlineItems);
        setEditableSlideDrafts(nextSlides.length ? nextSlides : baseSlideDrafts);
        logClientEvent({
          category: "llm",
          action: "draft_generation_success",
          status: "ok",
          source: effectiveIntent,
          message: "Draft generation completed successfully.",
          details: {
            intent: effectiveIntent,
            outlineCount: nextOutline.length,
            slideCount: nextSlides.length,
          },
        });
      } catch (error) {
        requestSucceeded = false;
        setEditableOutlineItems(baseOutlineItems);
        setEditableSlideDrafts(baseSlideDrafts);
        const parsed = parseStructuredError(error);
        logClientEvent({
          category: "llm",
          action: "draft_generation_failed",
          status: "error",
          source: effectiveIntent,
          code: parsed.code,
          message: parsed.userMessage,
          details: {
            intent: effectiveIntent,
            existingErrorTurnId: existingErrorTurnId ?? null,
          },
        });
        upsertAssistantErrorMessage(
          existingErrorTurnId,
          `Language model draft generation failed. ${parsed.userMessage}`,
          "Language Model Error",
          {
            kind: "llm_error",
            source: "draft_generation",
            code: parsed.code,
            retryable: true,
          },
        );
      } finally {
        await ensureThinkingVisible();
      }
      return requestSucceeded;
    }

    const requestId = posterDraftRequestRef.current + 1;
    posterDraftRequestRef.current = requestId;
    let requestSucceeded = true;
    setEditablePosterDraft(null);
    setEditablePosterPlanList([]);
    startThinking(
      tr("Poster Draft", "海报文案草稿"),
      tr("Generating poster draft with the language model...", "正在调用语言模型生成海报文案草稿..."),
    );

    try {
      const response = await fetch("/api/content/poster-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic,
          prompt: draftPrompt,
          textModel: initialEntry.models?.textModel || "gemini-2.5",
          posterCount,
          posterSizeLabel,
          direction: effectiveIntent,
          outputLanguage,
          draftMode: "auto",
        }),
      });
      if (!response.ok) {
        let errorMessage = `poster draft request failed: ${response.status}`;
        try {
          const errData = (await response.json()) as { error?: string };
          if (errData?.error) {
            errorMessage = errData.error;
          }
        } catch {
          // ignore json parse error
        }
        throw new Error(errorMessage);
      }
      const data = (await response.json()) as {
        posterDraft?: PosterDraft;
        planList?: PosterPlanItem[];
        source?: "llm" | "fallback";
        _internal?: {
          renderSpec?: unknown;
          modelPrompt?: string;
        };
      };
      if (posterDraftRequestRef.current !== requestId) {
        return false;
      }
      setEditablePosterDraft(data.posterDraft ?? basePosterDraft);
      setEditablePosterPlanList(
        Array.isArray(data.planList) && data.planList.length ? data.planList : basePosterPlanList,
      );
      logClientEvent({
        category: "llm",
        action: "draft_generation_success",
        status: "ok",
        source: effectiveIntent,
        message: "Poster draft generation completed successfully.",
        details: {
          intent: effectiveIntent,
          planCount: Array.isArray(data.planList) ? data.planList.length : 0,
        },
      });
    } catch (error) {
      if (posterDraftRequestRef.current !== requestId) {
        return false;
      }
      requestSucceeded = false;
      setEditablePosterDraft(basePosterDraft);
      setEditablePosterPlanList(basePosterPlanList);
      const parsed = parseStructuredError(error);
      logClientEvent({
        category: "llm",
        action: "draft_generation_failed",
        status: "error",
        source: effectiveIntent,
        code: parsed.code,
        message: parsed.userMessage,
        details: {
          intent: effectiveIntent,
          requestId,
        },
      });
      upsertAssistantErrorMessage(
        existingErrorTurnId,
        `Language model draft generation failed. ${parsed.userMessage}`,
        "Language Model Error",
        {
          kind: "llm_error",
          source: "draft_generation",
          code: parsed.code,
          retryable: true,
        },
      );
    } finally {
      if (posterDraftRequestRef.current === requestId) {
        await ensureThinkingVisible();
      }
    }
    return requestSucceeded;
  }, [
    baseOutlineItems,
    basePosterDraft,
    basePosterPlanList,
    baseSlideDrafts,
    draftPrompt,
    effectiveIntent,
    initialEntry.models?.textModel,
    manualIntent,
    outputLanguage,
    parseStructuredError,
    posterCount,
    posterSizeId,
    posterSizeLabel,
    pptPageCount,
    pptRatio,
    pushAssistantErrorMessage,
    tr,
    topic,
    upsertAssistantErrorMessage,
    videoRatio,
    videoStoryboardCount,
    logClientEvent,
  ]);

  async function handleNextStep() {
    if (isPlanningNextStep) {
      return;
    }
    if (showPosterSizeSelector) {
      pushAssistantMessage(
        tr("Poster size is still missing. Please choose a size first.", "海报方向还缺少尺寸，请先选择一个尺寸后再继续。"),
        tr("Requirement Check", "需求确认"),
      );
      return;
    }
    if (!configConfirmed) {
      pushAssistantMessage(
        tr("Please confirm the current configuration before continuing.", "请先确认当前配置，再进入下一步。"),
        tr("Requirement Check", "需求确认"),
      );
      return;
    }
    const hasDraftReady =
      effectiveIntent === "poster" ? Boolean(posterDraft) : outlineItems.length > 0 || slideDrafts.length > 0;
    if (!hasDraftReady) {
      pushAssistantMessage(
        tr("Draft content is not ready yet. Please try again shortly.", "草稿内容尚未准备完成，请稍后再试。"),
        tr("Content Generation", "内容生成"),
      );
      return;
    }

    setIsPlanningNextStep(true);
    startThinking(tr("Style Matching", "风格推荐"), tr("Matching the best style for your target...", "正在理解目标并匹配最合适的风格..."));
    logClientEvent({
      category: "style",
      action: "style_stage_entered",
      status: "info",
      source: effectiveIntent,
      message: "Style recommendation stage opened.",
      projectId: projectIdRef.current ?? null,
      details: {
        intent: effectiveIntent,
      },
    });
    await new Promise((resolve) => window.setTimeout(resolve, 480));
    if (effectiveIntent === "poster" || effectiveIntent === "ppt" || effectiveIntent === "video") {
      const nextRecommendedStyle = pickSmartStyleByIntent(contextPrompt, entrySources, effectiveIntent);
      setSelectedStyleId(nextRecommendedStyle.id);
    }
    setFlowStage("style");
    stopThinking();
    setIsPlanningNextStep(false);
  }

  async function handleStyleNext() {
    if (isPlanningStyleStep) {
      return;
    }
    setIsPlanningStyleStep(true);
    startThinking(tr("Billing Check", "账单确认"), tr("Calculating generation cost and credit usage...", "正在计算生成成本与积分消耗..."));
    logClientEvent({
      category: "style",
      action: "style_selected",
      status: "ok",
      source: selectedStyle.id,
      message: "Style selection confirmed.",
      projectId: projectIdRef.current ?? null,
      details: {
        styleName: selectedStyle.englishName ?? selectedStyle.name,
        intent: effectiveIntent,
      },
    });
    await new Promise((resolve) => window.setTimeout(resolve, 420));
    setFlowStage("billing");
    setBillingConfirmed(false);
    stopThinking();
    setIsPlanningStyleStep(false);
  }

  async function handleConfirmBilling() {
    if (credits < billingCost) {
      pushAssistantMessage(
        isZhOutput
          ? `当前积分不足（余额 ${credits}，需要 ${billingCost}）。请先升级后再继续。`
          : `Insufficient credits (balance: ${credits}, required: ${billingCost}). Please upgrade first.`,
        tr("Billing Check", "账单确认"),
      );
      return;
    }
    if (isPlanningBillingStep) {
      return;
    }
    setIsPlanningBillingStep(true);
    setGenerationConfirmError(null);
    startThinking(
      effectiveIntent === "poster" ? tr("Poster Generation", "海报生成") : tr("Storyboard Generation", "分镜生成"),
      effectiveIntent === "poster"
        ? tr("Generating poster structure and draft text...", "正在生成海报结构与文案...")
        : tr("Generating storyboard structure and syncing visual/audio fields...", "正在创建分镜结构，并同步画面与音轨字段..."),
    );
    await new Promise((resolve) => window.setTimeout(resolve, 560));

    const user = currentEmail ? getAdminUserByEmail(currentEmail) : null;
    const ownerProjects = currentEmail ? getProjectsByUser(currentEmail) : [];
    const imageModel = initialEntry.models?.imageModel || "gpt-image-2";
    const selectedProject =
      (initialEntry.project?.projectId
        ? ownerProjects.find((item) => item.id === initialEntry.project?.projectId)
        : null) ??
      (initialEntry.project?.projectId
        ? {
            id: initialEntry.project.projectId,
            userId: user?.id || initialEntry.project.projectUserId || "u-unknown",
            title:
              initialEntry.project.projectTitle ||
              `${topic || "Knowledge Topic"} · ${tr("Workspace Draft", "工作区草稿")}`,
            status: "进行中" as const,
            updatedAt: new Date().toISOString(),
            format: effectiveIntent === "poster" ? "海报" : effectiveIntent === "video" ? "视频" : "PPT",
          }
        : null) ??
      ownerProjects[0] ??
      (currentEmail
        ? ensureUserProjectByEmail({
            email: currentEmail,
            name: session?.user?.name ?? undefined,
            title: `${topic || "Knowledge Topic"} · ${tr("Workspace Draft", "工作区草稿")}`,
            format: effectiveIntent === "poster" ? "海报" : effectiveIntent === "video" ? "视频" : "PPT",
          })
        : getAdminProjects()[0]);
    projectIdRef.current = selectedProject?.id ?? projectIdRef.current;
    projectTraceIdRef.current =
      initialEntry.project?.projectTraceId ||
      (projectIdRef.current && user?.id ? `${user.id}_${projectIdRef.current}` : projectTraceIdRef.current);

    appendCreditRecord({
      type: "consume",
      description: isZhOutput
        ? `${selectedProject?.title ?? "生成项目"} · ${
            effectiveIntent === "poster" ? "海报生成" : "分镜生成"
          }（语言模型 ${languageModelCredits} 积分 + 图像模型 ${imageModelCredits} 积分，图像限时 ${STANDARD_OUTPUT_PROMO_CREDITS}/标准输出，原价 ${STANDARD_OUTPUT_REGULAR_CREDITS}）`
        : `${selectedProject?.title ?? "Generation Project"} · ${
            effectiveIntent === "poster" ? "Poster Generation" : "Storyboard Generation"
          } (Language model ${languageModelCredits} credits + Image model ${imageModelCredits} credits, image limited-time ${STANDARD_OUTPUT_PROMO_CREDITS}/output, regular ${STANDARD_OUTPUT_REGULAR_CREDITS})`,
      delta: -billingCost,
      userId: user?.id,
      userEmail: currentEmail || undefined,
      projectId: selectedProject?.id,
      projectTitle: selectedProject?.title,
    }, currentEmail);
    logClientEvent({
      category: "billing",
      action: "billing_confirmed",
      status: "ok",
      source: effectiveIntent,
      message: `${selectedProject?.title ?? "project"} confirmed and consumed ${billingCost} credits.`,
      projectId: selectedProject?.id ?? null,
      details: {
        creditsBefore: credits,
        creditsAfter: Math.max(0, credits - billingCost),
        billingCost,
        effectiveIntent,
      },
    });

    setCreditVersion((prev) => prev + 1);
    setBillingConfirmed(true);

    if (effectiveIntent === "ppt" || effectiveIntent === "video") {
      setFlowStage("generate");
      requestAnimationFrame(() => {
        storyboardPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } else {
      setFlowStage("generate");
      requestAnimationFrame(() => {
        storyboardPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    logClientEvent({
      category: "image",
      action: "image_generation_started",
      status: "info",
      source: imageModel,
      message: "Generation batch started from workspace confirmation.",
      projectId: selectedProject?.id ?? null,
      details: {
        outputs: standardOutputCount,
        intent: effectiveIntent,
      },
    });
    void runGenerationBatch(imageGenerationTasks).catch((error) => {
      setGenerationConfirmError(
        error instanceof Error ? error.message : tr("Generation failed.", "生成失败。"),
      );
      logClientEvent({
        category: "image",
        action: "image_generation_batch_failed",
        status: "error",
        source: imageModel,
        message: error instanceof Error ? error.message : "Generation batch failed.",
        projectId: selectedProject?.id ?? null,
      });
    });
    stopThinking();
    setIsPlanningBillingStep(false);
  }

  async function handleSendInput(
    raw?: string,
    options?: {
      source?: "manual" | "suggestion";
    },
  ) {
    try {
      const guardResponse = await fetch("/api/workspace/chat-guard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!guardResponse.ok) {
        const data = (await guardResponse.json()) as { error?: string };
        pushAssistantMessage(
          data?.error ||
            tr(
              "Too many chat requests right now. Please retry shortly.",
              "当前对话请求过于频繁，请稍后再试。",
            ),
          tr("Request Guard", "请求保护"),
        );
        return;
      }
    } catch {
      pushAssistantMessage(
        tr(
          "Request guard is unavailable. Please retry shortly.",
          "请求保护暂时不可用，请稍后再试。",
        ),
        tr("Request Guard", "请求保护"),
      );
      return;
    }

    const value = (raw ?? chatInput).trim();
    if (!value || isSending) {
      return;
    }
    const inputSource = options?.source ?? "manual";
    logClientEvent({
      category: "chat",
      action: "chat_input_submitted",
      status: "info",
      source: inputSource,
      message: value,
      details: {
        flowStage,
        effectiveIntent,
        shouldClarifyIntent,
      },
    });
    if (inputSource === "manual" && waitingTopicSuggestionConfirm && !topicSuggestionLocked) {
      setTopicSuggestionLocked(true);
      setTopicSuggestionLockReason("manual_retry");
      setLockedTopicSuggestion(null);
      setSelectedTopicSuggestion(null);
    }
    setIsSending(true);
    setChatInput("");
    if (inputSource === "manual") {
      pushUserMessage(value, tr("User Input", "对话输入"));
    }
    startThinking(tr("Request Understanding", "需求理解"), tr("Understanding your additional instructions...", "正在理解你的补充需求..."));
    await new Promise((resolve) => window.setTimeout(resolve, 280));

    const normalized = normalizeText(value);
    const hasDirectionHint = containsAny(normalized, [
      "海报",
      "视频",
      "ppt",
      "课件",
      "分镜",
      "长图",
      "poster",
      "video",
      "slide",
      "slides",
      "storyboard",
      "infographic",
    ]);
    const isConfigCommand = containsAny(normalized, [
      "9:16",
      "16:9",
      "4:3",
      "页",
      "张",
      "尺寸",
      "比例",
      "size",
      "ratio",
      "pages",
      "slides",
      "frames",
    ]);
    const isEditCommand = containsAny(normalized, [
      "改第",
      "重写",
      "缩短",
      "更生动",
      "补充",
      "rewrite",
      "shorten",
      "concise",
      "enhance",
      "update",
      "polish",
    ]);
    const likelyTopicText = !hasDirectionHint && !isConfigCommand && !isEditCommand;

    if (likelyTopicText && (flowStage === "intent" || flowStage === "config" || shouldClarifyIntent)) {
      setTopicContextPrompt(value);
    }

    if (
      value.trim().length >= 6 ||
      containsAny(normalized, ["天文", "经济", "历史", "地理", "火山", "气候", "物理", "science", "history", "climate", "physics"])
    ) {
      setWeakPromptResolved(true);
    }

    if (weakPrompt && !hasDirectionHint) {
      if (inputSource === "suggestion") {
        stopThinking();
        setIsSending(false);
        return;
      }
      pushAssistantMessage(
        tr(
          "I can help confirm output direction first. Reply with: generate poster, generate video, or generate PPT. You can also share a concrete topic first.",
          "我先帮你确认生成方向。你可以直接回复：生成海报、生成视频，或生成PPT；也可以先告诉我具体主题。",
        ),
        tr("Requirement Check", "需求确认"),
      );
      logClientEvent({
        category: "chat",
        action: "chat_prompt_need_direction",
        status: "info",
        source: inputSource,
        message: "Weak prompt without clear direction.",
        details: {
          normalized,
        },
      });
      stopThinking();
      setIsSending(false);
      return;
    }
    if (containsAny(normalized, ["ppt", "课件", "幻灯", "slides", "slide deck"])) {
      if (manualIntent !== "ppt") {
        setManualIntent("ppt");
        resetToConfigStage("direction-change");
        pushAssistantMessage(
          tr("Switched to PPT mode. Confirm slide count and ratio to continue.", "已切换到 PPT 方向。请先确认页数和比例，我再继续生成内容。"),
          tr("Requirement Check", "需求确认"),
        );
        logClientEvent({
          category: "chat",
          action: "chat_direction_selected",
          status: "ok",
          source: "ppt",
          message: "PPT mode selected.",
          details: { normalized },
        });
      } else {
        pushAssistantMessage(
          tr("Already in PPT mode. Adjust slide count/ratio and continue.", "当前已是 PPT 方向。你可以调整页数和比例后点击下一步。"),
          tr("Requirement Check", "需求确认"),
        );
      }
      stopThinking();
      setIsSending(false);
      return;
    }
    if (containsAny(normalized, ["视频", "口播", "分镜", "video", "storyboard", "voiceover"])) {
      if (manualIntent !== "video") {
        setManualIntent("video");
        resetToConfigStage("direction-change");
        pushAssistantMessage(
          tr("Switched to video mode. Confirm storyboard count and ratio to continue.", "已切换到视频方向。请先确认分镜数量和比例，我再继续生成内容。"),
          tr("Requirement Check", "需求确认"),
        );
        logClientEvent({
          category: "chat",
          action: "chat_direction_selected",
          status: "ok",
          source: "video",
          message: "Video mode selected.",
          details: { normalized },
        });
      } else {
        pushAssistantMessage(
          tr("Already in video mode. Adjust frame count/ratio and continue.", "当前已是视频方向。你可以调整分镜数量和比例后点击下一步。"),
          tr("Requirement Check", "需求确认"),
        );
      }
      stopThinking();
      setIsSending(false);
      return;
    }
    if (containsAny(normalized, ["海报", "长图", "poster", "infographic"])) {
      if (manualIntent !== "poster") {
        setManualIntent("poster");
        resetToConfigStage("direction-change");
        pushAssistantMessage(
          tr("Switched to poster mode. Confirm poster count and size to continue.", "已切换到海报方向。请先确认张数和尺寸，我再继续生成内容。"),
          tr("Requirement Check", "需求确认"),
        );
        logClientEvent({
          category: "chat",
          action: "chat_direction_selected",
          status: "ok",
          source: "poster",
          message: "Poster mode selected.",
          details: { normalized },
        });
      } else {
        pushAssistantMessage(
          tr("Already in poster mode. Adjust count/size and continue.", "当前已是海报方向。你可以调整张数和尺寸后点击下一步。"),
          tr("Requirement Check", "需求确认"),
        );
      }
      stopThinking();
      setIsSending(false);
      return;
    }

    if (isConfigCommand && (manualIntent === "poster" || manualIntent === "video" || manualIntent === "ppt")) {
      pushAssistantMessage(
        tr(
          "Configuration intent noted. Please update settings below and click Next for best accuracy.",
          "我已记录你的配置意图。请在下方配置区直接调整后点击“下一步”，这样会更准确。",
        ),
        tr("Requirement Check", "需求确认"),
      );
      stopThinking();
      setIsSending(false);
      return;
    }

    if (shouldClarifyIntent) {
      pushAssistantMessage(
        tr("I still cannot determine the output type. Please reply with PPT, video, or poster.", "我还不能确定你要生成的类型。请直接回复：PPT、视频或海报。"),
        tr("Requirement Check", "需求确认"),
      );
      stopThinking();
      setIsSending(false);
      return;
    }

    const cmd = parseContentEditCommand(value, outputLanguage);
    if (effectiveIntent === "poster") {
      if (cmd.target.kind === "poster" && cmd.target.index >= 0 && cmd.target.index < editablePosterPlanList.length) {
        const next = [...editablePosterPlanList];
        const focusPatch =
          cmd.action === "shorten"
            ? tr("shortened", "已压缩为更短文案")
            : cmd.action === "enhance"
              ? tr("enhanced with stronger example framing", "已增强案例感与表达张力")
              : tr("updated based on your extra requirement", "已按补充要求调整");
        next[cmd.target.index] = {
          ...next[cmd.target.index],
          focus: isZhOutput
            ? `${next[cmd.target.index].focus}（${focusPatch}）`
            : `${next[cmd.target.index].focus} (${focusPatch})`,
        };
        setEditablePosterPlanList(next);
        pushAssistantMessage(
          tr(`Updated poster ${cmd.target.index + 1}.`, `已更新第 ${cmd.target.index + 1} 张海报内容。`),
          tr("Content Edit", "内容改写"),
        );
      } else if (editablePosterDraft) {
        const bodyPatch =
          cmd.action === "shorten"
            ? `${editablePosterDraft.body.slice(0, 80)}...`
            : cmd.action === "enhance"
              ? `${editablePosterDraft.body}\n\n${tr("Add a realistic case and make the tone more vivid.", "补充：加入一个真实场景案例和更生动表达。")}`
              : `${editablePosterDraft.body}\n\n${tr("Additional requirement:", "补充：")}${cmd.payload}`;
        setEditablePosterDraft({
          ...editablePosterDraft,
          body: bodyPatch,
        });
        pushAssistantMessage(
          tr("Poster draft updated.", "已更新海报文案草稿。"),
          tr("Poster Generation", "海报生成"),
        );
      }
      stopThinking();
      setIsSending(false);
      return;
    }

    if (editableSlideDrafts.length) {
      const updateSlide = (index: number) => {
        if (index < 0 || index >= editableSlideDrafts.length) {
          return false;
        }
        const next = [...editableSlideDrafts];
        const current = next[index];
        next[index] = {
          ...current,
          body:
            cmd.action === "shorten"
              ? current.body.length > 62
                ? `${current.body.slice(0, 62)}...`
                : current.body
              : cmd.action === "enhance"
                ? `${current.body} ${tr("Also add one relatable real-life analogy.", "同时加入一个贴近生活的类比示例。")}`
                : `${current.body}\n${tr("Additional requirement:", "补充要求：")}${cmd.payload}`,
        };
        setEditableSlideDrafts(next);
        pushAssistantMessage(
          tr(`Updated slide ${index + 1}.`, `已更新第 ${index + 1} 页内容。`),
          tr("Content Edit", "内容改写"),
        );
        return true;
      };

      if (cmd.target.kind === "slide") {
        if (updateSlide(cmd.target.index)) {
          stopThinking();
          setIsSending(false);
          return;
        }
      } else if (cmd.target.kind === "all") {
        setEditableSlideDrafts((prev) =>
          prev.map((slide) => ({
            ...slide,
            body:
              cmd.action === "shorten"
                ? slide.body.length > 62
                  ? `${slide.body.slice(0, 62)}...`
                  : slide.body
                : cmd.action === "enhance"
                  ? `${slide.body} ${tr("Also add one relatable real-life analogy.", "同时加入一个贴近生活的类比示例。")}`
                  : `${slide.body}\n${tr("Additional requirement:", "补充要求：")}${cmd.payload}`,
          })),
        );
        pushAssistantMessage(
          cmd.action === "shorten"
            ? tr("All slide copy has been shortened.", "已将全部页文案压缩为更短表达。")
            : cmd.action === "enhance"
              ? tr("All slide copy has been adjusted to a more vivid tone.", "已将全部页文案调整为更生动表达。")
              : tr("Your additional requirement has been applied to all slides.", "已将你的补充要求应用到全部页面。"),
          tr("Content Edit", "内容改写"),
        );
        stopThinking();
        setIsSending(false);
        return;
      }
    }

    pushAssistantMessage(
      tr(
        'Noted. You can continue with "edit slide X + instruction", and I will apply it precisely.',
        "已记录你的补充。你可以继续指定“改第几页 + 怎么改”，我会按页精确调整。",
      ),
      tr("Content Edit", "内容改写"),
    );
    stopThinking();
    setIsSending(false);
  }

  const retryLanguageModelDraftByTurn = useCallback(async (turnId: string) => {
    const target = updatesRef.current.find((item) => item.id === turnId);
    if (!target || target.meta?.kind !== "llm_error") {
      return;
    }
    if (retryingErrorTurnIdsRef.current[turnId]) {
      return;
    }
    setRetryingErrorTurnIds((prev) => ({ ...prev, [turnId]: true }));
    try {
      const ok = await handleConfirmConfig(turnId);
      if (ok) {
        removeErrorTurn(turnId);
      }
    } finally {
      setRetryingErrorTurnIds((prev) => {
        if (!prev[turnId]) {
          return prev;
        }
        const next = { ...prev };
        delete next[turnId];
        return next;
      });
    }
  }, []);

  const handleRetryErrorTurn = useCallback((turnId: string) => {
    const target = updatesRef.current.find((item) => item.id === turnId);
    if (!target?.meta) {
      return;
    }
    if (target.meta.kind === "llm_error") {
      void retryLanguageModelDraftByTurn(turnId);
      return;
    }
    if (target.meta.kind === "image_error" && Number.isFinite(target.meta.taskIndex)) {
      const taskIndex = Number(target.meta.taskIndex);
      setRetryingErrorTurnIds((prev) => ({ ...prev, [turnId]: true }));
      removeImageErrorCardByTaskIndex(taskIndex);
      handleRetryGenerationTask(taskIndex);
      window.setTimeout(() => {
        setRetryingErrorTurnIds((prev) => {
          if (!prev[turnId]) {
            return prev;
          }
          const next = { ...prev };
          delete next[turnId];
          return next;
        });
      }, 1200);
    }
  }, [handleRetryGenerationTask, retryLanguageModelDraftByTurn]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const media = window.matchMedia("(max-width: 1023px)");
    const apply = () => setIsMobileViewport(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!isMobileViewport) {
      return;
    }
    if (!hasCanvasPanel) {
      return;
    }
    window.requestAnimationFrame(() => {
      setMobileWorkspaceView((prev) => (prev === "canvas" ? prev : "canvas"));
    });
  }, [hasCanvasPanel, isMobileViewport]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const bodyStyle = document.body.style;
    const htmlStyle = document.documentElement.style;
    const previous = {
      bodyOverflow: bodyStyle.overflow,
      htmlOverflow: htmlStyle.overflow,
      bodyHeight: bodyStyle.height,
      htmlHeight: htmlStyle.height,
      bodyOverscrollBehavior: bodyStyle.overscrollBehavior,
      htmlOverscrollBehavior: htmlStyle.overscrollBehavior,
    };
    bodyStyle.overflow = "hidden";
    htmlStyle.overflow = "hidden";
    bodyStyle.height = "100%";
    htmlStyle.height = "100%";
    bodyStyle.overscrollBehavior = "none";
    htmlStyle.overscrollBehavior = "none";
    return () => {
      bodyStyle.overflow = previous.bodyOverflow;
      htmlStyle.overflow = previous.htmlOverflow;
      bodyStyle.height = previous.bodyHeight;
      htmlStyle.height = previous.htmlHeight;
      bodyStyle.overscrollBehavior = previous.bodyOverscrollBehavior;
      htmlStyle.overscrollBehavior = previous.htmlOverscrollBehavior;
    };
  }, []);

  if (!isHydrated) {
    return <div className="fixed inset-0 overflow-hidden bg-[#f7f7f8] text-zinc-800" />;
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#f7f7f8] text-zinc-800">
      <TopBar
        title={projectTitle}
        stageLabel={stageLabel}
        credits={credits}
        saveState={saveState}
        hasUnsavedChanges={hasUnsavedChanges}
        canvasMode={lockedCanvasMode}
        onDownloadPpt={
          showStoryboard && lockedCanvasMode === "ppt"
            ? () => {
                modeActionsRef.current.exportPpt();
              }
            : undefined
        }
        onDownloadVideo={
          showStoryboard && lockedCanvasMode === "free"
            ? () => {
                modeActionsRef.current.downloadVideo();
              }
            : undefined
        }
        actionsDisabled={!showStoryboard}
        isExportingPpt={isExportingPpt}
        isComposingVideo={isComposingVideo}
        showOpenCanvasButton={isMobileViewport && hasCanvasPanel && mobileWorkspaceView === "chat"}
        onOpenCanvas={() => setMobileWorkspaceView("canvas")}
      />

      <main className="mx-auto flex h-full min-h-0 max-w-none flex-col overflow-hidden px-2 pb-1 pt-16 sm:px-3">
        <div
          className={`grid min-h-0 flex-1 gap-2 ${
            hasCanvasPanel ? "lg:grid-cols-[416px_minmax(0,1fr)]" : "lg:grid-cols-1"
          }`}
        >
          <section
            className={`min-h-0 ${
              hasCanvasPanel ? "" : "lg:w-full lg:max-w-none"
            } ${showChatPanelInLayout ? "" : "hidden"} workspace-left-shell`}
          >
            <div className="flex h-full min-h-0 flex-col">
              <div
                ref={chatScrollRef}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1.5 pb-3 pt-4 lg:pr-1.5"
              >
                <ChatPanel
                  scrollContainerRef={chatScrollRef}
                  outputLanguage={uiLanguage}
                  userPrompt={entryPrompt}
                  entrySources={entrySources}
                  intent={effectiveIntent}
                  selectedIntent={manualIntent}
                  analysisText={analysisText}
                  showDirectionGuide={showDirectionGuide}
                  shouldClarifyIntent={shouldClarifyIntent}
                  showWeakPromptSuggestions={showDirectionGuide && shouldClarifyIntent && waitingTopicSuggestionConfirm}
                  topicSuggestions={topicSuggestions}
                  selectedTopicSuggestion={selectedTopicSuggestion}
                  topicSuggestionLocked={topicSuggestionLocked}
                  lockedTopicSuggestion={lockedTopicSuggestion}
                  topicSuggestionLockReason={topicSuggestionLockReason}
                  onApplyTopicSuggestion={(text) => {
                    handleSelectTopicSuggestion(text);
                  }}
                  onConfirmTopicSuggestion={() => {
                    void handleConfirmTopicSuggestion();
                  }}
                  missingHints={missingHints}
                  intentOptions={intentOptions}
                  recommendedIntent={recommendedIntent}
                  onSelectIntentOption={handleSelectIntentOption}
                  posterSizeOptions={posterSizeOptions}
                  selectedPosterSize={posterSizeId}
                  onSelectPosterSize={handleSelectPosterSize}
                  posterCount={posterCount}
                  onPosterCountChange={handlePosterCountChange}
                  pptPageCount={pptPageCount}
                  onPptPageCountChange={handlePptPageCountChange}
                  pptRatio={pptRatio}
                  onPptRatioChange={handlePptRatioChange}
                  videoStoryboardCount={videoStoryboardCount}
                  onVideoStoryboardCountChange={handleVideoStoryboardCountChange}
                  videoRatio={videoRatio}
                  onVideoRatioChange={handleVideoRatioChange}
                  configConfirmed={configConfirmed}
                  onConfirmConfig={handleConfirmConfig}
                  outlineItems={outlineItems}
                  slideDrafts={densityAdjustedSlideDrafts}
                  posterDraft={posterDraft}
                  summaryText={summaryText}
                  updates={updates}
                  onConfirm={handleNextStep}
                  isPlanningNextStep={isPlanningNextStep}
                  canProceed={canProceed}
                  showStyleStage={showStyleStage}
                  styleConfirmed={flowStage === "billing" || flowStage === "generate"}
                  isPlanningStyleStep={isPlanningStyleStep}
                  showBillingConfirm={showBillingConfirm}
                  showBillingRecord={showBillingRecord}
                  isPlanningBillingStep={isPlanningBillingStep}
                  billingConfirmed={billingConfirmed}
                  canConfirmBilling={canConfirmBilling}
                  billingSummary={{
                    styleName: selectedStyle.englishName ?? selectedStyle.name,
                    languageModelCredits,
                    imageModelCredits,
                    totalCost: billingCost,
                    outputTokenEstimate,
                    standardOutputCount,
                    promoCreditsPerOutput: STANDARD_OUTPUT_PROMO_CREDITS,
                    regularCreditsPerOutput: STANDARD_OUTPUT_REGULAR_CREDITS,
                  }}
                  styleOptions={styleOptions}
                  selectedStyleId={selectedStyleId}
                  onSelectStyle={setSelectedStyleId}
                  onStyleNext={handleStyleNext}
                  onConfirmBilling={handleConfirmBilling}
                  onUpgradeForCredits={openCreditsPaywall}
                  visualizationTypeHint={visualizationTypeHint}
                  thinkingState={thinkingState}
                  retryingErrorTurnIds={retryingErrorTurnIds}
                  onRetryErrorTurn={handleRetryErrorTurn}
                />
              </div>

              <div className="z-20 border-t border-zinc-200/70 bg-[#f7f7f8] pt-2">
                <div className="pb-[max(env(safe-area-inset-bottom),0.5rem)]">
                  <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
                    <div className="flex items-center gap-2">
                      <textarea
                        value={chatInput}
                        onChange={(event) => setChatInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void handleSendInput();
                          }
                        }}
                        className="max-h-32 min-h-[38px] w-full resize-none bg-transparent py-1 text-sm text-zinc-800 outline-none"
                        placeholder={tr("Add more instructions", "继续补充需求")}
                      />
                      <button
                        type="button"
                        disabled={!chatInput.trim() || isSending}
                        onClick={() => void handleSendInput()}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
                        aria-label={tr("Send", "发送")}
                      >
                        {isSending ? <LoaderCircle size={14} className="animate-spin" /> : <ArrowUp size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {showStoryboard && showCanvasPanelInLayout ? (
            <section
              ref={storyboardPanelRef}
              className="workspace-canvas-shell relative min-h-0 h-full overflow-hidden lg:h-full"
            >
              {isMobileViewport ? (
                <div className="absolute left-3 top-3 z-20">
                  <button
                    type="button"
                    onClick={() => setMobileWorkspaceView("chat")}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-200 bg-white/95 px-2.5 text-xs text-zinc-700 shadow-sm"
                  >
                    <ArrowLeft size={12} />
                    {tr("Back to Chat", "返回对话")}
                  </button>
                </div>
              ) : null}
              <StoryboardCanvas
                onSaveStateChange={(nextState, unsaved) => {
                  setSaveState(nextState);
                  setHasUnsavedChanges(unsaved);
                }}
                canvasModeExternal={lockedCanvasMode}
                onExportingPptChange={setIsExportingPpt}
                onComposingVideoChange={setIsComposingVideo}
                generationTaskStateByIndex={generationTaskStateByIndex}
                onRetryGenerationTask={handleRetryGenerationTask}
                onModeActionRegister={(actions) => {
                  modeActionsRef.current = actions;
                }}
              />
            </section>
          ) : null}

          {showPosterCanvas && showCanvasPanelInLayout ? (
            <section
              ref={storyboardPanelRef}
              className="workspace-canvas-shell relative min-h-0 h-full overflow-hidden lg:h-full"
            >
              {isMobileViewport ? (
                <div className="absolute left-3 top-3 z-20">
                  <button
                    type="button"
                    onClick={() => setMobileWorkspaceView("chat")}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-200 bg-white/95 px-2.5 text-xs text-zinc-700 shadow-sm"
                  >
                    <ArrowLeft size={12} />
                    {tr("Back to Chat", "返回对话")}
                  </button>
                </div>
              ) : null}
              <PosterCanvas
                posterCount={posterCount}
                posterDraft={posterDraft}
                posterPlanList={editablePosterPlanList.length ? editablePosterPlanList : basePosterPlanList}
                generationTaskStateByIndex={generationTaskStateByIndex}
                onRetryGenerationTask={handleRetryGenerationTask}
                onSaveStateChange={(nextState, unsaved) => {
                  setSaveState(nextState);
                  setHasUnsavedChanges(unsaved);
                }}
              />
            </section>
          ) : null}
        </div>
      </main>

      <PaywallDialog
        open={creditsPaywallOpen}
        title={isFreeUser ? "Membership required" : "Credits required"}
        description={
          isFreeUser
            ? "Your free monthly credits are used up. Please go to the membership page to continue."
            : "Your credits are used up. Extra credit purchase will be added later."
        }
        compact
        onClose={() => setCreditsPaywallOpen(false)}
        onConfirm={() => {
          setCreditsPaywallOpen(false);
          openMembershipFromWorkspace();
        }}
        confirmLabel="Go to Membership"
      />

    </div>
  );
}
