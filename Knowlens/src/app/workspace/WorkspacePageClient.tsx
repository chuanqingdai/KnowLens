"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, ArrowUp, LoaderCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
import {
  buildGenerationTaskStateByIndexFromNormalized,
  normalizeImageBatchTaskResults,
  type ImageBatchTaskResultLike,
} from "@/lib/workspace/image-task-bridge";
import {
  normalizeGenerationConfig,
  buildGenerationTasksFromDraft,
  type VisibleText,
  type VisualDesign,
  type SeriesStyle,
} from "@/lib/workspace/generation-compiler";
import { buildTuziImagePrompt } from "@/lib/workspace/tuzi-image";

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
  imagePrompt?: string;
  imagePromptDraft?: string;
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
  role?: string;
  keyFacts?: string[];
  visualType?: string;
  visualElements?: string[];
  layoutHint?: string;
  imagePrompt?: string;
  imagePromptDraft?: string;
};

type DraftLlmUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  source?: "provider" | "estimated";
  model?: string;
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
  size: string;
  styleId: string;
  styleName: string;
  stylePrompt: string;
  contentTitle: string;
  contentBody: string;
  visibleText: VisibleText;
  visualDesign: VisualDesign;
  factualRules: string[];
  negativeRules: string[];
  seriesStyle: SeriesStyle;
  pageRole?:
    | "cover"
    | "mechanism"
    | "layered-diagram"
    | "comparison"
    | "misconception-fact"
    | "checklist"
    | "system-model";
  textStrategy?: {
    mode: "strict" | "guided" | "minimal";
    titleIdea?: string;
    keyConcepts?: string[];
    language: string;
    density: "low" | "medium" | "high";
    allowRewrite: boolean;
  };
  visualHint: string;
  imagePromptDraft: string;
  composedPrompt: string;
  model: string;
  provider: "tuzi";
  quality: "standard";
  response_format: "url";
};

type GenerationTaskUiStatus = "queued" | "generating" | "retrying" | "success" | "failed";

type GenerationTaskUiState = {
  index: number;
  status: GenerationTaskUiStatus;
  attempts: number;
  maxAttempts: number;
  imageUrl?: string;
  rawImageUrl?: string;
  runId?: string;
  jobId?: string;
  source?: "current-run";
  error?: string;
  startedAt?: number;
  lastUpdatedAt?: number;
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

type ImageGenerateBatchResponse = {
  ok?: boolean;
  reused?: boolean;
  error?: string;
  code?: string;
  imageGenerationMode?: string;
  attemptedProviders?: string[];
  skippedProviders?: string[];
  job?: {
    id?: string;
    runId?: string;
    status?: string;
  };
  tasks?: Array<{
    taskId?: string;
    index?: number;
    status?: string;
    ok?: boolean;
    imageUrl?: string;
    renderUrl?: string;
    rawImageUrl?: string;
    image_url?: string;
    render_url?: string;
    raw_image_url?: string;
    error?: string;
    errorCode?: string;
  }>;
};

type StructuredWorkspaceError = {
  userMessage: string;
  code?: string;
  authRequired?: boolean;
};

const HOME_DRAFT_KEY = "knowlens-home-draft";
const WORKSPACE_DRAFT_CACHE_KEY = "knowlens-workspace-draft-v1";
const WORKSPACE_SESSION_PREFS_KEY = "knowlens-workspace-session-prefs-v1";
const WORKSPACE_CHAT_HISTORY_KEY = "knowlens-workspace-chat-history-v1";
const MEMBERSHIP_SOURCE_KEY = "knowlens:membership-source";
const GENERATION_REQUEST_TIMEOUT_MS = 420000;
const GENERATION_MAX_RETRY_ATTEMPTS = 3;
const GENERATION_RETRY_DELAYS_MS = [1100, 2300];
const GENERATION_UI_HARD_TIMEOUT_MS = 450000;
const DEBUG_IMAGE_BRIDGE_MOCK_URL =
  "https://apioss20.sydney-ai.com/img/174/t9il_0UNjpQmjxFqjxQAjxQnfx1m10kNt7TgYsFuksWxtvFN1a_ljpMm1xkmXaMV1aklX5oItaMm10ezjaQlX9hnX0-u1a_q103lX01TXpQAX4Tgkx1qfv24kAVmR8_=/gi2007i-144x144-1780044357126-ab388bbc.png";
const WORKSPACE_IMAGE_DEBUG = process.env.NODE_ENV === "development";
const WORKSPACE_FLOW_AUDIT = process.env.NODE_ENV === "development";
const initializedWorkspaceScopeKeys = new Set<string>();
const AUTH_REQUIRED_PATTERNS = [
  /please sign in/i,
  /sign[-\s]?in required/i,
  /auth required/i,
  /unauthorized/i,
  /\b401\b/,
];
const REQUEST_GUARD_SIGNIN_PATTERN = /please sign in before sending chat requests\./i;
const LLM_SIGNIN_ERROR_PATTERN = /language model draft generation failed\..*please sign in/i;
const SOURCE_EVIDENCE_MAX_TOTAL_CHARS = 1600;
const SOURCE_EVIDENCE_MAX_PER_SOURCE_CHARS = 420;
const SOURCE_EVIDENCE_MAX_POINTS_PER_SOURCE = 5;

function logWorkspaceImageDebug(message: string, payload: Record<string, unknown>) {
  if (!WORKSPACE_IMAGE_DEBUG) {
    return;
  }
  console.log(message, payload);
}

function logGenerationCacheGuard(message: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }
  console.info(`[GenerationCacheGuard] ${message}`, payload);
}

function logWorkspaceFlowAudit(payload: Record<string, unknown>) {
  if (!WORKSPACE_FLOW_AUDIT) {
    return;
  }
  console.info("[WorkspaceFlowAudit]", payload);
}

function isAuthRequiredErrorMessage(message: string) {
  const normalized = (message || "").trim();
  if (!normalized) {
    return false;
  }
  return AUTH_REQUIRED_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isAuthRelatedLlmErrorTurn(turn: ChatTurn) {
  if (turn.meta?.kind !== "llm_error") {
    return false;
  }
  return isAuthRequiredErrorMessage(turn.content) || LLM_SIGNIN_ERROR_PATTERN.test(turn.content);
}

function sanitizeAuthRelatedChatTurns(turns: ChatTurn[]) {
  const withoutAuthLlmErrors = turns.filter((turn) => !isAuthRelatedLlmErrorTurn(turn));
  const dedupedGuardTurns: ChatTurn[] = [];
  let hasSignInGuard = false;
  for (let i = 0; i < withoutAuthLlmErrors.length; i += 1) {
    const turn = withoutAuthLlmErrors[i];
    if (
      turn.role === "assistant" &&
      turn.module === "Request Guard" &&
      REQUEST_GUARD_SIGNIN_PATTERN.test(turn.content)
    ) {
      if (hasSignInGuard) {
        continue;
      }
      hasSignInGuard = true;
    }
    dedupedGuardTurns.push(turn);
  }
  return dedupedGuardTurns;
}

function normalizeEvidenceSentence(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractEvidencePoints(rawText: string, maxCount: number) {
  const chunks = rawText
    .replace(/\r/g, "\n")
    .split(/[\n。！？!?；;]+/g)
    .map((item) => normalizeEvidenceSentence(item))
    .filter((item) => item.length >= 10)
    .slice(0, 120);
  const scored = chunks.map((text, idx) => {
    let score = 0;
    if (/\d/.test(text)) {
      score += 3;
    }
    if (/%|亿元|万美元|km|kg|°c|m\/s|年|月|日|小时|分钟/i.test(text)) {
      score += 2;
    }
    if (/因为|导致|影响|趋势|变化|增长|下降|机制|原因|结论|risk|impact|trend|cause/i.test(text)) {
      score += 2;
    }
    if (text.length >= 18 && text.length <= 100) {
      score += 1;
    }
    return { text, score, idx };
  });
  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.idx - b.idx;
  });
  const selected: string[] = [];
  for (const row of scored) {
    if (selected.length >= maxCount) {
      break;
    }
    const candidate = row.text.slice(0, 140);
    if (!candidate) {
      continue;
    }
    if (selected.includes(candidate)) {
      continue;
    }
    selected.push(candidate);
  }
  return selected;
}

function buildSourceEvidencePack(sources: HomeSourceItem[]) {
  const sections: string[] = [];
  for (let i = 0; i < sources.length; i += 1) {
    const source = sources[i];
    const sourceText = (source.contentText || source.excerpt || "").trim();
    if (!sourceText) {
      continue;
    }
    const points = extractEvidencePoints(sourceText, SOURCE_EVIDENCE_MAX_POINTS_PER_SOURCE);
    if (!points.length) {
      continue;
    }
    const title = `Source ${i + 1} (${source.kind} · ${source.name}):`;
    const body = points.map((item) => `- ${item}`).join("\n");
    const section = `${title}\n${body}`.slice(0, SOURCE_EVIDENCE_MAX_PER_SOURCE_CHARS);
    sections.push(section);
    if (sections.join("\n\n").length >= SOURCE_EVIDENCE_MAX_TOTAL_CHARS) {
      break;
    }
  }
  return sections.join("\n\n").slice(0, SOURCE_EVIDENCE_MAX_TOTAL_CHARS).trim();
}

function normalizeIdempotencySegment(value: string | null | undefined, fallback: string) {
  const raw = (value || "").trim();
  if (!raw) {
    return fallback;
  }
  return raw.replace(/[^a-zA-Z0-9._@:-]/g, "_").slice(0, 80) || fallback;
}

function stableHashString(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function buildStableGenerationIdempotencyKey(input: {
  userEmail: string;
  projectId: string | null;
  projectTraceId: string | null;
  tasks: ImageGenerationTask[];
}) {
  const normalizedTasks = [...input.tasks].sort((a, b) => a.index - b.index);
  const taskIndexes = normalizedTasks.map((task) => task.index).join(",");
  const promptHash = stableHashString(
    normalizedTasks
      .map((task) => `${task.index}:${(task.composedPrompt || "").trim()}`)
      .join("||"),
  );
  const styleId = Array.from(new Set(normalizedTasks.map((task) => task.styleId.trim()).filter(Boolean)))
    .sort()
    .join(",");
  const aspectRatio = Array.from(new Set(normalizedTasks.map((task) => task.aspectRatio.trim()).filter(Boolean)))
    .sort()
    .join(",");
  const key = [
    "imggen-v2",
    `user=${normalizeIdempotencySegment(input.userEmail, "guest")}`,
    `project=${normalizeIdempotencySegment(input.projectId, "no-project")}`,
    `trace=${normalizeIdempotencySegment(input.projectTraceId, "no-trace")}`,
    `tasks=${normalizeIdempotencySegment(taskIndexes, "none")}`,
    `promptHash=${promptHash}`,
    `style=${normalizeIdempotencySegment(styleId, "no-style")}`,
    `ratio=${normalizeIdempotencySegment(aspectRatio, "no-ratio")}`,
  ].join("|");
  return key.slice(0, 220);
}

function appendKnowLensRenderAttemptToken(imageUrl: string, token: string) {
  const trimmed = imageUrl.trim();
  if (!trimmed || !token.trim()) {
    return trimmed;
  }
  const isRelativeKnowLensAsset = trimmed.startsWith("/api/workspace/image/assets/");
  const isAbsoluteKnowLensAsset = /^https?:\/\/[^/]+\/api\/workspace\/image\/assets\//i.test(trimmed);
  if (!isRelativeKnowLensAsset && !isAbsoluteKnowLensAsset) {
    return trimmed;
  }
  try {
    const baseOrigin =
      typeof window !== "undefined" && window.location?.origin ? window.location.origin : "http://localhost";
    const parsed = new URL(trimmed, baseOrigin);
    parsed.searchParams.set("rk", token.trim());
    if (isRelativeKnowLensAsset) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return parsed.toString();
  } catch {
    const joiner = trimmed.includes("?") ? "&" : "?";
    return `${trimmed}${joiner}rk=${encodeURIComponent(token.trim())}`;
  }
}

function isMockAssetRenderUrl(imageUrl?: string | null) {
  const value = (imageUrl || "").trim().toLowerCase();
  if (!value) {
    return false;
  }
  return value.includes("mock-imgtask-") || value.includes("v=mock");
}

function createGenerationRunId() {
  return `run-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

function normalizeGenerationRunId(value: string | null | undefined) {
  const normalized = (value || "").trim();
  return normalized ? normalized.slice(0, 120) : null;
}

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
    fit: "Precise and polished scientific infographic style for broad educational explainers.",
    prompt:
      "Clean scientific infographic style with precise simplified diagrams, restrained colors, crisp vector shapes, clear arrows, subtle gradients, accurate educational icons, and polished scientific clarity.",
    suitableTopics: "通用科普、自然科学、物理、地理、人体、机制解释",
    carrierPriority: ["ppt", "poster", "video"],
    topicKeywords: ["科普", "自然", "物理", "地理", "人体", "机制", "原理", "解释"],
    palette: ["#1f2937", "#3b82f6", "#e5e7eb"],
    coverImage: styleCoverById("clean-science-infographic"),
  },
  {
    id: "youtube-science-thumbnail",
    name: "科学剖面结构图风",
    englishName: "Scientific Cutaway Diagram",
    fit: "Textbook-like cutaway clarity for layered structures and mechanism internals.",
    prompt:
      "Scientific cutaway diagram style with clear structural cross-sections, layered depth, accurate simplified components, clean labels, spatial explanation, and textbook-quality diagram clarity.",
    suitableTopics: "宇宙、AI、深海、灾难、人体、科技热点",
    carrierPriority: ["poster", "video", "ppt"],
    topicKeywords: ["宇宙", "ai", "深海", "灾难", "人体", "热点", "火山", "科技"],
    palette: ["#111827", "#ef4444", "#f8fafc"],
    coverImage: styleCoverById("youtube-science-thumbnail"),
  },
  {
    id: "cinematic-science-illustration",
    name: "电影级科普视觉风",
    englishName: "Cinematic Science Visual",
    fit: "Dramatic but controlled science storytelling with explanatory overlays.",
    prompt:
      "Cinematic science visual style with dramatic but controlled lighting, realistic atmosphere, strong subject presence, documentary-quality composition, and educational visual overlays. Keep it explanatory and scientific, not like a disaster movie poster.",
    suitableTopics: "宇宙、深海、火山、恐龙、灾难、未来城市",
    carrierPriority: ["poster", "video", "ppt"],
    topicKeywords: ["宇宙", "深海", "火山", "恐龙", "灾难", "未来城市", "史前", "行星"],
    palette: ["#111827", "#7c3aed", "#e2e8f0"],
    coverImage: styleCoverById("cinematic-science-illustration"),
  },
  {
    id: "minimal-line-art",
    name: "极简扁平讲解风",
    englishName: "Minimal Flat Explainer",
    fit: "Simple geometric clarity and clean hierarchy for direct concept teaching.",
    prompt:
      "Minimal flat explainer style with simple geometric shapes, clean iconography, soft modern colors, clear hierarchy, uncluttered layout, and direct concept visualization.",
    suitableTopics: "基础概念、产品说明、AI原理、简单科学机制",
    carrierPriority: ["ppt", "poster", "video"],
    topicKeywords: ["基础", "概念", "产品", "ai原理", "机制", "结构", "说明"],
    palette: ["#111827", "#64748b", "#f8fafc"],
    coverImage: styleCoverById("minimal-line-art"),
  },
  {
    id: "hand-drawn-explainer",
    name: "数据商业编辑风",
    englishName: "Data Business Editorial Style",
    fit: "Refined analytical infographic style for business, policy, and trend narratives.",
    prompt:
      "Data-driven business editorial infographic style with refined charts, clean comparison modules, restrained colors, elegant typography, clear hierarchy, and professional analytical tone. Avoid flashy trading-dashboard aesthetics, excessive glow, and fake financial data.",
    suitableTopics: "商业分析、经济趋势、政策解读、产业研究、社会议题",
    carrierPriority: ["video", "ppt", "poster"],
    topicKeywords: ["商业", "经济", "政策", "产业", "数据", "趋势", "研究", "分析"],
    palette: ["#0f172a", "#3b82f6", "#e2e8f0"],
    coverImage: styleCoverById("hand-drawn-explainer"),
  },
  {
    id: "cute-3d-educational",
    name: "3D 可爱教育风",
    englishName: "Cute 3D Educational Style",
    fit: "Friendly rounded 3D visuals for approachable educational storytelling.",
    prompt:
      "Cute 3D educational style with soft rounded objects, friendly simplified forms, polished toy-like materials, gentle lighting, approachable visual storytelling, and clean explanatory structure.",
    suitableTopics: "儿童科普、动物、人体健康、营养、低龄教育",
    carrierPriority: ["video", "poster", "ppt"],
    topicKeywords: ["儿童", "动物", "人体健康", "营养", "低龄", "亲子", "启蒙"],
    palette: ["#0f172a", "#22d3ee", "#dbeafe"],
    coverImage: styleCoverById("cute-3d-educational"),
  },
  {
    id: "3d-isometric-tech",
    name: "3D 等距科技风",
    englishName: "3D Isometric Tech Explainer",
    fit: "Structured isometric system visualization for technical mechanisms and architectures.",
    prompt:
      "3D isometric technology explainer style with clean spatial structure, miniature system components, precise icon-like objects, soft shadows, modern tech aesthetics, and clear system-level explanation.",
    suitableTopics: "AI系统、数据中心、芯片、城市系统、互联网、能源",
    carrierPriority: ["ppt", "poster", "video"],
    topicKeywords: ["ai系统", "数据中心", "芯片", "城市系统", "互联网", "能源", "架构", "模块"],
    palette: ["#0f172a", "#10b981", "#d1fae5"],
    coverImage: styleCoverById("3d-isometric-tech"),
  },
  {
    id: "dark-premium-tech",
    name: "玻璃拟态知识卡风",
    englishName: "Glassmorphism Knowledge Card",
    fit: "Subtle glass-layer polish for modern knowledge cards and UI-like explainers.",
    prompt:
      "Glassmorphism knowledge-card style with translucent layered surfaces, soft gradients, gentle glow, clean depth, elegant UI-inspired composition, and modern visual polish. Keep glass layers subtle and integrated, not like separate dashboard panels.",
    suitableTopics: "产品机制、科技科普、商业分析、教育卡片、趋势解读",
    carrierPriority: ["poster", "ppt", "video"],
    topicKeywords: ["ui", "产品", "科技", "商业", "机制", "卡片", "趋势", "信息图"],
    palette: ["#0f172a", "#a78bfa", "#dbeafe"],
    coverImage: styleCoverById("dark-premium-tech"),
  },
  {
    id: "technical-blueprint",
    name: "科技蓝图风",
    englishName: "Tech Blueprint Diagram",
    fit: "Technical linework and annotation discipline for engineering-style explanations.",
    prompt:
      "Tech blueprint diagram style with crisp technical lines, structured annotations, subtle grid texture, precise geometry, blueprint-inspired layout, and futuristic educational clarity.",
    suitableTopics: "航空航天、机械、潜艇、机器人、军事科技、工程结构",
    carrierPriority: ["poster", "ppt", "video"],
    topicKeywords: ["航天", "机械", "潜艇", "机器人", "军事", "工程", "结构", "蓝图"],
    palette: ["#0b2447", "#38bdf8", "#bfdbfe"],
    coverImage: styleCoverById("technical-blueprint"),
  },
  {
    id: "medical-educational-illustration",
    name: "医学科普插画风",
    englishName: "Medical Biological Illustration",
    fit: "Clinical clarity with calm precision for anatomy and biological mechanisms.",
    prompt:
      "Professional medical and biological illustration style with clean anatomical clarity, soft clinical colors, accurate simplified structures, gentle depth, readable educational labeling, and calm scientific precision.",
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
    fit: "High-end editorial infographic polish for premium knowledge publication feel.",
    prompt:
      "Premium editorial infographic style with magazine-inspired composition, refined typography, elegant spacing, subtle sophistication, calm professional colors, and a high-end knowledge publication feel.",
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
    fit: "Neat sketchnote educational style with structured visual-thinking flow.",
    prompt:
      "Premium sketchnote science style with neat hand-drawn lines, structured annotations, warm educational charm, light sketch textures, visual-thinking flow, and carefully organized explanation.",
    suitableTopics: "心理学、健康、生活科学、儿童科普、学习方法、认知科学、经济学入门",
    carrierPriority: ["poster", "ppt", "video"],
    topicKeywords: ["心理学", "健康", "生活科学", "儿童科普", "学习方法", "认知科学", "经济学", "入门"],
    palette: ["#1f2937", "#ec4899", "#dbeafe"],
    coverImage: styleCoverById("premium-sketchnote-science"),
  },
] as StyleOption[];

const intentOptions: { id: "ppt" | "video" | "poster"; label: string; desc: string }[] = [
  { id: "poster", label: "Generate Poster", desc: "Best for one-page explainers." },
  { id: "video", label: "Generate Video", desc: "Best for short narrated content." },
  { id: "ppt", label: "Generate PPT", desc: "Best for teaching and presentations." },
];

const OUTPUT_COUNT_OPTIONS = [6, 10, 14, 16, 20, 24] as const;

const posterSizeOptions = [
  { id: "poster-9-16", label: "9:16 Portrait", desc: "Great for mobile-first vertical delivery." },
  { id: "poster-1-1", label: "1:1 Square", desc: "Great for card-based publishing." },
  { id: "poster-16-9", label: "16:9 Landscape", desc: "Great for horizontal explainers and covers." },
  { id: "poster-4-3", label: "4:3 Landscape", desc: "Balanced for presentation and educational visuals." },
  { id: "poster-3-4", label: "3:4 Portrait", desc: "Balances readability and information density." },
];

const POSTER_SIZE_ID_TO_RATIO: Record<string, string> = {
  "poster-9-16": "9:16",
  "poster-1-1": "1:1",
  "poster-16-9": "16:9",
  "poster-4-3": "4:3",
  "poster-3-4": "3:4",
};

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

function compactLineText(input: string | null | undefined) {
  return (input || "").replace(/\s+/g, " ").trim();
}

function splitToShortLabels(input: string[], maxCount: number) {
  return input
    .map((item) => compactLineText(item))
    .filter(Boolean)
    .slice(0, maxCount);
}

type ParsedPosterCardCopy = {
  title: string;
  pageFocus: string;
  contentLines: string[];
  visualStructure: string;
};

function parsePosterCardCopy(copy: string, fallbackTitle: string): ParsedPosterCardCopy {
  const lines = copy
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const title = compactLineText(lines[0] || fallbackTitle);
  const pageFocus =
    compactLineText(
      lines.find((line) => /^本页重点[:：]/.test(line))?.replace(/^本页重点[:：]\s*/i, ""),
    ) || title;
  const visualStructure =
    compactLineText(
      lines.find((line) => /^画面结构[:：]/.test(line))?.replace(/^画面结构[:：]\s*/i, ""),
    ) || "Structured infographic";

  const contentStartIndex = lines.findIndex((line) => /^内容[:：]?$/i.test(line));
  const extractedFromContent =
    contentStartIndex >= 0
      ? lines
          .slice(contentStartIndex + 1)
          .filter((line) => !/^画面结构[:：]/.test(line))
          .map((line) => compactLineText(line.replace(/^\d+\.\s*/, "")))
          .filter(Boolean)
      : [];

  const fallbackLines = lines
    .slice(1)
    .filter((line) => !/^本页重点[:：]/.test(line))
    .filter((line) => !/^画面结构[:：]/.test(line))
    .filter((line) => !/^内容[:：]?$/i.test(line))
    .map((line) => compactLineText(line.replace(/^\d+\.\s*/, "")))
    .filter(Boolean);

  const contentLines = (extractedFromContent.length ? extractedFromContent : fallbackLines).slice(0, 4);

  return {
    title: title || fallbackTitle,
    pageFocus,
    contentLines,
    visualStructure,
  };
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
    if (theme === "volcano") {
      return [
        "A clear explainer of how volcanoes form from mantle melting to eruption.",
        "A clear explainer of how magma-chamber pressure buildup triggers eruptions.",
        "A clear explainer of which precursor signals best predict volcanic eruption risk.",
        "A clear explainer of explosive versus effusive eruptions and why they differ.",
      ];
    }
    if (lowSignalInput) {
      return [
        "A clear explainer of how plate tectonics shapes major landforms.",
        "A clear explainer of how photosynthesis converts light into stored energy.",
        "A clear explainer of how the immune system identifies pathogens.",
        "A clear explainer of how tides are driven by Moon-Sun gravity.",
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

  if (theme === "volcano") {
    return [
      "火山形成的过程讲解：从地幔熔融到岩浆上升再到喷发。",
      "火山为什么会喷发的讲解：岩浆房压力如何累积并跨过阈值。",
      "火山喷发前信号讲解：地震活动、气体异常和地表形变怎么看。",
      "火山喷发类型讲解：爆炸式与溢流式喷发为什么会不同。",
    ];
  }
  if (lowSignalInput) {
    return [
      "板块运动过程讲解：板块边界如何塑造地貌并触发地震。",
      "光合作用过程讲解：光能如何转化为有机物并进入食物链。",
      "免疫系统机制讲解：人体如何识别并清除外来病原体。",
      "潮汐形成机制讲解：月球和太阳引力如何驱动潮位变化。",
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
  const normalizeTopicCandidate = (value: string) => {
    const compact = value
      .trim()
      .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
      .replace(/^(?:主题是|主题为|主题|topic(?:\s*is)?|topic)\s*[:：]?\s*/i, "")
      .replace(/^(?:请|请帮我|帮我|麻烦)?\s*(?:做成?|生成|输出|创建|制作|写)\s*/i, "")
      .replace(/^(?:\d+\s*(?:页|张|个分镜|帧)\s*)/i, "")
      .replace(/^(?:海报|PPT|视频|视频分镜|poster|ppt|video|storyboard)\s*/i, "")
      .replace(/^(?:关于|围绕|讲解|解释)\s*/i, "")
      .replace(/^\s*(?:成)\s*\d+\s*(?:页|张|个分镜|帧)\s*/i, "")
      .replace(/^\s*(?:第\s*)?\d+\s*(?:页|张|个分镜|帧)\s*/i, "")
      .replace(/[，,]\s*(?:做成?|生成|输出)\s*\d+\s*(?:页|张|个分镜|帧).*$/i, "")
      .trim();

    const firstSentence = compact
      .split(/[。！？!?]/)
      .map((part) => part.trim())
      .filter(Boolean)[0];
    const candidate = (firstSentence || compact).replace(/\s+/g, " ").trim();
    if (!candidate) {
      return "";
    }
    const safe = candidate
      .replace(/^(?:成)\s*\d+\s*(?:页|张|个分镜|帧)\s*/i, "")
      .replace(/^(?:做成?|生成|输出)\s*\d+\s*(?:页|张|个分镜|帧)\s*/i, "")
      .trim();
    return safe;
  };

  const trimmed = normalizeTopicCandidate(cleanTopicText(prompt) || prompt.trim());
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

function extractPosterCount(prompt: string) {
  const text = normalizeText(prompt);
  const directMatch = prompt.match(/(\d+)\s*(张|海报|posters?)/i);
  if (directMatch) {
    const value = Number(directMatch[1]);
    if (Number.isFinite(value) && value > 0) {
      return clamp(Math.round(value), 1, 10);
    }
  }
  const pageAsPosterMatch = prompt.match(/(\d+)\s*页/i);
  if (pageAsPosterMatch && /海报|poster|长图|infographic/i.test(prompt)) {
    const value = Number(pageAsPosterMatch[1]);
    if (Number.isFinite(value) && value > 0) {
      return clamp(Math.round(value), 1, 10);
    }
  }
  const compactMatch = text.match(/(\d+)\s*(张海报|海报)/i);
  if (compactMatch) {
    const value = Number(compactMatch[1]);
    if (Number.isFinite(value) && value > 0) {
      return clamp(Math.round(value), 1, 10);
    }
  }
  return null;
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

function extractPptRatio(prompt: string): "16:9" | "4:3" | null {
  const text = normalizeText(prompt);
  if (text.includes("4:3")) {
    return "4:3";
  }
  if (text.includes("16:9")) {
    return "16:9";
  }
  return null;
}

function extractVideoRatio(prompt: string): "16:9" | "9:16" | null {
  const text = normalizeText(prompt);
  if (text.includes("9:16") || text.includes("竖版") || text.includes("portrait")) {
    return "9:16";
  }
  if (text.includes("16:9") || text.includes("横版") || text.includes("landscape")) {
    return "16:9";
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

function isBackNavigationCommand(normalized: string) {
  return containsAny(normalized, [
    "返回",
    "返回上一步",
    "上一步",
    "back",
    "go back",
    "previous step",
  ]);
}

function isDownloadCommand(normalized: string) {
  return containsAny(normalized, [
    "下载",
    "导出",
    "download",
    "export",
    "下载全部",
    "导出全部",
    "download all",
  ]);
}

function isDraftEditIntentCommand(normalized: string) {
  if (/(?:第\s*)?\d+\s*(?:页|张|个分镜|帧)/i.test(normalized)) {
    return true;
  }
  return containsAny(normalized, [
    "改",
    "修改",
    "重写",
    "精简",
    "缩短",
    "补充",
    "优化文稿",
    "文稿",
    "草稿",
    "rewrite",
    "update",
    "edit",
    "shorten",
    "draft",
    "copy",
  ]);
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

  if (/火山|岩浆|喷发/.test(topic)) {
    return {
      headline: "火山形成的过程讲解",
      subtitle: "从地幔熔融到岩浆上升再到喷发",
      body: "火山形成通常从地幔局部熔融开始，岩浆在压力和浮力作用下沿裂隙上升，并在岩浆房中持续演化。当压力超过围岩承受能力时，系统进入喷发阶段。",
      points: [
        "起点：板块俯冲、张裂或热点活动会触发地幔局部熔融。",
        "上升：岩浆沿断裂通道向上运移，过程中成分与温度持续变化。",
        "储集：岩浆房中的气体含量、黏度与补给速率共同决定压力累积速度。",
        "触发：当压力跨过阈值并通道贯通时，喷发概率显著上升。",
      ],
      cta: "先看“熔融—上升—储集—触发”四步主线。",
      size: sizeLabel,
      visualType: "过程链路图",
      layoutSuggestion: "上方标题 + 中部四阶段流程 + 下方触发条件总结",
      visualElements: ["地幔熔融区", "岩浆上升通道", "岩浆房压力示意", "喷发触发阈值"],
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

  return {
    headline: `${topic}：关键机制与现实影响`,
    subtitle: isChineseLanguage(outputLanguage)
      ? "一图梳理核心机制、关键变量与现实影响"
      : "Key mechanisms, variables, and real-world impact",
    body: `${topic}可以通过“驱动因素—过程机制—可观测结果”这条主线来理解。先识别最先变化的变量，再追踪变量如何传导到结果，最后回到现实场景验证结论。`,
    points: [
      `先明确 ${topic} 的关键驱动因素，并区分“必要条件”和“放大因素”。`,
      "用 3-4 个步骤描述机制链路，确保每一步都有因果关系。",
      "列出 2-3 个可观测指标，用来验证机制是否正在发生。",
      "补充一个现实案例，把抽象机制落到可理解的具体场景。",
    ],
    cta: "收藏这张图，1 分钟复习机制主线。",
    size: sizeLabel,
    visualType: "因果流图",
    layoutSuggestion: "上方标题 + 中部机制链路 + 下方指标与结论",
    visualElements: ["驱动因素", "过程节点", "观测指标", "结论总结"],
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

function hasTopicMismatchPosterDraft(draft: PosterDraft, topic: string) {
  const normalizedTopic = topic.replace(/\s+/g, "");
  if (/火山|岩浆|喷发/.test(normalizedTopic)) {
    const joined = [draft.headline, draft.subtitle, draft.body, ...(draft.points || [])]
      .join(" ")
      .replace(/\s+/g, "");
    return /成本|价格|购买力|消费结构|刚需消费|CPI|预算/.test(joined);
  }
  return false;
}

function normalizePosterPlanFactLine(line: string) {
  return line
    .replace(/^[\s\-*•·\d]+[.)、\s-]*/, "")
    .replace(
      /^(?:起点|阶段|步骤|触发|上升|储集|触发点|机制|结论|对比|案例|误区|总结)\s*[：:]\s*/i,
      "",
    )
    .trim();
}

function buildClientPosterPlanList(
  topic: string,
  posterCount: number,
  posterDraft: PosterDraft,
  outputLanguage: OutputLanguage,
): PosterPlanItem[] {
  const isZh = isChineseLanguage(outputLanguage);
  const titleSeedsZh = ["整体框架", "触发条件", "机制路径", "关键变量", "对比变化", "案例验证", "误区澄清", "结论应用"];
  const titleSeedsEn = [
    "Overview",
    "Trigger Conditions",
    "Mechanism Path",
    "Key Variables",
    "Comparison",
    "Case Validation",
    "Misconception Check",
    "Practical Takeaway",
  ];
  const visualSeedsZh = ["机制流程图", "分层结构图", "对比图", "路径示意图", "指标看板图", "总结图"];
  const visualSeedsEn = [
    "mechanism flow",
    "layered structure",
    "comparison view",
    "pathway diagram",
    "indicator panel",
    "summary chart",
  ];

  const rawFacts = [posterDraft.subtitle, posterDraft.body, ...(posterDraft.points || [])]
    .flatMap((entry) => String(entry || "").split(isZh ? /[。！？\n]/ : /[.!?\n]/))
    .map((line) => normalizePosterPlanFactLine(line))
    .filter(Boolean);
  const dedupedFacts: string[] = [];
  const seen = new Set<string>();
  for (const fact of rawFacts) {
    const key = fact.replace(/[，。,.!?！？;；:：\s]/g, "").toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    dedupedFacts.push(fact);
  }
  const facts =
    dedupedFacts.length > 0
      ? dedupedFacts
      : [
          isZh
            ? `${topic}通常由触发条件、机制传导与结果呈现三段主线组成。`
            : `${topic} is usually explained by triggers, propagation, and outcomes.`,
        ];

  return Array.from({ length: posterCount }, (_, idx) => {
    const index = idx + 1;
    const role = idx === 0 ? "cover" : idx === posterCount - 1 ? "system-model" : "mechanism";
    const title = isZh
      ? `${topic}：${titleSeedsZh[idx % titleSeedsZh.length]}`
      : `${topic}: ${titleSeedsEn[idx % titleSeedsEn.length]}`;
    const focus = facts[idx % facts.length];
    const keyFacts = [facts[idx % facts.length], facts[(idx + 1) % facts.length], facts[(idx + 2) % facts.length]]
      .map((line) => line.trim())
      .filter(Boolean);
    return {
      index,
      title,
      focus: isZh ? (/[。！？]$/.test(focus) ? focus : `${focus}。`) : /[.!?]$/.test(focus) ? focus : `${focus}.`,
      role,
      keyFacts,
      visualType: posterDraft.visualType || (isZh ? visualSeedsZh[idx % visualSeedsZh.length] : visualSeedsEn[idx % visualSeedsEn.length]),
      visualElements: posterDraft.visualElements,
      layoutHint: posterDraft.layoutSuggestion,
      imagePromptDraft: "",
      imagePrompt: "",
    };
  });
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
    const queryProjectId = new URL(window.location.href).searchParams.get("projectId")?.trim() || "";
    if (queryProjectId) {
      if (!next.project) {
        next.project = {
          projectId: queryProjectId,
          projectTraceId: "",
          projectUserId: "",
          projectTitle: "",
        };
      } else if (!next.project.projectId) {
        next.project = {
          ...next.project,
          projectId: queryProjectId,
        };
      }
    }
    window.localStorage.setItem(WORKSPACE_DRAFT_CACHE_KEY, JSON.stringify(payload));
    return next;
  } catch {
    return empty;
  }
}

function buildWorkspaceSessionScopeKey(entry: {
  prompt: string;
  sources: HomeSourceItem[];
  project?: {
    projectId: string;
    projectTraceId: string;
  } | null;
}) {
  const projectSeed = `${entry.project?.projectId || ""}|${entry.project?.projectTraceId || ""}`.trim();
  const contentSeed = `${entry.prompt}|${entry.sources.map((item) => `${item.kind}:${item.origin}`).join("|")}`;
  const base = projectSeed ? `project:${projectSeed}` : `content:${contentSeed}`;
  let hash = 0;
  for (let i = 0; i < base.length; i += 1) {
    hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
  }
  return `${WORKSPACE_SESSION_PREFS_KEY}:v2:${hash.toString(16)}`;
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

function dedupeAdjacentChatTurns(turns: ChatTurn[]) {
  const deduped: ChatTurn[] = [];
  turns.forEach((turn) => {
    const last = deduped[deduped.length - 1];
    if (
      last &&
      last.role === turn.role &&
      last.module === turn.module &&
      last.content.trim() === turn.content.trim()
    ) {
      return;
    }
    deduped.push(turn);
  });
  return deduped;
}

function stringifyUnknownForStorage(value: unknown) {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(value, (_key, current) => {
      if (current && typeof current === "object") {
        if (seen.has(current as object)) {
          return "[Circular]";
        }
        seen.add(current as object);
      }
      if (typeof current === "function") {
        return "[Function]";
      }
      return current;
    });
  } catch {
    return "";
  }
}

function normalizeStorageText(value: unknown, fallback = "") {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value instanceof Error) {
    return value.message || fallback;
  }
  if (value == null) {
    return fallback;
  }
  const serialized = stringifyUnknownForStorage(value);
  if (!serialized) {
    return fallback;
  }
  return serialized.length > 8000 ? `${serialized.slice(0, 8000)}…` : serialized;
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
    return sanitizeAuthRelatedChatTurns(dedupeAdjacentChatTurns(normalizeChatHistory(JSON.parse(raw)))).slice(-160);
  } catch {
    return [] as ChatTurn[];
  }
}

function writeWorkspaceChatHistory(scopeKey: string, updates: ChatTurn[]) {
  if (typeof window === "undefined") {
    return;
  }
  const key = buildWorkspaceChatHistoryStorageKey(scopeKey);
  const normalizedUpdates = sanitizeAuthRelatedChatTurns(dedupeAdjacentChatTurns(updates)).slice(-160);
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
  const normalizedPayload = normalizedUpdates.map((item, index) => ({
    id: normalizeStorageText(item.id, `turn-${index}`),
    role: item.role === "assistant" ? "assistant" : "user",
    module: normalizeStorageText(item.module, "Workspace").slice(0, 120),
    content: normalizeStorageText(item.content, "").slice(0, 8000),
    meta: safeMeta(item.meta),
  }));
  try {
    const payload = JSON.stringify(normalizedPayload);
    window.sessionStorage.setItem(key, payload);
    window.localStorage.setItem(key, payload);
  } catch (error) {
    console.warn("[WorkspaceChatHistory] write failed, fallback to minimal payload", {
      scopeKey,
      error: error instanceof Error ? error.message : "unknown",
    });
    const fallbackPayload = JSON.stringify(
      normalizedPayload.map((item) => ({
        id: item.id,
        role: item.role,
        module: "Workspace",
        content: typeof item.content === "string" ? item.content : "",
      })),
    );
    window.sessionStorage.setItem(key, fallbackPayload);
    window.localStorage.setItem(key, fallbackPayload);
  }
}

export default function WorkspacePage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
  const [currentGenerationRunId, setCurrentGenerationRunId] = useState<string | null>(null);
  const [currentGenerationJobId, setCurrentGenerationJobId] = useState<string | null>(null);
  const [generationConfirmError, setGenerationConfirmError] = useState<string | null>(null);
  const [retryingErrorTurnIds, setRetryingErrorTurnIds] = useState<Record<string, boolean>>({});
  const [creditsPaywallOpen, setCreditsPaywallOpen] = useState(false);

  const [manualIntent, setManualIntent] = useState<Exclude<WorkspaceIntent, "unknown"> | null>(() => {
    if (sessionPrefs?.intent === "ppt" || sessionPrefs?.intent === "video" || sessionPrefs?.intent === "poster") {
      return sessionPrefs.intent;
    }
    const detected = detectIntent(initialEntry.prompt, initialEntry.sources);
    if (detected.intent === "ppt" || detected.intent === "video" || detected.intent === "poster") {
      return detected.intent;
    }
    return inferRecommendedIntent(initialEntry.prompt, initialEntry.sources);
  });
  const [posterSizeId, setPosterSizeId] = useState<string | null>(() =>
    normalizePosterSizeId(
      sessionPrefs?.posterSizeId ?? extractPosterSize(initialEntry.prompt) ?? "poster-9-16",
    ) ?? "poster-9-16",
  );
  const [posterCount, setPosterCount] = useState(() =>
    clamp(sessionPrefs?.posterCount ?? extractPosterCount(initialEntry.prompt) ?? 1, 1, 10),
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
  const [draftLlmUsage, setDraftLlmUsage] = useState<DraftLlmUsage | null>(null);
  const [isPlanningNextStep, setIsPlanningNextStep] = useState(false);
  const [isPlanningStyleStep, setIsPlanningStyleStep] = useState(false);
  const [isPlanningBillingStep, setIsPlanningBillingStep] = useState(false);
  const [configConfirmed, setConfigConfirmed] = useState(false);
  const [generationSessionSeed, setGenerationSessionSeed] = useState(0);
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
  const generationRequestInFlightRef = useRef(false);
  const currentGenerationRunIdRef = useRef<string | null>(null);
  const currentGenerationJobIdRef = useRef<string | null>(null);
  const autoGenerationTriggeredRunIdsRef = useRef<Record<string, boolean>>({});
  const debugGoGenerateStepAppliedRef = useRef(false);
  const debugImageBridgeAppliedRef = useRef(false);

  const emitFlowAudit = useCallback((
    input: {
      stage: string;
      status: string;
      decision: string;
      reason: string;
      keyFields?: Record<string, unknown>;
    },
  ) => {
    logWorkspaceFlowAudit({
      stage: input.stage,
      projectId: projectIdRef.current ?? null,
      currentStep: flowStage,
      runId: currentGenerationRunIdRef.current ?? null,
      jobId: currentGenerationJobIdRef.current ?? null,
      status: input.status,
      keyFields: input.keyFields ?? {},
      decision: input.decision,
      reason: input.reason,
    });
  }, [flowStage]);

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

  const setGenerationRunContext = useCallback((runId: string | null, jobId?: string | null) => {
    const normalizedRunId = normalizeGenerationRunId(runId);
    const normalizedJobId = jobId?.trim() || null;
    currentGenerationRunIdRef.current = normalizedRunId;
    currentGenerationJobIdRef.current = normalizedJobId;
    setCurrentGenerationRunId(normalizedRunId);
    setCurrentGenerationJobId(normalizedJobId);
  }, []);
  const clearCurrentGenerationState = useCallback(
    (reason: string) => {
      generationRequestInFlightRef.current = false;
      setIsPlanningBillingStep(false);
      setGenerationConfirmError(null);
      setGenerationTaskStateByIndex({});
      setGenerationRunContext(null, null);
      setGenerationSessionSeed((prev) => prev + 1);
      logGenerationCacheGuard("clear-current-generation-state", { reason });
    },
    [setGenerationRunContext],
  );

  useEffect(() => {
    if (initialEntry.project?.projectId) {
      projectIdRef.current = initialEntry.project.projectId;
    }
    if (initialEntry.project?.projectTraceId) {
      projectTraceIdRef.current = initialEntry.project.projectTraceId;
    }
  }, [initialEntry.project]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const currentProjectId = projectIdRef.current?.trim();
    if (!currentProjectId) {
      return;
    }
    const url = new URL(window.location.href);
    const existingProjectId = (url.searchParams.get("projectId") || "").trim();
    if (existingProjectId === currentProjectId) {
      return;
    }
    url.searchParams.set("projectId", currentProjectId);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`, { scroll: false });
  }, [router, initialEntry.project?.projectId, initialEntry.project?.projectTraceId]);

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
  const sourcePromptContext = useMemo(() => buildSourceEvidencePack(entrySources), [entrySources]);
  const draftPrompt = useMemo(() => {
    if (!sourcePromptContext) {
      return contextPrompt;
    }
    const topicLine = contextPrompt.trim() || "Please process the uploaded source evidence.";
    return `${topicLine}\n\n[Source evidence pack]\n${sourcePromptContext}`;
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
  const uiLanguage: "en" | "zh" = outputLanguage === "zh" ? "zh" : "en";
  const isZhOutput = uiLanguage === "zh";
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
  const debugGoGenerateStepEnabled =
    process.env.NODE_ENV === "development" && searchParams.get("debugGoGenerateStep") === "1";
  const debugImageBridgeEnabled =
    process.env.NODE_ENV === "development" && searchParams.get("debugImageBridge") === "1";
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

  const baseSlideDrafts = useMemo<SlideDraft[]>(() => {
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

  const basePosterPlanList = useMemo<PosterPlanItem[]>(() => {
    if (effectiveIntent !== "poster" || !basePosterDraft || !configConfirmed) {
      return [] as PosterPlanItem[];
    }
    return buildClientPosterPlanList(topic, posterCount, basePosterDraft, outputLanguage);
  }, [basePosterDraft, configConfirmed, effectiveIntent, outputLanguage, posterCount, topic]);

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
  const posterDraft = useMemo(
    () =>
      posterDraftRaw &&
      (hasAbstractPosterDraft(posterDraftRaw, outputLanguage) ||
        hasTopicMismatchPosterDraft(posterDraftRaw, topic))
        ? buildPosterDraft(topic, posterSizeLabel, contextPrompt, outputLanguage)
        : posterDraftRaw,
    [contextPrompt, outputLanguage, posterDraftRaw, posterSizeLabel, topic],
  );
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
  const normalizedGenerationConfig = useMemo(
    () =>
      normalizeGenerationConfig({
        direction: effectiveIntent === "unknown" ? "poster" : effectiveIntent,
        posterCount,
        posterSizeLabel: posterSizeLabel || "9:16",
        pptPageCount,
        pptRatio,
        videoStoryboardCount,
        videoRatio,
      }),
    [effectiveIntent, posterCount, posterSizeLabel, pptPageCount, pptRatio, videoStoryboardCount, videoRatio],
  );

  const standardOutputCount =
    effectiveIntent === "unknown" ? 0 : normalizedGenerationConfig.normalizedCount;
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
  const inputTokenEstimate = useMemo(() => {
    const normalized = (draftPrompt || "").trim();
    if (!normalized) {
      return 1;
    }
    return Math.max(1, Math.ceil(normalized.length / 4));
  }, [draftPrompt]);
  const outputTokenEstimate = Math.max(1, Math.ceil(draftOutputCharCount / 4));
  const usageTotalTokens =
    draftLlmUsage?.totalTokens ??
    ((draftLlmUsage?.inputTokens ?? 0) + (draftLlmUsage?.outputTokens ?? 0));
  const totalTokenEstimate = Math.max(
    1,
    usageTotalTokens > 0 ? usageTotalTokens : inputTokenEstimate + outputTokenEstimate,
  );
  const languageModelCredits = Math.max(1, Math.ceil(totalTokenEstimate / 1000));
  const imageModelCredits = standardOutputCount * STANDARD_OUTPUT_PROMO_CREDITS;
  const billingCost = languageModelCredits + imageModelCredits;
  const buildFreshImageGenerationTasks = useCallback(() => {
    if (effectiveIntent === "unknown") {
      return [] as ImageGenerationTask[];
    }
    const compiled = buildGenerationTasksFromDraft({
      topic,
      outputLanguage,
      config: normalizedGenerationConfig,
      style: {
        id: selectedStyle.id,
        name: selectedStyle.englishName ?? selectedStyle.name,
        prompt: selectedStyle.prompt.trim(),
      },
      visualizationTypeHint,
      posterDraft: effectiveIntent === "poster" ? posterDraft : null,
      posterPlanList: editablePosterPlanList.length ? editablePosterPlanList : basePosterPlanList,
      outlineItems,
      slideDrafts: densityAdjustedSlideDrafts,
    });
    return compiled.map((task) => ({
      ...task,
      styleId: selectedStyle.id,
      styleName: selectedStyle.englishName ?? selectedStyle.name,
      stylePrompt: selectedStyle.prompt.trim(),
      model: "gpt-image-2",
      provider: "tuzi",
      quality: "standard",
      response_format: "url",
    })) as ImageGenerationTask[];
  }, [
    basePosterPlanList,
    densityAdjustedSlideDrafts,
    editablePosterPlanList,
    effectiveIntent,
    normalizedGenerationConfig,
    outlineItems,
    outputLanguage,
    posterDraft,
    selectedStyle.englishName,
    selectedStyle.id,
    selectedStyle.name,
    selectedStyle.prompt,
    topic,
    visualizationTypeHint,
  ]);
  const imageGenerationTasks = useMemo(() => buildFreshImageGenerationTasks(), [buildFreshImageGenerationTasks]);
  const posterCanvasAspectRatio = useMemo(() => {
    if (effectiveIntent !== "poster") {
      return "9:16";
    }
    if (posterSizeId && POSTER_SIZE_ID_TO_RATIO[posterSizeId]) {
      return POSTER_SIZE_ID_TO_RATIO[posterSizeId];
    }
    const candidates = [
      normalizedGenerationConfig.normalizedRatio,
      imageGenerationTasks[0]?.aspectRatio,
      posterSizeLabel,
    ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    for (const candidate of candidates) {
      const match = candidate.match(/(\d+)\s*[:/]\s*(\d+)/);
      if (match) {
        return `${Number(match[1])}:${Number(match[2])}`;
      }
    }
    return "9:16";
  }, [effectiveIntent, imageGenerationTasks, normalizedGenerationConfig.normalizedRatio, posterSizeId, posterSizeLabel]);
  const canConfirmBilling = credits >= billingCost || debugGoGenerateStepEnabled;
  const lockedCanvasMode: "free" | "ppt" = effectiveIntent === "ppt" ? "ppt" : "free";
  const imageGenerationTaskByIndex = useMemo(() => {
    return new Map(imageGenerationTasks.map((task) => [task.index, task] as const));
  }, [imageGenerationTasks]);
  useEffect(() => {
    if (initializedWorkspaceScopeKeys.has(sessionPrefsScopeKey)) {
      logGenerationCacheGuard("skip-clear-current-generation-state", {
        reason: "scope-already-initialized",
        scope: sessionPrefsScopeKey,
      });
      return;
    }
    initializedWorkspaceScopeKeys.add(sessionPrefsScopeKey);
    const cachedImageTurns = readWorkspaceChatHistory(sessionPrefsScopeKey).filter((turn) =>
      typeof turn.content === "string" &&
      /(\/api\/workspace\/image\/assets\/|https?:\/\/\S+\.(png|jpe?g|webp))/i.test(turn.content),
    );
    if (cachedImageTurns.length) {
      logGenerationCacheGuard("cached-images-detected", {
        reason: "cached-image",
        count: cachedImageTurns.length,
        samples: cachedImageTurns.slice(0, 3).map((turn) => ({
          id: turn.id,
          module: turn.module,
          preview: turn.content.slice(0, 220),
        })),
        scope: sessionPrefsScopeKey,
      });
    }
    clearCurrentGenerationState("scope-init");
    setGenerationTaskStateByIndex((prev) => {
      const successEntries = Object.values(prev).filter((item) => item.status === "success" && item.imageUrl);
      if (successEntries.length) {
        logGenerationCacheGuard("reject-state-write", {
          reason: "previous-result",
          successEntries: successEntries.map((item) => ({
            index: item.index,
            imageUrl: item.imageUrl,
            runId: item.runId || null,
            jobId: item.jobId || null,
          })),
        });
      }
      return {};
    });
  }, [clearCurrentGenerationState, sessionPrefsScopeKey]);
  useEffect(() => {
    if (!debugGoGenerateStepEnabled) {
      debugGoGenerateStepAppliedRef.current = false;
      return;
    }
    if (debugGoGenerateStepAppliedRef.current) {
      return;
    }
    console.info("[workspace-generation] debugGoGenerateStep applied", {
      flowStage,
      effectiveIntent,
      imageGenerationTasksLength: imageGenerationTasks.length,
    });
    const timeoutId = window.setTimeout(() => {
      if (debugGoGenerateStepAppliedRef.current) {
        return;
      }
      debugGoGenerateStepAppliedRef.current = true;
      generationRequestInFlightRef.current = false;
      setManualIntent("poster");
      setPosterCount(1);
      setPosterSizeId((prev) => prev ?? "poster-9-16");
      setWeakPromptResolved(true);
      if (!topicContextPrompt.trim()) {
        setTopicContextPrompt("QA mock poster generation smoke test");
      }
      setConfigConfirmed(true);
      setBillingConfirmed(false);
      clearCurrentGenerationState("debug-go-generate-step");
      setFlowStage("billing");
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [
    debugGoGenerateStepEnabled,
    effectiveIntent,
    flowStage,
    imageGenerationTasks.length,
    clearCurrentGenerationState,
    topicContextPrompt,
  ]);
  useEffect(() => {
    if (!debugImageBridgeEnabled) {
      if (debugImageBridgeAppliedRef.current) {
        clearCurrentGenerationState("debug-source");
        setBillingConfirmed(false);
        if (flowStage === "generate") {
          setFlowStage("billing");
        }
      }
      debugImageBridgeAppliedRef.current = false;
      return;
    }
    if (debugImageBridgeAppliedRef.current) {
      return;
    }
    const requestedTaskIndexes = imageGenerationTasks.length
      ? imageGenerationTasks.map((task) => task.index)
      : [1];
    if (!requestedTaskIndexes.length) {
      return;
    }
    const mockImageUrl = DEBUG_IMAGE_BRIDGE_MOCK_URL;
    const mockBatchResponseTasks: ImageBatchTaskResultLike[] = [
      {
        taskId: "debug-image-bridge-task-1",
        index: 1,
        ok: true,
        status: "asset_ready",
        imageUrl: mockImageUrl,
        rawImageUrl: mockImageUrl,
        renderUrl: mockImageUrl,
        error: null,
        errorCode: null,
      },
    ];
    const normalizedResults = normalizeImageBatchTaskResults({
      taskResults: mockBatchResponseTasks,
      requestedTaskIndexes,
    });
    const normalizedStateByIndex = buildGenerationTaskStateByIndexFromNormalized({
      normalizedResults,
      maxAttempts: 1,
    });
    logWorkspaceImageDebug("[ImageRenderDebug][WorkspaceBridge] debugImageBridge normalized results:", {
      requestedTaskIndexes,
      normalizedResults,
      normalizedStateByIndex,
    });
    const timeoutId = window.setTimeout(() => {
      if (debugImageBridgeAppliedRef.current) {
        return;
      }
      debugImageBridgeAppliedRef.current = true;
      setManualIntent("poster");
      setConfigConfirmed(true);
      setBillingConfirmed(true);
      setGenerationConfirmError(null);
      setFlowStage("generate");
      setGenerationTaskStateByIndex((prev) => {
        const merged = {
          ...prev,
          ...normalizedStateByIndex,
        };
        logWorkspaceImageDebug("[ImageRenderDebug][WorkspaceBridge] debugImageBridge applied state:", {
          previousState: prev,
          nextDelta: normalizedStateByIndex,
          mergedState: merged,
        });
        return merged;
      });
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [clearCurrentGenerationState, debugImageBridgeEnabled, flowStage, imageGenerationTasks]);
  const imageModel = initialEntry.models?.imageModel || "gpt-image2";
  const buildGenerationRequestPayload = useCallback(
    (tasks: ImageGenerationTask[]) => ({
      intent: effectiveIntent,
      normalizedDirection: normalizedGenerationConfig.normalizedDirection,
      normalizedCount: normalizedGenerationConfig.normalizedCount,
      normalizedRatio: normalizedGenerationConfig.normalizedRatio,
      projectId: projectIdRef.current ?? undefined,
      projectTraceId: projectTraceIdRef.current ?? undefined,
      outputs: normalizedGenerationConfig.normalizedCount,
      style: {
        id: selectedStyle.id,
        name: selectedStyle.englishName ?? selectedStyle.name,
        prompt: selectedStyle.prompt,
      },
      ratio: normalizedGenerationConfig.normalizedRatio,
      imageModel: "gpt-image-2",
      tasks,
    }),
    [
      effectiveIntent,
      normalizedGenerationConfig.normalizedCount,
      normalizedGenerationConfig.normalizedDirection,
      normalizedGenerationConfig.normalizedRatio,
      selectedStyle.englishName,
      selectedStyle.id,
      selectedStyle.name,
      selectedStyle.prompt,
    ],
  );
  const runGenerationBatch = useCallback(
    async (tasks: ImageGenerationTask[], isRetry = false, runIdOverride?: string | null) => {
      emitFlowAudit({
        stage: "7.run-generation-batch",
        status: "started",
        decision: "prepare-generate-batch",
        reason: "runGenerationBatch-called",
        keyFields: {
          isRetry,
          taskCount: tasks.length,
          taskIndexes: tasks.map((task) => task.index),
          runIdOverride: runIdOverride ?? null,
        },
      });
      console.info("[workspace-generation] runGenerationBatch called", {
        taskCount: tasks.length,
        taskIndexes: tasks.map((task) => task.index),
        isRetry,
      });
      if (!tasks.length) {
        const message = tr("No generation tasks are ready.", "没有可生成的任务。");
        setGenerationConfirmError(message);
        console.error("[workspace-generation] runGenerationBatch aborted: empty tasks");
        throw new Error(message);
      }
      const activeRunId = normalizeGenerationRunId(runIdOverride ?? currentGenerationRunIdRef.current);
      if (!activeRunId) {
        const message = tr("No active generation run. Please confirm generation again.", "当前没有有效的生成批次，请重新确认生成。");
        logGenerationCacheGuard("reject-state-write", {
          reason: "missing-current-run",
          taskIndexes: tasks.map((task) => task.index),
          runIdOverride: runIdOverride ?? null,
          currentGenerationRunId: currentGenerationRunIdRef.current,
        });
        setGenerationConfirmError(message);
        throw new Error(message);
      }
      const maxAttempts = 1;
      const renderAttemptToken = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
      const removeImageErrorTurnByTaskIndex = (taskIndex: number) => {
        setUpdates((prev) =>
          prev.filter(
            (item) => !(item.meta?.kind === "image_error" && item.meta.taskIndex === taskIndex),
          ),
        );
      };
      const upsertImageErrorTurn = (task: ImageGenerationTask, errorText: string) => {
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
      };
      setGenerationConfirmError(null);
      setGenerationTaskStateByIndex((prev) => {
        const next = { ...prev };
        const now = Date.now();
        tasks.forEach((task) => {
          const prevState = prev[task.index];
          next[task.index] = {
            index: task.index,
            status: isRetry ? "retrying" : "queued",
            attempts: 0,
            maxAttempts,
            imageUrl: undefined,
            rawImageUrl: undefined,
            runId: activeRunId,
            jobId: currentGenerationJobIdRef.current || undefined,
            source: "current-run",
            error: undefined,
            startedAt: prevState?.startedAt ?? now,
            lastUpdatedAt: now,
          };
        });
        return next;
      });
      const now = Date.now();
      tasks.forEach((task) => {
        setGenerationTaskStateByIndex((prev) => ({
          ...prev,
          [task.index]: {
            ...(prev[task.index] ?? {
              index: task.index,
              status: "queued",
              attempts: 0,
              maxAttempts,
            }),
            status: isRetry ? "retrying" : "generating",
            attempts: 1,
            maxAttempts,
            imageUrl: undefined,
            rawImageUrl: undefined,
            runId: activeRunId,
            jobId: currentGenerationJobIdRef.current || undefined,
            source: "current-run",
            error: undefined,
            startedAt: prev[task.index]?.startedAt ?? now,
            lastUpdatedAt: now,
          },
        }));
      });
      const idempotencyKey = buildStableGenerationIdempotencyKey({
        userEmail: currentEmail || "guest",
        projectId: projectIdRef.current,
        projectTraceId: projectTraceIdRef.current,
        tasks,
      });
      console.info("[workspace-generation] generate-batch request started", {
        runId: activeRunId,
        idempotencyKey,
        taskCount: tasks.length,
        taskIndexes: tasks.map((task) => task.index),
      });
      emitFlowAudit({
        stage: "7.run-generation-batch",
        status: "request-sent",
        decision: "POST-/api/workspace/image/generate-batch",
        reason: "tasks-valid",
        keyFields: {
          activeRunId,
          idempotencyKey,
          taskCount: tasks.length,
          taskIndexes: tasks.map((task) => task.index),
        },
      });
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), GENERATION_REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch("/api/workspace/image/generate-batch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...buildGenerationRequestPayload(tasks),
            idempotencyKey,
            runId: activeRunId,
            imageModelPolicy: "tuzi",
          }),
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as ImageGenerateBatchResponse | null;
        const responseRunId = normalizeGenerationRunId(payload?.job?.runId);
        const responseJobId = (payload?.job?.id || "").trim() || null;
        console.info("[workspace-generation] generate-batch response", {
          ok: response.ok,
          status: response.status,
          responseOk: payload?.ok,
          requestRunId: activeRunId,
          responseRunId,
          responseJobId,
          imageGenerationMode: payload?.imageGenerationMode,
          taskCount: payload?.tasks?.length ?? 0,
          firstImageUrl: payload?.tasks?.[0]?.imageUrl,
          attemptedProviders: payload?.attemptedProviders,
          skippedProviders: payload?.skippedProviders,
        });
        emitFlowAudit({
          stage: "10.frontend-response-parse",
          status: "response-received",
          decision: "parse-batch-response",
          reason: "generate-batch-returned",
          keyFields: {
            httpOk: response.ok,
            httpStatus: response.status,
            responseOk: payload?.ok ?? null,
            responseRunId,
            responseJobId,
            taskCount: payload?.tasks?.length ?? 0,
            attemptedProviders: payload?.attemptedProviders ?? [],
            skippedProviders: payload?.skippedProviders ?? [],
          },
        });
        logWorkspaceImageDebug("[ImageRenderDebug] generate-batch response:", {
          payload,
          ok: payload?.ok,
          imageGenerationMode: payload?.imageGenerationMode,
          tasks: payload?.tasks,
        });
        if (!responseRunId) {
          const missingRunMessage = tr(
            "Generation response is missing run identity. Please retry.",
            "生成响应缺少 runId，请重试。",
          );
          logGenerationCacheGuard("reject-state-write", {
            reason: "missing-response-run",
            requestRunId: activeRunId,
            responseRunId,
            responseJobId,
          });
          tasks.forEach((task) => {
            setGenerationTaskStateByIndex((prev) => ({
              ...prev,
              [task.index]: {
                index: task.index,
                status: "failed",
                attempts: 1,
                maxAttempts,
                error: missingRunMessage,
                runId: activeRunId,
                jobId: responseJobId || currentGenerationJobIdRef.current || undefined,
                source: "current-run",
                startedAt: prev[task.index]?.startedAt ?? Date.now(),
                lastUpdatedAt: Date.now(),
              },
            }));
            upsertImageErrorTurn(task, missingRunMessage);
          });
          setGenerationConfirmError(missingRunMessage);
          return;
        } else if (responseRunId !== activeRunId) {
          logGenerationCacheGuard("ignore-state-write", {
            reason: "stale-job",
            requestRunId: activeRunId,
            responseRunId,
            responseJobId,
          });
          emitFlowAudit({
            stage: "10.frontend-response-parse",
            status: "ignored",
            decision: "skip-stale-response",
            reason: "response-run-does-not-match-request-run",
            keyFields: {
              requestRunId: activeRunId,
              responseRunId,
              responseJobId,
            },
          });
          return;
        }
        if (!responseJobId) {
          const missingJobMessage = tr(
            "Generation response is missing job identity. Please retry.",
            "生成响应缺少 jobId，请重试。",
          );
          logGenerationCacheGuard("reject-state-write", {
            reason: "job-id-mismatch",
            requestRunId: activeRunId,
            responseRunId,
            responseJobId,
          });
          tasks.forEach((task) => {
            setGenerationTaskStateByIndex((prev) => ({
              ...prev,
              [task.index]: {
                index: task.index,
                status: "failed",
                attempts: 1,
                maxAttempts,
                error: missingJobMessage,
                runId: activeRunId,
                source: "current-run",
                startedAt: prev[task.index]?.startedAt ?? Date.now(),
                lastUpdatedAt: Date.now(),
              },
            }));
            upsertImageErrorTurn(task, missingJobMessage);
          });
          setGenerationConfirmError(missingJobMessage);
          return;
        }
        if (responseJobId) {
          if (currentGenerationJobIdRef.current && currentGenerationJobIdRef.current !== responseJobId) {
            logGenerationCacheGuard("accept-state-write", {
              reason: "job-id-switched-same-run",
              requestRunId: activeRunId,
              responseRunId,
              currentJobId: currentGenerationJobIdRef.current,
              responseJobId,
            });
            emitFlowAudit({
              stage: "10.frontend-response-parse",
              status: "accepted",
              decision: "accept-job-switch-same-run",
              reason: "parallel-single-task-jobs-share-one-run",
              keyFields: {
                requestRunId: activeRunId,
                responseRunId,
                currentJobId: currentGenerationJobIdRef.current,
                responseJobId,
              },
            });
          }
          setGenerationRunContext(activeRunId, responseJobId);
        }
        if (!response.ok || !payload?.tasks?.length) {
          const failureMessage =
            payload?.error ||
            (response.ok ? tr("Generation failed.", "生成失败。") : `generation batch failed (${response.status})`);
          tasks.forEach((task) => {
            setGenerationTaskStateByIndex((prev) => ({
              ...prev,
              [task.index]: {
                index: task.index,
                status: "failed",
                attempts: 1,
                maxAttempts,
                error: failureMessage,
                runId: activeRunId,
                jobId: responseJobId || currentGenerationJobIdRef.current || undefined,
                source: "current-run",
                startedAt: prev[task.index]?.startedAt ?? Date.now(),
                lastUpdatedAt: Date.now(),
              },
            }));
            upsertImageErrorTurn(task, failureMessage);
          });
          setGenerationConfirmError(failureMessage);
          logClientEvent({
            category: "image",
            action: "image_generation_request_failed",
            status: "error",
            source: imageModel,
            code: payload?.code || String(response.status),
            message: failureMessage,
            details: {
              statusCode: response.status,
              payload,
            },
          });
          return;
        }

        const normalizedResults = normalizeImageBatchTaskResults({
          taskResults: payload.tasks as ImageBatchTaskResultLike[],
          requestedTaskIndexes: tasks.map((task) => task.index),
        });

        const normalizedResultMap = new Map<number, (typeof normalizedResults)[number]>();
        normalizedResults.forEach((item) => {
          logWorkspaceImageDebug("[ImageRenderDebug] response task parsed:", {
            resultPosition: item.resultPosition,
            backendTaskIndex: item.backendTaskIndex,
            mappedStateIndex: item.mappedStateIndex,
            backendStatus: item.task.status,
            backendOk: item.task.ok,
            imageUrl: item.task.imageUrl,
            renderUrl: item.task.renderUrl,
            rawImageUrl: item.task.rawImageUrl,
            image_url: item.task.image_url,
            render_url: item.task.render_url,
            raw_image_url: item.task.raw_image_url,
            finalImageUrl: item.finalImageUrl,
          });
          if (Number.isFinite(item.mappedStateIndex)) {
            normalizedResultMap.set(item.mappedStateIndex as number, item);
          }
        });
        let hasFailed = false;
        tasks.forEach((task) => {
          const normalizedResult = normalizedResultMap.get(task.index);
          const result = normalizedResult?.task;
          const finalImageUrl = normalizedResult?.finalImageUrl || "";
          const renderImageUrl = appendKnowLensRenderAttemptToken(
            finalImageUrl,
            `${renderAttemptToken}-${task.index}`,
          );
          const normalizedStatus = normalizedResult?.normalizedStatus || "";
          const shouldMarkSuccess = normalizedResult?.shouldMarkSuccess === true;
          logWorkspaceImageDebug("[ImageRenderDebug] result normalized:", {
            requestedTaskIndex: task.index,
            backendTaskIndex: normalizedResult?.backendTaskIndex ?? result?.index,
            normalizedStatus,
            backendOk: result?.ok,
            finalImageUrl,
            renderImageUrl,
          });
          if (shouldMarkSuccess) {
            removeImageErrorTurnByTaskIndex(task.index);
            setGenerationTaskStateByIndex((prev) => {
              if (!activeRunId) {
                logGenerationCacheGuard("reject-state-write", {
                  reason: "no-current-generation",
                  taskIndex: task.index,
                  finalImageUrl,
                });
                return prev;
              }
              const nextState: GenerationTaskUiState = {
                index: task.index,
                status: "success",
                attempts: 1,
                maxAttempts,
                imageUrl: renderImageUrl || finalImageUrl,
                rawImageUrl: result?.rawImageUrl || undefined,
                runId: activeRunId,
                jobId: responseJobId || currentGenerationJobIdRef.current || undefined,
                source: "current-run",
                startedAt: prev[task.index]?.startedAt ?? Date.now(),
                lastUpdatedAt: Date.now(),
              };
              const next = {
                ...prev,
                [task.index]: nextState,
              };
              logWorkspaceImageDebug("[ImageRenderDebug] state write before PosterCanvas (success):", {
                index: task.index,
                oldState: prev[task.index],
                newState: nextState,
                newStatus: nextState.status,
                newImageUrl: nextState.imageUrl,
              });
              console.info("[workspace-generation] generationTaskStateByIndex success + imageUrl", {
                index: task.index,
                status: nextState.status,
                imageUrl: nextState.imageUrl,
              });
              emitFlowAudit({
                stage: "10.frontend-state-write",
                status: "success",
                decision: "set-generationTaskStateByIndex",
                reason: "task-success",
                keyFields: {
                  index: task.index,
                  runId: activeRunId,
                  jobId: responseJobId || currentGenerationJobIdRef.current || null,
                  imageUrl: nextState.imageUrl || null,
                },
              });
              return next;
            });
            logClientEvent({
              category: "image",
              action: "image_generation_success",
              status: "ok",
              source: imageModel,
              message: "Image generation completed successfully.",
              projectId: projectIdRef.current ?? null,
              details: {
                taskIndex: task.index,
                imageUrl: renderImageUrl || finalImageUrl,
                outputType: task.outputType,
                taskStatus: result?.status || null,
                taskId: result?.taskId || null,
              },
            });
            return;
          }
          hasFailed = true;
          const nextError =
            result?.error ||
            tr("Generation failed.", "生成失败。");
          setGenerationTaskStateByIndex((prev) => {
            const nextState: GenerationTaskUiState = {
              index: task.index,
              status: "failed",
              attempts: 1,
              maxAttempts,
              error: nextError,
              imageUrl: undefined,
              rawImageUrl: result?.rawImageUrl || undefined,
              runId: activeRunId,
              jobId: responseJobId || currentGenerationJobIdRef.current || undefined,
              source: "current-run",
              startedAt: prev[task.index]?.startedAt ?? Date.now(),
              lastUpdatedAt: Date.now(),
            };
            const next = {
              ...prev,
              [task.index]: nextState,
            };
            logWorkspaceImageDebug("[ImageRenderDebug] state write before PosterCanvas (failed):", {
              index: task.index,
              oldState: prev[task.index],
              newState: nextState,
              newStatus: nextState.status,
              newImageUrl: nextState.imageUrl,
            });
            emitFlowAudit({
              stage: "10.frontend-state-write",
              status: "failed",
              decision: "set-generationTaskStateByIndex",
              reason: "task-failed",
              keyFields: {
                index: task.index,
                runId: activeRunId,
                jobId: responseJobId || currentGenerationJobIdRef.current || null,
                error: nextError,
              },
            });
            return next;
          });
          upsertImageErrorTurn(task, nextError);
          logClientEvent({
            category: "image",
            action: "image_generation_result_failed",
            status: "error",
            source: imageModel,
            code: result?.errorCode || "IMAGE_TASK_FAILED",
            message: nextError,
            projectId: projectIdRef.current ?? null,
            details: {
              taskIndex: task.index,
              taskId: result?.taskId || null,
              outputType: task.outputType,
              taskStatus: result?.status || null,
            },
          });
        });
        setGenerationConfirmError(hasFailed ? tr("Some tasks failed. Please retry failed cards.", "部分任务失败，请重试失败卡片。") : null);
      } catch (error) {
        const lastError =
          error instanceof DOMException && error.name === "AbortError"
            ? tr("Generation timed out.", "生成超时。")
            : error instanceof Error
              ? error.message
              : tr("Generation failed.", "生成失败。");
        tasks.forEach((task) => {
          setGenerationTaskStateByIndex((prev) => ({
            ...prev,
            [task.index]: {
              index: task.index,
              status: "failed",
              attempts: 1,
              maxAttempts,
              error: lastError,
              imageUrl: undefined,
              rawImageUrl: undefined,
              runId: activeRunId,
              jobId: currentGenerationJobIdRef.current || undefined,
              source: "current-run",
              startedAt: prev[task.index]?.startedAt ?? Date.now(),
              lastUpdatedAt: Date.now(),
            },
          }));
          upsertImageErrorTurn(task, lastError);
        });
        setGenerationConfirmError(lastError);
        logClientEvent({
          category: "image",
          action: "image_generation_exception",
          status: "error",
          source: imageModel,
          message: lastError || tr("Generation failed.", "生成失败。"),
          projectId: projectIdRef.current ?? null,
          details: {
            taskIndexes: tasks.map((task) => task.index),
            stack: error instanceof Error ? error.stack : undefined,
          },
        });
      } finally {
        window.clearTimeout(timeoutId);
      }
    },
    [buildGenerationRequestPayload, currentEmail, emitFlowAudit, imageModel, setGenerationRunContext, tr],
  );
  const runGenerationTasksOrdered = useCallback(
    async (tasks: ImageGenerationTask[], runId: string, isRetry = false) => {
      if (!tasks.length) {
        return;
      }
      const maxParallel = Math.max(
        1,
        Math.min(4, Number.parseInt(process.env.NEXT_PUBLIC_IMAGE_GENERATION_PARALLEL || "3", 10) || 3),
      );
      emitFlowAudit({
        stage: "7.run-generation-batch",
        status: "ordered-dispatch-started",
        decision: "request-tasks-in-order-with-limited-parallelism",
        reason: "reduce-total-wait-time",
        keyFields: {
          runId,
          taskCount: tasks.length,
          taskIndexes: tasks.map((task) => task.index),
          maxParallel,
          isRetry,
        },
      });
      let cursor = 0;
      const workers = Array.from({ length: Math.min(maxParallel, tasks.length) }, () => (async () => {
        while (true) {
          const task = tasks[cursor];
          cursor += 1;
          if (!task) {
            return;
          }
          // Ordered dispatch starts jobs in index order, but does not wait for previous job completion.
          // Multiple single-task jobs can run concurrently under the same run id.
          setGenerationRunContext(runId, null);
          await runGenerationBatch([task], isRetry, runId);
        }
      })());
      await Promise.all(workers);
    },
    [emitFlowAudit, runGenerationBatch, setGenerationRunContext],
  );
  const handleRetryGenerationTask = useCallback(
    (index: number) => {
      const task = imageGenerationTaskByIndex.get(index);
      if (!task) {
        return;
      }
      if (generationRequestInFlightRef.current) {
        setGenerationConfirmError(
          tr("Generation is in progress. Please retry after current tasks finish.", "当前仍在生成中，请等待本轮结束后重试。"),
        );
        return;
      }
      const nextRunId = createGenerationRunId();
      setGenerationRunContext(nextRunId, null);
      generationRequestInFlightRef.current = true;
      void runGenerationTasksOrdered([task], nextRunId, true).finally(() => {
        generationRequestInFlightRef.current = false;
      });
    },
    [imageGenerationTaskByIndex, runGenerationTasksOrdered, setGenerationRunContext, tr],
  );
  const handleRedrawGenerationTask = useCallback(
    (index: number, copy: string) => {
      const baseTask = imageGenerationTaskByIndex.get(index);
      if (!baseTask) {
        return;
      }
      if (generationRequestInFlightRef.current) {
        setGenerationConfirmError(
          tr("Generation is in progress. Please retry after current tasks finish.", "当前仍在生成中，请等待本轮结束后重试。"),
        );
        return;
      }

      const parsedCopy = parsePosterCardCopy(copy, baseTask.contentTitle || `Poster ${index}`);
      const contentBody = compactLineText([parsedCopy.pageFocus, ...parsedCopy.contentLines].join("\n"));
      const visibleText: VisibleText = {
        title: parsedCopy.title || baseTask.visibleText?.title || baseTask.contentTitle,
        subtitle: baseTask.visibleText?.subtitle || "",
        labels: splitToShortLabels(parsedCopy.contentLines, 4),
      };
      const visualDesign: VisualDesign = {
        ...baseTask.visualDesign,
        mainVisual: parsedCopy.visualStructure || baseTask.visualDesign.mainVisual,
        composition: compactLineText(
          [baseTask.visualDesign.composition, `Redraw focus: ${parsedCopy.pageFocus}`]
            .filter(Boolean)
            .join(" | "),
        ),
      };
      const redrawTask: ImageGenerationTask = {
        ...baseTask,
        contentTitle: parsedCopy.title || baseTask.contentTitle,
        contentBody: contentBody || baseTask.contentBody,
        visibleText,
        visualDesign,
        visualHint: compactLineText(
          [parsedCopy.pageFocus, ...parsedCopy.contentLines, parsedCopy.visualStructure]
            .filter(Boolean)
            .join(" | "),
        ),
        imagePromptDraft: compactLineText(copy).slice(0, 500),
      };
      redrawTask.composedPrompt = buildTuziImagePrompt({
        draftContent: compactLineText([redrawTask.contentTitle, redrawTask.contentBody, redrawTask.visualHint].join("\n")),
        selectedStyle: redrawTask.styleName || redrawTask.stylePrompt,
        aspectRatio: redrawTask.aspectRatio,
        posterIndex: redrawTask.index,
        totalCount: normalizedGenerationConfig.normalizedCount,
        outputType: redrawTask.outputType,
        fullContent: topic,
        visualType: parsedCopy.visualStructure || redrawTask.visualDesign.mainVisual,
        imagePromptDraft: redrawTask.imagePromptDraft,
        visibleText: redrawTask.visibleText,
        visualDesign: redrawTask.visualDesign,
        pageRole: redrawTask.pageRole,
        textStrategy: redrawTask.textStrategy || {
          mode: "guided",
          titleIdea: redrawTask.contentTitle,
          keyConcepts: splitToShortLabels([parsedCopy.pageFocus, ...parsedCopy.contentLines], 5),
          language: outputLanguage.toLowerCase().startsWith("zh") ? "Simplified Chinese" : "English",
          density: redrawTask.visualDesign.textDensity,
          allowRewrite: true,
        },
        factualRules: redrawTask.factualRules,
        negativeRules: redrawTask.negativeRules,
        seriesStyle: redrawTask.seriesStyle,
      });

      const nextRunId = createGenerationRunId();
      setGenerationRunContext(nextRunId, null);
      generationRequestInFlightRef.current = true;
      setGenerationConfirmError(null);
      void runGenerationTasksOrdered([redrawTask], nextRunId, true).finally(() => {
        generationRequestInFlightRef.current = false;
      });
    },
    [
      imageGenerationTaskByIndex,
      normalizedGenerationConfig.normalizedCount,
      outputLanguage,
      runGenerationTasksOrdered,
      setGenerationRunContext,
      topic,
      tr,
    ],
  );
  const startGenerationFromCanvas = useCallback(
    async (reason: "auto-generate-missing-current-run-image") => {
      emitFlowAudit({
        stage: "6.auto-trigger-exec",
        status: "started",
        decision: "start-generation-from-canvas",
        reason,
      });
      if (generationRequestInFlightRef.current) {
        return;
      }
      let tasksToGenerate: ImageGenerationTask[] = [];
      try {
        tasksToGenerate = buildFreshImageGenerationTasks();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : tr("Generation tasks are invalid.", "生成任务参数无效。");
        setGenerationConfirmError(message);
        return;
      }
      if (!tasksToGenerate.length) {
        const message = tr("No generation tasks are ready.", "没有可生成的任务。");
        setGenerationConfirmError(message);
        emitFlowAudit({
          stage: "6.auto-trigger-exec",
          status: "aborted",
          decision: "no-request",
          reason: "empty-tasks",
          keyFields: { message },
        });
        return;
      }
      const runId = normalizeGenerationRunId(currentGenerationRunIdRef.current) || createGenerationRunId();
      if (autoGenerationTriggeredRunIdsRef.current[runId]) {
        return;
      }
      autoGenerationTriggeredRunIdsRef.current[runId] = true;
      setGenerationRunContext(runId, null);
      generationRequestInFlightRef.current = true;
      const startedAt = Date.now();
      const pendingState: Record<number, GenerationTaskUiState> = {};
      tasksToGenerate.forEach((task) => {
        pendingState[task.index] = {
          index: task.index,
          status: "queued",
          attempts: 0,
          maxAttempts: 1,
          runId,
          source: "current-run",
          startedAt,
          lastUpdatedAt: startedAt,
        };
      });
      setGenerationTaskStateByIndex(pendingState);
      setGenerationConfirmError(null);
      logGenerationCacheGuard("auto-run-triggered", {
        reason,
        runId,
        taskCount: tasksToGenerate.length,
        taskIndexes: tasksToGenerate.map((task) => task.index),
      });
      try {
        await runGenerationTasksOrdered(tasksToGenerate, runId, false);
      } finally {
        generationRequestInFlightRef.current = false;
      }
    },
    [buildFreshImageGenerationTasks, emitFlowAudit, runGenerationTasksOrdered, setGenerationRunContext, tr],
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
  useEffect(() => {
    if (debugGoGenerateStepEnabled || debugImageBridgeEnabled) {
      emitFlowAudit({
        stage: "6.auto-trigger-check",
        status: "skipped",
        decision: "no-auto-trigger",
        reason: "debug-mode-enabled",
        keyFields: {
          debugGoGenerateStepEnabled,
          debugImageBridgeEnabled,
        },
      });
      return;
    }
    if (flowStage !== "generate" || !billingConfirmed || effectiveIntent !== "poster") {
      emitFlowAudit({
        stage: "6.auto-trigger-check",
        status: "skipped",
        decision: "no-auto-trigger",
        reason: "flow-or-intent-not-ready",
        keyFields: {
          flowStage,
          billingConfirmed,
          effectiveIntent,
        },
      });
      return;
    }
    if (generationRequestInFlightRef.current || isPlanningBillingStep) {
      emitFlowAudit({
        stage: "6.auto-trigger-check",
        status: "skipped",
        decision: "no-auto-trigger",
        reason: "request-in-flight",
        keyFields: {
          generationRequestInFlight: generationRequestInFlightRef.current,
          isPlanningBillingStep,
        },
      });
      return;
    }

    const currentRunId = normalizeGenerationRunId(currentGenerationRunIdRef.current);
    const states = Object.values(generationTaskStateByIndex);
    const currentRunStates = currentRunId
      ? states.filter(
          (item) =>
            normalizeGenerationRunId(item.runId) === currentRunId &&
            item.source === "current-run",
        )
      : [];
    const currentRunSuccessStates = currentRunStates.filter(
      (item) => item.status === "success" && Boolean(item.imageUrl),
    );
    const hasCurrentRunSuccess = currentRunSuccessStates.length > 0;
    const hasRenderableCurrentRunSuccess = currentRunSuccessStates.some(
      (item) => !isMockAssetRenderUrl(item.imageUrl),
    );
    const hasOnlyMockCurrentRunSuccess =
      hasCurrentRunSuccess && !hasRenderableCurrentRunSuccess;
    const hasCurrentRunProcessing = currentRunStates.some(
      (item) =>
        item.status === "queued" ||
        item.status === "generating" ||
        item.status === "retrying",
    );
    const hasCurrentRunFailed = currentRunStates.some((item) => item.status === "failed");

    if (
      hasRenderableCurrentRunSuccess ||
      hasCurrentRunProcessing ||
      hasCurrentRunFailed
    ) {
      emitFlowAudit({
        stage: "6.auto-trigger-check",
        status: "skipped",
        decision: "no-auto-trigger",
        reason: hasOnlyMockCurrentRunSuccess
          ? "mock-success-does-not-block-auto-trigger"
          : "current-run-already-has-state",
        keyFields: {
          currentRunId,
          hasCurrentRunSuccess,
          hasRenderableCurrentRunSuccess,
          hasOnlyMockCurrentRunSuccess,
          hasCurrentRunProcessing,
          hasCurrentRunFailed,
          currentRunStates: currentRunStates.map((item) => ({
            index: item.index,
            status: item.status,
            imageUrl: item.imageUrl || null,
            runId: item.runId || null,
            jobId: item.jobId || null,
          })),
        },
      });
      return;
    }

    const autoTriggerKey = currentRunId || `auto-seed-${generationSessionSeed}`;
    if (autoGenerationTriggeredRunIdsRef.current[autoTriggerKey]) {
      emitFlowAudit({
        stage: "6.auto-trigger-check",
        status: "skipped",
        decision: "no-auto-trigger",
        reason: "auto-trigger-already-fired",
        keyFields: {
          autoTriggerKey,
        },
      });
      return;
    }
    autoGenerationTriggeredRunIdsRef.current[autoTriggerKey] = true;
    emitFlowAudit({
      stage: "6.auto-trigger-check",
      status: "triggered",
      decision: "startGenerationFromCanvas",
      reason: "missing-current-run-image",
      keyFields: {
        autoTriggerKey,
        currentRunId,
      },
    });
    void startGenerationFromCanvas("auto-generate-missing-current-run-image");
  }, [
    emitFlowAudit,
    billingConfirmed,
    debugGoGenerateStepEnabled,
    debugImageBridgeEnabled,
    effectiveIntent,
    flowStage,
    generationSessionSeed,
    generationTaskStateByIndex,
    isPlanningBillingStep,
    startGenerationFromCanvas,
  ]);

  useEffect(() => {
    const currentUrl =
      typeof window !== "undefined" ? window.location.href : "/workspace";
    emitFlowAudit({
      stage: "1.page-enter",
      status: "observed",
      decision: "entered-workspace",
      reason: "workspace-client-mounted",
      keyFields: {
        url: currentUrl,
        debugGoGenerateStepEnabled,
        debugImageBridgeEnabled,
        queryProjectId: searchParams.get("projectId") || null,
        flowStage,
        showPosterCanvas,
        showStoryboard,
        billingConfirmed,
        generationStateCount: Object.keys(generationTaskStateByIndex).length,
      },
    });
  }, [
    billingConfirmed,
    debugGoGenerateStepEnabled,
    debugImageBridgeEnabled,
    emitFlowAudit,
    flowStage,
    generationTaskStateByIndex,
    searchParams,
    showPosterCanvas,
    showStoryboard,
  ]);

  useEffect(() => {
    emitFlowAudit({
      stage: "2.project-restore",
      status: "observed",
      decision: "restore-from-home-draft-or-cache",
      reason: "initial-entry-parsed",
      keyFields: {
        sourceProjectId: initialEntry.project?.projectId || null,
        sourceProjectTraceId: initialEntry.project?.projectTraceId || null,
        sourcePromptLength: initialEntry.prompt.length,
        sourceCount: initialEntry.sources.length,
        sessionScopeKey: sessionPrefsScopeKey,
        restoredChatHistoryCount: readWorkspaceChatHistory(sessionPrefsScopeKey).length,
      },
    });
  }, [emitFlowAudit, initialEntry.project?.projectId, initialEntry.project?.projectTraceId, initialEntry.prompt.length, initialEntry.sources.length, sessionPrefsScopeKey]);

  useEffect(() => {
    emitFlowAudit({
      stage: "3.draft-content",
      status: "observed",
      decision: "draft-ready-check",
      reason: "draft-state-evaluated",
      keyFields: {
        intent: effectiveIntent,
        hasPosterDraft: Boolean(posterDraft),
        posterDraftSource: editablePosterDraft ? "editablePosterDraft" : basePosterDraft ? "basePosterDraft" : "none",
        posterPlanCount: (editablePosterPlanList.length ? editablePosterPlanList : basePosterPlanList).length,
        outlineCount: outlineItems.length,
        slideDraftCount: densityAdjustedSlideDrafts.length,
      },
    });
  }, [
    basePosterDraft,
    basePosterPlanList,
    densityAdjustedSlideDrafts.length,
    editablePosterDraft,
    editablePosterPlanList,
    effectiveIntent,
    emitFlowAudit,
    outlineItems.length,
    posterDraft,
  ]);

  useEffect(() => {
    emitFlowAudit({
      stage: "4.config-style-ratio-quantity",
      status: "observed",
      decision: "generation-config-evaluated",
      reason: "config-state-updated",
      keyFields: {
        selectedStyleId,
        selectedAspectRatio: normalizedGenerationConfig.normalizedRatio,
        quantity: normalizedGenerationConfig.normalizedCount,
        selectedImageModel: initialEntry.models?.imageModel || "gpt-image-2",
        provider: "tuzi",
        canBuildGenerationTasks: imageGenerationTasks.length > 0,
        imageGenerationTasksLength: imageGenerationTasks.length,
      },
    });
  }, [
    emitFlowAudit,
    imageGenerationTasks.length,
    initialEntry.models?.imageModel,
    normalizedGenerationConfig.normalizedCount,
    normalizedGenerationConfig.normalizedRatio,
    selectedStyleId,
  ]);

  useEffect(() => {
    if (flowStage !== "generate") {
      return;
    }
    emitFlowAudit({
      stage: "5.enter-canvas-generate-step",
      status: "observed",
      decision: "entered-generate-step",
      reason: "flowStage-is-generate",
      keyFields: {
        billingConfirmed,
        currentGenerationRunId: currentGenerationRunIdRef.current,
        currentGenerationJobId: currentGenerationJobIdRef.current,
        generationRequestInFlight: generationRequestInFlightRef.current,
        imageGenerationTasksLength: imageGenerationTasks.length,
        generationStateByIndex: Object.fromEntries(
          Object.entries(generationTaskStateByIndex).map(([index, state]) => [
            index,
            {
              status: state.status,
              imageUrl: state.imageUrl || null,
              runId: state.runId || null,
              jobId: state.jobId || null,
            },
          ]),
        ),
      },
    });
  }, [billingConfirmed, emitFlowAudit, flowStage, generationTaskStateByIndex, imageGenerationTasks.length]);
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
    const authRequired = isAuthRequiredErrorMessage(message);
    return {
      userMessage: message,
      code: codeMatch?.[1],
      authRequired,
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

  useEffect(() => {
    if (flowStage !== "generate") {
      return;
    }
    if (!Object.keys(generationTaskStateByIndex).length) {
      return;
    }
    const timer = window.setInterval(() => {
      const now = Date.now();
      const timedOutTaskIndexes = Object.values(generationTaskStateByIndex)
        .filter((item) => {
          const active = item.status === "queued" || item.status === "generating" || item.status === "retrying";
          if (!active) {
            return false;
          }
          const startedAt = item.startedAt ?? item.lastUpdatedAt ?? now;
          return now - startedAt > GENERATION_UI_HARD_TIMEOUT_MS;
        })
        .map((item) => item.index);
      if (!timedOutTaskIndexes.length) {
        return;
      }
      setGenerationTaskStateByIndex((prev) => {
        const next = { ...prev };
        timedOutTaskIndexes.forEach((index) => {
          const taskState = next[index];
          if (!taskState) {
            return;
          }
          if (taskState.status === "success" || taskState.status === "failed") {
            return;
          }
          next[index] = {
            ...taskState,
            status: "failed",
            error: tr("Generation timed out. Please retry this card.", "生成超时，请重试该卡片。"),
            lastUpdatedAt: now,
          };
          const task = imageGenerationTaskByIndex.get(index);
          if (task) {
            upsertImageErrorCard(
              task,
              tr("Generation timed out. Please retry this card.", "生成超时，请重试该卡片。"),
            );
          }
        });
        return next;
      });
    }, 3000);
    return () => window.clearInterval(timer);
  }, [flowStage, generationTaskStateByIndex, imageGenerationTaskByIndex, tr, upsertImageErrorCard]);

  useEffect(() => {
    const entries = Object.entries(generationTaskStateByIndex).map(([index, state]) => ({
      index: Number(index),
      status: state.status,
      imageUrl: state.imageUrl || null,
      runId: state.runId || null,
      jobId: state.jobId || null,
      source: state.source || null,
    }));
    if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
      (
        window as Window & {
          __workspaceGenerationDebug?: unknown;
        }
      ).__workspaceGenerationDebug = {
        entries,
        imageGenerationTasksLength: imageGenerationTasks.length,
        flowStage,
        currentGenerationRunId,
        currentGenerationJobId,
      };
    }
    console.info("[workspace-generation] state snapshot", JSON.stringify({
      entries,
      imageGenerationTasksLength: imageGenerationTasks.length,
      flowStage,
      currentGenerationRunId,
      currentGenerationJobId,
    }));
    logWorkspaceImageDebug("[ImageRenderDebug] generationTaskStateByIndex snapshot:", {
      generationTaskStateByIndex,
      entries,
    });
  }, [currentGenerationJobId, currentGenerationRunId, flowStage, generationTaskStateByIndex, imageGenerationTasks.length]);

  useEffect(() => {
    if (!showPosterCanvas) {
      return;
    }
    const taskSummaries = imageGenerationTasks.map((task) => {
      const taskState = generationTaskStateByIndex[task.index];
      return {
        index: task.index,
        status: taskState?.status ?? "missing",
        imageUrl: taskState?.imageUrl ?? null,
      };
    });
    logWorkspaceImageDebug("[ImageRenderDebug] PosterCanvas props preview:", {
      generationTaskStateByIndex,
      taskSummaries,
    });
  }, [generationTaskStateByIndex, imageGenerationTasks, showPosterCanvas]);

  function pushUserMessage(content: string, module = "内容改写") {
    setUpdates((prev) => {
      const last = prev[prev.length - 1];
      if (
        last &&
        last.role === "user" &&
        last.module === module &&
        last.content.trim() === content.trim()
      ) {
        return prev;
      }
      return [
        ...prev,
        {
          id: `u-${Date.now()}-${Math.round(Math.random() * 9999)}`,
          role: "user",
          module,
          content,
        },
      ];
    });
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
    clearCurrentGenerationState("reset-to-config-stage");
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
    clearCurrentGenerationState("topic-suggestion-confirmed");
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
      setDraftLlmUsage(null);
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
            normalizedDirection: effectiveIntent,
            normalizedCount: count,
            normalizedRatio: ratioOrSize,
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
          slideDrafts?: Array<SlideDraft & { imagePromptDraft?: string }>;
          storyboardDrafts?: Array<{
            index: number;
            title: string;
            narration?: string;
            visual?: string;
            imagePrompt?: string;
            imagePromptDraft?: string;
          }>;
          llmUsage?: DraftLlmUsage;
        };
        if (
          data.llmUsage &&
          Number.isFinite(data.llmUsage.totalTokens) &&
          Number(data.llmUsage.totalTokens) > 0
        ) {
          setDraftLlmUsage({
            inputTokens: Math.max(0, Math.round(data.llmUsage.inputTokens || 0)),
            outputTokens: Math.max(0, Math.round(data.llmUsage.outputTokens || 0)),
            totalTokens: Math.max(1, Math.round(data.llmUsage.totalTokens)),
            source: data.llmUsage.source,
            model: data.llmUsage.model,
          });
        } else {
          setDraftLlmUsage(null);
        }
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
            imagePromptDraft: item.imagePromptDraft?.trim() || item.imagePrompt?.trim() || "",
            imagePrompt: item.imagePromptDraft?.trim() || item.imagePrompt?.trim() || "",
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
            imagePromptDraft: item.imagePromptDraft?.trim() || item.imagePrompt?.trim() || "",
            imagePrompt: item.imagePromptDraft?.trim() || item.imagePrompt?.trim() || "",
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
        if (parsed.authRequired) {
          if (existingErrorTurnId) {
            removeErrorTurn(existingErrorTurnId);
          }
          pushAssistantMessage(
            tr("Please sign in to continue.", "请先登录后继续。"),
            tr("Request Guard", "请求保护"),
          );
          await ensureThinkingVisible();
          return false;
        }
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
    setDraftLlmUsage(null);
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
          normalizedDirection: effectiveIntent,
          normalizedCount: posterCount,
          normalizedRatio: posterSizeLabel,
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
        llmUsage?: DraftLlmUsage;
        _internal?: {
          renderSpec?: unknown;
          modelPrompt?: string;
        };
      };
      if (posterDraftRequestRef.current !== requestId) {
        return false;
      }
      if (
        data.llmUsage &&
        Number.isFinite(data.llmUsage.totalTokens) &&
        Number(data.llmUsage.totalTokens) > 0
      ) {
        setDraftLlmUsage({
          inputTokens: Math.max(0, Math.round(data.llmUsage.inputTokens || 0)),
          outputTokens: Math.max(0, Math.round(data.llmUsage.outputTokens || 0)),
          totalTokens: Math.max(1, Math.round(data.llmUsage.totalTokens)),
          source: data.llmUsage.source,
          model: data.llmUsage.model,
        });
      } else {
        setDraftLlmUsage(null);
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
      if (parsed.authRequired) {
        if (existingErrorTurnId) {
          removeErrorTurn(existingErrorTurnId);
        }
        pushAssistantMessage(
          tr("Please sign in to continue.", "请先登录后继续。"),
          tr("Request Guard", "请求保护"),
        );
        return false;
      }
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
    removeErrorTurn,
    posterCount,
    posterSizeId,
    posterSizeLabel,
    pptPageCount,
    pptRatio,
    pushAssistantMessage,
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
    clearCurrentGenerationState("style-next-to-billing");
    stopThinking();
    setIsPlanningStyleStep(false);
  }

  const handleSelectStyle = useCallback((styleId: string) => {
    if (!styleId || styleId === selectedStyleId) {
      return;
    }
    setSelectedStyleId(styleId);
    const hasExistingGenerationState = Object.keys(generationTaskStateByIndex).length > 0;
    if (!hasExistingGenerationState && !billingConfirmed && flowStage !== "generate") {
      return;
    }
    setBillingConfirmed(false);
    clearCurrentGenerationState("style-changed");
    if (flowStage === "generate") {
      setFlowStage("billing");
    }
  }, [
    billingConfirmed,
    clearCurrentGenerationState,
    flowStage,
    generationTaskStateByIndex,
    selectedStyleId,
  ]);

  async function handleConfirmBilling() {
    let tasksToGenerate: ImageGenerationTask[] = [];
    try {
      tasksToGenerate = buildFreshImageGenerationTasks();
    } catch (error) {
      const message = error instanceof Error ? error.message : tr("Generation tasks are invalid.", "生成任务参数无效。");
      setGenerationConfirmError(message);
      pushAssistantMessage(message, tr("Generation", "生成"));
      return;
    }
    const expectedCount =
      effectiveIntent === "poster" ? posterCount : effectiveIntent === "ppt" ? pptPageCount : videoStoryboardCount;
    const invalidTask = tasksToGenerate.find(
      (task) =>
        !task.composedPrompt?.trim() ||
        !task.aspectRatio?.trim() ||
        !task.size?.trim(),
    );
    console.info("[workspace-generation] handleConfirmBilling called", {
      flowStage,
      credits,
      billingCost,
      canConfirmBilling,
      isPlanningBillingStep,
      generationRequestInFlight: generationRequestInFlightRef.current,
      imageGenerationTasksLength: imageGenerationTasks.length,
      freshTaskCount: tasksToGenerate.length,
      freshTaskIndexes: tasksToGenerate.map((task) => task.index),
      expectedTaskCount: expectedCount,
      debugGoGenerateStepEnabled,
    });
    emitFlowAudit({
      stage: "7.confirm-generation",
      status: "entered",
      decision: "handleConfirmBilling-called",
      reason: "user-confirm-or-auto-confirm",
      keyFields: {
        flowStage,
        credits,
        billingCost,
        canConfirmBilling,
        isPlanningBillingStep,
        generationRequestInFlight: generationRequestInFlightRef.current,
        imageGenerationTasksLength: imageGenerationTasks.length,
        freshTaskCount: tasksToGenerate.length,
        expectedTaskCount: expectedCount,
      },
    });
    if (generationRequestInFlightRef.current) {
      console.info("[workspace-generation] handleConfirmBilling early return", {
        reason: "generationRequestInFlight",
      });
      emitFlowAudit({
        stage: "7.confirm-generation",
        status: "early-return",
        decision: "abort",
        reason: "generationRequestInFlight",
      });
      return;
    }
    if (credits < billingCost && !debugGoGenerateStepEnabled) {
      console.info("[workspace-generation] handleConfirmBilling early return", {
        reason: "insufficientCredits",
        credits,
        billingCost,
      });
      emitFlowAudit({
        stage: "7.confirm-generation",
        status: "early-return",
        decision: "abort",
        reason: "insufficientCredits",
        keyFields: { credits, billingCost },
      });
      pushAssistantMessage(
        isZhOutput
          ? `当前积分不足（余额 ${credits}，需要 ${billingCost}）。请先升级后再继续。`
          : `Insufficient credits (balance: ${credits}, required: ${billingCost}). Please upgrade first.`,
        tr("Billing Check", "账单确认"),
      );
      return;
    }
    if (isPlanningBillingStep) {
      console.info("[workspace-generation] handleConfirmBilling early return", {
        reason: "isPlanningBillingStep",
      });
      emitFlowAudit({
        stage: "7.confirm-generation",
        status: "early-return",
        decision: "abort",
        reason: "isPlanningBillingStep",
      });
      return;
    }
    if (flowStage !== "billing") {
      const message = tr("Generation can only be confirmed at the billing step.", "仅可在账单确认步骤发起生成。");
      console.info("[workspace-generation] handleConfirmBilling early return", {
        reason: "invalidFlowStage",
        flowStage,
      });
      emitFlowAudit({
        stage: "7.confirm-generation",
        status: "early-return",
        decision: "abort",
        reason: "invalidFlowStage",
        keyFields: { flowStage },
      });
      setGenerationConfirmError(message);
      pushAssistantMessage(message, tr("Generation", "生成"));
      return;
    }
    if (!tasksToGenerate.length) {
      const message = tr("No generation tasks are ready.", "没有可生成的任务。");
      console.info("[workspace-generation] handleConfirmBilling early return", {
        reason: "emptyGenerationTasks",
      });
      emitFlowAudit({
        stage: "7.confirm-generation",
        status: "early-return",
        decision: "abort",
        reason: "emptyGenerationTasks",
      });
      setGenerationConfirmError(message);
      pushAssistantMessage(message, tr("Generation", "生成"));
      return;
    }
    if (tasksToGenerate.length !== expectedCount) {
      const message = tr("Task count does not match selected output quantity.", "任务数量与选择的输出数量不一致。");
      console.info("[workspace-generation] handleConfirmBilling early return", {
        reason: "taskCountMismatch",
        expectedCount,
        actualCount: tasksToGenerate.length,
      });
      emitFlowAudit({
        stage: "7.confirm-generation",
        status: "early-return",
        decision: "abort",
        reason: "taskCountMismatch",
        keyFields: {
          expectedCount,
          actualCount: tasksToGenerate.length,
        },
      });
      setGenerationConfirmError(message);
      pushAssistantMessage(message, tr("Generation", "生成"));
      return;
    }
    if (invalidTask) {
      const message = tr(
        `Task ${invalidTask.index} is missing prompt or size.`,
        `任务 ${invalidTask.index} 缺少提示词或尺寸配置。`,
      );
      console.info("[workspace-generation] handleConfirmBilling early return", {
        reason: "invalidTaskPayload",
        invalidTaskIndex: invalidTask.index,
      });
      emitFlowAudit({
        stage: "7.confirm-generation",
        status: "early-return",
        decision: "abort",
        reason: "invalidTaskPayload",
        keyFields: { invalidTaskIndex: invalidTask.index },
      });
      setGenerationConfirmError(message);
      pushAssistantMessage(message, tr("Generation", "生成"));
      return;
    }
    generationRequestInFlightRef.current = true;
    setIsPlanningBillingStep(true);
    setGenerationConfirmError(null);
    setGenerationSessionSeed((prev) => prev + 1);
    const nextRunId = createGenerationRunId();
    setGenerationRunContext(nextRunId, null);
    logGenerationCacheGuard("run-started", {
      runId: nextRunId,
      projectId: projectIdRef.current,
      projectTraceId: projectTraceIdRef.current,
      taskCount: tasksToGenerate.length,
      taskIndexes: tasksToGenerate.map((task) => task.index),
    });
    emitFlowAudit({
      stage: "7.confirm-generation",
      status: "accepted",
      decision: "start-run",
      reason: "tasks-ready",
      keyFields: {
        nextRunId,
        taskCount: tasksToGenerate.length,
        taskIndexes: tasksToGenerate.map((task) => task.index),
      },
    });
    const generationStartedAt = Date.now();
    const pendingState: Record<number, GenerationTaskUiState> = {};
    tasksToGenerate.forEach((task) => {
      pendingState[task.index] = {
        index: task.index,
        status: "queued",
        attempts: 0,
        maxAttempts: 1,
        runId: nextRunId,
        source: "current-run",
        startedAt: generationStartedAt,
        lastUpdatedAt: generationStartedAt,
      };
    });
    setGenerationTaskStateByIndex(pendingState);
    setFlowStage("generate");
    setBillingConfirmed(true);
    requestAnimationFrame(() => {
      storyboardPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    const imageModel = initialEntry.models?.imageModel || "gpt-image-2";
    startThinking(
      effectiveIntent === "poster" ? tr("Poster Generation", "海报生成") : tr("Storyboard Generation", "分镜生成"),
      effectiveIntent === "poster"
        ? tr("Generating poster structure and draft text...", "正在生成海报结构与文案...")
        : tr("Generating storyboard structure and syncing visual/audio fields...", "正在创建分镜结构，并同步画面与音轨字段..."),
    );
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 560));

      const user = currentEmail ? getAdminUserByEmail(currentEmail) : null;
      const ownerProjects = currentEmail ? getProjectsByUser(currentEmail) : [];
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
      if (typeof window !== "undefined" && projectIdRef.current) {
        const url = new URL(window.location.href);
        const existingProjectId = (url.searchParams.get("projectId") || "").trim();
        if (existingProjectId !== projectIdRef.current) {
          url.searchParams.set("projectId", projectIdRef.current);
          router.replace(`${url.pathname}?${url.searchParams.toString()}`, { scroll: false });
        }
      }

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
          taskCount: tasksToGenerate.length,
          taskIndexes: tasksToGenerate.map((task) => task.index),
        },
      });
      await runGenerationTasksOrdered(tasksToGenerate, nextRunId, false);
    } catch (error) {
      setBillingConfirmed(false);
      setGenerationConfirmError(
        error instanceof Error ? error.message : tr("Generation failed.", "生成失败。"),
      );
      logClientEvent({
        category: "image",
        action: "image_generation_batch_failed",
        status: "error",
        source: imageModel,
        message: error instanceof Error ? error.message : "Generation batch failed.",
        projectId: projectIdRef.current ?? null,
      });
    } finally {
      emitFlowAudit({
        stage: "7.confirm-generation",
        status: "finished",
        decision: "request-finished",
        reason: "handleConfirmBilling-finally",
      });
      stopThinking();
      setIsPlanningBillingStep(false);
      generationRequestInFlightRef.current = false;
    }
  }

  async function handleSendInput(
    raw?: string,
    options?: {
      source?: "manual" | "suggestion";
    },
  ) {
    const cleanupAuthRelatedChatUi = () => {
      setUpdates((prev) => sanitizeAuthRelatedChatTurns(prev));
    };
    try {
      const guardResponse = await fetch("/api/workspace/chat-guard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!guardResponse.ok) {
        cleanupAuthRelatedChatUi();
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
      cleanupAuthRelatedChatUi();
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
    const backNavigationCommand = isBackNavigationCommand(normalized);
    const downloadCommand = isDownloadCommand(normalized);
    const draftEditIntentCommand = isDraftEditIntentCommand(normalized);
    const parsedPosterCount = extractPosterCount(value);
    const parsedPptCount = extractPageCount(value);
    const parsedVideoCount = extractVideoStoryboardCount(value);
    const parsedPosterSize = extractPosterSize(value);
    const parsedPptRatio = extractPptRatio(value);
    const parsedVideoRatio = extractVideoRatio(value);
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

    if (backNavigationCommand) {
      pushAssistantMessage(
        tr(
          "Back navigation is handled by the page controls. Please use the step buttons.",
          "返回操作由页面按钮处理，请使用步骤按钮。",
        ),
        tr("Workflow Guard", "流程约束"),
      );
      stopThinking();
      setIsSending(false);
      return;
    }

    if (flowStage === "generate" && downloadCommand) {
      pushAssistantMessage(
        tr(
          "Download is button-only in canvas mode. Please click Download / Download All.",
          "无限画布阶段下载仅支持按钮操作，请点击 Download / Download All。",
        ),
        tr("Workflow Guard", "流程约束"),
      );
      stopThinking();
      setIsSending(false);
      return;
    }

    const allowDraftEditFromLaterStage =
      (flowStage === "style" || flowStage === "billing" || flowStage === "generate") &&
      draftEditIntentCommand;
    const strictStageGuardActive = flowStage === "style" || flowStage === "billing";
    const shouldPrioritizeDraftEdit = flowStage === "content" || allowDraftEditFromLaterStage;

    if (flowStage === "billing" && !allowDraftEditFromLaterStage) {
      pushAssistantMessage(
        tr(
          "Billing step does not accept chat edits. Please use the on-screen buttons.",
          "账单阶段不响应输入框编辑，请使用页面按钮操作。",
        ),
        tr("Workflow Guard", "流程约束"),
      );
      stopThinking();
      setIsSending(false);
      return;
    }

    if (strictStageGuardActive && !shouldPrioritizeDraftEdit) {
      pushAssistantMessage(
        tr(
          "Please complete this step using on-screen controls. Draft edits are available from content stage.",
          "请先通过页面控件完成当前步骤。文稿修改请在文稿阶段进行。",
        ),
        tr("Workflow Guard", "流程约束"),
      );
      stopThinking();
      setIsSending(false);
      return;
    }

    if (allowDraftEditFromLaterStage) {
      // Re-open the draft stage for a new editable revision round.
      setBillingConfirmed(false);
      clearCurrentGenerationState("draft-edit-reopen-content");
      setFlowStage("content");
      pushAssistantMessage(
        tr(
          "Switched to draft revision mode. I will apply this as a new draft update; confirm draft, then reselect style.",
          "已切换到文稿修改模式。本次会生成新的文稿更新卡片；确认文稿后请重新选择风格。",
        ),
        tr("Draft Revision", "文稿修订"),
      );
    }

    if (likelyTopicText && (flowStage === "intent" || flowStage === "config" || shouldClarifyIntent)) {
      setTopicContextPrompt(value);
    }

    if (
      value.trim().length >= 6 ||
      containsAny(normalized, ["天文", "经济", "历史", "地理", "火山", "气候", "物理", "science", "history", "climate", "physics"])
    ) {
      setWeakPromptResolved(true);
    }

    if (!shouldPrioritizeDraftEdit && weakPrompt && !hasDirectionHint) {
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
    if (!shouldPrioritizeDraftEdit && containsAny(normalized, ["ppt", "课件", "幻灯", "slides", "slide deck"])) {
      if (parsedPptCount) {
        setPptPageCount(parsedPptCount);
      }
      if (parsedPptRatio) {
        setPptRatio(parsedPptRatio);
      }
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
    if (!shouldPrioritizeDraftEdit && containsAny(normalized, ["视频", "口播", "分镜", "video", "storyboard", "voiceover"])) {
      if (parsedVideoCount) {
        setVideoStoryboardCount(parsedVideoCount);
      }
      if (parsedVideoRatio) {
        setVideoRatio(parsedVideoRatio);
      }
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
    if (!shouldPrioritizeDraftEdit && containsAny(normalized, ["海报", "长图", "poster", "infographic"])) {
      if (parsedPosterCount) {
        setPosterCount(parsedPosterCount);
      } else if (parsedPptCount) {
        // 用户常说“8页海报”，这里将“页数”映射为海报张数。
        setPosterCount(clamp(parsedPptCount, 1, 10));
      }
      if (parsedPosterSize) {
        setPosterSizeId(parsedPosterSize);
      }
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

    if (
      !shouldPrioritizeDraftEdit &&
      isConfigCommand &&
      (manualIntent === "poster" || manualIntent === "video" || manualIntent === "ppt")
    ) {
      if (manualIntent === "poster") {
        if (parsedPosterCount) {
          setPosterCount(parsedPosterCount);
        } else if (parsedPptCount) {
          setPosterCount(clamp(parsedPptCount, 1, 10));
        }
        if (parsedPosterSize) {
          setPosterSizeId(parsedPosterSize);
        }
      } else if (manualIntent === "ppt") {
        if (parsedPptCount) {
          setPptPageCount(parsedPptCount);
        }
        if (parsedPptRatio) {
          setPptRatio(parsedPptRatio);
        }
      } else if (manualIntent === "video") {
        if (parsedVideoCount) {
          setVideoStoryboardCount(parsedVideoCount);
        } else if (parsedPptCount) {
          setVideoStoryboardCount(clamp(parsedPptCount, 6, 24));
        }
        if (parsedVideoRatio) {
          setVideoRatio(parsedVideoRatio);
        }
      }
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

    if (!shouldPrioritizeDraftEdit && shouldClarifyIntent) {
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
            hasCanvasPanel
              ? "lg:grid-cols-[480px_minmax(0,1fr)]"
              : "lg:grid-cols-[minmax(0,960px)] lg:justify-center"
          }`}
        >
          <section
            className={`min-h-0 w-full min-w-0 ${
              hasCanvasPanel ? "max-w-[480px]" : "mx-auto max-w-[960px]"
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
                  posterPlanList={editablePosterPlanList.length ? editablePosterPlanList : basePosterPlanList}
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
                  generationConfirmError={generationConfirmError}
                  billingSummary={{
                    styleName: selectedStyle.englishName ?? selectedStyle.name,
                    languageModelCredits,
                    imageModelCredits,
                    totalCost: billingCost,
                    standardOutputCount,
                    promoCreditsPerOutput: STANDARD_OUTPUT_PROMO_CREDITS,
                    regularCreditsPerOutput: STANDARD_OUTPUT_REGULAR_CREDITS,
                  }}
                  styleOptions={styleOptions}
                  selectedStyleId={selectedStyleId}
                  onSelectStyle={handleSelectStyle}
                  onStyleNext={handleStyleNext}
                  onConfirmBilling={handleConfirmBilling}
                  onUpgradeForCredits={openCreditsPaywall}
                  visualizationTypeHint={visualizationTypeHint}
                  thinkingState={thinkingState}
                  retryingErrorTurnIds={retryingErrorTurnIds}
                  onRetryErrorTurn={handleRetryErrorTurn}
                />
              </div>

              <div className="z-20 pt-2">
                <div className="pb-[max(env(safe-area-inset-bottom),0.5rem)]">
                  <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2">
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
                posterAspectRatio={posterCanvasAspectRatio}
                generationSessionSeed={generationSessionSeed}
                generationTaskStateByIndex={generationTaskStateByIndex}
                onRetryGenerationTask={handleRetryGenerationTask}
                onRedrawGenerationTask={handleRedrawGenerationTask}
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
