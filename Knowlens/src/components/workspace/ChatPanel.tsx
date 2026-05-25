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

type ChatPanelProps = {
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
  const selectedStyle =
    styleOptions.find((style) => style.id === selectedStyleId) ?? styleOptions[0];
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
    return option?.label ?? "生成PPT";
  }, [intentOptions, recommendedIntent, selectedIntent]);
  const configSummaryText = useMemo(() => {
    if (!configConfirmed) {
      return "";
    }
    if (selectedIntent === "poster") {
      return `已确认：${posterCount} 张，${
        posterSizeOptions.find((item) => item.id === selectedPosterSize)?.label ?? selectedPosterSize ?? "9:16 竖版"
      }。`;
    }
    if (selectedIntent === "video") {
      return `已确认：${videoStoryboardCount} 个分镜（约 ${videoStoryboardCount * 10} 秒），${videoRatio} 比例。`;
    }
    if (selectedIntent === "ppt") {
      return `已确认：${pptPageCount} 页，${pptRatio} 比例。`;
    }
    return "已确认当前配置。";
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
  ]);
  const showMainSummaryBlock = !showDirectionGuide && !showStyleStage && !showBillingConfirm;

  return (
    <section className="space-y-5 px-1 py-4">
      {userPrompt ? (
        <article className="ml-auto w-fit max-w-[78%] rounded-2xl bg-zinc-900 px-4 py-3 text-sm text-white">
          {userPrompt}
        </article>
      ) : null}

      {topicSuggestionLocked && lockedTopicSuggestion ? (
        <article className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-4 py-3">
          <div className="mb-1 text-[11px] text-zinc-500">KnowLens.ai · 主题选择</div>
          <p className="text-sm leading-6 text-zinc-700">你选择了主题，已锁定为当前会话输入：</p>
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
          <div className="mb-1 text-[11px] text-zinc-500">KnowLens.ai · 生成方向</div>
          <p className="text-sm leading-6 text-zinc-700">你已确认生成方向，当前会话按该方向继续：</p>
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
              <p className="text-xs font-medium text-zinc-500">PPT页数</p>
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
                    {count} 页
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs font-medium text-zinc-500">比例</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {([
                  { id: "16:9", title: "16:9 宽屏", desc: "适合投影、演示与现代大屏展示" },
                  { id: "4:3", title: "4:3 经典", desc: "适合课堂课件与传统显示设备" },
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
              <p className="text-xs font-medium text-zinc-500">分镜数量</p>
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
                    {count} 个分镜
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs font-medium text-zinc-500">比例</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {([
                  { id: "16:9", title: "16:9 横版", desc: "适合横屏讲解、B站与网页播放器" },
                  { id: "9:16", title: "9:16 竖版", desc: "适合短视频平台与手机全屏播放" },
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
              <p className="text-xs font-medium text-zinc-500">海报张数</p>
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
                    {count} 张
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs font-medium text-zinc-500">尺寸</p>
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
          <p className="mt-1 text-xs text-zinc-500">如需变更，请重新开启一轮配置。</p>
        </article>
      ) : null}

      {!!entrySources.length && !showDirectionGuide ? (
        <article className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-900">已识别输入素材</h3>
          <div className="mt-2 space-y-1.5">
            {entrySources.map((item) => (
              <div key={item.id} className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                <p className="truncate text-xs font-medium text-zinc-900">
                  {item.name} · {item.kind === "youtube" ? "YouTube" : item.kind === "web" ? "网页" : "文件"}
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
                  ? "正在理解你的主题和输入内容..."
                  : "正在规划最合适的生成路径..."}
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
                  推荐先选：{recommendedLabel}
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
                  <p className="text-sm font-medium text-zinc-900">试试这些主题</p>
                  <p className="mt-1 text-xs text-zinc-500">先选一个你感兴趣的内容，我会继续引导下一步。</p>
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
                        下一步
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {!showWeakPromptSuggestions && selectedIntent === "ppt" ? (
                <div className="mt-3 rounded-xl border border-zinc-200 bg-white px-3 py-3">
                  <p className="text-sm font-medium text-zinc-900">PPT 生成选项</p>
                  <p className="mt-2 text-xs text-zinc-500">PPT页数</p>
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
                        {count} 页
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">比例</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {([
                      { id: "16:9", title: "16:9 宽屏", desc: "适合投影、演示与现代大屏展示" },
                      { id: "4:3", title: "4:3 经典", desc: "适合课堂课件与传统显示设备" },
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
                    <p className="text-xs text-zinc-500">先确认配置，再进入下一步</p>
                    <button
                      type="button"
                      onClick={onConfirmConfig}
                      className="inline-flex h-9 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
                    >
                      下一步
                    </button>
                  </div>
                </div>
              ) : null}

              {!showWeakPromptSuggestions && selectedIntent === "video" ? (
                <div className="mt-3 rounded-xl border border-zinc-200 bg-white px-3 py-3">
                  <p className="text-sm font-medium text-zinc-900">视频生成选项</p>
                  <p className="mt-2 text-xs text-zinc-500">分镜数量</p>
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
                        {count} 个分镜
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">
                    预计时长：约 {videoStoryboardCount * 10} 秒（每个分镜按 10 秒计算）
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">视频比例</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {([
                      { id: "16:9", title: "16:9 横版", desc: "适合横屏讲解、B站与网页播放器" },
                      { id: "9:16", title: "9:16 竖版", desc: "适合短视频平台与手机全屏播放" },
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
                    <p className="text-xs text-zinc-500">先确认配置，再进入下一步</p>
                    <button
                      type="button"
                      onClick={onConfirmConfig}
                      className="inline-flex h-9 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
                    >
                      下一步
                    </button>
                  </div>
                </div>
              ) : null}

              {!showWeakPromptSuggestions && selectedIntent === "poster" ? (
                <div className="mt-3 rounded-xl border border-zinc-200 bg-white px-3 py-3">
                  <p className="text-sm font-medium text-zinc-900">海报生成选项</p>
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
                        {count} 张
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-sm font-medium text-zinc-900">请选择海报尺寸</p>
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
                    <p className="text-xs text-zinc-500">先确认配置，再进入下一步</p>
                    <button
                      type="button"
                      onClick={onConfirmConfig}
                      className="inline-flex h-9 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
                    >
                      下一步
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
              <h3 className="text-sm font-semibold text-zinc-900">我先帮你确认需求</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-700">{summaryText}</p>
            </>
          ) : null}

          {selectedIntent === "ppt" && !configConfirmed ? (
            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3">
              <p className="text-sm font-medium text-zinc-900">PPT 生成选项</p>
              <p className="mt-2 text-xs font-medium text-zinc-500">PPT页数</p>
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
                    {count} 页
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs font-medium text-zinc-500">比例</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {([
                  { id: "16:9", title: "16:9 宽屏", desc: "适合投影、演示与现代大屏展示" },
                  { id: "4:3", title: "4:3 经典", desc: "适合课堂课件与传统显示设备" },
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
                <p className="text-xs text-zinc-500">先确认配置，再进入下一步</p>
                <button
                  type="button"
                  onClick={onConfirmConfig}
                  className="inline-flex h-9 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
                >
                  下一步
                </button>
              </div>
            </div>
          ) : null}

          {selectedIntent === "video" && !configConfirmed ? (
            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3">
              <p className="text-sm font-medium text-zinc-900">视频生成选项</p>
              <p className="mt-2 text-xs font-medium text-zinc-500">分镜数量</p>
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
                    {count} 个分镜
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                预计时长：约 {videoStoryboardCount * 10} 秒（每个分镜按 10 秒计算）
              </p>
              <p className="mt-2 text-xs font-medium text-zinc-500">视频比例</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {([
                  { id: "16:9", title: "16:9 横版", desc: "适合横屏讲解、B站与网页播放器" },
                  { id: "9:16", title: "9:16 竖版", desc: "适合短视频平台与手机全屏播放" },
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
                <p className="text-xs text-zinc-500">先确认配置，再进入下一步</p>
                <button
                  type="button"
                  onClick={onConfirmConfig}
                  className="inline-flex h-9 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
                >
                  下一步
                </button>
              </div>
            </div>
          ) : null}

          {!!missingHints.length && !configConfirmed ? (
            <div className="mt-3 rounded-xl border border-zinc-200 bg-white px-3 py-2.5">
              <p className="text-xs font-medium text-zinc-800">为了更快给你高质量结果，我还需要：</p>
              <ul className="mt-1 space-y-1 text-xs text-zinc-600">
                {missingHints.map((hint) => (
                  <li key={hint}>- {hint}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {selectedIntent === "poster" && !configConfirmed ? (
            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3">
              <p className="text-sm font-medium text-zinc-900">海报生成选项</p>
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
                    {count} 张
                  </button>
                ))}
              </div>
              <p className="mt-3 text-sm font-medium text-zinc-900">请选择海报尺寸</p>
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
                <p className="text-xs text-zinc-500">先确认配置，再进入下一步</p>
                <button
                  type="button"
                  onClick={onConfirmConfig}
                  className="inline-flex h-9 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
                >
                  下一步
                </button>
              </div>
            </div>
          ) : null}

          {intent === "poster" && posterDraft ? (
            <div className="mt-4 rounded-xl border border-zinc-200 bg-white px-3 py-3">
              <h4 className="text-sm font-semibold text-zinc-900">海报文案草稿</h4>
              <p className="mt-2 text-lg font-semibold leading-7 text-zinc-900">{posterDraft.headline}</p>
              <p className="mt-1 text-sm text-zinc-600">{posterDraft.subtitle}</p>
              <p className="mt-3 text-sm leading-6 text-zinc-700">{posterDraft.body}</p>
              <ul className="mt-2 space-y-1 text-sm text-zinc-700">
                {posterDraft.points.map((point) => (
                  <li key={point}>- {point}</li>
                ))}
              </ul>
              {visualizationTypeHint ? (
                <p className="mt-3 text-xs text-zinc-500">建议绘制类型：{visualizationTypeHint}</p>
              ) : null}
              {posterDraft.layoutSuggestion ? (
                <p className="mt-1 text-xs text-zinc-500">建议版式：{posterDraft.layoutSuggestion}</p>
              ) : null}
              {posterDraft.visualElements?.length ? (
                <p className="mt-1 text-xs text-zinc-500">
                  画面元素：{posterDraft.visualElements.join(" / ")}
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
                      思考中...
                    </>
                  ) : (
                    "下一步"
                  )}
                </button>
              </div>
            </div>
          ) : null}

          {(intent === "ppt" || intent === "video") ? (
            <div className="mt-4 border-t border-zinc-200/80 pt-4">
              <h4 className="text-sm font-semibold text-zinc-900">
                {intent === "video" ? "视频分镜大纲" : "内容大纲"}
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
                    {intent === "video" ? "分镜脚本草稿" : "页面文案草稿"}
                  </h4>
                  <div className="mt-2">
                    {slideDrafts.map((slide) => (
                      <section key={slide.page} className="border-b border-zinc-200/70 py-3 last:border-b-0">
                        <p className="text-sm font-semibold text-zinc-900">
                          第{slide.page}页：{slide.title}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-zinc-700">{slide.body}</p>
                        <p className="mt-1 text-sm text-zinc-500">视觉建议：{slide.visual}</p>
                      </section>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {!shouldClarifyIntent && intent !== "poster" ? (
            <div className="mt-4 rounded-xl border border-zinc-200 bg-white px-3 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-zinc-600">
                  当前阶段：
                  <span className="ml-1 rounded-lg bg-zinc-100 px-2 py-1 font-medium text-zinc-900">
                    需求理解已完成
                  </span>
                </div>
                <button
                  type="button"
                  disabled={isPlanningNextStep || !canProceed}
                  onClick={onConfirm}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400 sm:w-auto"
                >
                  {isPlanningNextStep ? (
                    <>
                      <LoaderCircle size={14} className="animate-spin" />
                      思考中...
                    </>
                  ) : (
                    "下一步"
                  )}
                </button>
              </div>
            </div>
          ) : null}
        </article>
      ) : null}

      {!showMainSummaryBlock && configConfirmed ? (
        <article className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-3 py-3">
          {intent === "poster" && posterDraft ? (
            <>
              <h4 className="text-sm font-semibold text-zinc-900">海报文案草稿</h4>
              <p className="mt-2 text-lg font-semibold leading-7 text-zinc-900">{posterDraft.headline}</p>
              <p className="mt-1 text-sm text-zinc-600">{posterDraft.subtitle}</p>
              <p className="mt-3 text-sm leading-6 text-zinc-700">{posterDraft.body}</p>
              <ul className="mt-2 space-y-1 text-sm text-zinc-700">
                {posterDraft.points.map((point) => (
                  <li key={`locked-poster-point-${point}`}>- {point}</li>
                ))}
              </ul>
              {visualizationTypeHint ? (
                <p className="mt-3 text-xs text-zinc-500">建议绘制类型：{visualizationTypeHint}</p>
              ) : null}
              {posterDraft.layoutSuggestion ? (
                <p className="mt-1 text-xs text-zinc-500">建议版式：{posterDraft.layoutSuggestion}</p>
              ) : null}
              {posterDraft.visualElements?.length ? (
                <p className="mt-1 text-xs text-zinc-500">画面元素：{posterDraft.visualElements.join(" / ")}</p>
              ) : null}
              <p className="mt-3 text-xs text-zinc-500">草稿已保留，后续将继续基于此内容生成。</p>
            </>
          ) : null}

          {(intent === "ppt" || intent === "video") && outlineItems.length ? (
            <>
              <h4 className="text-sm font-semibold text-zinc-900">
                {intent === "video" ? "视频分镜大纲草稿" : "内容大纲草稿"}
              </h4>
              <ol className="mt-3 space-y-2 text-sm leading-6 text-zinc-700">
                {outlineItems.map((item, index) => (
                  <li key={`locked-outline-${index + 1}-${item}`} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                    <p className="font-medium text-zinc-900">
                      {index + 1}. {item}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      {intent === "video"
                        ? "这一段会继续扩写成镜头动作、画面主体、字幕重点和口播提示。"
                        : "这一段会继续扩写成页面正文、分点说明和视觉重点。"}
                    </p>
                  </li>
                ))}
              </ol>

              {!!slideDrafts.length ? (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-zinc-900">
                    {intent === "video" ? "分镜脚本草稿" : "页面文案草稿"}
                  </h4>
                  <div className="mt-3 space-y-2">
                    {slideDrafts.map((slide) => (
                      <section
                        key={`locked-slide-${slide.page}-${slide.title}`}
                        className="rounded-xl border border-zinc-200 bg-white px-3 py-3"
                      >
                        <p className="text-sm font-semibold text-zinc-900">
                          第{slide.page}页：{slide.title}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-zinc-700">{slide.body}</p>
                        <p className="mt-2 text-sm text-zinc-500">视觉建议：{slide.visual}</p>
                      </section>
                    ))}
                  </div>
                </div>
              ) : null}
              <p className="mt-3 text-xs text-zinc-500">草稿已保留，后续将继续基于此内容生成。</p>
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
            {update.role === "user" ? "你" : "KnowLens.ai"} · {update.module}
          </div>
          <p className="leading-6">{update.content}</p>
        </article>
      ))}

      {styleConfirmed ? (
        <article className="max-w-[95%] px-1 py-1">
          <h3 className="text-sm font-semibold text-zinc-900">风格推荐</h3>
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
                    {style.name}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="mt-3 text-sm text-zinc-600">
            当前风格：
            <span className="ml-1 rounded-lg bg-zinc-100 px-2 py-1 font-medium text-zinc-900">{selectedStyle.name}</span>
          </div>
        </article>
      ) : null}

      {showStyleStage ? (
        <article className="max-w-[95%] px-1 py-1">
          <h3 className="text-sm font-semibold text-zinc-900">风格推荐</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-700">
            推荐你先确定演示风格，这会直接影响页面构图、信息密度和视觉节奏。
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
                  {style.name}
                </p>
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-zinc-200 bg-white px-3 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-zinc-600">
                当前风格：
                <span className="ml-1 rounded-lg bg-zinc-100 px-2 py-1 font-medium text-zinc-900">
                  {selectedStyle.name}
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
                    思考中...
                  </>
                ) : (
                  "下一步"
                )}
              </button>
            </div>
          </div>
        </article>
      ) : null}

      {showBillingConfirm ? (
        <article className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-4 py-4">
          <h3 className="text-sm font-semibold text-zinc-900">
            {intent === "poster" ? "海报生成确认" : "内容生成确认"}
          </h3>
          <p className="mt-2 text-sm leading-6 text-zinc-700">
            已根据当前主题和风格完成用量估算。确认后将开始生成分镜并扣除对应积分。
          </p>

          <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200">
            <div className="grid grid-cols-[92px_minmax(0,1fr)] text-sm">
              <p className="border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-500">风格</p>
              <p className="border-b border-zinc-200 px-3 py-2 text-zinc-800">{billingSummary.styleName}</p>
              <p className="border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-500">本次消耗</p>
              <p className="border-b border-zinc-200 px-3 py-2 font-semibold text-zinc-900">
                {billingSummary.totalCost} 积分
              </p>
              <p className="border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-500">计算方式</p>
              <p className="border-b border-zinc-200 px-3 py-2 text-zinc-700">
                {billingSummary.standardOutputCount} × {billingSummary.promoCreditsPerOutput} 积分
                <span className="ml-1 text-zinc-500">
                  （原价 {billingSummary.regularCreditsPerOutput}）
                </span>
              </p>
              <p className="border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-500">当前余额</p>
              <p className="border-b border-zinc-200 px-3 py-2 text-zinc-700">
                {billingSummary.availableCredits} 积分
              </p>
              <p className="border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-500">扣费后</p>
              <p className="px-3 py-2 text-zinc-700">{billingSummary.remainingCredits} 积分</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className={`text-sm ${canConfirmBilling ? "text-zinc-600" : "font-medium text-red-600"}`}>
              {canConfirmBilling
                ? `确认后将按限时优惠价 ${billingSummary.promoCreditsPerOutput} 积分 / 标准输出扣费（原价 ${billingSummary.regularCreditsPerOutput}）。`
                : "当前积分不足，请先升级后再确认账单。"}
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
                  思考中...
                </>
              ) : billingConfirmed ? (
                "已确认，生成中..."
              ) : !canConfirmBilling ? (
                "积分不足"
              ) : (
                "确认账单并生成"
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
