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
  getResolvedFeaturedCases,
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

function absoluteUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function getTopicName(item: FeaturedCaseItem) {
  return item.title
    .replace(/\s+Case$/i, "")
    .replace(/\s+Template$/i, "")
    .trim();
}

function getTemplateTitle(item: FeaturedCaseItem) {
  const topic = getTopicName(item);
  if (/infographic/i.test(topic)) {
    return `${topic} Template`;
  }
  return `${topic} Infographic Template`;
}

function getCategoryLabel(item: FeaturedCaseItem) {
  return item.category === "All" ? "General" : item.category;
}

function getAspectRatio(width: number, height: number) {
  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.08) return "16:9";
  if (Math.abs(ratio - 9 / 16) < 0.08) return "9:16";
  if (Math.abs(ratio - 1) < 0.08) return "1:1";
  if (Math.abs(ratio - 4 / 5) < 0.08) return "4:5";
  if (Math.abs(ratio - 3 / 4) < 0.08) return "3:4";
  return width > height ? "Landscape" : "Portrait";
}

function getImageAlt(item: FeaturedCaseItem, narrative: CaseNarrative) {
  const topic = getTopicName(item);
  const points = narrative.keyPoints
    .slice(0, 3)
    .map((point) => point.replace(/^[^:]+:\s*/, "").replace(/[.]+$/g, "").toLowerCase())
    .join(", ");
  return `${topic} infographic showing ${points}`;
}

function getShortDescription(item: FeaturedCaseItem) {
  const topic = getTopicName(item).toLowerCase();
  const category = getCategoryLabel(item).toLowerCase();
  return (
    item.description ||
    `Explore this ${topic} infographic template for ${category} learning, clear labels, and structured visual explanation.`
  );
}

function getBestFor(category: string) {
  const normalized = category.toLowerCase();
  if (normalized.includes("biology")) {
    return "biology lessons, study guides, lab explainers, and visual learning materials";
  }
  if (normalized.includes("geography")) {
    return "earth science lessons, geography summaries, classroom posters, and study visuals";
  }
  if (normalized.includes("economics")) {
    return "business education, market explainers, social posts, and presentation visuals";
  }
  if (normalized.includes("history")) {
    return "timeline lessons, historical summaries, classroom handouts, and visual reports";
  }
  if (normalized.includes("medicine")) {
    return "health education, patient explainers, anatomy lessons, and medical study guides";
  }
  if (normalized.includes("astronomy")) {
    return "science lessons, space explainers, classroom posters, and educational visuals";
  }
  return "lessons, presentations, social posts, product explainers, and visual learning materials";
}

function getTemplatePrompt(item: FeaturedCaseItem, narrative: CaseNarrative) {
  const topic = getTopicName(item);
  const prompt =
    `Create an educational infographic about ${topic} in a clean visual style. ` +
    `Use clear sections, concise labels, and a structured layout. ` +
    `Explain these points: ${narrative.keyPoints.join(" ")} ` +
    `Use a ${getAspectRatio(item.coverWidth, item.coverHeight)} composition with readable hierarchy.`;
  return prompt.trim();
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

export function CaseDetailPage({ item }: CaseDetailPageProps) {
  const router = useRouter();
  const [shareNotice, setShareNotice] = useState<"copied" | "failed" | null>(null);
  const [shareLabel, setShareLabel] = useState("Share");
  const { metrics, toggleLike } = useCaseMetrics(item);
  const narrative = getCaseNarrative(item);
  const templateTitle = getTemplateTitle(item);
  const topicName = getTopicName(item);
  const categoryLabel = getCategoryLabel(item);
  const formatLabel = normalizeFormatLabel(item.format);
  const aspectRatio = getAspectRatio(item.coverWidth, item.coverHeight);
  const canonicalUrl = absoluteUrl(getFeaturedDetailPath(item));
  const previewImageUrl = absoluteUrl(item.cover);
  const seoTitle = `${templateTitle} - KnowLens AI`;
  const shortDescription = getShortDescription(item);
  const imageAlt = getImageAlt(item, narrative);
  const templatePrompt = getTemplatePrompt(item, narrative);
  const createSimilarHref = `/app?prompt=${encodeURIComponent(templatePrompt)}`;
  const similarTemplates = useMemo(() => {
    const all = getResolvedFeaturedCases().filter((candidate) => candidate.id !== item.id);
    const sameCategory = all.filter((candidate) => candidate.category === item.category);
    return [...sameCategory, ...all.filter((candidate) => candidate.category !== item.category)].slice(0, 6);
  }, [item.category, item.id]);
  const faqItems = [
    {
      question: `What is included in this ${topicName} infographic template?`,
      answer:
        "The page includes a preview image, a concise description, structured learning points, template details, and a prompt for creating a similar visual with KnowLens AI.",
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
    {
      question: "Is this page useful for Google Images?",
      answer:
        "Yes. The main preview uses semantic image markup with a descriptive title, alt text, caption, and related explanatory content.",
    },
  ];
  const jsonLd = [
    {
      "@context": "https://schema.org",
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
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Infographic", item: `${SITE_URL}/infographic-examples` },
        { "@type": "ListItem", position: 3, name: categoryLabel, item: canonicalUrl },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqItems.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    },
  ];

  useEffect(() => {
    setShareLabel(typeof navigator !== "undefined" && "share" in navigator ? "Share" : "Copy link");
  }, []);

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
    setMetaAttribute("property", "og:type", "website");
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

  async function copyCanonicalUrl() {
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard unavailable");
    }
    await navigator.clipboard.writeText(canonicalUrl);
    setShareNotice("copied");
    window.setTimeout(() => setShareNotice(null), 1800);
  }

  async function handleShare() {
    try {
      if ("share" in navigator && typeof navigator.share === "function") {
        await navigator.share({
          title: seoTitle,
          text: shortDescription,
          url: canonicalUrl,
        });
        return;
      }
      await copyCanonicalUrl();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      try {
        await copyCanonicalUrl();
      } catch {
        setShareNotice("failed");
        window.setTimeout(() => setShareNotice(null), 1800);
      }
    }
  }

  return (
    <div className="px-4 pb-14 pt-6 sm:px-6 lg:px-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-6xl">
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-500">
          <Link href="/" className="hover:text-zinc-900">
            Home
          </Link>
          <span>/</span>
          <Link href="/infographic-examples" className="hover:text-zinc-900">
            Infographic
          </Link>
          <span>/</span>
          <span className="text-zinc-700">{categoryLabel}</span>
        </nav>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] lg:items-start">
          <figure className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-3 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
            <div
              className="relative overflow-hidden rounded-xl bg-zinc-100"
              onContextMenu={(event) => event.preventDefault()}
              onDragStart={(event) => event.preventDefault()}
              style={protectedImageStyle}
            >
              <img
                src={item.cover}
                alt={imageAlt}
                width={item.coverWidth}
                height={item.coverHeight}
                className="mx-auto h-auto max-h-[78vh] w-full object-contain"
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
              <span className="absolute left-3 top-3 z-20 inline-flex items-center rounded-md border border-white/25 bg-black/78 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white shadow-[0_2px_8px_rgba(0,0,0,0.35)] backdrop-blur-[2px]">
                {formatLabel}
              </span>
              {isVideoFormat(item.format) && item.duration ? (
                <span className="absolute right-3 top-3 z-20 inline-flex items-center rounded-md border border-white/25 bg-black/78 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white shadow-[0_2px_8px_rgba(0,0,0,0.35)] backdrop-blur-[2px]">
                  {item.duration}
                </span>
              ) : null}
            </div>
            <figcaption className="px-1 pt-3 text-sm leading-6 text-zinc-600">
              {templateTitle} - an infographic prompt example created with KnowLens AI.
            </figcaption>
          </figure>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_14px_30px_rgba(15,23,42,0.06)] sm:p-6">
            <button
              type="button"
              onClick={() => router.back()}
              className="mb-4 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              Back
            </button>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">{templateTitle}</h1>
            <p className="mt-3 text-base leading-7 text-zinc-600">{shortDescription}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              {[categoryLabel, aspectRatio, "Clean Educational Style", "Infographic"].map((badge) => (
                <span
                  key={badge}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700"
                >
                  {badge}
                </span>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleShare()}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
              >
                <Link2 size={16} />
                {shareLabel}
              </button>
              <Link
                href={createSimilarHref}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                <Sparkles size={16} />
                Create similar infographic
              </Link>
              <button
                type="button"
                onClick={toggleLike}
                className={`inline-flex h-11 items-center gap-1.5 rounded-xl border px-4 text-sm transition ${
                  metrics.liked
                    ? "border-rose-300 bg-rose-50 text-rose-600"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                <Heart size={16} className={metrics.liked ? "fill-current" : ""} />
                {metrics.likes}
              </button>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-500">
              Use this prompt to create a similar infographic with KnowLens AI.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-zinc-200 pt-5 text-sm">
              <div>
                <p className="text-zinc-500">Views</p>
                <p className="mt-1 font-semibold text-zinc-900">{metrics.views}</p>
              </div>
              <div>
                <p className="text-zinc-500">Author</p>
                <p className="mt-1 font-semibold text-zinc-900">@{item.author}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Template Details</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                ["Category", categoryLabel],
                ["Topic", topicName],
                ["Aspect Ratio", aspectRatio],
                ["Style", "Clean Educational"],
                ["Best for", getBestFor(item.category)],
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
                This {topicName.toLowerCase()} infographic template helps explain a focused knowledge topic in a clear
                visual format. It is designed for learners, educators, creators, and teams who need to turn complex
                information into an easy-to-understand visual.
              </p>
              <p>
                The layout highlights concise sections, readable labels, and a structured hierarchy, making it useful
                for lessons, presentations, social media posts, product explainers, and visual learning materials. You
                can use the prompt from this template to create a similar infographic with KnowLens AI. For users
                starting from their own text, KnowLens works as an AI Infographic Generator that turns ideas, notes, and
                explanations into structured visual content.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950">
            What this {topicName.toLowerCase()} infographic explains
          </h2>
          <ul className="mt-4 grid gap-3 text-sm leading-6 text-zinc-700 sm:grid-cols-2">
            {narrative.keyPoints.map((point) => (
              <li key={point} className="flex gap-3 rounded-xl bg-zinc-50 p-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-zinc-500">Suggested visual structure: {narrative.visualizationType}</p>
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-200 bg-zinc-950 p-5 text-white shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold tracking-tight">Create a similar infographic with AI</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300">
            Use the prompt behind this infographic to create a similar visual in KnowLens AI. The prompt will be added
            to the input box automatically, so you can adjust the topic, style, or structure before generating a new
            design.
          </p>
          <Link
            href={createSimilarHref}
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-zinc-950 hover:bg-zinc-100"
          >
            <Sparkles size={16} />
            Create similar infographic
          </Link>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold tracking-tight text-zinc-950">
            Similar {categoryLabel} infographic templates
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {similarTemplates.map((template) => {
              const title = getTemplateTitle(template);
              return (
                <Link
                  key={template.id}
                  href={getFeaturedDetailPath(template)}
                  className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="aspect-[4/3] bg-zinc-100 p-3">
                    <img
                      src={template.cover}
                      alt={`${getTopicName(template)} infographic thumbnail`}
                      className="h-full w-full rounded-xl object-contain"
                      draggable={false}
                    />
                  </div>
                  <div className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                      {getCategoryLabel(template)}
                    </p>
                    <h3 className="mt-2 text-sm font-semibold leading-6 text-zinc-950 group-hover:text-emerald-700">
                      {title}
                    </h3>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Explore related infographic categories</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                ["Educational Infographic Templates", "/educational-infographic-maker"],
                ["Process Infographic Templates", "/process-infographic-generator"],
                ["Recipe Infographic Templates", "/recipe-infographic-maker"],
                ["Infographic Examples", "/infographic-examples"],
              ].map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-full border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
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
                <Link
                  key={href}
                  href={href}
                  className="rounded-full border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
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
