"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { Download, Heart, Link2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { getSubscriptionByUser } from "@/lib/billing";
import { PaywallDialog } from "@/components/billing/PaywallDialog";
import {
  type FeaturedCaseItem,
  getCaseMetrics,
  incrementCaseView,
  isVideoFormat,
  normalizeFormatLabel,
  toggleCaseLike,
} from "@/lib/featured-cases";

type CaseDetailPageProps = {
  item: FeaturedCaseItem;
};

type CaseNarrative = {
  summary: string;
  keyPoints: string[];
  visualizationType: string;
};

function getCaseNarrative(item: FeaturedCaseItem): CaseNarrative {
  const title = item.title.toLowerCase();

  if (title.includes("business cycle")) {
    return {
      summary:
        "This poster explains the four-stage business cycle and why output, jobs, and confidence move in a repeating macro pattern.",
      keyPoints: [
        "Expansion: demand rises, production increases, and employment improves.",
        "Peak: growth slows as inflation pressure and resource constraints build up.",
        "Recession: output falls, hiring weakens, and investment becomes conservative.",
        "Trough to recovery: policy support and demand repair restart the next cycle.",
      ],
      visualizationType: "Causal flow curve with stage markers",
    };
  }

  return {
    summary:
      "This case organizes a complex knowledge topic into a visual-first narrative with clear hierarchy and fast readability.",
    keyPoints: [
      "Starts with one core question and a single key takeaway.",
      "Uses 3-4 compact evidence blocks instead of dense paragraphs.",
      "Maps concepts into visual structure so readers can scan quickly.",
      "Ends with an actionable interpretation for learning or communication.",
    ],
    visualizationType: "Structured infographic layout",
  };
}

function useCaseMetrics(item: FeaturedCaseItem) {
  const { data: session } = useSession();
  const currentEmail = (session?.user?.email ?? "").trim().toLowerCase();
  const [likeVersion, setLikeVersion] = useState(0);
  const metrics = useMemo(() => {
    void likeVersion;
    const base = getCaseMetrics(item.id, item.views, item.likes, currentEmail);
    return {
      ...base,
      views: base.views + 1,
    };
  }, [item.id, item.likes, item.views, currentEmail, likeVersion]);

  useEffect(() => {
    incrementCaseView(item.id, currentEmail);
  }, [currentEmail, item.id]);

  return {
    metrics,
    toggleLike: () => {
      toggleCaseLike(item.id, currentEmail);
      setLikeVersion((prev) => prev + 1);
    },
  };
}

export function CaseDetailPage({ item }: CaseDetailPageProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const currentEmail = (session?.user?.email ?? "").trim().toLowerCase();
  const [shareToastVisible, setShareToastVisible] = useState(false);
  const [downloadPaywallOpen, setDownloadPaywallOpen] = useState(false);
  const { metrics, toggleLike } = useCaseMetrics(item);

  const isMember = useMemo(() => {
    const subscription = getSubscriptionByUser(currentEmail);
    return !!subscription && (subscription.status === "active" || subscription.status === "canceling");
  }, [currentEmail]);
  const narrative = getCaseNarrative(item);

  useEffect(() => {
    function preventSaveShortcut(event: KeyboardEvent) {
      const isSave = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s";
      if (isSave) {
        event.preventDefault();
      }
    }
    document.addEventListener("keydown", preventSaveShortcut);
    return () => document.removeEventListener("keydown", preventSaveShortcut);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const prev = document.title;
    document.title = `${item.title} · KnowLens.ai`;
    return () => {
      document.title = prev;
    };
  }, [item.title]);

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareToastVisible(true);
      window.setTimeout(() => setShareToastVisible(false), 1800);
    } catch {
      setShareToastVisible(false);
    }
  }

  function toMembership() {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("membership:return-path", window.location.pathname);
    }
    router.push("/membership");
  }

  function handleDownload() {
    if (!isMember) {
      setDownloadPaywallOpen(true);
      return;
    }

    const link = document.createElement("a");
    link.href = item.cover;
    link.download = `${item.title.replace(/\s+/g, "-").toLowerCase()}.png`;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <div className="px-4 pb-10 pt-6 sm:px-6 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            Back
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleLike}
              className={`inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm transition ${
                metrics.liked
                  ? "border-rose-300 bg-rose-50 text-rose-600"
                  : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              <Heart size={15} className={metrics.liked ? "fill-current" : ""} />
              {metrics.likes}
            </button>
            <button
              type="button"
              onClick={() => void handleShare()}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              <Link2 size={15} />
              Share
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-700"
            >
              <Download size={15} />
              Download
            </button>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
          <div
            className="relative bg-zinc-100"
            onContextMenu={(event) => event.preventDefault()}
            onDragStart={(event) => event.preventDefault()}
          >
            <img
              src={item.cover}
              alt={item.title}
              className="h-auto w-full object-contain"
              draggable={false}
            />
            <div className="pointer-events-none absolute inset-0 select-none" />
            <span className="absolute left-3 top-3 inline-flex items-center rounded-md border border-white/25 bg-black/78 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white shadow-[0_2px_8px_rgba(0,0,0,0.35)] backdrop-blur-[2px]">
              {normalizeFormatLabel(item.format)}
            </span>
            {isVideoFormat(item.format) && item.duration ? (
              <span className="absolute right-3 top-3 inline-flex items-center rounded-md border border-white/25 bg-black/78 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white shadow-[0_2px_8px_rgba(0,0,0,0.35)] backdrop-blur-[2px]">
                {item.duration}
              </span>
            ) : null}
          </div>
          <div className="p-4 sm:p-5">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{item.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
              <span>@{item.author}</span>
              <span>{metrics.views} views</span>
              <span>{metrics.likes} likes</span>
              <span>{item.category}</span>
            </div>
            <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-sm font-medium text-zinc-900">Case Brief</p>
              <p className="mt-2 text-sm leading-6 text-zinc-700">{narrative.summary}</p>
              <ul className="mt-3 space-y-2 text-sm text-zinc-700">
                {narrative.keyPoints.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-500" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-zinc-500">
                Suggested visual structure: {narrative.visualizationType}
              </p>
            </div>
          </div>
        </section>
      </div>
      <PaywallDialog
        open={downloadPaywallOpen}
        title="Membership required for downloads"
        description="Image download is available to members only. Upgrade your plan to unlock high-quality downloads."
        showPromoBanner
        onClose={() => setDownloadPaywallOpen(false)}
        onConfirm={() => {
          setDownloadPaywallOpen(false);
          toMembership();
        }}
        confirmLabel="Upgrade to Download"
      />
      {shareToastVisible ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 top-20 z-[120] -translate-x-1/2 rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white shadow-lg"
        >
          Link copied
        </div>
      ) : null}
    </div>
  );
}
