"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { getSubscriptionByUser } from "@/lib/billing";
import { STANDARD_OUTPUT_PROMO_CREDITS, STANDARD_OUTPUT_REGULAR_CREDITS } from "@/lib/credit-pricing";

type PromoCountdownBannerProps = {
  variant?: "banner" | "inline";
  className?: string;
};

const PROMO_DEADLINE_KEY = "knowlens_membership_promo_deadline_v1";
const PROMO_MIN_HOURS = 6;
const PROMO_MAX_HOURS = 24;

function formatCountdown(ms: number) {
  const safe = Math.max(0, ms);
  const totalSeconds = Math.floor(safe / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

function FlipCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[56px] rounded-xl border border-amber-100 bg-white shadow-sm">
      <div className="flex h-11 items-center justify-center rounded-t-xl bg-gradient-to-b from-white to-amber-50/60 px-2">
        <span className="text-lg font-semibold tabular-nums tracking-tight text-amber-900">
          {value.toString().padStart(2, "0")}
        </span>
      </div>
      <div className="rounded-b-xl border-t border-amber-100 bg-amber-50/70 px-2 py-1 text-center">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-amber-700/90">
          {label}
        </span>
      </div>
    </div>
  );
}

export function PromoCountdownBanner({ variant = "banner", className = "" }: PromoCountdownBannerProps) {
  const { data: session } = useSession();
  const currentEmail = (session?.user?.email ?? "").trim().toLowerCase();
  const [deadline, setDeadline] = useState<number | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());

  const hasPaidPlan = useMemo(() => {
    const subscription = getSubscriptionByUser(currentEmail);
    return !!subscription && (subscription.status === "active" || subscription.status === "canceling");
  }, [currentEmail]);

  useEffect(() => {
    if (typeof window === "undefined" || hasPaidPlan) {
      setDeadline(null);
      return;
    }
    const scope = currentEmail || "guest";
    const storageKey = `${PROMO_DEADLINE_KEY}:${scope}`;
    const rawValue = window.localStorage.getItem(storageKey);
    const parsed = rawValue ? Number(rawValue) : Number.NaN;
    if (Number.isFinite(parsed) && parsed > Date.now()) {
      setDeadline(parsed);
      return;
    }
    const minMs = PROMO_MIN_HOURS * 60 * 60 * 1000;
    const maxMs = PROMO_MAX_HOURS * 60 * 60 * 1000;
    const nextDeadline = Date.now() + Math.floor(minMs + Math.random() * (maxMs - minMs));
    window.localStorage.setItem(storageKey, String(nextDeadline));
    setDeadline(nextDeadline);
  }, [currentEmail, hasPaidPlan]);

  useEffect(() => {
    if (!deadline) {
      return;
    }
    const id = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [deadline]);

  if (!deadline || hasPaidPlan) {
    return null;
  }

  const remaining = deadline - nowTs;
  if (remaining <= 0) {
    return null;
  }
  const countdown = formatCountdown(remaining);

  if (variant === "inline") {
    return (
      <div className={`rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2 ${className}`}>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-5 text-amber-900/90">
              GPT-image2 limited-time 70% off for faster creator onboarding.
            </p>
            <p className="mt-1 text-xs leading-5 text-amber-700/90">
              6 credits per visual output: 1 infographic, 1 visual summary, or 1 short explainer video frame.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <FlipCard label="Days" value={countdown.days} />
            <FlipCard label="Hours" value={countdown.hours} />
            <FlipCard label="Mins" value={countdown.minutes} />
            <FlipCard label="Secs" value={countdown.seconds} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className={`rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3 sm:px-5 ${className}`}>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-5 text-amber-900/90">
            GPT-image2 limited-time 70% off for faster creator onboarding.
          </p>
          <p className="mt-1 text-xs leading-5 text-amber-700/90">
            6 credits per visual output: 1 infographic, 1 visual summary, or 1 short explainer video frame.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <FlipCard label="Days" value={countdown.days} />
          <FlipCard label="Hours" value={countdown.hours} />
          <FlipCard label="Mins" value={countdown.minutes} />
          <FlipCard label="Secs" value={countdown.seconds} />
        </div>
      </div>
    </section>
  );
}
