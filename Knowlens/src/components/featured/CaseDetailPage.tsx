"use client";

/* eslint-disable @next/next/no-img-element */

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Heart, Link2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  type FeaturedCaseItem,
  getCaseMetrics,
  getFeaturedDetailPath,
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

const SITE_URL = "https://knowlens.ai";

const protectedImageStyle: CSSProperties & { WebkitUserDrag?: string } = {
  WebkitTouchCallout: "none",
  WebkitUserSelect: "none",
  WebkitUserDrag: "none",
  userSelect: "none",
};

function absoluteUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function getTopicName(item: FeaturedCaseItem) {
  return item.title.replace(/\s+Case$/i, "").replace(/\s+Template$/i, "").trim();
}

function getTemplateTitle(item: FeaturedCaseItem) {
  const topic = getTopicName(item);
  return /infographic/i.test(topic) ? `${topic} Template` : `${topic} Infographic Template`;
}

function getTemplatePrompt(item: FeaturedCaseItem, narrative: CaseNarrative) {
  return (
    `Create an educational infographic about ${getTopicName(item)} in a clean visual style. ` +
    `Use clear sections, concise labels, and a structured layout. ` +
    `Explain these points: ${narrative.keyPoints.join(" ")}`
  );
}

function getAspectRatio(item: FeaturedCaseItem) {
  const ratio = item.coverWidth / item.coverHeight;
  if (Math.abs(ratio - 16 / 9) < 0.08) return "16:9";
  if (Math.abs(ratio - 9 / 16) < 0.08) return "9:16";
  if (Math.abs(ratio - 1) < 0.08) return "1:1";
  if (Math.abs(ratio - 4 / 5) < 0.08) return "4:5";
  return item.coverWidth > item.coverHeight ? "Landscape" : "Portrait";
}

function setMetaAttribute(attribute: "name" | "property", key: string, content: string) {
  const selector = `meta[${attribute}="${key}"]`;
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function setCanonical(url: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.appendChild(element);
  }
  element.href = url;
}

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
  const [shareNotice, setShareNotice] = useState<"copied" | "failed" | null>(null);
  const [shareLabel, setShareLabel] = useState("Share");
  const { metrics, toggleLike } = useCaseMetrics(item);
  const narrative = getCaseNarrative(item);
  const templateTitle = getTemplateTitle(item);
  const shortDescription =
    item.description ||
    `Explore this ${getTopicName(item).toLowerCase()} infographic template for clear labels and structured visual learning.`;
  const canonicalUrl = absoluteUrl(getFeaturedDetailPath(item));
  const previewImageUrl = absoluteUrl(item.cover);
  const seoTitle = `${templateTitle} - KnowLens AI`;
  const templatePrompt = getTemplatePrompt(item, narrative);
  const createSimilarHref = `/app?prompt=${encodeURIComponent(templatePrompt)}`;
  const imageAlt = `${getTopicName(item)} infographic showing ${narrative.keyPoints
    .slice(0, 3)
    .map((point) => point.replace(/^[^:]+:\s*/, "").toLowerCase())
    .join(", ")}`;
  const faqItems = [
    {
      question: `What is included in this ${getTopicName(item)} infographic template?`,
      answer:
        "The page includes a protected preview image, a short description, template details, learning points, and a prompt for creating a similar visual with KnowLens AI.",
    },
    {
      question: "Can I download this infographic from the detail page?",
      answer:
        "No. Direct browser download is disabled on public image detail pages. You can share the page URL or create a similar infographic from the prompt.",
    },
    {
      question: "Can I create a similar infographic?",
      answer:
        "Yes. Use the Create similar infographic button to open KnowLens with a prepared prompt that you can adjust before generating a new visual.",
    },
  ];
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: templateTitle,
        url: canonicalUrl,
        description: shortDescription,
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: previewImageUrl,
          width: item.coverWidth,
          height: item.coverHeight,
          caption: `${templateTitle} created with KnowLens AI.`,
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: faqItems.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
    ],
  };

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
    const prev = document.title;
    document.title = seoTitle;
    setCanonical(canonicalUrl);
    setMetaAttribute("name", "description", shortDescription);
    setMetaAttribute("name", "robots", "index, follow, max-image-preview:large");
    setMetaAttribute("property", "og:title", seoTitle);
    setMetaAttribute("property", "og:description", shortDescription);
    setMetaAttribute("property", "og:url", canonicalUrl);
    setMetaAttribute("property", "og:image", previewImageUrl);
    setMetaAttribute("name", "twitter:card", "summary_large_image");
    setMetaAttribute("name", "twitter:title", seoTitle);
    setMetaAttribute("name", "twitter:description", shortDescription);
    setMetaAttribute("name", "twitter:image", previewImageUrl);
    return () => {
      document.title = prev;
    };
  }, [canonicalUrl, previewImageUrl, seoTitle, shortDescription]);

  useEffect(() => {
    setShareLabel(typeof navigator !== "undefined" && "share" in navigator ? "Share" : "Copy link");
  }, []);

  async function copyCanonicalUrl() {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(canonicalUrl);
    setShareNotice("copied");
    window.setTimeout(() => setShareNotice(null), 1800);
  }

  async function handleShare() {
    try {
      if ("share" in navigator && typeof navigator.share === "function") {
        await navigator.share({ title: seoTitle, text: shortDescription, url: canonicalUrl });
        return;
      }
      await copyCanonicalUrl();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        await copyCanonicalUrl();
      } catch {
        setShareNotice("failed");
        window.setTimeout(() => setShareNotice(null), 1800);
      }
    }
  }

  return (
    <div className="px-4 pb-10 pt-6 sm:px-6 lg:px-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            Back
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleLike}
              className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-3 text-sm transition ${
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
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              <Link2 size={15} />
              {shareLabel}
            </button>
            <Link
              href={createSimilarHref}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-700"
            >
              <Sparkles size={15} />
              Create similar infographic
            </Link>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
          <figure
            className="relative bg-zinc-100"
            onContextMenu={(event) => event.preventDefault()}
            onDragStart={(event) => event.preventDefault()}
            style={protectedImageStyle}
          >
            <img
              src={item.cover}
              alt={imageAlt}
              width={item.coverWidth}
              height={item.coverHeight}
              className="h-auto w-full object-contain"
              draggable={false}
              onContextMenu={(event) => event.preventDefault()}
              onDragStart={(event) => event.preventDefault()}
              style={protectedImageStyle}
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 z-10 bg-transparent"
              onContextMenu={(event) => event.preventDefault()}
              onDragStart={(event) => event.preventDefault()}
            />
            <span className="absolute left-3 top-3 inline-flex items-center rounded-md border border-white/25 bg-black/78 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white shadow-[0_2px_8px_rgba(0,0,0,0.35)] backdrop-blur-[2px]">
              {normalizeFormatLabel(item.format)}
            </span>
            {isVideoFormat(item.format) && item.duration ? (
              <span className="absolute right-3 top-3 inline-flex items-center rounded-md border border-white/25 bg-black/78 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white shadow-[0_2px_8px_rgba(0,0,0,0.35)] backdrop-blur-[2px]">
                {item.duration}
              </span>
            ) : null}
            <figcaption className="sr-only">
              {templateTitle} - an infographic prompt example created with KnowLens AI.
            </figcaption>
          </figure>
          <div className="p-4 sm:p-5">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{templateTitle}</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{shortDescription}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
              <span>@{item.author}</span>
              <span>{metrics.views} views</span>
              <span>{metrics.likes} likes</span>
              <span>{item.category}</span>
            </div>
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
              Use this prompt to create a similar infographic with KnowLens AI.
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

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Template Details</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                ["Category", item.category],
                ["Topic", getTopicName(item)],
                ["Aspect Ratio", getAspectRatio(item)],
                ["Style", "Clean Educational"],
                ["Best for", "lessons, presentations, social posts, and visual learning materials"],
                ["Template Type", "Infographic"],
              ].map(([label, value]) => (
                <div key={label} className="grid gap-1 border-b border-zinc-100 pb-3 last:border-0 last:pb-0">
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</dt>
                  <dd className="leading-6 text-zinc-800">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-950">About this infographic</h2>
            <div className="mt-3 space-y-4 text-sm leading-7 text-zinc-700">
              <p>
                This {getTopicName(item).toLowerCase()} infographic template helps explain a focused knowledge topic in
                a clear visual format. It is designed for learners, educators, creators, and teams who need to turn
                complex information into an easy-to-understand visual.
              </p>
              <p>
                The layout highlights concise sections, readable labels, and a structured hierarchy for lessons,
                presentations, social media posts, and visual learning materials. For users starting from their own
                notes, KnowLens works as an AI Infographic Generator that turns ideas into structured visual content.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-950 p-5 text-white shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold tracking-tight">Create a similar infographic with AI</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300">
            Use the prompt behind this infographic to create a similar visual in KnowLens AI. The prompt will be added
            to the input box automatically, so you can adjust the topic, style, or structure before generating a new
            design.
          </p>
          <Link
            href={createSimilarHref}
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-zinc-950 hover:bg-zinc-100"
          >
            <Sparkles size={16} />
            Create similar infographic
          </Link>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Explore related infographic categories</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                ["Educational Infographic Templates", "/educational-infographic-maker"],
                ["Process Infographic Templates", "/process-infographic-generator"],
                ["Recipe Infographic Templates", "/recipe-infographic-maker"],
                ["Infographic Examples", "/infographic-examples"],
              ].map(([label, href]) => (
                <Link key={href} href={href} className="rounded-full border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Related AI infographic tools</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                ["AI Infographic Generator", "/app"],
                ["Educational Infographic Maker", "/educational-infographic-maker"],
                ["Process Infographic Generator", "/process-infographic-generator"],
                ["Recipe Infographic Maker", "/recipe-infographic-maker"],
              ].map(([label, href]) => (
                <Link key={href} href={href} className="rounded-full border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950">FAQ</h2>
          <div className="mt-4 divide-y divide-zinc-100">
            {faqItems.map((faq) => (
              <div key={faq.question} className="py-4 first:pt-0 last:pb-0">
                <h3 className="text-sm font-semibold text-zinc-950">{faq.question}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
      {shareNotice ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 top-20 z-[120] -translate-x-1/2 rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white shadow-lg"
        >
          {shareNotice === "copied" ? "Link copied" : "Copy failed"}
        </div>
      ) : null}
    </div>
  );
}
