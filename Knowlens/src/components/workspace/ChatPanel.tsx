import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Check, LoaderCircle, Sparkles } from "lucide-react";

export type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  module: string;
  content: string;
};

export type WorkspaceIntent = "ppt" | "video" | "poster" | "unknown";

type SourceItem = {
  id: string;
  kind: "file" | "web" | "youtube";
  name: string;
  origin: string;
  status: "extracting" | "ready";
  excerpt: string;
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
  palette: string[];
  coverImage?: string;
};

function StyleCover({ style }: { style: StyleOption }) {
  const [imageFailed, setImageFailed] = useState(false);
  if (!style.coverImage || imageFailed) {
    return (
      <div
        className="h-full w-full"
        style={{
          background: `linear-gradient(160deg, ${style.palette[0]}55, ${style.palette[1]}88 55%, ${style.palette[2]})`,
        }}
      />
    );
  }
  return (
    <Image
      src={style.coverImage}
      alt={style.name}
      fill
      unoptimized
      className="object-cover"
      onError={() => setImageFailed(true)}
    />
  );
}

function DraftContentCard({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="mt-4 rounded-xl border border-zinc-200 bg-white px-3 py-3">{children}</div>;
}

type ChatPanelProps = {
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
  summaryText: string;
  updates: ChatTurn[];
  onConfirm: () => void;
  isPlanningNextStep: boolean;
  canProceed: boolean;
  showStyleStage: boolean;
  styleConfirmed: boolean;
  isPlanningStyleStep: boolean;
  showBillingConfirm: boolean;
  isPlanningBillingStep: boolean;
  billingConfirmed: boolean;
  canConfirmBilling: boolean;
  billingSummary: {
    styleName: string;
    totalCost: number;
    availableCredits: number;
    remainingCredits: number;
    standardOutputCount: number;
    promoCreditsPerOutput: number;
    regularCreditsPerOutput: number;
  };
  styleOptions: StyleOption[];
  selectedStyleId: string;
  onSelectStyle: (styleId: string) => void;
  onStyleNext: () => void;
  onConfirmBilling: () => void;
  visualizationTypeHint: string | null;
  thinkingState: {
    active: boolean;
    module: string;
    text: string;
  };
};

export function ChatPanel({
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
  summaryText,
  updates,
  onConfirm,
  isPlanningNextStep,
  canProceed,
  showStyleStage,
  styleConfirmed,
  isPlanningStyleStep,
  showBillingConfirm,
  isPlanningBillingStep,
  billingConfirmed,
  canConfirmBilling,
  billingSummary,
  styleOptions,
  selectedStyleId,
  onSelectStyle,
  onStyleNext,
  onConfirmBilling,
  visualizationTypeHint,
  thinkingState,
}: ChatPanelProps) {
  const isZh = outputLanguage === "zh";
  const shouldUseEnglishUi = !isZh;
  const t = (en: string, zh: string) => (isZh ? zh : en);
  const selectedStyle =
    styleOptions.find((style) => style.id === selectedStyleId) ?? styleOptions[0];
  const styleDisplayName = (style: StyleOption) => (isZh ? style.name : style.englishName ?? style.name);
  const [introPhase, setIntroPhase] = useState<"analyzing" | "planning" | "ask">("analyzing");
  const styleButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

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

  const recommendedLabel = useMemo(() => {
    const uiIntent = selectedIntent ?? recommendedIntent;
    const option = intentOptions.find((item) => item.id === uiIntent);
    return option?.label ?? t("Generate PPT", "生成PPT");
  }, [intentOptions, recommendedIntent, selectedIntent, isZh]);
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

  if (shouldUseEnglishUi) {
    return (
      <section className="space-y-5 px-1 py-4">
        {userPrompt ? (
          <article className="ml-auto w-fit max-w-[78%] rounded-2xl bg-zinc-900 px-4 py-3 text-sm text-white">
            {userPrompt}
          </article>
        ) : null}

        <article className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-4 py-3">
          <div className="mb-1 text-[11px] text-zinc-500">KnowLens.ai · Workflow</div>
          <p className="text-sm leading-6 text-zinc-700">{analysisText}</p>
          {summaryText ? <p className="mt-2 text-xs text-zinc-500">{summaryText}</p> : null}
        </article>

        {showDirectionGuide ? (
          <article className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-4 py-3">
            <div className="grid gap-2 sm:grid-cols-3">
              {intentOptions.map((option) => {
                const active = selectedIntent === option.id;
                return (
                  <button
                    key={`intent-en-${option.id}`}
                    type="button"
                    onClick={() => onSelectIntentOption(option.id)}
                    className={`rounded-xl border px-3 py-2 text-left transition ${
                      active
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
                    }`}
                  >
                    <p className="text-sm font-medium">{option.label}</p>
                    <p className={`mt-1 text-xs ${active ? "text-zinc-200" : "text-zinc-500"}`}>{option.desc}</p>
                  </button>
                );
              })}
            </div>

            {selectedIntent === "poster" ? (
              <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3">
                <p className="text-sm font-medium text-zinc-900">Poster Options</p>
                <p className="mt-2 text-xs text-zinc-500">Poster Count</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((count) => (
                    <button
                      key={`poster-count-en-${count}`}
                      type="button"
                      onClick={() => onPosterCountChange(count)}
                      className={`rounded-lg border px-2.5 py-1 text-xs ${
                        posterCount === count
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-300 bg-white text-zinc-700"
                      }`}
                    >
                      {count} posters
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-zinc-500">Size</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {posterSizeOptions.map((size) => {
                    const active = selectedPosterSize === size.id;
                    return (
                      <button
                        key={`poster-size-en-${size.id}`}
                        type="button"
                        onClick={() => onSelectPosterSize(size.id)}
                        className={`rounded-xl border px-3 py-2 text-left transition ${
                          active
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                        }`}
                      >
                        <p className="text-sm font-medium">{size.label}</p>
                        <p className={`mt-1 text-xs ${active ? "text-zinc-200" : "text-zinc-500"}`}>{size.desc}</p>
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

            {selectedIntent === "ppt" ? (
              <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3">
                <p className="text-sm font-medium text-zinc-900">PPT Options</p>
                <p className="mt-2 text-xs text-zinc-500">PPT Slides</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[8, 10, 12].map((count) => (
                    <button
                      key={`ppt-count-en-${count}`}
                      type="button"
                      onClick={() => onPptPageCountChange(count)}
                      className={`rounded-lg border px-2.5 py-1 text-xs ${
                        pptPageCount === count
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-300 bg-white text-zinc-700"
                      }`}
                    >
                      {count} slides
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-zinc-500">Aspect Ratio</p>
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
                        onClick={() => onPptRatioChange(ratio.id)}
                        className={`rounded-xl border px-3 py-2 text-left transition ${
                          active
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                        }`}
                      >
                        <p className="text-sm font-medium">{ratio.title}</p>
                        <p className={`mt-1 text-xs ${active ? "text-zinc-200" : "text-zinc-500"}`}>{ratio.desc}</p>
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

            {selectedIntent === "video" ? (
              <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3">
                <p className="text-sm font-medium text-zinc-900">Video Options</p>
                <p className="mt-2 text-xs text-zinc-500">Storyboard Frames</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[3, 4, 5, 6, 8, 10].map((count) => (
                    <button
                      key={`video-count-en-${count}`}
                      type="button"
                      onClick={() => onVideoStoryboardCountChange(count)}
                      className={`rounded-lg border px-2.5 py-1 text-xs ${
                        videoStoryboardCount === count
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-300 bg-white text-zinc-700"
                      }`}
                    >
                      {count} frames
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-zinc-500">Estimated duration: ~{videoStoryboardCount * 10}s</p>
                <p className="mt-2 text-xs text-zinc-500">Video Ratio</p>
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
                        onClick={() => onVideoRatioChange(ratio.id)}
                        className={`rounded-xl border px-3 py-2 text-left transition ${
                          active
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                        }`}
                      >
                        <p className="text-sm font-medium">{ratio.title}</p>
                        <p className={`mt-1 text-xs ${active ? "text-zinc-200" : "text-zinc-500"}`}>{ratio.desc}</p>
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
          </article>
        ) : null}

        {showStyleStage ? (
          <article className="max-w-[95%] px-1 py-1">
            <h3 className="text-sm font-semibold text-zinc-900">Style Recommendation</h3>
            <p className="mt-2 text-sm text-zinc-600">{selectedStyle.fit}</p>
            <div className="mt-3 grid grid-cols-3 gap-3 xl:grid-cols-4">
              {styleOptions.map((style) => (
                <button
                  key={`style-en-${style.id}`}
                  type="button"
                  ref={(node) => {
                    styleButtonRefs.current[style.id] = node;
                  }}
                  onClick={() => onSelectStyle(style.id)}
                  className={`relative rounded-2xl border p-2 text-left transition ${
                    style.id === selectedStyleId
                      ? "translate-y-[-1px] border-zinc-900 bg-white shadow-[0_10px_22px_rgba(24,24,27,0.24)] ring-2 ring-zinc-900/25"
                      : "border-zinc-200 bg-white opacity-85 hover:opacity-100 hover:bg-zinc-50"
                  }`}
                >
                  {style.id === selectedStyleId ? (
                    <span className="absolute right-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-white">
                      <Check size={12} />
                    </span>
                  ) : null}
                  <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-zinc-100">
                    <StyleCover style={style} />
                  </div>
                  <p className={`mt-2 text-xs font-medium ${style.id === selectedStyleId ? "text-zinc-950" : "text-zinc-600"}`}>
                    {styleDisplayName(style)}
                  </p>
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
                  onClick={onStyleNext}
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

        {showBillingConfirm ? (
          <article className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-4 py-4">
            <h3 className="text-sm font-semibold text-zinc-900">
              {intent === "poster" ? "Poster Generation Confirmation" : "Content Generation Confirmation"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-zinc-700">
              Usage estimation is ready. Confirm to start generation and deduct credits.
            </p>
            <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200">
              <div className="grid grid-cols-[92px_minmax(0,1fr)] text-sm">
                <p className="border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-500">Style</p>
                <p className="border-b border-zinc-200 px-3 py-2 text-zinc-800">{billingSummary.styleName}</p>
                <p className="border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-500">Cost</p>
                <p className="border-b border-zinc-200 px-3 py-2 font-semibold text-zinc-900">{billingSummary.totalCost} credits</p>
                <p className="border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-500">Formula</p>
                <p className="border-b border-zinc-200 px-3 py-2 text-zinc-700">
                  {billingSummary.standardOutputCount} × {billingSummary.promoCreditsPerOutput} credits
                  <span className="ml-1 text-zinc-500">(regular {billingSummary.regularCreditsPerOutput})</span>
                </p>
                <p className="border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-500">Balance</p>
                <p className="border-b border-zinc-200 px-3 py-2 text-zinc-700">{billingSummary.availableCredits} credits</p>
                <p className="border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-500">After deduction</p>
                <p className="px-3 py-2 text-zinc-700">{billingSummary.remainingCredits} credits</p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className={`text-sm ${canConfirmBilling ? "text-zinc-600" : "font-medium text-red-600"}`}>
                {canConfirmBilling
                  ? `Limited-time pricing applies: ${billingSummary.promoCreditsPerOutput} credits per standard output (regular ${billingSummary.regularCreditsPerOutput}).`
                  : "Insufficient credits. Please upgrade before confirming."}
              </p>
              <button
                type="button"
                disabled={isPlanningBillingStep || !canConfirmBilling}
                onClick={onConfirmBilling}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400 sm:w-auto"
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
                  "Confirm and Generate"
                )}
              </button>
            </div>
          </article>
        ) : null}

        {thinkingState.active ? (
          <article className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-4 py-3">
            <div className="mb-1 text-[11px] text-zinc-500">KnowLens.ai · {thinkingState.module}</div>
            <div className="flex items-center gap-2 text-sm text-zinc-700">
              <LoaderCircle size={14} className="animate-spin text-zinc-500" />
              {thinkingState.text}
            </div>
          </article>
        ) : null}
      </section>
    );
  }

  return (
    <section className="space-y-5 px-1 py-4">
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

      {configConfirmed && selectedIntent ? (
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
                {[8, 10, 12].map((count) => (
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
                    {count} slides
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
                {[3, 4, 5, 6, 8, 10].map((count) => (
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
                    {count} frames
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
                    {count} posters
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs font-medium text-zinc-500">Size</p>
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
          <p className="mt-1 text-xs text-zinc-500">To change settings, start a new configuration round.</p>
        </article>
      ) : null}

      {!!entrySources.length && !showDirectionGuide ? (
        <article className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-900">Recognized Source Inputs</h3>
          <div className="mt-2 space-y-1.5">
            {entrySources.map((item) => (
              <div key={item.id} className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                <p className="truncate text-xs font-medium text-zinc-900">
                  {item.name} · {item.kind === "youtube" ? "YouTube" : item.kind === "web" ? "Web" : "File"}
                </p>
                <p className="mt-0.5 truncate text-xs text-zinc-500">{item.origin}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-700">{item.excerpt}</p>
              </div>
            ))}
          </div>
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
                <div className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600">
                  <Sparkles size={12} className="text-zinc-500" />
                  Recommended first choice: {recommendedLabel}
                </div>
              ) : null}
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
                        onClick={onConfirmTopicSuggestion}
                        className="inline-flex h-9 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
                      >
                        Next
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {!showWeakPromptSuggestions && selectedIntent === "ppt" ? (
                <div className="mt-3 rounded-xl border border-zinc-200 bg-white px-3 py-3">
                  <p className="text-sm font-medium text-zinc-900">PPT Options</p>
                  <p className="mt-2 text-xs text-zinc-500">PPT Slides</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[8, 10, 12].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => onPptPageCountChange(count)}
                        className={`rounded-lg border px-2.5 py-1 text-xs ${
                          pptPageCount === count
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-300 bg-white text-zinc-700"
                        }`}
                      >
                        {count} slides
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">Aspect Ratio</p>
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
                <div className="mt-3 rounded-xl border border-zinc-200 bg-white px-3 py-3">
                  <p className="text-sm font-medium text-zinc-900">Video Options</p>
                  <p className="mt-2 text-xs text-zinc-500">Storyboard Frames</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[3, 4, 5, 6, 8, 10].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => onVideoStoryboardCountChange(count)}
                        className={`rounded-lg border px-2.5 py-1 text-xs ${
                          videoStoryboardCount === count
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-300 bg-white text-zinc-700"
                        }`}
                      >
                        {count} frames
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">
                    Estimated duration: ~{videoStoryboardCount * 10}s (10s per frame)
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">Video Ratio</p>
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
                <div className="mt-3 rounded-xl border border-zinc-200 bg-white px-3 py-3">
                  <p className="text-sm font-medium text-zinc-900">Poster Options</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => onPosterCountChange(count)}
                        className={`rounded-lg border px-2.5 py-1 text-xs ${
                          posterCount === count
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-300 bg-white text-zinc-700"
                        }`}
                      >
                        {count} posters
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-sm font-medium text-zinc-900">Choose Poster Size</p>
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
                {[8, 10, 12].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => onPptPageCountChange(count)}
                    className={`rounded-lg border px-2.5 py-1 text-xs ${
                      pptPageCount === count
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-300 bg-white text-zinc-700"
                    }`}
                  >
                    {count} slides
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
                {[3, 4, 5, 6, 8, 10].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => onVideoStoryboardCountChange(count)}
                    className={`rounded-lg border px-2.5 py-1 text-xs ${
                      videoStoryboardCount === count
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-300 bg-white text-zinc-700"
                    }`}
                  >
                    {count} frames
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                Estimated duration: ~{videoStoryboardCount * 10}s (10s per frame)
              </p>
              <p className="mt-2 text-xs font-medium text-zinc-500">Video Ratio</p>
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
                    onClick={() => onPosterCountChange(count)}
                    className={`rounded-lg border px-2.5 py-1 text-xs ${
                      posterCount === count
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-300 bg-white text-zinc-700"
                    }`}
                  >
                    {count} posters
                  </button>
                ))}
              </div>
              <p className="mt-3 text-sm font-medium text-zinc-900">Choose Poster Size</p>
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
            <DraftContentCard>
              <h4 className="text-sm font-semibold text-zinc-900">Poster Draft</h4>
              <p className="mt-2 text-lg font-semibold leading-7 text-zinc-900">{posterDraft.headline}</p>
              <p className="mt-1 text-sm text-zinc-600">{posterDraft.subtitle}</p>
              <p className="mt-3 text-sm leading-6 text-zinc-700">{posterDraft.body}</p>
              <ul className="mt-2 space-y-1 text-sm text-zinc-700">
                {posterDraft.points.map((point) => (
                  <li key={point}>- {point}</li>
                ))}
              </ul>
              {visualizationTypeHint ? (
                <p className="mt-3 text-xs text-zinc-500">Suggested visual type: {visualizationTypeHint}</p>
              ) : null}
              {posterDraft.layoutSuggestion ? (
                <p className="mt-1 text-xs text-zinc-500">Suggested layout: {posterDraft.layoutSuggestion}</p>
              ) : null}
              {posterDraft.visualElements?.length ? (
                <p className="mt-1 text-xs text-zinc-500">
                  Visual elements: {posterDraft.visualElements.join(" / ")}
                </p>
              ) : null}
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
                    "Next"
                  )}
                </button>
              </div>
            </DraftContentCard>
          ) : null}

          {(intent === "ppt" || intent === "video") ? (
            <DraftContentCard>
              <h4 className="text-sm font-semibold text-zinc-900">
                {intent === "video" ? "Video Storyboard Outline" : "Content Outline"}
              </h4>
              <ol className="mt-2 space-y-1 text-sm leading-6 text-zinc-700">
                {outlineItems.map((item, index) => (
                  <li key={item}>
                    {index + 1}. {item}
                  </li>
                ))}
              </ol>

              {!!slideDrafts.length ? (
                <div className="mt-4 border-t border-zinc-200/80 pt-4">
                  <h4 className="text-sm font-semibold text-zinc-900">
                    {intent === "video" ? "Storyboard Script Draft" : "Slide Copy Draft"}
                  </h4>
                  <div className="mt-2">
                    {slideDrafts.map((slide) => (
                      <section key={slide.page} className="border-b border-zinc-200/70 py-3 last:border-b-0">
                        <p className="text-sm font-semibold text-zinc-900">
                          Slide {slide.page}: {slide.title}
                        </p>
                        <p className="mt-1 whitespace-pre-line text-sm leading-6 text-zinc-700">{slide.body}</p>
                        <p className="mt-1 text-sm text-zinc-500">Visual direction: {slide.visual}</p>
                      </section>
                    ))}
                  </div>
                </div>
              ) : null}
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
                    "Next"
                  )}
                </button>
              </div>
            </DraftContentCard>
          ) : null}

        </article>
      ) : null}

      {!showMainSummaryBlock && configConfirmed ? (
        <article className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-3 py-3">
          {intent === "poster" && posterDraft ? (
            <>
              <h4 className="text-sm font-semibold text-zinc-900">Poster Draft</h4>
              <p className="mt-2 text-lg font-semibold leading-7 text-zinc-900">{posterDraft.headline}</p>
              <p className="mt-1 text-sm text-zinc-600">{posterDraft.subtitle}</p>
              <p className="mt-3 text-sm leading-6 text-zinc-700">{posterDraft.body}</p>
              <ul className="mt-2 space-y-1 text-sm text-zinc-700">
                {posterDraft.points.map((point) => (
                  <li key={`locked-poster-point-${point}`}>- {point}</li>
                ))}
              </ul>
              {visualizationTypeHint ? (
                <p className="mt-3 text-xs text-zinc-500">Suggested visual type: {visualizationTypeHint}</p>
              ) : null}
              {posterDraft.layoutSuggestion ? (
                <p className="mt-1 text-xs text-zinc-500">Suggested layout: {posterDraft.layoutSuggestion}</p>
              ) : null}
              {posterDraft.visualElements?.length ? (
                <p className="mt-1 text-xs text-zinc-500">Visual elements: {posterDraft.visualElements.join(" / ")}</p>
              ) : null}
              <p className="mt-3 text-xs text-zinc-500">Draft saved. Later generation will continue from this draft.</p>
            </>
          ) : null}

          {(intent === "ppt" || intent === "video") && outlineItems.length ? (
            <>
              <h4 className="text-sm font-semibold text-zinc-900">
                {intent === "video" ? "Video Storyboard Outline Draft" : "Content Outline Draft"}
              </h4>
              <ol className="mt-3 space-y-2 text-sm leading-6 text-zinc-700">
                {outlineItems.map((item, index) => (
                  <li key={`locked-outline-${index + 1}-${item}`} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                    <p className="font-medium text-zinc-900">
                      {index + 1}. {item}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      {intent === "video"
                        ? "This section will be expanded into camera action, main visual subject, text emphasis, and narration guidance."
                        : "This section will be expanded into slide copy, key bullets, and visual emphasis."}
                    </p>
                  </li>
                ))}
              </ol>

              {!!slideDrafts.length ? (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-zinc-900">
                    {intent === "video" ? "Storyboard Script Draft" : "Slide Copy Draft"}
                  </h4>
                  <div className="mt-3 space-y-2">
                    {slideDrafts.map((slide) => (
                      <section
                        key={`locked-slide-${slide.page}-${slide.title}`}
                        className="rounded-xl border border-zinc-200 bg-white px-3 py-3"
                      >
                        <p className="text-sm font-semibold text-zinc-900">
                          Slide {slide.page}: {slide.title}
                        </p>
                        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-zinc-700">{slide.body}</p>
                        <p className="mt-2 text-sm text-zinc-500">Visual direction: {slide.visual}</p>
                      </section>
                    ))}
                  </div>
                </div>
              ) : null}
              <p className="mt-3 text-xs text-zinc-500">Draft saved. Later generation will continue from this draft.</p>
            </>
          ) : null}
        </article>
      ) : null}

      {updates.map((update, idx) => (
        <article
          key={`${update.id}-${idx}`}
          className={`max-w-[95%] rounded-2xl px-4 py-3 text-sm ${
            update.role === "user" ? "ml-auto bg-zinc-900 text-white" : "bg-zinc-100/85 text-zinc-700"
          }`}
        >
          <div className={`mb-1 text-[11px] ${update.role === "user" ? "text-zinc-300" : "text-zinc-500"}`}>
            {update.role === "user" ? "You" : "KnowLens.ai"} · {update.module}
          </div>
          <p className="leading-6">{update.content}</p>
        </article>
      ))}

      {styleConfirmed ? (
        <article className="max-w-[95%] px-1 py-1">
          <h3 className="text-sm font-semibold text-zinc-900">Style Recommendation</h3>
          <p className="mt-2 text-sm text-zinc-600">{selectedStyle.fit}</p>

          <div className="mt-3 grid grid-cols-3 gap-3 xl:grid-cols-4">
            {styleOptions.map((style) => {
              const active = style.id === selectedStyleId;
              return (
                <button
                  key={`locked-style-${style.id}`}
                  type="button"
                  disabled
                  className={`relative cursor-not-allowed rounded-2xl border p-2 text-left ${
                    active
                      ? "translate-y-[-1px] border-zinc-900 bg-white shadow-[0_10px_22px_rgba(24,24,27,0.2)] ring-2 ring-zinc-900/20"
                      : "border-zinc-200 bg-white opacity-75"
                  }`}
                >
                  {active ? (
                    <span className="absolute right-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-white">
                      <Check size={12} />
                    </span>
                  ) : null}
                  <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-zinc-100">
                    <StyleCover style={style} />
                  </div>
                  <p className={`mt-2 text-xs font-medium ${active ? "text-zinc-950" : "text-zinc-500"}`}>
                    {styleDisplayName(style)}
                  </p>
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
        <article className="max-w-[95%] px-1 py-1">
          <h3 className="text-sm font-semibold text-zinc-900">Style Recommendation</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-700">
            Please confirm style first. It directly affects composition, information density, and visual pacing.
          </p>

          <p className="mt-3 text-sm text-zinc-600">{selectedStyle.fit}</p>

          <div className="mt-3 grid grid-cols-3 gap-3 xl:grid-cols-4">
            {styleOptions.map((style) => (
              <button
                key={style.id}
                type="button"
                ref={(node) => {
                  styleButtonRefs.current[style.id] = node;
                }}
                onClick={() => onSelectStyle(style.id)}
                className={`relative rounded-2xl border p-2 text-left transition ${
                  style.id === selectedStyleId
                    ? "translate-y-[-1px] border-zinc-900 bg-white shadow-[0_10px_22px_rgba(24,24,27,0.24)] ring-2 ring-zinc-900/25"
                    : "border-zinc-200 bg-white opacity-85 hover:opacity-100 hover:bg-zinc-50"
                }`}
              >
                {style.id === selectedStyleId ? (
                  <span className="absolute right-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-white">
                    <Check size={12} />
                  </span>
                ) : null}
                <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-zinc-100">
                  <StyleCover style={style} />
                </div>
                <p className={`mt-2 text-xs font-medium ${style.id === selectedStyleId ? "text-zinc-950" : "text-zinc-600"}`}>
                  {styleDisplayName(style)}
                </p>
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
                onClick={onStyleNext}
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

      {showBillingConfirm ? (
        <article className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-4 py-4">
          <h3 className="text-sm font-semibold text-zinc-900">
            {intent === "poster" ? "Poster Generation Confirmation" : "Content Generation Confirmation"}
          </h3>
          <p className="mt-2 text-sm leading-6 text-zinc-700">
            Usage estimation is ready based on current topic and style. Confirm to start generation and deduct credits.
          </p>

          <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200">
            <div className="grid grid-cols-[92px_minmax(0,1fr)] text-sm">
              <p className="border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-500">Style</p>
              <p className="border-b border-zinc-200 px-3 py-2 text-zinc-800">{billingSummary.styleName}</p>
              <p className="border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-500">Cost</p>
              <p className="border-b border-zinc-200 px-3 py-2 font-semibold text-zinc-900">
                {billingSummary.totalCost} credits
              </p>
              <p className="border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-500">Formula</p>
              <p className="border-b border-zinc-200 px-3 py-2 text-zinc-700">
                {billingSummary.standardOutputCount} × {billingSummary.promoCreditsPerOutput} credits
                <span className="ml-1 text-zinc-500">
                  (regular {billingSummary.regularCreditsPerOutput})
                </span>
              </p>
              <p className="border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-500">Balance</p>
              <p className="border-b border-zinc-200 px-3 py-2 text-zinc-700">
                {billingSummary.availableCredits} credits
              </p>
              <p className="border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-500">After deduction</p>
              <p className="px-3 py-2 text-zinc-700">{billingSummary.remainingCredits} credits</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className={`text-sm ${canConfirmBilling ? "text-zinc-600" : "font-medium text-red-600"}`}>
              {canConfirmBilling
                ? `On confirmation, limited-time pricing applies: ${billingSummary.promoCreditsPerOutput} credits per standard output (regular ${billingSummary.regularCreditsPerOutput}).`
                : "Insufficient credits. Please upgrade before confirming."}
            </p>
            <button
              type="button"
              disabled={isPlanningBillingStep || !canConfirmBilling}
              onClick={onConfirmBilling}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400 sm:w-auto"
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
                "Confirm and Generate"
              )}
            </button>
          </div>
        </article>
      ) : null}

      {thinkingState.active ? (
        <article className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-4 py-3">
          <div className="mb-1 text-[11px] text-zinc-500">KnowLens.ai · {thinkingState.module}</div>
          <div className="flex items-center gap-2 text-sm text-zinc-700">
            <LoaderCircle size={14} className="animate-spin text-zinc-500" />
            {thinkingState.text}
          </div>
        </article>
      ) : null}
    </section>
  );
}
