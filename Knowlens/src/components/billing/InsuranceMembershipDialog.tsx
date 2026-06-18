"use client";

import { useEffect } from "react";
import { ArrowRight, Check, Crown, X } from "lucide-react";

type InsuranceMembershipDialogProps = {
  open: boolean;
  source?: string;
  contextLabel?: string;
  onClose: () => void;
  onUpgrade?: () => void;
};

const freeBenefits = [
  "浏览全部保险海报案例和分类灵感",
  "可以下载少量的免费海报",
  "适合先体验宣传图、日签、节日海报效果",
];

const annualBenefits = [
  "解锁 90% 高级保险海报模板",
  "生成同款、下载高级海报均可使用",
  "每年 6000 积分，用于保险海报生成",
  "支持标题、卖点、风险提示、机构信息精确控制",
  "覆盖品宣、产品说明、客户教育、续保提醒和理赔服务",
];

function trackInsuranceMembership(action: string, source: string, message?: string) {
  void fetch("/api/telemetry/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category: "billing",
      action,
      status: "info",
      source,
      message,
    }),
  }).catch(() => undefined);
}

export function openInsuranceMembershipCheckout(source = "insurance_membership_dialog") {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem("membership:return-path", "/insurance");
  window.sessionStorage.setItem("knowlens:membership-source", source);
  window.location.href = "/membership";
}

export function InsuranceMembershipDialog({
  open,
  source = "insurance_membership_dialog",
  contextLabel,
  onClose,
  onUpgrade,
}: InsuranceMembershipDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    trackInsuranceMembership("insurance_membership_dialog_exposed", source, contextLabel || "保险会员弹窗");
  }, [contextLabel, open, source]);

  if (!open) {
    return null;
  }

  const upgrade = () => {
    trackInsuranceMembership("insurance_membership_upgrade_clicked", source, contextLabel || "包年会员");
    if (onUpgrade) {
      onUpgrade();
      return;
    }
    openInsuranceMembershipCheckout(source);
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        aria-label="关闭会员弹窗"
        className="absolute inset-0 bg-zinc-950/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-zinc-200 bg-white p-4 shadow-2xl sm:p-6">
        <button
          type="button"
          aria-label="关闭"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-sm hover:bg-zinc-100"
        >
          <X size={16} />
        </button>

        <div className="pr-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
            <Crown size={14} fill="currentColor" />
            保险海报会员
          </div>
          <h3 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
            解锁更多保险营销海报
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
            少量基础模板可免费体验；高级模板适合长期展业、客户教育、产品说明和服务提醒，支持更稳定地生成同款与下载海报。
          </p>
          {contextLabel ? (
            <p className="mt-3 inline-flex rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
              当前场景：{contextLabel}
            </p>
          ) : null}
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-semibold text-zinc-950">免费版</h4>
                <p className="mt-1 text-sm text-zinc-500">适合先体验保险模板效果</p>
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-sm font-medium text-zinc-700 shadow-sm">¥0</div>
            </div>
            <ul className="mt-4 space-y-2.5 text-sm leading-5 text-zinc-700">
              {freeBenefits.map((benefit) => (
                <li key={benefit} className="flex gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-zinc-500" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="relative rounded-2xl border border-zinc-950 bg-zinc-950 p-4 text-white shadow-[0_18px_45px_rgba(15,23,42,0.24)]">
            <div className="absolute right-4 top-4 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-semibold text-zinc-950 shadow-[0_8px_18px_rgba(245,158,11,0.3)]">
              推荐
            </div>
            <div className="pr-16">
              <h4 className="text-lg font-semibold">包年会员</h4>
              <p className="mt-1 text-sm text-zinc-300">适合保险代理人和团队持续展业</p>
            </div>
            <div className="mt-5 flex items-end gap-2">
              <span className="text-4xl font-semibold tracking-tight">¥199</span>
              <span className="pb-1 text-sm text-zinc-300">/ 年</span>
            </div>
            <p className="mt-2 inline-flex rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-amber-200">
              含 6000 积分，可生成 1000 张图
            </p>
            <ul className="mt-4 space-y-2.5 text-sm leading-5 text-zinc-100">
              {annualBenefits.map((benefit) => (
                <li key={benefit} className="flex gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-amber-300" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={upgrade}
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-amber-100"
            >
              开通包年会员
              <ArrowRight size={15} />
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
