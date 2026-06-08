import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronLeft, ChevronRight, Download, LoaderCircle, Lock } from "lucide-react";

export type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  module: string;
  content: string;
  meta?: ChatTurnMeta;
};

export type ChatTurnMeta =
  | {
      kind: "llm_error";
      source: "draft_generation";
      code?: string;
      retryable?: boolean;
    }
  | {
      kind: "image_error";
      source: "image_generation";
      code?: string;
      taskIndex?: number;
      retryable?: boolean;
    };

export type WorkspaceIntent = "ppt" | "video" | "poster" | "unknown";

type SourceItem = {
  id: string;
  kind: "file" | "web" | "youtube" | "podcast";
  name: string;
  origin: string;
  status: "queued" | "uploading" | "extracting" | "processing" | "ready" | "failed";
  excerpt: string;
  errorMessage?: string | null;
  errorCode?: string | null;
  progress?: number;
};

function toUserFacingErrorCode(code?: string) {
  const raw = (code || "").trim().toUpperCase();
  if (!raw) {
    return "";
  }
  if (/TIMEOUT|TIMED_OUT|BUDGET/.test(raw)) return "GEN-408";
  if (/AUTH|KEY|API/.test(raw)) return "GEN-401";
  if (/NETWORK|FETCH|ABORT/.test(raw)) return "GEN-503";
  if (/MODEL|PROVIDER|GPTSAPI|TUZI|DUOMI/.test(raw)) return "GEN-502";
  return "GEN-500";
}

type SlideDraft = {
  page: number;
  title: string;
  body: string;
  visual: string;
  isCover?: boolean;
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

type IntentOption = {
  id: Exclude<WorkspaceIntent, "unknown">;
  label: string;
  desc: string;
};

type StyleOption = {
  id: string;
  name: string;
  englishName?: string;
  fit: string;
  hoverDescription?: string;
  palette: string[];
  coverImage?: string;
};

const OUTPUT_COUNT_OPTIONS = [6, 10, 14, 16, 20, 24] as const;
const STYLE_COVER_FRAME_CLASS = "relative aspect-[471/836] w-full overflow-hidden bg-zinc-100 leading-none";
const STYLE_CARD_LABEL_CLASS = "flex min-h-[3.5rem] items-start px-2.5 pb-2.5 pt-2";

function styleCoverCandidates(coverImage?: string) {
  if (!coverImage) {
    return [];
  }
  const normalized = coverImage.trim();
  const [path, query = ""] = normalized.split("?");
  if (!path.startsWith("/style/") || !path.toLowerCase().endsWith(".jpg")) {
    return [];
  }
  return [query ? `${path}?${query}` : path];
}

function StyleCover({ style }: { style: StyleOption }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [coverSrc, setCoverSrc] = useState(() => styleCoverCandidates(style.coverImage)[0] ?? "");
  const retryCountRef = useRef(0);
  const candidates = useMemo(() => styleCoverCandidates(style.coverImage), [style.coverImage]);
  useEffect(() => {
    retryCountRef.current = 0;
    queueMicrotask(() => {
      setImageFailed(false);
      setImageLoaded(false);
      setCoverSrc(candidates[0] ?? "");
    });
  }, [candidates]);
  if (!coverSrc || imageFailed) {
    return (
      <div
        className="skeleton-shimmer h-full w-full"
        style={{
          background: `linear-gradient(160deg, ${style.palette[0]}55, ${style.palette[1]}88 55%, ${style.palette[2]})`,
        }}
      />
    );
  }
  return (
    <>
      {!imageLoaded ? <div className="skeleton-shimmer pointer-events-none absolute inset-0 z-10" /> : null}
      <img
        src={coverSrc}
        alt={style.name}
        loading="eager"
        decoding="async"
        className="absolute inset-0 block h-full w-full scale-[1.01] rounded-none object-cover object-top align-top"
        onLoad={() => setImageLoaded(true)}
        onError={() => {
          const currentIndex = candidates.findIndex((candidate) => candidate === coverSrc);
          const nextCandidate = currentIndex >= 0 ? candidates[currentIndex + 1] : "";
          if (nextCandidate) {
            setCoverSrc(nextCandidate);
            return;
          }
          if (retryCountRef.current < 2 && coverSrc) {
            retryCountRef.current += 1;
            window.setTimeout(() => {
              setImageLoaded(false);
              setCoverSrc(`${coverSrc}${coverSrc.includes("?") ? "&" : "?"}retry=${retryCountRef.current}`);
            }, 900);
            return;
          }
          setImageFailed(true);
          setImageLoaded(true);
        }}
      />
    </>
  );
}

function DraftContentCard({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="mt-4 rounded-xl border border-zinc-200 bg-white px-3 py-3">{children}</div>;
}

function formatPosterHeadline(text: string) {
  const normalized = text.replace(/^\s*[-–—]?\s*pge\s*:\s*/i, "").trim();
  return normalized || text.trim();
}

function formatPosterPoint(text: string) {
  return text.replace(/^\s*[-•]\s*/, "").trim();
}

function formatPosterSubtitle(text?: string) {
  const normalized = (text || "").trim();
  if (!normalized || /^(更清晰|更生动|更专业)$/i.test(normalized)) {
    return "";
  }
  return normalized;
}

function compactDraftLine(text: string, max = 160) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(32, max - 1)).trim()}…`;
}

function formatDraftBlock(text: string, max = 520) {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/^(?:page\s*content|content|页面内容|正文|本页内容)\s*[：:]\s*/i, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  if (!normalized) {
    return "";
  }
  const withSoftBreaks = normalized
    .replace(/\s*•\s*/g, "\n• ")
    .replace(/(^|\n)\s*•\s*(\d+)\.\s*(?:\n\s*)?/g, "$1$2. ")
    .replace(/(^|\n)\s*(\d+)\.\s*\n\s*/g, "$1$2. ")
    .replace(/([。！？.!?])\s+(?=(?:[\u4e00-\u9fffA-Za-z0-9]|[•]))/g, "$1\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (withSoftBreaks.length <= max) {
    return withSoftBreaks;
  }
  return `${withSoftBreaks.slice(0, Math.max(80, max - 1)).trim()}…`;
}

function normalizeSlashLineBreaks(text: string) {
  return text
    .replace(/\s*\/\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatDraftVisualLine(text: string, max = 140) {
  return compactDraftLine(
    text
      .replace(/^(?:visual\s*structure|visual|画面结构|画面设计|视觉结构)\s*[：:]\s*/i, "")
      .trim(),
    max,
  );
}

function splitDraftDisplaySentences(text: string) {
  return text
    .split(/[。！？!?;\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `${part}。`);
}

function isDraftModulePlaceholder(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return /^(?:module|模块)\s*\d+\s*[:：]/i.test(normalized);
}

function isDraftInstructionArtifact(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return /(?:请把下面内容|把下面内容|一页聚焦把|适合投资者快速理解|重点展示|做成一组|生成一组)/i.test(
    normalized,
  );
}

function isGenericMechanismDraftLine(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return /(?:核心机制|关键变量与现实影响|最先变化的变量|3-4\s*个步骤|可观测指标|现实案例|因果关系|机制链路|触发条件|机制传导|回到现实场景验证结论|补充一个现实案例)/i.test(
    normalized,
  );
}

function isStandaloneDraftFragment(text: string) {
  const normalized = text.replace(/[。.!！?？\s]/g, "").trim();
  if (!normalized) {
    return true;
  }
  if (/^(?:GAAP|Non-GAAP|EPS|稀释后|Non-GAAP稀释后|GAAP稀释后)$/i.test(normalized)) {
    return true;
  }
  if (/每股收益为\s*[\d.]+\s*(?:美元|元)?[，,]\s*(?:Non-)?GAAP\s*稀释后[。.]?$/i.test(text.trim())) {
    return true;
  }
  if (normalized.length <= 8 && !/\d/.test(normalized)) {
    return true;
  }
  if (/每股收益为\d/.test(normalized) && !/(?:GAAP|Non-GAAP|EPS|稀释后每股收益)/i.test(text)) {
    return true;
  }
  return false;
}

function normalizeDraftDisplayLine(text: string, max = 180) {
  const cleaned = compactDraftLine(formatPosterPoint(text), max);
  if (!cleaned) {
    return "";
  }
  if (
    isDraftModulePlaceholder(cleaned) ||
    isDraftInstructionArtifact(cleaned) ||
    isGenericMechanismDraftLine(cleaned) ||
    isStandaloneDraftFragment(cleaned)
  ) {
    return "";
  }
  return cleaned;
}

function extractReadableFactsFromUserPrompt(prompt: string) {
  return splitDraftDisplaySentences(prompt)
    .map((line) => normalizeDraftDisplayLine(line, 210))
    .filter((line) => {
      if (!line) {
        return false;
      }
      return /(?:\d|营收|收入|净利润|毛利率|每股收益|EPS|Data Center|数据中心|股票回购|现金分红|回购授权|股息|下季度|第二季度|指引|风险|增长|业务结构|Edge Computing|Hyperscale|ACIE|护城河|资本开支)/i.test(
        line,
      );
    });
}

function inferPosterReviewTitleFromPrompt(prompt: string) {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  const financialSentence =
    splitDraftDisplaySentences(normalized).find((line) => /公布.*财报|财报.*季度|earnings|financial report/i.test(line)) ||
    normalized;
  const cnFinancialMatch = financialSentence.match(
    /([\u4e00-\u9fa5A-Za-z0-9]{2,12})公布\s*((?:20\d{2}\s*)?财年)?第([一二三四1234])季度财报/,
  );
  if (cnFinancialMatch) {
    const company = cnFinancialMatch[1]?.trim();
    const fiscalYear = cnFinancialMatch[2]?.replace(/\s+/g, " ").trim();
    const quarter = cnFinancialMatch[3]?.trim();
    return `${company}${fiscalYear ? ` ${fiscalYear}` : ""}第${quarter}季度财报速览`;
  }
  const financialMatch = normalized.match(/([A-Za-z][A-Za-z0-9 .-]{1,30})\s+(?:Q[1-4]|quarterly|earnings|financial report)/i);
  if (financialMatch) {
    return `${financialMatch[1].trim()} earnings overview`;
  }
  return "";
}

function inferPosterReviewSubtitleFromPrompt(prompt: string) {
  if (/财报|营收|净利润|毛利率|Data Center|数据中心|指引|回购|股息/.test(prompt)) {
    return "核心业绩、业务结构变化、增长驱动、风险点与下季度指引";
  }
  return "";
}

function compactChatTurnsForDisplay(turns: ChatTurn[]) {
  const transientModules = new Set([
    "Output Direction",
    "Requirement Check",
    "Poster Generation",
    "Storyboard Generation",
    "输出方向",
    "需求确认",
    "海报生成",
    "分镜生成",
  ]);
  const transientNoisePattern =
    /(switched to|already in|selected\.\s*draft generation is starting|configuration intent noted|cannot determine the output type|billing confirmed|credits deducted|rendering has started on the right canvas|storyboard generation has started on the right canvas|已切换到|当前已是|我还不能确定|我已记录你的配置意图|账单已确认|共扣除|右侧已进入海报绘制页面|分镜已开始生成)/i;

  const deduped: ChatTurn[] = [];
  const seenTransient = new Set<string>();

  turns.forEach((turn) => {
    const content = turn.content.trim();
    if (!content) {
      return;
    }
    const compactTurn = { ...turn, content };
    const isTransient = transientModules.has(turn.module) || transientNoisePattern.test(content);
    if (!isTransient) {
      deduped.push(compactTurn);
      return;
    }
    const key = `${turn.role}::${turn.module}::${content}`;
    if (seenTransient.has(key)) {
      return;
    }
    seenTransient.add(key);
    deduped.push(compactTurn);
  });

  const transientIndexes = deduped
    .map((turn, index) => ({
      index,
      isTransient:
        transientModules.has(turn.module) || transientNoisePattern.test(turn.content),
    }))
    .filter((item) => item.isTransient)
    .map((item) => item.index);

  const keepTransientCount = 0;
  const keepTransientSet = new Set(
    transientIndexes.slice(Math.max(0, transientIndexes.length - keepTransientCount)),
  );

  return deduped.filter((turn, index) => {
    const isTransient =
      transientModules.has(turn.module) || transientNoisePattern.test(turn.content);
    return !isTransient || keepTransientSet.has(index);
  });
}

type ChatPanelProps = {
  scrollContainerRef?: { current: HTMLDivElement | null } | null;
  outputLanguage?: "en" | "zh";
  userPrompt: string;
  entrySources: SourceItem[];
  intent: WorkspaceIntent;
  selectedIntent: Exclude<WorkspaceIntent, "unknown"> | null;
  analysisText: string;
  showDirectionGuide: boolean;
  shouldClarifyIntent: boolean;
  showWeakPromptSuggestions: boolean;
  topicSuggestionsLoading: boolean;
  topicSuggestions: string[];
  selectedTopicSuggestion: string | null;
  topicSuggestionLocked: boolean;
  lockedTopicSuggestion: string | null;
  topicSuggestionLockReason: "selected" | "manual_retry" | null;
  onApplyTopicSuggestion: (text: string) => void;
  onConfirmTopicSuggestion: () => void;
  missingHints: string[];
  intentOptions: IntentOption[];
  recommendedIntent: Exclude<WorkspaceIntent, "unknown">;
  onSelectIntentOption: (intent: Exclude<WorkspaceIntent, "unknown">) => void;
  posterSizeOptions: { id: string; label: string; desc: string }[];
  selectedPosterSize: string | null;
  onSelectPosterSize: (sizeId: string) => void;
  posterCount: number;
  onPosterCountChange: (count: number) => void;
  pptPageCount: number;
  onPptPageCountChange: (count: number) => void;
  pptRatio: "16:9" | "4:3";
  onPptRatioChange: (ratio: "16:9" | "4:3") => void;
  videoStoryboardCount: number;
  onVideoStoryboardCountChange: (count: number) => void;
  videoRatio: "16:9" | "9:16";
  onVideoRatioChange: (ratio: "16:9" | "9:16") => void;
  configConfirmed: boolean;
  onConfirmConfig: () => void;
  outlineItems: string[];
  slideDrafts: SlideDraft[];
  posterDraft: PosterDraft | null;
  posterPlanList: PosterPlanItem[];
  summaryText: string;
  updates: ChatTurn[];
  onConfirm: () => void;
  isPlanningNextStep: boolean;
  canProceed: boolean;
  showStyleStage: boolean;
  styleConfirmed: boolean;
  isPlanningStyleStep: boolean;
  showBillingConfirm: boolean;
  showBillingRecord: boolean;
  isPlanningBillingStep: boolean;
  billingConfirmed: boolean;
  canConfirmBilling: boolean;
  isFreeUser?: boolean;
  generationConfirmError?: string | null;
  billingSummary: {
    styleName: string;
    languageModelCredits: number;
    languageModelLabel?: string;
    imageModelCredits: number;
    imageModelLabel?: string;
    ttsNarrationCredits?: number;
    ttsNarrationCharCount?: number;
    ttsCreditsPer1000Chars?: number;
    ttsModelLabel?: string;
    totalCost: number;
    standardOutputCount: number;
    promoCreditsPerOutput: number;
    regularCreditsPerOutput: number;
  };
  styleOptions: StyleOption[];
  selectedStyleId: string;
  onSelectStyle: (styleId: string) => void;
  onStyleNext: () => void;
  onConfirmBilling: () => void;
  onUpgradeForCredits?: (context?: {
    scene: "count_limit" | "billing_insufficient";
    kind?: "poster" | "ppt" | "video";
    count?: number;
  }) => void;
  visualizationTypeHint: string | null;
  thinkingState: {
    active: boolean;
    module: string;
    text: string;
  };
  isDraftGenerationPending?: boolean;
  retryingErrorTurnIds?: Record<string, boolean>;
  onRetryErrorTurn?: (turnId: string) => void;
  outputSummaryCard?: {
    visible: boolean;
    formatLabel: string;
    title: string;
    angle: string;
    statusLabel: string;
    statusTone?: "default" | "warning";
    progressLabel?: string;
    isCanvasExpanded: boolean;
    canToggleCanvas: boolean;
    canDownload: boolean;
    downloadLabel: string;
    downloadDisabledLabel?: string;
    onToggleCanvas: () => void;
    onDownload: () => void;
  } | null;
};

export const ChatPanel = memo(function ChatPanel({
  scrollContainerRef,
  outputLanguage = "en",
  userPrompt,
  entrySources,
  intent,
  selectedIntent,
  analysisText,
  showDirectionGuide,
  shouldClarifyIntent,
  showWeakPromptSuggestions,
  topicSuggestionsLoading,
  topicSuggestions,
  selectedTopicSuggestion,
  topicSuggestionLocked,
  lockedTopicSuggestion,
  topicSuggestionLockReason,
  onApplyTopicSuggestion,
  onConfirmTopicSuggestion,
  missingHints,
  intentOptions,
  recommendedIntent,
  onSelectIntentOption,
  posterSizeOptions,
  selectedPosterSize,
  onSelectPosterSize,
  posterCount,
  onPosterCountChange,
  pptPageCount,
  onPptPageCountChange,
  pptRatio,
  onPptRatioChange,
  videoStoryboardCount,
  onVideoStoryboardCountChange,
  videoRatio,
  onVideoRatioChange,
  configConfirmed,
  onConfirmConfig,
  outlineItems,
  slideDrafts,
  posterDraft,
  posterPlanList,
  summaryText,
  updates,
  onConfirm,
  isPlanningNextStep,
  canProceed,
  showStyleStage,
  styleConfirmed,
  isPlanningStyleStep,
  showBillingConfirm,
  showBillingRecord,
  isPlanningBillingStep,
  billingConfirmed,
  canConfirmBilling,
  isFreeUser = false,
  generationConfirmError,
  billingSummary,
  styleOptions,
  selectedStyleId,
  onSelectStyle,
  onStyleNext,
  onConfirmBilling,
  onUpgradeForCredits,
  visualizationTypeHint,
  thinkingState,
  isDraftGenerationPending = false,
  retryingErrorTurnIds,
  onRetryErrorTurn,
  outputSummaryCard,
}: ChatPanelProps) {
  void outputLanguage;
  const isZh = false;
  const shouldUseEnglishUi = true;
  const t = (en: string, zh: string) => (isZh ? zh : en);
  const prompt1LoadingMessages = useMemo(
    () =>
      [
        "Understanding your topic and input content...",
        "Reading the first request carefully...",
        "Checking whether this is a complete brief or a broad topic...",
        "Identifying the real output intent behind the wording...",
        "Separating the main topic from extra background details...",
        "Detecting whether the request needs guided topic options...",
        "Preparing the next best step for this workflow...",
        "Drafting relevant topic angles when the request is broad...",
        "Checking that suggestions stay close to your topic...",
        "Removing generic template suggestions...",
        "Finalizing the guided options...",
      ],
    [],
  );
  const [prompt1LoadingMessageIndex, setPrompt1LoadingMessageIndex] = useState(0);
  useEffect(() => {
    if (!(showWeakPromptSuggestions && topicSuggestionsLoading)) {
      queueMicrotask(() => setPrompt1LoadingMessageIndex(0));
      return;
    }
    const timerId = window.setInterval(() => {
      setPrompt1LoadingMessageIndex((prev) => (prev + 1) % prompt1LoadingMessages.length);
    }, 2400);
    return () => {
      window.clearInterval(timerId);
    };
  }, [showWeakPromptSuggestions, topicSuggestionsLoading, prompt1LoadingMessages.length]);
  const prompt1LoadingMessage =
    prompt1LoadingMessages[prompt1LoadingMessageIndex] ?? prompt1LoadingMessages[0];
  const isPremiumCountLocked = useCallback((kind: "poster" | "ppt" | "video", count: number) => {
    if (!isFreeUser) {
      return false;
    }
    if (kind === "poster") {
      return count >= 7;
    }
    if (kind === "ppt") {
      return count >= 10;
    }
    return count >= 10;
  }, [isFreeUser]);
  const handleCountSelect = useCallback((input: {
    kind: "poster" | "ppt" | "video";
    count: number;
    onSelect: (value: number) => void;
    disabled?: boolean;
  }) => {
    if (input.disabled) {
      return;
    }
    if (isPremiumCountLocked(input.kind, input.count)) {
      onUpgradeForCredits?.({
        scene: "count_limit",
        kind: input.kind,
        count: input.count,
      });
      return;
    }
    input.onSelect(input.count);
  }, [isPremiumCountLocked, onUpgradeForCredits]);
  const renderCountLabel = useCallback(
    (kind: "poster" | "ppt" | "video", count: number, unit: string) => {
      const locked = isPremiumCountLocked(kind, count);
      return (
        <span className="inline-flex items-center gap-1">
          {locked ? <Lock size={11} className="opacity-80" aria-hidden="true" /> : null}
          <span>{count} {unit}</span>
        </span>
      );
    },
    [isPremiumCountLocked],
  );
  const selectedStyle =
    styleOptions.find((style) => style.id === selectedStyleId) ?? styleOptions[0];
  const stylePreloadRefs = useRef<Record<string, boolean>>({});
  const previousCardVisibilityRef = useRef({
    billingShown: false,
    draftShown: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    styleOptions.forEach((style) => {
      const candidates = styleCoverCandidates(style.coverImage);
      candidates.forEach((src) => {
        if (!src || stylePreloadRefs.current[src]) {
          return;
        }
        stylePreloadRefs.current[src] = true;
        const preload = new window.Image();
        preload.decoding = "async";
        preload.src = src;
      });
    });
  }, [styleOptions]);
  const styleDisplayName = (style: StyleOption) => (isZh ? style.name : style.englishName ?? style.name);
  const styleHoverDescription = (style: StyleOption) =>
    style.hoverDescription ?? style.fit;
  const selectedStyleCardClass =
    "translate-y-[-1px] border-zinc-900 bg-white shadow-[0_14px_28px_rgba(24,24,27,0.24)] ring-[3px] ring-zinc-900/18";
  const selectedStyleBadgeClass =
    "absolute right-3 top-3 z-20 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/70 bg-zinc-900 text-white shadow-sm";
  const [supportsHoverDescription, setSupportsHoverDescription] = useState(false);
  const [introPhase, setIntroPhase] = useState<"analyzing" | "planning" | "ask">("analyzing");
  const styleButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const deferredUpdates = useDeferredValue(updates);
  const displayedUpdates = useMemo(() => compactChatTurnsForDisplay(deferredUpdates), [deferredUpdates]);

  const renderOutputSummaryCard = useCallback(() => {
    if (!outputSummaryCard?.visible) {
      return null;
    }
    const toggleLabel = outputSummaryCard.canToggleCanvas
      ? outputSummaryCard.isCanvasExpanded
        ? "Hide canvas"
        : "Open canvas"
      : "Canvas will open after generation starts";
    const ToggleIcon = outputSummaryCard.isCanvasExpanded ? ChevronLeft : ChevronRight;
    const handleCardClick = () => {
      if (outputSummaryCard.canToggleCanvas) {
        outputSummaryCard.onToggleCanvas();
      }
    };
    const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
      if (!outputSummaryCard.canToggleCanvas) {
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        outputSummaryCard.onToggleCanvas();
      }
    };
    const statusIsWarning = outputSummaryCard.statusTone === "warning";
    return (
      <article
        role={outputSummaryCard.canToggleCanvas ? "button" : undefined}
        tabIndex={outputSummaryCard.canToggleCanvas ? 0 : undefined}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        className={`max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm transition ${
          outputSummaryCard.canToggleCanvas ? "cursor-pointer hover:border-zinc-300 hover:shadow-md" : ""
        }`}
        aria-expanded={outputSummaryCard.canToggleCanvas ? outputSummaryCard.isCanvasExpanded : undefined}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Output</div>
            <h3 className="mt-1 truncate text-base font-semibold text-zinc-950">
              {outputSummaryCard.formatLabel}: {outputSummaryCard.title}
            </h3>
          </div>
          <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600">
            {outputSummaryCard.canToggleCanvas ? <ToggleIcon size={13} aria-hidden="true" /> : null}
            {toggleLabel}
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-zinc-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p
            className={`text-sm ${
              statusIsWarning
                ? "inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 font-semibold text-amber-700"
                : "text-zinc-600"
            }`}
          >
            {outputSummaryCard.statusLabel}
            {outputSummaryCard.progressLabel ? (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  statusIsWarning ? "bg-amber-100 text-amber-800" : "ml-2 bg-zinc-100 text-zinc-700"
                }`}
              >
                {outputSummaryCard.progressLabel}
              </span>
            ) : null}
          </p>
          <button
            type="button"
            disabled={!outputSummaryCard.canDownload}
            onClick={(event) => {
              event.stopPropagation();
              outputSummaryCard.onDownload();
            }}
            className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-600 sm:w-auto"
          >
            {outputSummaryCard.canDownload ? (
              <Download size={15} className="shrink-0" aria-hidden="true" />
            ) : (
              <LoaderCircle size={15} className="shrink-0 animate-spin" aria-hidden="true" />
            )}
            <span>
              {outputSummaryCard.canDownload
                ? outputSummaryCard.downloadLabel
                : outputSummaryCard.downloadDisabledLabel || "Generating"}
            </span>
          </button>
        </div>
      </article>
    );
  }, [outputSummaryCard]);

  const scrollToLatestCard = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    const run = () => {
      const container = scrollContainerRef?.current;
      if (container) {
        const targetTop = Math.max(0, container.scrollHeight - container.clientHeight + 80);
        container.scrollTo({ top: targetTop, behavior: "smooth" });
        return;
      }
      const doc = document.documentElement;
      const targetTop = Math.max(0, doc.scrollHeight - window.innerHeight + 80);
      window.scrollTo({ top: targetTop, behavior: "smooth" });
    };
    window.requestAnimationFrame(run);
    window.setTimeout(run, 160);
    window.setTimeout(run, 420);
  }, [scrollContainerRef]);

  const handleTopicSuggestionNext = () => {
    onConfirmTopicSuggestion();
    scrollToLatestCard();
  };

  const handleDraftNext = () => {
    onConfirm();
    scrollToLatestCard();
  };

  const handleStyleNext = () => {
    onStyleNext();
    scrollToLatestCard();
  };

  const handleBillingConfirm = () => {
    if (!canConfirmBilling) {
      onUpgradeForCredits?.({
        scene: "billing_insufficient",
        kind: selectedIntent ?? undefined,
      });
      return;
    }
    onConfirmBilling();
    scrollToLatestCard();
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const apply = () => setSupportsHoverDescription(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const timers: number[] = [];

    if (!showDirectionGuide) {
      timers.push(window.setTimeout(() => setIntroPhase("ask"), 0));
      return;
    }
    timers.push(window.setTimeout(() => setIntroPhase("analyzing"), 0));
    timers.push(window.setTimeout(() => setIntroPhase("planning"), 900));
    timers.push(window.setTimeout(() => setIntroPhase("ask"), 1850));
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [showDirectionGuide, userPrompt]);

  useEffect(() => {
    if (!showStyleStage) {
      return;
    }
    const target = styleButtonRefs.current[selectedStyleId];
    if (!target) {
      return;
    }
    window.setTimeout(() => {
      target.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
    }, 120);
  }, [selectedStyleId, showStyleStage]);

  const configSummaryText = useMemo(() => {
    if (!configConfirmed) {
      return "";
    }
    if (selectedIntent === "poster") {
      return isZh
        ? `已确认：${posterCount} 张，${
            posterSizeOptions.find((item) => item.id === selectedPosterSize)?.label ?? selectedPosterSize ?? "9:16 竖版"
          }。`
        : `Confirmed: ${posterCount} poster(s), ${
            posterSizeOptions.find((item) => item.id === selectedPosterSize)?.label ?? selectedPosterSize ?? "9:16 Portrait"
          }.`;
    }
    if (selectedIntent === "video") {
      return isZh
        ? `已确认：${videoStoryboardCount} 个分镜（约 ${videoStoryboardCount * 10} 秒），${videoRatio} 比例。`
        : `Confirmed: ${videoStoryboardCount} frame(s) (~${videoStoryboardCount * 10}s), ratio ${videoRatio}.`;
    }
    if (selectedIntent === "ppt") {
      return isZh
        ? `已确认：${pptPageCount} 页，${pptRatio} 比例。`
        : `Confirmed: ${pptPageCount} slide(s), ratio ${pptRatio}.`;
    }
    return t("Current configuration confirmed.", "已确认当前配置。");
  }, [
    configConfirmed,
    posterCount,
    posterSizeOptions,
    pptPageCount,
    pptRatio,
    selectedIntent,
    selectedPosterSize,
    videoRatio,
    videoStoryboardCount,
    isZh,
  ]);
  const showMainSummaryBlock = !showDirectionGuide && !showStyleStage && !showBillingConfirm;
  const showPersistentDirectionSummary = !showDirectionGuide && Boolean(configConfirmed && selectedIntent);
  const showDirectionCard = showDirectionGuide || Boolean(selectedIntent);
  const showWorkflowSummaryCard =
    !configConfirmed &&
    !topicSuggestionsLoading &&
    !(showWeakPromptSuggestions && showDirectionGuide) &&
    !topicSuggestionLocked;
  const isDirectionLocked = configConfirmed && !showDirectionGuide;
  const shouldShowDraftConfirmAction = !showStyleStage && !showBillingConfirm && !styleConfirmed;
  const hasDraftContentCard =
    Boolean(posterDraft) ||
    ((intent === "ppt" || intent === "video") && (outlineItems.length > 0 || slideDrafts.length > 0));
  const draftGenerationLoadingActive =
    thinkingState.active &&
    /(draft|文稿|海报|分镜|poster|storyboard|ppt)/i.test(thinkingState.module);
  const shouldAutoScrollDirectionGuide =
    showDirectionGuide &&
    !configConfirmed &&
    !topicSuggestionsLoading &&
    !showWeakPromptSuggestions &&
    introPhase === "ask";
  const directionGuideAutoScrollKeyRef = useRef("");

  useEffect(() => {
    if (!showDirectionGuide || topicSuggestionsLoading) {
      directionGuideAutoScrollKeyRef.current = "";
    }
  }, [showDirectionGuide, topicSuggestionsLoading]);

  useEffect(() => {
    if (!shouldAutoScrollDirectionGuide) {
      return;
    }
    const scrollKey = `${userPrompt.trim()}|${topicSuggestionLocked ? "suggestion" : "direct"}`;
    if (directionGuideAutoScrollKeyRef.current === scrollKey) {
      return;
    }
    directionGuideAutoScrollKeyRef.current = scrollKey;

    const timer = window.setTimeout(() => {
      scrollToLatestCard();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [
    scrollToLatestCard,
    shouldAutoScrollDirectionGuide,
    topicSuggestionLocked,
    userPrompt,
  ]);
  const shouldShowDraftLoadingCard =
    configConfirmed &&
    (isDraftGenerationPending || (draftGenerationLoadingActive && !hasDraftContentCard));
  const draftLoadingTitle = "KnowLens.ai · Draft Content";
  const rotatingDraftLoadingMessages = [
    "Reading the confirmed direction and output count...",
    "Sending the draft request to the language model...",
    "Preserving user-provided facts, numbers, and structure...",
    "Deciding what each page or frame should cover...",
    "Separating core points from supporting details...",
    "Keeping complete information units intact...",
    "Adapting the content rhythm for poster, slides, or video...",
    "Preparing concise titles for review...",
    "Creating visual directions without locking final image text...",
    "Checking for repeated or empty sections...",
    "Assembling the reviewable draft...",
    "Getting the draft card ready...",
  ];
  const [draftLoadingMessageIndex, setDraftLoadingMessageIndex] = useState(0);
  useEffect(() => {
    if (!shouldShowDraftLoadingCard) {
      queueMicrotask(() => setDraftLoadingMessageIndex(0));
      return;
    }
    const interval = window.setInterval(() => {
      setDraftLoadingMessageIndex((prev) => (prev + 1) % rotatingDraftLoadingMessages.length);
    }, 2600);
    return () => window.clearInterval(interval);
  }, [rotatingDraftLoadingMessages.length, shouldShowDraftLoadingCard]);
  const draftLoadingText = rotatingDraftLoadingMessages[draftLoadingMessageIndex];
  const draftLoadingCardRef = useRef<HTMLDivElement | null>(null);
  const previousDraftLoadingVisibleRef = useRef(false);
  useEffect(() => {
    const justShown = shouldShowDraftLoadingCard && !previousDraftLoadingVisibleRef.current;
    previousDraftLoadingVisibleRef.current = shouldShowDraftLoadingCard;
    if (!justShown) {
      return;
    }
    const scrollIntoViewCard = () => {
      const card = draftLoadingCardRef.current;
      if (!card) {
        return;
      }
      card.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
    };
    window.requestAnimationFrame(scrollIntoViewCard);
    const timer = window.setTimeout(scrollIntoViewCard, 180);
    return () => window.clearTimeout(timer);
  }, [shouldShowDraftLoadingCard]);
  const renderDraftLoadingCard = () => (
    <div ref={draftLoadingCardRef}>
      <div className="text-[11px] text-zinc-500">{draftLoadingTitle}</div>
      <div className="mt-2 flex items-center gap-2 text-sm text-zinc-700">
        <LoaderCircle size={14} className="animate-spin text-zinc-500" />
        {draftLoadingText}
      </div>
    </div>
  );
  const billingMessageClass = generationConfirmError
    ? "font-medium text-red-600"
    : "text-zinc-600";
  const billingMessageText = generationConfirmError
    ? generationConfirmError
    : billingConfirmed
      ? ""
      : `Limited-time rate applied: ${billingSummary.promoCreditsPerOutput} credits per standard output (regular ${billingSummary.regularCreditsPerOutput}).`;
  const imageBillingModelLabel = billingSummary.imageModelLabel || "GPT image2";
  const imageBillingDiscountText = `limited-time 30% rate, regular ${billingSummary.regularCreditsPerOutput} credits`;
  const ttsBillingModelLabel = billingSummary.ttsModelLabel || "OpenAI TTS Pro";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const prev = previousCardVisibilityRef.current;
    const billingJustShown = showBillingRecord && !prev.billingShown;
    const draftJustShown = hasDraftContentCard && !prev.draftShown;

    previousCardVisibilityRef.current = {
      billingShown: showBillingRecord,
      draftShown: hasDraftContentCard,
    };

    if (!billingJustShown && !draftJustShown) {
      return;
    }

    const timer = window.setTimeout(() => {
      scrollToLatestCard();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [hasDraftContentCard, scrollToLatestCard, showBillingRecord]);
  const renderUpdateCard = useCallback((update: ChatTurn, idx: number) => {
    if (update.role === "assistant" && update.meta?.kind === "image_error") {
      return null;
    }
    const isErrorCard =
      update.role === "assistant" &&
      update.meta?.kind === "llm_error";
    if (isErrorCard) {
      const isRetrying = Boolean(retryingErrorTurnIds?.[update.id]);
      const errorCode = toUserFacingErrorCode(update.meta?.code);
      const canRetry = update.meta?.retryable !== false;
      return (
        <article
          key={`${update.id}-${idx}`}
          className="max-w-[95%] rounded-2xl border border-red-200 bg-red-50/70 px-4 py-3 text-sm text-zinc-800"
        >
          <div className="mb-1 text-[11px] text-zinc-500">KnowLens.ai · {update.module}</div>
          <p className="whitespace-pre-line leading-6">{update.content}</p>
          {errorCode ? <p className="mt-1 text-[11px] text-zinc-500">Error code: {errorCode}</p> : null}
          {canRetry && onRetryErrorTurn ? (
            <div className="mt-2">
              <button
                type="button"
                disabled={isRetrying}
                onClick={() => onRetryErrorTurn(update.id)}
                className="inline-flex h-8 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRetrying ? "Retrying..." : "Retry"}
              </button>
            </div>
          ) : null}
        </article>
      );
    }
    return (
      <article
        key={`${update.id}-${idx}`}
        className={`max-w-[95%] rounded-2xl px-4 py-3 text-sm ${
          update.role === "user" ? "ml-auto bg-zinc-900 text-white" : "bg-zinc-100/85 text-zinc-800"
        }`}
      >
        {update.role !== "user" ? (
          <div className="mb-1 text-[11px] text-zinc-500">KnowLens.ai · {update.module}</div>
        ) : null}
        <p className="whitespace-pre-line leading-6">{update.content}</p>
      </article>
    );
  }, [onRetryErrorTurn, retryingErrorTurnIds]);
  const updateCardNodes = useMemo(
    () => displayedUpdates.map((update, idx) => renderUpdateCard(update, idx)),
    [displayedUpdates, renderUpdateCard],
  );

  const renderPosterDraftReview = ({
    locked,
  }: {
    locked: boolean;
  }) => {
    if (!posterDraft) {
      return null;
    }
    const planItems = posterPlanList
      .slice()
      .sort((a, b) => a.index - b.index)
      .slice(0, posterCount);
    const singlePlanItem = planItems.length === 1 ? planItems[0] : null;
    const inferredTitle = singlePlanItem ? inferPosterReviewTitleFromPrompt(userPrompt) : "";
    const rawVisibleTitle = formatPosterHeadline(posterDraft.headline);
    const visibleTitle =
      inferredTitle ||
      (isDraftInstructionArtifact(rawVisibleTitle) || isGenericMechanismDraftLine(rawVisibleTitle)
        ? ""
        : rawVisibleTitle);
    const inferredSubtitle = singlePlanItem ? inferPosterReviewSubtitleFromPrompt(userPrompt) : "";
    const rawVisibleSubtitle = formatPosterSubtitle(posterDraft.subtitle);
    const visibleSubtitle =
      inferredSubtitle ||
      (isDraftInstructionArtifact(rawVisibleSubtitle) || isGenericMechanismDraftLine(rawVisibleSubtitle)
        ? ""
        : rawVisibleSubtitle);
    const sourcePromptFacts = singlePlanItem ? extractReadableFactsFromUserPrompt(userPrompt) : [];
    const displayFactSources: string[] = singlePlanItem
      ? [
          ...sourcePromptFacts,
          ...(posterDraft.body ? splitDraftDisplaySentences(posterDraft.body) : []),
          ...posterDraft.points,
          ...(singlePlanItem.keyFacts ?? []),
        ]
      : posterDraft.points;
    const visibleLabels = displayFactSources
      .map((point) => normalizeDraftDisplayLine(point, singlePlanItem ? 190 : 88))
      .filter(Boolean)
      .filter((line, idx, lines) => lines.findIndex((candidate) => candidate.replace(/\s+/g, "") === line.replace(/\s+/g, "")) === idx)
      .slice(0, singlePlanItem ? 8 : 4);
    const rawPageFocus = normalizeDraftDisplayLine(singlePlanItem?.focus || "", singlePlanItem ? 180 : 120);
    const pageFocus =
      compactDraftLine(
        rawPageFocus || visibleSubtitle || visibleLabels[0] || visibleTitle,
        singlePlanItem ? 180 : 120,
      ) ||
      t("Define one clear page focus.", "先定义这一页的单一重点。");
    const visualStructure =
      compactDraftLine(singlePlanItem?.visualType || singlePlanItem?.layoutHint || "", 120) ||
      compactDraftLine(visualizationTypeHint || "", 72) ||
      compactDraftLine(posterDraft.layoutSuggestion || "", 100) ||
      t("Single clean infographic structure.", "单一清晰的信息图结构。");
    const toNumberedLines = (lines: string[]) =>
      lines
        .map((line) => normalizeSlashLineBreaks(line))
        .filter(Boolean)
        .map((line, idx) => `${idx + 1}. ${line}`);
    const normalizedTitle = normalizeSlashLineBreaks(visibleTitle || "-");
    const normalizedSubtitle = visibleSubtitle ? normalizeSlashLineBreaks(visibleSubtitle) : "";
    const normalizedLabels = toNumberedLines(visibleLabels);

    return (
      <>
        {planItems.length > 1 ? (
          <div className="mt-3 divide-y divide-zinc-200 text-sm">
            {planItems.map((item) => {
              const itemTitle = normalizeSlashLineBreaks(compactDraftLine(formatPosterHeadline(item.title), 80));
              const itemFocus = normalizeSlashLineBreaks(compactDraftLine(formatPosterPoint(item.focus), 120));
              const itemFacts = (item.keyFacts || [])
                .map((fact) => normalizeSlashLineBreaks(compactDraftLine(formatPosterPoint(fact), 88)))
                .filter(Boolean)
                .slice(0, 3);
              const numberedFacts = itemFacts.map((fact, idx) => `${idx + 1}. ${fact}`);
              const itemStructure = normalizeSlashLineBreaks(
                compactDraftLine(item.visualType || item.layoutHint || visualStructure, 72),
              );
              return (
                <section key={`poster-plan-${item.index}-${itemTitle}`} className="py-2.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                    {t("Poster", "海报")} {item.index}
                  </p>
                  <p className="mt-1 whitespace-pre-line font-semibold text-zinc-900">{itemTitle}</p>
                  <p className="mt-1 whitespace-pre-line text-zinc-800">
                    {t("Page Focus", "本页重点")}: {itemFocus}
                  </p>
                  {itemFacts.length ? (
                    <p className="mt-1 whitespace-pre-line text-zinc-700">
                      {t("Content", "内容")}:
                      {"\n"}
                      {numberedFacts.join("\n")}
                    </p>
                  ) : null}
                  <p className="mt-1 whitespace-pre-line text-zinc-700">
                    {t("Visual Structure", "画面结构")}: {itemStructure}
                  </p>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="mt-3 divide-y divide-zinc-200 text-sm">
          <section className="py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{t("Page Focus", "本页重点")}</p>
            <p className="mt-1 whitespace-pre-line font-semibold text-zinc-900">{normalizeSlashLineBreaks(pageFocus)}</p>
          </section>
          <section className="py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{t("On-screen Text", "画面文字")}</p>
            <p className="mt-1 whitespace-pre-line text-zinc-900">{t("Title", "标题")}: {normalizedTitle}</p>
            {normalizedSubtitle ? <p className="mt-1 whitespace-pre-line text-zinc-700">{t("Subtitle", "副标题")}: {normalizedSubtitle}</p> : null}
            {normalizedLabels.length ? (
              <p className="mt-1 whitespace-pre-line text-zinc-700">
                {t("Content", "内容")}:
                {"\n"}
                {normalizedLabels.join("\n")}
              </p>
            ) : null}
          </section>
          <section className="py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{t("Visual Structure", "画面结构")}</p>
            <p className="mt-1 whitespace-pre-line text-zinc-700">{normalizeSlashLineBreaks(visualStructure)}</p>
          </section>
          </div>
        )}
        {!locked && shouldShowDraftConfirmAction ? (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={isPlanningNextStep || !canProceed}
              onClick={handleDraftNext}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {isPlanningNextStep ? (
                <>
                  <LoaderCircle size={14} className="animate-spin" />
                  Thinking...
                </>
              ) : (
                "Confirm Draft & Next"
              )}
            </button>
          </div>
        ) : (
          <p className="mt-3 text-xs text-zinc-500">Final draft confirmed. Generation will continue from this version.</p>
        )}
      </>
    );
  };

  const renderSlideDraftReview = ({
    locked,
  }: {
    locked: boolean;
  }) => {
    if (intent !== "ppt" && intent !== "video") {
      return null;
    }
    if (!outlineItems.length && !slideDrafts.length) {
      return null;
    }
    const hasDetailedDrafts = slideDrafts.length > 0;
    return (
      <>
        {!!outlineItems.length && !hasDetailedDrafts ? (
          <ol className="mt-3 divide-y divide-zinc-200 text-sm leading-6 text-zinc-700">
            {outlineItems.map((item, index) => (
              <li key={`outline-${index + 1}-${item}`} className="py-2.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  {intent === "video" ? `Frame ${index + 1}` : `Page ${index + 1}`}
                </p>
                <p className="mt-1 font-semibold text-zinc-900">{compactDraftLine(item, 120)}</p>
              </li>
            ))}
          </ol>
        ) : null}
        {!!slideDrafts.length ? (
          <div className="mt-3 divide-y divide-zinc-200">
            {slideDrafts.map((slide, idx) => {
              const narration = formatDraftBlock(slide.body, 360);
              const isCover = slide.isCover === true;
              const bodyOrdinal = slideDrafts[0]?.isCover ? idx : idx + 1;
              const draftBody = formatDraftBlock(slide.body, 720);
              const visualLine = formatDraftVisualLine(slide.visual, 160);
              return (
                <section key={`${slide.page}-${slide.title}`} className="py-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                    {isCover ? (intent === "video" ? "Cover Frame" : "Cover Page") : intent === "video" ? `Frame ${bodyOrdinal}` : `Page ${bodyOrdinal}`}
                  </p>
                  <p className={`mt-1 whitespace-pre-line font-semibold text-zinc-900 ${isCover ? "text-lg leading-7" : "text-sm"}`}>
                    {normalizeSlashLineBreaks(compactDraftLine(slide.title, 120))}
                  </p>
                  {!isCover && intent === "video" ? (
                    <>
                      <p className="mt-1 whitespace-pre-line text-sm text-zinc-700">
                        <span className="font-medium text-zinc-800">{t("Scene", "画面")}:</span>{" "}
                        {normalizeSlashLineBreaks(visualLine)}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm text-zinc-600">
                        <span className="font-medium text-zinc-800">{t("Narration", "讲解")}:</span>{" "}
                        {normalizeSlashLineBreaks(narration)}
                      </p>
                    </>
                  ) : !isCover ? (
                    <>
                      {draftBody ? (
                        <p className="mt-1 whitespace-pre-line text-sm leading-6 text-zinc-700">
                          {normalizeSlashLineBreaks(draftBody)}
                        </p>
                      ) : null}
                      {visualLine ? (
                        <p className="mt-1.5 whitespace-pre-line text-xs leading-5 text-zinc-500">
                          <span className="font-medium text-zinc-600">{t("Visual", "画面")}:</span>{" "}
                          {normalizeSlashLineBreaks(visualLine)}
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </section>
              );
            })}
          </div>
        ) : null}
        {!locked && shouldShowDraftConfirmAction ? (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={isPlanningNextStep || !canProceed}
              onClick={onConfirm}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {isPlanningNextStep ? (
                <>
                  <LoaderCircle size={14} className="animate-spin" />
                  Thinking...
                </>
              ) : (
                "Confirm Draft & Next"
              )}
            </button>
          </div>
        ) : (
          <p className="mt-3 text-xs text-zinc-500">Final draft confirmed. Generation will continue from this version.</p>
        )}
      </>
    );
  };

  if (shouldUseEnglishUi) {
    return (
      <section className="space-y-5 px-1 py-4 text-[14px] leading-6 text-zinc-800">
        {userPrompt ? (
          <article className="ml-auto w-fit max-w-[78%] rounded-2xl bg-zinc-900 px-4 py-3 text-sm text-white">
            {userPrompt}
          </article>
        ) : null}

        {topicSuggestionLocked ? (
          <article className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-4 py-3">
            <div className="mb-1 text-[11px] text-zinc-500">KnowLens.ai · Previous Suggestions</div>
            <p className="text-sm leading-6 text-zinc-700">
              {topicSuggestionLockReason === "selected"
                ? "You picked one suggestion in this round. The previous options are now locked."
                : "You continued with manual input. The previous options are now locked and kept for reference."}
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {topicSuggestions.map((item) => {
                const active = item === lockedTopicSuggestion;
                return (
                  <button
                    key={`locked-weak-en-${item}`}
                    type="button"
                    disabled
                    className={`min-h-[72px] cursor-not-allowed rounded-xl border px-3 py-2.5 text-left text-sm leading-6 ${
                      active
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-300 bg-white text-zinc-500"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </article>
        ) : null}

        {showWorkflowSummaryCard ? (
          <article className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-4 py-3">
            <div className="mb-1 text-[11px] text-zinc-500">KnowLens.ai · Workflow</div>
            <p className="text-sm leading-6 text-zinc-700">{analysisText}</p>
            {summaryText ? <p className="mt-2 text-xs text-zinc-500">{summaryText}</p> : null}
          </article>
        ) : null}

        {showDirectionCard ? (
          <article className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-4 py-3">
            {showWeakPromptSuggestions ? (
              <div className="px-0.5 py-1">
                {topicSuggestionsLoading ? (
                  <>
                    <p className="text-[11px] text-zinc-500">KnowLens.ai</p>
                    <div className="mt-2 flex items-center gap-2 text-sm leading-6 text-zinc-700">
                      <LoaderCircle size={16} className="animate-spin text-zinc-500" />
                      <span>{prompt1LoadingMessage}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-zinc-900">Need a clearer request</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Your input is still too short for stable generation. Pick one option to continue, or type a new request below to replace these suggestions.
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {topicSuggestions.map((item) => (
                        <button
                          key={`weak-en-${item}`}
                          type="button"
                          disabled={topicSuggestionLocked}
                          onClick={() => onApplyTopicSuggestion(item)}
                          className={`min-h-[72px] rounded-xl border px-3 py-2.5 text-left text-sm leading-6 transition ${
                            selectedTopicSuggestion === item
                              ? "border-zinc-900 bg-zinc-900 text-white"
                              : topicSuggestionLocked
                                ? "cursor-not-allowed border-zinc-300 bg-white text-zinc-500"
                                : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-500 hover:bg-zinc-50"
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {!topicSuggestionsLoading && selectedTopicSuggestion ? (
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={handleTopicSuggestionNext}
                      className="inline-flex h-9 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
                    >
                      Next
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                {isDirectionLocked ? (
                  <p className="mb-3 text-xs text-zinc-500">Selected configuration: {configSummaryText}</p>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-3">
                  {intentOptions.map((option) => {
                    const active = selectedIntent === option.id;
                    return (
                      <button
                        key={`intent-en-${option.id}`}
                        type="button"
                        disabled={isDirectionLocked}
                        onClick={() => onSelectIntentOption(option.id)}
                        className={`rounded-xl border px-3 py-2 text-left transition ${
                          active
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : isDirectionLocked
                              ? "cursor-not-allowed border-zinc-300 bg-white text-zinc-500"
                              : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
                        }`}
                      >
                        <p className="text-sm font-medium">{option.label}</p>
                        <p className={`mt-1 text-xs ${active ? "text-zinc-200" : isDirectionLocked ? "text-zinc-400" : "text-zinc-500"}`}>{option.desc}</p>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3">
                  {selectedIntent === "poster" ? (
              <div className="px-0 py-0">
                <p className="text-sm font-medium text-zinc-900">Poster Options</p>
                <p className="mt-2 text-xs text-zinc-500">Poster Count</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((count) => (
                    <button
                      key={`poster-count-en-${count}`}
                      type="button"
                      disabled={isDirectionLocked}
                      onClick={() =>
                        handleCountSelect({
                          kind: "poster",
                          count,
                          onSelect: onPosterCountChange,
                          disabled: isDirectionLocked,
                        })
                      }
                      className={`rounded-lg border px-2.5 py-1 text-xs ${
                        posterCount === count
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : isDirectionLocked
                            ? "cursor-not-allowed border-zinc-300 bg-white text-zinc-500"
                            : "border-zinc-300 bg-white text-zinc-700"
                      }`}
                    >
                      {renderCountLabel("poster", count, "posters")}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs font-medium text-zinc-500">Aspect Ratio</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {posterSizeOptions.map((size) => {
                    const active = selectedPosterSize === size.id;
                    return (
                      <button
                        key={`poster-size-en-${size.id}`}
                        type="button"
                        disabled={isDirectionLocked}
                        onClick={() => onSelectPosterSize(size.id)}
                        className={`rounded-xl border px-3 py-2 text-left transition ${
                          active
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : isDirectionLocked
                              ? "cursor-not-allowed border-zinc-300 bg-white text-zinc-500"
                              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                        }`}
                      >
                        <p className="text-sm font-medium">{size.label}</p>
                        <p className={`mt-1 text-xs ${active ? "text-zinc-200" : isDirectionLocked ? "text-zinc-400" : "text-zinc-500"}`}>{size.desc}</p>
                      </button>
                    );
                  })}
                </div>
                {!isDirectionLocked ? (
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-zinc-500">Confirm settings before continuing.</p>
                    <button
                      type="button"
                      onClick={onConfirmConfig}
                      className="relative z-10 inline-flex h-9 cursor-pointer items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
                    >
                      Next
                    </button>
                  </div>
                ) : null}
              </div>
                  ) : null}

                  {selectedIntent === "ppt" ? (
              <div className="px-0 py-0">
                <p className="text-sm font-medium text-zinc-900">PPT Options</p>
                <p className="mt-2 text-xs text-zinc-500">PPT Slides</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {OUTPUT_COUNT_OPTIONS.map((count) => (
                    <button
                      key={`ppt-count-en-${count}`}
                      type="button"
                      disabled={isDirectionLocked}
                      onClick={() =>
                        handleCountSelect({
                          kind: "ppt",
                          count,
                          onSelect: onPptPageCountChange,
                          disabled: isDirectionLocked,
                        })
                      }
                      className={`rounded-lg border px-2.5 py-1 text-xs ${
                        pptPageCount === count
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : isDirectionLocked
                            ? "cursor-not-allowed border-zinc-300 bg-white text-zinc-500"
                            : "border-zinc-300 bg-white text-zinc-700"
                      }`}
                    >
                      {renderCountLabel("ppt", count, "slides")}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs font-medium text-zinc-500">Aspect Ratio</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {([
                    { id: "16:9", title: "16:9 Widescreen", desc: "Best for projectors and modern large displays." },
                    { id: "4:3", title: "4:3 Classic", desc: "Best for classroom decks and legacy displays." },
                  ] as const).map((ratio) => {
                    const active = pptRatio === ratio.id;
                    return (
                      <button
                        key={`ppt-ratio-en-${ratio.id}`}
                        type="button"
                        disabled={isDirectionLocked}
                        onClick={() => onPptRatioChange(ratio.id)}
                        className={`rounded-xl border px-3 py-2 text-left transition ${
                          active
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : isDirectionLocked
                              ? "cursor-not-allowed border-zinc-300 bg-white text-zinc-500"
                              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                        }`}
                      >
                        <p className="text-sm font-medium">{ratio.title}</p>
                        <p className={`mt-1 text-xs ${active ? "text-zinc-200" : isDirectionLocked ? "text-zinc-400" : "text-zinc-500"}`}>{ratio.desc}</p>
                      </button>
                    );
                  })}
                </div>
                {!isDirectionLocked ? (
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-zinc-500">Confirm settings before continuing.</p>
                    <button
                      type="button"
                      onClick={onConfirmConfig}
                      className="relative z-10 inline-flex h-9 cursor-pointer items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
                    >
                      Next
                    </button>
                  </div>
                ) : null}
              </div>
                  ) : null}

                  {selectedIntent === "video" ? (
              <div className="px-0 py-0">
                <p className="text-sm font-medium text-zinc-900">Video Options</p>
                <p className="mt-2 text-xs text-zinc-500">Storyboard Frames</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {OUTPUT_COUNT_OPTIONS.map((count) => (
                    <button
                      key={`video-count-en-${count}`}
                      type="button"
                      disabled={isDirectionLocked}
                      onClick={() =>
                        handleCountSelect({
                          kind: "video",
                          count,
                          onSelect: onVideoStoryboardCountChange,
                          disabled: isDirectionLocked,
                        })
                      }
                      className={`rounded-lg border px-2.5 py-1 text-xs ${
                        videoStoryboardCount === count
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : isDirectionLocked
                            ? "cursor-not-allowed border-zinc-300 bg-white text-zinc-500"
                            : "border-zinc-300 bg-white text-zinc-700"
                      }`}
                    >
                      {renderCountLabel("video", count, "frames")}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-zinc-500">Estimated duration: ~{videoStoryboardCount * 10}s</p>
                <p className="mt-2 text-xs font-medium text-zinc-500">Aspect Ratio</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {([
                    { id: "16:9", title: "16:9 Landscape", desc: "Best for horizontal explainers and web players." },
                    { id: "9:16", title: "9:16 Portrait", desc: "Best for short-video and full-screen mobile playback." },
                  ] as const).map((ratio) => {
                    const active = videoRatio === ratio.id;
                    return (
                      <button
                        key={`video-ratio-en-${ratio.id}`}
                        type="button"
                        disabled={isDirectionLocked}
                        onClick={() => onVideoRatioChange(ratio.id)}
                        className={`rounded-xl border px-3 py-2 text-left transition ${
                          active
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : isDirectionLocked
                              ? "cursor-not-allowed border-zinc-300 bg-white text-zinc-500"
                              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                        }`}
                      >
                        <p className="text-sm font-medium">{ratio.title}</p>
                        <p className={`mt-1 text-xs ${active ? "text-zinc-200" : isDirectionLocked ? "text-zinc-400" : "text-zinc-500"}`}>{ratio.desc}</p>
                      </button>
                    );
                  })}
                </div>
                {!isDirectionLocked ? (
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-zinc-500">Confirm settings before continuing.</p>
                    <button
                      type="button"
                      onClick={onConfirmConfig}
                      className="relative z-10 inline-flex h-9 cursor-pointer items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
                    >
                      Next
                    </button>
                  </div>
                ) : null}
              </div>
                  ) : null}
                </div>
              </>
            )}
          </article>
        ) : null}

        {!showDirectionGuide ? (
          <article className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-4 py-4">
            {!shouldShowDraftLoadingCard && intent === "poster" && posterDraft ? renderPosterDraftReview({ locked: false }) : null}

            {!shouldShowDraftLoadingCard && (intent === "ppt" || intent === "video") && (outlineItems.length || slideDrafts.length)
              ? renderSlideDraftReview({ locked: false })
              : null}

            {!configConfirmed ? (
              <p className="text-sm text-zinc-600">Confirm output settings first, then draft content will appear here.</p>
            ) : null}

            {shouldShowDraftLoadingCard ? (
              renderDraftLoadingCard()
            ) : null}
          </article>
        ) : null}

        {updateCardNodes}

        {styleConfirmed ? (
          <article className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-4 py-4">
            <h3 className="text-sm font-semibold text-zinc-900">Style Recommendation</h3>
            <p className="mt-1 text-[11px] leading-5 text-zinc-400">Style selection is confirmed for this generation.</p>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {styleOptions.map((style) => {
                const active = style.id === selectedStyleId;
                return (
                  <button
                    key={`locked-style-en-${style.id}`}
                    type="button"
                    disabled
                    className={`group relative flex h-full cursor-not-allowed flex-col overflow-hidden rounded-2xl border p-0 text-left appearance-none ${
                      active
                        ? selectedStyleCardClass
                        : "border-zinc-200 bg-white"
                    }`}
                  >
                    {active ? (
                      <span className={selectedStyleBadgeClass}>
                        <Check size={12} />
                      </span>
                    ) : null}
                    <div className={STYLE_COVER_FRAME_CLASS}>
                      <StyleCover style={style} />
                      {supportsHoverDescription ? (
                        <div className="pointer-events-none absolute inset-x-2 bottom-2 hidden translate-y-1 rounded-md bg-zinc-950/72 px-2 py-1.5 text-[11px] leading-4 text-white opacity-0 transition-all duration-200 lg:block lg:group-hover:translate-y-0 lg:group-hover:opacity-100">
                          <p className="whitespace-normal break-words">{styleHoverDescription(style)}</p>
                        </div>
                      ) : null}
                    </div>
                    <div className={STYLE_CARD_LABEL_CLASS}>
                      <p className={`text-sm font-semibold leading-5 ${active ? "text-zinc-950" : "text-zinc-500"}`}>
                        {styleDisplayName(style)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 text-sm text-zinc-600">
              Current style:
              <span className="ml-1 rounded-lg bg-zinc-100 px-2 py-1 font-medium text-zinc-900">
                {styleDisplayName(selectedStyle)}
              </span>
            </div>
          </article>
        ) : null}

        {showStyleStage ? (
          <article className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-4 py-4">
            <h3 className="text-sm font-semibold text-zinc-900">Style Recommendation</h3>
            <p className="mt-1 text-[11px] leading-5 text-zinc-400">
              Select one style card. Hover each card to preview the visual tone and best-fit use cases.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {styleOptions.map((style) => (
                <button
                  key={`style-en-${style.id}`}
                  type="button"
                  ref={(node) => {
                    styleButtonRefs.current[style.id] = node;
                  }}
                  onClick={() => onSelectStyle(style.id)}
                  className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border p-0 text-left transition appearance-none ${
                    style.id === selectedStyleId
                      ? selectedStyleCardClass
                      : "border-zinc-200 bg-white hover:border-zinc-400 hover:shadow-[0_8px_18px_rgba(24,24,27,0.12)]"
                  }`}
                >
                  {style.id === selectedStyleId ? (
                    <span className={selectedStyleBadgeClass}>
                      <Check size={12} />
                    </span>
                  ) : null}
                  <div className={STYLE_COVER_FRAME_CLASS}>
                    <StyleCover style={style} />
                    {supportsHoverDescription ? (
                      <div className="pointer-events-none absolute inset-x-2 bottom-2 hidden translate-y-1 rounded-md bg-zinc-950/72 px-2 py-1.5 text-[11px] leading-4 text-white opacity-0 transition-all duration-200 lg:block lg:group-hover:translate-y-0 lg:group-hover:opacity-100">
                        <p className="whitespace-normal break-words">{styleHoverDescription(style)}</p>
                      </div>
                    ) : null}
                  </div>
                  <div className={STYLE_CARD_LABEL_CLASS}>
                    <p className={`text-sm font-semibold leading-5 ${style.id === selectedStyleId ? "text-zinc-950" : "text-zinc-600"}`}>
                      {styleDisplayName(style)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-zinc-200 bg-white px-3 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-zinc-600">
                  Current style:
                  <span className="ml-1 rounded-lg bg-zinc-100 px-2 py-1 font-medium text-zinc-900">
                    {styleDisplayName(selectedStyle)}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={isPlanningStyleStep}
                  onClick={handleStyleNext}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400 sm:w-auto"
                >
                  {isPlanningStyleStep ? (
                    <>
                      <LoaderCircle size={14} className="animate-spin" />
                      Thinking...
                    </>
                  ) : (
                    "Next"
                  )}
                </button>
              </div>
            </div>
          </article>
        ) : null}

        {showBillingRecord ? (
          <article className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-4 py-4">
            <h3 className="text-sm font-semibold text-zinc-900">
              {intent === "poster" ? "Poster Billing Summary" : "Generation Billing Summary"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-zinc-700">
              Review charges before generation.
            </p>
            <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200">
              <div className="grid grid-cols-[160px_minmax(0,1fr)] text-sm">
                <p className="whitespace-nowrap border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-500">Selected Style</p>
                <p className="border-b border-zinc-200 px-3 py-2 text-zinc-800">{billingSummary.styleName}</p>
                <p className="whitespace-nowrap border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-500">Language Model</p>
                <p className="border-b border-zinc-200 px-3 py-2 text-zinc-700">
                  {billingSummary.languageModelCredits} credits
                  <span className="ml-1 text-zinc-500">
                    ({billingSummary.languageModelLabel || "Gemini 3"})
                  </span>
                </p>
                <p className="whitespace-nowrap border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-500">Image Model</p>
                <p className="border-b border-zinc-200 px-3 py-2 text-zinc-700">
                  {billingSummary.standardOutputCount} × {billingSummary.promoCreditsPerOutput} credits
                  <span className="ml-1 text-zinc-500">
                    ({imageBillingModelLabel} · {imageBillingDiscountText})
                  </span>
                </p>
                {(billingSummary.ttsNarrationCredits ?? 0) > 0 ? (
                  <>
                    <p className="whitespace-nowrap border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-500">TTS Narration</p>
                    <p className="border-b border-zinc-200 px-3 py-2 text-zinc-700">
                      {billingSummary.ttsNarrationCredits} credits
                      <span className="ml-1 text-zinc-500">
                        ({ttsBillingModelLabel} · {billingSummary.ttsNarrationCharCount ?? 0} chars)
                      </span>
                    </p>
                  </>
                ) : null}
                <p className="whitespace-nowrap border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-600">Total</p>
                <p className="px-3 py-2 text-base font-semibold text-zinc-900">{billingSummary.totalCost} credits</p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {billingMessageText ? <p className={`text-sm ${billingMessageClass}`}>{billingMessageText}</p> : <span />}
              {showBillingConfirm ? (
                <button
                  data-testid="confirm-generate-button"
                  type="button"
                  disabled={isPlanningBillingStep}
                  onClick={handleBillingConfirm}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400 sm:w-auto"
                >
                  {isPlanningBillingStep ? (
                    <>
                      <LoaderCircle size={14} className="animate-spin" />
                      Thinking...
                    </>
                  ) : billingConfirmed ? (
                    "Confirmed, generating..."
                  ) : (
                    "Confirm Charge & Generate"
                  )}
                </button>
              ) : (
                <span className="inline-flex w-full items-center justify-center rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 sm:w-auto">
                  Confirmed
                </span>
              )}
            </div>
          </article>
        ) : null}

        {renderOutputSummaryCard()}

      </section>
    );
  }

  return (
    <section className="space-y-5 px-1 py-4 text-[14px] leading-6 text-zinc-800">
      {userPrompt ? (
        <article className="ml-auto w-fit max-w-[78%] rounded-2xl bg-zinc-900 px-4 py-3 text-sm text-white">
          {userPrompt}
        </article>
      ) : null}

      {topicSuggestionLocked && lockedTopicSuggestion ? (
        <article className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-4 py-3">
          <div className="mb-1 text-[11px] text-zinc-500">KnowLens.ai · Topic Selection</div>
          <p className="text-sm leading-6 text-zinc-700">Topic selected and locked for this session:</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {topicSuggestions.map((item) => {
              const active = item === lockedTopicSuggestion;
              return (
                <button
                  key={`locked-${item}`}
                  type="button"
                  disabled
                  className={`min-h-[72px] cursor-not-allowed rounded-xl border px-3 py-2.5 text-left text-sm leading-6 ${
                    active
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-300 bg-white text-zinc-500"
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </article>
      ) : null}

      {showPersistentDirectionSummary ? (
        <article className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-4 py-3">
          <div className="mb-1 text-[11px] text-zinc-500">KnowLens.ai · Output Direction</div>
          <p className="text-sm leading-6 text-zinc-700">Output direction confirmed for the current session:</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {intentOptions.map((option) => {
              const active = option.id === selectedIntent;
              return (
                <button
                  key={`locked-intent-${option.id}`}
                  type="button"
                  disabled
                  className={`cursor-not-allowed rounded-xl border px-3 py-2 text-left ${
                    active
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-300 bg-white text-zinc-500"
                  }`}
                >
                  <p className="text-sm font-medium">{option.label}</p>
                  <p className={`mt-1 text-xs ${active ? "text-zinc-200" : "text-zinc-400"}`}>{option.desc}</p>
                </button>
              );
            })}
          </div>

          {selectedIntent === "ppt" ? (
            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3">
              <p className="text-xs font-medium text-zinc-500">PPT Slides</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {OUTPUT_COUNT_OPTIONS.map((count) => (
                  <button
                    key={`locked-ppt-page-${count}`}
                    type="button"
                    disabled
                    className={`cursor-not-allowed rounded-lg border px-2.5 py-1 text-xs ${
                      pptPageCount === count
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-300 bg-white text-zinc-500"
                    }`}
                  >
                    {renderCountLabel("ppt", count, "slides")}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs font-medium text-zinc-500">Aspect Ratio</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {([
                  { id: "16:9", title: "16:9 Widescreen", desc: "Best for projectors and modern large displays." },
                  { id: "4:3", title: "4:3 Classic", desc: "Best for classroom decks and legacy displays." },
                ] as const).map((ratio) => {
                  const active = pptRatio === ratio.id;
                  return (
                    <button
                      key={`locked-ppt-ratio-${ratio.id}`}
                      type="button"
                      disabled
                      className={`cursor-not-allowed rounded-xl border px-3 py-2 text-left ${
                        active
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-300 bg-white text-zinc-500"
                      }`}
                    >
                      <p className="text-sm font-medium">{ratio.title}</p>
                      <p className={`mt-1 text-xs ${active ? "text-zinc-200" : "text-zinc-400"}`}>{ratio.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {selectedIntent === "video" ? (
            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3">
              <p className="text-xs font-medium text-zinc-500">Storyboard Frames</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {OUTPUT_COUNT_OPTIONS.map((count) => (
                  <button
                    key={`locked-video-count-${count}`}
                    type="button"
                    disabled
                    className={`cursor-not-allowed rounded-lg border px-2.5 py-1 text-xs ${
                      videoStoryboardCount === count
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-300 bg-white text-zinc-500"
                    }`}
                  >
                    {renderCountLabel("video", count, "frames")}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs font-medium text-zinc-500">Aspect Ratio</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {([
                  { id: "16:9", title: "16:9 Landscape", desc: "Best for horizontal explainers and web players." },
                  { id: "9:16", title: "9:16 Portrait", desc: "Best for short-video and full-screen mobile playback." },
                ] as const).map((ratio) => {
                  const active = videoRatio === ratio.id;
                  return (
                    <button
                      key={`locked-video-ratio-${ratio.id}`}
                      type="button"
                      disabled
                      className={`cursor-not-allowed rounded-xl border px-3 py-2 text-left ${
                        active
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-300 bg-white text-zinc-500"
                      }`}
                    >
                      <p className="text-sm font-medium">{ratio.title}</p>
                      <p className={`mt-1 text-xs ${active ? "text-zinc-200" : "text-zinc-400"}`}>{ratio.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {selectedIntent === "poster" ? (
            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3">
              <p className="text-xs font-medium text-zinc-500">Poster Count</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((count) => (
                  <button
                    key={`locked-poster-count-${count}`}
                    type="button"
                    disabled
                    className={`cursor-not-allowed rounded-lg border px-2.5 py-1 text-xs ${
                      posterCount === count
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-300 bg-white text-zinc-500"
                    }`}
                  >
                    {renderCountLabel("poster", count, "posters")}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs font-medium text-zinc-500">Aspect Ratio</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {posterSizeOptions.map((size) => {
                  const active = selectedPosterSize === size.id;
                  return (
                    <button
                      key={`locked-poster-size-${size.id}`}
                      type="button"
                      disabled
                      className={`cursor-not-allowed rounded-xl border px-3 py-2 text-left ${
                        active
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-300 bg-white text-zinc-500"
                      }`}
                    >
                      <p className="text-sm font-medium">{size.label}</p>
                      <p className={`mt-1 text-xs ${active ? "text-zinc-200" : "text-zinc-400"}`}>{size.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <p className="mt-2 text-sm text-zinc-700">{configSummaryText}</p>
          <p className="mt-1 text-xs text-zinc-500">Direction settings are locked for this generated draft.</p>
        </article>
      ) : null}

      {showDirectionGuide ? (
        <article className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-4 py-3">
          {introPhase !== "ask" ? (
            <div className="space-y-2">
              <div className="text-[11px] text-zinc-500">KnowLens.ai</div>
              <div className="flex items-center gap-2 text-sm text-zinc-700">
                <LoaderCircle size={14} className="animate-spin text-zinc-500" />
                {introPhase === "analyzing"
                  ? "Understanding your topic and input content..."
                  : "Planning the best generation path..."}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm leading-6 text-zinc-800">
                {analysisText}
              </p>
              {!showWeakPromptSuggestions ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  {intentOptions.map((option) => {
                    const isSelected = selectedIntent === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => onSelectIntentOption(option.id)}
                        className={`rounded-xl border px-3 py-2 text-left transition ${
                          isSelected
                            ? "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800"
                            : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-700 hover:bg-zinc-50"
                        }`}
                      >
                        <p className="text-sm font-medium">{option.label}</p>
                        <p className={`mt-1 text-xs ${isSelected ? "text-zinc-200" : "text-zinc-500"}`}>
                          {option.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {showWeakPromptSuggestions ? (
                <div className="mt-3 px-0.5 py-1">
                  {topicSuggestionsLoading ? (
                    <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                      <p className="text-[11px] text-zinc-500">KnowLens.ai</p>
                      <div className="mt-2 flex items-center gap-2 text-xl leading-7 text-zinc-700">
                        <LoaderCircle size={16} className="animate-spin text-zinc-500" />
                        <span>{prompt1LoadingMessage}</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-zinc-900">Try These Topics</p>
                      <p className="mt-1 text-xs text-zinc-500">Pick one to continue with guided next steps.</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {topicSuggestions.map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => onApplyTopicSuggestion(item)}
                            className={`min-h-[72px] rounded-xl border px-3 py-2.5 text-left text-sm leading-6 transition ${
                              selectedTopicSuggestion === item
                                ? "border-zinc-900 bg-zinc-900 text-white"
                                : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-500 hover:bg-zinc-50"
                            }`}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {!topicSuggestionsLoading && selectedTopicSuggestion ? (
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                      onClick={handleTopicSuggestionNext}
                        className="inline-flex h-9 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
                      >
                        Next
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {!showWeakPromptSuggestions && selectedIntent === "ppt" ? (
                <div className="mt-3 px-0 py-0">
                  <p className="text-sm font-medium text-zinc-900">PPT Options</p>
                  <p className="mt-2 text-xs text-zinc-500">PPT Slides</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {OUTPUT_COUNT_OPTIONS.map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() =>
                          handleCountSelect({
                            kind: "ppt",
                            count,
                            onSelect: onPptPageCountChange,
                          })
                        }
                        className={`rounded-lg border px-2.5 py-1 text-xs ${
                          pptPageCount === count
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-300 bg-white text-zinc-700"
                        }`}
                      >
                        {renderCountLabel("ppt", count, "slides")}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs font-medium text-zinc-500">Aspect Ratio</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {([
                      { id: "16:9", title: "16:9 Widescreen", desc: "Best for projectors and modern large displays." },
                      { id: "4:3", title: "4:3 Classic", desc: "Best for classroom decks and legacy displays." },
                    ] as const).map((ratio) => {
                      const active = pptRatio === ratio.id;
                      return (
                        <button
                          key={ratio.id}
                          type="button"
                          onClick={() => onPptRatioChange(ratio.id)}
                          className={`rounded-xl border px-3 py-2 text-left transition ${
                            active
                              ? "border-zinc-900 bg-zinc-900 text-white"
                              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                          }`}
                        >
                          <p className="text-sm font-medium">{ratio.title}</p>
                          <p className={`mt-1 text-xs ${active ? "text-zinc-200" : "text-zinc-500"}`}>
                            {ratio.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-zinc-500">Confirm settings before continuing.</p>
                    <button
                      type="button"
                      onClick={onConfirmConfig}
                      className="inline-flex h-9 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}

              {!showWeakPromptSuggestions && selectedIntent === "video" ? (
                <div className="mt-3 px-0 py-0">
                  <p className="text-sm font-medium text-zinc-900">Video Options</p>
                  <p className="mt-2 text-xs text-zinc-500">Storyboard Frames</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {OUTPUT_COUNT_OPTIONS.map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() =>
                          handleCountSelect({
                            kind: "video",
                            count,
                            onSelect: onVideoStoryboardCountChange,
                          })
                        }
                        className={`rounded-lg border px-2.5 py-1 text-xs ${
                          videoStoryboardCount === count
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-300 bg-white text-zinc-700"
                        }`}
                      >
                        {renderCountLabel("video", count, "frames")}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">
                    Estimated duration: ~{videoStoryboardCount * 10}s (10s per frame)
                  </p>
                  <p className="mt-2 text-xs font-medium text-zinc-500">Aspect Ratio</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {([
                      { id: "16:9", title: "16:9 Landscape", desc: "Best for horizontal explainers and web players." },
                      { id: "9:16", title: "9:16 Portrait", desc: "Best for short-video and full-screen mobile playback." },
                    ] as const).map((ratio) => {
                      const active = videoRatio === ratio.id;
                      return (
                        <button
                          key={ratio.id}
                          type="button"
                          onClick={() => onVideoRatioChange(ratio.id)}
                          className={`rounded-xl border px-3 py-2 text-left transition ${
                            active
                              ? "border-zinc-900 bg-zinc-900 text-white"
                              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                          }`}
                        >
                          <p className="text-sm font-medium">{ratio.title}</p>
                          <p className={`mt-1 text-xs ${active ? "text-zinc-200" : "text-zinc-500"}`}>
                            {ratio.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-zinc-500">Confirm settings before continuing.</p>
                    <button
                      type="button"
                      onClick={onConfirmConfig}
                      className="inline-flex h-9 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}

              {!showWeakPromptSuggestions && selectedIntent === "poster" ? (
                <div className="mt-3 px-0 py-0">
                  <p className="text-sm font-medium text-zinc-900">Poster Options</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() =>
                          handleCountSelect({
                            kind: "poster",
                            count,
                            onSelect: onPosterCountChange,
                          })
                        }
                        className={`rounded-lg border px-2.5 py-1 text-xs ${
                          posterCount === count
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-300 bg-white text-zinc-700"
                        }`}
                      >
                        {renderCountLabel("poster", count, "posters")}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-xs font-medium text-zinc-500">Aspect Ratio</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {posterSizeOptions.map((size) => {
                      const active = selectedPosterSize === size.id;
                      return (
                        <button
                          key={size.id}
                          type="button"
                          onClick={() => onSelectPosterSize(size.id)}
                          className={`rounded-xl border px-3 py-2 text-left transition ${
                            active
                              ? "border-zinc-900 bg-zinc-900 text-white"
                              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                          }`}
                        >
                          <p className="text-sm font-medium">{size.label}</p>
                          <p className={`mt-1 text-xs ${active ? "text-zinc-200" : "text-zinc-500"}`}>
                            {size.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-zinc-500">Confirm settings before continuing.</p>
                    <button
                      type="button"
                      onClick={onConfirmConfig}
                      className="inline-flex h-9 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </article>
      ) : showMainSummaryBlock ? (
        <article className="max-w-[95%] rounded-2xl bg-transparent p-1">
          {!configConfirmed ? (
            <>
              <h3 className="text-sm font-semibold text-zinc-900">Let’s Confirm Your Request</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-700">{summaryText}</p>
            </>
          ) : null}

          {selectedIntent === "ppt" && !configConfirmed ? (
            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3">
              <p className="text-sm font-medium text-zinc-900">PPT Options</p>
              <p className="mt-2 text-xs font-medium text-zinc-500">PPT Slides</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {OUTPUT_COUNT_OPTIONS.map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() =>
                      handleCountSelect({
                        kind: "ppt",
                        count,
                        onSelect: onPptPageCountChange,
                      })
                    }
                    className={`rounded-lg border px-2.5 py-1 text-xs ${
                      pptPageCount === count
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-300 bg-white text-zinc-700"
                    }`}
                  >
                    {renderCountLabel("ppt", count, "slides")}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs font-medium text-zinc-500">Aspect Ratio</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {([
                  { id: "16:9", title: "16:9 Widescreen", desc: "Best for projectors and modern large displays." },
                  { id: "4:3", title: "4:3 Classic", desc: "Best for classroom decks and legacy displays." },
                ] as const).map((ratio) => {
                  const active = pptRatio === ratio.id;
                  return (
                    <button
                      key={ratio.id}
                      type="button"
                      onClick={() => onPptRatioChange(ratio.id)}
                      className={`rounded-xl border px-3 py-2 text-left transition ${
                        active
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                      }`}
                    >
                      <p className="text-sm font-medium">{ratio.title}</p>
                      <p className={`mt-1 text-xs ${active ? "text-zinc-200" : "text-zinc-500"}`}>
                        {ratio.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-zinc-500">Confirm settings before continuing.</p>
                <button
                  type="button"
                  onClick={onConfirmConfig}
                  className="inline-flex h-9 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}

          {selectedIntent === "video" && !configConfirmed ? (
            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3">
              <p className="text-sm font-medium text-zinc-900">Video Options</p>
              <p className="mt-2 text-xs font-medium text-zinc-500">Storyboard Frames</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {OUTPUT_COUNT_OPTIONS.map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() =>
                      handleCountSelect({
                        kind: "video",
                        count,
                        onSelect: onVideoStoryboardCountChange,
                      })
                    }
                    className={`rounded-lg border px-2.5 py-1 text-xs ${
                      videoStoryboardCount === count
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-300 bg-white text-zinc-700"
                    }`}
                  >
                    {renderCountLabel("video", count, "frames")}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                Estimated duration: ~{videoStoryboardCount * 10}s (10s per frame)
              </p>
              <p className="mt-2 text-xs font-medium text-zinc-500">Aspect Ratio</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {([
                  { id: "16:9", title: "16:9 Landscape", desc: "Best for horizontal explainers and web players." },
                  { id: "9:16", title: "9:16 Portrait", desc: "Best for short-video and full-screen mobile playback." },
                ] as const).map((ratio) => {
                  const active = videoRatio === ratio.id;
                  return (
                    <button
                      key={ratio.id}
                      type="button"
                      onClick={() => onVideoRatioChange(ratio.id)}
                      className={`rounded-xl border px-3 py-2 text-left transition ${
                        active
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                      }`}
                    >
                      <p className="text-sm font-medium">{ratio.title}</p>
                      <p className={`mt-1 text-xs ${active ? "text-zinc-200" : "text-zinc-500"}`}>
                        {ratio.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-zinc-500">Confirm settings before continuing.</p>
                <button
                  type="button"
                  onClick={onConfirmConfig}
                  className="inline-flex h-9 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}

          {!!missingHints.length && !configConfirmed ? (
            <div className="mt-3 rounded-xl border border-zinc-200 bg-white px-3 py-2.5">
              <p className="text-xs font-medium text-zinc-800">To generate high-quality output faster, I still need:</p>
              <ul className="mt-1 space-y-1 text-xs text-zinc-600">
                {missingHints.map((hint) => (
                  <li key={hint}>- {hint}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {selectedIntent === "poster" && !configConfirmed ? (
            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3">
              <p className="text-sm font-medium text-zinc-900">Poster Options</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() =>
                      handleCountSelect({
                        kind: "poster",
                        count,
                        onSelect: onPosterCountChange,
                      })
                    }
                    className={`rounded-lg border px-2.5 py-1 text-xs ${
                      posterCount === count
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-300 bg-white text-zinc-700"
                    }`}
                  >
                    {renderCountLabel("poster", count, "posters")}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs font-medium text-zinc-500">Aspect Ratio</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {posterSizeOptions.map((size) => {
                  const active = selectedPosterSize === size.id;
                  return (
                    <button
                      key={size.id}
                      type="button"
                      onClick={() => onSelectPosterSize(size.id)}
                      className={`rounded-xl border px-3 py-2 text-left transition ${
                        active
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                      }`}
                    >
                      <p className="text-sm font-medium">{size.label}</p>
                      <p className={`mt-1 text-xs ${active ? "text-zinc-200" : "text-zinc-500"}`}>
                        {size.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-zinc-500">Confirm settings before continuing.</p>
                <button
                  type="button"
                  onClick={onConfirmConfig}
                  className="inline-flex h-9 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}

          {!shouldShowDraftLoadingCard && intent === "poster" && posterDraft ? (
            <DraftContentCard>{renderPosterDraftReview({ locked: false })}</DraftContentCard>
          ) : null}

          {!shouldShowDraftLoadingCard && (intent === "ppt" || intent === "video") ? (
            <DraftContentCard>{renderSlideDraftReview({ locked: false })}</DraftContentCard>
          ) : null}

          {shouldShowDraftLoadingCard ? (
            <article className="mt-3 max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-4 py-4">
              {renderDraftLoadingCard()}
            </article>
          ) : null}

        </article>
      ) : null}

      {!showMainSummaryBlock && configConfirmed ? (
        <article className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-3 py-3">
          {!shouldShowDraftLoadingCard && intent === "poster" && posterDraft ? renderPosterDraftReview({ locked: true }) : null}

          {!shouldShowDraftLoadingCard && (intent === "ppt" || intent === "video") && outlineItems.length
            ? renderSlideDraftReview({ locked: true })
            : null}
          {shouldShowDraftLoadingCard ? (
            renderDraftLoadingCard()
          ) : null}
        </article>
      ) : null}

      {updateCardNodes}

      {styleConfirmed ? (
        <article className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-4 py-4">
          <h3 className="text-sm font-semibold text-zinc-900">Style Recommendation</h3>
          <p className="mt-1 text-[11px] leading-5 text-zinc-400">Style selection is confirmed for this generation.</p>

            <div className="mt-3 grid grid-cols-3 gap-3">
            {styleOptions.map((style) => {
              const active = style.id === selectedStyleId;
              return (
                <button
                  key={`locked-style-${style.id}`}
                  type="button"
                  disabled
                  className={`group relative flex h-full cursor-not-allowed flex-col overflow-hidden rounded-2xl border p-0 text-left appearance-none ${
                    active
                      ? selectedStyleCardClass
                      : "border-zinc-200 bg-white"
                  }`}
                >
                  {active ? (
                    <span className={selectedStyleBadgeClass}>
                      <Check size={12} />
                    </span>
                  ) : null}
                    <div className={STYLE_COVER_FRAME_CLASS}>
                    <StyleCover style={style} />
                    {supportsHoverDescription ? (
                      <div className="pointer-events-none absolute inset-x-2 bottom-2 hidden translate-y-1 rounded-md bg-zinc-950/72 px-2 py-1.5 text-[11px] leading-4 text-white opacity-0 transition-all duration-200 lg:block lg:group-hover:translate-y-0 lg:group-hover:opacity-100">
                        <p className="whitespace-normal break-words">{styleHoverDescription(style)}</p>
                      </div>
                    ) : null}
                  </div>
                  <div className={STYLE_CARD_LABEL_CLASS}>
                    <p className={`text-sm font-semibold leading-5 ${active ? "text-zinc-950" : "text-zinc-500"}`}>
                      {styleDisplayName(style)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-3 text-sm text-zinc-600">
            Current style:
            <span className="ml-1 rounded-lg bg-zinc-100 px-2 py-1 font-medium text-zinc-900">{styleDisplayName(selectedStyle)}</span>
          </div>
        </article>
      ) : null}

      {showStyleStage ? (
        <article className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-4 py-4">
          <h3 className="text-sm font-semibold text-zinc-900">Style Recommendation</h3>
          <p className="mt-1 text-[11px] leading-5 text-zinc-400">
            Select one style card. Hover each card to preview the visual tone and best-fit use cases.
          </p>

            <div className="mt-3 grid grid-cols-3 gap-3">
            {styleOptions.map((style) => (
              <button
                key={style.id}
                type="button"
                ref={(node) => {
                  styleButtonRefs.current[style.id] = node;
                }}
                onClick={() => onSelectStyle(style.id)}
                className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border p-0 text-left transition appearance-none ${
                  style.id === selectedStyleId
                    ? selectedStyleCardClass
                    : "border-zinc-200 bg-white hover:border-zinc-400 hover:shadow-[0_8px_18px_rgba(24,24,27,0.12)]"
                }`}
              >
                {style.id === selectedStyleId ? (
                  <span className={selectedStyleBadgeClass}>
                    <Check size={12} />
                  </span>
                ) : null}
                  <div className={STYLE_COVER_FRAME_CLASS}>
                  <StyleCover style={style} />
                  {supportsHoverDescription ? (
                    <div className="pointer-events-none absolute inset-x-2 bottom-2 hidden translate-y-1 rounded-md bg-zinc-950/72 px-2 py-1.5 text-[11px] leading-4 text-white opacity-0 transition-all duration-200 lg:block lg:group-hover:translate-y-0 lg:group-hover:opacity-100">
                      <p className="whitespace-normal break-words">{styleHoverDescription(style)}</p>
                    </div>
                  ) : null}
                </div>
                <div className={STYLE_CARD_LABEL_CLASS}>
                  <p className={`text-sm font-semibold leading-5 ${style.id === selectedStyleId ? "text-zinc-950" : "text-zinc-600"}`}>
                    {styleDisplayName(style)}
                  </p>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-zinc-200 bg-white px-3 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-zinc-600">
                Current style:
                <span className="ml-1 rounded-lg bg-zinc-100 px-2 py-1 font-medium text-zinc-900">
                  {styleDisplayName(selectedStyle)}
                </span>
              </div>
              <button
                type="button"
                disabled={isPlanningStyleStep}
                onClick={handleStyleNext}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400 sm:w-auto"
              >
                {isPlanningStyleStep ? (
                  <>
                    <LoaderCircle size={14} className="animate-spin" />
                    Thinking...
                  </>
                ) : (
                  "Next"
                )}
              </button>
            </div>
          </div>
        </article>
      ) : null}

      {showBillingRecord ? (
        <article className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-4 py-4">
          <h3 className="text-sm font-semibold text-zinc-900">
            {intent === "poster" ? "Poster Billing Summary" : "Generation Billing Summary"}
          </h3>
          <p className="mt-2 text-sm leading-6 text-zinc-700">
            Review charges before generation.
          </p>

            <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200">
              <div className="grid grid-cols-[160px_minmax(0,1fr)] text-sm">
                <p className="whitespace-nowrap border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-500">Selected Style</p>
                <p className="border-b border-zinc-200 px-3 py-2 text-zinc-800">{billingSummary.styleName}</p>
              <p className="whitespace-nowrap border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-500">Language Model</p>
              <p className="border-b border-zinc-200 px-3 py-2 text-zinc-700">
                {billingSummary.languageModelCredits} credits
                <span className="ml-1 text-zinc-500">
                  ({billingSummary.languageModelLabel || "Gemini 3"})
                </span>
              </p>
              <p className="whitespace-nowrap border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-500">Image Model</p>
              <p className="border-b border-zinc-200 px-3 py-2 text-zinc-700">
                {billingSummary.standardOutputCount} × {billingSummary.promoCreditsPerOutput} credits
                <span className="ml-1 text-zinc-500">
                  ({imageBillingModelLabel} · {imageBillingDiscountText})
                </span>
              </p>
              {(billingSummary.ttsNarrationCredits ?? 0) > 0 ? (
                <>
                  <p className="whitespace-nowrap border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-500">TTS Narration</p>
                  <p className="border-b border-zinc-200 px-3 py-2 text-zinc-700">
                    {billingSummary.ttsNarrationCredits} credits
                    <span className="ml-1 text-zinc-500">
                      ({ttsBillingModelLabel} · {billingSummary.ttsNarrationCharCount ?? 0} chars)
                    </span>
                  </p>
                </>
              ) : null}
              <p className="whitespace-nowrap border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-600">Total</p>
              <p className="px-3 py-2 text-base font-semibold text-zinc-900">{billingSummary.totalCost} credits</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {billingMessageText ? <p className={`text-sm ${billingMessageClass}`}>{billingMessageText}</p> : <span />}
            {showBillingConfirm ? (
                <button
                  data-testid="confirm-generate-button"
                  type="button"
                  disabled={isPlanningBillingStep}
                  onClick={handleBillingConfirm}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400 sm:w-auto"
                >
                {isPlanningBillingStep ? (
                  <>
                    <LoaderCircle size={14} className="animate-spin" />
                    Thinking...
                  </>
                ) : billingConfirmed ? (
                  "Confirmed, generating..."
                ) : (
                  "Confirm Charge & Generate"
                )}
              </button>
            ) : (
              <span className="inline-flex w-full items-center justify-center rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 sm:w-auto">
                Confirmed
              </span>
            )}
          </div>
        </article>
      ) : null}

      {renderOutputSummaryCard()}

    </section>
  );
});

ChatPanel.displayName = "ChatPanel";
