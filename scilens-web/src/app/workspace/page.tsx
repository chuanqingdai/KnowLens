"use client";

import { useEffect, useRef, useState } from "react";

import { ArrowUp, LoaderCircle } from "lucide-react";

import { ChatPanel, type ChatTurn } from "@/components/workspace/ChatPanel";
import { StoryboardCanvas } from "@/components/workspace/StoryboardCanvas";
import { TopBar } from "@/components/workspace/TopBar";

type HomeSourceKind = "file" | "web" | "youtube";
type HomeSourceItem = {
  id: string;
  kind: HomeSourceKind;
  name: string;
  origin: string;
  status: "extracting" | "ready";
  excerpt: string;
};
type HomeDraftPayload = {
  prompt?: string;
  textModel?: string;
  imageModel?: string;
  sources?: HomeSourceItem[];
};

const styleOptions = [
  {
    id: "diagram-classroom",
    name: "课堂图解风",
    fit: "推荐：最适合中学生科普课堂，重点清晰、图解直观。",
    palette: ["#1f2937", "#3b82f6", "#e5e7eb"],
  },
  {
    id: "science-mag",
    name: "科学杂志风",
    fit: "适合需要更强视觉吸引力的展示，版式更具冲击力。",
    palette: ["#111827", "#f59e0b", "#f3f4f6"],
  },
  {
    id: "clean-minimal",
    name: "极简讲解风",
    fit: "适合节奏快的短课展示，信息块简洁、文字更少。",
    palette: ["#0f172a", "#10b981", "#eef2ff"],
  },
  {
    id: "chalkboard",
    name: "黑板课堂风",
    fit: "模拟课堂讲解氛围，适合知识点逐步展开。",
    palette: ["#0b3b2e", "#65a30d", "#ecfccb"],
  },
  {
    id: "timeline",
    name: "时间线叙事风",
    fit: "适合解释过程变化，突出前后阶段逻辑。",
    palette: ["#1f2937", "#2563eb", "#dbeafe"],
  },
  {
    id: "lab-report",
    name: "实验报告风",
    fit: "结构严谨，适合课堂作业式展示。",
    palette: ["#0f172a", "#0ea5e9", "#e0f2fe"],
  },
  {
    id: "infographic",
    name: "信息图表风",
    fit: "适合关键概念密集表达，视觉引导更强。",
    palette: ["#111827", "#f97316", "#ffedd5"],
  },
  {
    id: "story-comic",
    name: "故事漫画风",
    fit: "增强趣味性，降低理解门槛，适合低龄受众。",
    palette: ["#3b0764", "#a855f7", "#f3e8ff"],
  },
  {
    id: "news-brief",
    name: "新闻简报风",
    fit: "信息密度高，适合快速复盘和考试前回顾。",
    palette: ["#111827", "#06b6d4", "#cffafe"],
  },
  {
    id: "museum-exhibit",
    name: "展馆陈列风",
    fit: "突出知识的空间感和沉浸感，适合主题汇报。",
    palette: ["#3f2d20", "#b45309", "#fef3c7"],
  },
  {
    id: "exam-focus",
    name: "考点强化风",
    fit: "突出关键词和易错点，适合课后复习。",
    palette: ["#1e1b4b", "#6366f1", "#e0e7ff"],
  },
];

const HOME_DRAFT_KEY = "scilens-home-draft";

function pickSmartStyle(prompt: string, sources: HomeSourceItem[]) {
  const bag = `${prompt} ${sources.map((item) => `${item.name} ${item.excerpt}`).join(" ")}`.toLowerCase();
  if (/小学生|低龄|启蒙|趣味|漫画/.test(bag)) {
    return {
      styleId: "story-comic",
      reason: "检测到低龄/趣味表达诉求，优先推荐故事漫画风提升理解兴趣。",
    };
  }
  if (/考试|复习|考点|总结/.test(bag)) {
    return {
      styleId: "exam-focus",
      reason: "检测到复习与考点目标，优先推荐考点强化风提高信息检索效率。",
    };
  }
  if (/时间线|过程|演化|历史/.test(bag)) {
    return {
      styleId: "timeline",
      reason: "检测到过程型叙事，优先推荐时间线叙事风强化前后逻辑。",
    };
  }
  if (/实验|数据|报告|严谨/.test(bag)) {
    return {
      styleId: "lab-report",
      reason: "检测到实验与严谨表达诉求，优先推荐实验报告风。",
    };
  }
  return {
    styleId: "diagram-classroom",
    reason: "默认推荐课堂图解风，兼顾课堂可读性与结构化解释。",
  };
}

function readHomeDraftPayload() {
  const empty = {
    prompt: "",
    sources: [] as HomeSourceItem[],
    models: null as { textModel: string; imageModel: string } | null,
    styleId: styleOptions[0].id,
    styleReason: "",
    initMessage: null as ChatTurn | null,
  };

  if (typeof window === "undefined") {
    return empty;
  }

  const raw = window.sessionStorage.getItem(HOME_DRAFT_KEY);
  if (!raw) {
    return empty;
  }

  try {
    const payload = JSON.parse(raw) as HomeDraftPayload;
    const prompt = (payload.prompt ?? "").trim();
    const sources = Array.isArray(payload.sources) ? payload.sources.slice(0, 6) : [];
    const models =
      payload.textModel || payload.imageModel
        ? {
            textModel: payload.textModel ?? "gpt-4.1",
            imageModel: payload.imageModel ?? "gpt-image2",
          }
        : null;

    if (!prompt && !sources.length) {
      return empty;
    }

    const smart = pickSmartStyle(prompt, sources);
    return {
      prompt,
      sources,
      models,
      styleId: smart.styleId,
      styleReason: smart.reason,
      initMessage: {
        id: `a-init-${Date.now()}`,
        role: "assistant" as const,
        module: "需求解析",
        content: `已从首页接收输入内容，完成初步解析并自动匹配风格：${smart.reason}`,
      },
    };
  } catch {
    return empty;
  } finally {
    window.sessionStorage.removeItem(HOME_DRAFT_KEY);
  }
}

export default function WorkspacePage() {
  const [initialEntry] = useState(() => readHomeDraftPayload());
  const [credits, setCredits] = useState(80);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [updates, setUpdates] = useState<ChatTurn[]>(
    initialEntry.initMessage ? [initialEntry.initMessage] : [],
  );
  const [chatInput, setChatInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showStyleStage, setShowStyleStage] = useState(false);
  const [selectedStyleId, setSelectedStyleId] = useState(initialEntry.styleId);
  const [showBillingConfirm, setShowBillingConfirm] = useState(false);
  const [billingConfirmed, setBillingConfirmed] = useState(false);
  const [showStoryboard, setShowStoryboard] = useState(false);
  const [isPlanningNextStep, setIsPlanningNextStep] = useState(false);
  const [isPlanningStyleStep, setIsPlanningStyleStep] = useState(false);
  const [isPlanningBillingStep, setIsPlanningBillingStep] = useState(false);
  const [entryPrompt] = useState(initialEntry.prompt);
  const [entrySources] = useState<HomeSourceItem[]>(initialEntry.sources);
  const [entryModels] = useState<{ textModel: string; imageModel: string } | null>(
    initialEntry.models,
  );
  const [styleReason] = useState(initialEntry.styleReason);
  const [thinkingState, setThinkingState] = useState<{
    active: boolean;
    module: string;
    text: string;
  }>({
    active: false,
    module: "",
    text: "",
  });
  const [canvasMode, setCanvasMode] = useState<"free" | "ppt">("ppt");
  const [isExportingPpt, setIsExportingPpt] = useState(false);
  const [isComposingVideo, setIsComposingVideo] = useState(false);
  const modeActionsRef = useRef<{
    exportPpt: () => void;
    downloadVideo: () => void;
  }>({
    exportPpt: () => {},
    downloadVideo: () => {},
  });
  const storyboardPanelRef = useRef<HTMLElement | null>(null);
  const leftScrollRef = useRef<HTMLDivElement | null>(null);

  const billingCost = 20;
  const canConfirmBilling = credits >= billingCost;
  const selectedStyle =
    styleOptions.find((style) => style.id === selectedStyleId) ?? styleOptions[0];

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
  }

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
  }

  function startThinking(module: string, text: string) {
    setThinkingState({
      active: true,
      module,
      text,
    });
  }

  function stopThinking() {
    setThinkingState({
      active: false,
      module: "",
      text: "",
    });
  }

  async function handleNextStep() {
    if (isPlanningNextStep) {
      return;
    }
    setIsPlanningNextStep(true);
    startThinking("风格推荐", "正在理解你的目标并匹配最合适的风格...");
    await new Promise((resolve) => window.setTimeout(resolve, 520));
    setShowStyleStage(true);
    setUpdates((prev) => {
      if (
        prev.some(
          (msg) =>
            msg.role === "assistant" && msg.content.includes("推荐你先确定演示风格"),
        )
      ) {
        return prev;
      }
      return [
        ...prev,
        {
          id: `a-${Date.now()}-${Math.round(Math.random() * 9999)}`,
          role: "assistant",
          module: "风格推荐",
          content:
            "我建议下一步先确定演示风格，这会直接影响每页的视觉构图、信息密度和课堂可读性。",
        },
      ];
    });
    stopThinking();
    setIsPlanningNextStep(false);
  }

  async function handleStyleNext() {
    if (isPlanningStyleStep) {
      return;
    }
    setIsPlanningStyleStep(true);
    startThinking("账单确认", "正在计算分镜生成成本与积分消耗...");
    await new Promise((resolve) => window.setTimeout(resolve, 480));
    setShowBillingConfirm(true);
    setBillingConfirmed(false);
    pushAssistantMessage(
      "已进入分镜生成计费阶段：我先为你列出本次积分账单，确认后再开始生成分镜内容。",
      "账单确认",
    );
    stopThinking();
    setIsPlanningStyleStep(false);
  }

  async function handleConfirmBilling() {
    if (credits < billingCost) {
      setShowBillingConfirm(true);
      pushAssistantMessage(
        `当前积分不足（余额 ${credits}，需要 ${billingCost}）。请先升级后再继续生成分镜。`,
        "账单确认",
      );
      return;
    }
    if (isPlanningBillingStep) {
      return;
    }
    setIsPlanningBillingStep(true);
    startThinking("分镜生成", "正在创建分镜结构，并同步画面与音轨字段...");
    await new Promise((resolve) => window.setTimeout(resolve, 620));

    if (showStoryboard) {
      storyboardPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      stopThinking();
      setIsPlanningBillingStep(false);
      return;
    }
    setShowStoryboard(true);
    requestAnimationFrame(() => {
      storyboardPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    if (billingConfirmed) {
      stopThinking();
      setIsPlanningBillingStep(false);
      return;
    }

    setBillingConfirmed(true);
    setCredits((prev) => Math.max(0, prev - billingCost));
    pushAssistantMessage(
      `账单已确认，已扣除 ${billingCost} 积分。正在生成 10 页分镜，完成后可直接进入绘制流程。`,
      "分镜生成",
    );
    stopThinking();
    setIsPlanningBillingStep(false);
  }

  async function handleSendInput(raw?: string) {
    const value = (raw ?? chatInput).trim();
    if (!value || isSending) {
      return;
    }
    setIsSending(true);
    setChatInput("");
    startThinking("内容改写", "正在理解你的修改意图并准备新的内容结构...");

    pushUserMessage(value, "内容改写");

    const isStyleMessage = /(风格|配色|排版|视觉)/.test(value);
    const isStoryboardMessage = /(分镜|镜头|旁白|tts|音轨|画面)/i.test(value);
    const isBillingMessage = /(积分|账单|消耗|扣费)/.test(value);
    const isShortenMessage = /(精简|缩短|简化|短一点)/.test(value);
    const isRegenMessage = /(重写|重做|重新生成)/.test(value);
    const isPageChange = value.match(/(\d+)\s*页/);
    const nextPageCount = isPageChange ? Number(isPageChange[1]) : null;

    await new Promise((resolve) => window.setTimeout(resolve, 320));

    if (isBillingMessage) {
      pushAssistantMessage(
        `当前预估账单为 ${billingCost} 积分，确认后将从余额 ${credits} 积分扣除，预计剩余 ${Math.max(
          0,
          credits - billingCost,
        )} 积分。`,
        "账单确认",
      );
      stopThinking();
      setIsSending(false);
      return;
    }

    if (isStyleMessage) {
      setShowStyleStage(true);
      pushAssistantMessage(
        "我已切到风格协同阶段。你可以直接在下方风格封面中选择，我会按选中风格同步更新分镜画面提示词与版式建议。",
        "风格推荐",
      );
      stopThinking();
      setIsSending(false);
      return;
    }

    if (isStoryboardMessage) {
      pushAssistantMessage(
        "我可以直接改分镜内容。你可以继续指定：改哪一页、旁白语气、画面提示词风格、TTS 音色。确认后我会同步到右侧无限画布。",
        "分镜生成",
      );
      stopThinking();
      setIsSending(false);
      return;
    }

    if (nextPageCount && nextPageCount !== 10) {
      pushAssistantMessage(
        `收到，你想调整为 ${nextPageCount} 页。我建议先确认节奏（每页时长）后再重排大纲，我可以下一步直接重排页面结构。`,
        "校验与下一步建议",
      );
      stopThinking();
      setIsSending(false);
      return;
    }

    if (isRegenMessage) {
      pushAssistantMessage(
        "好的，我会保持当前主题不变重新生成文案，并保留可视化科普结构（问题引入 → 原理解释 → 过程拆解 → 影响总结）。",
        "内容改写",
      );
      stopThinking();
      setIsSending(false);
      return;
    }

    if (isShortenMessage) {
      pushAssistantMessage(
        "收到，我会把每页正文压缩到更短句式，优先保留课堂易懂的关键词，并同步降低旁白时长。",
        "内容改写",
      );
      stopThinking();
      setIsSending(false);
      return;
    }

    pushAssistantMessage(
      "我已记录你的补充要求。为了更快落地，你可以继续补一句“改第几页 + 怎么改”，我会按页精确调整。",
      "内容改写",
    );
    stopThinking();
    setIsSending(false);
  }

  useEffect(() => {
    if (!leftScrollRef.current) {
      return;
    }
    leftScrollRef.current.scrollTo({
      top: leftScrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [billingConfirmed, showBillingConfirm, showStyleStage, thinkingState.active, updates]);

  return (
    <div className="h-screen overflow-hidden bg-[#f7f7f8] text-zinc-900">
      <TopBar
        credits={credits}
        saveState={saveState}
        hasUnsavedChanges={hasUnsavedChanges}
        canvasMode={canvasMode}
        onCanvasModeChange={showStoryboard ? setCanvasMode : undefined}
        onDownloadPpt={
          showStoryboard
            ? () => {
                modeActionsRef.current.exportPpt();
              }
            : undefined
        }
        onDownloadVideo={
          showStoryboard
            ? () => {
                modeActionsRef.current.downloadVideo();
              }
            : undefined
        }
        actionsDisabled={!showStoryboard}
        isExportingPpt={isExportingPpt}
        isComposingVideo={isComposingVideo}
      />

      <main className="mx-auto mt-[56px] h-[calc(100vh-56px)] max-w-none px-2 sm:px-3">
        <div
          className={`grid gap-2 lg:h-full ${
            showStoryboard ? "lg:grid-cols-[416px_minmax(0,1fr)]" : "lg:grid-cols-1"
          }`}
        >
          <section
            className={`min-h-0 lg:h-full ${
              showStoryboard ? "" : "lg:mx-auto lg:w-full lg:max-w-[980px]"
            }`}
          >
            <div className="flex min-h-0 flex-col lg:h-full">
              <div
                ref={leftScrollRef}
                className={`workspace-left-shell min-h-0 flex-1 overflow-y-auto lg:min-h-0 ${
                  showStoryboard ? "pr-1.5" : "pr-0"
                }`}
              >
                <ChatPanel
                  updates={updates}
                  onConfirm={handleNextStep}
                  isPlanningNextStep={isPlanningNextStep}
                  showStyleStage={showStyleStage}
                  isPlanningStyleStep={isPlanningStyleStep}
                  showBillingConfirm={showBillingConfirm}
                  isPlanningBillingStep={isPlanningBillingStep}
                  billingConfirmed={billingConfirmed}
                  canConfirmBilling={canConfirmBilling}
                  billingSummary={{
                    styleName: selectedStyle.name,
                    totalCost: billingCost,
                    availableCredits: credits,
                    remainingCredits: Math.max(0, credits - billingCost),
                  }}
                  styleOptions={styleOptions}
                  selectedStyleId={selectedStyleId}
                  onSelectStyle={setSelectedStyleId}
                  onStyleNext={handleStyleNext}
                  onConfirmBilling={handleConfirmBilling}
                  thinkingState={thinkingState}
                />
                {(entryPrompt || entrySources.length || entryModels) ? (
                  <section className="mt-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm">
                    <p className="font-medium text-zinc-900">已接收首页输入</p>
                    {entryPrompt ? (
                      <p className="mt-1 text-zinc-700">主题：{entryPrompt}</p>
                    ) : null}
                    {entryModels ? (
                      <p className="mt-1 text-zinc-600">
                        模型：{entryModels.textModel} · {entryModels.imageModel}
                      </p>
                    ) : null}
                    {entrySources.length ? (
                      <p className="mt-1 text-zinc-600">
                        素材：{entrySources.length} 项（含网页/视频/文件提取结果）
                      </p>
                    ) : null}
                    {styleReason ? (
                      <p className="mt-1 text-zinc-600">风格匹配：{styleReason}</p>
                    ) : null}
                  </section>
                ) : null}
              </div>
              <div className="shrink-0 pb-3 pt-3">
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
                      placeholder="输入修改要求，例如：第3页更简洁，第7页增加真实案例"
                    />
                    <button
                      type="button"
                      disabled={!chatInput.trim() || isSending}
                      onClick={() => void handleSendInput()}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
                      aria-label="发送"
                    >
                      {isSending ? (
                        <LoaderCircle size={14} className="animate-spin" />
                      ) : (
                        <ArrowUp size={14} />
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-400">
                    Enter 发送，Shift + Enter 换行
                  </p>
                </div>
              </div>
            </div>
          </section>

          {showStoryboard ? (
            <section
              ref={storyboardPanelRef}
              className="workspace-canvas-shell min-h-0 h-[62vh] overflow-hidden sm:h-[66vh] lg:h-full"
            >
              <StoryboardCanvas
                onSaveStateChange={(nextState, unsaved) => {
                  setSaveState(nextState);
                  setHasUnsavedChanges(unsaved);
                }}
                canvasModeExternal={canvasMode}
                onCanvasModeChange={setCanvasMode}
                onExportingPptChange={setIsExportingPpt}
                onComposingVideoChange={setIsComposingVideo}
                onModeActionRegister={(actions) => {
                  modeActionsRef.current = actions;
                }}
              />
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}
