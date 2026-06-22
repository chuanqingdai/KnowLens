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
  "新账号默认赠送 30 积分",
  "生成和下载均按积分扣除",
];

const annualBenefits = [
  "节日热点海报快速跟进",
  "客户沟通更专业有温度",
  "朋友圈私域获客更省心",
  "全年展业素材持续更新",
];

const PENDING_CHECKOUT_KEY = "knowlens-pending-checkout-v1";
const MEMBERSHIP_SOURCE_KEY = "knowlens:membership-source";
const MEMBERSHIP_PREFERRED_PLAN_KEY = "knowlens:membership-preferred-plan";
const MEMBERSHIP_PREFERRED_CYCLE_KEY = "knowlens:membership-preferred-cycle";
const INSURANCE_AUTO_CHECKOUT_KEY = "knowlens:insurance:auto-checkout:v1";
const CHECKOUT_REQUEST_TIMEOUT_MS = 25_000;

type PendingCheckout = {
  planId: string;
  cycle: "yearly" | "one_time";
  startedAt: string;
  sessionId?: string;
  source?: string;
  purchaseType?: "subscription" | "credit_topup";
  credits?: number;
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

function getInsuranceReturnPath() {
  if (typeof window === "undefined") {
    return "/baox";
  }
  const pathname = window.location.pathname || "/";
  const search = window.location.search || "";
  if (pathname === "/" || pathname === "/insurance") {
    return `/baox${search}`;
  }
  return `${pathname || "/baox"}${search}`;
}

export function openInsuranceMembershipCheckout(source = "insurance_membership_dialog") {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  const callbackUrl = getInsuranceReturnPath();
  window.sessionStorage.setItem("membership:return-path", callbackUrl);
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
        window.location.assign(`/auth?callbackUrl=${encodeURIComponent(callbackUrl || "/baox")}`);
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

export function openInsuranceCreditTopupCheckout(source = "insurance_credit_topup_dialog") {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  const callbackUrl = getInsuranceReturnPath();
  window.sessionStorage.setItem("membership:return-path", callbackUrl);
  window.sessionStorage.setItem(MEMBERSHIP_SOURCE_KEY, source);
  window.sessionStorage.setItem(MEMBERSHIP_PREFERRED_PLAN_KEY, "insurance_credits_6000");
  window.sessionStorage.setItem(MEMBERSHIP_PREFERRED_CYCLE_KEY, "one_time");

  const startedAt = new Date().toISOString();
  const pendingCheckout: PendingCheckout = {
    planId: "insurance_credits_6000",
    cycle: "one_time",
    startedAt,
    source,
    purchaseType: "credit_topup",
    credits: 6000,
  };
  savePendingCheckout(pendingCheckout);

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), CHECKOUT_REQUEST_TIMEOUT_MS);

  return fetch("/api/billing/credits/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (response.status === 401) {
        saveInsuranceAutoCheckoutIntent(source);
        window.location.assign(`/auth?callbackUrl=${encodeURIComponent(callbackUrl || "/baox")}`);
        return;
      }

      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        checkoutUrl?: string;
        directCheckoutUrl?: string;
        error?: string;
        code?: string;
        sessionId?: string | null;
      };

      if (!response.ok || !data.ok || !data.checkoutUrl) {
        if (data.code === "WECHAT_PAY_UNAVAILABLE") {
          throw new Error(data.error || "微信支付暂不可用，请先使用银行卡支付，或联系我们协助处理。");
        }
        throw new Error(data.error || "创建充值支付会话失败，请稍后重试。");
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
          ? "创建充值支付会话超时，请稍后重试。"
          : error instanceof Error
            ? error.message
            : "创建充值支付会话失败，请稍后重试。";
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
    trackInsuranceMembership("insurance_membership_dialog_exposed", source, contextLabel || "保险积分弹窗");
  }, [contextLabel, open, source]);

  if (!open) {
    return null;
  }

  const upgrade = () => {
    trackInsuranceMembership("insurance_membership_upgrade_clicked", source, contextLabel || "积分充值包");
    if (onUpgrade) {
      onUpgrade();
      return;
    }
    setSubmitting(true);
    void openInsuranceCreditTopupCheckout(source).finally(() => {
      setSubmitting(false);
    });
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="关闭积分弹窗"
        className="absolute inset-0 bg-zinc-950/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative max-h-[calc(100dvh-0.75rem)] w-full max-w-3xl overflow-hidden rounded-t-[26px] border border-zinc-200 bg-white shadow-2xl sm:max-h-[92dvh] sm:rounded-3xl">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-zinc-200 sm:hidden" />
        <button
          type="button"
          aria-label="关闭"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-sm hover:bg-zinc-100 sm:right-4 sm:top-4 sm:h-9 sm:w-9"
        >
          <X size={16} />
        </button>

        <div className="max-h-[calc(100dvh-6.75rem)] overflow-y-auto px-4 pb-5 pt-3 [scrollbar-width:none] [-ms-overflow-style:none] sm:max-h-[92dvh] sm:p-6 [&::-webkit-scrollbar]:hidden">
          <div className="pr-10">
            <h3 className="text-[22px] font-semibold leading-tight tracking-tight text-zinc-950 sm:text-3xl">
              解锁更多保险营销海报
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              覆盖日常展业和客户沟通场景，购买后即可生成同款并下载使用。
            </p>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3.5 sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-semibold text-zinc-950">新手积分</h4>
                <p className="mt-1 text-sm text-zinc-500">注册后即可开始使用</p>
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

          <section className="relative rounded-2xl border border-zinc-950 bg-zinc-950 p-3.5 text-white shadow-[0_18px_45px_rgba(15,23,42,0.24)] sm:p-4">
            <div className="absolute right-4 top-4 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-semibold text-zinc-950 shadow-[0_8px_18px_rgba(245,158,11,0.3)]">
              5 折
            </div>
            <div className="pr-16">
              <h4 className="text-lg font-semibold">积分充值包</h4>
              <p className="mt-1 text-sm text-zinc-300">一次充值，随用随扣</p>
            </div>
            <div className="mt-5 flex flex-wrap items-end gap-x-2 gap-y-1">
              <span className="text-4xl font-semibold tracking-tight">¥199</span>
              <span className="pb-1 text-sm text-zinc-300">/ 年</span>
              <span className="pb-1 text-xs text-zinc-500 line-through">原价 399元</span>
            </div>
            <p className="mt-2 inline-flex rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-amber-200">
              一次到账 6000 积分
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
              className="mt-5 hidden h-11 w-full items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-amber-100 sm:inline-flex"
            >
              {submitting ? "跳转支付中..." : "微信/支付宝充值"}
              <ArrowRight size={15} />
            </button>
          </section>
          </div>
        </div>
        <div className="border-t border-zinc-200 bg-white px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:hidden">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-zinc-500">积分充值包</p>
              <p className="text-lg font-semibold leading-none text-zinc-950">¥199 <span className="text-xs font-medium text-zinc-500">/ 年</span></p>
            </div>
            <p className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">含 6000 积分</p>
          </div>
          <button
            type="button"
            onClick={upgrade}
            disabled={submitting}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-zinc-950 px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.22)] transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? "跳转支付中..." : "微信/支付宝充值"}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
