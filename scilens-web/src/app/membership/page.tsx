"use client";

import { useEffect, useMemo, useState } from "react";
import {
  X,
  BadgeCheck,
  Check,
  ChevronDown,
  CreditCard,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  activateSubscription,
  appendCreditRecord,
  getSubscription,
  type BillingCycle,
  type SubscriptionSnapshot,
} from "@/lib/billing";
import { useSession } from "next-auth/react";
import { getAdminUserByEmail } from "@/lib/admin";

type Plan = {
  id: string;
  name: string;
  subtitle: string;
  monthlyPrice: number;
  yearlyPrice: number;
  monthlyCredits: number;
  recommended?: boolean;
  features: string[];
  stripeLinks: {
    monthly?: string;
    yearly?: string;
  };
};

const plans: Plan[] = [
  {
    id: "starter",
    name: "Essential",
    subtitle: "Best for individuals getting started",
    monthlyPrice: 9.9,
    yearlyPrice: 82,
    monthlyCredits: 1200,
    features: [
      "Core content understanding and draft generation",
      "Standard storyboard generation and one redraw per scene",
      "Basic TTS voices and video export",
      "Standard export settings",
      "Up to 3 active projects",
      "Access to core generation models",
    ],
    stripeLinks: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_STARTER_MONTHLY,
      yearly: process.env.NEXT_PUBLIC_STRIPE_STARTER_YEARLY,
    },
  },
  {
    id: "pro",
    name: "Creator",
    subtitle: "For creators publishing every week",
    monthlyPrice: 18.9,
    yearlyPrice: 159,
    monthlyCredits: 3600,
    recommended: true,
    features: [
      "Advanced content structuring and editing controls",
      "Storyboard history and version snapshots",
      "More TTS voices and better pacing options",
      "Faster queue and priority generation",
      "Shared project space for small teams",
      "Watermark-free exports (up to 1080p)",
      "Batch storyboard generation",
      "Priority access to advanced models",
    ],
    stripeLinks: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY,
      yearly: process.env.NEXT_PUBLIC_STRIPE_PRO_YEARLY,
    },
  },
  {
    id: "scale",
    name: "Business",
    subtitle: "For teams and high-volume production",
    monthlyPrice: 35.9,
    yearlyPrice: 299,
    monthlyCredits: 9000,
    features: [
      "High-volume visual generation workflow",
      "Team role controls and project permissions",
      "Shared assets and reusable visual templates",
      "Extended export options and quality settings",
      "Priority support channel",
      "Approval flow and operation logs",
      "Centralized voice and style management",
      "API and automation workflow readiness",
      "Highest priority generation queue",
    ],
    stripeLinks: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_STUDIO_MONTHLY,
      yearly: process.env.NEXT_PUBLIC_STRIPE_STUDIO_YEARLY,
    },
  },
];

const faqItems = [
  {
    q: "Why is yearly billing better value?",
    a: "Yearly billing includes a default 30% discount versus monthly pricing for the same plan.",
  },
  {
    q: "How are credits used?",
    a: "Credits are consumed by drafting, storyboard generation, redraws, TTS creation, and export actions.",
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
    a: "Credits are billed by cycle. Carry-over policy may vary by plan and promotions.",
  },
  {
    q: "Can I upgrade or downgrade anytime?",
    a: "Yes. Upgrades are typically immediate with prorated adjustments. Downgrades apply at the next billing cycle.",
  },
  {
    q: "Are exports watermarked?",
    a: "Essential includes standard export settings. Creator and Business include watermark-free export options.",
  },
  {
    q: "How does team collaboration work?",
    a: "Creator supports shared project spaces. Business adds role permissions, approval flows, and action logs.",
  },
  {
    q: "What happens if I run out of credits?",
    a: "High-cost actions are blocked before execution. You can top up or upgrade and then continue.",
  },
];

function formatUsd(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

export default function MembershipPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("yearly");
  const [toast, setToast] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState(0);
  const [subscription, setSubscription] = useState<SubscriptionSnapshot | null>(() =>
    getSubscription(),
  );
  const [returnPath] = useState(() => {
    if (typeof window === "undefined") {
      return "/landing";
    }
    try {
      const storedPath = window.sessionStorage.getItem("membership:return-path");
      if (storedPath && storedPath !== "/membership") {
        return storedPath;
      }
    } catch {
      return "/landing";
    }
    return "/landing";
  });

  useEffect(() => {
    window.history.replaceState(null, "", returnPath);
  }, [returnPath]);

  const plansWithCyclePrice = useMemo(() => {
    return plans.map((plan) => {
      const monthly = plan.monthlyPrice;
      const yearly = plan.yearlyPrice;
      const cyclePrice = billingCycle === "monthly" ? monthly : yearly;
      const cycleUnit = billingCycle === "monthly" ? "/mo" : "/yr";
      const monthlyEquivalent = billingCycle === "yearly" ? Number((yearly / 12).toFixed(1)) : monthly;
      return {
        ...plan,
        cyclePrice,
        cycleUnit,
        yearly,
        monthlyEquivalent,
      };
    });
  }, [billingCycle]);

  function handlePay(plan: Plan) {
    const link = billingCycle === "monthly" ? plan.stripeLinks.monthly : plan.stripeLinks.yearly;
    const nextSub = activateSubscription(plan.id, plan.name, billingCycle);
    const bonusCredits = plan.monthlyCredits;
    const currentEmail = session?.user?.email ?? "";
    const adminUser = currentEmail ? getAdminUserByEmail(currentEmail) : null;
    appendCreditRecord({
      type: "topup",
      description: `${plan.name} ${billingCycle === "yearly" ? "yearly" : "monthly"} purchase credited`,
      delta: bonusCredits,
      userId: adminUser?.id,
      userEmail: currentEmail || undefined,
    });
    setSubscription(nextSub);
    setToast(`Purchase successful: ${plan.name} is active and credits have been added.`);

    if (!link) {
      setToast("Membership status updated locally. Stripe link is not configured in this environment.");
      window.setTimeout(() => setToast(null), 2400);
      return;
    }

    window.open(link, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <div className="fixed inset-0 bg-zinc-900/30 backdrop-blur-[2px]" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full items-center justify-center p-3 sm:p-5">
        <div className="w-full max-w-6xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 sm:px-6">
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

          <div className="max-h-[86vh] overflow-y-auto px-3 pb-8 pt-4 sm:px-6 sm:pt-5 lg:px-8">
            <section className="rounded-2xl border border-zinc-200 bg-white px-4 py-6 shadow-sm sm:px-8 sm:py-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-sm font-medium text-zinc-500">KnowLens.ai Membership</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push("/membership/subscription")}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-100"
              >
                <CreditCard size={14} />
                Subscription
              </button>
              <button
                type="button"
                onClick={() => router.push("/membership/credits")}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-100"
              >
                <Zap size={14} />
                Credit History
              </button>
            </div>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            Choose the Plan That Fits Your Workflow
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Monthly and yearly billing are available. Yearly plans include a default 30% discount and all prices are
            shown in USD.
          </p>
          {subscription ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Current plan: {subscription.planName} ·
              {subscription.cycle === "yearly" ? "yearly" : "monthly"} ·
              {subscription.status === "canceling" ? "cancels at period end" : "active"}
            </div>
          ) : null}
            </section>

            <section className="mt-5 flex justify-center">
          <div className="inline-flex rounded-full border border-zinc-200 bg-zinc-100 p-1">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
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
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                billingCycle === "yearly"
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Yearly (Save 30%)
            </button>
          </div>
            </section>

            <section className="mt-6 grid gap-4 lg:grid-cols-3">
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
                <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white">
                  <BadgeCheck size={12} />
                  Best Value
                </span>
              ) : null}

              <h2 className="text-lg font-semibold text-zinc-900">{plan.name}</h2>
              <p className="mt-1 text-xs text-zinc-500">{plan.subtitle}</p>
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
                    Equivalent to ${formatUsd(plan.monthlyEquivalent)}/mo · Regular total $
                    {formatUsd(plan.monthlyPrice * 12)}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => handlePay(plan)}
                className={`mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition ${
                  plan.recommended
                    ? "bg-zinc-900 text-white hover:bg-zinc-700"
                    : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100"
                }`}
              >
                <Zap size={15} />
                Subscribe with Stripe
              </button>

              <p className="mt-2 text-xs text-zinc-500">Secure checkout powered by Stripe</p>

              <ul className="mt-4 space-y-2 text-sm text-zinc-700">
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

            <section className="mt-6 rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
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

            <section className="mt-6 rounded-2xl border border-zinc-200 bg-white px-5 py-6 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-900">Frequently Asked Questions</h3>
          <div className="mt-4 divide-y divide-zinc-200">
            {faqItems.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q} className="py-3">
                  <button
                    type="button"
                    onClick={() => setOpenFaq((prev) => (prev === idx ? -1 : idx))}
                    className="flex w-full items-center justify-between gap-3 text-left"
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

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
