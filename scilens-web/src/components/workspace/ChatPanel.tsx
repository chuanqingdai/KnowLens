import { outlineItems, slideDrafts } from "./mockData";
import { Check, LoaderCircle } from "lucide-react";

export type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  module: string;
  content: string;
};

type StyleOption = {
  id: string;
  name: string;
  fit: string;
  palette: string[];
};

type ChatPanelProps = {
  updates: ChatTurn[];
  onConfirm: () => void;
  isPlanningNextStep: boolean;
  showStyleStage: boolean;
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
  };
  styleOptions: StyleOption[];
  selectedStyleId: string;
  onSelectStyle: (styleId: string) => void;
  onStyleNext: () => void;
  onConfirmBilling: () => void;
  thinkingState: {
    active: boolean;
    module: string;
    text: string;
  };
};

export function ChatPanel({
  updates,
  onConfirm,
  isPlanningNextStep,
  showStyleStage,
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
  thinkingState,
}: ChatPanelProps) {
  const selectedStyle =
    styleOptions.find((style) => style.id === selectedStyleId) ?? styleOptions[0];

  return (
    <section className="space-y-5 px-1 py-2">
        <article className="ml-auto max-w-[90%] rounded-2xl bg-zinc-900 px-4 py-3 text-sm text-white">
          帮我生成一个火山喷发过程的科普PPT，10页，适合中学生。
        </article>

        <article className="max-w-[95%] rounded-2xl bg-transparent p-1">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">最终 10 页大纲框架</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-700">
              已按“中学生课堂可理解 + 10页结构清晰”生成最终内容框架。你可以直接确认进入
              PPT 生成，或继续让我改写某一页。
            </p>
          </div>

          <div className="mt-4 border-t border-zinc-200/80 pt-4">
            <h4 className="text-sm font-semibold text-zinc-900">一、撰写大纲（10页）</h4>
            <ol className="mt-2 space-y-1 text-sm leading-6 text-zinc-700">
              {outlineItems.map((item, index) => (
                <li key={item}>
                  {index + 1}. {item}
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-5 border-t border-zinc-200/80 pt-4">
            <h4 className="text-sm font-semibold text-zinc-900">二、正文内容（10页）</h4>
            <div className="mt-2">
              {slideDrafts.map((slide) => (
                <section
                  key={slide.page}
                  className="border-b border-zinc-200/70 py-3 last:border-b-0"
                >
                  <p className="text-sm font-semibold text-zinc-900">
                    第{slide.page}页：{slide.title}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-zinc-700">{slide.body}</p>
                  <p className="mt-1 text-sm text-zinc-500">视觉建议：{slide.visual}</p>
                </section>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-zinc-200 bg-white px-3 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-zinc-600">
                  当前阶段：
                  <span className="ml-1 rounded-lg bg-zinc-100 px-2 py-1 font-medium text-zinc-900">
                    大纲与正文已完成
                  </span>
                </div>
                <button
                  type="button"
                  disabled={isPlanningNextStep}
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
          </div>
        </article>

        {updates.map((update, idx) => (
          <article
            key={`${update.id}-${idx}`}
            className={`max-w-[95%] rounded-2xl px-4 py-3 text-sm ${
              update.role === "user"
                ? "ml-auto bg-zinc-900 text-white"
                : "bg-zinc-100/85 text-zinc-700"
            }`}
          >
            <div
              className={`mb-1 text-[11px] ${
                update.role === "user" ? "text-zinc-300" : "text-zinc-500"
              }`}
            >
              {update.role === "user" ? "你" : "Scilens"} · {update.module}
            </div>
            <p className="leading-6">{update.content}</p>
          </article>
        ))}

        {showStyleStage ? (
          <article className="max-w-[95%] px-1 py-1">
            <h3 className="text-sm font-semibold text-zinc-900">风格推荐</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-700">
              根据“火山喷发过程”主题和中学生受众，我推荐优先使用
              <span className="font-semibold text-zinc-900">「课堂图解风」</span>。
              这种风格更适合讲解结构、过程和因果关系，课堂吸收效率更高。
            </p>

            <p className="mt-3 text-sm text-zinc-600">{selectedStyle.fit}</p>

            <div className="mt-3 grid grid-cols-3 gap-3">
              {styleOptions.map((style) => (
                <button
                  key={style.id}
                  type="button"
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
                  <div
                    className="aspect-[9/16] w-full rounded-xl"
                    style={{
                      background: `linear-gradient(160deg, ${style.palette[0]}55, ${style.palette[1]}88 55%, ${style.palette[2]})`,
                    }}
                  />
                  <p
                    className={`mt-2 text-xs font-medium ${
                      style.id === selectedStyleId ? "text-zinc-950" : "text-zinc-600"
                    }`}
                  >
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
            <h3 className="text-sm font-semibold text-zinc-900">分镜生成账单确认</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-700">
              已根据当前主题和风格完成用量估算。确认后将开始生成 10 页分镜，并扣除对应积分。
            </p>

            <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200">
              <div className="grid grid-cols-[92px_minmax(0,1fr)] text-sm">
                <p className="border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-500">
                  风格
                </p>
                <p className="border-b border-zinc-200 px-3 py-2 text-zinc-800">
                  {billingSummary.styleName}
                </p>
                <p className="border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-500">
                  账单明细
                </p>
                <p className="border-b border-zinc-200 px-3 py-2 text-zinc-700">
                  语言规划 6 积分 + 分镜结构 8 积分 + 视觉描述 6 积分
                </p>
                <p className="border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-500">
                  本次消耗
                </p>
                <p className="border-b border-zinc-200 px-3 py-2 font-semibold text-zinc-900">
                  {billingSummary.totalCost} 积分
                </p>
                <p className="border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-500">
                  当前余额
                </p>
                <p className="border-b border-zinc-200 px-3 py-2 text-zinc-700">
                  {billingSummary.availableCredits} 积分
                </p>
                <p className="border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-500">
                  扣费后
                </p>
                <p className="px-3 py-2 text-zinc-700">
                  {billingSummary.remainingCredits} 积分
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p
                className={`text-sm ${
                  canConfirmBilling ? "text-zinc-600" : "font-medium text-red-600"
                }`}
              >
                {canConfirmBilling
                  ? "请确认账单后继续生成分镜。"
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
            <div className="mb-1 text-[11px] text-zinc-500">
              Scilens · {thinkingState.module}
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-700">
              <LoaderCircle size={14} className="animate-spin text-zinc-500" />
              {thinkingState.text}
            </div>
          </article>
        ) : null}

    </section>
  );
}
