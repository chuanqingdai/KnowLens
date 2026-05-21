"use client";

import { useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  HeartHandshake,
  MessageCircleHeart,
  Zap,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  cancelSubscription,
  getCreditRecords,
  getSubscription,
  type SubscriptionSnapshot,
} from "@/lib/billing";

function formatDate(input: string) {
  return new Date(input).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function SubscriptionManagePage() {
  const router = useRouter();
  const [sub, setSub] = useState<SubscriptionSnapshot | null>(() => getSubscription());
  const [toast, setToast] = useState<string | null>(null);
  const [credits] = useState(() => getCreditRecords()[0]?.balance ?? 80);
  const [showSurvey, setShowSurvey] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [detailFeedback, setDetailFeedback] = useState("");

  const surveyOptions = [
    "价格超出当前预算",
    "使用频率不高，暂时用不到",
    "功能还不够满足我的需求",
    "体验不顺手，操作有点复杂",
    "导出质量或速度未达到预期",
    "我想先尝试其它工具",
  ];

  function handleCancel() {
    const next = cancelSubscription();
    if (!next) {
      setToast("当前没有生效中的订阅");
      return;
    }
    setSub(next);
    setShowSurvey(false);
    setSelectedReason("");
    setDetailFeedback("");
    setToast("感谢你的反馈，已提交取消订阅，将在当前周期结束后生效");
  }

  function handleSubmitSurveyAndCancel() {
    if (!selectedReason) {
      setToast("请先选择一个主要原因，帮助我持续改进");
      return;
    }
    handleCancel();
  }

  return (
    <main className="min-h-screen bg-[#f7f7f8]">
      <header className="fixed inset-x-0 top-0 z-40 h-14 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-full w-full max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => router.push("/membership")}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            <ArrowLeft size={14} />
            返回
          </button>
          <div className="text-center">
            <p className="text-sm font-medium text-zinc-900">订阅状态</p>
            <p className="text-xs text-zinc-500">查看当前套餐与续费周期</p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/membership/credits")}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            <Zap size={14} className="text-zinc-500" />
            <span className="font-medium text-zinc-900">{credits}</span>
            <span className="text-zinc-500">|</span>
            <span>积分</span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pb-12 pt-20 sm:px-6">

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h1 className="text-xl font-semibold text-zinc-900">订阅状态</h1>
          {!sub ? (
            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-600">
              当前暂无订阅记录。你可以返回会员中心完成购买。
            </div>
          ) : (
            <>
              <div className="mt-4 space-y-2 text-sm">
                <p className="inline-flex items-center gap-1.5 text-zinc-700">
                  <BadgeCheck size={14} />
                  套餐：{sub.planName}
                </p>
                <p className="text-zinc-600">周期：{sub.cycle === "yearly" ? "包年" : "包月"}</p>
                <p className="text-zinc-600">开通时间：{formatDate(sub.startedAt)}</p>
                <p className="text-zinc-600">下次续费：{formatDate(sub.renewAt)}</p>
                <p className="text-zinc-600">
                  状态：
                  {sub.status === "canceling" ? "将于周期结束后取消" : "生效中"}
                </p>
              </div>

              {sub.status !== "canceling" ? (
                <button
                  type="button"
                  onClick={() => setShowSurvey(true)}
                  className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-700 hover:bg-red-100"
                >
                  <XCircle size={14} />
                  取消订阅
                </button>
              ) : (
                <div className="mt-5 inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  <CircleAlert size={14} />
                  取消已提交，当前权益保持到周期结束
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {showSurvey ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-900">
                  <HeartHandshake size={15} />
                  在你离开前，想认真听听你的感受
                </p>
                <p className="mt-1 text-sm leading-6 text-zinc-600">
                  我是 Scilens 的个人开发者。你遇到的体验问题，我会尽快修复。只需 1
                  分钟，你的建议对我非常重要。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSurvey(false)}
                className="rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
              >
                关闭
              </button>
            </div>

            <div className="mt-4">
              <p className="text-sm font-medium text-zinc-900">你本次取消的主要原因是？</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {surveyOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSelectedReason(option)}
                    className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                      selectedReason === option
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-900">
                <MessageCircleHeart size={15} />
                还有什么建议想告诉我？（可选）
              </p>
              <textarea
                value={detailFeedback}
                onChange={(event) => setDetailFeedback(event.target.value)}
                placeholder="例如：哪个环节最影响体验、你希望优先新增什么能力。"
                className="mt-2 h-24 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-800 outline-none ring-zinc-300 placeholder:text-zinc-400 focus:ring-2"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSurvey(false)}
                className="inline-flex h-10 items-center rounded-xl border border-zinc-300 bg-white px-4 text-sm text-zinc-700 hover:bg-zinc-100"
              >
                我再想想
              </button>
              <button
                type="button"
                onClick={handleSubmitSurveyAndCancel}
                className="inline-flex h-10 items-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
              >
                提交反馈并取消订阅
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </main>
  );
}
