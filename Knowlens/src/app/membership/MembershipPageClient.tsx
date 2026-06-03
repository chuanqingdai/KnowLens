"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  BadgeCheck,
  Check,
  ChevronDown,
  CreditCard,
  LoaderCircle,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  getSubscriptionByUser,
  type BillingCycle,
  type SubscriptionSnapshot,
} from "@/lib/billing";
import { STANDARD_OUTPUT_PROMO_CREDITS, STANDARD_OUTPUT_REGULAR_CREDITS } from "@/lib/credit-pricing";
import { PromoCountdownBanner } from "@/components/billing/PromoCountdownBanner";
import { useSession } from "next-auth/react";
import { findBillingPlan, type BillingPlanId } from "@/lib/billing-plans";

type Plan = {
  id: BillingPlanId;
  name: string;
  subtitle: string;
  monthlyPrice: number;
  yearlyPrice: number;
  yearlyEquivalent: number;
  monthlyCredits: number;
  usage: string;
  recommended?: boolean;
  features: string[];
  supportedTextModels: string[];
  supportedImageModels: string[];
};

const SHARED_TEXT_MODELS = [
  "GPT-5.4",
  "GPT-5.5",
  "Gemini 3.1 Pro",
  "Claude Sonnet 4.6",
];

const SHARED_IMAGE_MODELS = ["GPT-image2"];

const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    subtitle: "Create clean infographics and simple slides without watermark.",
    monthlyPrice: 14.9,
    yearlyPrice: 124.9,
    yearlyEquivalent: 10.43,
    monthlyCredits: 1200,
    usage: "6 credits/image during promo, up to ~200 images/month.",
    features: [
      "1,200 monthly credits",
      "No watermark",
      "Standard infographic generation",
      "Basic PPT generation",
      "Standard image export",
      "Basic visual styles",
      "Standard queue",
      "Image2 visuals with optimized credit usage",
    ],
    supportedTextModels: SHARED_TEXT_MODELS,
    supportedImageModels: SHARED_IMAGE_MODELS,
  },
  {
    id: "pro",
    name: "Creator",
    subtitle: "Best for creators turning articles, videos, and ideas into visual content.",
    monthlyPrice: 29,
    yearlyPrice: 242,
    yearlyEquivalent: 20.17,
    monthlyCredits: 3000,
    usage: "6 credits/image during promo, up to ~500 images/month.",
    recommended: true,
    features: [
      "3,000 monthly credits",
      "No watermark",
      "HD infographic export",
      "More visual styles",
      "Visual PPT generation",
      "YouTube thumbnail and poster generation",
      "Video storyboard generation",
      "Faster generation queue",
      "Longer content input",
      "Commercial usage",
      "Image2 visuals with optimized credit usage",
    ],
    supportedTextModels: SHARED_TEXT_MODELS,
    supportedImageModels: SHARED_IMAGE_MODELS,
  },
  {
    id: "scale",
    name: "Pro",
    subtitle: "For high-volume creators producing HD visuals, presentations, and video-ready content regularly.",
    monthlyPrice: 59,
    yearlyPrice: 489.9,
    yearlyEquivalent: 40.83,
    monthlyCredits: 7500,
    usage: "6 credits/image during promo, up to ~1,250 images/month.",
    features: [
      "7,500 monthly credits",
      "No watermark",
      "Premium HD export",
      "Long infographic generation",
      "Full visual PPT generation",
      "Video storyboard generation",
      "Priority rendering",
      "Batch generation",
      "Commercial usage",
      "Image2 visuals with optimized credit usage",
    ],
    supportedTextModels: SHARED_TEXT_MODELS,
    supportedImageModels: SHARED_IMAGE_MODELS,
  },
];

const faqItems = [
  {
    q: "Why is yearly billing better value?",
    a: "Yearly billing includes a default 30% discount versus monthly pricing for the same plan.",
  },
  {
    q: "How are credits used?",
    a: "A standard visual output costs 20 credits normally, or 6 credits during the limited-time offer. A standard visual output can be a poster, PPT slide, or storyboard frame.",
  },
  {
    q: "Which payment methods are supported?",
    a: "Subscriptions are processed securely through Stripe, including cards and Stripe-supported payment methods.",
  },
  {
    q: "When does access update after payment?",
    a: "Plan access is applied immediately after successful payment, including credits and feature permissions.",
  },
  {
    q: "Do credits reset every month?",
    a: "Yes. Credits are granted monthly by plan, including users who choose yearly billing.",
  },
  {
    q: "Can I upgrade or downgrade anytime?",
    a: "Yes. Upgrades are typically immediate with prorated adjustments. Downgrades apply at the next billing cycle.",
  },
  {
    q: "Are exports watermarked?",
    a: "Free users include watermark, standard queue, limited styles, and limited export quality. Paid plans remove watermark.",
  },
  {
    q: "How does team collaboration work?",
    a: "Current public plans focus on individual creators: Starter, Creator, and Pro.",
  },
  {
    q: "What happens if I run out of credits?",
    a: "High-cost actions are blocked before execution. You can top up or upgrade and then continue.",
  },
];

function formatUsd(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

const PENDING_CHECKOUT_KEY = "knowlens-pending-checkout-v1";
const CHECKOUT_REQUEST_TIMEOUT_MS = 25_000;
const MEMBERSHIP_SOURCE_KEY = "knowlens:membership-source";

type PendingCheckout = {
  planId: string;
  cycle: BillingCycle;
  startedAt: string;
  sessionId?: string;
  source?: string;
};

type TelemetryEventInput = {
  category: string;
  action: string;
  status?: "ok" | "error" | "info";
  source?: string;
  code?: string;
  message?: string;
  details?: unknown;
};

function readMembershipSource() {
  if (typeof window === "undefined") {
    return "unknown";
  }
  try {
    const source = window.sessionStorage.getItem(MEMBERSHIP_SOURCE_KEY)?.trim();
    return source || "unknown";
  } catch {
    return "unknown";
  }
}

function readPendingCheckout() {
  if (typeof window === "undefined") {
    return null as PendingCheckout | null;
  }
  const raw = window.sessionStorage.getItem(PENDING_CHECKOUT_KEY);
  if (!raw) {
    return null as PendingCheckout | null;
  }
  try {
    return JSON.parse(raw) as PendingCheckout;
  } catch {
    return null as PendingCheckout | null;
  }
}

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

export default function MembershipPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("yearly");
  const [toast, setToast] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState(0);
  const [payingPlanId, setPayingPlanId] = useState<BillingPlanId | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [pendingFinalizeSessionId, setPendingFinalizeSessionId] = useState<string | null>(null);
  const [pendingCheckoutMeta, setPendingCheckoutMeta] = useState<PendingCheckout | null>(null);
  const [membershipSource, setMembershipSource] = useState("unknown");
  const processedSessionRef = useRef<string | null>(null);
  const currentEmail = (session?.user?.email ?? "").trim().toLowerCase();
  const [refreshVersion, setRefreshVersion] = useState(0);
  const subscription = useMemo<SubscriptionSnapshot | null>(() => {
    void refreshVersion;
    return getSubscriptionByUser(currentEmail);
  }, [currentEmail, refreshVersion]);
  const [returnPath] = useState(() => {
    if (typeof window === "undefined") {
      return "/";
    }
    try {
      const storedPath = window.sessionStorage.getItem("membership:return-path");
      if (storedPath && storedPath !== "/membership") {
        return storedPath;
      }
    } catch {
      return "/";
    }
    return "/";
  });

  useEffect(() => {
    window.history.replaceState(null, "", returnPath);
  }, [returnPath]);

  useEffect(() => {
    setMembershipSource(readMembershipSource());
  }, []);

  const trackTelemetry = useCallback(async (event: TelemetryEventInput) => {
    try {
      await fetch("/api/telemetry/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
    } catch {
      // best-effort telemetry only
    }
  }, []);

  useEffect(() => {
    if (!currentEmail) {
      return;
    }
    void trackTelemetry({
      category: "billing",
      action: "paywall_exposed",
      status: "info",
      source: membershipSource || "unknown",
      details: {
        path: "/membership",
      },
    });
  }, [currentEmail, membershipSource, trackTelemetry]);

  const finalizeCheckoutSession = useCallback(
    async (sessionId: string) => {
      setFinalizing(true);
      try {
        const response = await fetch("/api/billing/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          duplicate?: boolean;
          reason?: string;
          error?: string;
          message?: string;
        };

        if (response.ok && data.ok) {
          clearPendingCheckout();
          setPendingCheckoutMeta(null);
          setPendingFinalizeSessionId(null);
          setRefreshVersion((prev) => prev + 1);
          setToast(
            data.duplicate
              ? "Payment already verified earlier. Credits were not added twice."
              : "Payment verified. Membership and credits are now active.",
          );
          router.replace(returnPath);
          return;
        }

        if (data.reason === "canceled_or_incomplete") {
          clearPendingCheckout();
          setPendingCheckoutMeta(null);
          setPendingFinalizeSessionId(null);
          setToast("Checkout was canceled or not completed. No charge and no credits were added.");
          router.replace(returnPath);
          return;
        }

        if (data.reason === "payment_failed_or_unpaid") {
          clearPendingCheckout();
          setPendingCheckoutMeta(null);
          setPendingFinalizeSessionId(null);
          setToast("Payment failed. No credits were added. Please try another payment method.");
          router.replace(returnPath);
          return;
        }

        throw new Error(data.error || data.message || "Payment verification failed.");
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Network interrupted while verifying payment. No credits were added.";
        setPendingFinalizeSessionId(sessionId);
        setToast(`${message} You can retry verification.`);
      } finally {
        setFinalizing(false);
      }
    },
    [returnPath, router],
  );

  useEffect(() => {
    if (typeof window === "undefined" || finalizing) {
      return;
    }
    setPendingCheckoutMeta(readPendingCheckout());
    const params = new URLSearchParams(window.location.search);
    const checkoutStatus = params.get("checkout");
    const sessionId = params.get("session_id");

    if (checkoutStatus === "cancel") {
      clearPendingCheckout();
      setPendingCheckoutMeta(null);
      setPendingFinalizeSessionId(null);
      setToast("Checkout was canceled. No charge and no credits were added.");
      router.replace(returnPath);
      return;
    }

    if (checkoutStatus !== "success" || !sessionId) {
      const pending = readPendingCheckout();
      if (pending?.sessionId) {
        setPendingFinalizeSessionId(pending.sessionId);
      }
      return;
    }

    if (processedSessionRef.current === sessionId) {
      return;
    }
    processedSessionRef.current = sessionId;

    const pending = readPendingCheckout();
    if (pending) {
      savePendingCheckout({
        ...pending,
        sessionId,
      });
      setPendingCheckoutMeta({
        ...pending,
        sessionId,
      });
    }
    void finalizeCheckoutSession(sessionId);
  }, [finalizeCheckoutSession, finalizing, returnPath, router]);

  const plansWithCyclePrice = useMemo(() => {
    return plans.map((plan) => {
      const monthly = plan.monthlyPrice;
      const yearly = plan.yearlyPrice;
      const cyclePrice = billingCycle === "monthly" ? monthly : yearly;
      const cycleUnit = billingCycle === "monthly" ? "/mo" : "/yr";
      const monthlyEquivalent = billingCycle === "yearly" ? plan.yearlyEquivalent : monthly;
      return {
        ...plan,
        cyclePrice,
        cycleUnit,
        yearly,
        monthlyEquivalent,
      };
    });
  }, [billingCycle]);

  async function handlePay(plan: Plan) {
    const isPaying = Boolean(payingPlanId);
    if (isPaying || finalizing) {
      return;
    }
    setPayingPlanId(plan.id);
    if (!currentEmail) {
      setToast("Please sign in first to continue checkout.");
      setPayingPlanId(null);
      return;
    }
    if (!findBillingPlan(plan.id)) {
      setToast("Plan config is invalid. Please refresh and retry.");
      setPayingPlanId(null);
      return;
    }
    router.prefetch(returnPath);
    void trackTelemetry({
      category: "billing",
      action: "pay_button_clicked",
      status: "info",
      source: membershipSource,
      details: {
        planId: plan.id,
        cycle: billingCycle,
      },
    });
    try {
      savePendingCheckout({
        planId: plan.id,
        cycle: billingCycle,
        startedAt: new Date().toISOString(),
        source: membershipSource,
      });
      setPendingCheckoutMeta({
        planId: plan.id,
        cycle: billingCycle,
        startedAt: new Date().toISOString(),
        source: membershipSource,
      });
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), CHECKOUT_REQUEST_TIMEOUT_MS);
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          cycle: billingCycle,
          source: membershipSource,
        }),
        signal: controller.signal,
      }).finally(() => {
        window.clearTimeout(timeoutId);
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        checkoutUrl?: string;
        directCheckoutUrl?: string;
        fallback?: boolean;
        error?: string;
      };
      if (!response.ok || !data.ok || !data.checkoutUrl) {
        throw new Error(data.error || "Unable to create checkout session.");
      }
      if (data.fallback) {
        setToast("Using one-time checkout fallback to maximize payment success.");
      }
      void trackTelemetry({
        category: "billing",
        action: "checkout_redirect_started",
        status: "ok",
        source: membershipSource,
        details: {
          planId: plan.id,
          cycle: billingCycle,
          fallback: Boolean(data.fallback),
        },
      });
      const directCheckoutUrl = (data.directCheckoutUrl || "").trim();
      const redirectCheckoutUrl = data.checkoutUrl.trim();
      const preferredCheckoutUrl = directCheckoutUrl || redirectCheckoutUrl;
      window.setTimeout(() => {
        if (document.visibilityState === "visible") {
          window.location.replace(redirectCheckoutUrl);
        }
      }, 2500);
      window.location.href = preferredCheckoutUrl;
      return;
    } catch (error) {
      clearPendingCheckout();
      setPendingCheckoutMeta(null);
      const message =
        error instanceof DOMException && error.name === "AbortError"
          ? "Checkout is taking too long. Please try again."
          : error instanceof Error
            ? error.message
            : "Checkout failed.";
      const normalized = message.toLowerCase();
      if (
        normalized.includes("stripe") &&
        (normalized.includes("key") || normalized.includes("configured"))
      ) {
        setToast("Stripe checkout is unavailable. Please verify server env STRIPE_SECRET_KEY.");
      } else {
        setToast(message);
      }
      void trackTelemetry({
        category: "billing",
        action: "checkout_redirect_failed",
        status: "error",
        source: membershipSource,
        message,
        details: {
          planId: plan.id,
          cycle: billingCycle,
        },
      });
      setPayingPlanId(null);
    } finally {
      // Keep loading state while browser navigates to Stripe.
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <div className="fixed inset-0 bg-zinc-900/30 backdrop-blur-[2px]" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full items-end justify-center p-0 sm:items-center sm:p-5">
        <div className="w-full max-w-6xl overflow-hidden rounded-t-3xl border border-zinc-200 bg-white shadow-2xl sm:rounded-3xl">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
            <p className="text-sm font-medium text-zinc-500">Membership</p>
            <button
              type="button"
              onClick={() => router.push(returnPath)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              aria-label="Close membership modal"
            >
              <X size={16} />
            </button>
          </div>

          <div className="max-h-[88dvh] overflow-y-auto px-3 pb-8 pt-4 sm:max-h-[86vh] sm:px-6 sm:pt-5 lg:px-8">
            <PromoCountdownBanner />

            <section className="mt-5 flex justify-center">
          <div className="inline-flex w-full max-w-[360px] rounded-full border border-zinc-200 bg-zinc-100 p-1">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={`flex-1 rounded-full px-3 py-2 text-xs font-medium transition sm:px-4 sm:text-sm ${
                billingCycle === "monthly"
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("yearly")}
              className={`flex-1 rounded-full px-3 py-2 text-xs font-medium transition sm:px-4 sm:text-sm ${
                billingCycle === "yearly"
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Annual (Save 30%)
            </button>
          </div>
            </section>

            <section className="mt-6 grid gap-3 sm:gap-4 lg:grid-cols-3">
          {plansWithCyclePrice.map((plan) => (
            <article
              key={plan.id}
              className={`relative flex h-full flex-col rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${
                plan.recommended
                  ? "border-zinc-900 ring-1 ring-zinc-900/15"
                  : "border-zinc-200"
              }`}
            >
              {plan.recommended ? (
                <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                  <BadgeCheck size={12} />
                  Most Popular
                </span>
              ) : null}

              <h2 className="text-lg font-semibold text-zinc-900">{plan.name}</h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500">{plan.subtitle}</p>
              <p className="mt-1 text-sm text-zinc-500">
                {plan.monthlyCredits.toLocaleString("en-US")} credits / month
              </p>

              <div className="mt-4">
                <p className="text-3xl font-semibold leading-none text-zinc-900">
                  ${formatUsd(plan.cyclePrice)}
                  <span className="ml-1 text-base font-medium text-zinc-500">
                    {plan.cycleUnit}
                  </span>
                </p>
                {billingCycle === "yearly" ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    Equivalent to ${formatUsd(plan.monthlyEquivalent)}/mo
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => handlePay(plan)}
                disabled={Boolean(payingPlanId) || finalizing}
                className={`mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition ${
                  plan.recommended
                    ? "bg-zinc-900 text-white hover:bg-zinc-700"
                    : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100"
                } ${payingPlanId || finalizing ? "cursor-not-allowed opacity-70" : ""}`}
              >
                {payingPlanId === plan.id ? <LoaderCircle size={15} className="animate-spin" /> : <Zap size={15} />}
                {payingPlanId === plan.id
                  ? "Opening Checkout..."
                  : finalizing
                    ? "Verifying Payment..."
                    : "Subscribe with Stripe"}
              </button>

              <p className="mt-2 text-xs text-zinc-500">{plan.usage}</p>

              <ul className="mt-4 space-y-2 text-sm text-zinc-700">
                <li className="border-b border-zinc-200 pb-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-900">
                    Model Access
                  </p>
                  <div className="mt-2 space-y-1">
                    {plan.supportedTextModels.map((model) => (
                      <p
                        key={`${plan.id}-text-model-${model}`}
                        className="flex items-center gap-2 text-[12px] leading-5 text-zinc-700"
                      >
                        <Check size={12} className="shrink-0 text-zinc-900" />
                        <span>{model}</span>
                      </p>
                    ))}
                  </div>
                  <div className="mt-2 space-y-1">
                    {plan.supportedImageModels.map((model) => {
                      const hasPromo = model.toLowerCase().includes("gpt-image2");
                      return (
                        <p
                          key={`${plan.id}-image-model-${model}`}
                          className="flex items-center gap-2 text-[12px] leading-5 text-zinc-700"
                        >
                          <Check size={12} className="shrink-0 text-zinc-900" />
                          <span className="flex items-center gap-1.5">
                            <span>{model}</span>
                            {hasPromo ? (
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                                Limited-time 70% off
                              </span>
                            ) : null}
                          </span>
                        </p>
                      );
                    })}
                  </div>
                </li>
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check size={14} className="mt-0.5 text-zinc-900" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
            </section>
            <p className="mt-3 text-xs leading-5 text-amber-800">
              * GPT-image2 limited-time 70% off offer. Availability windows may change.
            </p>

            <section className="mt-6 rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-zinc-900">Trusted Billing & Security</h3>
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] text-zinc-600">
              Stripe Checkout
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-900">
                <ShieldCheck size={14} />
                Encrypted Payments
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-600">
                Secure Stripe checkout with industry-standard protection.
              </p>
            </article>
            <article className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-900">
                <CreditCard size={14} />
                Full Subscription Control
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-600">
                Auto-renew is enabled, and you can cancel anytime.
              </p>
            </article>
            <article className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-900">
                <BadgeCheck size={14} />
                Invoice Ready
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-600">
                Billing records and invoice support for teams and businesses.
              </p>
            </article>
            <article className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-900">
                <Zap size={14} />
                Start Small, Scale Fast
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-600">
                Begin with a lower plan and upgrade as your output grows.
              </p>
            </article>
          </div>
            </section>

            <section className="mt-6 rounded-2xl border border-zinc-200 bg-white px-4 py-5 shadow-sm sm:px-5 sm:py-6">
          <h3 className="text-lg font-semibold text-zinc-900">Frequently Asked Questions</h3>
          <div className="mt-4 divide-y divide-zinc-200">
            {faqItems.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q} className="py-3">
                  <button
                    type="button"
                    onClick={() => setOpenFaq((prev) => (prev === idx ? -1 : idx))}
                    data-plain-interaction="true"
                    className="flex w-full items-center justify-between gap-3 text-left transition hover:text-zinc-950"
                  >
                    <p className="text-sm font-medium text-zinc-900">{item.q}</p>
                    <ChevronDown
                      size={16}
                      className={`shrink-0 text-zinc-500 transition ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen ? (
                    <p className="mt-2 pr-6 text-sm leading-6 text-zinc-600">{item.a}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
            </section>
          </div>
        </div>
      </div>

      {pendingFinalizeSessionId ? (
        <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-1rem)] max-w-[560px] -translate-x-1/2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-lg sm:bottom-20 sm:w-[min(92vw,560px)]">
          <p className="font-medium">Payment verification is pending</p>
          <p className="mt-1 text-xs leading-5 text-amber-800">
            {pendingCheckoutMeta
              ? `Plan ${pendingCheckoutMeta.planId} (${pendingCheckoutMeta.cycle}) was started, but verification did not complete yet.`
              : "A checkout session returned, but verification did not complete yet."}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void finalizeCheckoutSession(pendingFinalizeSessionId)}
              disabled={finalizing}
              className="inline-flex h-8 items-center rounded-lg bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {finalizing ? "Verifying..." : "Retry verification"}
            </button>
            <button
              type="button"
              onClick={() => {
                clearPendingCheckout();
                setPendingCheckoutMeta(null);
                setPendingFinalizeSessionId(null);
              }}
              className="inline-flex h-8 items-center rounded-lg border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed left-1/2 top-3 z-50 w-[calc(100%-1.5rem)] max-w-[560px] -translate-x-1/2 rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg sm:top-6 sm:w-auto">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
