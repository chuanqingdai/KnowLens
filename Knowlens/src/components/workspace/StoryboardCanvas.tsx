"use client";

import "@xyflow/react/dist/style.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Crown,
  Download,
  LoaderCircle,
  LocateFixed,
  PauseCircle,
  PlayCircle,
  Plus,
  Redo2,
  RotateCcw,
  Volume2,
  X,
} from "lucide-react";

import {
  Controls,
  MiniMap,
  PanOnScrollMode,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react";

type SaveState = "saved" | "saving" | "error";

type StoryboardCanvasProps = {
  onSaveStateChange?: (saveState: SaveState, hasUnsavedChanges: boolean) => void;
  canvasModeExternal?: CanvasMode;
  onExportingPptChange?: (value: boolean) => void;
  onPptExportReadyChange?: (value: boolean) => void;
  onComposingVideoChange?: (value: boolean) => void;
  generationSeedSlides?: CanvasSeedSlide[];
  generationClearToken?: string;
  generationTaskStateByIndex?: Record<
    number,
    {
      status: "queued" | "generating" | "retrying" | "success" | "failed";
      attempts: number;
      maxAttempts: number;
      imageUrl?: string;
      error?: string;
      errorCode?: string;
    }
  >;
  generationInProgress?: boolean;
  onRetryGenerationTask?: (index: number) => void;
  hasMembership?: boolean;
  onRequestTtsUpgrade?: () => void;
  imageAspectRatio?: string;
  onModeActionRegister?: (actions: {
    exportPpt: () => void;
    downloadVideo: () => void;
  }) => void;
};

type CanvasMode = "free" | "ppt";

type SlideItem = {
  id: string;
  page: number;
  title: string;
  body: string;
  visual: string;
  isCover?: boolean;
  coverTitle?: string;
  coverSubtitle?: string;
  coverTitleX?: number;
  coverTitleY?: number;
  coverTitleSize?: number;
  coverSubtitleX?: number;
  coverSubtitleY?: number;
  coverSubtitleSize?: number;
};

type PersistedCanvasState = {
  version: 1;
  slides: SlideItem[];
  ttsBySlideId: Record<string, string>;
  promptBySlideId: Record<string, string>;
  imageHistoryBySlideId: Record<string, string[]>;
  activeImageIndexBySlideId: Record<string, number>;
  historyOpenBySlideId: Record<string, boolean>;
};

type HistoryState = {
  past: PersistedCanvasState[];
  present: PersistedCanvasState;
  future: PersistedCanvasState[];
};

type CanvasSeedSlide = {
  id: string;
  page: number;
  title: string;
  body: string;
  visual: string;
  imagePrompt?: string;
  imagePromptDraft?: string;
  isCover?: boolean;
};

type ValidationIssue = {
  body?: string;
  visual?: string;
  prompt?: string;
};

type ComposeStatus = "idle" | "running" | "success" | "error";
type ComposeStepKey = "prepare" | "tts" | "render" | "finalize";
type ComposeStepStatus = "waiting" | "running" | "done" | "error";

type ComposeMeta = {
  fps: number;
  resolution: string;
  sceneCount: number;
  voicedSceneCount: number;
  durationSec: number;
  format: string;
  estimatedSizeMB: number;
};

type SceneAudioAsset = {
  slideId: string;
  durationSec: number;
  buffer: AudioBuffer | null;
};

type GeneratedAudioMeta = {
  url: string;
  durationSec: number;
  status: "ready" | "generating" | "error";
  error?: string;
};

type ExportPhase = "prepare" | "images" | "slides" | "file" | "done";
type PptExportStatus = "idle" | "running" | "success" | "error";

const STORAGE_KEY = "knowlens.workspace.storyboard.v1";
const STORAGE_CLEAR_TOKEN_KEY = "knowlens.workspace.storyboard.clear-token.v1";
const HISTORY_LIMIT = 60;
const PPT_DOWNLOAD_FILENAME = "KnowLens.ai-visual-deck.pptx";

const LENS_MODES = [
  "Wide establishing shot",
  "Cutaway close-up",
  "Process arrow tracking",
  "Side-by-side comparison",
];
const TRANSITIONS = ["Dissolve", "Push in", "Pan", "Fade"];
const CASE_IMAGES = Array.from({ length: 36 }, (_, idx) => `/case/${idx + 1}.png`);

function isUsableImageSrc(src?: string | null) {
  const value = (src || "").trim();
  return Boolean(value) && value !== "undefined" && value !== "null";
}

function getActiveImageSrc(history: string[] | undefined, activeIndex: number, fallback?: string) {
  const safeHistory = (history ?? []).filter(isUsableImageSrc);
  return safeHistory[activeIndex] ?? safeHistory[0] ?? (isUsableImageSrc(fallback) ? fallback : "");
}

type TtsTier = "basic" | "pro";
type TtsProvider = "edge" | "openai";
type TtsAgeGroup = "young_adult" | "adult" | "middle_aged" | "mature";

type TtsVoiceConfig = {
  id: string;
  displayName: string;
  tier: TtsTier;
  provider: TtsProvider;
  model?: string;
  voiceName: string;
  languageCode?: string;
  gender: "male" | "female" | "neutral";
  ageGroup: TtsAgeGroup;
  description: string;
  notes: string;
  creditPer1000Chars: number;
  profile: "male" | "female" | "neutral" | "youth";
};

const TTS_OPTIONS: TtsVoiceConfig[] = [
  {
    id: "basic_narrator_male",
    displayName: "Guy",
    tier: "basic",
    provider: "edge",
    voiceName: "en-US-GuyNeural",
    languageCode: "en-US",
    gender: "male",
    ageGroup: "adult",
    description: "Steady male tone for general science explainers.",
    notes: "Included male voice",
    creditPer1000Chars: 1,
    profile: "male",
  },
  {
    id: "basic_narrator_female",
    displayName: "Jenny",
    tier: "basic",
    provider: "edge",
    voiceName: "en-US-JennyNeural",
    languageCode: "en-US",
    gender: "female",
    ageGroup: "adult",
    description: "Warm female tone for friendly classroom explainers.",
    notes: "Included female voice",
    creditPer1000Chars: 1,
    profile: "female",
  },
  {
    id: "pro_documentary_male",
    displayName: "Cedar",
    tier: "pro",
    provider: "openai",
    voiceName: "cedar",
    gender: "male",
    ageGroup: "middle_aged",
    description: "Deep documentary tone for science, finance, and history.",
    notes: "Premium documentary voice",
    creditPer1000Chars: 3,
    profile: "male",
  },
  {
    id: "pro_documentary_female",
    displayName: "Marin",
    tier: "pro",
    provider: "openai",
    voiceName: "marin",
    gender: "female",
    ageGroup: "adult",
    description: "Smooth presenter tone for polished educational explainers.",
    notes: "Premium warm narrator",
    creditPer1000Chars: 3,
    profile: "female",
  },
  {
    id: "pro_deep_science",
    displayName: "Onyx",
    tier: "pro",
    provider: "openai",
    voiceName: "onyx",
    gender: "male",
    ageGroup: "mature",
    description: "Low, serious tone for research, science, and history topics.",
    notes: "Premium deep narrator",
    creditPer1000Chars: 3,
    profile: "male",
  },
  {
    id: "pro_bright_explainer",
    displayName: "Nova",
    tier: "pro",
    provider: "openai",
    voiceName: "nova",
    gender: "female",
    ageGroup: "young_adult",
    description: "Bright, energetic tone for fast-paced short explainers.",
    notes: "Premium bright explainer",
    creditPer1000Chars: 3,
    profile: "youth",
  },
  {
    id: "pro_neutral_tech",
    displayName: "Echo",
    tier: "pro",
    provider: "openai",
    voiceName: "echo",
    gender: "neutral",
    ageGroup: "adult",
    description: "Neutral tech tone for AI, product, and software topics.",
    notes: "Premium tech voice",
    creditPer1000Chars: 3,
    profile: "neutral",
  },
  {
    id: "pro_warm_host",
    displayName: "Coral",
    tier: "pro",
    provider: "openai",
    voiceName: "coral",
    gender: "female",
    ageGroup: "young_adult",
    description: "Friendly host tone for lifestyle and social explainers.",
    notes: "Premium friendly host",
    creditPer1000Chars: 3,
    profile: "youth",
  },
  {
    id: "pro_calm_teacher",
    displayName: "Sage",
    tier: "pro",
    provider: "openai",
    voiceName: "sage",
    gender: "neutral",
    ageGroup: "middle_aged",
    description: "Calm teaching tone for lessons, tutorials, and training.",
    notes: "Premium calm teacher",
    creditPer1000Chars: 3,
    profile: "neutral",
  },
  {
    id: "pro_classic_storyteller",
    displayName: "Fable",
    tier: "pro",
    provider: "openai",
    voiceName: "fable",
    gender: "neutral",
    ageGroup: "mature",
    description: "Narrative tone for story-led educational videos.",
    notes: "Premium storyteller",
    creditPer1000Chars: 3,
    profile: "neutral",
  },
  {
    id: "pro_soft_presenter",
    displayName: "Shimmer",
    tier: "pro",
    provider: "openai",
    voiceName: "shimmer",
    gender: "female",
    ageGroup: "adult",
    description: "Soft presenter tone for gentle learning videos.",
    notes: "Premium soft presenter",
    creditPer1000Chars: 3,
    profile: "female",
  },
  {
    id: "pro_balanced_narrator",
    displayName: "Alloy",
    tier: "pro",
    provider: "openai",
    voiceName: "alloy",
    gender: "neutral",
    ageGroup: "adult",
    description: "Balanced all-purpose tone for mixed explainer content.",
    notes: "Premium balanced narrator",
    creditPer1000Chars: 3,
    profile: "neutral",
  },
];

const TTS_OPTION_IDS = new Set(TTS_OPTIONS.map((option) => option.id));
const DEFAULT_EMOTION_TTS_ID = "basic_narrator_female";

function buildPrompt(title: string, visual: string) {
  return visual.trim() || title.trim();
}

function buildPromptFromSeed(seedSlide: CanvasSeedSlide) {
  return (
    seedSlide.imagePromptDraft?.trim() ||
    seedSlide.imagePrompt?.trim() ||
    buildPrompt(seedSlide.title, seedSlide.visual)
  );
}

function isLegacyAutoPrompt(currentPrompt: string, slide: SlideItem) {
  const current = currentPrompt.trim();
  if (!current) {
    return true;
  }
  if (current.includes("科普教学插画") || current.includes("知识图解风")) {
    return true;
  }
  const title = slide.title.trim();
  const visual = slide.visual.trim();
  return Boolean(visual && current === visual) || Boolean(title && current === title);
}

function toConciseImageErrorMessage(error?: string) {
  if (!error) {
    return "Failed. Please retry.";
  }
  const normalized = error.toLowerCase();
  if (normalized.includes("timeout")) {
    return "Timed out. Please retry.";
  }
  if (normalized.includes("abort")) {
    return "Request interrupted. Please retry.";
  }
  if (normalized.includes("save")) {
    return "Save failed. Please retry.";
  }
  return "Failed. Please retry.";
}

function toImageErrorDisplayCode(errorCode?: string, error?: string) {
  const rawCode = (errorCode || "").trim().toUpperCase();
  const rawError = (error || "").trim().toUpperCase();
  const bag = `${rawCode} ${rawError}`;
  return (() => {
    if (/TIMEOUT|TIMED_OUT|BUDGET/.test(bag)) return "IMG-408";
    if (/STORAGE|PERSIST|DOWNLOAD|ASSET/.test(bag)) return "IMG-512";
    if (/FETCH|NETWORK|ABORT|INTERRUPT/.test(bag)) return "IMG-503";
    if (/ALL_FAILED|PROVIDER|TUZI|GPTSAPI|DUOMI/.test(bag)) return "IMG-502";
    return "IMG-500";
  })();
}

function toImageFailureSentence(error?: string, errorCode?: string) {
  const displayCode = toImageErrorDisplayCode(errorCode, error);
  const normalized = (error || "").toLowerCase();
  const code = (errorCode || "").trim();
  const refunded = /credit[s]?\s+(have\s+been\s+)?refunded/i.test(error || "");
  const retryCopy = refunded
    ? "credits have been refunded, please retry manually"
    : "please retry manually";
  if (normalized.includes("timeout") || normalized.includes("budget")) {
    return `Generation timed out; ${retryCopy}. Code: ${displayCode}.`;
  }
  if (/storage|persist|download|asset/i.test(`${code} ${error || ""}`)) {
    return `The image could not be saved; ${retryCopy}. Code: ${displayCode}.`;
  }
  if (normalized.includes("abort") || normalized.includes("network") || normalized.includes("fetch")) {
    return `The image request was interrupted; ${retryCopy}. Code: ${displayCode}.`;
  }
  return `The image could not be generated right now; ${retryCopy}. Code: ${displayCode}.`;
}

function buildSlides(seedSlides: CanvasSeedSlide[]): SlideItem[] {
  return seedSlides.map((item) => ({
    ...item,
    coverTitle: item.page === 1 && !item.isCover ? item.title : undefined,
    coverSubtitle: item.page === 1 && !item.isCover ? "Waiting for generation" : undefined,
    coverTitleX: item.page === 1 && !item.isCover ? 50 : undefined,
    coverTitleY: item.page === 1 && !item.isCover ? 22 : undefined,
    coverTitleSize: item.page === 1 && !item.isCover ? 50 : undefined,
    coverSubtitleX: item.page === 1 && !item.isCover ? 50 : undefined,
    coverSubtitleY: item.page === 1 && !item.isCover ? 33 : undefined,
    coverSubtitleSize: item.page === 1 && !item.isCover ? 22 : undefined,
  }));
}

function buildSeedSlides(count: number): CanvasSeedSlide[] {
  return Array.from({ length: Math.max(1, count) }, (_, idx) => ({
    id: `slide-${idx + 1}`,
    page: idx + 1,
    title: `Slide ${idx + 1}`,
    body: "",
    visual: "",
  }));
}

function createInitialCanvasState(seedCount = 6): PersistedCanvasState {
  return createCanvasStateFromSeed(buildSeedSlides(seedCount));
}

function createCanvasStateFromSeed(seedSlides: CanvasSeedSlide[]): PersistedCanvasState {
  const normalizedSeedSlides = seedSlides.length ? seedSlides : buildSeedSlides(1);
  const baseSlides = buildSlides(normalizedSeedSlides);
  return {
    version: 1,
    slides: baseSlides,
    ttsBySlideId: Object.fromEntries(
      baseSlides.map((slide) => [slide.id, DEFAULT_EMOTION_TTS_ID]),
    ),
    promptBySlideId: Object.fromEntries(
      baseSlides.map((slide, idx) => [
        slide.id,
        buildPromptFromSeed(normalizedSeedSlides[idx] ?? slide),
      ]),
    ),
    imageHistoryBySlideId: Object.fromEntries(
      baseSlides.map((slide) => [slide.id, []]),
    ),
    activeImageIndexBySlideId: Object.fromEntries(baseSlides.map((slide) => [slide.id, 0])),
    historyOpenBySlideId: Object.fromEntries(baseSlides.map((slide) => [slide.id, false])),
  };
}

function sanitizeCanvasState(state: PersistedCanvasState): PersistedCanvasState {
  const slideIds = new Set(state.slides.map((slide) => slide.id));
  const ttsBySlideId: Record<string, string> = {};
  const promptBySlideId: Record<string, string> = {};
  const imageHistoryBySlideId: Record<string, string[]> = {};
  const activeImageIndexBySlideId: Record<string, number> = {};
  const historyOpenBySlideId: Record<string, boolean> = {};

  state.slides.forEach((slide, idx) => {
    const persistedTtsId = state.ttsBySlideId[slide.id];
    ttsBySlideId[slide.id] =
      persistedTtsId && TTS_OPTION_IDS.has(persistedTtsId)
        ? persistedTtsId
        : DEFAULT_EMOTION_TTS_ID;
    promptBySlideId[slide.id] =
      state.promptBySlideId[slide.id] ?? buildPrompt(slide.title, slide.visual);
    const history = state.imageHistoryBySlideId[slide.id] ?? [];
    imageHistoryBySlideId[slide.id] = history.filter(isUsableImageSrc);
    activeImageIndexBySlideId[slide.id] = Math.min(
      Math.max(state.activeImageIndexBySlideId[slide.id] ?? 0, 0),
      Math.max(0, imageHistoryBySlideId[slide.id].length - 1),
    );
    historyOpenBySlideId[slide.id] = Boolean(state.historyOpenBySlideId[slide.id]);
  });

  Object.keys(ttsBySlideId).forEach((slideId) => {
    if (!slideIds.has(slideId)) {
      delete ttsBySlideId[slideId];
      delete promptBySlideId[slideId];
      delete imageHistoryBySlideId[slideId];
      delete activeImageIndexBySlideId[slideId];
      delete historyOpenBySlideId[slideId];
    }
  });

  return {
    version: 1,
    slides: state.slides.map((slide, idx) => ({ ...slide, page: idx + 1 })),
    ttsBySlideId,
    promptBySlideId,
    imageHistoryBySlideId,
    activeImageIndexBySlideId,
    historyOpenBySlideId,
  };
}

function createInitialPack() {
  const fallback = createInitialCanvasState();
  if (typeof window === "undefined") {
    return {
      state: fallback,
      snapshot: JSON.stringify(fallback),
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        state: fallback,
        snapshot: JSON.stringify(fallback),
      };
    }
    const parsed = JSON.parse(raw) as PersistedCanvasState;
    if (parsed.version !== 1 || !Array.isArray(parsed.slides)) {
      return {
        state: fallback,
        snapshot: JSON.stringify(fallback),
      };
    }
    const normalized = sanitizeCanvasState(parsed);
    return {
      state: normalized,
      snapshot: JSON.stringify(normalized),
    };
  } catch {
    return {
      state: fallback,
      snapshot: JSON.stringify(fallback),
    };
  }
}

function getSlideIdFromNodeId(nodeId: string) {
  return nodeId.replace(/^(story|image)-/, "");
}

function isEditableElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tag === "input" ||
    tag === "textarea" ||
    tag === "select"
  );
}

function cloneState(state: PersistedCanvasState): PersistedCanvasState {
  return JSON.parse(JSON.stringify(state)) as PersistedCanvasState;
}

function formatDuration(totalSec: number) {
  const rounded = Math.max(0, Math.round(totalSec));
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseAspectRatioValue(value?: string | null) {
  const match = (value || "").match(/(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)/);
  if (!match) {
    return "16 / 9";
  }
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return "16 / 9";
  }
  return `${width} / ${height}`;
}

function estimateNarrationDurationSec(text: string) {
  const compactLength = text.trim().replace(/\s+/g, "").length;
  if (!compactLength) {
    return 0;
  }
  return clamp(Math.ceil(compactLength / 5), 10, 36);
}

export function StoryboardCanvas({
  onSaveStateChange,
  canvasModeExternal,
  onExportingPptChange,
  onPptExportReadyChange,
  onComposingVideoChange,
  generationSeedSlides,
  generationClearToken,
  generationTaskStateByIndex,
  generationInProgress = false,
  onRetryGenerationTask,
  hasMembership = false,
  onRequestTtsUpgrade,
  imageAspectRatio = "16:9",
  onModeActionRegister,
}: StoryboardCanvasProps) {
  const reactFlowRef = useRef<ReactFlowInstance<Node, Edge> | null>(null);
  const cancelPreviewRef = useRef(false);
  const audioTokenRef = useRef(0);
  const audioPausedRef = useRef(false);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const composedVideoUrlRef = useRef<string | null>(null);
  const exportedPptUrlRef = useRef<string | null>(null);
  const generatedAudioRef = useRef<Record<string, GeneratedAudioMeta>>({});
  const initialPack = useMemo(() => {
    if (typeof window === "undefined") {
      return createInitialPack();
    }
    if (generationClearToken) {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
      const seedSlides = generationSeedSlides?.length ? generationSeedSlides : buildSeedSlides(6);
      const seededState = createCanvasStateFromSeed(seedSlides);
      return {
        state: seededState,
        snapshot: JSON.stringify(seededState),
      };
    }
    return createInitialPack();
  }, [generationClearToken, generationSeedSlides]);
  const lastSavedSnapshotRef = useRef(initialPack.snapshot);
  const saveTimerRef = useRef<number | null>(null);
  const previewPauseRef = useRef(false);
  const hasAutoFocusedFirstSlideRef = useRef(false);
  const hasCenteredFirstSlideRef = useRef(false);
  const copiedSlideRef = useRef<null | {
    slide: SlideItem;
    tts: string;
    prompt: string;
    imageHistory: string[];
    activeImageIndex: number;
  }>(null);

  const [history, setHistory] = useState<HistoryState>(() => ({
    past: [],
    present: initialPack.state,
    future: [],
  }));
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [editingPromptSlideId, setEditingPromptSlideId] = useState<string | null>(
    null,
  );
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isPreviewPaused, setIsPreviewPaused] = useState(false);
  const [activePreviewSlideId, setActivePreviewSlideId] = useState<string | null>(
    null,
  );
  const [previewFrame, setPreviewFrame] = useState<{
    imageSrc: string;
    title: string;
    page: number;
  } | null>(null);
  const [playingAudioSlideId, setPlayingAudioSlideId] = useState<string | null>(
    null,
  );
  const [pausedAudioSlideId, setPausedAudioSlideId] = useState<string | null>(
    null,
  );
  const [audioProgressBySlideId, setAudioProgressBySlideId] = useState<
    Record<string, number>
  >({});
  const [audioDurationBySlideId, setAudioDurationBySlideId] = useState<
    Record<string, number>
  >({});
  const [generatedAudioBySlideId, setGeneratedAudioBySlideId] = useState<
    Record<string, GeneratedAudioMeta>
  >({});
  const [openTtsMenuSlideId, setOpenTtsMenuSlideId] = useState<string | null>(
    null,
  );
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeStatus, setComposeStatus] = useState<ComposeStatus>("idle");
  const [composeSteps, setComposeSteps] = useState<
    Record<ComposeStepKey, ComposeStepStatus>
  >({
    prepare: "waiting",
    tts: "waiting",
    render: "waiting",
    finalize: "waiting",
  });
  const [composeProgress, setComposeProgress] = useState(0);
  const [composedVideoUrl, setComposedVideoUrl] = useState<string | null>(null);
  const [composedVideoFilename, setComposedVideoFilename] = useState(
    "knowlens-compose-preview.webm",
  );
  const [composeError, setComposeError] = useState<string | null>(null);
  const [composeMeta, setComposeMeta] = useState<ComposeMeta | null>(null);
  const [isExportingPpt, setIsExportingPpt] = useState(false);
  const [exportPptProgress, setExportPptProgress] = useState(0);
  const [exportPptPhase, setExportPptPhase] = useState<ExportPhase>("prepare");
  const [pptExportError, setPptExportError] = useState<string | null>(null);
  const [showPptExportModal, setShowPptExportModal] = useState(false);
  const [pptExportStatus, setPptExportStatus] = useState<PptExportStatus>("idle");
  const [exportedPptUrl, setExportedPptUrl] = useState<string | null>(null);
  const [pptDownloadNotice, setPptDownloadNotice] = useState<string | null>(null);

  useEffect(() => {
    generatedAudioRef.current = generatedAudioBySlideId;
  }, [generatedAudioBySlideId]);

  useEffect(() => {
    if (!openTtsMenuSlideId) {
      return;
    }
    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest("[data-tts-menu-root='true']")
      ) {
        return;
      }
      setOpenTtsMenuSlideId(null);
    };
    document.addEventListener("click", handleDocumentClick);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  }, [openTtsMenuSlideId]);

  const present = history.present;
  const slides = present.slides;
  const ttsBySlideId = present.ttsBySlideId;
  const promptBySlideId = present.promptBySlideId;
  const imageHistoryBySlideId = present.imageHistoryBySlideId;
  const activeImageIndexBySlideId = present.activeImageIndexBySlideId;

  const canvasMode: CanvasMode = canvasModeExternal ?? "free";
  const resolvedImageAspectRatio = useMemo(
    () => parseAspectRatioValue(imageAspectRatio),
    [imageAspectRatio],
  );
  const pptExportReady = useMemo(() => {
    if (canvasMode !== "ppt" || !slides.length) {
      return false;
    }
    return slides.every((slide) => {
      const taskState = generationTaskStateByIndex?.[slide.page];
      if (
        taskState?.status === "queued" ||
        taskState?.status === "generating" ||
        taskState?.status === "retrying" ||
        taskState?.status === "failed"
      ) {
        return false;
      }
      const historyImages = (imageHistoryBySlideId[slide.id] ?? []).filter(isUsableImageSrc);
      const activeIdx = activeImageIndexBySlideId[slide.id] ?? 0;
      return Boolean(getActiveImageSrc(historyImages, activeIdx, taskState?.imageUrl));
    });
  }, [
    activeImageIndexBySlideId,
    canvasMode,
    generationTaskStateByIndex,
    imageHistoryBySlideId,
    slides,
  ]);
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const isCanvasInteractive = canvasMode === "free";
  const selectedSlideIndex = useMemo(() => {
    if (!slides.length) {
      return -1;
    }
    if (!selectedSlideId) {
      return 0;
    }
    const idx = slides.findIndex((slide) => slide.id === selectedSlideId);
    return idx >= 0 ? idx : 0;
  }, [selectedSlideId, slides]);

  useEffect(() => {
    if (!generationClearToken) {
      return;
    }
    const seedSlides = generationSeedSlides?.length ? generationSeedSlides : buildSeedSlides(6);
    const seededState = sanitizeCanvasState(createCanvasStateFromSeed(seedSlides));
    setHistory({
      past: [],
      present: seededState,
      future: [],
    });
    setSelectedSlideId(seededState.slides[0]?.id ?? null);
    lastSavedSnapshotRef.current = JSON.stringify(seededState);
    setSaveState("saved");
    setHasUnsavedChanges(false);
  }, [generationClearToken, generationSeedSlides]);

  useEffect(() => {
    if (!generationSeedSlides?.length) {
      return;
    }
    const seedPromptByIndex = new Map<number, string>();
    generationSeedSlides.forEach((seedSlide, idx) => {
      const prompt = (seedSlide.imagePromptDraft || seedSlide.imagePrompt || "").trim();
      if (prompt) {
        seedPromptByIndex.set(idx, prompt);
      }
    });
    if (!seedPromptByIndex.size) {
      return;
    }
    setHistory((prev) => {
      let changed = false;
      const nextPromptBySlideId = { ...prev.present.promptBySlideId };
      prev.present.slides.forEach((slide, idx) => {
        const seedPrompt = seedPromptByIndex.get(idx);
        if (!seedPrompt) {
          return;
        }
        const currentPrompt = nextPromptBySlideId[slide.id] || "";
        if (currentPrompt.trim() !== seedPrompt && isLegacyAutoPrompt(currentPrompt, slide)) {
          nextPromptBySlideId[slide.id] = seedPrompt;
          changed = true;
        }
      });
      if (!changed) {
        return prev;
      }
      return {
        ...prev,
        present: {
          ...prev.present,
          promptBySlideId: nextPromptBySlideId,
        },
      };
    });
  }, [generationSeedSlides]);

  useEffect(() => {
    hasAutoFocusedFirstSlideRef.current = false;
    hasCenteredFirstSlideRef.current = false;
  }, [slides.length, slides[0]?.id]);

  useEffect(() => {
    if (selectedSlideId || !slides.length || hasAutoFocusedFirstSlideRef.current) {
      return;
    }
    hasAutoFocusedFirstSlideRef.current = true;
    setSelectedSlideId(slides[0].id);
  }, [selectedSlideId, slides]);
  const composeLoadingHint = useMemo(() => {
    if (composeSteps.prepare === "running") {
      return "Preparing export settings...";
    }
    if (composeSteps.tts === "running") {
      return "Preparing narration tracks...";
    }
    if (composeSteps.render === "running") {
      return "Rendering scenes and audio...";
    }
    if (composeSteps.finalize === "running") {
      return "Finalizing the video file...";
    }
    return "Exporting video...";
  }, [composeSteps.finalize, composeSteps.prepare, composeSteps.render, composeSteps.tts]);
  const exportPptHint = useMemo(() => {
    if (pptDownloadNotice) {
      return pptDownloadNotice;
    }
    if (pptExportStatus === "error") {
      return pptExportError || "Export failed. Please retry when all slide images are ready.";
    }
    if (exportPptPhase === "prepare") {
      return "Checking slide images...";
    }
    if (exportPptPhase === "images") {
      return "Preparing images...";
    }
    if (exportPptPhase === "slides") {
      return "Writing slides...";
    }
    if (exportPptPhase === "file") {
      return "Finalizing the file...";
    }
    if (exportPptPhase === "done") {
      return "PPT file is ready. If the browser does not start downloading, click Download PPT again.";
    }
    return "Preparing export...";
  }, [pptDownloadNotice, pptExportError, exportPptPhase, pptExportStatus]);

  const triggerPptDownload = useCallback(
    (urlOverride?: string) => {
      const downloadUrl = urlOverride || exportedPptUrl;
      if (!downloadUrl) {
        setPptDownloadNotice("PPT file is not ready yet. Please export again.");
        return false;
      }

      try {
        const anchor = document.createElement("a");
        anchor.href = downloadUrl;
        anchor.download = PPT_DOWNLOAD_FILENAME;
        anchor.rel = "noopener";
        anchor.style.display = "none";
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        setPptDownloadNotice(
          "PPT file is ready. If the browser does not start downloading, click Download PPT again.",
        );
        return true;
      } catch {
        setPptDownloadNotice("Download could not start. Please click Download PPT again.");
        return false;
      }
    },
    [exportedPptUrl],
  );

  const commitChange = useCallback(
    (updater: (prev: PersistedCanvasState) => PersistedCanvasState) => {
      setHistory((prev) => {
        const next = sanitizeCanvasState(updater(cloneState(prev.present)));
        const nextSerialized = JSON.stringify(next);
        const currentSerialized = JSON.stringify(prev.present);
        if (nextSerialized === currentSerialized) {
          return prev;
        }
        const trimmedPast =
          prev.past.length >= HISTORY_LIMIT
            ? [...prev.past.slice(prev.past.length - HISTORY_LIMIT + 1), prev.present]
            : [...prev.past, prev.present];
        return {
          past: trimmedPast,
          present: next,
          future: [],
        };
      });
    },
    [],
  );

  useEffect(() => {
    if (!generationTaskStateByIndex) {
      return;
    }
    const successfulResults = Object.entries(generationTaskStateByIndex)
      .map(([indexText, state]) => ({
        index: Number(indexText),
        imageUrl: state.imageUrl?.trim() || "",
        status: state.status,
      }))
      .filter((item) => Number.isFinite(item.index) && item.index > 0 && item.status === "success" && item.imageUrl)
      .sort((a, b) => a.index - b.index);
    if (!successfulResults.length) {
      return;
    }
    commitChange((prev) => {
      const next = cloneState(prev);
      let changed = false;
      successfulResults.forEach(({ index, imageUrl }) => {
        const slide = next.slides[index - 1];
        if (!slide) {
          return;
        }
        const currentHistory = (next.imageHistoryBySlideId[slide.id] ?? []).filter(isUsableImageSrc);
        const lastUrl = currentHistory[currentHistory.length - 1] ?? "";
        if (lastUrl === imageUrl) {
          const activeIndex = currentHistory.length ? currentHistory.length - 1 : 0;
          if (next.activeImageIndexBySlideId[slide.id] !== activeIndex) {
            next.activeImageIndexBySlideId[slide.id] = activeIndex;
            changed = true;
          }
          return;
        }
        const nextHistory = [...currentHistory, imageUrl].slice(-12);
        next.imageHistoryBySlideId[slide.id] = nextHistory;
        next.activeImageIndexBySlideId[slide.id] = nextHistory.length - 1;
        changed = true;
      });
      return changed ? next : prev;
    });
  }, [commitChange, generationTaskStateByIndex]);

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0) {
        return prev;
      }
      const previous = prev.past[prev.past.length - 1];
      return {
        past: prev.past.slice(0, -1),
        present: previous,
        future: [prev.present, ...prev.future].slice(0, HISTORY_LIMIT),
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0) {
        return prev;
      }
      const [next, ...rest] = prev.future;
      return {
        past: [...prev.past, prev.present].slice(-HISTORY_LIMIT),
        present: next,
        future: rest,
      };
    });
  }, []);

  const sleep = useCallback((ms: number) => {
    return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
  }, []);

  useEffect(() => {
    onExportingPptChange?.(isExportingPpt);
  }, [isExportingPpt, onExportingPptChange]);

  useEffect(() => {
    onPptExportReadyChange?.(pptExportReady);
  }, [onPptExportReadyChange, pptExportReady]);

  useEffect(() => {
    onComposingVideoChange?.(composeStatus === "running");
  }, [composeStatus, onComposingVideoChange]);

  const focusSlide = useCallback(
    async (slideId: string, target: "story" | "image" = "story", zoom = 0.9) => {
      const idx = slides.findIndex((slide) => slide.id === slideId);
      if (!reactFlowRef.current || idx < 0) {
        return;
      }
      const centerX = idx * 460 + 190;
      const centerY = target === "story" ? 220 : 770;
      await reactFlowRef.current.setCenter(centerX, centerY, {
        zoom,
        duration: 280,
      });
    },
    [slides],
  );

  useEffect(() => {
    if (!slides.length || !selectedSlideId || !reactFlowRef.current) {
      return;
    }
    const firstId = slides[0].id;
    if (selectedSlideId !== firstId || hasCenteredFirstSlideRef.current) {
      return;
    }
    hasCenteredFirstSlideRef.current = true;
    void focusSlide(firstId, "image", 0.96);
  }, [focusSlide, selectedSlideId, slides]);

  const playTtsWithProgress = useCallback(
    async (slideId: string, text: string, ttsId: string) => {
      audioTokenRef.current += 1;
      const token = audioTokenRef.current;
      const generatedAudio = generatedAudioRef.current[slideId];
      const estimatedDurationSec =
        generatedAudio?.durationSec || estimateNarrationDurationSec(text);
      audioPausedRef.current = false;
      audioPreviewRef.current?.pause();
      audioPreviewRef.current = null;
      setPlayingAudioSlideId(slideId);
      setPausedAudioSlideId(null);
      setAudioProgressBySlideId((prev) => ({ ...prev, [slideId]: 0 }));
      setAudioDurationBySlideId((prev) => ({
        ...prev,
        [slideId]: estimatedDurationSec,
      }));

      if (generatedAudio?.status === "ready" && generatedAudio.url) {
        await new Promise<void>((resolve) => {
          const audio = new Audio(generatedAudio.url);
          audioPreviewRef.current = audio;
          audio.preload = "metadata";

          const finish = () => {
            if (token !== audioTokenRef.current) {
              resolve();
              return;
            }
            const durationSec =
              Number.isFinite(audio.duration) && audio.duration > 0
                ? audio.duration
                : estimatedDurationSec;
            setAudioDurationBySlideId((prev) => ({
              ...prev,
              [slideId]: durationSec,
            }));
            setAudioProgressBySlideId((prev) => ({
              ...prev,
              [slideId]: durationSec,
            }));
            resolve();
          };

          audio.onloadedmetadata = () => {
            if (token !== audioTokenRef.current) {
              return;
            }
            const durationSec =
              Number.isFinite(audio.duration) && audio.duration > 0
                ? audio.duration
                : estimatedDurationSec;
            setAudioDurationBySlideId((prev) => ({
              ...prev,
              [slideId]: durationSec,
            }));
          };

          audio.ontimeupdate = () => {
            if (token !== audioTokenRef.current) {
              return;
            }
            const durationSec =
              Number.isFinite(audio.duration) && audio.duration > 0
                ? audio.duration
                : estimatedDurationSec;
            setAudioDurationBySlideId((prev) => ({
              ...prev,
              [slideId]: durationSec,
            }));
            setAudioProgressBySlideId((prev) => ({
              ...prev,
              [slideId]: clamp(audio.currentTime, 0, durationSec),
            }));
          };

          audio.onended = finish;
          audio.onerror = () => resolve();
          void audio.play().catch(() => resolve());
        });

        if (token === audioTokenRef.current) {
          setPlayingAudioSlideId(null);
          audioPreviewRef.current = null;
        }
        return;
      }

      if (!("speechSynthesis" in window)) {
        const durationSec = estimatedDurationSec || 12;
        const startedAt = performance.now();
        let totalPausedMs = 0;
        let pausedAt: number | null = null;
        const getElapsedSec = () => {
          if (audioPausedRef.current) {
            pausedAt ??= performance.now();
          } else if (pausedAt !== null) {
            totalPausedMs += performance.now() - pausedAt;
            pausedAt = null;
          }
          return (performance.now() - startedAt - totalPausedMs) / 1000;
        };
        while (true) {
          if (token !== audioTokenRef.current) {
            return;
          }
          const elapsedSec = getElapsedSec();
          setAudioProgressBySlideId((prev) => ({
            ...prev,
            [slideId]: clamp(elapsedSec, 0, durationSec),
          }));
          if (elapsedSec >= durationSec) {
            break;
          }
          await sleep(120);
        }
        setPlayingAudioSlideId(null);
        return;
      }

      window.speechSynthesis.cancel();

      await new Promise<void>((resolve) => {
        const selectedProfile =
          TTS_OPTIONS.find((item) => item.id === ttsId)?.profile ?? "neutral";
        const utterance = new SpeechSynthesisUtterance(
          text || "Add narration before previewing audio.",
        );
        utterance.lang = "zh-CN";
        utterance.rate = selectedProfile === "youth" ? 1.08 : 1;
        utterance.pitch =
          selectedProfile === "female"
            ? 1.15
            : selectedProfile === "male"
              ? 0.88
              : 1;
        utterance.volume = 1;

        const durationSec = estimatedDurationSec || 12;
        const startedAt = performance.now();
        let totalPausedMs = 0;
        let pausedAt: number | null = null;
        const getElapsedSec = () => {
          if (audioPausedRef.current) {
            pausedAt ??= performance.now();
          } else if (pausedAt !== null) {
            totalPausedMs += performance.now() - pausedAt;
            pausedAt = null;
          }
          return (performance.now() - startedAt - totalPausedMs) / 1000;
        };
        const fallbackTimer = window.setInterval(() => {
          if (token !== audioTokenRef.current) {
            window.clearInterval(fallbackTimer);
            return;
          }
          const elapsedSec = getElapsedSec();
          setAudioProgressBySlideId((prev) => {
            return { ...prev, [slideId]: clamp(elapsedSec, 0, durationSec) };
          });
        }, 120);

        utterance.onboundary = (event) => {
          if (token !== audioTokenRef.current) {
            return;
          }
          const total = Math.max(1, utterance.text.length);
          const nextSec = (event.charIndex / total) * durationSec;
          setAudioProgressBySlideId((prev) => ({
            ...prev,
            [slideId]: Math.max(prev[slideId] ?? 0, nextSec),
          }));
        };

        utterance.onend = () => {
          window.clearInterval(fallbackTimer);
          const elapsedSec = getElapsedSec();
          const remainingMs = Math.max(0, durationSec - elapsedSec) * 1000;
          window.setTimeout(() => {
            if (token === audioTokenRef.current) {
              setAudioProgressBySlideId((prev) => ({
                ...prev,
                [slideId]: durationSec,
              }));
            }
            resolve();
          }, remainingMs);
        };

        utterance.onerror = () => {
          window.clearInterval(fallbackTimer);
          resolve();
        };

        window.speechSynthesis.speak(utterance);
      });

      if (token === audioTokenRef.current) {
        setPlayingAudioSlideId(null);
        setPausedAudioSlideId(null);
      }
    },
    [sleep],
  );

  const stopAllAudio = useCallback(() => {
    audioTokenRef.current += 1;
    audioPausedRef.current = false;
    audioPreviewRef.current?.pause();
    audioPreviewRef.current = null;
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setPlayingAudioSlideId(null);
    setPausedAudioSlideId(null);
  }, []);

  const normalizeTtsVoiceId = useCallback((ttsId: string) => {
    return TTS_OPTION_IDS.has(ttsId) ? ttsId : DEFAULT_EMOTION_TTS_ID;
  }, []);

  const synthesizeSceneAudioFromApi = useCallback(
    async (text: string, ttsId: string): Promise<SceneAudioAsset["buffer"]> => {
      if (!text.trim()) {
        return null;
      }

      const response = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          voice: normalizeTtsVoiceId(ttsId),
        }),
      });

      if (!response.ok) {
        throw new Error("TTS generation failed");
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioContext = new AudioContext({ sampleRate: 48000 });
      try {
        const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        return decoded;
      } finally {
        await audioContext.close();
      }
    },
    [normalizeTtsVoiceId],
  );

  const getAudioDurationFromBlob = useCallback((blob: Blob) => {
    return new Promise<number>((resolve) => {
      const tempUrl = URL.createObjectURL(blob);
      const audio = new Audio();
      const release = () => {
        URL.revokeObjectURL(tempUrl);
      };
      audio.preload = "metadata";
      audio.src = tempUrl;
      audio.onloadedmetadata = () => {
        const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
        release();
        resolve(duration > 0 ? duration : 0);
      };
      audio.onerror = () => {
        release();
        resolve(0);
      };
    });
  }, []);

  const ensureAudioFileForSlide = useCallback(
    async (slideId: string, body: string, ttsId: string) => {
      const existing = generatedAudioBySlideId[slideId];
      if (existing?.status === "ready") {
        return existing;
      }
      if (!body.trim()) {
        throw new Error("Add narration before generating audio");
      }

      setGeneratedAudioBySlideId((prev) => ({
        ...prev,
        [slideId]: {
          url: prev[slideId]?.url ?? "",
          durationSec: prev[slideId]?.durationSec ?? 0,
          status: "generating",
        },
      }));

      const response = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: body,
          voice: normalizeTtsVoiceId(ttsId),
        }),
      });
      if (!response.ok) {
        throw new Error("Audio generation failed");
      }

      const audioBlob = await response.blob();
      const nextUrl = URL.createObjectURL(audioBlob);
      const durationSec = await getAudioDurationFromBlob(audioBlob);
      const fallbackDurationSec = estimateNarrationDurationSec(body) || 12;
      const readyAudio = {
        url: nextUrl,
        durationSec: durationSec || fallbackDurationSec,
        status: "ready" as const,
      };
      generatedAudioRef.current = {
        ...generatedAudioRef.current,
        [slideId]: readyAudio,
      };

      setGeneratedAudioBySlideId((prev) => {
        const oldUrl = prev[slideId]?.url;
        if (oldUrl && oldUrl.startsWith("blob:") && oldUrl !== nextUrl) {
          URL.revokeObjectURL(oldUrl);
        }
        return {
          ...prev,
          [slideId]: readyAudio,
        };
      });

      return readyAudio;
    },
    [generatedAudioBySlideId, getAudioDurationFromBlob, normalizeTtsVoiceId],
  );

  const previewAudioForSlide = useCallback(
    async (slideId: string, body: string) => {
      const ttsId = ttsBySlideId[slideId] ?? DEFAULT_EMOTION_TTS_ID;
      const selectedOption = TTS_OPTIONS.find((item) => item.id === ttsId);
      if (selectedOption?.provider === "openai" && !hasMembership) {
        onRequestTtsUpgrade?.();
        return;
      }
      try {
        await ensureAudioFileForSlide(slideId, body, ttsId);
      } catch (error) {
        setGeneratedAudioBySlideId((prev) => ({
          ...prev,
          [slideId]: {
            url: prev[slideId]?.url ?? "",
            durationSec: prev[slideId]?.durationSec ?? 0,
            status: "error",
            error: error instanceof Error ? error.message : "Audio generation failed",
          },
        }));
      }
      await playTtsWithProgress(slideId, body, ttsId);
    },
    [
      ensureAudioFileForSlide,
      hasMembership,
      onRequestTtsUpgrade,
      playTtsWithProgress,
      ttsBySlideId,
    ],
  );

  const pauseAudioForSlide = useCallback(
    (slideId: string) => {
      if (playingAudioSlideId !== slideId) {
        return;
      }
      audioPausedRef.current = true;
      audioPreviewRef.current?.pause();
      if ("speechSynthesis" in window) {
        window.speechSynthesis.pause();
      }
      setPlayingAudioSlideId(null);
      setPausedAudioSlideId(slideId);
    },
    [playingAudioSlideId],
  );

  const resumeAudioForSlide = useCallback((slideId: string) => {
    audioPausedRef.current = false;
    if (audioPreviewRef.current) {
      void audioPreviewRef.current.play().catch(() => {
        audioTokenRef.current += 1;
        setPlayingAudioSlideId(null);
        setPausedAudioSlideId(null);
      });
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.resume();
    }
    setPausedAudioSlideId(null);
    setPlayingAudioSlideId(slideId);
  }, []);

  const toggleAudioPreviewForSlide = useCallback(
    (slideId: string, text: string) => {
      if (playingAudioSlideId === slideId) {
        pauseAudioForSlide(slideId);
        return;
      }
      if (pausedAudioSlideId === slideId) {
        resumeAudioForSlide(slideId);
        return;
      }
      void previewAudioForSlide(slideId, text);
    },
    [
      pauseAudioForSlide,
      pausedAudioSlideId,
      playingAudioSlideId,
      previewAudioForSlide,
      resumeAudioForSlide,
    ],
  );

  const addSlideAfter = useCallback(
    (afterSlideId: string) => {
      commitChange((prev) => {
        const targetIndex = prev.slides.findIndex((slide) => slide.id === afterSlideId);
        if (targetIndex < 0) {
          return prev;
        }

        const newId = `slide-${Date.now()}-${Math.round(Math.random() * 9999)}`;
        const base = prev.slides[targetIndex];
        const nextSlide: SlideItem = {
          id: newId,
          page: base.page + 1,
          title: "New Scene",
          body: "",
          visual: "",
        };
        const nextSlides = [
          ...prev.slides.slice(0, targetIndex + 1),
          nextSlide,
          ...prev.slides.slice(targetIndex + 1),
        ].map((slide, idx) => ({ ...slide, page: idx + 1 }));

        return {
          ...prev,
          slides: nextSlides,
          ttsBySlideId: {
            ...prev.ttsBySlideId,
            [newId]: DEFAULT_EMOTION_TTS_ID,
          },
          promptBySlideId: {
            ...prev.promptBySlideId,
            [newId]: buildPrompt("New Scene", "Add a visual direction"),
          },
          imageHistoryBySlideId: {
            ...prev.imageHistoryBySlideId,
            [newId]: [CASE_IMAGES[0]],
          },
          activeImageIndexBySlideId: {
            ...prev.activeImageIndexBySlideId,
            [newId]: 0,
          },
          historyOpenBySlideId: {
            ...prev.historyOpenBySlideId,
            [newId]: false,
          },
        };
      });
    },
    [commitChange],
  );

  const deleteSlide = useCallback(
    (slideId: string) => {
      commitChange((prev) => {
        if (prev.slides.length <= 1) {
          return prev;
        }
        const nextSlides = prev.slides
          .filter((slide) => slide.id !== slideId)
          .map((slide, idx) => ({ ...slide, page: idx + 1 }));
        if (nextSlides.length === prev.slides.length) {
          return prev;
        }

        const nextTts = { ...prev.ttsBySlideId };
        const nextPrompt = { ...prev.promptBySlideId };
        const nextHistory = { ...prev.imageHistoryBySlideId };
        const nextActiveIdx = { ...prev.activeImageIndexBySlideId };
        const nextHistoryOpen = { ...prev.historyOpenBySlideId };
        delete nextTts[slideId];
        delete nextPrompt[slideId];
        delete nextHistory[slideId];
        delete nextActiveIdx[slideId];
        delete nextHistoryOpen[slideId];

        return {
          ...prev,
          slides: nextSlides,
          ttsBySlideId: nextTts,
          promptBySlideId: nextPrompt,
          imageHistoryBySlideId: nextHistory,
          activeImageIndexBySlideId: nextActiveIdx,
          historyOpenBySlideId: nextHistoryOpen,
        };
      });

      setSelectedSlideId((current) => (current === slideId ? null : current));
    },
    [commitChange],
  );

  const copySlide = useCallback(() => {
    if (!selectedSlideId) {
      return;
    }
    const slide = slides.find((item) => item.id === selectedSlideId);
    if (!slide) {
      return;
    }
    copiedSlideRef.current = {
      slide: { ...slide },
      tts: ttsBySlideId[slide.id] ?? DEFAULT_EMOTION_TTS_ID,
      prompt: promptBySlideId[slide.id] ?? buildPrompt(slide.title, slide.visual),
      imageHistory: [...(imageHistoryBySlideId[slide.id] ?? [CASE_IMAGES[0]])],
      activeImageIndex: activeImageIndexBySlideId[slide.id] ?? 0,
    };
  }, [
    activeImageIndexBySlideId,
    imageHistoryBySlideId,
    promptBySlideId,
    selectedSlideId,
    slides,
    ttsBySlideId,
  ]);

  const pasteSlide = useCallback(() => {
    const copied = copiedSlideRef.current;
    if (!copied) {
      return;
    }

    commitChange((prev) => {
      const anchorIndex = selectedSlideId
        ? prev.slides.findIndex((slide) => slide.id === selectedSlideId)
        : prev.slides.length - 1;
      const insertIndex = anchorIndex >= 0 ? anchorIndex + 1 : prev.slides.length;
      const newId = `slide-${Date.now()}-${Math.round(Math.random() * 9999)}`;
      const newSlide: SlideItem = {
        ...copied.slide,
        id: newId,
        title: `${copied.slide.title}（副本）`,
      };
      const nextSlides = [
        ...prev.slides.slice(0, insertIndex),
        newSlide,
        ...prev.slides.slice(insertIndex),
      ].map((slide, idx) => ({ ...slide, page: idx + 1 }));

      return {
        ...prev,
        slides: nextSlides,
        ttsBySlideId: {
          ...prev.ttsBySlideId,
          [newId]: copied.tts,
        },
        promptBySlideId: {
          ...prev.promptBySlideId,
          [newId]: copied.prompt,
        },
        imageHistoryBySlideId: {
          ...prev.imageHistoryBySlideId,
          [newId]: copied.imageHistory,
        },
        activeImageIndexBySlideId: {
          ...prev.activeImageIndexBySlideId,
          [newId]: Math.min(
            Math.max(copied.activeImageIndex, 0),
            copied.imageHistory.length - 1,
          ),
        },
        historyOpenBySlideId: {
          ...prev.historyOpenBySlideId,
          [newId]: false,
        },
      };
    });
  }, [commitChange, selectedSlideId]);

  const redrawImageForSlide = useCallback(
    (slideId: string, page: number) => {
      commitChange((prev) => {
        const current = prev.imageHistoryBySlideId[slideId] ?? [
          CASE_IMAGES[(page - 1) % CASE_IMAGES.length],
        ];
        const nextImage = CASE_IMAGES[(page - 1 + current.length * 7) % CASE_IMAGES.length];
        const nextHistory = [...current, nextImage];
        return {
          ...prev,
          imageHistoryBySlideId: {
            ...prev.imageHistoryBySlideId,
            [slideId]: nextHistory,
          },
          activeImageIndexBySlideId: {
            ...prev.activeImageIndexBySlideId,
            [slideId]: nextHistory.length - 1,
          },
        };
      });
    },
    [commitChange],
  );

  const regenerateSlideImage = useCallback(
    (slideId: string, page: number) => {
      if (onRetryGenerationTask) {
        onRetryGenerationTask(page);
        return;
      }
      redrawImageForSlide(slideId, page);
    },
    [onRetryGenerationTask, redrawImageForSlide],
  );

  const selectHistoryImage = useCallback(
    (slideId: string, historyIndex: number) => {
      commitChange((prev) => ({
        ...prev,
        activeImageIndexBySlideId: {
          ...prev.activeImageIndexBySlideId,
          [slideId]: historyIndex,
        },
      }));
    },
    [commitChange],
  );

  const updateSlide = useCallback(
    (slideId: string, key: "title" | "body" | "visual", value: string) => {
      commitChange((prev) => ({
        ...prev,
        slides: prev.slides.map((slide) =>
          slide.id === slideId ? { ...slide, [key]: value } : slide,
        ),
      }));
    },
    [commitChange],
  );

  const updateSlideField = useCallback(
    (slideId: string, key: keyof SlideItem, value: string | number) => {
      commitChange((prev) => ({
        ...prev,
        slides: prev.slides.map((slide) =>
          slide.id === slideId ? { ...slide, [key]: value } : slide,
        ),
      }));
    },
    [commitChange],
  );

  const updateTtsForSlide = useCallback(
    (slideId: string, ttsId: string) => {
      const selectedOption = TTS_OPTIONS.find((item) => item.id === ttsId);
      if (selectedOption?.provider === "openai" && !hasMembership) {
        setOpenTtsMenuSlideId(null);
        onRequestTtsUpgrade?.();
        return;
      }
      commitChange((prev) => ({
        ...prev,
        ttsBySlideId: {
          ...prev.ttsBySlideId,
          [slideId]: ttsId,
        },
      }));
      setOpenTtsMenuSlideId(null);
    },
    [commitChange, hasMembership, onRequestTtsUpgrade],
  );

  const updatePromptForSlide = useCallback(
    (slideId: string, prompt: string) => {
      commitChange((prev) => ({
        ...prev,
        promptBySlideId: {
          ...prev.promptBySlideId,
          [slideId]: prompt,
        },
      }));
    },
    [commitChange],
  );

  const stopPreview = useCallback(() => {
    cancelPreviewRef.current = true;
    previewPauseRef.current = false;
    setIsPreviewing(false);
    setIsPreviewPaused(false);
    setActivePreviewSlideId(null);
    setPreviewFrame(null);
    stopAllAudio();
  }, [stopAllAudio]);

  const focusSelectedSlide = useCallback(async () => {
    if (!selectedSlideId) {
      return;
    }
    await focusSlide(selectedSlideId, "image", 1.02);
  }, [focusSlide, selectedSlideId]);

  const goToNeighborSlide = useCallback(
    (delta: number) => {
      if (!slides.length) {
        return;
      }
      const targetIdx = clamp(selectedSlideIndex + delta, 0, slides.length - 1);
      const targetSlide = slides[targetIdx];
      if (!targetSlide) {
        return;
      }
      setSelectedSlideId(targetSlide.id);
      if (isCanvasInteractive) {
        void focusSlide(targetSlide.id, "image", 0.96);
      }
    },
    [focusSlide, isCanvasInteractive, selectedSlideIndex, slides],
  );

  const pausePreview = useCallback(() => {
    if (!isPreviewing) {
      return;
    }
    previewPauseRef.current = true;
    setIsPreviewPaused(true);
    if ("speechSynthesis" in window) {
      window.speechSynthesis.pause();
    }
  }, [isPreviewing]);

  const resumePreview = useCallback(() => {
    if (!isPreviewing) {
      return;
    }
    previewPauseRef.current = false;
    setIsPreviewPaused(false);
    if ("speechSynthesis" in window) {
      window.speechSynthesis.resume();
    }
  }, [isPreviewing]);

  const runPreview = useCallback(
    async (fromSelected = false) => {
      if (!reactFlowRef.current) {
        return;
      }

      if (isPreviewing && !fromSelected) {
        stopPreview();
        return;
      }

      cancelPreviewRef.current = false;
      previewPauseRef.current = false;
      setIsPreviewPaused(false);
      setIsPreviewing(true);

      const startIndex = fromSelected
        ? Math.max(
            0,
            slides.findIndex((slide) => slide.id === selectedSlideId),
          )
        : 0;

      for (let idx = startIndex; idx < slides.length; idx += 1) {
        if (cancelPreviewRef.current) {
          break;
        }

        while (previewPauseRef.current && !cancelPreviewRef.current) {
          await sleep(100);
        }
        if (cancelPreviewRef.current) {
          break;
        }

        const slide = slides[idx];
        const generationState = generationTaskStateByIndex?.[slide.page];
        const historyImages = (imageHistoryBySlideId[slide.id] ?? []).filter(isUsableImageSrc);
        const activeIdx = activeImageIndexBySlideId[slide.id] ?? 0;
        const src = getActiveImageSrc(historyImages, activeIdx, generationState?.imageUrl);
        if (!src) {
          continue;
        }
        setPreviewFrame({
          imageSrc: src,
          title: slide.title,
          page: slide.page,
        });
        const centerX = idx * 460 + 190;
        const centerY = 760;
        setActivePreviewSlideId(slide.id);
        await reactFlowRef.current.setCenter(centerX, centerY, {
          zoom: 1.12,
          duration: 360,
        });
        await previewAudioForSlide(slide.id, slide.body);
        await sleep(120);
      }

      setActivePreviewSlideId(null);
      setPreviewFrame(null);
      setIsPreviewing(false);
      setIsPreviewPaused(false);
    },
    [
      activeImageIndexBySlideId,
      generationTaskStateByIndex,
      imageHistoryBySlideId,
      isPreviewing,
      previewAudioForSlide,
      selectedSlideId,
      sleep,
      slides,
      stopPreview,
    ],
  );

  const runComposeVideo = useCallback(async () => {
    if (composeStatus === "running") {
      return;
    }
    setShowComposeModal(true);
    setComposeError(null);
    setComposeProgress(0);
    setComposedVideoUrl(null);
    setComposedVideoFilename("knowlens-compose-preview.webm");
    setComposeStatus("running");
    setComposeSteps({
      prepare: "waiting",
      tts: "waiting",
      render: "waiting",
      finalize: "waiting",
    });
    setComposeMeta(null);

    try {
      setComposeSteps((prev) => ({ ...prev, prepare: "running" }));

      const fps = 24;
      const size = { width: 1280, height: 720 };
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Could not initialize the video canvas.");
      }

      const mimeType =
        MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
          ? "video/webm;codecs=vp9,opus"
          : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
            ? "video/webm;codecs=vp8,opus"
          : "video/webm";
      const videoStream = canvas.captureStream(fps);

      const audioContext = new AudioContext({ sampleRate: 48000 });
      const outputGain = audioContext.createGain();
      outputGain.gain.value = 1;
      const mediaDest = audioContext.createMediaStreamDestination();
      outputGain.connect(mediaDest);

      const composedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...mediaDest.stream.getAudioTracks(),
      ]);
      const recorder = new MediaRecorder(composedStream, { mimeType });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      const completed = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
        recorder.onerror = () => reject(new Error("Video recording failed."));
      });

      setComposeSteps((prev) => ({ ...prev, prepare: "done", tts: "running" }));

      const sceneAssets: SceneAudioAsset[] = [];
      for (let i = 0; i < slides.length; i += 1) {
        const slide = slides[i];
        const narrationText = slide.isCover ? "" : slide.body.trim();
        const ttsId = ttsBySlideId[slide.id] ?? DEFAULT_EMOTION_TTS_ID;
        if (!narrationText) {
          sceneAssets.push({
            slideId: slide.id,
            buffer: null,
            durationSec: slide.isCover ? 2.8 : 3.4,
          });
          setComposeProgress(Math.round(((i + 1) / Math.max(1, slides.length)) * 28));
          continue;
        }
        await ensureAudioFileForSlide(slide.id, narrationText, ttsId);
        const audioBuffer = await synthesizeSceneAudioFromApi(narrationText, ttsId);
        const fallbackDuration = Math.max(
          2.6,
          Math.min(8, narrationText.length / 6 + 1.2),
        );
        const durationSec = Math.max(
          2.2,
          Math.min(14, audioBuffer?.duration ?? fallbackDuration),
        );
        sceneAssets.push({
          slideId: slide.id,
          buffer: audioBuffer,
          durationSec,
        });
        setComposeProgress(Math.round(((i + 1) / Math.max(1, slides.length)) * 28));
      }

      const totalDurationSec = sceneAssets.reduce(
        (sum, item) => sum + item.durationSec,
        0,
      );
      const voicedSceneCount = sceneAssets.filter((scene) => scene.buffer).length;
      setComposeMeta({
        fps,
        resolution: `${size.width}×${size.height}`,
        sceneCount: slides.length,
        voicedSceneCount,
        durationSec: totalDurationSec,
        format: mimeType,
        estimatedSizeMB: Number((totalDurationSec * 0.75).toFixed(1)),
      });

      setComposeSteps((prev) => ({ ...prev, tts: "done", render: "running" }));

      recorder.start(200);
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const drawFrame = (
        image: CanvasImageSource,
        slide: SlideItem,
        sceneProgress: number,
      ) => {
        ctx.fillStyle = "#0b0c0f";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const zoom = 1 + sceneProgress * 0.035;
        const baseW = 1120;
        const baseH = 630;
        const drawW = baseW * zoom;
        const drawH = baseH * zoom;
        const drawX = (canvas.width - drawW) / 2;
        const drawY = 36 - sceneProgress * 9;
        ctx.drawImage(image, drawX, drawY, drawW, drawH);
      };

      let elapsedSec = 0;

      for (let i = 0; i < slides.length; i += 1) {
        const slide = slides[i];
        const sceneAsset = sceneAssets[i];
        const generationState = generationTaskStateByIndex?.[slide.page];
        const historyImages = (imageHistoryBySlideId[slide.id] ?? []).filter(isUsableImageSrc);
        const activeIdx = activeImageIndexBySlideId[slide.id] ?? 0;
        const src = getActiveImageSrc(historyImages, activeIdx, generationState?.imageUrl);
        if (!src) {
          throw new Error(`Scene ${slide.page} image is not ready. Please retry the failed scene first.`);
        }

        const image = new window.Image();
        image.src = src;
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error(`Scene ${slide.page} image could not be loaded. Please retry this scene.`));
        });

        const sceneDuration = sceneAsset.durationSec;
        const startAt = performance.now();
        const scheduledStart = audioContext.currentTime + 0.08;

        if (sceneAsset.buffer) {
          const source = audioContext.createBufferSource();
          source.buffer = sceneAsset.buffer;
          source.connect(outputGain);
          source.start(scheduledStart);
        }

        while (true) {
          const elapsedMs = performance.now() - startAt;
          const progress = Math.min(1, elapsedMs / (sceneDuration * 1000));
          drawFrame(image, slide, progress);
          const globalSec = elapsedSec + progress * sceneDuration;
          const composePct = 28 + (globalSec / Math.max(1, totalDurationSec)) * 64;
          setComposeProgress(Math.min(96, Math.round(composePct)));
          if (progress >= 1) {
            break;
          }
          await sleep(1000 / fps);
        }
        elapsedSec += sceneDuration;
      }

      setComposeSteps((prev) => ({ ...prev, render: "done", finalize: "running" }));
      recorder.stop();
      const blob = await completed;
      await audioContext.close();
      videoStream.getTracks().forEach((track) => track.stop());
      composedStream.getTracks().forEach((track) => track.stop());

      setComposeProgress(97);
      let finalBlob = blob;
      let finalFilename = "knowlens-compose-preview.webm";
      let finalFormat = blob.type || mimeType;
      try {
        const formData = new FormData();
        formData.append(
          "video",
          new File([blob], "knowlens-compose-preview.webm", { type: mimeType }),
        );
        const transcodeResponse = await fetch("/api/export/video", {
          method: "POST",
          body: formData,
        });
        if (transcodeResponse.ok) {
          const exportedBlob = await transcodeResponse.blob();
          if (exportedBlob.size > 0) {
            finalBlob = exportedBlob;
            finalFilename = "knowlens-compose-preview.mp4";
            finalFormat = exportedBlob.type || "video/mp4";
          }
        }
      } catch {
        // 若服务端外部组件不可用，回退保留浏览器本地合成文件
      }

      if (composedVideoUrlRef.current) {
        URL.revokeObjectURL(composedVideoUrlRef.current);
      }
      const url = URL.createObjectURL(finalBlob);
      composedVideoUrlRef.current = url;
      setComposedVideoUrl(url);
      setComposedVideoFilename(finalFilename);
      setComposeMeta((prev) =>
        prev
          ? {
              ...prev,
              format: finalFormat,
              estimatedSizeMB: Number((finalBlob.size / (1024 * 1024)).toFixed(1)),
            }
          : prev,
      );
      setComposeProgress(100);
      setComposeSteps((prev) => ({ ...prev, finalize: "done" }));
      setComposeStatus("success");
    } catch (error) {
      setComposeStatus("error");
      setComposeProgress(0);
      setComposeSteps((prev) => {
        const hasRunning = Object.values(prev).some((status) => status === "running");
        if (!hasRunning) {
          return {
            prepare: "error",
            tts: "waiting",
            render: "waiting",
            finalize: "waiting",
          };
        }
        const copy = { ...prev };
        (Object.keys(copy) as ComposeStepKey[]).forEach((key) => {
          if (copy[key] === "running") {
            copy[key] = "error";
          }
        });
        return copy;
      });
      setComposeError(error instanceof Error ? error.message : "Video export failed. Please try again.");
    }
  }, [
    activeImageIndexBySlideId,
    composeStatus,
    ensureAudioFileForSlide,
    generationTaskStateByIndex,
    imageHistoryBySlideId,
    sleep,
    slides,
    synthesizeSceneAudioFromApi,
    ttsBySlideId,
  ]);

  const exportPptx = useCallback(async () => {
    if (!slides.length || isExportingPpt) {
      return;
    }

    setShowPptExportModal(true);
    if (!pptExportReady) {
      setPptExportStatus("error");
      setIsExportingPpt(false);
      setExportPptProgress(0);
      setExportPptPhase("prepare");
      setPptExportError("Some slide images are still missing. Please retry after every slide is ready.");
      setExportedPptUrl(null);
      return;
    }

    setPptExportStatus("running");
    setIsExportingPpt(true);
    setExportPptProgress(8);
    setExportPptPhase("prepare");
    setPptExportError(null);
    setExportedPptUrl(null);
    setPptDownloadNotice(null);

    try {
      const payload = slides.map((slide) => {
        const historyImages = (imageHistoryBySlideId[slide.id] ?? []).filter(isUsableImageSrc);
        const activeIdx = activeImageIndexBySlideId[slide.id] ?? 0;
        const taskState = generationTaskStateByIndex?.[slide.page];
        return {
          page: slide.page,
          title: slide.title,
          body: slide.body,
          imageSrc: getActiveImageSrc(historyImages, activeIdx, taskState?.imageUrl),
        };
      });

      setExportPptPhase("images");
      setExportPptProgress(30);

      const response = await fetch("/api/export/ppt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: slides[0]?.title?.trim() || "KnowLens Deck",
          slides: payload,
        }),
      });

      setExportPptPhase("slides");
      setExportPptProgress(66);

      if (!response.ok) {
        let message = "PPT export failed. Please try again.";
        try {
          const body = (await response.json()) as { error?: string; code?: string };
          const errorText = body.error?.trim();
          const codeText = body.code?.trim();
          message = errorText
            ? `${errorText}${codeText ? ` (${codeText})` : ""}`
            : message;
        } catch {
          message = "PPT export failed. Please try again.";
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      setExportPptPhase("file");
      setExportPptProgress(88);

      if (exportedPptUrlRef.current) {
        URL.revokeObjectURL(exportedPptUrlRef.current);
      }
      const url = URL.createObjectURL(blob);
      exportedPptUrlRef.current = url;
      setExportedPptUrl(url);
      setExportPptProgress(100);
      setExportPptPhase("done");
      setPptExportStatus("success");
      window.setTimeout(() => {
        triggerPptDownload(url);
      }, 0);
    } catch (error) {
      setPptExportError(error instanceof Error ? error.message : "PPT export failed. Please try again.");
      setPptExportStatus("error");
    } finally {
      window.setTimeout(() => {
        setIsExportingPpt(false);
      }, 420);
    }
  }, [
    activeImageIndexBySlideId,
    generationTaskStateByIndex,
    imageHistoryBySlideId,
    isExportingPpt,
    pptExportReady,
    slides,
    triggerPptDownload,
  ]);

  useEffect(() => {
    if (!onModeActionRegister) {
      return;
    }
    onModeActionRegister({
      exportPpt: () => {
        void exportPptx();
      },
      downloadVideo: () => {
        void runComposeVideo();
      },
    });
  }, [exportPptx, onModeActionRegister, runComposeVideo]);

  const validationMap = useMemo<Record<string, ValidationIssue>>(() => {
    const result: Record<string, ValidationIssue> = {};
    slides.forEach((slide) => {
      const issue: ValidationIssue = {};
      if (!slide.isCover && !slide.body.trim()) {
        issue.body = "Add narration text";
      }
      if (!slide.visual.trim()) {
        issue.visual = "Add a visual direction";
      }
      const prompt = promptBySlideId[slide.id] ?? "";
      if (!prompt.trim()) {
        issue.prompt = "Add an image prompt";
      }
      if (issue.body || issue.visual || issue.prompt) {
        result[slide.id] = issue;
      }
    });
    return result;
  }, [promptBySlideId, slides]);

  const invalidSlideIds = useMemo(() => Object.keys(validationMap), [validationMap]);
  const hasValidationErrors = invalidSlideIds.length > 0;

  const locateFirstInvalidSlide = useCallback(async () => {
    if (!invalidSlideIds.length) {
      return;
    }
    const firstId = invalidSlideIds[0];
    setSelectedSlideId(firstId);
    await focusSlide(firstId, "story", 1.02);
  }, [focusSlide, invalidSlideIds]);

  const edges = useMemo<Edge[]>(
    () => {
      if (canvasMode === "free") {
        return [];
      }
      return slides.map((slide) => ({
        id: `story-image-${slide.id}`,
        source: `story-${slide.id}`,
        target: `image-${slide.id}`,
        type: "smoothstep",
        animated: false,
        style: { stroke: "#71717a", strokeWidth: 1.4 },
      }));
    },
    [canvasMode, slides],
  );

  const nodes = useMemo<Node[]>(
    () => {
      const storyNodes = slides.map((slide, idx) => {
        const lensMode = LENS_MODES[idx % LENS_MODES.length];
        const transition = TRANSITIONS[idx % TRANSITIONS.length];
        const issue = validationMap[slide.id];
        const isSelected = selectedSlideId === slide.id;

        return {
          id: `story-${slide.id}`,
          position: { x: idx * 460, y: 44 },
          extent: [
            [-100000, 24],
            [100000, 124],
          ] as [[number, number], [number, number]],
          sourcePosition: Position.Bottom,
          style: {
            border: "none",
            background: "transparent",
            boxShadow: "none",
            padding: 0,
            width: 380,
          },
          data: {
            label: (
              <div
                className={`w-[380px] rounded-xl border bg-white p-3 shadow-sm ${
                  issue
                    ? "border-red-300 ring-1 ring-red-200"
                    : isSelected
                      ? "border-zinc-900 ring-2 ring-zinc-900/15"
                      : "border-zinc-200"
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
                    Scene {slide.page.toString().padStart(2, "0")}
                  </span>
                  <span className="text-xs text-zinc-500">Suggested duration 15-20s</span>
                </div>

                <input
                  value={slide.title}
                  onChange={(event) =>
                    updateSlide(slide.id, "title", event.target.value)
                  }
                  className="nodrag nopan nowheel w-full rounded border border-zinc-200 px-2 py-1 text-sm font-semibold leading-6 text-zinc-900 outline-none focus:border-zinc-500"
                />

                <div className="mt-3 overflow-hidden rounded-lg border border-zinc-200">
                  <div className="grid grid-cols-[86px_minmax(0,1fr)] text-xs">
                    <p className="border-b border-r border-zinc-200 bg-zinc-50 px-2 py-2 text-zinc-500">
                      Narration
                    </p>
                    <textarea
                      value={slide.body}
                      onChange={(event) =>
                        updateSlide(slide.id, "body", event.target.value)
                      }
                      className={`nodrag nopan nowheel h-20 resize-none border-b px-2 py-2 leading-5 text-zinc-700 outline-none focus:bg-zinc-50 ${
                        issue?.body ? "border-red-200 bg-red-50/40" : "border-zinc-200"
                      }`}
                    />
                    <p className="border-b border-r border-zinc-200 bg-zinc-50 px-2 py-2 text-zinc-500">
                      Visual goal
                    </p>
                    <p className="border-b border-zinc-200 px-2 py-2 leading-5 text-zinc-700">
                      Explain the core idea of "{slide.title.replace("?", "") || "this scene"}" clearly.
                    </p>
                    <p className="border-b border-r border-zinc-200 bg-zinc-50 px-2 py-2 text-zinc-500">
                      Composition
                    </p>
                    <textarea
                      value={slide.visual}
                      onChange={(event) =>
                        updateSlide(slide.id, "visual", event.target.value)
                      }
                      className={`nodrag nopan nowheel h-14 resize-none border-b px-2 py-2 leading-5 text-zinc-700 outline-none focus:bg-zinc-50 ${
                        issue?.visual ? "border-red-200 bg-red-50/40" : "border-zinc-200"
                      }`}
                    />
                    <p className="border-b border-r border-zinc-200 bg-zinc-50 px-2 py-2 text-zinc-500">
                      Camera & motion
                    </p>
                    <p className="border-b border-zinc-200 px-2 py-2 text-zinc-700">
                      {lensMode}; highlight key moments with arrows and subtle pulses.
                    </p>
                    <p className="border-b border-r border-zinc-200 bg-zinc-50 px-2 py-2 text-zinc-500">
                      On-screen text
                    </p>
                    <p className="border-b border-zinc-200 px-2 py-2 text-zinc-700">
                      Title plus 2-3 short keywords.
                    </p>
                    <p className="border-r border-zinc-200 bg-zinc-50 px-2 py-2 text-zinc-500">
                      Transition
                    </p>
                    <p className="px-2 py-2 text-zinc-700">
                      {transition}; keep a short pause before the next scene.
                    </p>
                  </div>
                </div>

                {issue ? (
                  <div className="mt-2 text-[11px] text-red-600">
                    {issue.body || issue.visual || issue.prompt}
                  </div>
                ) : null}

                <div className="mt-2 flex justify-center">
                  <button
                    type="button"
                    onClick={() => addSlideAfter(slide.id)}
                    className="nodrag nopan nowheel inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-[11px] text-zinc-700 hover:bg-zinc-100"
                  >
                    <Plus size={12} />
                    Add scene
                  </button>
                </div>
              </div>
            ),
          },
          draggable: true,
          selectable: true,
        };
      });

      const imageNodes = slides.map((slide, idx) => {
        const generationState = generationTaskStateByIndex?.[slide.page];
        const imageHistory = (imageHistoryBySlideId[slide.id] ?? []).filter(isUsableImageSrc);
        const activeImageIndex = activeImageIndexBySlideId[slide.id] ?? 0;
        const storyboardImage = getActiveImageSrc(imageHistory, activeImageIndex, generationState?.imageUrl);
        const shouldShowImageHistory = imageHistory.length > 1;
        const isGeneratingImage =
          generationState?.status === "queued" ||
          generationState?.status === "generating" ||
          generationState?.status === "retrying" ||
          (!storyboardImage && !generationState?.status && generationInProgress);
        const isGenerationFailed = generationState?.status === "failed";
        const selectedTts = ttsBySlideId[slide.id] ?? DEFAULT_EMOTION_TTS_ID;
        const selectedTtsOption =
          TTS_OPTIONS.find((item) => item.id === selectedTts) ?? TTS_OPTIONS[0];
        const generatedAudio = generatedAudioBySlideId[slide.id];
        const imagePrompt =
          promptBySlideId[slide.id] ?? buildPrompt(slide.title, slide.visual);
        const isPromptEditing = editingPromptSlideId === slide.id;
        const narrationText = slide.isCover ? "" : slide.body;
        const hasNarration = narrationText.trim().length > 0;
        const isNodeSelected = selectedSlideId === slide.id;
        const isAudioPlaying = playingAudioSlideId === slide.id;
        const isAudioPaused = pausedAudioSlideId === slide.id;
        const audioPreviewLabel = isAudioPlaying
          ? "Pause"
          : isAudioPaused
            ? "Resume"
            : "Preview";
        const audioDurationSec = Math.max(
          0,
          generatedAudio?.durationSec ||
            audioDurationBySlideId[slide.id] ||
            estimateNarrationDurationSec(narrationText),
        );
        const currentAudioSec = clamp(
          audioProgressBySlideId[slide.id] ?? 0,
          0,
          audioDurationSec || 1,
        );
        const playingProgress =
          audioDurationSec > 0 ? (currentAudioSec / audioDurationSec) * 100 : 0;
        const audioTimeLabel =
          audioDurationSec > 0
            ? `${formatDuration(currentAudioSec)} / ${formatDuration(audioDurationSec)}`
            : "00:00 / 00:00";
        const audioDurationLabel =
          audioDurationSec > 0 ? `${Math.round(audioDurationSec)}s` : "";
        const waveformScale =
          selectedTtsOption.profile === "male"
            ? 1.2
            : selectedTtsOption.profile === "youth"
              ? 0.92
              : 1;

        return {
          id: `image-${slide.id}`,
          position: { x: idx * 460, y: canvasMode === "free" ? 44 : 570 },
          extent: [
            [-100000, canvasMode === "free" ? 24 : 520],
            [100000, canvasMode === "free" ? 520 : 980],
          ] as [[number, number], [number, number]],
          targetPosition: canvasMode === "free" ? undefined : Position.Top,
          style: {
            border: "none",
            background: "transparent",
            boxShadow: "none",
            padding: 0,
            width: 380,
          },
          data: {
            label: (
              <div
                className={`w-[380px] overflow-visible rounded-xl border bg-white shadow-sm transition ${
                  activePreviewSlideId === slide.id
                    ? "border-zinc-900 ring-2 ring-zinc-900/20"
                    : isNodeSelected
                      ? "border-zinc-900 ring-1 ring-zinc-900/15"
                    : "border-zinc-200"
                }`}
              >
                <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 text-xs">
                  <span className="text-zinc-500">
                    Scene Image {slide.page.toString().padStart(2, "0")}
                    {slide.isCover ? " (Video cover)" : ""}
                  </span>
                </div>

                <div className="px-3 pt-3">
                  <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-2">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-500">
                      <span>A Track · Visual</span>
                      <span>{audioDurationLabel}</span>
                    </div>
                    {storyboardImage && !isGeneratingImage ? (
                      <div
                        className="flex w-full items-center justify-center overflow-hidden rounded bg-white"
                        style={{ aspectRatio: resolvedImageAspectRatio }}
                      >
                        <img
                          src={storyboardImage}
                          alt={`Scene ${slide.page} reference image`}
                          className="h-full w-full object-contain"
                          loading="lazy"
                        />
                      </div>
                    ) : isGenerationFailed ? (
                      <div
                        className="flex w-full items-center justify-center rounded bg-white px-4"
                        style={{ aspectRatio: resolvedImageAspectRatio }}
                      >
                        <div className="max-w-[230px] rounded-lg border border-red-100 bg-white px-4 py-3 text-center shadow-sm">
                          <div className="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-red-600">
                            <AlertCircle size={14} />
                          </div>
                          <p className="text-xs leading-5 text-zinc-700">
                            {toImageFailureSentence(generationState.error, generationState.errorCode)}
                          </p>
                          {!isGeneratingImage ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onRetryGenerationTask?.(slide.page);
                              }}
                              className="nodrag nopan nowheel mt-2 inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
                            >
                              <RotateCcw size={12} />
                              Retry
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : isGeneratingImage ? (
                      <div
                        className="flex w-full items-center justify-center rounded bg-white text-xs text-zinc-600"
                        style={{ aspectRatio: resolvedImageAspectRatio }}
                      >
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 shadow-sm">
                          <LoaderCircle size={12} className="animate-spin text-blue-500" />
                          Generating image
                        </span>
                      </div>
                    ) : (
                      <div
                        className="flex w-full items-center justify-center rounded bg-white text-xs text-zinc-400"
                        style={{ aspectRatio: resolvedImageAspectRatio }}
                      >
                        Waiting for generation
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-3 pt-3">
                  <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-2">
                    <div className="text-[11px] text-zinc-500">Scene image prompt</div>
                    {isPromptEditing ? (
                      <textarea
                        value={imagePrompt}
                        onChange={(event) =>
                          updatePromptForSlide(slide.id, event.target.value)
                        }
                        onBlur={() => setEditingPromptSlideId(null)}
                        className={`nodrag nopan nowheel mt-1 h-20 w-full resize-none rounded border bg-white px-2 py-1.5 text-[11px] leading-5 text-zinc-700 outline-none ${
                          validationMap[slide.id]?.prompt
                            ? "border-red-300"
                            : "border-zinc-300 focus:border-zinc-500"
                        }`}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingPromptSlideId(slide.id)}
                        className={`nodrag nopan nowheel mt-1 w-full rounded border bg-white px-2 py-1.5 text-left text-[11px] leading-5 text-zinc-700 hover:bg-zinc-100 ${
                          validationMap[slide.id]?.prompt
                            ? "border-red-300"
                            : "border-zinc-200"
                        }`}
                      >
                        {imagePrompt || "Click to add a scene image prompt"}
                      </button>
                    )}
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => regenerateSlideImage(slide.id, slide.page)}
                        className="nodrag nopan nowheel rounded-md border border-zinc-900 bg-zinc-900 px-2 py-1 text-[11px] text-white hover:bg-zinc-700"
                      >
                        Redraw
                      </button>
                    </div>

                    {shouldShowImageHistory ? (
                      <div className="mt-2 grid grid-cols-4 gap-1.5">
                        {imageHistory.map((historyImage, historyIdx) => (
                          <button
                            key={`${historyImage}-${historyIdx}`}
                            type="button"
                            onClick={() => selectHistoryImage(slide.id, historyIdx)}
                            className={`nodrag nopan nowheel overflow-hidden border ${
                              historyIdx === activeImageIndex
                                ? "border-zinc-900 ring-1 ring-zinc-900/30"
                                : "border-zinc-200"
                            }`}
                          >
                            <img
                              src={historyImage}
                              alt={`Scene history ${historyIdx + 1}`}
                              className="h-14 w-full object-cover"
                              loading="lazy"
                            />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="px-3 pt-3">
                  <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-2">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-500">
                      <span>Narration</span>
                      <span>{slide.isCover ? "Cover has no narration" : "Voice-over script"}</span>
                    </div>
                    <textarea
                      value={narrationText}
                      onChange={(event) =>
                        updateSlide(slide.id, "body", event.target.value)
                      }
                      placeholder={slide.isCover ? "" : "Narration for this scene..."}
                      disabled={slide.isCover}
                      className={`nodrag nopan nowheel h-20 w-full resize-none rounded border bg-white px-2 py-1.5 text-[11px] leading-5 text-zinc-700 outline-none ${
                        validationMap[slide.id]?.body
                          ? "border-red-300"
                          : "border-zinc-200 focus:border-zinc-400"
                      }`}
                    />
                  </div>
                </div>

                {hasNarration ? (
                  <div className="px-3 pb-3 pt-3">
                    <div
                      className={`rounded-md border px-2 py-2 ${
                        playingAudioSlideId === slide.id
                          ? "border-zinc-900 bg-zinc-100"
                          : "border-zinc-200 bg-zinc-50"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-500">
                        <span>B Track · Audio</span>
                        <span>{selectedTtsOption.tier === "pro" ? "Premium voice" : "Included voice"}</span>
                      </div>
                      <div className="mb-2 h-px bg-zinc-200" />

                      <div data-tts-menu-root="true" className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleAudioPreviewForSlide(slide.id, narrationText);
                          }}
                          className={`nodrag nopan nowheel inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] ${
                            isAudioPlaying
                              ? "border-zinc-900 bg-zinc-900 text-white"
                              : isAudioPaused
                                ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                          }`}
                        >
                          {isAudioPlaying ? <PauseCircle size={12} /> : <Volume2 size={12} />}
                          {audioPreviewLabel}
                        </button>
                        <div className="relative flex-1">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenTtsMenuSlideId((prev) =>
                                prev === slide.id ? null : slide.id,
                              );
                            }}
                            className="nodrag nopan nowheel inline-flex h-7 w-full items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-2 text-left text-[11px] text-zinc-800 outline-none hover:bg-zinc-50"
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {selectedTtsOption.displayName}
                            </span>
                            {selectedTtsOption.tier === "pro" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                <Crown size={10} />
                                Pro
                              </span>
                            ) : null}
                            <ChevronDown
                              size={13}
                              className={`shrink-0 text-zinc-500 transition ${
                                openTtsMenuSlideId === slide.id ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                          {openTtsMenuSlideId === slide.id ? (
                            <div
                              className="nodrag nopan nowheel absolute left-0 top-8 z-50 max-h-[420px] w-[340px] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1.5 shadow-[0_18px_35px_rgba(15,23,42,0.18)]"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {TTS_OPTIONS.map((option) => {
                                const isSelected = selectedTts === option.id;
                                const isPremiumVoice = option.provider === "openai";
                                return (
                                  <button
                                    key={option.id}
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      updateTtsForSlide(slide.id, option.id);
                                    }}
                                    className="w-full rounded-lg px-2.5 py-2 text-left transition hover:bg-zinc-100"
                                  >
                                    <span className="flex items-center justify-between gap-2 text-xs font-medium text-zinc-900">
                                      <span className="min-w-0">
                                        {option.displayName}
                                      </span>
                                      <span className="inline-flex shrink-0 items-center gap-1.5">
                                        {isPremiumVoice ? (
                                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                            <Crown size={10} />
                                            Pro
                                          </span>
                                        ) : null}
                                        {isSelected ? (
                                          <Check size={14} className="text-zinc-900" />
                                        ) : null}
                                      </span>
                                    </span>
                                    <span className="mt-1 block text-[11px] leading-4 text-zinc-500">
                                      {option.description}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-2 rounded-xl border border-zinc-200 bg-white px-2.5 py-2">
                        <div className="relative h-12 w-full overflow-hidden rounded-lg bg-zinc-50 px-3">
                          <div className="absolute inset-x-3 top-1/2 flex -translate-y-1/2 items-center justify-between gap-1">
                            {Array.from({ length: 58 }, (_, barIdx) => {
                              const phase = Math.sin((barIdx + slide.page) * 0.75);
                              const h = Math.min(24, 7 + (phase + 1) * 7 * waveformScale);
                              const isPlayed = playingProgress >= (barIdx / 58) * 100;
                              return (
                                <span
                                  key={`wave-${slide.id}-${barIdx}`}
                                  className={`block w-[3px] rounded-full transition-colors duration-300 ${
                                    isPlayed ? "bg-zinc-900" : "bg-zinc-300"
                                  }`}
                                  style={{ height: `${h}px` }}
                                />
                              );
                            })}
                          </div>
                          {generatedAudio?.status === "generating" ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-blue-600">
                              <LoaderCircle size={15} className="animate-spin" />
                            </div>
                          ) : null}
                          <div
                            className="absolute bottom-0 left-0 h-[2px] bg-blue-500 transition-[width] duration-300 ease-linear"
                            style={{ width: `${clamp(playingProgress, 0, 100)}%` }}
                          />
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-400">
                          <span>Audio preview</span>
                          <span>{audioTimeLabel}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ),
          },
          draggable: true,
          selectable: true,
        };
      });

      return canvasMode === "free" ? imageNodes : [...storyNodes, ...imageNodes];
    },
    [
      activeImageIndexBySlideId,
      activePreviewSlideId,
      addSlideAfter,
      audioDurationBySlideId,
      audioProgressBySlideId,
      canvasMode,
      editingPromptSlideId,
      generatedAudioBySlideId,
      generationInProgress,
      generationTaskStateByIndex,
      imageHistoryBySlideId,
      onRetryGenerationTask,
      openTtsMenuSlideId,
      pausedAudioSlideId,
      playingAudioSlideId,
      promptBySlideId,
      regenerateSlideImage,
      resolvedImageAspectRatio,
      selectHistoryImage,
      selectedSlideId,
      slides,
      ttsBySlideId,
      toggleAudioPreviewForSlide,
      updatePromptForSlide,
      updateSlide,
      updateTtsForSlide,
      validationMap,
    ],
  );

  useEffect(() => {
    onSaveStateChange?.(saveState, hasUnsavedChanges);
  }, [hasUnsavedChanges, onSaveStateChange, saveState]);

  useEffect(() => {
    const snapshot = JSON.stringify(present);
    const updateSaveUiState = (nextSaveState: SaveState, nextHasUnsavedChanges: boolean) => {
      window.setTimeout(() => {
        setSaveState(nextSaveState);
        setHasUnsavedChanges(nextHasUnsavedChanges);
      }, 0);
    };
    if (snapshot === lastSavedSnapshotRef.current) {
      updateSaveUiState("saved", false);
      return;
    }

    updateSaveUiState("saving", true);

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, snapshot);
        lastSavedSnapshotRef.current = snapshot;
        setSaveState("saved");
        setHasUnsavedChanges(false);
      } catch {
        setSaveState("error");
        setHasUnsavedChanges(true);
      }
    }, 420);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [present]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = event.metaKey || event.ctrlKey;
      const editableTarget = isEditableElement(event.target);

      if (command && event.key.toLowerCase() === "z") {
        if (editableTarget) {
          return;
        }
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if (editableTarget) {
        return;
      }

      if (command && event.key.toLowerCase() === "c") {
        event.preventDefault();
        copySlide();
        return;
      }

      if (command && event.key.toLowerCase() === "v") {
        event.preventDefault();
        pasteSlide();
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        if (!selectedSlideId) {
          return;
        }
        event.preventDefault();
        deleteSlide(selectedSlideId);
        return;
      }

      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        const delta = event.key === "ArrowRight" ? 1 : -1;
        goToNeighborSlide(delta);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [copySlide, deleteSlide, goToNeighborSlide, pasteSlide, redo, selectedSlideId, undo]);

  useEffect(() => {
    return () => {
      cancelPreviewRef.current = true;
      previewPauseRef.current = false;
      stopAllAudio();
      Object.values(generatedAudioRef.current).forEach((item) => {
        if (item.url?.startsWith("blob:")) {
          URL.revokeObjectURL(item.url);
        }
      });
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
      if (composedVideoUrlRef.current) {
        URL.revokeObjectURL(composedVideoUrlRef.current);
      }
      if (exportedPptUrlRef.current) {
        URL.revokeObjectURL(exportedPptUrlRef.current);
      }
    };
  }, [stopAllAudio]);

  return (
    <section className="h-full min-h-0 overflow-hidden rounded-none border border-zinc-200 bg-white">
      <div className="relative h-full min-h-0">
        {canvasMode === "free" ? (
          <div className="absolute left-3 top-3 z-30 flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2 py-1 shadow-sm">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-35"
            title="Undo (Ctrl/Cmd+Z)"
          >
            <RotateCcw size={13} />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-35"
            title="Redo (Shift+Ctrl/Cmd+Z)"
          >
            <Redo2 size={13} />
          </button>
          <div className="h-4 w-px bg-zinc-200" />
            <button
              type="button"
              onClick={copySlide}
              className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs text-zinc-600 hover:bg-zinc-100"
              title="Copy scene (Ctrl/Cmd+C)"
          >
              <Copy size={12} />
              Copy
            </button>
            <button
              type="button"
              onClick={() => {
                reactFlowRef.current?.fitView({
                  duration: 260,
                  padding: 0.2,
                });
              }}
              className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs text-zinc-600 hover:bg-zinc-100"
              title="Fit canvas"
            >
              Fit
            </button>
            <button
              type="button"
              onClick={() => {
                void focusSelectedSlide();
              }}
              disabled={!selectedSlideId}
              className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
              title="Locate current scene"
            >
              <LocateFixed size={12} />
              Locate
            </button>
          </div>
        ) : null}

        {canvasMode === "free" ? (
          <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2">
          <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-white/95 px-2 py-2 shadow-[0_12px_30px_rgba(15,23,42,0.18)] backdrop-blur">
            <button
              type="button"
              onClick={() => runPreview(false)}
              className="inline-flex h-9 items-center gap-1 rounded-full bg-zinc-900 px-4 text-xs font-medium text-white hover:bg-zinc-700"
            >
              <PlayCircle size={14} />
              {isPreviewing ? "Stop Preview" : "Preview Video"}
            </button>

            <button
              type="button"
              onClick={isPreviewPaused ? resumePreview : pausePreview}
              disabled={!isPreviewing}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-zinc-300 bg-white px-4 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <PauseCircle size={14} />
              {isPreviewPaused ? "Resume" : "Pause"}
            </button>

          </div>
        </div>
        ) : null}

        <ReactFlow
          onInit={(instance) => {
            reactFlowRef.current = instance;
          }}
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.18, minZoom: 0.4 }}
          snapToGrid
          snapGrid={[460, 10]}
          minZoom={0.34}
          maxZoom={1.9}
          defaultViewport={{ x: 0, y: 0, zoom: 0.56 }}
          nodesDraggable={isCanvasInteractive}
          panOnDrag={isCanvasInteractive}
          panOnScroll={isCanvasInteractive}
          panOnScrollMode={PanOnScrollMode.Horizontal}
          zoomOnScroll={false}
          zoomOnPinch={isCanvasInteractive}
          onlyRenderVisibleElements
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, node) => {
            const slideId = getSlideIdFromNodeId(node.id);
            setSelectedSlideId(slideId);
          }}
          onPaneClick={() => setSelectedSlideId(null)}
        >
          {canvasMode === "free" ? (
            <MiniMap
            pannable
            zoomable
            style={{
              background: "#ffffff",
              border: "1px solid #e4e4e7",
              width: 170,
              height: 102,
            }}
            nodeColor="#a1a1aa"
            maskColor="rgba(228, 228, 231, 0.42)"
            />
          ) : null}
          {canvasMode === "free" ? (
            <Controls
            style={{ background: "#ffffff", border: "1px solid #e4e4e7", color: "#27272a" }}
            />
          ) : null}
        </ReactFlow>

        {canvasMode === "ppt" ? (
          <div className="absolute inset-0 z-20 overflow-y-auto bg-white">
            <div className="mx-auto w-full max-w-[1100px] px-3 py-3">
              <div className="space-y-4">
                {slides.map((slide) => {
                  const historyImages = (imageHistoryBySlideId[slide.id] ?? []).filter(isUsableImageSrc);
                  const activeIdx = activeImageIndexBySlideId[slide.id] ?? 0;
                  const generationState = generationTaskStateByIndex?.[slide.page];
                  const currentImage = getActiveImageSrc(historyImages, activeIdx, generationState?.imageUrl);
                  const isActive = selectedSlideId === slide.id;
                  const shouldShowHistory = historyImages.length > 1;
                  const isGenerating =
                    generationState?.status === "queued" ||
                    generationState?.status === "generating" ||
                    generationState?.status === "retrying" ||
                    (!currentImage && !generationState?.status && generationInProgress);
                  const isGenerationFailed = generationState?.status === "failed";
                  const pageContent = [
                    slide.title.trim(),
                    slide.body.trim(),
                    slide.visual.trim() ? `Visual structure: ${slide.visual.trim()}` : "",
                  ]
                    .filter(Boolean)
                    .join("\n");
                  return (
                    <section
                      key={`ppt-page-flow-${slide.id}`}
                      className={`rounded-lg border bg-white p-3 ${
                        isActive ? "border-zinc-900 ring-2 ring-zinc-900/10" : "border-zinc-200"
                      }`}
                      onClick={() => setSelectedSlideId(slide.id)}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-medium text-zinc-600">
                          Slide {slide.page} / {slides.length}
                        </p>
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" aria-hidden="true" />
                            Editing
                          </span>
                        ) : null}
                      </div>

                      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-md border border-zinc-200 bg-white">
                        {currentImage && !isGenerating ? (
                          <img
                            src={currentImage}
                            alt={`PPT preview slide ${slide.page}`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : null}
                        {isGenerating ? (
                          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white">
                            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-700 shadow-sm">
                              <LoaderCircle size={12} className="animate-spin text-blue-500" />
                              Generating image (2-3 min)
                            </div>
                          </div>
                        ) : null}
                        {isGenerationFailed ? (
                          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 px-4 backdrop-blur-[1px]">
                            <div className="max-w-[250px] rounded-lg border border-red-100 bg-white px-4 py-3 text-center shadow-sm">
                              <div className="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-red-600">
                                <AlertCircle size={14} />
                              </div>
                              <p className="text-xs leading-5 text-zinc-700">
                                {toImageFailureSentence(generationState.error, generationState.errorCode)}
                              </p>
                              {!isGenerating ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    regenerateSlideImage(slide.id, slide.page);
                                  }}
                                  className="mt-2 inline-flex h-8 items-center gap-1 rounded-md bg-zinc-900 px-3 text-xs text-white hover:bg-zinc-700"
                                >
                                  <RotateCcw size={12} />
                                  Retry
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                        {slide.page === 1 && !slide.isCover && currentImage && !isGenerating && !isGenerationFailed ? (
                          <div className="absolute inset-0">
                            <textarea
                              value={slide.coverTitle || slide.title}
                              onChange={(event) =>
                                updateSlideField(slide.id, "coverTitle", event.target.value)
                              }
                              className="absolute left-[8%] top-[18%] w-[84%] resize-none border-none bg-transparent text-center font-semibold leading-tight text-white outline-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]"
                              style={{ fontSize: `${slide.coverTitleSize ?? 50}px` }}
                              rows={2}
                            />
                            <textarea
                              value={slide.coverSubtitle || "Science presentation"}
                              onChange={(event) =>
                                updateSlideField(slide.id, "coverSubtitle", event.target.value)
                              }
                              className="absolute left-[12%] top-[32%] w-[76%] resize-none border-none bg-transparent text-center text-white/95 outline-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
                              style={{ fontSize: `${slide.coverSubtitleSize ?? 22}px` }}
                              rows={2}
                            />
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-2">
                        <div className="mb-1.5 flex items-center justify-between">
                          <p className="text-[11px] text-zinc-600">Page content</p>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                regenerateSlideImage(slide.id, slide.page);
                              }}
                              className="h-7 rounded-md border border-zinc-900 bg-zinc-900 px-2 text-[11px] text-white hover:bg-zinc-700"
                            >
                              Redraw
                            </button>
                          </div>
                        </div>
                        <textarea
                          value={pageContent || "Waiting for page content..."}
                          readOnly
                          className="h-24 w-full resize-none rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs leading-5 text-zinc-700 outline-none"
                        />
                        {shouldShowHistory ? (
                          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                            {historyImages.map((historyImage, historyIdx) => (
                              <button
                                key={`ppt-history-${slide.id}-${historyImage}-${historyIdx}`}
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  selectHistoryImage(slide.id, historyIdx);
                                }}
                                className={`w-[72px] shrink-0 overflow-hidden border ${
                                  historyIdx === activeIdx
                                    ? "border-zinc-900 ring-1 ring-zinc-900/30"
                                    : "border-zinc-200"
                                }`}
                              >
                                <img
                                  src={historyImage}
                                  alt={`PPT history image ${historyIdx + 1}`}
                                  className="h-[52px] w-full object-cover"
                                  loading="lazy"
                                />
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </section>
                  );
                })}
              </div>

            </div>
          </div>
        ) : null}

        {isPreviewing && previewFrame?.imageSrc ? (
          <div className="pointer-events-none absolute inset-0 z-20 bg-black">
            <div className="relative h-full w-full">
              <img
                src={previewFrame.imageSrc}
                alt={`Preview scene ${previewFrame.page}`}
                className="h-full w-full object-contain"
              />
              <div className="absolute left-4 top-4 rounded-lg bg-black/55 px-3 py-1.5 text-xs text-white">
                Scene {previewFrame.page} · {previewFrame.title}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {showComposeModal ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-zinc-900/28 p-4 backdrop-blur-[1px]">
          <div className="w-[min(520px,calc(100vw-32px))] rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_22px_50px_rgba(15,23,42,0.22)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Download Video</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  {composeStatus === "success"
                    ? "Your video file is ready to download."
                    : composeStatus === "error"
                      ? "Please fix the issue below and retry."
                      : "Preparing your video file."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (composeStatus === "running") {
                    return;
                  }
                  setShowComposeModal(false);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 text-zinc-500 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={composeStatus === "running"}
                aria-label="Close download dialog"
              >
                <X size={15} />
              </button>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white px-3 py-3">
              <div className="flex items-center justify-between text-sm text-zinc-700">
                <div className="flex items-center gap-2">
                  {composeStatus === "running" ? (
                    <LoaderCircle className="animate-spin" size={16} />
                  ) : composeStatus === "success" ? (
                    <CheckCircle2 size={16} className="text-emerald-600" />
                  ) : composeStatus === "error" ? (
                    <AlertCircle size={16} className="text-red-500" />
                  ) : null}
                  <span
                    className={
                      composeStatus === "error" ? "text-red-600" : "text-zinc-700"
                    }
                  >
                    {composeStatus === "success"
                      ? "Video file is ready. If the browser does not start downloading, click Download Video again."
                      : composeStatus === "error"
                        ? composeError || "Video export failed. Please retry."
                        : composeLoadingHint}
                  </span>
                </div>
                <span className="text-xs font-medium text-zinc-500">{composeProgress}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200">
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ${
                    composeStatus === "error" ? "bg-red-500" : "bg-zinc-900"
                  }`}
                  style={{ width: `${composeProgress}%` }}
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              {composeStatus === "error" ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowComposeModal(false)}
                    className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-600 hover:bg-zinc-100"
                  >
                    Back to editor
                  </button>
                  <button
                    type="button"
                    onClick={runComposeVideo}
                    className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-2 text-xs text-white hover:bg-blue-500"
                  >
                    Retry Download
                  </button>
                </>
              ) : null}

              {composeStatus === "success" && composedVideoUrl ? (
                  <a
                    href={composedVideoUrl}
                    download={composedVideoFilename}
                    className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500"
                  >
                    <Download size={13} />
                    Download Video
                  </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {showPptExportModal ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-zinc-900/28 p-4 backdrop-blur-[1px]">
          <div className="w-[min(520px,calc(100vw-32px))] rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_22px_50px_rgba(15,23,42,0.22)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Download PPT</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  {pptExportStatus === "success"
                    ? "Your PPT file is ready to download."
                    : pptExportStatus === "error"
                      ? "Please fix the issue below and retry."
                      : "Preparing your PPT file."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (pptExportStatus === "running") {
                    return;
                  }
                  setShowPptExportModal(false);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 text-zinc-500 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={pptExportStatus === "running"}
                aria-label="Close export dialog"
              >
                <X size={15} />
              </button>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white px-3 py-3">
              <div className="flex items-center justify-between text-sm text-zinc-700">
                <div className="flex items-center gap-2">
                  {pptExportStatus === "running" ? (
                    <LoaderCircle className="animate-spin" size={16} />
                  ) : pptExportStatus === "success" ? (
                    <CheckCircle2 size={16} className="text-emerald-600" />
                  ) : pptExportStatus === "error" ? (
                    <AlertCircle size={16} className="text-red-500" />
                  ) : null}
                  <span
                    className={
                      pptExportStatus === "error" ? "text-red-600" : "text-zinc-700"
                    }
                  >
                    {exportPptHint}
                  </span>
                </div>
                <span className="text-xs font-medium text-zinc-500">{exportPptProgress}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200">
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ${
                    pptExportStatus === "error" ? "bg-red-500" : "bg-zinc-900"
                  }`}
                  style={{ width: `${exportPptProgress}%` }}
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              {pptExportStatus === "error" ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowPptExportModal(false)}
                    className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-600 hover:bg-zinc-100"
                  >
                    Back to editor
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void exportPptx();
                    }}
                    className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-2 text-xs text-white hover:bg-blue-500"
                  >
                    Retry Download
                  </button>
                </>
              ) : null}

              {pptExportStatus === "success" && exportedPptUrl ? (
                <button
                  type="button"
                  onClick={() => {
                    triggerPptDownload();
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500"
                >
                  <Download size={13} />
                  Download PPT
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
