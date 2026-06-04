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
  appendCreditRecordOnServer,
  consumeCheckoutReturnNotice,
  getCreditRecords,
  getSubscriptionByUser,
  syncCreditRecordsFromServer,
} from "@/lib/billing";
import {
  STANDARD_OUTPUT_PROMO_CREDITS,
  STANDARD_OUTPUT_REGULAR_CREDITS,
} from "@/lib/credit-pricing";
import {
  getAdminUserByEmail,
  updateUserProjectMetadata,
} from "@/lib/admin";
import { getVisualizationRecommendation } from "@/lib/prompts/content-draft";
import {
  isChineseLanguage,
  resolveOutputLanguage,
  type OutputLanguage,
} from "@/lib/language";
import {
  buildGenerationTaskStateByIndexFromNormalized,
  normalizeImageTaskStatus,
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
  isCover?: boolean;
};

type RestoredProjectPage = {
  pageIndex?: number;
  outputType?: string;
  pageRole?: string | null;
  title?: string | null;
  subtitle?: string | null;
  body?: string | null;
  visual?: string | null;
  imagePromptDraft?: string | null;
  imageTaskId?: string | null;
  imageUrl?: string | null;
  rawImageUrl?: string | null;
  assetPath?: string | null;
  status?: string | null;
  errorCode?: string | null;
  createdAt?: string;
  updatedAt?: string;
  imageHistory?: RestoredProjectImageHistoryItem[];
};

type RestoredProjectImageHistoryItem = {
  taskId?: string;
  index?: number;
  status?: string;
  attempts?: number;
  imageUrl?: string;
  renderUrl?: string;
  rawImageUrl?: string | null;
  storageKey?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  width?: number | null;
  height?: number | null;
  mimeType?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

function isRestoredImageSuccessStatus(status: string) {
  return ["asset_ready", "completed", "success", "succeeded"].includes(status);
}

function isRestoredImageLoadingStatus(status: string) {
  return ["queued", "running", "generating", "asset_downloading", "retrying", "draft_ready", "processing"].includes(status);
}

function isRestoredImageFailedStatus(status: string) {
  return ["billing_failed", "failed", "timed_out", "timeout", "error", "cancelled", "canceled", "completed_with_errors", "partial_failed"].includes(status);
}

function parseRestoredTimestampMs(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (!value) {
      continue;
    }
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function isRestoredLoadingStateStillFresh(...values: Array<string | null | undefined>) {
  const lastUpdatedAtMs = parseRestoredTimestampMs(...values);
  if (!lastUpdatedAtMs) {
    return false;
  }
  return Date.now() - lastUpdatedAtMs < RESTORED_LOADING_TIMEOUT_MS;
}

function pickRestoredImageUrl(input: {
  page?: RestoredProjectPage | null;
  history?: RestoredProjectImageHistoryItem[];
}) {
  const directCandidates = [
    input.page?.imageUrl,
    input.page?.rawImageUrl,
  ];
  for (const candidate of directCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  for (const item of input.history || []) {
    const candidate = item.renderUrl || item.imageUrl || item.rawImageUrl || "";
    if (candidate.trim()) {
      return candidate.trim();
    }
  }
  return "";
}

function buildRestoredSlideDrafts(
  intent: "ppt" | "video",
  totalCount: number,
  existingSlides: SlideDraft[],
  restoredPages: RestoredProjectPage[] = [],
) {
  const safeTotalCount = Math.max(1, Math.round(totalCount || 0));
  const label = intent === "ppt" ? "Slide" : "Frame";
  const pageByIndex = new Map<number, RestoredProjectPage>();
  restoredPages.forEach((page) => {
    const index = Math.max(1, Math.round(Number(page.pageIndex || 0)));
    if (index > 0) {
      pageByIndex.set(index, page);
    }
  });
  return Array.from({ length: safeTotalCount }, (_, idx) => {
    const pageIndex = idx + 1;
    const restoredPage = pageByIndex.get(pageIndex);
    const existing = existingSlides[idx];
    if (restoredPage) {
      return {
        page: pageIndex,
        title: restoredPage.title?.trim() || (idx === 0 ? "Cover" : `${label} ${pageIndex}`),
        body: restoredPage.body?.trim() || "",
        visual: restoredPage.visual?.trim() || "",
        imagePrompt: restoredPage.imagePromptDraft?.trim() || "",
        imagePromptDraft: restoredPage.imagePromptDraft?.trim() || "",
        isCover: restoredPage.pageRole === "cover" || (idx === 0 && safeTotalCount > 1),
      };
    }
    if (existing) {
      return {
        ...existing,
        page: pageIndex,
        isCover: idx === 0 ? existing.isCover === true || safeTotalCount > 1 : existing.isCover,
      };
    }
    return {
      page: pageIndex,
      title: idx === 0 ? "Cover" : `${label} ${pageIndex}`,
      body: "",
      visual: "",
      imagePrompt: "",
      imagePromptDraft: "",
      isCover: idx === 0 && safeTotalCount > 1,
    };
  });
}

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

function getLanguageModelCreditTokenUnit(model?: string) {
  const normalized = (model || "").trim().toLowerCase();
  if (!normalized) {
    return 1000;
  }
  const compact = normalized.replace(/[\s_]+/g, "-");
  const isGemini25Flash =
    compact.includes("gemini-2.5-flash") ||
    (compact.includes("gemini-2.5") && !compact.includes("pro"));
  if (isGemini25Flash) {
    return 5000;
  }
  return 1000;
}

type FlowStage = "intent" | "config" | "content" | "style" | "billing" | "generate";

type ParsedContentEditCommand = {
  target:
    | { kind: "slide"; index: number }
    | { kind: "poster"; index: number }
    | { kind: "all" };
  action: "shorten" | "enhance" | "append";
  payload: string;
};

type IntentAnalysis = {
  classification: "invalid" | "need_topic_clarification" | "needs_fresh_sources" | "ready";
  direction: WorkspaceIntent;
  confidence: number;
  topic: string;
  reason: string;
  clarifyMode: "none" | "topic" | "fresh_sources";
  needsFreshSources: boolean;
  suggestions: string[];
  assistantHint: string;
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
  source?: "current-run" | "restored";
  error?: string;
  errorCode?: string;
  startedAt?: number;
  lastUpdatedAt?: number;
};

type CreditsPaywallContext = {
  scene: "count_limit" | "billing_insufficient" | "tts_premium";
  kind?: "poster" | "ppt" | "video";
  count?: number;
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
  recovered?: boolean;
  error?: string;
  code?: string;
  imageGenerationMode?: string;
  attemptedProviders?: string[];
  skippedProviders?: string[];
  job?: {
    id?: string;
    runId?: string;
    status?: string;
    idempotencyKey?: string;
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
    errorMessage?: string;
  }>;
};

type ImageGenerationRestoreResponse = {
  ok?: boolean;
  error?: string;
  project?: {
    id?: string;
    title?: string;
    status?: string;
    format?: string | null;
    cover?: string;
    coverImageUrl?: string;
    updatedAt?: string;
  } | null;
  cover?: string;
  job?: {
    id?: string;
    runId?: string | null;
    intent?: string | null;
    status?: string | null;
  } | null;
  tasks?: Array<{
    taskId?: string;
    index?: number;
    status?: string;
    attempts?: number;
    imageUrl?: string;
    renderUrl?: string;
    rawImageUrl?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    createdAt?: string;
    updatedAt?: string;
  }>;
  pages?: RestoredProjectPage[];
};

type StructuredWorkspaceError = {
  userMessage: string;
  code?: string;
  authRequired?: boolean;
};

const RESTORED_LOADING_TIMEOUT_MS = 30 * 60 * 1000;

function persistWorkspaceProjectPages(input: {
  projectId?: string | null;
  outputType: "poster" | "ppt" | "video";
  pages: Array<{
    index: number;
    pageRole?: string | null;
    title?: string;
    subtitle?: string;
    body?: string;
    visual?: string;
    imagePromptDraft?: string;
  }>;
}) {
  const projectId = input.projectId?.trim();
  if (!projectId || !input.pages.length || typeof window === "undefined") {
    return;
  }
  void fetch(`/api/workspace/projects/${encodeURIComponent(projectId)}/pages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify({
      outputType: input.outputType,
      pages: input.pages,
    }),
  }).catch((error) => {
    if (WORKSPACE_VERBOSE_LOG) {
      console.warn("[WorkspaceProjectPages] save failed", {
        projectId,
        outputType: input.outputType,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  });
}

const HOME_DRAFT_KEY = "knowlens-home-draft";
const WORKSPACE_DRAFT_CACHE_KEY = "knowlens-workspace-draft-v1";
const WORKSPACE_SESSION_PREFS_KEY = "knowlens-workspace-session-prefs-v1";
const WORKSPACE_CHAT_HISTORY_KEY = "knowlens-workspace-chat-history-v1";
const MEMBERSHIP_SOURCE_KEY = "knowlens:membership-source";
const GENERATION_REQUEST_TIMEOUT_MS = 120000;
const GENERATION_CONFIRM_PREPARE_TIMEOUT_MS = 30000;
const GENERATION_CONFIRM_CREDITS_TIMEOUT_MS = 30000;
const GENERATION_CONFIRM_ACTIVATE_TIMEOUT_MS = 30000;
const GENERATION_JOB_POLL_INTERVAL_MS = 2500;
const GENERATION_JOB_POLL_TIMEOUT_MS = 1800000;
const SINGLE_IMAGE_REGENERATION_CREDITS = STANDARD_OUTPUT_PROMO_CREDITS;
const GENERATION_MAX_RETRY_ATTEMPTS = 3;
const GENERATION_RETRY_DELAYS_MS = [1100, 2300];
const GENERATION_UI_HARD_TIMEOUT_MS = 450000;
const DEBUG_IMAGE_BRIDGE_MOCK_URL =
  "https://apioss20.sydney-ai.com/img/174/t9il_0UNjpQmjxFqjxQAjxQnfx1m10kNt7TgYsFuksWxtvFN1a_ljpMm1xkmXaMV1aklX5oItaMm10ezjaQlX9hnX0-u1a_q103lX01TXpQAX4Tgkx1qfv24kAVmR8_=/gi2007i-144x144-1780044357126-ab388bbc.png";
const WORKSPACE_IMAGE_DEBUG = process.env.NEXT_PUBLIC_WORKSPACE_IMAGE_DEBUG === "1";
const WORKSPACE_FLOW_AUDIT = process.env.NEXT_PUBLIC_WORKSPACE_FLOW_AUDIT === "1";
const WORKSPACE_VERBOSE_LOG = process.env.NEXT_PUBLIC_WORKSPACE_VERBOSE_LOG === "1";
const WORKSPACE_CLIENT_TELEMETRY =
  process.env.NODE_ENV === "production" ||
  process.env.NEXT_PUBLIC_WORKSPACE_CLIENT_TELEMETRY === "1";
const initializedWorkspaceScopeKeys = new Set<string>();
const workspaceChatHistoryPayloadCache = new Map<string, string>();
const workspaceSessionPrefsPayloadCache = new Map<string, string>();
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
  if (!WORKSPACE_VERBOSE_LOG) {
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

function logWorkspaceVerbose(message: string, payload?: Record<string, unknown>) {
  if (!WORKSPACE_VERBOSE_LOG) {
    return;
  }
  if (payload) {
    console.info(message, payload);
    return;
  }
  console.info(message);
}

function hashWorkspaceTelemetryText(input?: string | null) {
  const value = (input || "").trim();
  if (!value) {
    return "";
  }
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(16).slice(0, 8);
}

function inferWorkspaceInputType(input: {
  prompt: string;
  sources: HomeSourceItem[];
}) {
  if (input.sources.some((source) => source.kind === "file")) return "document";
  if (input.sources.some((source) => source.kind === "youtube")) return "video";
  if (input.sources.some((source) => source.kind === "podcast")) return "podcast";
  if (input.sources.some((source) => source.kind === "web")) return "webpage";
  if (input.prompt.trim().length > 180) return "long_text";
  if (input.prompt.trim().length > 0) return "topic";
  return "unknown";
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

function isStaleRetryableLlmErrorTurn(turn: ChatTurn) {
  return turn.meta?.kind === "llm_error" && turn.meta.retryable !== false;
}

function sanitizeAuthRelatedChatTurns(turns: ChatTurn[]) {
  const withoutAuthLlmErrors = turns.filter(
    (turn) => !isAuthRelatedLlmErrorTurn(turn) && !isStaleRetryableLlmErrorTurn(turn),
  );
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
  runId?: string | null;
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
    input.runId ? `run=${normalizeIdempotencySegment(input.runId, "no-run")}` : "",
    `tasks=${normalizeIdempotencySegment(taskIndexes, "none")}`,
    `promptHash=${promptHash}`,
    `style=${normalizeIdempotencySegment(styleId, "no-style")}`,
    `ratio=${normalizeIdempotencySegment(aspectRatio, "no-ratio")}`,
  ].filter(Boolean).join("|");
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

function buildImageTaskCreditKey(runId: string | null | undefined, taskIndex: number) {
  const normalizedRunId = normalizeGenerationRunId(runId) || "unknown-run";
  return `${normalizedRunId}:${Math.max(1, Math.round(taskIndex))}`;
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
    name: "高端杂志信息图风",
    englishName: "Premium Editorial Infographic Style",
    fit: "Precise and polished scientific infographic style for broad educational explainers.",
    prompt:
      "Use a premium editorial infographic style. Main tone: warm off-white #F7F3EA. Panel color: soft warm gray #E8E1D6. Text and line color: charcoal #1F1F1F. Accent color: muted editorial blue #4F6F8F. Typography: elegant serif title, clean sans-serif body text, tabular sans-serif numbers, small refined uppercase labels. Details: subtle paper grain, thin divider lines, restrained line icons, clean vector illustrations, polished magazine-style finish.",
    suitableTopics: "通用科普、自然科学、物理、地理、人体、机制解释",
    carrierPriority: ["ppt", "poster", "video"],
    topicKeywords: ["科普", "自然", "物理", "地理", "人体", "机制", "原理", "解释"],
    palette: ["#1f2937", "#3b82f6", "#e5e7eb"],
    coverImage: styleCoverById("clean-science-infographic"),
  },
  {
    id: "youtube-science-thumbnail",
    name: "黑绿科技财报仪表盘风",
    englishName: "Black Tech Investor Dashboard Style",
    fit: "Textbook-like cutaway clarity for layered structures and mechanism internals.",
    prompt:
      "Use a black high-tech financial dashboard style. Main tone: deep black #050607. Panel color: graphite #1A1D21. Text and line color: soft white #F5F7FA. Accent color: neon green #7CFF4E. Typography: bold geometric sans-serif title, compact technical sans-serif body text, tabular numeric font for KPIs, small condensed technical labels. Details: glass-like dark panels, soft green glow, subtle server-grid texture, thin circuit traces, sharp line icons, high-contrast data-interface finish.",
    suitableTopics: "宇宙、AI、深海、灾难、人体、科技热点",
    carrierPriority: ["poster", "video", "ppt"],
    topicKeywords: ["宇宙", "ai", "深海", "灾难", "人体", "热点", "火山", "科技"],
    palette: ["#111827", "#ef4444", "#f8fafc"],
    coverImage: styleCoverById("youtube-science-thumbnail"),
  },
  {
    id: "cinematic-science-illustration",
    name: "黑金高端科技风",
    englishName: "Black Gold Premium Tech Style",
    fit: "Dramatic but controlled science storytelling with explanatory overlays.",
    prompt:
      "Use a black-and-gold premium technology style. Main tone: matte black #070707. Panel color: dark graphite #202020. Text and line color: warm white #F4EFE3. Accent color: champagne gold #D6B56D. Typography: high-contrast luxury serif title, refined modern sans-serif body text, elegant tabular numbers, small premium uppercase labels. Details: metallic gold highlights, glossy black surfaces, soft cinematic shadows, thin gold-line icons, precise luxury-tech finish.",
    suitableTopics: "宇宙、深海、火山、恐龙、灾难、未来城市",
    carrierPriority: ["poster", "video", "ppt"],
    topicKeywords: ["宇宙", "深海", "火山", "恐龙", "灾难", "未来城市", "史前", "行星"],
    palette: ["#111827", "#7c3aed", "#e2e8f0"],
    coverImage: styleCoverById("cinematic-science-illustration"),
  },
  {
    id: "minimal-line-art",
    name: "3D 等距科技图解风",
    englishName: "3D Isometric Tech Explainer Style",
    fit: "Simple geometric clarity and clean hierarchy for direct concept teaching.",
    prompt:
      "Use a 3D isometric technology style. Main tone: dark navy #071426. Panel color: cool slate gray #2A3442. Text and line color: ice white #F4F8FF. Accent color: electric blue #2F80FF. Typography: bold geometric sans-serif title, clean UI sans-serif body text, tabular numeric font, compact node labels with high legibility. Details: clean isometric 3D objects, soft shadows, polished surfaces, subtle blue glow, miniature system icons, precise spatial finish.",
    suitableTopics: "基础概念、产品说明、AI原理、简单科学机制",
    carrierPriority: ["ppt", "poster", "video"],
    topicKeywords: ["基础", "概念", "产品", "ai原理", "机制", "结构", "说明"],
    palette: ["#111827", "#64748b", "#f8fafc"],
    coverImage: styleCoverById("minimal-line-art"),
  },
  {
    id: "hand-drawn-explainer",
    name: "科技蓝图工程图风",
    englishName: "Blueprint Technical Diagram Style",
    fit: "Clean hand-drawn educational diagram style for approachable visual explanations.",
    prompt:
      "Use a technical blueprint style. Main tone: deep blueprint blue #071E3D. Panel color: darker blue #0B2A50. Text and line color: blueprint white #F2F8FF. Accent color: cyan #21D4FD. Typography: monospaced technical title, compact engineering sans-serif body text, monospaced tabular numbers, precise small annotation labels. Details: fine grid texture, schematic outlines, thin technical strokes, measurement marks, outline engineering icons, precise arrows, clean blueprint drawing finish.",
    suitableTopics: "科普解释、学习笔记、教程讲解、概念拆解、教育图解",
    carrierPriority: ["video", "ppt", "poster"],
    topicKeywords: ["手绘", "讲解", "教程", "概念", "学习", "教育", "科普", "图解"],
    palette: ["#0f172a", "#3b82f6", "#e2e8f0"],
    coverImage: styleCoverById("hand-drawn-explainer"),
  },
  {
    id: "cute-3d-educational",
    name: "医学科普插画风",
    englishName: "Medical Science Illustration Style",
    fit: "Friendly rounded 3D visuals for approachable educational storytelling.",
    prompt:
      "Use a clean medical science illustration style. Main tone: clinical white #FFFFFF. Panel color: soft blue #DCEEFF. Text and line color: medical gray #3F4A56. Accent color: medical green #35B779. Typography: calm humanist sans-serif title, highly readable sans-serif body text, clear tabular numbers, small clinical label typography. Details: smooth biological illustration, gentle gradients, soft shadows, clean anatomical labels, medical line icons, precise health-diagram finish.",
    suitableTopics: "儿童科普、动物、人体健康、营养、低龄教育",
    carrierPriority: ["video", "poster", "ppt"],
    topicKeywords: ["儿童", "动物", "人体健康", "营养", "低龄", "亲子", "启蒙"],
    palette: ["#0f172a", "#22d3ee", "#dbeafe"],
    coverImage: styleCoverById("cute-3d-educational"),
  },
  {
    id: "3d-isometric-tech",
    name: "电影级科普视觉风",
    englishName: "Cinematic Science Visual Style",
    fit: "Structured isometric system visualization for technical mechanisms and architectures.",
    prompt:
      "Use a cinematic science visual style. Main tone: deep atmospheric blue #081522. Panel color: dark neutral gray #252A30. Text and line color: soft silver #D7DEE8. Accent color: cinematic amber #F0A33A. Typography: bold cinematic sans-serif title, clean documentary sans-serif body text, tabular numeric font, small restrained scientific labels. Details: realistic texture, dramatic lighting, volumetric depth, soft glow, subtle particles, documentary-quality finish.",
    suitableTopics: "AI系统、数据中心、芯片、城市系统、互联网、能源",
    carrierPriority: ["ppt", "poster", "video"],
    topicKeywords: ["ai系统", "数据中心", "芯片", "城市系统", "互联网", "能源", "架构", "模块"],
    palette: ["#0f172a", "#10b981", "#d1fae5"],
    coverImage: styleCoverById("3d-isometric-tech"),
  },
  {
    id: "dark-premium-tech",
    name: "深色高级科技风",
    englishName: "Dark Premium Tech Style",
    fit: "Dark premium technology infographic system for polished data and AI-product visuals.",
    prompt:
      "Use a dark premium technology style. Main tone: deep navy black #060B14. Panel color: dark slate #151C28. Text and line color: cool white #F2F6FA. Accent color: electric cyan #39D5FF. Typography: sharp geometric sans-serif title, clean product UI sans-serif body text, tabular numeric font, compact technical labels. Details: refined dark surfaces, subtle gradient lighting, soft edge glow, clean technical line icons, polished digital materials, premium AI product visual finish.",
    suitableTopics: "AI产品、科技商业、数据摘要、芯片、云计算、财报、趋势解读",
    carrierPriority: ["poster", "ppt", "video"],
    topicKeywords: ["科技", "ai", "产品", "数据", "芯片", "云计算", "财报", "趋势", "信息图"],
    palette: ["#0f172a", "#a78bfa", "#dbeafe"],
    coverImage: styleCoverById("dark-premium-tech"),
  },
  {
    id: "technical-blueprint",
    name: "极简扁平解释图风",
    englishName: "Minimal Flat Explainer Style",
    fit: "Technical linework and annotation discipline for engineering-style explanations.",
    prompt:
      "Use a minimal flat explainer style. Main tone: clean white #FFFFFF. Panel color: light gray #EEF1F4. Text and line color: neutral gray #606975. Accent color: bright blue #2F80FF. Typography: bold rounded sans-serif title, simple readable sans-serif body text, clean tabular numbers, large clear label typography. Details: flat vector shapes, simple geometry, crisp edges, low visual noise, consistent flat icons, clean diagram finish.",
    suitableTopics: "航空航天、机械、潜艇、机器人、军事科技、工程结构",
    carrierPriority: ["poster", "ppt", "video"],
    topicKeywords: ["航天", "机械", "潜艇", "机器人", "军事", "工程", "结构", "蓝图"],
    palette: ["#0b2447", "#38bdf8", "#bfdbfe"],
    coverImage: styleCoverById("technical-blueprint"),
  },
  {
    id: "medical-educational-illustration",
    name: "精致手账科普风",
    englishName: "Refined Notebook Science Style",
    fit: "Clinical clarity with calm precision for anatomy and biological mechanisms.",
    prompt:
      "Use a refined notebook science style. Main tone: warm paper beige #F3E7D0. Panel color: light kraft paper #E6D1B3. Text and line color: pencil gray #4A4A4A. Accent color: muted olive #7A8F5A. Typography: neat hand-lettered title, tidy handwritten body text, clear handwritten numbers, small annotation-style labels. Details: paper texture, delicate hand-drawn lines, neat sketch marks, underlines, small annotation symbols, organized notebook visual finish.",
    suitableTopics: "心血管、人体器官、代谢、疾病机制、营养健康",
    carrierPriority: ["ppt", "video", "poster"],
    topicKeywords: ["心血管", "器官", "代谢", "疾病", "营养", "医学", "健康", "人体"],
    palette: ["#0f172a", "#14b8a6", "#e0f2fe"],
    coverImage: styleCoverById("medical-educational-illustration"),
  },
  {
    id: "premium-editorial-infographic",
    name: "高级手绘白板科普风",
    englishName: "Premium Sketchnote Science Style",
    fit: "High-end editorial infographic polish for premium knowledge publication feel.",
    prompt:
      "Use a premium sketchnote style. Main tone: clean white #FFFFFF. Panel color: light gray #E8E8E8. Text and line color: black #111111. Accent color: clear orange #F28C28. Typography: bold hand-drawn marker title, neat hand-drawn sans-serif body text, simple handwritten numbers, compact annotation labels. Details: structured hand-drawn strokes, bold doodle icons, consistent line weight, circled keywords, emphasis marks, clean whiteboard visual finish.",
    suitableTopics: "商业分析、经济学、产业研究、AI趋势、社会议题",
    carrierPriority: ["ppt", "poster", "video"],
    topicKeywords: ["商业", "经济", "产业", "趋势", "社会", "市场", "报告", "分析"],
    palette: ["#111827", "#f59e0b", "#f3f4f6"],
    coverImage: styleCoverById("premium-editorial-infographic"),
  },
  {
    id: "premium-sketchnote-science",
    name: "柔和 3D 教育风",
    englishName: "Soft 3D Educational Style",
    fit: "Neat sketchnote educational style with structured visual-thinking flow.",
    prompt:
      "Use a soft 3D educational style. Main tone: warm light cream #FFF4DF. Panel color: warm white #FFFDF8. Text and line color: soft gray #5F6B76. Accent color: pastel blue #7DB7FF. Typography: rounded geometric sans-serif title, clean rounded sans-serif body text, clear tabular numbers, simple rounded label typography. Details: rounded 3D objects, smooth clay-like materials, gentle shadows, soft lighting, simple callout labels, rounded icons, polished educational 3D finish.",
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
    .replace(/\b(?:ppt|slides?|slide\s*deck|video|poster|infographic|storyboard|image|images)\b/gi, " ")
    .replace(/(?:生成|制作|创建|做|输出|海报|视频|分镜|课件|长图|图文卡片|文稿|图片|配图|信息图)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return withoutDirectionWords || withoutGreeting || trimmed;
}

function compactLineText(input: string | null | undefined) {
  return (input || "").replace(/\s+/g, " ").trim();
}

function cleanProjectTitleCandidate(input: string | null | undefined, outputLanguage: OutputLanguage) {
  const compact = compactLineText(input)
    .replace(/^(title|标题|主题|page focus|本页重点)\s*[:：]\s*/i, "")
    .replace(/\s*[·\-|]\s*(用户意图总结|工作区草稿|workspace draft|intent summary)\s*$/i, "")
    .replace(/^(请把|请将|把|将|please\s+turn|turn)\s*/i, "")
    .trim();
  if (!compact) {
    return "";
  }
  const firstUnit = compact
    .split(/[。！？!?]/)
    .map((part) => part.trim())
    .filter(Boolean)[0] || compact;
  const maxLength = isChineseLanguage(outputLanguage) ? 28 : 72;
  return firstUnit.slice(0, maxLength).trim();
}

function deriveWorkspaceProjectTitle(input: {
  outputLanguage: OutputLanguage;
  topic: string;
  intent: WorkspaceIntent;
  posterDraft?: PosterDraft | null;
  planList?: PosterPlanItem[];
  slides?: SlideDraft[];
}) {
  const candidates =
    input.intent === "poster"
      ? [
          input.posterDraft?.headline,
          input.posterDraft?.subtitle,
          input.planList?.[0]?.title,
          input.topic,
        ]
      : [
          input.slides?.find((slide) => slide.isCover)?.title,
          input.slides?.[0]?.title,
          input.topic,
        ];

  for (const candidate of candidates) {
    const cleaned = cleanProjectTitleCandidate(candidate, input.outputLanguage);
    if (cleaned) {
      return cleaned;
    }
  }
  return topicHintText(input.topic, input.outputLanguage);
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
  if (containsAny(text, ["海报", "长图", "poster", "封面", "图文卡片", "图片", "配图", "信息图", "infographic", "image"])) {
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
  return "poster";
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

function buildMediaFallbackSeed(topic: string, intent: WorkspaceIntent, count: number, outputLanguage: OutputLanguage) {
  const isZh = isChineseLanguage(outputLanguage);
  const isDesertTopic = /沙漠|昼夜|白天|晚上|温差/.test(topic.replace(/\s+/g, ""));
  const desertSeed = [
    {
      title: "沙漠昼夜温差",
      pptBody: "同一地点在一天内温度可大幅波动，白天升温快、夜晚降温也快。\n关键不是沙漠一直热，而是它不擅长保温。",
      videoBody: "沙漠最反常的地方，不是白天很热，而是夜里会迅速变冷。理解这个昼夜反差，才能抓住沙漠气候的关键。",
      visual: intent === "video" ? "左右分屏：左侧烈日下沙地快速升温，右侧夜空下热量向上散走，中间用温度曲线表现陡升陡降。" : "昼夜分屏对比图",
    },
    {
      title: "白天升温快",
      pptBody: "沙漠云量少、遮挡弱，太阳辐射更直接到达地表。\n地表吸收能量快，温度上升也更快。",
      videoBody: "白天沙漠上空云量少，太阳能量几乎直接打到地表。沙地吸收得快，所以温度会在短时间内明显升高。",
      visual: intent === "video" ? "太阳占据画面上方，粗箭头穿过稀薄云层直达沙地，地表温度计快速上升，突出白天能量输入。" : "太阳辐射箭头直达地表",
    },
    {
      title: "地表不擅长储热",
      pptBody: "沙地和裸岩不像水体那样擅长储热，受热快、失热也快。\n这会放大一天内的温度波动。",
      videoBody: "沙地和裸岩不像水体那样擅长储热。它们白天热得快，到了晚上也凉得快，于是温差被进一步拉大。",
      visual: intent === "video" ? "沙地与湖水并排对比：沙地温度计剧烈波动，水体温度计变化平缓，用储热能力差异解释温差。" : "沙地与水体储热对比",
    },
    {
      title: "夜晚散热更直接",
      pptBody: "入夜后没有太阳继续输入能量，地表热量更容易向天空散走。\n云层少时，夜间保温效果更弱。",
      videoBody: "到了晚上，太阳不再继续输入能量，地表开始向天空散热。因为云层少，热量更容易离开近地面。",
      visual: intent === "video" ? "夜晚沙漠地表变暗，红色热量箭头从地面向星空散出，稀少云层无法形成保温层。" : "热量向天空散失路径",
    },
    {
      title: "空气干燥不保温",
      pptBody: "水汽少意味着空气保温能力弱，夜里难以把热量留在近地面。\n少云少水汽共同削弱了夜间保温层。",
      videoBody: "沙漠空气很干燥，水汽少，保温能力就弱。你可以把它理解成少了一层保温被，夜里热量留不住。",
      visual: intent === "video" ? "把湿润空气画成厚保温层、沙漠干空气画成稀薄透明层，热量从薄层中快速逃逸。" : "云层与水汽保温层示意",
    },
    {
      title: "湿润地区更缓和",
      pptBody: "湿润地区云层和水汽更多，白天升温较慢，夜晚降温也更缓。\n对比后更容易看出沙漠温差大的原因。",
      videoBody: "湿润地区有更多水汽和云层，白天能缓冲升温，夜里也能减慢降温。对比之后，沙漠的温差就更明显。",
      visual: intent === "video" ? "左侧沙漠温度曲线陡升陡降，右侧湿润地区曲线平缓，云层和水汽作为缓冲层显示。" : "沙漠与湿润地区对比",
    },
    {
      title: "常见误区",
      pptBody: "“沙漠一直很热”并不准确。\n更准确的说法是：沙漠昼夜温差大，白天热、夜晚冷。",
      videoBody: "所以说沙漠一直很热，其实并不准确。更准确的说法是：沙漠白天热得快，夜晚也冷得快。",
      visual: intent === "video" ? "误区卡片被划掉：沙漠一直很热；事实卡片突出：白天热、夜晚冷，旁边配昼夜温度对比。" : "误区与事实对照",
    },
    {
      title: "三因素判断",
      pptBody: "判断昼夜温差，优先看三件事：云量、水汽、地表材质。\n云少、水汽少、地表不储热，温差通常更大。",
      videoBody: "判断一个地方昼夜温差大不大，可以先看三件事：云量、水汽和地表材质。云少、水汽少、地表不储热，温差通常更大。",
      visual: intent === "video" ? "三个节点依次出现：云量、水汽、地表材质，最终汇聚到昼夜温差结果，箭头清晰、文字极少。" : "云量-水汽-地表材质三节点模型",
    },
    {
      title: "变量如何联动",
      pptBody: "少云让白天更容易升温，少水汽让夜晚更难保温。\n地表不擅长储热，会把这种昼夜差异进一步放大。",
      videoBody: "云量、水汽和地表材质不是各自独立发挥作用。它们会一起影响升温和散热，最终把昼夜温差放大。",
      visual: intent === "video" ? "云量少、水汽少、地表储热弱三个变量同时亮起，箭头汇聚到一个放大的温差计。" : "云量-水汽-地表材质联动图",
    },
    {
      title: "一天温度时间线",
      pptBody: "清晨温度较低，中午快速升高，日落后又迅速下降。\n把一天拆成时间线，可以更直观看到升温和降温速度。",
      videoBody: "把一天摊开看，沙漠温度常像一条陡升陡降的曲线。中午升得快，日落后降得也快。",
      visual: intent === "video" ? "横向时间线从清晨到夜晚，温度曲线先陡升再陡降，背景光线从日出过渡到星空。" : "清晨-中午-日落-夜晚温度曲线",
    },
    {
      title: "怎么快速判断",
      pptBody: "看到晴朗、干燥、裸露地表，就要警惕昼夜温差更大。\n如果云层厚、水汽多或地表含水量高，温差通常会被削弱。",
      videoBody: "快速判断时，可以先看天空、空气和地表。天空少云、空气干燥、地表裸露，通常就意味着更大的昼夜温差。",
      visual: intent === "video" ? "画面依次检查天空、空气、地表三个图标，每个图标连接到温差大小判断，不出现长段文字。" : "三步检查清单",
    },
    {
      title: "迁移到其他地区",
      pptBody: "类似逻辑也能解释干旱内陆、高原荒漠等地区的昼夜温差。\n关键不是名字叫不叫沙漠，而是云量、水汽和储热能力。",
      videoBody: "这套逻辑不只适用于沙漠，也能迁移到高原和干旱内陆。只要少云、干燥、地表储热弱，温差就容易变大。",
      visual: intent === "video" ? "地图式小场景并列展示沙漠、高原、干旱内陆，用同一套三因素模型连接这些地区。" : "沙漠-高原-干旱内陆对照",
    },
    {
      title: "真实场景应用",
      pptBody: "沙漠旅行常需要同时准备防晒和保暖用品。\n白天应防强日照，夜间则要应对快速降温。",
      videoBody: "这也是为什么去沙漠旅行，白天要防晒，晚上还要保暖。你面对的不是单纯高温，而是剧烈的温度切换。",
      visual: intent === "video" ? "旅行背包分成白天和夜晚两侧：一侧是帽子、防晒，另一侧是外套、保暖装备，呼应昼夜温差。" : "白天防晒与夜间保暖场景卡",
    },
    {
      title: "一页复盘模型",
      pptBody: "沙漠昼夜温差大的判断公式：白天强输入，夜晚弱保温，地表不储热。\n这三点同时出现，昼夜温差就容易被拉大。",
      videoBody: "最后用一句话记住：白天强输入，夜晚弱保温，地表又不擅长储热。三点叠加，沙漠昼夜温差就会变大。",
      visual: intent === "video" ? "结尾总模型：强输入、弱保温、不储热三个模块围绕一个大温差计排列，形成清晰收束画面。" : "强输入-弱保温-不储热总结模型",
    },
  ];

  const genericZh = intent === "video"
    ? [
        ["冲突开场", `${topic}先用一个强反差画面建立问题，让观众立刻知道矛盾在哪里。接着用一句话点出本集要解释的关键机制。`, "强对比主视觉"],
        ["现象镜头", `观众先看到${topic}最直观的变化，再理解这个变化为什么值得解释。画面要把现象讲清楚，而不是只给概念标签。`, "现实场景特写"],
        ["第一原因", `先锁定第一个发生变化的关键变量，它通常决定后续链路怎么展开。把起点讲清楚，后面的因果才不会散。`, "单变量动作图"],
        ["机制传导", `变化不会停在第一步，而是会沿着因果链继续传导。这个镜头要说明中间过程如何把结果一步步推出来。`, "箭头路径图"],
        ["对比镜头", `通过变化前后或两种场景的对比，观众能更快看出差异。这个镜头要用对比帮助理解，而不是重复前一帧。`, "左右分屏对比"],
        ["误区纠偏", `很多误解来自只看表面结果，却忽略形成过程。先指出常见误区，再用一个清楚事实把它纠正过来。`, "误区事实卡"],
        ["结尾模型", `最后把${topic}压缩成一个容易记住的判断模型。观众看完这一帧，应该能复述核心逻辑并迁移使用。`, "三节点总结图"],
      ]
    : [
        ["核心问题", `${topic}的关键是把可观察现象、触发条件和最终结果连接起来。`, "主题主视觉"],
        ["现象观察", `${topic}先表现为一个可直接感知的变化。`, "现象对比图"],
        ["关键机制", `解释${topic}时，应抓住最先变化的变量和连锁反应。`, "因果链路图"],
        ["变量路径", `2-3个关键变量通常决定结果会被放大还是减弱。`, "变量框架图"],
        ["对比验证", `通过前后或A/B对比，可以判断机制解释是否成立。`, "对比卡片"],
        ["误区澄清", `常见误解往往来自只看结果、不看形成过程。`, "误区事实卡"],
        ["判断框架", `最终可按“现象、变量、结果”三步复盘${topic}。`, "三步判断框架"],
      ];
  const genericEn = intent === "video"
    ? [
        ["Opening Tension", `${topic} begins with one strong visual contrast that makes the question obvious. Then name the mechanism the viewer should watch for.`, "high-contrast hook frame"],
        ["Visible Pattern", `The viewer first sees the most observable change and why it matters. Keep the explanation concrete, not just a concept label.`, "real-world close-up"],
        ["First Cause", `Identify the first variable that changes, because it sets the direction for the whole chain. This frame should make the starting point easy to remember.`, "single-variable action"],
        ["Mechanism Path", `Show how the change travels through a cause-effect chain. The narration should explain the middle step that connects the trigger to the result.`, "arrow path with main subject"],
        ["Contrast Beat", `Use a before-after or A/B comparison so the viewer can see the difference immediately. This frame should add contrast, not repeat the previous beat.`, "split-screen contrast"],
        ["Myth Correction", `State the common misconception first, then correct it with one clear fact. The viewer should leave with a cleaner mental model.`, "myth versus fact visual"],
        ["Final Model", `${topic} closes as one memorable judgment model. The viewer should be able to repeat the core logic and use it elsewhere.`, "three-node recap model"],
      ]
    : [
        ["Core Question", `${topic} is best explained by linking the visible pattern, trigger, and outcome.`, "hero visual"],
        ["Observable Pattern", `${topic} starts from a visible change rather than an abstract label.`, "before-after comparison"],
        ["Key Mechanism", `Track the first changing variable and the chain reaction it creates.`, "causal chain diagram"],
        ["Variable Path", `Two or three key variables decide whether the effect grows or weakens.`, "variable framework"],
        ["Contrast Check", `A/B contrast helps verify whether the mechanism explains the result.`, "comparison cards"],
        ["Misconception", `Misunderstandings often come from seeing the outcome without the process.`, "myth-fact card"],
        ["Judgment Framework", `Use pattern, variables, and outcome as the final review frame.`, "three-step framework"],
      ];

  const source = isZh && isDesertTopic ? desertSeed : (isZh ? genericZh : genericEn).map(([title, body, visual]) => ({
    title,
    pptBody: intent === "ppt" ? `${body}\n${isZh ? "本页只保留一个解释重点。" : "Keep one explanation point on this slide."}` : body,
    videoBody: body,
    visual,
  }));
  return Array.from({ length: count }, (_, idx) => {
    const existing = source[idx];
    if (existing) {
      return existing;
    }
    const extraIndex = idx - source.length + 1;
    if (isZh) {
      const extraTitle =
        intent === "video" ? `补充镜头 ${extraIndex}` : `${topic}延展页 ${extraIndex}`;
      return {
        title: extraTitle,
        pptBody: `${topic}在这一页补充一个新的观察角度，避免重复前文结论。\n本页应服务于对比、误区、判断、案例或迁移应用中的一种功能。`,
        videoBody: `${topic}在这一帧补充一个新的观察角度，只围绕一个变化点展开。先说明画面中的变化，再给出它对结果的影响。`,
        visual: "单一重点的信息图模块",
      };
    }
    const extraTitle = intent === "video" ? `Extension Frame ${extraIndex}` : `${topic}: extension ${extraIndex}`;
    return {
      title: extraTitle,
      pptBody: `Add one new perspective on ${topic} without repeating earlier conclusions.\nThis page should serve comparison, misconception, judgment, case, or transfer learning.`,
      videoBody: `Add one new perspective on ${topic} with one clear change only. Explain what changes in the frame and why it matters for the outcome.`,
      visual: "single-focus infographic module",
    };
  });
}

function buildGenericOutline(topic: string, intent: WorkspaceIntent, count: number, outputLanguage: OutputLanguage) {
  const seed = buildMediaFallbackSeed(topic, intent, count, outputLanguage);
  return seed.map((item) => item.title);
}

function buildGenericSlides(
  topic: string,
  outline: string[],
  intent: WorkspaceIntent,
  outputLanguage: OutputLanguage,
) {
  const seed = buildMediaFallbackSeed(topic, intent, Math.max(outline.length, 1), outputLanguage);
  return outline.map((title, index) => {
    const item = seed[index] || seed[seed.length - 1];
    if (intent === "video") {
      return {
        page: index + 1,
        title: title || item.title,
        body: item.videoBody,
        visual: item.visual,
      };
    }
    return {
      page: index + 1,
      title: title || item.title,
      body: item.pptBody,
      visual: item.visual,
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
      if (!next.project || next.project.projectId !== queryProjectId) {
        return {
          ...empty,
          project: {
            projectId: queryProjectId,
            projectTraceId: "",
            projectUserId: "",
            projectTitle: "",
          },
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
    .filter((turn) => turn.content.trim().length > 0 && turn.meta?.kind !== "image_error");
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
  const normalizedUpdates = sanitizeAuthRelatedChatTurns(dedupeAdjacentChatTurns(updates))
    .filter((turn) => turn.meta?.kind !== "image_error")
    .slice(-160);
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
    if (workspaceChatHistoryPayloadCache.get(key) === payload) {
      return;
    }
    window.sessionStorage.setItem(key, payload);
    window.localStorage.setItem(key, payload);
    workspaceChatHistoryPayloadCache.set(key, payload);
  } catch (error) {
    if (WORKSPACE_VERBOSE_LOG) {
      console.warn("[WorkspaceChatHistory] write failed, fallback to minimal payload", {
        scopeKey,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
    const fallbackPayload = JSON.stringify(
      normalizedPayload.map((item) => ({
        id: item.id,
        role: item.role,
        module: "Workspace",
        content: typeof item.content === "string" ? item.content : "",
      })),
    );
    if (workspaceChatHistoryPayloadCache.get(key) === fallbackPayload) {
      return;
    }
    try {
      window.sessionStorage.setItem(key, fallbackPayload);
      window.localStorage.setItem(key, fallbackPayload);
      workspaceChatHistoryPayloadCache.set(key, fallbackPayload);
    } catch {
      // Ignore storage quota failures; chat can continue without persistence.
    }
  }
}

export default function WorkspacePage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeProjectId = searchParams.get("projectId")?.trim() || "";
  const { data: session } = useSession();
  const currentEmail = session?.user?.email?.trim().toLowerCase() ?? "";
  const [initialEntry] = useState(() => readHomeDraftPayload());
  const [sessionPrefsScopeKey] = useState(() => buildWorkspaceSessionScopeKey(initialEntry));
  const [sessionPrefs] = useState(() => readWorkspaceSessionPrefs(sessionPrefsScopeKey));
  const [topicContextPrompt, setTopicContextPrompt] = useState(() => initialEntry.prompt);
  const [workspaceProjectTitle, setWorkspaceProjectTitle] = useState(() => initialEntry.project?.projectTitle || "");
  const [creditVersion, setCreditVersion] = useState(0);
  const credits = useMemo(() => {
    void creditVersion;
    return getCreditRecords(currentEmail)[0]?.balance ?? 50;
  }, [currentEmail, creditVersion]);
  useEffect(() => {
    if (!currentEmail) {
      return;
    }
    let isCancelled = false;
    syncCreditRecordsFromServer(currentEmail)
      .then(() => {
        if (!isCancelled) {
          setCreditVersion((prev) => prev + 1);
        }
      })
      .catch(() => {
        // Keep the cached local balance if server sync is unavailable.
      });
    return () => {
      isCancelled = true;
    };
  }, [currentEmail]);
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
  const [intentAnalysis, setIntentAnalysis] = useState<IntentAnalysis | null>(null);
  const [intentAnalysisLoading, setIntentAnalysisLoading] = useState(false);
  const [prompt1LoadingVisible, setPrompt1LoadingVisible] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [generationTaskStateByIndex, setGenerationTaskStateByIndex] = useState<Record<number, GenerationTaskUiState>>({});
  const [currentGenerationRunId, setCurrentGenerationRunId] = useState<string | null>(null);
  const [currentGenerationJobId, setCurrentGenerationJobId] = useState<string | null>(null);
  const [generationConfirmError, setGenerationConfirmError] = useState<string | null>(null);
  const [retryingErrorTurnIds, setRetryingErrorTurnIds] = useState<Record<string, boolean>>({});
  const [creditsPaywallOpen, setCreditsPaywallOpen] = useState(false);
  const [creditsPaywallContext, setCreditsPaywallContext] = useState<CreditsPaywallContext | null>(null);

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
    clamp(sessionPrefs?.pptPageCount ?? extractPageCount(initialEntry.prompt) ?? 6, 6, 24),
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
  const [workspaceToast, setWorkspaceToast] = useState<{ id: string; message: string } | null>(null);
  const [draftLlmUsage, setDraftLlmUsage] = useState<DraftLlmUsage | null>(null);
  const [isDraftGenerationPending, setIsDraftGenerationPending] = useState(false);
  const [isPlanningNextStep, setIsPlanningNextStep] = useState(false);
  const [isPlanningStyleStep, setIsPlanningStyleStep] = useState(false);
  const [isPlanningBillingStep, setIsPlanningBillingStep] = useState(false);
  const [, setGenerationConfirmStep] = useState("");
  const [configConfirmed, setConfigConfirmed] = useState(false);
  const [generationSessionSeed, setGenerationSessionSeed] = useState(0);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [mobileWorkspaceView, setMobileWorkspaceView] = useState<"chat" | "canvas">("chat");
  const [desktopCanvasCollapsed, setDesktopCanvasCollapsed] = useState(false);
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
  const [isPptExportReady, setIsPptExportReady] = useState(false);
  const [isComposingVideo, setIsComposingVideo] = useState(false);
  const posterDraftRequestRef = useRef(0);
  const chatHistoryWriteTimerRef = useRef<number | null>(null);
  const workspaceToastTimerRef = useRef<number | null>(null);
  const lastGenerationToastRef = useRef<string | null>(null);
  const intentAnalyzeAbortRef = useRef<AbortController | null>(null);
  const intentAnalyzeRequestSeqRef = useRef(0);
  const lastIntentAnalyzeSignatureRef = useRef<string | null>(null);

  const modeActionsRef = useRef<{
    exportPpt: () => void;
    downloadVideo: () => void;
    downloadPoster: () => void;
  }>({
    exportPpt: () => {},
    downloadVideo: () => {},
    downloadPoster: () => {},
  });
  const storyboardPanelRef = useRef<HTMLElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const projectIdRef = useRef<string | null>(null);
  const projectTraceIdRef = useRef<string | null>(null);
  const generationRequestInFlightRef = useRef(false);
  const currentGenerationRunIdRef = useRef<string | null>(null);
  const currentGenerationJobIdRef = useRef<string | null>(null);
  const currentGenerationIdempotencyKeyRef = useRef<string | null>(null);
  const previousFlowStageRef = useRef<FlowStage>("intent");
  const flowStageHistoryRef = useRef<FlowStage>("intent");
  const currentConfirmStepRef = useRef<string>("");
  const restoredProjectRef = useRef(false);
  const checkoutReturnSourceRef = useRef<string | null>(null);
  const lastUiEventSignatureRef = useRef<Record<string, string>>({});
  const lastCanvasTaskStatusRef = useRef<Record<number, string>>({});
  const autoGenerationTriggeredRunIdsRef = useRef<Record<string, boolean>>({});
  const autoGenerationArmedRunIdsRef = useRef<Record<string, boolean>>({});
  const autoGenerationSuccessLockedRunIdsRef = useRef<Record<string, boolean>>({});
  const autoGenerationFailureLockedRunIdsRef = useRef<Record<string, boolean>>({});
  const chargedImageTaskCreditsRef = useRef<Record<string, number>>({});
  const refundedImageTaskCreditsRef = useRef<Record<string, boolean>>({});
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
  useEffect(() => {
    previousFlowStageRef.current = flowStageHistoryRef.current;
    flowStageHistoryRef.current = flowStage;
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
      if (!WORKSPACE_CLIENT_TELEMETRY) {
        return;
      }
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
  const currentSubscription = useMemo(
    () => (currentEmail ? getSubscriptionByUser(currentEmail) : null),
    [currentEmail, creditVersion],
  );
  const resolveEntrySource = useCallback((override?: string | null) => {
    const manual = (override || "").trim();
    if (manual) {
      return { entrySource: manual, sourceConfidence: "high" };
    }
    if (checkoutReturnSourceRef.current) {
      return { entrySource: "payment_return", sourceConfidence: "high" };
    }
    if (restoredProjectRef.current) {
      return { entrySource: "project_restore", sourceConfidence: "high" };
    }
    if (routeProjectId && initialEntry.project?.projectId) {
      return { entrySource: "workspace_existing_project", sourceConfidence: "high" };
    }
    if (routeProjectId && !initialEntry.prompt.trim() && !initialEntry.sources.length) {
      return { entrySource: "direct_workspace_url", sourceConfidence: "medium" };
    }
    if (initialEntry.prompt.trim() || initialEntry.sources.length) {
      return { entrySource: "home_input", sourceConfidence: "medium" };
    }
    return { entrySource: "unknown", sourceConfidence: "low" };
  }, [initialEntry.project?.projectId, initialEntry.prompt, initialEntry.sources, routeProjectId]);
  const setGenerationRunContext = useCallback((runId: string | null, jobId?: string | null) => {
    const normalizedRunId = normalizeGenerationRunId(runId);
    const normalizedJobId = jobId?.trim() || null;
    currentGenerationRunIdRef.current = normalizedRunId;
    currentGenerationJobIdRef.current = normalizedJobId;
    setCurrentGenerationRunId(normalizedRunId);
    setCurrentGenerationJobId(normalizedJobId);
  }, []);
  const pushWorkspaceToast = useCallback((message: string) => {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }
    if (workspaceToastTimerRef.current) {
      window.clearTimeout(workspaceToastTimerRef.current);
      workspaceToastTimerRef.current = null;
    }
    setWorkspaceToast({
      id: `workspace-toast-${Date.now()}`,
      message: trimmed,
    });
    workspaceToastTimerRef.current = window.setTimeout(() => {
      setWorkspaceToast(null);
      workspaceToastTimerRef.current = null;
    }, 3200);
  }, []);
  const clearCurrentGenerationState = useCallback(
    (reason: string) => {
      generationRequestInFlightRef.current = false;
      setIsPlanningBillingStep(false);
      setGenerationConfirmError(null);
      setGenerationTaskStateByIndex({});
      autoGenerationArmedRunIdsRef.current = {};
      autoGenerationSuccessLockedRunIdsRef.current = {};
      autoGenerationFailureLockedRunIdsRef.current = {};
      currentGenerationIdempotencyKeyRef.current = null;
      setGenerationRunContext(null, null);
      setGenerationSessionSeed((prev) => prev + 1);
      logGenerationCacheGuard("clear-current-generation-state", { reason });
    },
    [setGenerationRunContext],
  );
  useEffect(() => {
    if (!currentEmail) {
      return;
    }
    const notice = consumeCheckoutReturnNotice();
    if (!notice) {
      return;
    }
    checkoutReturnSourceRef.current = notice.source || "payment_return";
    setCreditsPaywallOpen(false);
    setCreditsPaywallContext(null);
    const hasExistingGenerationState = Object.values(generationTaskStateByIndex).some((item) =>
      item.status === "queued" ||
      item.status === "generating" ||
      item.status === "retrying" ||
      item.status === "success" ||
      item.status === "failed",
    );
    if (!currentGenerationJobIdRef.current && !hasExistingGenerationState) {
      clearCurrentGenerationState("checkout-return-stay-on-billing");
      setBillingConfirmed(false);
      setFlowStage("billing");
    }
    void syncCreditRecordsFromServer(currentEmail)
      .then(() => {
        setCreditVersion((prev) => prev + 1);
      })
      .catch(() => undefined);
    pushWorkspaceToast(notice.message);
  }, [clearCurrentGenerationState, currentEmail, generationTaskStateByIndex, pushWorkspaceToast]);

  useEffect(() => {
    if (!generationConfirmError) {
      lastGenerationToastRef.current = null;
      return;
    }
    if (lastGenerationToastRef.current === generationConfirmError) {
      return;
    }
    lastGenerationToastRef.current = generationConfirmError;
    pushWorkspaceToast(generationConfirmError);
  }, [generationConfirmError, pushWorkspaceToast]);

  useEffect(() => {
    return () => {
      if (workspaceToastTimerRef.current) {
        window.clearTimeout(workspaceToastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (routeProjectId) {
      projectIdRef.current = routeProjectId;
    } else if (initialEntry.project?.projectId) {
      projectIdRef.current = initialEntry.project.projectId;
    }
    if (initialEntry.project?.projectTraceId) {
      projectTraceIdRef.current = initialEntry.project.projectTraceId;
    }
  }, [initialEntry.project, routeProjectId]);

  useEffect(() => {
    const effectiveProjectId = routeProjectId || initialEntry.project?.projectId || "";
    if (!currentEmail || !effectiveProjectId) {
      return;
    }
    let cancelled = false;
    fetch(`/api/projects/${encodeURIComponent(effectiveProjectId)}`, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Project detail unavailable."))))
      .then((payload: ImageGenerationRestoreResponse) => {
        if (cancelled) {
          return;
        }
        const projectTitle = payload.project?.title?.trim() || "";
        if (!projectTitle) {
          return;
        }
        if (!workspaceProjectTitle) {
          setWorkspaceProjectTitle(projectTitle);
        }
        if (!topicContextPrompt.trim()) {
          setTopicContextPrompt(projectTitle);
        }
      })
      .catch(() => {
        // Project restoration is handled by the persisted generation state effect.
      });
    return () => {
      cancelled = true;
    };
  }, [currentEmail, initialEntry.project?.projectId, routeProjectId, topicContextPrompt, workspaceProjectTitle]);

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

  const openCreditsPaywall = useCallback((context?: CreditsPaywallContext) => {
    setCreditsPaywallContext(context ?? null);
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
  const paywallCopy = useMemo(() => {
    const scene = creditsPaywallContext?.scene;
    if (scene === "count_limit") {
      const count = creditsPaywallContext?.count;
      const kind = creditsPaywallContext?.kind;
      const countLabel = (() => {
        if (!count) {
          return null;
        }
        if (kind === "poster") {
          return `${count} posters`;
        }
        if (kind === "ppt") {
          return `${count} PPT slides`;
        }
        if (kind === "video") {
          return `${count} storyboard frames`;
        }
        return `${count} outputs`;
      })();
      return {
        title: "Upgrade to unlock larger batches",
        description: `${countLabel ? `${countLabel} ` : "This count "}requires a paid plan. You can start with a smaller batch for now, or view plans to unlock larger poster, slide, and storyboard batches.`,
        confirmLabel: "Upgrade Now",
        source: "workspace_count_limit_paywall",
      };
    }
    if (scene === "billing_insufficient") {
      return {
        title: "Upgrade to continue",
        description:
          "This generation needs more credits than your current balance. Please view the available plans to add more credits and continue when you are ready.",
        confirmLabel: "Upgrade Now",
        source: "workspace_billing_insufficient_paywall",
      };
    }
    if (scene === "tts_premium") {
      return {
        title: "Upgrade to unlock premium voices",
        description:
          "Premium voice options are reserved for members. You can keep using the included voices, or upgrade to unlock richer narration styles.",
        confirmLabel: "Upgrade Now",
        source: "workspace_tts_premium_paywall",
      };
    }
    return {
      title: isFreeUser ? "Upgrade to keep creating" : "Upgrade to continue",
      description: isFreeUser
        ? "Your free monthly credits have been used. Please view the available plans to keep creating with KnowLens."
        : "Your current credit balance is not enough for this generation. Please view the available plans to add more credits.",
      confirmLabel: "Upgrade Now",
      source: "workspace_default_paywall",
    };
  }, [creditsPaywallContext, isFreeUser]);

  const requestIntentAnalysis = useCallback(
    async (
      input: string,
      sources: HomeSourceItem[],
      options?: {
        force?: boolean;
        clearPrevious?: boolean;
      },
    ) => {
      const firstInput = input.trim();
      const sourcePayload = sources.map((item) => ({
        kind: item.kind,
        name: item.name,
        origin: item.origin,
        excerpt: item.excerpt,
      }));
      if (!firstInput && !sourcePayload.length) {
        setIntentAnalysis(null);
        setIntentAnalysisLoading(false);
        return;
      }
      const signature = JSON.stringify({
        input: firstInput,
        outputLanguage,
        sources: sourcePayload,
      });
      if (!options?.force && signature === lastIntentAnalyzeSignatureRef.current) {
        return;
      }
      lastIntentAnalyzeSignatureRef.current = signature;
      intentAnalyzeAbortRef.current?.abort();
      const controller = new AbortController();
      intentAnalyzeAbortRef.current = controller;
      const requestSeq = intentAnalyzeRequestSeqRef.current + 1;
      intentAnalyzeRequestSeqRef.current = requestSeq;
      const loadingStartedAt = Date.now();
      if (options?.clearPrevious ?? true) {
        setIntentAnalysis(null);
      }
      setIntentAnalysisLoading(true);
      setPrompt1LoadingVisible(true);
      const timeoutId = window.setTimeout(() => controller.abort(), 45000);
      try {
        const response = await fetch("/api/workspace/intent-analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input: firstInput,
            outputLanguage,
            sources: sourcePayload,
          }),
          signal: controller.signal,
        });
        if (intentAnalyzeRequestSeqRef.current !== requestSeq) {
          return;
        }
        if (!response.ok) {
          setIntentAnalysis(null);
          return;
        }
        const data = (await response.json()) as { analysis?: IntentAnalysis };
        if (!data.analysis) {
          setIntentAnalysis(null);
          return;
        }
        setIntentAnalysis(data.analysis);
      } catch {
        if (intentAnalyzeRequestSeqRef.current === requestSeq) {
          setIntentAnalysis(null);
        }
      } finally {
        window.clearTimeout(timeoutId);
        if (intentAnalyzeRequestSeqRef.current === requestSeq) {
          setIntentAnalysisLoading(false);
          const remainingLoadingMs = Math.max(0, 900 - (Date.now() - loadingStartedAt));
          window.setTimeout(() => {
            if (intentAnalyzeRequestSeqRef.current === requestSeq) {
              setPrompt1LoadingVisible(false);
            }
          }, remainingLoadingMs);
        }
        if (intentAnalyzeAbortRef.current === controller) {
          intentAnalyzeAbortRef.current = null;
        }
      }
    },
    [outputLanguage],
  );

  useEffect(() => {
    const firstInput = initialEntry.prompt.trim();
    const hasSources = initialEntry.sources.length > 0;
    if (!firstInput && !hasSources) {
      return;
    }
    void requestIntentAnalysis(initialEntry.prompt, initialEntry.sources, {
      force: true,
      clearPrevious: true,
    });
    return () => {
      intentAnalyzeAbortRef.current?.abort();
    };
  }, [initialEntry.prompt, initialEntry.sources, requestIntentAnalysis]);

  useEffect(() => {
    return () => {
      intentAnalyzeAbortRef.current?.abort();
    };
  }, []);

  const detectedIntent = useMemo(
    () => detectIntent(contextPrompt, entrySources),
    [contextPrompt, entrySources],
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
  const getAvailableCredits = useCallback(() => {
    return getCreditRecords(currentEmail)[0]?.balance ?? 50;
  }, [currentEmail]);
  const chargeImageTaskCredits = useCallback(
    (input: { runId: string; taskIndex: number; action: "retry" | "redraw" }) => {
      const taskIndex = Math.max(1, Math.round(input.taskIndex));
      const runId = normalizeGenerationRunId(input.runId);
      if (!runId) {
        return false;
      }
      const availableCredits = getAvailableCredits();
      if (availableCredits < SINGLE_IMAGE_REGENERATION_CREDITS) {
        setCreditVersion((prev) => prev + 1);
        openCreditsPaywall({
          scene: "billing_insufficient",
          kind: effectiveIntent === "unknown" ? undefined : effectiveIntent,
        });
        return false;
      }
      const creditKey = buildImageTaskCreditKey(runId, taskIndex);
      if (chargedImageTaskCreditsRef.current[creditKey]) {
        return true;
      }
      const projectTitle = workspaceProjectTitle || topic || "Image generation";
      const actionLabel = input.action === "redraw" ? "Image redraw" : "Image retry";
      appendCreditRecord({
        type: "consume",
        description: `${projectTitle} · ${actionLabel} (${SINGLE_IMAGE_REGENERATION_CREDITS} credits)`,
        delta: -SINGLE_IMAGE_REGENERATION_CREDITS,
        userEmail: currentEmail || undefined,
        projectId: projectIdRef.current ?? undefined,
        projectTitle,
      }, currentEmail);
      chargedImageTaskCreditsRef.current[creditKey] = SINGLE_IMAGE_REGENERATION_CREDITS;
      delete refundedImageTaskCreditsRef.current[creditKey];
      setCreditVersion((prev) => prev + 1);
      return true;
    },
    [currentEmail, effectiveIntent, getAvailableCredits, openCreditsPaywall, topic, workspaceProjectTitle],
  );
  const refundImageTaskCredits = useCallback(
    (input: {
      runId: string | null | undefined;
      taskIndex: number;
      reason?: string;
      mode?: "client" | "server";
    }) => {
      const taskIndex = Math.max(1, Math.round(input.taskIndex));
      const creditKey = buildImageTaskCreditKey(input.runId, taskIndex);
      const amount = chargedImageTaskCreditsRef.current[creditKey] || 0;
      if (refundedImageTaskCreditsRef.current[creditKey]) {
        return true;
      }
      if (!amount) {
        return false;
      }
      refundedImageTaskCreditsRef.current[creditKey] = true;
      if (input.mode === "server") {
        if (currentEmail) {
          void syncCreditRecordsFromServer(currentEmail)
            .then(() => {
              setCreditVersion((prev) => prev + 1);
            })
            .catch(() => undefined);
        } else {
          setCreditVersion((prev) => prev + 1);
        }
        return true;
      }
      const projectTitle = workspaceProjectTitle || topic || "Image generation";
      appendCreditRecord({
        type: "refund",
        description: `${projectTitle} · Image generation failed, credits refunded`,
        delta: amount,
        userEmail: currentEmail || undefined,
        projectId: projectIdRef.current ?? undefined,
        projectTitle,
      }, currentEmail);
      setCreditVersion((prev) => prev + 1);
      return true;
    },
    [currentEmail, topic, workspaceProjectTitle],
  );
  const posterSizeLabel = useMemo(
    () => posterSizeOptions.find((item) => item.id === posterSizeId)?.label,
    [posterSizeId],
  );
  const missingHints = useMemo(
    () => buildMissingHints(effectiveIntent, contextPrompt, posterSizeId, outputLanguage),
    [effectiveIntent, contextPrompt, posterSizeId, outputLanguage],
  );
  const prompt1Pending = intentAnalysisLoading || prompt1LoadingVisible;
  const shouldClarifyIntent =
    intentAnalysis?.clarifyMode === "topic" ||
    intentAnalysis?.classification === "need_topic_clarification" ||
    intentAnalysis?.classification === "invalid";
  const needsFreshSourcesClarify = intentAnalysis?.clarifyMode === "fresh_sources";
  const topicSuggestions = useMemo(() => {
    if (intentAnalysis?.clarifyMode !== "fresh_sources" && intentAnalysis?.suggestions.length) {
      return intentAnalysis.suggestions.slice(0, 4);
    }
    return [] as string[];
  }, [
    intentAnalysis?.clarifyMode,
    intentAnalysis?.classification,
    intentAnalysis?.suggestions,
  ]);
  const waitingTopicSuggestionConfirm =
    shouldClarifyIntent && !needsFreshSourcesClarify && topicSuggestions.length > 0 && !topicSuggestionLocked;
  const showPosterSizeSelector = effectiveIntent === "poster" && !posterSizeId;
  const canProceed = configConfirmed && !showPosterSizeSelector;
  const showDirectionGuide = flowStage === "intent" || flowStage === "config";
  const topicSuggestionsLoading = showDirectionGuide && !topicSuggestionLocked && prompt1Pending;
  const showStyleStage = flowStage === "style";
  const showBillingConfirm = flowStage === "billing";
  const showBillingRecord = flowStage === "billing" || flowStage === "generate";
  const showStoryboard = flowStage === "generate" && (effectiveIntent === "ppt" || effectiveIntent === "video");
  const showPosterCanvas = flowStage === "generate" && effectiveIntent === "poster";
  const hasCanvasPanel = showStoryboard || showPosterCanvas;
  const showChatPanelInLayout = !isMobileViewport || !hasCanvasPanel || mobileWorkspaceView === "chat";
  const showCanvasPanelInLayout = hasCanvasPanel && (isMobileViewport ? mobileWorkspaceView === "canvas" : !desktopCanvasCollapsed);
  const showChatComposer = flowStage === "intent" || flowStage === "config" || flowStage === "content";
  const generationInProgress = Object.values(generationTaskStateByIndex).some(
    (item) => item.status === "queued" || item.status === "generating" || item.status === "retrying",
  );
  const handleToggleOutputCanvas = useCallback(() => {
    if (!hasCanvasPanel) {
      return;
    }
    if (isMobileViewport) {
      setMobileWorkspaceView((prev) => (prev === "canvas" ? "chat" : "canvas"));
      return;
    }
    setDesktopCanvasCollapsed((prev) => !prev);
  }, [hasCanvasPanel, isMobileViewport]);

  useEffect(() => {
    if (!intentAnalysis) {
      return;
    }
    if (intentAnalysis.direction === "unknown") {
      return;
    }
    if (manualIntent !== null) {
      return;
    }
    setManualIntent(intentAnalysis.direction);
  }, [intentAnalysis, manualIntent]);
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
    if (showDirectionGuide && !shouldClarifyIntent) {
      return "";
    }
    if (!contextPrompt && !entrySources.length) {
      return "Choose an output format and settings to continue.";
    }
    const intentPart = shouldClarifyIntent
      ? "Choose a clearer topic first, then continue with output settings."
      : "Choose an output format and settings to continue.";
    if (manualIntent === "ppt") {
      return `${intentPart} Default: ${pptPageCount} slide(s), ${pptRatio}.`;
    }
    if (manualIntent === "video") {
      return `${intentPart} Default: ${videoStoryboardCount} frame(s), ${videoRatio}.`;
    }
    if (manualIntent === "poster") {
      const sizeLabel = posterSizeOptions.find((item) => item.id === posterSizeId)?.label ?? tr("Size not selected", "未选尺寸");
      return `${intentPart} Default: ${posterCount} poster(s), ${sizeLabel}.`;
    }
    return intentPart;
  }, [
    contextPrompt,
    entrySources.length,
    manualIntent,
    posterCount,
    posterSizeId,
    pptPageCount,
    pptRatio,
    showDirectionGuide,
    shouldClarifyIntent,
    tr,
    videoStoryboardCount,
    videoRatio,
  ]);

  const analysisText = useMemo(() => {
    if (prompt1Pending) {
      return isZhOutput ? "正在分析你的需求上下文..." : "Analyzing your request context...";
    }
    if (showDirectionGuide && !shouldClarifyIntent) {
      return "I understood your request. Confirm output direction and settings to continue.";
    }
    if (!contextPrompt && !entrySources.length) {
      return "Choose an output direction first, then I will prepare the draft.";
    }
    return `I understood "${topicHintText(topic, outputLanguage)}". Choose a format and settings to continue.`;
  }, [
    contextPrompt,
    entrySources.length,
    outputLanguage,
    prompt1Pending,
    showDirectionGuide,
    shouldClarifyIntent,
    topic,
  ]);

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

  const outlineItems =
    editableOutlineItems.length > 0
      ? editableOutlineItems
      : configConfirmed
        ? []
        : baseOutlineItems;
  const slideDrafts =
    editableSlideDrafts.length > 0
      ? editableSlideDrafts
      : configConfirmed
        ? []
        : baseSlideDrafts;
  const densityAdjustedSlideDrafts = useMemo(() => {
    if (effectiveIntent === "video") {
      return makeVideoDensitySlides(slideDrafts);
    }
    if (effectiveIntent === "ppt") {
      return makePptDensitySlides(slideDrafts);
    }
    return slideDrafts;
  }, [effectiveIntent, slideDrafts]);
  const displaySlideDrafts = useMemo<SlideDraft[]>(() => {
    return densityAdjustedSlideDrafts;
  }, [densityAdjustedSlideDrafts]);
  const canvasSeedSlides = useMemo(
    () =>
      displaySlideDrafts.map((slide, idx) => ({
        id: `slide-${idx + 1}`,
        page: idx + 1,
        title: slide.title?.trim() || `Slide ${idx + 1}`,
        body: slide.body?.trim() || "",
        visual: slide.visual?.trim() || "",
        imagePrompt: slide.imagePrompt?.trim() || "",
        imagePromptDraft: slide.imagePromptDraft?.trim() || slide.imagePrompt?.trim() || "",
        isCover: slide.isCover,
      })),
    [displaySlideDrafts],
  );
  const posterDraftRaw = editablePosterDraft ?? (configConfirmed ? null : basePosterDraft);
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
    effectiveIntent === "unknown"
      ? 0
      : effectiveIntent === "ppt" || effectiveIntent === "video"
        ? normalizedGenerationConfig.normalizedCount + 1
        : normalizedGenerationConfig.normalizedCount;
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
      const slidesText = displaySlideDrafts
        .map((slide) => `${slide.title} ${slide.body} ${slide.visual}`)
        .join(" ");
      return `${outlineText} ${slidesText}`.trim().length;
    }
    return 0;
  }, [displaySlideDrafts, effectiveIntent, outlineItems, posterDraft]);
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
  const languageModelBillingUnit = getLanguageModelCreditTokenUnit(
    draftLlmUsage?.model || initialEntry.models?.textModel,
  );
  const languageModelCredits = Math.max(1, Math.ceil(totalTokenEstimate / languageModelBillingUnit));
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
      slideDrafts: effectiveIntent === "ppt" || effectiveIntent === "video" ? displaySlideDrafts : densityAdjustedSlideDrafts,
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
    displaySlideDrafts,
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
  const buildWorkspaceTelemetryContext = useCallback((extra?: Record<string, unknown>) => {
    const { entrySource, sourceConfidence } = resolveEntrySource(
      typeof extra?.entrySource === "string" ? extra.entrySource : null,
    );
    const generationDirection = normalizedGenerationConfig.normalizedDirection || effectiveIntent || "unknown";
    const directionSource = normalizedGenerationConfig.normalizedDirection
      ? "payload.normalizedDirection"
      : effectiveIntent
        ? "payload.intent"
        : "unknown";
    const availableCredits = getAvailableCredits();
    const base = {
      entrySource,
      sourceConfidence,
      currentRoute: pathname || "/workspace",
      flowStage,
      currentStep: currentConfirmStepRef.current || flowStage,
      previousStep: previousFlowStageRef.current,
      isRestoredProject: restoredProjectRef.current,
      isNewProject: !routeProjectId,
      isLoggedIn: Boolean(currentEmail),
      inputType: inferWorkspaceInputType({
        prompt: contextPrompt,
        sources: entrySources,
      }),
      inputLength: contextPrompt.trim().length,
      inputLanguage: outputLanguage,
      topic: topic ? topic.slice(0, 120) : undefined,
      promptHash: hashWorkspaceTelemetryText(contextPrompt),
      promptLength: contextPrompt.trim().length,
      generationDirection,
      directionSource,
      styleId: selectedStyle.id,
      styleName: selectedStyle.englishName ?? selectedStyle.name,
      stylePromptHash: hashWorkspaceTelemetryText(selectedStyle.prompt),
      stylePromptLength: selectedStyle.prompt.trim().length,
      requestedCount: normalizedGenerationConfig.normalizedCount,
      taskCount: imageGenerationTasks.length,
      slideCount: effectiveIntent === "ppt" ? normalizedGenerationConfig.normalizedCount : undefined,
      imageCount: imageGenerationTasks.length,
      aspectRatio: normalizedGenerationConfig.normalizedRatio,
      projectId: (projectIdRef.current ?? routeProjectId) || undefined,
      projectTraceId: projectTraceIdRef.current ?? undefined,
      runId: currentGenerationRunIdRef.current ?? undefined,
      jobId: currentGenerationJobIdRef.current ?? undefined,
      isMember: Boolean(currentSubscription && (currentSubscription.status === "active" || currentSubscription.status === "canceling")),
      membershipStatus: currentSubscription?.status,
      planType: currentSubscription?.cycle,
      planName: currentSubscription?.planName,
      creditsBefore: availableCredits,
      creditBalanceSource: currentEmail ? "server_synced_local_cache" : "guest_default",
    } satisfies Record<string, unknown>;
    return {
      ...base,
      ...(extra || {}),
    };
  }, [
    contextPrompt,
    currentEmail,
    currentSubscription,
    effectiveIntent,
    entrySources,
    flowStage,
    getAvailableCredits,
    imageGenerationTasks.length,
    normalizedGenerationConfig.normalizedCount,
    normalizedGenerationConfig.normalizedDirection,
    normalizedGenerationConfig.normalizedRatio,
    outputLanguage,
    pathname,
    resolveEntrySource,
    routeProjectId,
    selectedStyle.englishName,
    selectedStyle.id,
    selectedStyle.name,
    selectedStyle.prompt,
    topic,
  ]);
  const emitUiEvent = useCallback((input: {
    action: string;
    status?: "ok" | "error" | "info";
    code?: string;
    message?: string;
    source?: string;
    details?: Record<string, unknown>;
  }) => {
    const details = buildWorkspaceTelemetryContext(input.details);
    const dedupeKey = `${input.action}:${input.code || ""}:${details.runId || ""}:${details.jobId || ""}`;
    const nextSignature = JSON.stringify({
      status: input.status ?? "info",
      code: input.code || "",
      entrySource: details.entrySource,
      flowStage: details.flowStage,
      currentStep: details.currentStep,
      taskCount: details.taskCount,
    });
    if (lastUiEventSignatureRef.current[dedupeKey] === nextSignature) {
      return;
    }
    lastUiEventSignatureRef.current[dedupeKey] = nextSignature;
    logClientEvent({
      category: "image",
      action: input.action,
      status: input.status ?? "info",
      source: input.source ?? effectiveIntent,
      code: input.code,
      message: input.message,
      projectId: projectIdRef.current ?? routeProjectId ?? null,
      details,
    });
  }, [buildWorkspaceTelemetryContext, effectiveIntent, logClientEvent, routeProjectId]);
  useEffect(() => {
    emitUiEvent({
      action: "ui.entry.detected",
      status: "info",
      message: "Workspace entry source detected.",
    });
  }, [emitUiEvent]);
  useEffect(() => {
    if (effectiveIntent === "unknown") {
      return;
    }
    emitUiEvent({
      action: "ui.direction.selected",
      status: "info",
      message: `Generation direction selected: ${effectiveIntent}.`,
      details: {
        generationDirection: effectiveIntent,
      },
    });
  }, [effectiveIntent, emitUiEvent]);
  useEffect(() => {
    emitUiEvent({
      action: "ui.style.selected",
      status: "info",
      message: `Style selected: ${selectedStyle.englishName ?? selectedStyle.name}.`,
    });
  }, [emitUiEvent, selectedStyle.englishName, selectedStyle.id, selectedStyle.name]);
  useEffect(() => {
    if (effectiveIntent === "unknown") {
      return;
    }
    emitUiEvent({
      action: "ui.page_count.selected",
      status: "info",
      message: `Requested output count set to ${normalizedGenerationConfig.normalizedCount}.`,
      details: {
        requestedCount: normalizedGenerationConfig.normalizedCount,
        slideCount: effectiveIntent === "ppt" ? normalizedGenerationConfig.normalizedCount : undefined,
      },
    });
  }, [effectiveIntent, emitUiEvent, normalizedGenerationConfig.normalizedCount]);
  useEffect(() => {
    if (!generationConfirmError) {
      return;
    }
    emitUiEvent({
      action: "ui.error.visible",
      status: "error",
      message: generationConfirmError,
    });
  }, [emitUiEvent, generationConfirmError]);
  const generationTotalCount = imageGenerationTasks.length || standardOutputCount;
  const generationReadyCount = useMemo(() => {
    if (!generationTotalCount) {
      return 0;
    }
    const readyIndexes = new Set<number>();
    Object.values(generationTaskStateByIndex).forEach((item) => {
      if (item.status === "success" && item.imageUrl) {
        readyIndexes.add(item.index);
      }
    });
    return Math.min(readyIndexes.size, generationTotalCount);
  }, [generationTaskStateByIndex, generationTotalCount]);
  const generationProgressLabel =
    generationTotalCount > 0 ? `${generationReadyCount}/${generationTotalCount}` : "";
  const allGenerationReady = generationTotalCount > 0 && generationReadyCount >= generationTotalCount;
  useEffect(() => {
    Object.values(generationTaskStateByIndex).forEach((item) => {
      const signature = `${item.status}:${item.errorCode || ""}:${item.imageUrl ? "1" : "0"}`;
      if (lastCanvasTaskStatusRef.current[item.index] === signature) {
        return;
      }
      lastCanvasTaskStatusRef.current[item.index] = signature;
      if (item.status === "success" && item.imageUrl) {
        emitUiEvent({
          action: "ui.canvas.task.success",
          status: "ok",
          message: `Canvas task ${item.index} rendered successfully.`,
          details: {
            runId: item.runId,
            jobId: item.jobId,
            taskIndex: item.index,
            imageCount: generationReadyCount,
          },
        });
      } else if (item.status === "failed") {
        emitUiEvent({
          action: "ui.canvas.task.failed",
          status: "error",
          code: item.errorCode,
          message: item.error || `Canvas task ${item.index} failed.`,
          details: {
            runId: item.runId,
            jobId: item.jobId,
            taskIndex: item.index,
          },
        });
      }
    });
  }, [emitUiEvent, generationReadyCount, generationTaskStateByIndex]);
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
  const canConfirmBilling = getAvailableCredits() >= billingCost;
  const lockedCanvasMode: "free" | "ppt" = effectiveIntent === "ppt" ? "ppt" : "free";
  const imageGenerationTaskByIndex = useMemo(() => {
    return new Map(imageGenerationTasks.map((task) => [task.index, task] as const));
  }, [imageGenerationTasks]);
  useEffect(() => {
    const scopeAlreadyInitialized = initializedWorkspaceScopeKeys.has(sessionPrefsScopeKey);
    if (scopeAlreadyInitialized) {
      logGenerationCacheGuard("skip-clear-current-generation-state", {
        reason: "scope-already-initialized",
        scope: sessionPrefsScopeKey,
      });
    } else {
      initializedWorkspaceScopeKeys.add(sessionPrefsScopeKey);
    }
    let cancelled = false;
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

    const clearStateForFreshScope = () => {
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
    };

    const restorePersistedGenerationState = async () => {
      const projectId =
        routeProjectId ||
        projectIdRef.current?.trim() ||
        initialEntry.project?.projectId?.trim() ||
        "";
      if (!projectId) {
        clearStateForFreshScope();
        return;
      }
      emitUiEvent({
        action: "ui.project.restore.start",
        status: "info",
        message: "Started restoring project generation state.",
        details: {
          entrySource: "project_restore",
          projectId,
        },
      });
      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}`,
          {
            method: "GET",
            credentials: "same-origin",
          },
        );
        if (!response.ok) {
          clearStateForFreshScope();
          return;
        }
        const payload = (await response.json()) as ImageGenerationRestoreResponse;
        if (cancelled) {
          return;
        }
        const restoredProjectFormat = (payload.project?.format || "").trim();
        const restoredProjectTitle = (payload.project?.title || "").trim();
        if (restoredProjectTitle) {
          setWorkspaceProjectTitle(restoredProjectTitle);
          if (!topicContextPrompt.trim()) {
            setTopicContextPrompt(restoredProjectTitle);
          }
        }
        const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
        const restoredPages = Array.isArray(payload.pages) ? payload.pages : [];
        if (!payload.ok || (!payload.job?.id && restoredPages.length === 0) || (tasks.length === 0 && restoredPages.length === 0)) {
          clearStateForFreshScope();
          return;
        }

        const jobId = payload.job?.id?.trim() || "";
        const hasRealImageGenerationJob = Boolean(jobId || tasks.length > 0);
        const restoredRunId =
          normalizeGenerationRunId(payload.job?.runId) ||
          normalizeGenerationRunId(jobId ? `restored-${jobId}` : `restored-pages-${projectId}`);
        const now = Date.now();
        const restoredState: Record<number, GenerationTaskUiState> = {};
        for (const task of tasks) {
          const index = Math.round(Number(task.index));
          if (!Number.isFinite(index) || index <= 0) {
            continue;
          }
          const status = normalizeImageTaskStatus(task.status);
          const imageUrl = (task.renderUrl || task.imageUrl || "").trim();
          const attempts = Math.max(1, Math.round(Number(task.attempts || 1)));
          const isFreshLoading = isRestoredLoadingStateStillFresh(task.updatedAt, task.createdAt, payload.project?.updatedAt);
          if (imageUrl && isRestoredImageSuccessStatus(status)) {
            restoredState[index] = {
              index,
              status: "success",
              attempts,
              maxAttempts: 1,
              imageUrl,
              rawImageUrl: task.rawImageUrl?.trim() || undefined,
              runId: restoredRunId || undefined,
              jobId,
              source: "restored",
              startedAt: now,
              lastUpdatedAt: now,
            };
            continue;
          }
          if (isRestoredImageLoadingStatus(status) && isFreshLoading) {
            restoredState[index] = {
              index,
              status: status === "queued" ? "queued" : "generating",
              attempts,
              maxAttempts: 1,
              rawImageUrl: task.rawImageUrl?.trim() || undefined,
              runId: restoredRunId || undefined,
              jobId,
              source: "restored",
              startedAt: now,
              lastUpdatedAt: now,
            };
            continue;
          }
          if (isRestoredImageFailedStatus(status) || isRestoredImageLoadingStatus(status)) {
            restoredState[index] = {
              index,
              status: "failed",
              attempts,
              maxAttempts: 1,
              error:
                task.errorMessage?.trim() ||
                (isRestoredImageLoadingStatus(status)
                  ? "Generation stopped updating and was marked as failed. Please retry this page."
                  : "Generation failed. Please retry this page."),
              errorCode:
                task.errorCode?.trim() ||
                (isRestoredImageLoadingStatus(status) ? "IMG-STALE" : "IMG-500"),
              runId: restoredRunId || undefined,
              jobId,
              source: "restored",
              startedAt: now,
              lastUpdatedAt: now,
            };
          }
        }

        const normalizedJobStatus = normalizeImageTaskStatus(payload.job?.status);
        for (const page of restoredPages) {
          const index = Math.max(1, Math.round(Number(page.pageIndex || 0)));
          if (!Number.isFinite(index) || index <= 0 || restoredState[index]) {
            continue;
          }
          const historyItems = Array.isArray(page.imageHistory) ? page.imageHistory : [];
          const latestHistoryItem = historyItems[0];
          const pageStatus = normalizeImageTaskStatus(page.status);
          const historyStatus = normalizeImageTaskStatus(latestHistoryItem?.status);
          const derivedStatus = pageStatus || historyStatus || (hasRealImageGenerationJob ? normalizedJobStatus : "");
          const imageUrl = pickRestoredImageUrl({
            page,
            history: historyItems,
          });
          const attempts = Math.max(1, Math.round(Number(latestHistoryItem?.attempts || 1)));
          const isFreshLoading = isRestoredLoadingStateStillFresh(
            latestHistoryItem?.updatedAt,
            latestHistoryItem?.createdAt,
            page.updatedAt,
            page.createdAt,
            payload.project?.updatedAt,
          );

          if (imageUrl && isRestoredImageSuccessStatus(derivedStatus || "asset_ready")) {
            restoredState[index] = {
              index,
              status: "success",
              attempts,
              maxAttempts: 1,
              imageUrl,
              rawImageUrl: latestHistoryItem?.rawImageUrl?.trim() || page.rawImageUrl?.trim() || undefined,
              runId: restoredRunId || undefined,
              jobId,
              source: "restored",
              startedAt: now,
              lastUpdatedAt: now,
            };
            continue;
          }

          if (isRestoredImageFailedStatus(derivedStatus)) {
            restoredState[index] = {
              index,
              status: "failed",
              attempts,
              maxAttempts: 1,
              error:
                latestHistoryItem?.errorMessage?.trim() ||
                "Generation failed. Please retry this page.",
              errorCode:
                latestHistoryItem?.errorCode?.trim() ||
                page.errorCode?.trim() ||
                "IMG-500",
              runId: restoredRunId || undefined,
              jobId,
              source: "restored",
              startedAt: now,
              lastUpdatedAt: now,
            };
            continue;
          }

          if (hasRealImageGenerationJob && isRestoredImageLoadingStatus(derivedStatus) && isFreshLoading) {
            restoredState[index] = {
              index,
              status: derivedStatus === "queued" ? "queued" : "generating",
              attempts,
              maxAttempts: 1,
              rawImageUrl: latestHistoryItem?.rawImageUrl?.trim() || page.rawImageUrl?.trim() || undefined,
              runId: restoredRunId || undefined,
              jobId,
              source: "restored",
              startedAt: now,
              lastUpdatedAt: now,
            };
            continue;
          }

          if (hasRealImageGenerationJob && !imageUrl) {
            restoredState[index] = {
              index,
              status: "failed",
              attempts,
              maxAttempts: 1,
              error:
                isRestoredImageLoadingStatus(derivedStatus)
                  ? "Generation stopped updating and was marked as failed. Please retry this page."
                  : "Generation failed. Please retry this page.",
              errorCode:
                latestHistoryItem?.errorCode?.trim() ||
                page.errorCode?.trim() ||
                (isRestoredImageLoadingStatus(derivedStatus) ? "IMG-STALE" : "IMG-500"),
              runId: restoredRunId || undefined,
              jobId,
              source: "restored",
              startedAt: now,
              lastUpdatedAt: now,
            };
          }
        }

        const restoredEntries = Object.values(restoredState);
        if (!restoredEntries.length && !restoredPages.length) {
          clearStateForFreshScope();
          return;
        }

        if (restoredRunId) {
          currentGenerationRunIdRef.current = restoredRunId;
          currentGenerationJobIdRef.current = jobId;
          setCurrentGenerationRunId(restoredRunId);
          setCurrentGenerationJobId(jobId);
          autoGenerationArmedRunIdsRef.current[restoredRunId] = false;
          if (restoredEntries.some((item) => item.status === "success")) {
            autoGenerationSuccessLockedRunIdsRef.current[restoredRunId] = true;
          }
          if (restoredEntries.some((item) => item.status === "failed")) {
            autoGenerationFailureLockedRunIdsRef.current[restoredRunId] = true;
          }
        }

        const restoredIntent = (
          restoredProjectFormat ||
          payload.job?.intent ||
          restoredPages.find((page) => page.outputType?.trim())?.outputType ||
          ""
        ).trim();
        if (restoredIntent === "poster" || restoredIntent === "ppt" || restoredIntent === "video") {
          setManualIntent(restoredIntent);
        }
        if (restoredIntent === "ppt" || restoredIntent === "video") {
          const restoredImageCount = restoredEntries.reduce(
            (max, item) => Math.max(max, Math.round(Number(item.index || 0))),
            0,
          );
          const restoredPageCount = restoredPages.reduce(
            (max, item) => Math.max(max, Math.round(Number(item.pageIndex || 0))),
            0,
          );
          const restoredTotalCount = Math.max(restoredImageCount, restoredPageCount);
          if (restoredTotalCount > 0) {
            const restoredBodyCount = clamp(restoredTotalCount > 6 ? restoredTotalCount - 1 : restoredTotalCount, 6, 24);
            if (restoredIntent === "ppt") {
              setPptPageCount(restoredBodyCount);
            } else {
              setVideoStoryboardCount(restoredBodyCount);
            }
            setEditableSlideDrafts((prev) =>
              buildRestoredSlideDrafts(restoredIntent, restoredTotalCount, prev, restoredPages),
            );
            setEditableOutlineItems((prev) =>
              restoredPages.length
                ? Array.from({ length: restoredTotalCount }, (_, idx) => {
                    const restoredPage = restoredPages.find((item) => Math.round(Number(item.pageIndex || 0)) === idx + 1);
                    return restoredPage?.title?.trim() || prev[idx] || `${restoredIntent === "ppt" ? "Slide" : "Frame"} ${idx + 1}`;
                  })
                : prev.length >= restoredTotalCount
                  ? prev
                  : Array.from({ length: restoredTotalCount }, (_, idx) => prev[idx] || `${restoredIntent === "ppt" ? "Slide" : "Frame"} ${idx + 1}`),
            );
          }
        }
        if (!hasRealImageGenerationJob && restoredPages.length > 0) {
          restoredProjectRef.current = true;
          clearCurrentGenerationState("restore-billing-draft-only");
          setGenerationTaskStateByIndex({});
          setGenerationConfirmError(null);
          setConfigConfirmed(true);
          setBillingConfirmed(false);
          setFlowStage("billing");
          logGenerationCacheGuard("restored-persisted-generation-state", {
            reason: "project-billing-draft-only",
            projectId,
            jobId,
            runId: restoredRunId,
            count: restoredPages.length,
          });
          emitUiEvent({
            action: "ui.project.restore.success",
            status: "ok",
            message: "Restored billing-stage project draft.",
            details: {
              entrySource: "project_restore",
              projectId,
              runId: restoredRunId,
              jobId,
              restoreSuccessCount: restoredPages.filter((page) => (page.imageUrl || "").trim()).length,
              restoreFailedCount: 0,
              restoreLoadingCount: 0,
              jobStatus: payload.job?.status || "billing_pending",
            },
          });
          return;
        }

        restoredProjectRef.current = true;
        setGenerationTaskStateByIndex(restoredState);
        setGenerationConfirmError(null);
        setConfigConfirmed(true);
        setBillingConfirmed(true);
        setFlowStage("generate");
        logGenerationCacheGuard("restored-persisted-generation-state", {
          reason: "project-image-job",
          projectId,
          jobId,
          runId: restoredRunId,
          count: restoredEntries.length,
        });
        emitUiEvent({
          action: "ui.project.restore.success",
          status: "ok",
          message: "Restored project generation state.",
          details: {
            entrySource: "project_restore",
            projectId,
            runId: restoredRunId,
            jobId,
            restoreSuccessCount: restoredEntries.filter((item) => item.status === "success").length,
            restoreFailedCount: restoredEntries.filter((item) => item.status === "failed").length,
            restoreLoadingCount: restoredEntries.filter((item) => item.status === "queued" || item.status === "generating").length,
            jobStatus: payload.job?.status || "unknown",
          },
        });
      } catch (error) {
        if (!cancelled) {
          logGenerationCacheGuard("restore-persisted-generation-state-failed", {
            reason: "fetch-error",
            message: error instanceof Error ? error.message : "Unknown restore error",
          });
          clearStateForFreshScope();
        }
      }
    };

    void restorePersistedGenerationState();
    return () => {
      cancelled = true;
    };
  }, [clearCurrentGenerationState, initialEntry.project?.projectId, routeProjectId, sessionPrefsScopeKey]);
  useEffect(() => {
    if (!debugGoGenerateStepEnabled) {
      debugGoGenerateStepAppliedRef.current = false;
      return;
    }
    if (debugGoGenerateStepAppliedRef.current) {
      return;
    }
    logWorkspaceVerbose("[workspace-generation] debugGoGenerateStep applied", {
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
    (tasks: ImageGenerationTask[]) => {
      const entryContext = resolveEntrySource();
      return ({
        intent: effectiveIntent,
        normalizedDirection: normalizedGenerationConfig.normalizedDirection,
        normalizedCount: standardOutputCount,
        normalizedRatio: normalizedGenerationConfig.normalizedRatio,
        projectId: projectIdRef.current ?? undefined,
        projectTraceId: projectTraceIdRef.current ?? undefined,
        outputs: standardOutputCount,
        style: {
          id: selectedStyle.id,
          name: selectedStyle.englishName ?? selectedStyle.name,
          prompt: selectedStyle.prompt,
        },
        clientContext: {
          entrySource: entryContext.entrySource,
          sourceConfidence: entryContext.sourceConfidence,
          currentRoute: pathname || "/workspace",
          flowStage,
          isRestoredProject: restoredProjectRef.current,
          isNewProject: !routeProjectId,
          generationDirection: normalizedGenerationConfig.normalizedDirection,
          styleId: selectedStyle.id,
          styleName: selectedStyle.englishName ?? selectedStyle.name,
          requestedCount: normalizedGenerationConfig.normalizedCount,
          taskCount: tasks.length,
          inputType: inferWorkspaceInputType({
            prompt: contextPrompt,
            sources: entrySources,
          }),
          promptHash: hashWorkspaceTelemetryText(contextPrompt),
          promptLength: contextPrompt.trim().length,
          stylePromptHash: hashWorkspaceTelemetryText(selectedStyle.prompt),
          stylePromptLength: selectedStyle.prompt.trim().length,
        },
        ratio: normalizedGenerationConfig.normalizedRatio,
        imageModel: "gpt-image-2",
        billing: {
          languageModelCredits,
          imageModelCredits,
          imageCreditsPerTask: STANDARD_OUTPUT_PROMO_CREDITS,
          projectTitle: workspaceProjectTitle || topic || "Generation Project",
        },
        tasks,
      });
    },
    [
      contextPrompt,
      effectiveIntent,
      entrySources,
      flowStage,
      imageModelCredits,
      languageModelCredits,
      normalizedGenerationConfig.normalizedDirection,
      normalizedGenerationConfig.normalizedRatio,
      normalizedGenerationConfig.normalizedCount,
      pathname,
      resolveEntrySource,
      routeProjectId,
      selectedStyle.englishName,
      selectedStyle.id,
      selectedStyle.name,
      selectedStyle.prompt,
      standardOutputCount,
      topic,
      workspaceProjectTitle,
    ],
  );
  const runGenerationBatch = useCallback(
    async (
      tasks: ImageGenerationTask[],
      isRetry = false,
      runIdOverride?: string | null,
      preparedPayload?: ImageGenerateBatchResponse | null,
    ) => {
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
      logWorkspaceVerbose("[workspace-generation] runGenerationBatch called", {
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
      const upsertImageErrorTurn = (_task: ImageGenerationTask, _errorText: string) => {
        // Image errors belong on the canvas card, not in the conversation flow.
      };
      const appendRefundNotice = (message: string, wasRefunded: boolean) => {
        const trimmed = (message || tr("Generation failed.", "生成失败。")).trim();
        if (!wasRefunded || /credit[s]?\s+(have\s+been\s+)?refunded/i.test(trimmed)) {
          return trimmed;
        }
        return `${trimmed} Credits have been refunded.`;
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
            errorCode: undefined,
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
            errorCode: undefined,
            startedAt: prev[task.index]?.startedAt ?? now,
            lastUpdatedAt: now,
          },
        }));
      });
      const idempotencyKey = buildStableGenerationIdempotencyKey({
        userEmail: currentEmail || "guest",
        projectId: projectIdRef.current,
        projectTraceId: projectTraceIdRef.current,
        runId: activeRunId,
        tasks,
      });
      logWorkspaceVerbose("[workspace-generation] generate-batch request started", {
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
        let responseOk = true;
        let responseStatus = 200;
        let payload: ImageGenerateBatchResponse | null = preparedPayload ?? null;
        if (!payload?.job?.id) {
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
            responseOk = response.ok;
            responseStatus = response.status;
            payload = (await response.json().catch(() => null)) as ImageGenerateBatchResponse | null;
          } finally {
            window.clearTimeout(timeoutId);
          }
        } else {
          window.clearTimeout(timeoutId);
        }
        const responseRunId = normalizeGenerationRunId(payload?.job?.runId);
        let responseJobId = (payload?.job?.id || "").trim() || null;
        logWorkspaceVerbose("[workspace-generation] generate-batch response", {
          ok: responseOk,
          status: responseStatus,
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
            httpOk: responseOk,
            httpStatus: responseStatus,
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
          autoGenerationFailureLockedRunIdsRef.current[activeRunId] = true;
          logGenerationCacheGuard("reject-state-write", {
            reason: "missing-response-run",
            requestRunId: activeRunId,
            responseRunId,
            responseJobId,
          });
          tasks.forEach((task) => {
            const wasRefunded = refundImageTaskCredits({
              runId: activeRunId,
              taskIndex: task.index,
              reason: "IMAGE_RUN_ID_MISSING",
            });
            const taskError = appendRefundNotice(missingRunMessage, wasRefunded);
            setGenerationTaskStateByIndex((prev) => ({
              ...prev,
              [task.index]: {
                index: task.index,
                status: "failed",
                attempts: 1,
                maxAttempts,
                error: taskError,
                errorCode: "IMAGE_RUN_ID_MISSING",
                runId: activeRunId,
                jobId: responseJobId || currentGenerationJobIdRef.current || undefined,
                source: "current-run",
                startedAt: prev[task.index]?.startedAt ?? Date.now(),
                lastUpdatedAt: Date.now(),
              },
            }));
            upsertImageErrorTurn(task, taskError);
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
          autoGenerationFailureLockedRunIdsRef.current[activeRunId] = true;
          logGenerationCacheGuard("reject-state-write", {
            reason: "job-id-mismatch",
            requestRunId: activeRunId,
            responseRunId,
            responseJobId,
          });
          tasks.forEach((task) => {
            const wasRefunded = refundImageTaskCredits({
              runId: activeRunId,
              taskIndex: task.index,
              reason: "IMAGE_JOB_ID_MISSING",
            });
            const taskError = appendRefundNotice(missingJobMessage, wasRefunded);
            setGenerationTaskStateByIndex((prev) => ({
              ...prev,
              [task.index]: {
                index: task.index,
                status: "failed",
                attempts: 1,
                maxAttempts,
                error: taskError,
                errorCode: "IMAGE_JOB_ID_MISSING",
                runId: activeRunId,
                source: "current-run",
                startedAt: prev[task.index]?.startedAt ?? Date.now(),
                lastUpdatedAt: Date.now(),
              },
            }));
            upsertImageErrorTurn(task, taskError);
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
        const pollActiveTaskStatuses = new Set(["queued", "generating", "asset_downloading"]);
        const pollTerminalTaskStatuses = new Set([
          "asset_ready",
          "completed",
          "success",
          "succeeded",
          "billing_failed",
          "failed",
          "timed_out",
          "timeout",
          "error",
          "cancelled",
          "canceled",
        ]);
        const pollTerminalJobStatuses = new Set([
          "completed",
          "completed_with_errors",
          "billing_failed",
          "failed",
          "timed_out",
        ]);
        const pollBlockingRunCodes = new Set([
          "IMAGE_BILLING_PENDING",
          "IMAGE_BILLING_FAILED",
          "TASK_NOT_QUEUED",
        ]);
        const mergePolledPayload = (
          nextPayload: ImageGenerateBatchResponse | null,
          previousPayload: ImageGenerateBatchResponse | null,
          fallbackJobId: string,
        ): ImageGenerateBatchResponse | null => {
          if (!nextPayload?.job?.id) {
            return null;
          }
          return {
            ...nextPayload,
            ok: nextPayload.ok ?? true,
            imageGenerationMode: previousPayload?.imageGenerationMode,
            attemptedProviders: previousPayload?.attemptedProviders,
            skippedProviders: previousPayload?.skippedProviders,
            job: {
              ...nextPayload.job,
              id: nextPayload.job.id || fallbackJobId,
              runId: normalizeGenerationRunId(nextPayload.job.runId) || activeRunId,
            },
          };
        };
        const writeReadyTasksFromPayload = (nextPayload: ImageGenerateBatchResponse | null, jobId: string) => {
          nextPayload?.tasks?.forEach((taskResult) => {
            const taskIndex = Number(taskResult.index || 0);
            const statusValue = (taskResult.status || "").trim().toLowerCase();
            const imageUrl = taskResult.renderUrl || taskResult.imageUrl || taskResult.render_url || taskResult.image_url || "";
            if (!taskIndex || !imageUrl || statusValue !== "asset_ready") {
              return;
            }
            const renderImageUrl = appendKnowLensRenderAttemptToken(
              imageUrl,
              `${renderAttemptToken}-${taskIndex}`,
            );
            setGenerationTaskStateByIndex((prev) => ({
              ...prev,
              [taskIndex]: {
                index: taskIndex,
                status: "success",
                attempts: prev[taskIndex]?.attempts || 1,
                maxAttempts,
                imageUrl: renderImageUrl,
                rawImageUrl: taskResult.rawImageUrl || taskResult.raw_image_url || undefined,
                runId: activeRunId,
                jobId,
                source: "current-run",
                error: undefined,
                errorCode: undefined,
                startedAt: prev[taskIndex]?.startedAt ?? Date.now(),
                lastUpdatedAt: Date.now(),
              },
            }));
          });
        };
        const buildPollFailurePayload = (
          basePayload: ImageGenerateBatchResponse | null,
          jobId: string,
          code: string,
          message: string,
        ): ImageGenerateBatchResponse => {
          generationRequestInFlightRef.current = false;
          autoGenerationFailureLockedRunIdsRef.current[activeRunId] = true;
          setGenerationConfirmError(message);
          setGenerationTaskStateByIndex((prev) => {
            const now = Date.now();
            const next = { ...prev };
            const backendTasks = new Map(
              (basePayload?.tasks ?? []).map((taskResult) => [
                Math.round(Number(taskResult.index || 0)),
                taskResult,
              ]),
            );
            tasks.forEach((task) => {
              const backendTask = backendTasks.get(task.index);
              const backendStatus = (backendTask?.status || "").trim().toLowerCase();
              const backendImageUrl = backendTask?.renderUrl || backendTask?.imageUrl || backendTask?.render_url || backendTask?.image_url || "";
              if ((backendStatus === "asset_ready" || backendStatus === "success") && backendImageUrl) {
                return;
              }
              next[task.index] = {
                index: task.index,
                status: "failed",
                attempts: prev[task.index]?.attempts || 1,
                maxAttempts,
                imageUrl: undefined,
                rawImageUrl: backendTask?.rawImageUrl || backendTask?.raw_image_url || undefined,
                runId: activeRunId,
                jobId,
                source: "current-run",
                error: backendTask?.error || message,
                errorCode: backendTask?.errorCode || code,
                startedAt: prev[task.index]?.startedAt ?? now,
                lastUpdatedAt: now,
              };
            });
            return next;
          });
          tasks.forEach((task) => upsertImageErrorTurn(task, message));
          const backendTasks = new Map(
            (basePayload?.tasks ?? []).map((taskResult) => [
              Math.round(Number(taskResult.index || 0)),
              taskResult,
            ]),
          );
          return {
            ...basePayload,
            ok: false,
            error: message,
            code,
            job: {
              ...(basePayload?.job ?? {}),
              id: basePayload?.job?.id || jobId,
              runId: normalizeGenerationRunId(basePayload?.job?.runId) || activeRunId,
              status: basePayload?.job?.status || "failed",
            },
            tasks: tasks.map((task) => {
              const backendTask = backendTasks.get(task.index);
              const backendStatus = (backendTask?.status || "").trim().toLowerCase();
              const backendImageUrl = backendTask?.renderUrl || backendTask?.imageUrl || backendTask?.render_url || backendTask?.image_url || "";
              if ((backendStatus === "asset_ready" || backendStatus === "success") && backendImageUrl) {
                return {
                  ...backendTask,
                  index: task.index,
                };
              }
              if (backendStatus === "failed" || backendStatus === "timed_out" || backendStatus === "billing_failed") {
                return {
                  ...backendTask,
                  index: task.index,
                  ok: false,
                  error: backendTask?.error || message,
                  errorCode: backendTask?.errorCode || code,
                };
              }
              return {
                ...backendTask,
                index: task.index,
                status: "failed",
                ok: false,
                imageUrl: undefined,
                renderUrl: undefined,
                rawImageUrl: backendTask?.rawImageUrl || backendTask?.raw_image_url,
                error: message,
                errorCode: code,
              };
            }),
          };
        };
        const pollJobStatus = async (jobId: string, initialPayload: ImageGenerateBatchResponse | null) => {
          const pollStartedAt = Date.now();
          emitUiEvent({
            action: "ui.job.poll.start",
            status: "info",
            message: "Started polling image generation job status.",
            details: {
              jobId,
              runId: activeRunId,
            },
          });
          let latestPayload = initialPayload;
          while (Date.now() - pollStartedAt < GENERATION_JOB_POLL_TIMEOUT_MS) {
            const status = (latestPayload?.job?.status || "").trim().toLowerCase();
            const taskStatuses = latestPayload?.tasks?.map((task) => (task.status || "").trim().toLowerCase()) ?? [];
            const hasPendingTask = taskStatuses.some((item) => pollActiveTaskStatuses.has(item));
            const hasQueuedTask = taskStatuses.some((item) => item === "queued");
            const isRunningJob = status === "queued" || status === "running" || status === "processing";
            if (pollTerminalJobStatuses.has(status)) {
              emitUiEvent({
                action: "ui.job.poll.stop",
                status: "ok",
                message: "Stopped polling after terminal job status.",
                details: {
                  jobId,
                  runId: activeRunId,
                  durationMs: Date.now() - pollStartedAt,
                  finalJobStatus: status,
                },
              });
              return latestPayload;
            }
            if (!isRunningJob && !hasPendingTask) {
              emitUiEvent({
                action: "ui.job.poll.stop",
                status: "ok",
                message: "Stopped polling because no active job state remained.",
                details: {
                  jobId,
                  runId: activeRunId,
                  durationMs: Date.now() - pollStartedAt,
                  finalJobStatus: status,
                },
              });
              return latestPayload;
            }
            if (isRunningJob && !hasPendingTask) {
              const allTasksTerminal =
                taskStatuses.length > 0 &&
                taskStatuses.every((item) => pollTerminalTaskStatuses.has(item));
              if (allTasksTerminal) {
                emitUiEvent({
                  action: "ui.job.poll.stop",
                  status: "ok",
                  message: "Stopped polling because all tasks reached terminal state.",
                  details: {
                    jobId,
                    runId: activeRunId,
                    durationMs: Date.now() - pollStartedAt,
                    finalJobStatus: status,
                  },
                });
                return latestPayload;
              }
              return buildPollFailurePayload(
                latestPayload,
                jobId,
                "IMAGE_JOB_NO_RUNNABLE_TASKS",
                tr(
                  "Image generation could not continue because no runnable tasks were found. Please retry manually.",
                  "图片生成无法继续，因为没有可执行的任务。请手动重试。",
                ),
              );
            }
            if (hasQueuedTask) {
              const runResponse = await fetch("/api/workspace/image/tasks/run", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                credentials: "same-origin",
                body: JSON.stringify({ jobId }),
              });
              const runPayload = (await runResponse.json().catch(() => null)) as ImageGenerateBatchResponse | null;
              const mergedRunPayload = mergePolledPayload(runPayload, latestPayload, jobId);
              if (mergedRunPayload) {
                latestPayload = mergedRunPayload;
                responseJobId = (latestPayload.job?.id || "").trim() || jobId;
                writeReadyTasksFromPayload(latestPayload, jobId);
                const runCode = (runPayload?.code || "").trim().toUpperCase();
                if (!runResponse.ok || pollBlockingRunCodes.has(runCode)) {
                  return buildPollFailurePayload(
                    latestPayload,
                    jobId,
                    runCode || `HTTP_${runResponse.status}`,
                    runPayload?.error ||
                      tr(
                        "Image generation could not start. Please retry manually.",
                        "图片生成无法启动。请手动重试。",
                      ),
                  );
                }
                continue;
              }
              if (!runResponse.ok) {
                return buildPollFailurePayload(
                  latestPayload,
                  jobId,
                  runPayload?.code || `HTTP_${runResponse.status}`,
                  runPayload?.error ||
                    tr(
                      "Image generation task runner failed. Please retry manually.",
                      "图片生成任务执行失败。请手动重试。",
                    ),
                );
              }
            }
            await new Promise((resolve) => window.setTimeout(resolve, GENERATION_JOB_POLL_INTERVAL_MS));
            const statusResponse = await fetch(`/api/workspace/image/jobs/${encodeURIComponent(jobId)}`, {
              method: "GET",
              credentials: "same-origin",
            });
            const statusPayload = (await statusResponse.json().catch(() => null)) as ImageGenerateBatchResponse | null;
            if (!statusResponse.ok || !statusPayload?.job?.id) {
              return latestPayload;
            }
            latestPayload = mergePolledPayload(statusPayload, latestPayload, jobId) ?? latestPayload;
            responseJobId = (latestPayload?.job?.id || "").trim() || jobId;
            writeReadyTasksFromPayload(latestPayload, jobId);
          }
          emitUiEvent({
            action: "ui.job.poll.stop",
            status: "error",
            code: latestPayload?.code || "IMAGE_JOB_POLL_TIMEOUT",
            message: latestPayload?.error || tr("Generation timed out.", "生成超时。"),
            details: {
              jobId,
              runId: activeRunId,
              durationMs: Date.now() - pollStartedAt,
              finalJobStatus: latestPayload?.job?.status || "unknown",
            },
          });
          return buildPollFailurePayload(
            latestPayload,
            jobId,
            latestPayload?.code || "IMAGE_JOB_POLL_TIMEOUT",
            latestPayload?.error || tr("Generation timed out.", "生成超时。"),
          );
        };
        if (responseOk && responseJobId) {
          payload = await pollJobStatus(responseJobId, payload);
        }
        if (!responseOk || !payload?.tasks?.length) {
          const failureMessage =
            payload?.error ||
            (responseOk ? tr("Generation failed.", "生成失败。") : `generation batch failed (${responseStatus})`);
          const failureCode = payload?.code || `HTTP_${responseStatus}`;
          autoGenerationFailureLockedRunIdsRef.current[activeRunId] = true;
          tasks.forEach((task) => {
            const wasRefunded = responseJobId
              ? false
              : refundImageTaskCredits({
                  runId: activeRunId,
                  taskIndex: task.index,
                  reason: failureCode,
                  mode: "client",
                });
            const taskError = appendRefundNotice(failureMessage, wasRefunded);
            setGenerationTaskStateByIndex((prev) => ({
              ...prev,
              [task.index]: {
                index: task.index,
                status: "failed",
                attempts: 1,
                maxAttempts,
                error: taskError,
                errorCode: failureCode,
                runId: activeRunId,
                jobId: responseJobId || currentGenerationJobIdRef.current || undefined,
                source: "current-run",
                startedAt: prev[task.index]?.startedAt ?? Date.now(),
                lastUpdatedAt: Date.now(),
              },
            }));
            upsertImageErrorTurn(task, taskError);
          });
          setGenerationConfirmError(failureMessage);
          logClientEvent({
            category: "image",
            action: "image_generation_request_failed",
            status: "error",
            source: imageModel,
              code: payload?.code || String(responseStatus),
              message: failureMessage,
              details: {
                statusCode: responseStatus,
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
            autoGenerationSuccessLockedRunIdsRef.current[activeRunId] = true;
            removeImageErrorTurnByTaskIndex(task.index);
            const successfulImageUrl = renderImageUrl || finalImageUrl;
            if (task.index === 1 && successfulImageUrl) {
              updateUserProjectMetadata({
                email: currentEmail,
                projectId: projectIdRef.current,
                cover: successfulImageUrl,
                format: task.outputType === "ppt" ? "PPT" : task.outputType === "video" ? "视频" : "海报",
                status: "已完成",
              });
            }
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
                imageUrl: successfulImageUrl,
                rawImageUrl: result?.rawImageUrl || undefined,
                runId: activeRunId,
                jobId: responseJobId || currentGenerationJobIdRef.current || undefined,
                source: "current-run",
                error: undefined,
                errorCode: undefined,
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
              logWorkspaceVerbose("[workspace-generation] generationTaskStateByIndex success + imageUrl", {
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
                imageUrl: successfulImageUrl,
                outputType: task.outputType,
                taskStatus: result?.status || null,
                taskId: result?.taskId || null,
              },
            });
            return;
          }
          hasFailed = true;
          autoGenerationFailureLockedRunIdsRef.current[activeRunId] = true;
          const resultErrorMessage =
            typeof (result as { errorMessage?: unknown } | undefined)?.errorMessage === "string"
              ? ((result as { errorMessage?: string }).errorMessage || "").trim()
              : "";
          const nextError =
            result?.error ||
            resultErrorMessage ||
            tr("Generation failed.", "生成失败。");
          const nextErrorCode = result?.errorCode || "IMAGE_TASK_FAILED";
          const backendStatus = (result?.status || "").trim().toLowerCase();
          const wasRefunded =
            backendStatus === "failed" || backendStatus === "timed_out"
              ? refundImageTaskCredits({
                  runId: activeRunId,
                  taskIndex: task.index,
                  reason: nextErrorCode,
                  mode: "server",
                })
              : false;
          const taskError = appendRefundNotice(nextError, wasRefunded);
          setGenerationTaskStateByIndex((prev) => {
            const nextState: GenerationTaskUiState = {
              index: task.index,
              status: "failed",
              attempts: 1,
              maxAttempts,
              error: taskError,
              errorCode: nextErrorCode,
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
                error: taskError,
              },
            });
            return next;
          });
          upsertImageErrorTurn(task, taskError);
          logClientEvent({
            category: "image",
            action: "image_generation_result_failed",
            status: "error",
            source: imageModel,
            code: nextErrorCode,
            message: taskError,
            projectId: projectIdRef.current ?? null,
            details: {
              userEmail: currentEmail || null,
              projectId: projectIdRef.current ?? null,
              runId: activeRunId,
              jobId: responseJobId || currentGenerationJobIdRef.current || null,
              taskIndex: task.index,
              taskId: result?.taskId || null,
              outputType: task.outputType,
              taskStatus: result?.status || null,
              backendTaskIndex: normalizedResult?.backendTaskIndex ?? result?.index ?? null,
              backendError: result?.error || null,
              backendErrorMessage: resultErrorMessage || null,
              backendErrorCode: result?.errorCode || null,
              responseJobStatus: payload?.job?.status || null,
              responseJobId: payload?.job?.id || null,
              responseCode: payload?.code || null,
              responseError: payload?.error || null,
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
        autoGenerationFailureLockedRunIdsRef.current[activeRunId] = true;
        tasks.forEach((task) => {
          const errorCode =
            error instanceof DOMException && error.name === "AbortError"
              ? "IMAGE_REQUEST_TIMEOUT"
              : "IMAGE_REQUEST_FAILED";
          const wasRefunded = currentGenerationJobIdRef.current
            ? false
            : refundImageTaskCredits({
                runId: activeRunId,
                taskIndex: task.index,
                reason: errorCode,
                mode: "client",
              });
          const taskError = appendRefundNotice(lastError, wasRefunded);
          setGenerationTaskStateByIndex((prev) => ({
            ...prev,
            [task.index]: {
              index: task.index,
              status: "failed",
              attempts: 1,
              maxAttempts,
              error: taskError,
              errorCode,
              imageUrl: undefined,
              rawImageUrl: undefined,
              runId: activeRunId,
              jobId: currentGenerationJobIdRef.current || undefined,
              source: "current-run",
              startedAt: prev[task.index]?.startedAt ?? Date.now(),
              lastUpdatedAt: Date.now(),
            },
          }));
          upsertImageErrorTurn(task, taskError);
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
    [buildGenerationRequestPayload, currentEmail, emitFlowAudit, imageModel, refundImageTaskCredits, setGenerationRunContext, tr],
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
        return;
      }
      const nextRunId = createGenerationRunId();
      if (!chargeImageTaskCredits({ runId: nextRunId, taskIndex: index, action: "retry" })) {
        return;
      }
      setGenerationRunContext(nextRunId, null);
      generationRequestInFlightRef.current = true;
      void runGenerationTasksOrdered([task], nextRunId, true).finally(() => {
        generationRequestInFlightRef.current = false;
      });
    },
    [chargeImageTaskCredits, imageGenerationTaskByIndex, runGenerationTasksOrdered, setGenerationRunContext],
  );
  const handleRedrawGenerationTask = useCallback(
    (index: number, copy: string) => {
      const baseTask = imageGenerationTaskByIndex.get(index);
      if (!baseTask) {
        return;
      }
      if (generationRequestInFlightRef.current) {
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
        selectedStyle: redrawTask.stylePrompt || redrawTask.styleName,
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
      if (!chargeImageTaskCredits({ runId: nextRunId, taskIndex: index, action: "redraw" })) {
        return;
      }
      setGenerationRunContext(nextRunId, null);
      generationRequestInFlightRef.current = true;
      setGenerationConfirmError(null);
      void runGenerationTasksOrdered([redrawTask], nextRunId, true).finally(() => {
        generationRequestInFlightRef.current = false;
      });
    },
    [
      chargeImageTaskCredits,
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
      const existingFailedStates = Object.values(generationTaskStateByIndex).filter(
        (item) => item.status === "failed",
      );
      if (existingFailedStates.length) {
        logWorkspaceVerbose("[WorkspaceFlowAudit] auto-trigger blocked: visible failed card exists", {
          failedTaskIndexes: existingFailedStates.map((item) => item.index),
        });
        emitFlowAudit({
          stage: "6.auto-trigger-exec",
          status: "aborted",
          decision: "no-request",
          reason: "visible-failed-card-requires-manual-retry",
          keyFields: {
            failedTaskIndexes: existingFailedStates.map((item) => item.index),
            failedCodes: existingFailedStates.map((item) => item.errorCode || null),
          },
        });
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
      setGenerationTaskStateByIndex((prev) => {
        const prevFailedStates = Object.values(prev).filter((item) => item.status === "failed");
        if (prevFailedStates.length) {
          return prev;
        }
        return pendingState;
      });
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
    [
      buildFreshImageGenerationTasks,
      emitFlowAudit,
      generationTaskStateByIndex,
      runGenerationTasksOrdered,
      setGenerationRunContext,
      tr,
    ],
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
    const supportsAutoCanvasGeneration =
      effectiveIntent === "poster" || effectiveIntent === "ppt";
    if (flowStage !== "generate" || !billingConfirmed || !supportsAutoCanvasGeneration) {
      emitFlowAudit({
        stage: "6.auto-trigger-check",
        status: "skipped",
        decision: "no-auto-trigger",
        reason: "flow-or-intent-not-ready",
        keyFields: {
          flowStage,
          billingConfirmed,
          effectiveIntent,
          supportsAutoCanvasGeneration,
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
    if (!currentRunId || !autoGenerationArmedRunIdsRef.current[currentRunId]) {
      emitFlowAudit({
        stage: "6.auto-trigger-check",
        status: "skipped",
        decision: "no-auto-trigger",
        reason: "auto-trigger-not-armed",
        keyFields: {
          currentRunId,
          hasArmedRun: Boolean(currentRunId && autoGenerationArmedRunIdsRef.current[currentRunId]),
        },
      });
      return;
    }
    if (currentRunId && autoGenerationSuccessLockedRunIdsRef.current[currentRunId]) {
      logWorkspaceVerbose("[WorkspaceFlowAudit] auto-trigger blocked: already has success", {
        currentRunId,
      });
      emitFlowAudit({
        stage: "6.auto-trigger-check",
        status: "skipped",
        decision: "no-auto-trigger",
        reason: "auto-trigger-blocked-already-has-success",
        keyFields: {
          currentRunId,
        },
      });
      return;
    }
    if (currentRunId && autoGenerationFailureLockedRunIdsRef.current[currentRunId]) {
      logWorkspaceVerbose("[WorkspaceFlowAudit] auto-trigger blocked: already has failure", {
        currentRunId,
      });
      emitFlowAudit({
        stage: "6.auto-trigger-check",
        status: "skipped",
        decision: "no-auto-trigger",
        reason: "auto-trigger-blocked-already-has-failure",
        keyFields: {
          currentRunId,
        },
      });
      return;
    }
    const states = Object.values(generationTaskStateByIndex);
    const visibleFailedStates = states.filter((item) => item.status === "failed");
    if (visibleFailedStates.length) {
      emitFlowAudit({
        stage: "6.auto-trigger-check",
        status: "skipped",
        decision: "no-auto-trigger",
        reason: "visible-failed-card-requires-manual-retry",
        keyFields: {
          currentRunId,
          failedTaskIndexes: visibleFailedStates.map((item) => item.index),
          failedCodes: visibleFailedStates.map((item) => item.errorCode || null),
        },
      });
      return;
    }
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
  const projectTitle =
    workspaceProjectTitle ||
    (isZhOutput
      ? `${topicHintText(topic, outputLanguage)} · 用户意图总结`
      : `${topicHintText(topic, outputLanguage)} · Intent Summary`);
  const outputSummaryTitle =
    cleanProjectTitleCandidate(workspaceProjectTitle || projectTitle || topic, outputLanguage) ||
    topicHintText(topic, outputLanguage);
  const outputSummaryFormatLabel =
    effectiveIntent === "ppt" ? "PPT" : effectiveIntent === "video" ? "Video" : "Poster";
  const outputSummaryAngle = useMemo(() => {
    if (lockedTopicSuggestion?.trim()) {
      return cleanProjectTitleCandidate(lockedTopicSuggestion, outputLanguage) || lockedTopicSuggestion.trim();
    }
    if (effectiveIntent === "poster") {
      const plan = (editablePosterPlanList.length ? editablePosterPlanList : basePosterPlanList)[0];
      return (
        cleanProjectTitleCandidate(plan?.focus || plan?.title || visualizationTypeHint || "", outputLanguage) ||
        visualizationTypeHint ||
        "Visual learning summary"
      );
    }
    const firstContentSlide =
      displaySlideDrafts.find((slide) => !slide.isCover) ?? displaySlideDrafts[0];
    return (
      cleanProjectTitleCandidate(firstContentSlide?.title || firstContentSlide?.body || visualizationTypeHint || "", outputLanguage) ||
      visualizationTypeHint ||
      "Structured visual explanation"
    );
  }, [
    basePosterPlanList,
    displaySlideDrafts,
    editablePosterPlanList,
    effectiveIntent,
    lockedTopicSuggestion,
    outputLanguage,
    visualizationTypeHint,
  ]);
  const outputSummaryCanDownload =
    allGenerationReady &&
    (effectiveIntent === "ppt"
      ? isPptExportReady && !isExportingPpt
      : effectiveIntent === "video"
        ? !isComposingVideo
        : true);
  const outputSummaryStatusLabel = allGenerationReady
    ? "Generation complete"
    : generationInProgress
      ? "Generating visual pages"
      : "Preparing generation";
  const handleOutputSummaryDownload = useCallback(() => {
    if (effectiveIntent === "ppt") {
      modeActionsRef.current.exportPpt();
      return;
    }
    if (effectiveIntent === "video") {
      modeActionsRef.current.downloadVideo();
      return;
    }
    modeActionsRef.current.downloadPoster();
  }, [effectiveIntent]);

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
    const serialized = JSON.stringify(payload);
    if (workspaceSessionPrefsPayloadCache.get(sessionPrefsScopeKey) === serialized) {
      return;
    }
    try {
      window.sessionStorage.setItem(sessionPrefsScopeKey, serialized);
      workspaceSessionPrefsPayloadCache.set(sessionPrefsScopeKey, serialized);
    } catch {
      // Ignore storage quota failures; preferences will fall back to current React state.
    }
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
    if (typeof window === "undefined") {
      return;
    }
    if (chatHistoryWriteTimerRef.current) {
      window.clearTimeout(chatHistoryWriteTimerRef.current);
    }
    chatHistoryWriteTimerRef.current = window.setTimeout(() => {
      writeWorkspaceChatHistory(sessionPrefsScopeKey, updates);
      chatHistoryWriteTimerRef.current = null;
    }, 180);
    return () => {
      if (!chatHistoryWriteTimerRef.current) {
        return;
      }
      window.clearTimeout(chatHistoryWriteTimerRef.current);
      chatHistoryWriteTimerRef.current = null;
    };
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

  const upsertImageErrorCard = useCallback((_task: ImageGenerationTask, _errorText: string) => {
    // Image generation failures are shown on the canvas task card only.
  }, []);

  useEffect(() => {
    if (flowStage !== "generate") {
      return;
    }
    if (!Object.keys(generationTaskStateByIndex).length) {
      return;
    }
    const timer = window.setInterval(() => {
      if (generationRequestInFlightRef.current) {
        return;
      }
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
          const timedOutRunId = normalizeGenerationRunId(taskState.runId);
          if (timedOutRunId) {
            autoGenerationFailureLockedRunIdsRef.current[timedOutRunId] = true;
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
    logWorkspaceVerbose("[workspace-generation] state snapshot", {
      entries,
      imageGenerationTasksLength: imageGenerationTasks.length,
      flowStage,
      currentGenerationRunId,
      currentGenerationJobId,
    });
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
    setIsDraftGenerationPending(true);
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
      setEditablePosterDraft(null);
      setEditablePosterPlanList([]);
      try {
        const bodyCount = effectiveIntent === "ppt" ? pptPageCount : videoStoryboardCount;
        const count = bodyCount + 1;
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
            isCover?: boolean;
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
            isCover: item.isCover === true,
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
            isCover: item.isCover === true,
          }));
        }
        setEditableOutlineItems(nextOutline.length ? nextOutline : baseOutlineItems);
        setEditableSlideDrafts(nextSlides.length ? nextSlides : baseSlideDrafts);
        const nextProjectTitle = deriveWorkspaceProjectTitle({
          outputLanguage,
          topic,
          intent: effectiveIntent,
          slides: nextSlides.length ? nextSlides : baseSlideDrafts,
        });
        setWorkspaceProjectTitle(nextProjectTitle);
        updateUserProjectMetadata({
          email: currentEmail,
          projectId: projectIdRef.current,
          title: nextProjectTitle,
          format: effectiveIntent === "video" ? "视频" : "PPT",
        });
        persistWorkspaceProjectPages({
          projectId: projectIdRef.current,
          outputType: effectiveIntent === "video" ? "video" : "ppt",
          pages: (nextSlides.length ? nextSlides : baseSlideDrafts).map((slide, idx) => ({
            index: Number.isFinite(slide.page) ? slide.page : idx + 1,
            pageRole: slide.isCover ? "cover" : "content",
            title: slide.title,
            body: slide.body,
            visual: slide.visual,
            imagePromptDraft: slide.imagePromptDraft || slide.imagePrompt || "",
          })),
        });
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
        setEditableOutlineItems([]);
        setEditableSlideDrafts([]);
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
        setIsDraftGenerationPending(false);
      }
      return requestSucceeded;
    }

    const requestId = posterDraftRequestRef.current + 1;
    posterDraftRequestRef.current = requestId;
    let requestSucceeded = true;
    setDraftLlmUsage(null);
    setEditablePosterDraft(null);
    setEditablePosterPlanList([]);
    setUpdates((prev) => prev.filter((item) => item.meta?.kind !== "llm_error"));
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
      setEditablePosterDraft(data.posterDraft ?? null);
      setEditablePosterPlanList(Array.isArray(data.planList) ? data.planList : []);
      const restoredPosterPlanList = Array.isArray(data.planList) ? data.planList : [];
      if (projectIdRef.current && restoredPosterPlanList.length > 0) {
        persistWorkspaceProjectPages({
          projectId: projectIdRef.current,
          outputType: "poster",
          pages: restoredPosterPlanList.map((item, idx) => ({
            index: Number.isFinite(item.index) ? item.index : idx + 1,
            pageRole: item.role || "content",
            title: item.title,
            body: [item.focus, ...(Array.isArray(item.keyFacts) ? item.keyFacts : [])]
              .filter((value) => typeof value === "string" && value.trim())
              .join("\n"),
            visual: item.visualType || item.layoutHint || "",
            imagePromptDraft: item.imagePromptDraft || item.imagePrompt || "",
          })),
        });
      } else if (projectIdRef.current && data.posterDraft) {
        persistWorkspaceProjectPages({
          projectId: projectIdRef.current,
          outputType: "poster",
          pages: [
            {
              index: 1,
              pageRole: "content",
              title: data.posterDraft.headline,
              subtitle: data.posterDraft.subtitle,
              body: [data.posterDraft.body, ...(Array.isArray(data.posterDraft.points) ? data.posterDraft.points : [])]
                .filter((value) => typeof value === "string" && value.trim())
                .join("\n"),
              visual: data.posterDraft.visualType || data.posterDraft.layoutSuggestion || "",
              imagePromptDraft: "",
            },
          ],
        });
      }
      const nextProjectTitle = deriveWorkspaceProjectTitle({
        outputLanguage,
        topic,
        intent: effectiveIntent,
        posterDraft: data.posterDraft ?? null,
        planList: Array.isArray(data.planList) ? data.planList : [],
      });
      setWorkspaceProjectTitle(nextProjectTitle);
      updateUserProjectMetadata({
        email: currentEmail,
        projectId: projectIdRef.current,
        title: nextProjectTitle,
        format: "海报",
      });
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
      setEditablePosterDraft(null);
      setEditablePosterPlanList([]);
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
        setIsDraftGenerationPending(false);
      }
    }
    return requestSucceeded;
  }, [
    baseOutlineItems,
    basePosterDraft,
    basePosterPlanList,
    baseSlideDrafts,
    currentEmail,
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
    setIsDraftGenerationPending,
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
    emitUiEvent({
      action: "ui.step5.confirm.click",
      status: "info",
      message: "User clicked confirm generation billing.",
      details: {
        requiredCredits: billingCost,
        estimatedCreditsCost: billingCost,
      },
    });
    if (
      (effectiveIntent === "ppt" || effectiveIntent === "video") &&
      standardOutputCount > 1 &&
      (!displaySlideDrafts.length || displaySlideDrafts.length !== standardOutputCount || displaySlideDrafts[0]?.isCover !== true)
    ) {
      setGenerationConfirmError(null);
      setBillingConfirmed(false);
      clearCurrentGenerationState("stale-draft-missing-cover");
      setFlowStage("content");
      await handleConfirmConfig();
      return;
    }
    let tasksToGenerate: ImageGenerationTask[] = [];
    try {
      tasksToGenerate = buildFreshImageGenerationTasks();
    } catch (error) {
      const message = error instanceof Error ? error.message : tr("Generation tasks are invalid.", "生成任务参数无效。");
      setGenerationConfirmError(message);
      return;
    }
    const expectedCount = standardOutputCount;
    const invalidTask = tasksToGenerate.find(
      (task) =>
        !task.composedPrompt?.trim() ||
        !task.aspectRatio?.trim() ||
        !task.size?.trim(),
    );
    logWorkspaceVerbose("[workspace-generation] handleConfirmBilling called", {
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
      logWorkspaceVerbose("[workspace-generation] handleConfirmBilling early return", {
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
    const availableCredits = getAvailableCredits();
    if (availableCredits < billingCost) {
      logWorkspaceVerbose("[workspace-generation] handleConfirmBilling early return", {
        reason: "insufficientCredits",
        credits: availableCredits,
        billingCost,
      });
      emitFlowAudit({
        stage: "7.confirm-generation",
        status: "early-return",
        decision: "abort",
        reason: "insufficientCredits",
        keyFields: { credits: availableCredits, billingCost },
      });
      setGenerationConfirmError(null);
      setCreditVersion((prev) => prev + 1);
      openCreditsPaywall({
        scene: "billing_insufficient",
        kind: effectiveIntent === "unknown" ? undefined : effectiveIntent,
      });
      return;
    }
    if (isPlanningBillingStep) {
      logWorkspaceVerbose("[workspace-generation] handleConfirmBilling early return", {
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
      logWorkspaceVerbose("[workspace-generation] handleConfirmBilling early return", {
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
      return;
    }
    if (!tasksToGenerate.length) {
      const message = tr("No generation tasks are ready.", "没有可生成的任务。");
      logWorkspaceVerbose("[workspace-generation] handleConfirmBilling early return", {
        reason: "emptyGenerationTasks",
      });
      emitFlowAudit({
        stage: "7.confirm-generation",
        status: "early-return",
        decision: "abort",
        reason: "emptyGenerationTasks",
      });
      setGenerationConfirmError(message);
      return;
    }
    if (tasksToGenerate.length !== expectedCount) {
      const message = tr("Task count does not match selected output quantity.", "任务数量与选择的输出数量不一致。");
      logWorkspaceVerbose("[workspace-generation] handleConfirmBilling early return", {
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
      return;
    }
    if (invalidTask) {
      const message = tr(
        `Task ${invalidTask.index} is missing prompt or size.`,
        `任务 ${invalidTask.index} 缺少提示词或尺寸配置。`,
      );
      logWorkspaceVerbose("[workspace-generation] handleConfirmBilling early return", {
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
      return;
    }
    generationRequestInFlightRef.current = true;
    setIsPlanningBillingStep(true);
    setGenerationConfirmError(null);
    setGenerationSessionSeed((prev) => prev + 1);
    const previousRecoverableRunId = normalizeGenerationRunId(currentGenerationRunIdRef.current);
    const previousRecoverableJobId = (currentGenerationJobIdRef.current || "").trim() || null;
    const previousRecoverableIdempotencyKey = (currentGenerationIdempotencyKeyRef.current || "").trim() || null;
    const nextRunId = createGenerationRunId();
    autoGenerationArmedRunIdsRef.current[nextRunId] = true;
    delete autoGenerationSuccessLockedRunIdsRef.current[nextRunId];
    delete autoGenerationFailureLockedRunIdsRef.current[nextRunId];
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
    const imageModel = initialEntry.models?.imageModel || "gpt-image-2";
    setGenerationConfirmStep("prepare job");
    startThinking(tr("Generation Startup", "生成启动"), tr("Preparing generation...", "正在准备生成..."));
    let preparedJobId: string | null = null;
    let creditsConsumed = false;
    let step6Entered = false;
    let currentConfirmStep = "init";
    let confirmIdempotencyKey = "";
    let selectedProjectIdForRecovery = projectIdRef.current || routeProjectId || initialEntry.project?.projectId || "";
    const activeConfirmTaskStatuses = new Set(["queued", "running", "generating", "asset_downloading"]);
    const successConfirmTaskStatuses = new Set(["asset_ready", "completed", "success", "succeeded"]);
    const failedConfirmTaskStatuses = new Set(["billing_failed", "failed", "timed_out", "completed_with_errors"]);
    const preparedConfirmTaskStatuses = new Set(["billing_pending"]);
    const summarizeTaskStatuses = (payload: ImageGenerateBatchResponse | null) =>
      (payload?.tasks ?? []).reduce<Record<string, number>>((acc, task) => {
        const status = (task.status || "unknown").trim().toLowerCase() || "unknown";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});
    const getPayloadStatusSignals = (payload: ImageGenerateBatchResponse | null) => {
      const jobStatus = (payload?.job?.status || "").trim().toLowerCase();
      const taskStatuses = (payload?.tasks ?? []).map((task) => (task.status || "").trim().toLowerCase());
      const hasActive = activeConfirmTaskStatuses.has(jobStatus) || taskStatuses.some((status) => activeConfirmTaskStatuses.has(status));
      const hasSuccess = successConfirmTaskStatuses.has(jobStatus) || taskStatuses.some((status) => successConfirmTaskStatuses.has(status));
      const hasFailed = failedConfirmTaskStatuses.has(jobStatus) || taskStatuses.some((status) => failedConfirmTaskStatuses.has(status));
      const hasPrepared = preparedConfirmTaskStatuses.has(jobStatus) || taskStatuses.some((status) => preparedConfirmTaskStatuses.has(status));
      return { jobStatus, taskStatuses, hasActive, hasSuccess, hasFailed, hasPrepared };
    };
    const setConfirmStep = (step: string, text: string) => {
      currentConfirmStep = step;
      currentConfirmStepRef.current = step;
      setGenerationConfirmStep(step);
      startThinking(tr("Generation Startup", "生成启动"), text);
      if (step === "prepare job") {
        emitUiEvent({ action: "ui.step5.prepare.start", status: "info", message: text });
      } else if (step === "consume credits") {
        emitUiEvent({ action: "ui.step5.consume.start", status: "info", message: text });
      } else if (step === "activate job") {
        emitUiEvent({ action: "ui.step5.activate.start", status: "info", message: text });
      } else if (step === "recovering previous request") {
        emitUiEvent({ action: "ui.step5.recovery.start", status: "info", message: text });
      } else if (step === "checking generation status") {
        emitUiEvent({ action: "ui.step5.recovery.success", status: "info", message: text });
      }
    };
    const createConfirmTimeoutMessage = (step: string, timeoutMs: number) =>
      `Generation ${step} timed out after ${Math.round(timeoutMs / 1000)}s. Please retry.`;
    const isConfirmStepTimeout = (message: string) =>
      /^Generation .+ timed out after \d+s\. Please retry\.$/i.test(message.trim());
    const withConfirmStepTimeout = async <T,>(
      step: string,
      timeoutMs: number,
      run: (signal: AbortSignal) => Promise<T>,
    ) => {
      currentConfirmStep = step;
      currentConfirmStepRef.current = step;
      setGenerationConfirmStep(step);
      const stepStartedAt = Date.now();
      logClientEvent({
        category: "image",
        action: "image_generation_confirm_step_started",
        status: "info",
        source: imageModel,
        message: `${step} started.`,
        projectId: projectIdRef.current ?? null,
        details: {
          step,
          startedAt: new Date(stepStartedAt).toISOString(),
          runId: nextRunId,
          jobId: preparedJobId,
          projectId: projectIdRef.current ?? null,
        },
      });
      const controller = new AbortController();
      let timeoutId: number | null = null;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          controller.abort();
          reject(new Error(createConfirmTimeoutMessage(step, timeoutMs)));
        }, timeoutMs);
      });
      try {
        const result = await Promise.race([run(controller.signal), timeoutPromise]);
        logClientEvent({
          category: "image",
          action: "image_generation_confirm_step_completed",
          status: "ok",
          source: imageModel,
          message: `${step} completed.`,
          projectId: projectIdRef.current ?? null,
          details: {
            step,
            startedAt: new Date(stepStartedAt).toISOString(),
            completedAt: new Date().toISOString(),
            durationMs: Date.now() - stepStartedAt,
            runId: nextRunId,
            jobId: preparedJobId,
            projectId: projectIdRef.current ?? null,
          },
        });
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "unknown";
        logClientEvent({
          category: "image",
          action: "image_generation_confirm_step_failed",
          status: "error",
          source: imageModel,
          message: errorMessage,
          projectId: projectIdRef.current ?? null,
          details: {
            step,
            startedAt: new Date(stepStartedAt).toISOString(),
            completedAt: new Date().toISOString(),
            durationMs: Date.now() - stepStartedAt,
            runId: nextRunId,
            jobId: preparedJobId,
            projectId: projectIdRef.current ?? null,
            errorMessage,
            errorStack: error instanceof Error ? error.stack : null,
          },
        });
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new Error(createConfirmTimeoutMessage(step, timeoutMs));
        }
        throw error;
      } finally {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
      }
    };
    const postGenerationBatchAction = async (
      body: Record<string, unknown>,
      options?: { step?: string; timeoutMs?: number },
    ) => {
      const step = options?.step || "image_job_update";
      const timeoutMs = options?.timeoutMs ?? GENERATION_CONFIRM_PREPARE_TIMEOUT_MS;
      return withConfirmStepTimeout(step, timeoutMs, async (signal) => {
        const response = await fetch("/api/workspace/image/generate-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          signal,
          body: JSON.stringify(body),
        });
        const payload = (await response.json().catch(() => null)) as ImageGenerateBatchResponse | null;
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || payload?.code || `generation batch action failed (${response.status})`);
        }
        return payload;
      });
    };
    const markPreparedJobBillingFailed = async (reason: string) => {
      if (!preparedJobId) return;
      await postGenerationBatchAction({
        action: "mark_billing_failed",
        jobId: preparedJobId,
        runId: nextRunId,
        error: reason,
      }, { step: "mark_billing_failed", timeoutMs: GENERATION_CONFIRM_ACTIVATE_TIMEOUT_MS }).catch(() => undefined);
    };
    const markPreparedJobFailedAfterCharge = async (reason: string) => {
      if (!preparedJobId) return;
      await postGenerationBatchAction({
        action: "mark_failed",
        jobId: preparedJobId,
        runId: nextRunId,
        error: reason,
      }, { step: "mark_failed_after_charge", timeoutMs: GENERATION_CONFIRM_ACTIVATE_TIMEOUT_MS });
    };
    const markLocalTasksFailed = (message: string, code = "IMAGE_CONFIRM_FAILED") => {
      setGenerationTaskStateByIndex((prev) => {
        const now = Date.now();
        const failedState = Object.fromEntries(tasksToGenerate.map((task) => {
          const previous = prev[task.index];
          return [task.index, {
            index: task.index,
            status: "failed",
            attempts: previous?.attempts || 1,
            maxAttempts: 1,
            runId: nextRunId,
            jobId: preparedJobId || previous?.jobId,
            source: "current-run",
            error: message,
            errorCode: code,
            startedAt: previous?.startedAt ?? now,
            lastUpdatedAt: now,
          } satisfies GenerationTaskUiState] as const;
        })) as Record<number, GenerationTaskUiState>;
        return { ...prev, ...failedState };
      });
    };
    const recoverConfirmJob = async (reason: string, options?: { restoreFailed?: boolean }) => {
      const recoveryStartedAt = Date.now();
      const recoveryJobId = preparedJobId || previousRecoverableJobId || undefined;
      const recoveryRunId = recoveryJobId ? (preparedJobId ? nextRunId : previousRecoverableRunId) : previousRecoverableRunId;
      const recoveryIdempotencyKey =
        (confirmIdempotencyKey || previousRecoverableIdempotencyKey || "").trim() || undefined;
      setConfirmStep(
        "recover previous request",
        tr("Recovering previous request...", "正在恢复上一次请求..."),
      );
      const recoveredPayload = await postGenerationBatchAction({
        action: "recover",
        jobId: recoveryJobId,
        runId: recoveryRunId || undefined,
        idempotencyKey: recoveryIdempotencyKey,
        projectId: selectedProjectIdForRecovery || projectIdRef.current || undefined,
        intent: effectiveIntent === "unknown" ? undefined : effectiveIntent,
      }, { step: "recover previous request", timeoutMs: GENERATION_CONFIRM_PREPARE_TIMEOUT_MS });
      const signals = getPayloadStatusSignals(recoveredPayload);
      const recoveredJobId = (recoveredPayload.job?.id || "").trim();
      const recoveredRunId = normalizeGenerationRunId(recoveredPayload.job?.runId) || nextRunId;
      const recoveredTaskIds = (recoveredPayload.tasks ?? []).map((task) => task.taskId).filter(Boolean);
      logClientEvent({
        category: "image",
        action: "image_generation_confirm_recovery_completed",
        status: recoveredPayload.recovered === false ? "error" : "ok",
        source: imageModel,
        message: reason,
        projectId: projectIdRef.current || selectedProjectIdForRecovery || null,
        details: {
          reason,
          startedAt: new Date(recoveryStartedAt).toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - recoveryStartedAt,
          runId: nextRunId,
          recoveredRunId,
          jobId: recoveredJobId || null,
          projectId: selectedProjectIdForRecovery || projectIdRef.current || null,
          taskIds: recoveredTaskIds,
          jobStatus: signals.jobStatus || null,
          taskStatusSummary: summarizeTaskStatuses(recoveredPayload),
          recovered: recoveredPayload.recovered !== false,
          errorCode: recoveredPayload.code || null,
          errorMessage: recoveredPayload.error || null,
        },
      });
      if (recoveredPayload.recovered === false || !recoveredJobId || !recoveredPayload.tasks?.length) {
        return false;
      }
      preparedJobId = recoveredJobId;
      currentGenerationIdempotencyKeyRef.current =
        (recoveredPayload.job?.idempotencyKey || recoveryIdempotencyKey || "").trim() || null;
      if (signals.hasPrepared && !signals.hasActive && !signals.hasSuccess && !signals.hasFailed) {
        setGenerationRunContext(recoveredRunId, recoveredJobId);
        setBillingConfirmed(false);
        setFlowStage("billing");
        setGenerationTaskStateByIndex({});
        setGenerationConfirmError(
          tr(
            "Generation confirmation is still being recovered. Please refresh this project in a moment before confirming again.",
            "生成确认仍在恢复中。请稍后刷新项目后再确认。",
          ),
        );
        return true;
      }
      if (signals.hasActive || signals.hasSuccess || (options?.restoreFailed && signals.hasFailed)) {
        setGenerationRunContext(recoveredRunId, recoveredJobId);
        setBillingConfirmed(signals.jobStatus !== "billing_failed");
        setFlowStage("generate");
        step6Entered = true;
        setConfirmStep(
          "checking generation status",
          tr("Checking generation status...", "正在检查生成状态..."),
        );
        await runGenerationBatch(tasksToGenerate, false, recoveredRunId, recoveredPayload);
        return true;
      }
      return false;
    };
    try {
      const user = currentEmail ? getAdminUserByEmail(currentEmail) : null;
      const selectedProjectId =
        routeProjectId ||
        projectIdRef.current ||
        initialEntry.project?.projectId ||
        `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const selectedProject = {
        id: selectedProjectId,
        userId: user?.id || initialEntry.project?.projectUserId || "u-unknown",
        title:
          initialEntry.project?.projectTitle ||
          workspaceProjectTitle ||
          `${topic || "Knowledge Topic"} · ${tr("Workspace Draft", "工作区草稿")}`,
        status: "进行中" as const,
        updatedAt: new Date().toISOString(),
        format: effectiveIntent === "poster" ? "海报" : effectiveIntent === "video" ? "视频" : "PPT",
      };
      projectIdRef.current = selectedProject?.id ?? projectIdRef.current;
      selectedProjectIdForRecovery = selectedProject?.id || selectedProjectIdForRecovery;
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

      const idempotencyKey = buildStableGenerationIdempotencyKey({
        userEmail: currentEmail || "guest",
        projectId: projectIdRef.current,
        projectTraceId: projectTraceIdRef.current,
        runId: nextRunId,
        tasks: tasksToGenerate,
      });
      confirmIdempotencyKey = idempotencyKey;
      currentGenerationIdempotencyKeyRef.current = idempotencyKey;
      const recoveredBeforeConfirm = await recoverConfirmJob("pre-confirm recovery check", { restoreFailed: false });
      if (recoveredBeforeConfirm) {
        return;
      }
      setConfirmStep("prepare job", tr("Preparing generation...", "正在准备生成..."));
      const preparePayload = await postGenerationBatchAction({
        ...buildGenerationRequestPayload(tasksToGenerate),
        action: "prepare",
        idempotencyKey,
        runId: nextRunId,
        imageModelPolicy: "tuzi",
      }, { step: "prepare job", timeoutMs: GENERATION_CONFIRM_PREPARE_TIMEOUT_MS });
      preparedJobId = (preparePayload.job?.id || "").trim() || null;
      if (!preparedJobId || !preparePayload.tasks?.length) {
        throw new Error("Generation job preparation failed. Please retry.");
      }
      emitUiEvent({
        action: "ui.step5.prepare.success",
        status: "ok",
        message: "Generation job prepared successfully.",
        details: {
          runId: nextRunId,
          jobId: preparedJobId,
          taskCount: preparePayload.tasks.length,
        },
      });
      setGenerationRunContext(nextRunId, preparedJobId);

      try {
        setConfirmStep("consume credits", tr("Confirming credits...", "正在确认积分..."));
        await withConfirmStepTimeout("consume credits", GENERATION_CONFIRM_CREDITS_TIMEOUT_MS, async () =>
          appendCreditRecordOnServer({
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
            runId: nextRunId,
            jobId: preparedJobId ?? undefined,
            entrySource: resolveEntrySource().entrySource,
            estimatedCreditsCost: billingCost,
            creditsBefore: availableCredits,
            creditsAfter: Math.max(0, availableCredits - billingCost),
            creditBalanceSource: currentEmail ? "server_synced_local_cache" : "guest_default",
          }, currentEmail),
        );
        creditsConsumed = true;
        emitUiEvent({
          action: "ui.step5.consume.success",
          status: "ok",
          message: "Credits confirmed successfully.",
          details: {
            runId: nextRunId,
            jobId: preparedJobId,
            requiredCredits: billingCost,
            estimatedCreditsCost: billingCost,
            creditsBefore: availableCredits,
            creditsAfter: Math.max(0, availableCredits - billingCost),
            creditsConsumed: true,
          },
        });
      } catch (creditError) {
        const message = creditError instanceof Error ? creditError.message : "";
        if (message.includes("INSUFFICIENT_CREDITS")) {
          openCreditsPaywall({
            scene: "billing_insufficient",
            kind: effectiveIntent === "unknown" ? undefined : effectiveIntent,
          });
          throw new Error("Not enough credits to start this generation.");
        }
        throw creditError;
      }
      tasksToGenerate.forEach((task) => {
        const creditKey = buildImageTaskCreditKey(nextRunId, task.index);
        chargedImageTaskCreditsRef.current[creditKey] = SINGLE_IMAGE_REGENERATION_CREDITS;
        delete refundedImageTaskCreditsRef.current[creditKey];
      });
      setConfirmStep("activate job", tr("Starting generation tasks...", "正在启动生成任务..."));
      const activatedPayload = await postGenerationBatchAction({
        action: "activate",
        jobId: preparedJobId,
        runId: nextRunId,
      }, { step: "activate job", timeoutMs: GENERATION_CONFIRM_ACTIVATE_TIMEOUT_MS });
      const activationSignals = getPayloadStatusSignals(activatedPayload);
      if (!activatedPayload.job?.id || !activatedPayload.tasks?.length) {
        throw new Error("Generation job activation failed. Please retry.");
      }
      emitUiEvent({
        action: "ui.step5.activate.success",
        status: "ok",
        message: "Generation tasks activated successfully.",
        details: {
          runId: nextRunId,
          jobId: preparedJobId,
          taskCount: activatedPayload.tasks.length,
        },
      });
      if (activationSignals.hasFailed) {
        setGenerationRunContext(nextRunId, preparedJobId);
        setFlowStage("generate");
        setBillingConfirmed(activationSignals.jobStatus !== "billing_failed");
        step6Entered = true;
        await runGenerationBatch(tasksToGenerate, false, nextRunId, activatedPayload);
        return;
      }
      if (!activationSignals.hasActive && !activationSignals.hasSuccess) {
        setGenerationConfirmError(
          activationSignals.hasPrepared
            ? tr(
                "Generation is still waiting for confirmation. Please refresh this project in a moment before confirming again.",
                "生成仍在等待确认。请稍后刷新项目后再确认。",
              )
            : tr(
                "Generation status is unclear. Please refresh this project in a moment before confirming again.",
                "生成状态暂时无法确认。请稍后刷新项目后再确认。",
              ),
        );
        setFlowStage("billing");
        setGenerationTaskStateByIndex({});
        return;
      }
      logClientEvent({
        category: "billing",
        action: "billing_confirmed",
        status: "ok",
        source: effectiveIntent,
        message: `${selectedProject?.title ?? "project"} confirmed and consumed ${billingCost} credits.`,
        projectId: selectedProject?.id ?? null,
        details: {
          creditsBefore: availableCredits,
          creditsAfter: Math.max(0, availableCredits - billingCost),
          billingCost,
          effectiveIntent,
        },
      });

      setCreditVersion((prev) => prev + 1);
      const generationStartedAt = Date.now();
      const pendingState = Object.fromEntries(tasksToGenerate.map((task) => [
        task.index,
        {
          index: task.index,
          status: "queued",
          attempts: 0,
          maxAttempts: 1,
          runId: nextRunId,
          jobId: preparedJobId || undefined,
          source: "current-run",
          startedAt: generationStartedAt,
          lastUpdatedAt: generationStartedAt,
        } satisfies GenerationTaskUiState,
      ] as const)) as Record<number, GenerationTaskUiState>;
      setGenerationTaskStateByIndex(pendingState);
      setFlowStage("generate");
      setBillingConfirmed(true);
      step6Entered = true;
      emitUiEvent({
        action: "ui.step6.enter",
        status: "info",
        message: "Entered generation canvas after billing confirmation.",
        details: {
          runId: nextRunId,
          jobId: preparedJobId,
          creditsConsumed: true,
        },
      });
      requestAnimationFrame(() => {
        storyboardPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });

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
      await runGenerationBatch(tasksToGenerate, false, nextRunId, activatedPayload);
    } catch (error) {
      const message = error instanceof Error ? error.message : tr("Generation failed.", "生成失败。");
      const errorStack = error instanceof Error ? error.stack : null;
      const confirmStepTimedOut = isConfirmStepTimeout(message);
      if (confirmStepTimedOut) {
        if (currentConfirmStep === "consume credits") {
          emitUiEvent({
            action: "ui.step5.consume.unknown",
            status: "error",
            code: "CREDITS_CONSUME_UNKNOWN",
            message,
            details: {
              runId: nextRunId,
              jobId: preparedJobId,
              creditsConsumed,
            },
          });
        }
        const recovered = await recoverConfirmJob(message, { restoreFailed: true }).catch(() => false);
        if (!recovered) {
          const timeoutRecoveryMessage =
            currentConfirmStep === "prepare job"
              ? tr(
                  "Preparing generation timed out. No active generation was found, so you can retry.",
                  "准备生成超时，未找到进行中的生成任务，可以重试。",
                )
              : currentConfirmStep === "consume credits"
                ? tr(
                    "Credit confirmation is taking longer than expected. Credit status is unknown, so please refresh this project before confirming again.",
                    "积分确认耗时较长，当前积分状态未知。请刷新项目后再确认，避免重复扣费。",
                  )
                : tr(
                    "Starting generation tasks is taking longer than expected. Please refresh this project in a moment to recover the latest status.",
                    "启动生成任务耗时较长。请稍后刷新项目以恢复最新状态。",
                  );
          setBillingConfirmed(false);
          setFlowStage("billing");
          setGenerationTaskStateByIndex({});
          setGenerationConfirmError(timeoutRecoveryMessage);
        }
        logClientEvent({
          category: "image",
          action: "image_generation_batch_timeout_recovered",
          status: recovered ? "ok" : "error",
          source: imageModel,
          message,
          projectId: projectIdRef.current ?? null,
          details: {
            currentConfirmStep,
            runId: nextRunId,
            jobId: preparedJobId,
            creditsConsumed,
            step6Entered,
            recovered,
            billingCost,
            taskCount: tasksToGenerate.length,
            taskIndexes: tasksToGenerate.map((task) => task.index),
            errorStack,
          },
        });
        return;
      }
      if (preparedJobId && !step6Entered && creditsConsumed) {
        await markPreparedJobFailedAfterCharge(message).catch(() => undefined);
        tasksToGenerate.forEach((task) => {
          refundImageTaskCredits({
            runId: nextRunId,
            taskIndex: task.index,
            reason: "IMAGE_ACTIVATION_FAILED",
            mode: "server",
          });
        });
      } else if (preparedJobId && !step6Entered) {
        await markPreparedJobBillingFailed(message);
      }
      setBillingConfirmed(false);
      setGenerationConfirmError(message);
      if (step6Entered) {
        markLocalTasksFailed(message);
      } else {
        setFlowStage("billing");
        setGenerationTaskStateByIndex({});
      }
      logClientEvent({
        category: "image",
        action: "image_generation_batch_failed",
        status: "error",
        source: imageModel,
        message,
        projectId: projectIdRef.current ?? null,
        details: {
          currentConfirmStep,
          runId: nextRunId,
          jobId: preparedJobId,
          creditsConsumed,
          step6Entered,
          billingCost,
          taskCount: tasksToGenerate.length,
          taskIndexes: tasksToGenerate.map((task) => task.index),
          errorStack,
        },
      });
    } finally {
      delete autoGenerationArmedRunIdsRef.current[nextRunId];
      emitFlowAudit({
        stage: "7.confirm-generation",
        status: "finished",
        decision: "request-finished",
        reason: "handleConfirmBilling-finally",
      });
      stopThinking();
      setIsPlanningBillingStep(false);
      setGenerationConfirmStep("");
      currentConfirmStepRef.current = "";
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
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
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
    const wantsContinuePublicOverview = containsAny(normalized, [
      "继续公开资料概览",
      "继续概览",
      "先按公开资料",
      "继续生成概览",
      "continue public overview",
      "continue with public overview",
      "general overview",
    ]);
    const wantsFreshSourcePath = containsAny(normalized, [
      "补充来源",
      "上传来源",
      "补充最新资料",
      "添加资料",
      "add source",
      "upload source",
      "add latest source",
      "fresh source",
    ]);
    const isFreshSourceGateActive = needsFreshSourcesClarify && !wantsContinuePublicOverview;
    const manualInputShouldRestartEarlyFlow =
      inputSource === "manual" &&
      (flowStage === "intent" || flowStage === "config" || flowStage === "content") &&
      !backNavigationCommand &&
      !downloadCommand &&
      !isEditCommand &&
      !wantsContinuePublicOverview &&
      !wantsFreshSourcePath &&
      !(isConfigCommand && !hasDirectionHint && !likelyTopicText);

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

    if (needsFreshSourcesClarify && wantsContinuePublicOverview) {
      setIntentAnalysis((prev) =>
        prev
          ? {
              ...prev,
              clarifyMode: "none",
              needsFreshSources: false,
              classification: "ready",
              assistantHint: tr(
                "Proceeding with a public-information overview first. Fresh sources can be added later for recency validation.",
                "已按公开资料概览继续。后续可补充最新来源做时效校验。",
              ),
            }
          : prev,
      );
      pushAssistantMessage(
        tr(
          "Understood. I will continue with a public-information overview first.",
          "收到，我先按公开资料概览继续生成。",
        ),
        tr("Requirement Check", "需求确认"),
      );
    } else if (isFreshSourceGateActive && wantsFreshSourcePath) {
      pushAssistantMessage(
        tr(
          "Great. Please add a latest source in Home upload first, then return to continue.",
          "好的。请先在 Home 补充最新来源，再回来继续。",
        ),
        tr("Requirement Check", "需求确认"),
      );
      stopThinking();
      setIsSending(false);
      return;
    }

    if (manualInputShouldRestartEarlyFlow) {
      setTopicContextPrompt(value);
      setManualIntent(null);
      setSelectedTopicSuggestion(null);
      setTopicSuggestionLocked(false);
      setLockedTopicSuggestion(null);
      setTopicSuggestionLockReason(null);
      setConfigConfirmed(false);
      setBillingConfirmed(false);
      setConfirmedConfigSnapshot(null);
      setEditableOutlineItems([]);
      setEditableSlideDrafts([]);
      setEditablePosterDraft(null);
      setEditablePosterPlanList([]);
      setIsDraftGenerationPending(false);
      clearCurrentGenerationState("manual-new-input-before-draft");
      setFlowStage("intent");
      await requestIntentAnalysis(value, entrySources, {
        force: true,
        clearPrevious: true,
      });
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
      void requestIntentAnalysis(value, entrySources, {
        force: true,
        clearPrevious: true,
      });
    }

    if (!shouldPrioritizeDraftEdit && waitingTopicSuggestionConfirm && topicSuggestions.length > 0 && !hasDirectionHint) {
      if (inputSource === "suggestion") {
        stopThinking();
        setIsSending(false);
        return;
      }
      pushAssistantMessage(
        tr(
          "Please pick one topic card first. After that, we will continue to output direction and configuration.",
          "请先从 4 个建议里选 1 个。选完后再进入方向与配置。",
        ),
        tr("Requirement Check", "需求确认"),
      );
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
      if (isFreshSourceGateActive) {
        pushAssistantMessage(
          tr(
            "This request depends on recent sources. Add a fresh source, or reply: continue with public overview.",
            "这个需求依赖最新资料。请补充最新来源，或回复：继续公开资料概览。",
          ),
          tr("Requirement Check", "需求确认"),
        );
        stopThinking();
        setIsSending(false);
        return;
      }
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
        actionsDisabled={!showStoryboard || (lockedCanvasMode === "ppt" && !isPptExportReady)}
        disabledPrimaryActionLabel={
          lockedCanvasMode === "ppt" && !isPptExportReady
            ? generationProgressLabel
              ? `Generating ${generationProgressLabel}`
              : "Generating"
            : undefined
        }
        isExportingPpt={isExportingPpt}
        isComposingVideo={isComposingVideo}
        showOpenCanvasButton={isMobileViewport && hasCanvasPanel && mobileWorkspaceView === "chat"}
        onOpenCanvas={() => setMobileWorkspaceView("canvas")}
      />

      {workspaceToast ? (
        <div className="pointer-events-none fixed left-1/2 top-20 z-50 w-[min(92vw,520px)] -translate-x-1/2">
          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 shadow-lg shadow-zinc-900/10">
            {workspaceToast.message}
          </div>
        </div>
      ) : null}

      <main className="mx-auto flex h-full min-h-0 max-w-none flex-col overflow-hidden px-2 pb-1 pt-16 sm:px-3">
        <div
          className={`grid min-h-0 flex-1 gap-2 ${
            showCanvasPanelInLayout
              ? "lg:grid-cols-[480px_minmax(0,1fr)]"
              : "lg:grid-cols-[minmax(0,960px)] lg:justify-center"
          }`}
        >
          <section
            className={`min-h-0 w-full min-w-0 ${
              showCanvasPanelInLayout ? "max-w-[480px]" : "mx-auto max-w-[960px]"
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
                  showWeakPromptSuggestions={
                    showDirectionGuide && !topicSuggestionLocked && (topicSuggestionsLoading || waitingTopicSuggestionConfirm)
                  }
                  topicSuggestionsLoading={topicSuggestionsLoading}
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
                  slideDrafts={effectiveIntent === "ppt" || effectiveIntent === "video" ? displaySlideDrafts : densityAdjustedSlideDrafts}
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
                  isFreeUser={isFreeUser}
                  generationConfirmError={null}
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
                  isDraftGenerationPending={isDraftGenerationPending}
                  retryingErrorTurnIds={retryingErrorTurnIds}
                  onRetryErrorTurn={handleRetryErrorTurn}
                  outputSummaryCard={{
                    visible: billingConfirmed && flowStage === "generate",
                    formatLabel: outputSummaryFormatLabel,
                    title: outputSummaryTitle,
                    angle: outputSummaryAngle,
                    statusLabel: outputSummaryStatusLabel,
                    progressLabel: generationProgressLabel,
                    isCanvasExpanded: showCanvasPanelInLayout,
                    canToggleCanvas: hasCanvasPanel,
                    canDownload: outputSummaryCanDownload,
                    downloadLabel:
                      effectiveIntent === "ppt"
                        ? "Download PPT"
                        : effectiveIntent === "video"
                          ? "Download Video"
                          : "Download Poster",
                    downloadDisabledLabel: generationProgressLabel
                      ? `Generating ${generationProgressLabel}`
                      : "Generating",
                    onToggleCanvas: handleToggleOutputCanvas,
                    onDownload: handleOutputSummaryDownload,
                  }}
                />
              </div>

              {showChatComposer ? (
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
              ) : null}
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
                onPptExportReadyChange={setIsPptExportReady}
                onComposingVideoChange={setIsComposingVideo}
                generationSeedSlides={canvasSeedSlides}
                generationClearToken={`generation-${generationSessionSeed}`}
                generationTaskStateByIndex={generationTaskStateByIndex}
                generationInProgress={generationInProgress}
                onRetryGenerationTask={handleRetryGenerationTask}
                hasMembership={!isFreeUser}
                onRequestTtsUpgrade={() => {
                  openCreditsPaywall({ scene: "tts_premium" });
                }}
                imageAspectRatio={normalizedGenerationConfig.normalizedRatio}
                onModeActionRegister={(actions) => {
                  modeActionsRef.current = {
                    ...modeActionsRef.current,
                    ...actions,
                  };
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
                generationInProgress={generationInProgress}
                onRetryGenerationTask={handleRetryGenerationTask}
                onRedrawGenerationTask={handleRedrawGenerationTask}
                onSaveStateChange={(nextState, unsaved) => {
                  setSaveState(nextState);
                  setHasUnsavedChanges(unsaved);
                }}
                onModeActionRegister={(actions) => {
                  modeActionsRef.current = {
                    ...modeActionsRef.current,
                    downloadPoster: actions.downloadAll,
                  };
                }}
              />
            </section>
          ) : null}
        </div>
      </main>

      <PaywallDialog
        open={creditsPaywallOpen}
        title={paywallCopy.title}
        description={paywallCopy.description}
        compact
        source={paywallCopy.source}
        onClose={() => {
          setCreditsPaywallOpen(false);
          setCreditsPaywallContext(null);
        }}
        onConfirm={() => {
          setCreditsPaywallOpen(false);
          setCreditsPaywallContext(null);
          openMembershipFromWorkspace();
        }}
        confirmLabel={paywallCopy.confirmLabel}
      />

    </div>
  );
}
