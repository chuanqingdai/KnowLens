import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Check, LoaderCircle, Lock } from "lucide-react";

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

const STYLE_COVER_JPG_ALLOWLIST = new Set([
  "Clean Science Infographic Style.jpg",
  "Premium Editorial Infographic Style.jpg",
  "Hero Science Cover Style.jpg",
  "Minimal Line Art Style.jpg",
  "Hand-drawn Explainer Style.jpg",
  "Cute 3D Educational Style.jpg",
  "3D Isometric Tech Style.jpg",
  "Dark Premium Tech Style.jpg",
  "Technical Blueprint Style.jpg",
  "Medical Educational Illustration Style.jpg",
  "Cinematic Science Illustration Style.jpg",
  "Premium Sketchnote Science Style.jpg",
]);

function styleCoverCandidates(coverImage?: string) {
  if (!coverImage) {
    return [];
  }
  const normalized = coverImage.trim();
  const [path, query = ""] = normalized.split("?");
  if (!path.startsWith("/style/") || !path.toLowerCase().endsWith(".jpg")) {
    return [];
  }
  const filename = decodeURIComponent(path.slice("/style/".length));
  if (!STYLE_COVER_JPG_ALLOWLIST.has(filename)) {
    return [];
  }
  return [query ? `${path}?${query}` : path];
}

function StyleCover({ style }: { style: StyleOption }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [coverSrc, setCoverSrc] = useState(() => styleCoverCandidates(style.coverImage)[0] ?? "");
  const candidates = useMemo(() => styleCoverCandidates(style.coverImage), [style.coverImage]);
  useEffect(() => {
    setImageFailed(false);
    setImageLoaded(false);
    setCoverSrc(candidates[0] ?? "");
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
      {!imageLoaded ? <div className="skeleton-shimmer absolute inset-0" /> : null}
      <Image
        src={coverSrc}
        alt={style.name}
        fill
        unoptimized
        sizes="(max-width: 1024px) 50vw, 25vw"
        className={`absolute inset-0 h-full w-full !rounded-none object-cover align-top transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setImageLoaded(true)}
        onError={() => {
          const currentIndex = candidates.findIndex((candidate) => candidate === coverSrc);
          const nextCandidate = candidates[currentIndex + 1];
          if (nextCandidate) {
            setCoverSrc(nextCandidate);
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

function normalizeSlashLineBreaks(text: string) {
  return text
    .replace(/\s*\/\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
    imageModelCredits: number;
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
  onUpgradeForCredits?: () => void;
  visualizationTypeHint: string | null;
  thinkingState: {
    active: boolean;
    module: string;
    text: string;
  };
  retryingErrorTurnIds?: Record<string, boolean>;
  onRetryErrorTurn?: (turnId: string) => void;
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
  retryingErrorTurnIds,
  onRetryErrorTurn,
}: ChatPanelProps) {
  const isZh = outputLanguage === "zh";
  const shouldUseEnglishUi = !isZh;
  const t = (en: string, zh: string) => (isZh ? zh : en);
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
      onUpgradeForCredits?.();
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
      onUpgradeForCredits?.();
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
  const showWorkflowSummaryCard = !(showWeakPromptSuggestions && showDirectionGuide) && !topicSuggestionLocked;
  const isDirectionLocked = configConfirmed && !showDirectionGuide;
  const shouldShowDraftConfirmAction = !showStyleStage && !showBillingConfirm && !styleConfirmed;
  const hasDraftContentCard =
    Boolean(posterDraft) ||
    ((intent === "ppt" || intent === "video") && (outlineItems.length > 0 || slideDrafts.length > 0));
  const draftGenerationLoadingActive =
    thinkingState.active &&
    /(draft|文稿|海报|分镜|poster|storyboard|ppt)/i.test(thinkingState.module);
  const billingMessageClass = generationConfirmError
    ? "font-medium text-red-600"
    : canConfirmBilling
      ? "text-zinc-600"
      : "font-medium text-red-600";
  const billingMessageText = generationConfirmError
    ? generationConfirmError
    : billingConfirmed
      ? isPlanningBillingStep
        ? "Billing confirmed. Generation is in progress."
        : "Billing confirmed. Check generation results on the canvas."
      : canConfirmBilling
        ? `Limited-time rate applied: ${billingSummary.promoCreditsPerOutput} credits per standard output (regular ${billingSummary.regularCreditsPerOutput}).`
        : "Insufficient credits. Please upgrade before confirming this charge.";

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
      const errorCode = update.meta?.code?.trim();
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
        <div className={`mb-1 text-[11px] ${update.role === "user" ? "text-zinc-300" : "text-zinc-500"}`}>
          {update.role === "user" ? "You" : "KnowLens.ai"} · {update.module}
        </div>
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
    const visibleTitle = formatPosterHeadline(posterDraft.headline);
    const visibleSubtitle = formatPosterSubtitle(posterDraft.subtitle);
    const visibleLabels = posterDraft.points
      .map((point) => compactDraftLine(formatPosterPoint(point), 80))
      .filter(Boolean)
      .slice(0, 4);
    const pageFocus =
      compactDraftLine(visibleLabels[0] || visibleSubtitle || visibleTitle, 120) ||
      t("Define one clear page focus.", "先定义这一页的单一重点。");
    const visualStructure =
      compactDraftLine(visualizationTypeHint || "", 72) ||
      compactDraftLine(posterDraft.layoutSuggestion || "", 100) ||
      t("Single clean infographic structure.", "单一清晰的信息图结构。");
    const planItems = posterPlanList
      .slice()
      .sort((a, b) => a.index - b.index)
      .slice(0, posterCount);
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
            {slideDrafts.map((slide) => {
              const narration = compactDraftLine(slide.body, 200);
              return (
                <section key={`${slide.page}-${slide.title}`} className="py-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                    {intent === "video" ? `Frame ${slide.page}` : `Page ${slide.page}`}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm font-semibold text-zinc-900">
                    {normalizeSlashLineBreaks(compactDraftLine(slide.title, 120))}
                  </p>
                  {intent === "video" ? (
                    <>
                      <p className="mt-1 whitespace-pre-line text-sm text-zinc-700">
                        {t("Storyboard content", "分镜内容")}: {normalizeSlashLineBreaks(compactDraftLine(slide.visual, 180))}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm text-zinc-600">
                        {t("Narration", "讲解文稿")}: {normalizeSlashLineBreaks(narration)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-1 whitespace-pre-line text-sm text-zinc-700">
                        {t("Page content", "页面内容")}: {normalizeSlashLineBreaks(compactDraftLine(slide.body, 360))}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm text-zinc-700">
                        {t("Visual structure", "画面结构")}: {normalizeSlashLineBreaks(compactDraftLine(slide.visual, 120))}
                      </p>
                    </>
                  )}
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
                {selectedTopicSuggestion ? (
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
            {intent === "poster" && posterDraft ? renderPosterDraftReview({ locked: false }) : null}

            {(intent === "ppt" || intent === "video") && (outlineItems.length || slideDrafts.length)
              ? renderSlideDraftReview({ locked: false })
              : null}

            {!configConfirmed ? (
              <p className="text-sm text-zinc-600">Confirm output settings first, then draft content will appear here.</p>
            ) : null}

            {configConfirmed && intent === "poster" && !posterDraft ? (
              <div className="flex items-center gap-2 text-sm text-zinc-700">
                <LoaderCircle size={14} className="animate-spin text-zinc-500" />
                {draftGenerationLoadingActive ? thinkingState.text : "Final draft is being generated. Please wait..."}
              </div>
            ) : null}

            {configConfirmed && (intent === "ppt" || intent === "video") && !outlineItems.length && !slideDrafts.length ? (
              <div className="flex items-center gap-2 text-sm text-zinc-700">
                <LoaderCircle size={14} className="animate-spin text-zinc-500" />
                {draftGenerationLoadingActive ? thinkingState.text : "Final draft is being generated. Please wait..."}
              </div>
            ) : null}
          </article>
        ) : null}

        {updateCardNodes}

        {styleConfirmed ? (
          <article className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-4 py-4">
            <h3 className="text-sm font-semibold text-zinc-900">Style Recommendation</h3>
            <p className="mt-1 text-[11px] leading-5 text-zinc-400">Style selection is confirmed for this generation.</p>
            <div className="mt-3 grid grid-cols-3 gap-3 xl:grid-cols-4">
              {styleOptions.map((style) => {
                const active = style.id === selectedStyleId;
                return (
                  <button
                    key={`locked-style-en-${style.id}`}
                    type="button"
                    disabled
                    className={`group relative cursor-not-allowed overflow-hidden rounded-2xl border p-0 text-left appearance-none ${
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
                    <div className="relative aspect-[9/16] w-full overflow-hidden bg-zinc-100 leading-none">
                      <StyleCover style={style} />
                      {supportsHoverDescription ? (
                        <div className="pointer-events-none absolute inset-x-2 bottom-2 hidden translate-y-1 rounded-md bg-zinc-950/72 px-2 py-1.5 text-[11px] leading-4 text-white opacity-0 transition-all duration-200 lg:block lg:group-hover:translate-y-0 lg:group-hover:opacity-100">
                          <p className="whitespace-normal break-words">{styleHoverDescription(style)}</p>
                        </div>
                      ) : null}
                    </div>
                    <div className="px-2.5 pb-2.5 pt-2">
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
            <div className="mt-3 grid grid-cols-3 gap-3 xl:grid-cols-4">
              {styleOptions.map((style) => (
                <button
                  key={`style-en-${style.id}`}
                  type="button"
                  ref={(node) => {
                    styleButtonRefs.current[style.id] = node;
                  }}
                  onClick={() => onSelectStyle(style.id)}
                  className={`group relative overflow-hidden rounded-2xl border p-0 text-left transition appearance-none ${
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
                  <div className="relative aspect-[9/16] w-full overflow-hidden bg-zinc-100 leading-none">
                    <StyleCover style={style} />
                    {supportsHoverDescription ? (
                      <div className="pointer-events-none absolute inset-x-2 bottom-2 hidden translate-y-1 rounded-md bg-zinc-950/72 px-2 py-1.5 text-[11px] leading-4 text-white opacity-0 transition-all duration-200 lg:block lg:group-hover:translate-y-0 lg:group-hover:opacity-100">
                        <p className="whitespace-normal break-words">{styleHoverDescription(style)}</p>
                      </div>
                    ) : null}
                  </div>
                  <div className="px-2.5 pb-2.5 pt-2">
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
                </p>
                <p className="whitespace-nowrap border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-500">Image Model</p>
                <p className="border-b border-zinc-200 px-3 py-2 text-zinc-700">
                  {billingSummary.standardOutputCount} × {billingSummary.promoCreditsPerOutput} credits
                  <span className="ml-1 text-zinc-500">
                    (<span className="line-through">{billingSummary.regularCreditsPerOutput} credits</span>)
                  </span>
                </p>
                <p className="whitespace-nowrap border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-600">Total</p>
                <p className="px-3 py-2 text-base font-semibold text-zinc-900">{billingSummary.totalCost} credits</p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className={`text-sm ${billingMessageClass}`}>{billingMessageText}</p>
              {showBillingConfirm ? (
                <button
                  data-testid="confirm-generate-button"
                  type="button"
                  disabled={isPlanningBillingStep}
                  onClick={handleBillingConfirm}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white sm:w-auto ${
                    !canConfirmBilling
                      ? "bg-amber-600 hover:bg-amber-500"
                      : "bg-zinc-900 hover:bg-zinc-700"
                  } disabled:cursor-not-allowed disabled:bg-zinc-400`}
                >
                  {isPlanningBillingStep ? (
                    <>
                      <LoaderCircle size={14} className="animate-spin" />
                      Thinking...
                    </>
                  ) : billingConfirmed ? (
                    "Confirmed, generating..."
                  ) : !canConfirmBilling ? (
                    "Insufficient credits"
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
                  {selectedTopicSuggestion ? (
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

          {intent === "poster" && posterDraft ? (
            <DraftContentCard>{renderPosterDraftReview({ locked: false })}</DraftContentCard>
          ) : null}

          {(intent === "ppt" || intent === "video") ? (
            <DraftContentCard>{renderSlideDraftReview({ locked: false })}</DraftContentCard>
          ) : null}

        </article>
      ) : null}

      {!showMainSummaryBlock && configConfirmed ? (
        <article className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-3 py-3">
          {intent === "poster" && posterDraft ? renderPosterDraftReview({ locked: true }) : null}

          {(intent === "ppt" || intent === "video") && outlineItems.length
            ? renderSlideDraftReview({ locked: true })
            : null}
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
                  className={`group relative cursor-not-allowed overflow-hidden rounded-2xl border p-0 text-left appearance-none ${
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
                    <div className="relative aspect-[471/836] w-full overflow-hidden bg-zinc-100 leading-none">
                    <StyleCover style={style} />
                    {supportsHoverDescription ? (
                      <div className="pointer-events-none absolute inset-x-2 bottom-2 hidden translate-y-1 rounded-md bg-zinc-950/72 px-2 py-1.5 text-[11px] leading-4 text-white opacity-0 transition-all duration-200 lg:block lg:group-hover:translate-y-0 lg:group-hover:opacity-100">
                        <p className="whitespace-normal break-words">{styleHoverDescription(style)}</p>
                      </div>
                    ) : null}
                  </div>
                  <div className="px-2.5 pb-2.5 pt-2">
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
                className={`group relative overflow-hidden rounded-2xl border p-0 text-left transition appearance-none ${
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
                  <div className="relative aspect-[471/836] w-full overflow-hidden bg-zinc-100 leading-none">
                  <StyleCover style={style} />
                  {supportsHoverDescription ? (
                    <div className="pointer-events-none absolute inset-x-2 bottom-2 hidden translate-y-1 rounded-md bg-zinc-950/72 px-2 py-1.5 text-[11px] leading-4 text-white opacity-0 transition-all duration-200 lg:block lg:group-hover:translate-y-0 lg:group-hover:opacity-100">
                      <p className="whitespace-normal break-words">{styleHoverDescription(style)}</p>
                    </div>
                  ) : null}
                </div>
                <div className="px-2.5 pb-2.5 pt-2">
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
              </p>
              <p className="whitespace-nowrap border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-500">Image Model</p>
              <p className="border-b border-zinc-200 px-3 py-2 text-zinc-700">
                {billingSummary.standardOutputCount} × {billingSummary.promoCreditsPerOutput} credits
                <span className="ml-1 text-zinc-500">
                  (<span className="line-through">{billingSummary.regularCreditsPerOutput} credits</span>)
                </span>
              </p>
              <p className="whitespace-nowrap border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-600">Total</p>
              <p className="px-3 py-2 text-base font-semibold text-zinc-900">{billingSummary.totalCost} credits</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className={`text-sm ${billingMessageClass}`}>{billingMessageText}</p>
            {showBillingConfirm ? (
                <button
                  data-testid="confirm-generate-button"
                  type="button"
                  disabled={isPlanningBillingStep}
                  onClick={handleBillingConfirm}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white sm:w-auto ${
                    !canConfirmBilling
                      ? "bg-amber-600 hover:bg-amber-500"
                      : "bg-zinc-900 hover:bg-zinc-700"
                  } disabled:cursor-not-allowed disabled:bg-zinc-400`}
                >
                {isPlanningBillingStep ? (
                  <>
                    <LoaderCircle size={14} className="animate-spin" />
                    Thinking...
                  </>
                ) : billingConfirmed ? (
                  "Confirmed, generating..."
                ) : !canConfirmBilling ? (
                  "Insufficient credits"
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

    </section>
  );
});

ChatPanel.displayName = "ChatPanel";
