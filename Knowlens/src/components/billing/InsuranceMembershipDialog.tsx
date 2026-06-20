"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";

type InsuranceMembershipDialogProps = {
  open: boolean;
  source?: string;
  contextLabel?: string;
  onClose: () => void;
  onUpgrade?: () => void;
};

const freeBenefits = [
  "浏览保险海报案例",
  "下载少量免费海报",
];

const annualBenefits = [
  "解锁所有保险海报模板",
  "一键生成同款，快速发朋友圈",
  "适合私域营销与长期展业",
  "会员有效期 1 年",
];

const PENDING_CHECKOUT_KEY = "knowlens-pending-checkout-v1";
const MEMBERSHIP_SOURCE_KEY = "knowlens:membership-source";
const MEMBERSHIP_PREFERRED_PLAN_KEY = "knowlens:membership-preferred-plan";
const MEMBERSHIP_PREFERRED_CYCLE_KEY = "knowlens:membership-preferred-cycle";
const INSURANCE_AUTO_CHECKOUT_KEY = "knowlens:insurance:auto-checkout:v1";
const CHECKOUT_REQUEST_TIMEOUT_MS = 25_000;

type PendingCheckout = {
  planId: string;
  cycle: "yearly";
  startedAt: string;
  sessionId?: string;
  source?: string;
};

function savePendingCheckout(input: PendingCheckout) {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(input));
}

function clearPendingCheckout() {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
}

function saveInsuranceAutoCheckoutIntent(source: string) {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(
    INSURANCE_AUTO_CHECKOUT_KEY,
    JSON.stringify({
      source,
      createdAt: new Date().toISOString(),
    }),
  );
}

export function consumeInsuranceAutoCheckoutIntent() {
  if (typeof window === "undefined") {
    return null as { source?: string } | null;
  }
  const raw = window.sessionStorage.getItem(INSURANCE_AUTO_CHECKOUT_KEY);
  window.sessionStorage.removeItem(INSURANCE_AUTO_CHECKOUT_KEY);
  if (!raw) {
    return null as { source?: string } | null;
  }
  try {
    return JSON.parse(raw) as { source?: string } | null;
  } catch {
    return null as { source?: string } | null;
  }
}

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
    return Promise.resolve();
  }
  window.sessionStorage.setItem("membership:return-path", "/insurance");
  window.sessionStorage.setItem(MEMBERSHIP_SOURCE_KEY, source);
  window.sessionStorage.setItem(MEMBERSHIP_PREFERRED_PLAN_KEY, "insurance");
  window.sessionStorage.setItem(MEMBERSHIP_PREFERRED_CYCLE_KEY, "yearly");

  const startedAt = new Date().toISOString();
  const pendingCheckout: PendingCheckout = {
    planId: "insurance",
    cycle: "yearly",
    startedAt,
    source,
  };
  savePendingCheckout(pendingCheckout);

  const callbackUrl = `${window.location.pathname || "/insurance"}${window.location.search || ""}`;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), CHECKOUT_REQUEST_TIMEOUT_MS);

  return fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      planId: "insurance",
      cycle: "yearly",
      source,
    }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (response.status === 401) {
        saveInsuranceAutoCheckoutIntent(source);
        window.location.assign(`/auth?callbackUrl=${encodeURIComponent(callbackUrl || "/insurance")}`);
        return;
      }

      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        checkoutUrl?: string;
        directCheckoutUrl?: string;
        error?: string;
        sessionId?: string | null;
      };

      if (!response.ok || !data.ok || !data.checkoutUrl) {
        throw new Error(data.error || "Unable to create checkout session.");
      }

      if (data.sessionId) {
        savePendingCheckout({
          ...pendingCheckout,
          sessionId: data.sessionId,
        });
      }

      const directCheckoutUrl = (data.directCheckoutUrl || "").trim();
      const redirectCheckoutUrl = data.checkoutUrl.trim();
      const preferredCheckoutUrl = directCheckoutUrl || redirectCheckoutUrl;
      window.setTimeout(() => {
        if (document.visibilityState === "visible") {
          window.location.replace(redirectCheckoutUrl);
        }
      }, 2500);
      window.location.assign(preferredCheckoutUrl);
    })
    .catch((error: unknown) => {
      clearPendingCheckout();
      const message =
        error instanceof DOMException && error.name === "AbortError"
          ? "创建支付会话超时，请稍后重试。"
          : error instanceof Error
            ? error.message
            : "创建支付会话失败，请稍后重试。";
      window.alert(message);
    })
    .finally(() => {
      window.clearTimeout(timeoutId);
    });
}

export function InsuranceMembershipDialog({
  open,
  source = "insurance_membership_dialog",
  contextLabel,
  onClose,
  onUpgrade,
}: InsuranceMembershipDialogProps) {
  const [submitting, setSubmitting] = useState(false);

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
    setSubmitting(true);
    void openInsuranceMembershipCheckout(source).finally(() => {
      setSubmitting(false);
    });
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        aria-label="关闭会员弹窗"
        className="absolute inset-0 bg-zinc-950/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-zinc-200 bg-white p-4 shadow-2xl [scrollbar-width:none] [-ms-overflow-style:none] sm:p-6 [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          aria-label="关闭"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-sm hover:bg-zinc-100"
        >
          <X size={16} />
        </button>

        <div className="pr-10">
          <h3 className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
            解锁更多保险营销海报
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
            免费体验基础模板，升级后解锁高级海报、生成同款和下载权益。
          </p>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-semibold text-zinc-950">免费版</h4>
                <p className="mt-1 text-sm text-zinc-500">先体验模板效果</p>
              </div>
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
              5 折
            </div>
            <div className="pr-16">
              <h4 className="text-lg font-semibold">包年会员</h4>
              <p className="mt-1 text-sm text-zinc-300">一年海报素材安心用</p>
            </div>
            <div className="mt-5 flex flex-wrap items-end gap-x-2 gap-y-1">
              <span className="text-4xl font-semibold tracking-tight">¥199</span>
              <span className="pb-1 text-sm text-zinc-300">/ 年</span>
              <span className="pb-1 text-xs text-zinc-500 line-through">原价 399元/年</span>
            </div>
            <p className="mt-2 inline-flex rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-amber-200">
              含 6000 积分，1000次生图和下载
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
              disabled={submitting}
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-amber-100"
            >
              {submitting ? "跳转支付中..." : "开通包年会员"}
              <ArrowRight size={15} />
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
