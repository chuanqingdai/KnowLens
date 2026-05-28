"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
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
  getSubscriptionByUser,
  syncCreditRecordsFromServer,
  type SubscriptionSnapshot,
} from "@/lib/billing";

function formatDate(input: string) {
  return new Date(input).toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function SubscriptionManagePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const currentEmail = (session?.user?.email ?? "").trim().toLowerCase();
  const [refreshVersion, setRefreshVersion] = useState(0);
  const sub = useMemo<SubscriptionSnapshot | null>(() => {
    void refreshVersion;
    return getSubscriptionByUser(currentEmail);
  }, [currentEmail, refreshVersion]);
  const [toast, setToast] = useState<string | null>(null);
  const credits = useMemo(() => {
    void refreshVersion;
    return getCreditRecords(currentEmail)[0]?.balance ?? 80;
  }, [currentEmail, refreshVersion]);

  useEffect(() => {
    if (!currentEmail) {
      return;
    }
    let canceled = false;
    void syncCreditRecordsFromServer(currentEmail)
      .then(() => {
        if (canceled) {
          return;
        }
        setRefreshVersion((prev) => prev + 1);
      })
      .catch(() => {
        // Keep cached records if sync fails.
      });
    return () => {
      canceled = true;
    };
  }, [currentEmail]);
  const [showSurvey, setShowSurvey] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [detailFeedback, setDetailFeedback] = useState("");

  const surveyOptions = [
    "The price is above my current budget",
    "I do not use it frequently enough right now",
    "The current features do not fully meet my needs",
    "The workflow feels complex in some steps",
    "Export quality or speed did not meet expectations",
    "I want to try other tools first",
  ];

  function handleCancel() {
    const next = cancelSubscription(currentEmail);
    if (!next) {
      setToast("There is no active subscription to cancel.");
      return;
    }
    setRefreshVersion((prev) => prev + 1);
    setShowSurvey(false);
    setSelectedReason("");
    setDetailFeedback("");
    setToast("Thanks for your feedback. Cancellation is submitted and will take effect at period end.");
  }

  function handleSubmitSurveyAndCancel() {
    if (!selectedReason) {
      setToast("Please select a primary reason so I can keep improving.");
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
            Back
          </button>
          <div className="text-center">
            <p className="text-sm font-medium text-zinc-900">Subscription Status</p>
            <p className="text-xs text-zinc-500">View your current plan and renewal cycle</p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/membership/credits")}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            <Zap size={14} className="text-zinc-500" />
            <span className="font-medium text-zinc-900">{credits}</span>
            <span className="text-zinc-500">|</span>
            <span>Credits</span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pb-12 pt-20 sm:px-6">

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h1 className="text-xl font-semibold text-zinc-900">Subscription Status</h1>
          {!sub ? (
            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-600">
              No subscription record found yet. You can return to Membership and complete a purchase.
            </div>
          ) : (
            <>
              <div className="mt-4 space-y-2 text-sm">
                <p className="inline-flex items-center gap-1.5 text-zinc-700">
                  <BadgeCheck size={14} />
                  Plan: {sub.planName}
                </p>
                <p className="text-zinc-600">Cycle: {sub.cycle === "yearly" ? "Yearly" : "Monthly"}</p>
                <p className="text-zinc-600">Started at: {formatDate(sub.startedAt)}</p>
                <p className="text-zinc-600">Next renewal: {formatDate(sub.renewAt)}</p>
                <p className="text-zinc-600">
                  Status: {sub.status === "canceling" ? "Cancels at period end" : "Active"}
                </p>
              </div>

              {sub.status !== "canceling" ? (
                <button
                  type="button"
                  onClick={() => setShowSurvey(true)}
                  className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-700 hover:bg-red-100"
                >
                  <XCircle size={14} />
                  Cancel Subscription
                </button>
              ) : (
                <div className="mt-5 inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  <CircleAlert size={14} />
                  Cancellation submitted. Your access remains active until the period ends.
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
                  Before you leave, I&apos;d truly value your feedback
                </p>
                <p className="mt-1 text-sm leading-6 text-zinc-600">
                  I&apos;m the independent developer behind KnowLens.ai. If you hit friction, I&apos;ll work to fix it quickly.
                  It only takes a minute, and your input helps me improve the product in a meaningful way.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSurvey(false)}
                className="rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
              >
                Close
              </button>
            </div>

            <div className="mt-4">
              <p className="text-sm font-medium text-zinc-900">What is the main reason for cancellation?</p>
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
                Anything else you&apos;d like to share? (optional)
              </p>
              <textarea
                value={detailFeedback}
                onChange={(event) => setDetailFeedback(event.target.value)}
                placeholder="For example: which part felt most frustrating, or which feature you want first."
                className="mt-2 h-24 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-800 outline-none ring-zinc-300 placeholder:text-zinc-400 focus:ring-2"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSurvey(false)}
                className="inline-flex h-10 items-center rounded-xl border border-zinc-300 bg-white px-4 text-sm text-zinc-700 hover:bg-zinc-100"
              >
                Keep Subscription
              </button>
              <button
                type="button"
                onClick={handleSubmitSurveyAndCancel}
                className="inline-flex h-10 items-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
              >
                Submit Feedback & Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </main>
  );
}
