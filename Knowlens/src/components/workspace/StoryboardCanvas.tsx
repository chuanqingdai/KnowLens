"use client";

import "@xyflow/react/dist/style.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
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

const LENS_MODES = ["广角建立镜头", "剖面特写", "流程箭头跟拍", "对比双画面"];
const TRANSITIONS = ["溶解", "推镜", "平移", "淡入淡出"];
const CASE_IMAGES = Array.from({ length: 36 }, (_, idx) => `/case/${idx + 1}.png`);

function isUsableImageSrc(src?: string | null) {
  const value = (src || "").trim();
  return Boolean(value) && value !== "undefined" && value !== "null";
}

function getActiveImageSrc(history: string[] | undefined, activeIndex: number, fallback?: string) {
  const safeHistory = (history ?? []).filter(isUsableImageSrc);
  return safeHistory[activeIndex] ?? safeHistory[0] ?? (isUsableImageSrc(fallback) ? fallback : "");
}

const TTS_OPTIONS = [
  { id: "openai-alloy", label: "Alloy", profile: "neutral" },
  { id: "openai-nova", label: "Nova", profile: "female" },
  { id: "azure-yunxi", label: "云希", profile: "female" },
  { id: "elevenlabs-adam", label: "Adam", profile: "male" },
  { id: "doubao-teen", label: "知新", profile: "youth" },
];

const DEFAULT_EMOTION_TTS_ID = "doubao-teen";
const COMPOSE_STEPS: { key: ComposeStepKey; title: string; description: string }[] = [
  {
    key: "prepare",
    title: "Prepare export",
    description: "Set up the canvas, encoder, and output settings.",
  },
  {
    key: "tts",
    title: "Prepare narration",
    description: "Create or load narration audio for each scene.",
  },
  {
    key: "render",
    title: "Render scenes",
    description: "Render each storyboard image with its audio track.",
  },
  {
    key: "finalize",
    title: "Finalize file",
    description: "Package the final downloadable video preview.",
  },
];

function buildPrompt(title: string, visual: string) {
  return `${title}，科普教学插画，构图清晰，知识图解风，16:9，重点表现：${visual}`;
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
  const baseSlides = buildSlides(seedSlides.length ? seedSlides : buildSeedSlides(1));
  return {
    version: 1,
    slides: baseSlides,
    ttsBySlideId: Object.fromEntries(
      baseSlides.map((slide) => [slide.id, DEFAULT_EMOTION_TTS_ID]),
    ),
    promptBySlideId: Object.fromEntries(
      baseSlides.map((slide) => [slide.id, buildPrompt(slide.title, slide.visual)]),
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
    ttsBySlideId[slide.id] =
      state.ttsBySlideId[slide.id] ?? DEFAULT_EMOTION_TTS_ID;
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
  onModeActionRegister,
}: StoryboardCanvasProps) {
  const reactFlowRef = useRef<ReactFlowInstance<Node, Edge> | null>(null);
  const cancelPreviewRef = useRef(false);
  const audioTokenRef = useRef(0);
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
  const [audioProgressBySlideId, setAudioProgressBySlideId] = useState<
    Record<string, number>
  >({});
  const [generatedAudioBySlideId, setGeneratedAudioBySlideId] = useState<
    Record<string, GeneratedAudioMeta>
  >({});
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

  const present = history.present;
  const slides = present.slides;
  const ttsBySlideId = present.ttsBySlideId;
  const promptBySlideId = present.promptBySlideId;
  const imageHistoryBySlideId = present.imageHistoryBySlideId;
  const activeImageIndexBySlideId = present.activeImageIndexBySlideId;
  const historyOpenBySlideId = present.historyOpenBySlideId;

  const canvasMode: CanvasMode = canvasModeExternal ?? "free";
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
      return "Ready to download.";
    }
    return "Preparing export...";
  }, [pptDownloadNotice, pptExportError, exportPptPhase, pptExportStatus]);

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
      setPlayingAudioSlideId(slideId);
      setAudioProgressBySlideId((prev) => ({ ...prev, [slideId]: 0 }));

      if (!("speechSynthesis" in window)) {
        for (let pct = 0; pct <= 100; pct += 8) {
          if (token !== audioTokenRef.current) {
            return;
          }
          setAudioProgressBySlideId((prev) => ({ ...prev, [slideId]: pct }));
          await sleep(140);
        }
        setPlayingAudioSlideId(null);
        return;
      }

      window.speechSynthesis.cancel();

      await new Promise<void>((resolve) => {
        const selectedProfile =
          TTS_OPTIONS.find((item) => item.id === ttsId)?.profile ?? "neutral";
        const utterance = new SpeechSynthesisUtterance(
          text || "请先填写旁白文案，再试听音轨。",
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

        const fallbackTimer = window.setInterval(() => {
          setAudioProgressBySlideId((prev) => {
            const current = prev[slideId] ?? 0;
            const next = current >= 96 ? 96 : current + 6;
            return { ...prev, [slideId]: next };
          });
        }, 200);

        utterance.onboundary = (event) => {
          if (token !== audioTokenRef.current) {
            return;
          }
          const total = Math.max(1, utterance.text.length);
          const pct = Math.min(100, Math.round((event.charIndex / total) * 100));
          setAudioProgressBySlideId((prev) => ({ ...prev, [slideId]: pct }));
        };

        utterance.onend = () => {
          window.clearInterval(fallbackTimer);
          setAudioProgressBySlideId((prev) => ({ ...prev, [slideId]: 100 }));
          resolve();
        };

        utterance.onerror = () => {
          window.clearInterval(fallbackTimer);
          resolve();
        };

        window.speechSynthesis.speak(utterance);
      });

      if (token === audioTokenRef.current) {
        setPlayingAudioSlideId(null);
      }
    },
    [sleep],
  );

  const stopAllAudio = useCallback(() => {
    audioTokenRef.current += 1;
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setPlayingAudioSlideId(null);
  }, []);

  const normalizeTtsToLocalVoice = useCallback((ttsId: string) => {
    const isZhVoice = /yunxi|doubao|zh|cn/i.test(ttsId);
    if (isZhVoice) {
      return "Ting-Ting";
    }
    if (/nova/i.test(ttsId)) {
      return "Samantha";
    }
    if (/adam/i.test(ttsId)) {
      return "Daniel";
    }
    return "Samantha";
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
          voice: normalizeTtsToLocalVoice(ttsId),
        }),
      });

      if (!response.ok) {
        throw new Error("TTS 生成失败");
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
    [normalizeTtsToLocalVoice],
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
        throw new Error("请先填写旁白文案");
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
          voice: normalizeTtsToLocalVoice(ttsId),
        }),
      });
      if (!response.ok) {
        throw new Error("音轨生成失败");
      }

      const audioBlob = await response.blob();
      const nextUrl = URL.createObjectURL(audioBlob);
      const durationSec = await getAudioDurationFromBlob(audioBlob);

      setGeneratedAudioBySlideId((prev) => {
        const oldUrl = prev[slideId]?.url;
        if (oldUrl && oldUrl.startsWith("blob:") && oldUrl !== nextUrl) {
          URL.revokeObjectURL(oldUrl);
        }
        return {
          ...prev,
          [slideId]: {
            url: nextUrl,
            durationSec: durationSec || Math.max(2.2, Math.min(12, body.length / 8)),
            status: "ready",
          },
        };
      });

      return {
        url: nextUrl,
        durationSec: durationSec || Math.max(2.2, Math.min(12, body.length / 8)),
        status: "ready" as const,
      };
    },
    [generatedAudioBySlideId, getAudioDurationFromBlob, normalizeTtsToLocalVoice],
  );

  const previewAudioForSlide = useCallback(
    async (slideId: string, body: string) => {
      const ttsId = ttsBySlideId[slideId] ?? DEFAULT_EMOTION_TTS_ID;
      try {
        await ensureAudioFileForSlide(slideId, body, ttsId);
      } catch (error) {
        setGeneratedAudioBySlideId((prev) => ({
          ...prev,
          [slideId]: {
            url: prev[slideId]?.url ?? "",
            durationSec: prev[slideId]?.durationSec ?? 0,
            status: "error",
            error: error instanceof Error ? error.message : "音轨生成失败",
          },
        }));
      }
      await playTtsWithProgress(slideId, body, ttsId);
    },
    [ensureAudioFileForSlide, playTtsWithProgress, ttsBySlideId],
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
          title: "新分镜标题",
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
            [newId]: buildPrompt("新分镜标题", "待补充视觉描述"),
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

  const toggleHistoryPanel = useCallback(
    (slideId: string) => {
      commitChange((prev) => ({
        ...prev,
        historyOpenBySlideId: {
          ...prev.historyOpenBySlideId,
          [slideId]: !prev.historyOpenBySlideId[slideId],
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
      commitChange((prev) => ({
        ...prev,
        ttsBySlideId: {
          ...prev.ttsBySlideId,
          [slideId]: ttsId,
        },
      }));
    },
    [commitChange],
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
        const ttsId = ttsBySlideId[slide.id] ?? DEFAULT_EMOTION_TTS_ID;
        await ensureAudioFileForSlide(slide.id, slide.body, ttsId);
        const audioBuffer = await synthesizeSceneAudioFromApi(slide.body, ttsId);
        const fallbackDuration = Math.max(
          2.6,
          Math.min(8, slide.body.trim().length / 6 + 1.2),
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
    } catch (error) {
      setPptExportError(error instanceof Error ? error.message : "PPT export failed. Please try again.");
      setPptExportStatus("error");
    } finally {
      window.setTimeout(() => {
        setIsExportingPpt(false);
      }, 420);
    }
  }, [activeImageIndexBySlideId, generationTaskStateByIndex, imageHistoryBySlideId, isExportingPpt, pptExportReady, slides]);

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
      if (!slide.body.trim()) {
        issue.body = "请补充旁白文案";
      }
      if (!slide.visual.trim()) {
        issue.visual = "请补充视觉构图";
      }
      const prompt = promptBySlideId[slide.id] ?? "";
      if (!prompt.trim()) {
        issue.prompt = "请补充分镜提示词";
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
    () =>
      slides.map((slide) => ({
        id: `story-image-${slide.id}`,
        source: `story-${slide.id}`,
        target: `image-${slide.id}`,
        type: "smoothstep",
        animated: false,
        style: { stroke: "#71717a", strokeWidth: 1.4 },
      })),
    [slides],
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
                    分镜 {slide.page.toString().padStart(2, "0")}
                  </span>
                  <span className="text-xs text-zinc-500">建议时长 15-20 秒</span>
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
                      旁白文案
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
                      画面目标
                    </p>
                    <p className="border-b border-zinc-200 px-2 py-2 leading-5 text-zinc-700">
                      讲清“{slide.title.replace("？", "") || "当前主题"}”的核心机制，便于课堂理解。
                    </p>
                    <p className="border-b border-r border-zinc-200 bg-zinc-50 px-2 py-2 text-zinc-500">
                      视觉构图
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
                      镜头与动效
                    </p>
                    <p className="border-b border-zinc-200 px-2 py-2 text-zinc-700">
                      {lensMode}，关键节点使用箭头与高亮脉冲提示。
                    </p>
                    <p className="border-b border-r border-zinc-200 bg-zinc-50 px-2 py-2 text-zinc-500">
                      屏幕文字
                    </p>
                    <p className="border-b border-zinc-200 px-2 py-2 text-zinc-700">
                      标题 + 2-3 条关键词（每条不超过 14 字）
                    </p>
                    <p className="border-r border-zinc-200 bg-zinc-50 px-2 py-2 text-zinc-500">
                      转场
                    </p>
                    <p className="px-2 py-2 text-zinc-700">
                      {transition}，进入下一页前保留 0.4 秒停顿。
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
                    添加分镜内容
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
        const historyOpen = historyOpenBySlideId[slide.id] ?? false;
        const isGeneratingImage =
          generationState?.status === "queued" ||
          generationState?.status === "generating" ||
          generationState?.status === "retrying" ||
          (!storyboardImage && !generationState?.status && generationInProgress);
        const isGenerationFailed = generationState?.status === "failed";
        const selectedTts = ttsBySlideId[slide.id] ?? DEFAULT_EMOTION_TTS_ID;
        const selectedTtsOption =
          TTS_OPTIONS.find((item) => item.id === selectedTts) ?? TTS_OPTIONS[0];
        const audioFile = `scene-${slide.page.toString().padStart(2, "0")}-${selectedTts}.mp3`;
        const audioDuration = `${14 + (idx % 4) * 2}s`;
        const imagePrompt =
          promptBySlideId[slide.id] ?? buildPrompt(slide.title, slide.visual);
        const isPromptEditing = editingPromptSlideId === slide.id;
        const hasNarration = slide.body.trim().length > 0;
        const isNodeSelected = selectedSlideId === slide.id;
        const playingProgress = clamp(audioProgressBySlideId[slide.id] ?? 0, 0, 100);
        const waveformScale =
          selectedTtsOption.profile === "male"
            ? 1.2
            : selectedTtsOption.profile === "youth"
              ? 0.92
              : 1;

        return {
          id: `image-${slide.id}`,
          position: { x: idx * 460, y: 570 },
          extent: [
            [-100000, 520],
            [100000, 980],
          ] as [[number, number], [number, number]],
          targetPosition: Position.Top,
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
                className={`w-[380px] overflow-hidden rounded-xl border bg-white shadow-sm transition ${
                  activePreviewSlideId === slide.id
                    ? "border-zinc-900 ring-2 ring-zinc-900/20"
                    : isNodeSelected
                      ? "border-zinc-900 ring-1 ring-zinc-900/15"
                    : "border-zinc-200"
                }`}
              >
                <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 text-xs">
                  <span className="text-zinc-500">分镜图片 {slide.page.toString().padStart(2, "0")}</span>
                  <span className="text-zinc-400">版本 v{activeImageIndex + 1}</span>
                </div>

                <div className="px-3 pt-3">
                  <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-2">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-500">
                      <span>A 轴 · 画面轨</span>
                      <span>{audioDuration}</span>
                    </div>
                    {storyboardImage && !isGeneratingImage ? (
                      <img
                        src={storyboardImage}
                        alt={`分镜${slide.page}参考图`}
                        className="h-[212px] w-full rounded object-cover"
                        loading="lazy"
                      />
                    ) : isGenerationFailed ? (
                      <div className="flex h-[212px] w-full items-center justify-center rounded bg-white px-4">
                        <div className="max-w-[230px] rounded-lg border border-red-100 bg-white px-4 py-3 text-center shadow-sm">
                          <div className="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-red-600">
                            <AlertCircle size={14} />
                          </div>
                          <p className="text-xs leading-5 text-zinc-700">
                            {toImageFailureSentence(generationState.error, generationState.errorCode)}
                          </p>
                          {!generationInProgress ? (
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
                      <div className="flex h-[212px] w-full items-center justify-center rounded bg-white text-xs text-zinc-600">
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 shadow-sm">
                          <LoaderCircle size={12} className="animate-spin text-blue-500" />
                          Generating image
                        </span>
                      </div>
                    ) : (
                      <div className="flex h-[212px] w-full items-center justify-center rounded bg-white text-xs text-zinc-400">
                        Waiting for generation
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-3 pt-3">
                  <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-2">
                    <div className="text-[11px] text-zinc-500">分镜图片提示词</div>
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
                        {imagePrompt || "点击补充分镜提示词"}
                      </button>
                    )}
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => toggleHistoryPanel(slide.id)}
                        className="nodrag nopan nowheel rounded-md border border-zinc-300 bg-white px-2 py-1 text-[11px] text-zinc-700 hover:bg-zinc-100"
                      >
                        {historyOpen ? "收起历史" : "查看历史"}
                      </button>
                      <button
                        type="button"
                        onClick={() => regenerateSlideImage(slide.id, slide.page)}
                        className="nodrag nopan nowheel rounded-md border border-zinc-900 bg-zinc-900 px-2 py-1 text-[11px] text-white hover:bg-zinc-700"
                      >
                        重新绘制
                      </button>
                    </div>

                    {historyOpen ? (
                      <div className="mt-2 grid grid-cols-4 gap-1.5">
                        {imageHistory.map((historyImage, historyIdx) => (
                          <button
                            key={`${historyImage}-${historyIdx}`}
                            type="button"
                            onClick={() => selectHistoryImage(slide.id, historyIdx)}
                            className={`nodrag nopan nowheel overflow-hidden rounded border ${
                              historyIdx === activeImageIndex
                                ? "border-zinc-900 ring-1 ring-zinc-900/30"
                                : "border-zinc-200"
                            }`}
                          >
                            <img
                              src={historyImage}
                              alt={`历史分镜${historyIdx + 1}`}
                              className="h-14 w-full object-cover"
                              loading="lazy"
                            />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="px-3 pb-3 pt-3">
                  <div
                    className={`rounded-md border px-2 py-2 ${
                      playingAudioSlideId === slide.id
                        ? "border-zinc-900 bg-zinc-100"
                        : "border-zinc-200 bg-zinc-50"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-500">
                      <span>B 轴 · 音频轨</span>
                      <span>{audioFile}</span>
                    </div>
                    <div className="mb-2 h-px bg-zinc-200" />

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => previewAudioForSlide(slide.id, slide.body)}
                        className={`nodrag nopan nowheel inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] ${
                          playingAudioSlideId === slide.id
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                        }`}
                      >
                        <Volume2 size={12} />
                        {playingAudioSlideId === slide.id ? "播放中" : "试听"}
                      </button>
                      <select
                        value={selectedTts}
                        onChange={(event) =>
                          updateTtsForSlide(slide.id, event.target.value)
                        }
                        className="nodrag nopan nowheel h-7 flex-1 rounded-md border border-zinc-200 bg-white px-2 text-[11px] text-zinc-700 outline-none focus:border-zinc-400"
                      >
                        {TTS_OPTIONS.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-2 h-12 rounded-md border border-zinc-200 bg-white px-2 py-1.5">
                      <svg viewBox="0 0 320 44" className="h-full w-full">
                        {Array.from({ length: 54 }, (_, barIdx) => {
                          const x = 2 + barIdx * 5.8;
                          const phase = Math.sin((barIdx + slide.page) * 0.7);
                          const ampBase = 6 + (phase + 1) * 8;
                          const h = Math.min(30, ampBase * waveformScale);
                          const y = 22 - h / 2;
                          const barProgressStart = (barIdx / 54) * 100;
                          const isPlayed = playingProgress >= barProgressStart;
                          return (
                            <rect
                              key={`bar-${slide.id}-${barIdx}`}
                              x={x}
                              y={y}
                              width="3.4"
                              height={h}
                              rx="1.4"
                              fill={isPlayed ? "#111827" : barIdx % 3 === 0 ? "#71717a" : "#a1a1aa"}
                            />
                          );
                        })}
                        <line
                          x1={Math.min(318, Math.max(2, (playingProgress / 100) * 320))}
                          y1="2"
                          x2={Math.min(318, Math.max(2, (playingProgress / 100) * 320))}
                          y2="42"
                          stroke={playingAudioSlideId === slide.id ? "#0f172a" : "#9ca3af"}
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-400">
                      <span>{hasNarration ? audioDuration : "请先填写旁白后自动生成音轨"}</span>
                      <span>{Math.round(playingProgress)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            ),
          },
          draggable: true,
          selectable: true,
        };
      });

      return [...storyNodes, ...imageNodes];
    },
    [
      activeImageIndexBySlideId,
      activePreviewSlideId,
      addSlideAfter,
      audioProgressBySlideId,
      editingPromptSlideId,
      generationInProgress,
      generationTaskStateByIndex,
      historyOpenBySlideId,
      imageHistoryBySlideId,
      onRetryGenerationTask,
      playingAudioSlideId,
      previewAudioForSlide,
      promptBySlideId,
      regenerateSlideImage,
      selectHistoryImage,
      selectedSlideId,
      slides,
      ttsBySlideId,
      toggleHistoryPanel,
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
            title="撤销 (Ctrl/Cmd+Z)"
          >
            <RotateCcw size={13} />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-35"
            title="重做 (Shift+Ctrl/Cmd+Z)"
          >
            <Redo2 size={13} />
          </button>
          <div className="h-4 w-px bg-zinc-200" />
            <button
              type="button"
              onClick={copySlide}
              className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs text-zinc-600 hover:bg-zinc-100"
              title="复制分镜 (Ctrl/Cmd+C)"
          >
              <Copy size={12} />
              复制
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
              title="适配全画布"
            >
              适配画布
            </button>
            <button
              type="button"
              onClick={() => {
                void focusSelectedSlide();
              }}
              disabled={!selectedSlideId}
              className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
              title="定位当前分镜"
            >
              <LocateFixed size={12} />
              定位当前
            </button>
          </div>
        ) : null}

        {canvasMode === "free" ? (
          <div className="absolute right-3 top-3 z-30 rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-sm">
          <div className="flex items-center gap-2 text-xs">
            {hasValidationErrors ? (
              <>
                <AlertCircle size={13} className="text-red-500" />
                <span className="text-red-600">待完善 {invalidSlideIds.length} 项</span>
                <button
                  type="button"
                  onClick={locateFirstInvalidSlide}
                  className="rounded-md border border-red-200 px-2 py-1 text-red-600 hover:bg-red-50"
                >
                  定位缺失项
                </button>
              </>
            ) : (
              <>
                <CheckCircle2 size={13} className="text-emerald-600" />
                <span className="text-zinc-600">校验通过，可继续生成</span>
              </>
            )}
          </div>
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
              {isPreviewing ? "停止预览" : "预览视频"}
            </button>

            <button
              type="button"
              onClick={isPreviewPaused ? resumePreview : pausePreview}
              disabled={!isPreviewing}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-zinc-300 bg-white px-4 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <PauseCircle size={14} />
              {isPreviewPaused ? "继续" : "暂停"}
            </button>

            <button
              type="button"
              onClick={() => runPreview(true)}
              className="inline-flex h-9 items-center rounded-full border border-zinc-300 bg-white px-4 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
            >
              从当前分镜预览
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
                  const showHistory = historyOpenBySlideId[slide.id] ?? false;
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
                          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] text-white">
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
                              {!generationInProgress ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    commitChange((prev) => ({
                                      ...prev,
                                      historyOpenBySlideId: {
                                        ...prev.historyOpenBySlideId,
                                        [slide.id]: true,
                                      },
                                    }));
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
                                commitChange((prev) => ({
                                  ...prev,
                                  historyOpenBySlideId: {
                                    ...prev.historyOpenBySlideId,
                                    [slide.id]: true,
                                  },
                                }));
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
                        {showHistory && historyImages.length > 0 ? (
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
                alt={`预览分镜${previewFrame.page}`}
                className="h-full w-full object-contain"
              />
              <div className="absolute left-4 top-4 rounded-lg bg-black/55 px-3 py-1.5 text-xs text-white">
                第{previewFrame.page}页 · {previewFrame.title}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {showComposeModal ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-900/28 backdrop-blur-[1px]">
          <div className="w-[640px] rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_22px_50px_rgba(15,23,42,0.22)]">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Export Video</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Preparing a downloadable explainer video from your storyboard.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowComposeModal(false)}
                className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
              >
                Close
              </button>
            </div>

            <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-3">
              <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-xs text-zinc-600">
                <div className="flex items-center justify-between">
                  <span>Resolution</span>
                  <span className="font-medium text-zinc-800">
                    {composeMeta?.resolution ?? "1280×720"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Frame rate</span>
                  <span className="font-medium text-zinc-800">
                    {(composeMeta?.fps ?? 24).toString()} fps
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Scenes</span>
                  <span className="font-medium text-zinc-800">
                    {(composeMeta?.sceneCount ?? slides.length).toString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Narration</span>
                  <span className="font-medium text-zinc-800">
                    {(composeMeta?.voicedSceneCount ?? 0).toString()} scene(s)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Duration</span>
                  <span className="font-medium text-zinc-800">
                    {formatDuration(composeMeta?.durationSec ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Format</span>
                  <span className="font-medium text-zinc-800">
                    {composeMeta?.format?.replace("video/", "") ?? "webm"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-4 space-y-2.5">
              {COMPOSE_STEPS.map((step) => {
                const status = composeSteps[step.key];
                return (
                  <div
                    key={step.key}
                    className={`rounded-xl border px-3 py-2.5 ${
                      status === "running"
                        ? "border-zinc-900 bg-zinc-900/5"
                        : status === "done"
                          ? "border-emerald-200 bg-emerald-50/60"
                          : status === "error"
                            ? "border-red-200 bg-red-50"
                            : "border-zinc-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-zinc-900">{step.title}</p>
                      <span
                        className={`text-xs ${
                          status === "running"
                            ? "text-zinc-900"
                            : status === "done"
                              ? "text-emerald-700"
                              : status === "error"
                                ? "text-red-600"
                                : "text-zinc-400"
                        }`}
                      >
                        {status === "running"
                          ? "Running"
                          : status === "done"
                            ? "Done"
                            : status === "error"
                              ? "Failed"
                              : "Waiting"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">{step.description}</p>
                  </div>
                );
              })}
            </div>

            {composeStatus === "running" ? (
              <div className="rounded-xl border border-zinc-200 bg-white px-3 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-zinc-700">
                    <LoaderCircle className="animate-spin" size={16} />
                    {composeLoadingHint}
                  </div>
                  <span className="text-xs font-medium text-zinc-500">{composeProgress}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200">
                  <div
                    className="h-full rounded-full bg-zinc-900 transition-[width] duration-300"
                    style={{ width: `${composeProgress}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center gap-1 text-[11px] text-zinc-500">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-500" />
                  <span>You can keep editing while the export continues.</span>
                </div>
              </div>
            ) : null}

            {composeStatus === "error" && composeError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                <p className="text-sm text-red-600">{composeError}</p>
                <div className="mt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowComposeModal(false)}
                    className="inline-flex items-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100"
                  >
                    Back to editor
                  </button>
                  <button
                    type="button"
                    onClick={runComposeVideo}
                    className="inline-flex items-center rounded-md bg-zinc-900 px-3 py-1.5 text-xs text-white hover:bg-zinc-700"
                  >
                    Retry export
                  </button>
                </div>
              </div>
            ) : null}

            {composeStatus === "success" && composedVideoUrl ? (
              <div>
                <video
                  src={composedVideoUrl}
                  controls
                  className="w-full rounded-xl border border-zinc-200"
                />
                <div className="mt-3 flex justify-end">
                  <a
                    href={composedVideoUrl}
                    download={composedVideoFilename}
                    className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-700"
                  >
                    <Download size={13} />
                    Download Video
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {showPptExportModal ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-900/28 backdrop-blur-[1px]">
          <div className="w-[520px] rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_22px_50px_rgba(15,23,42,0.22)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Export PPT</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  {pptExportStatus === "success"
                    ? "Your slide deck is ready."
                    : pptExportStatus === "error"
                      ? "Please fix the issue below and retry."
                      : "Preparing a downloadable slide deck."}
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
                    className="inline-flex items-center rounded-lg bg-zinc-900 px-3 py-2 text-xs text-white hover:bg-zinc-700"
                  >
                    Retry export
                  </button>
                </>
              ) : null}

              {pptExportStatus === "success" && exportedPptUrl ? (
                <a
                  href={exportedPptUrl}
                  download="KnowLens.ai-visual-deck.pptx"
                  onClick={() => {
                    setPptDownloadNotice("Download started. If nothing appears, click Download PPT again.");
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-700"
                >
                  <Download size={13} />
                  Download PPT
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
