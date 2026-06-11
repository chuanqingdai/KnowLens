"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  Check,
  FileText,
  FlaskConical,
  PanelsTopLeft,
  Share2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

type Card = {
  title: string;
  description: string;
  tag?: string;
};

type ExampleCard = {
  title: string;
  image: string;
  outputType: string;
  platform: string;
  category: string;
  description: string;
  topic: string;
  href?: string;
};

type PublicCaseAsset = {
  fileUrl?: string | null;
  thumbnailUrl?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
};

type PublicCase = {
  slug?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  outputType?: string | null;
  coverUrl?: string | null;
  assets?: PublicCaseAsset[];
};

export type FocusedLandingPageContent = {
  pageVariant: string;
  landingPageType: string;
  usePublicCases?: boolean;
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    badge: string;
    primaryCta: string;
    secondaryCta: string;
    exampleTopic: string;
    image?: string;
    imageAlt?: string;
  };
  beforeAfter: {
    title: string;
    description: string;
    steps: Card[];
  };
  formats: Card[];
  examples: ExampleCard[];
  personas: Card[];
  pricing: Card[];
  faq: Array<{ question: string; answer: string }>;
};

const HOME_DRAFT_KEY = "knowlens-home-draft";
const GENERATE_INTENT_KEY = "knowlens:generate-intent";
const defaultTopic = "How do solar storms create auroras? Explain it for a short educational video.";
const MAX_EXAMPLE_CARDS = 6;

export const explainerVideoLandingContent: FocusedLandingPageContent = {
  pageVariant: "focused_explainer_video",
  landingPageType: "explainer_video_creator",
  usePublicCases: false,
  hero: {
    eyebrow: "CREATOR-READY VISUAL QUALITY",
    title: "AI Explainer Videos for YouTube and TikTok Creators",
    subtitle:
      "Paste a script, article, or topic. KnowLens turns it into a short science explainer video with visual scenes, subtitles, and a clear creator-friendly structure.",
    badge: "Best for YouTube Shorts, TikTok, and educational explainers",
    primaryCta: "Generate Your First Video",
    secondaryCta: "See Examples",
    exampleTopic: defaultTopic,
  },
  beforeAfter: {
    title: "From Script to Visual Explainer",
    description:
      "See how a rough topic or script becomes a structured visual explainer ready for short-form video platforms.",
    steps: [
      {
        title: "Input",
        description: "How do solar storms create auroras? Explain it for a short educational video.",
      },
      {
        title: "Visual Structure",
        description: "Hook, key idea, visual breakdown, final summary.",
      },
      {
        title: "Output",
        description: "Around 3 minutes of explainer video content in a YouTube and TikTok-ready vertical format.",
      },
    ],
  },
  formats: [
    {
      title: "YouTube Shorts",
      description:
        "Create short visual explainers for educational videos, science topics, AI concepts, and business breakdowns.",
    },
    {
      title: "TikTok Science Videos",
      description: "Turn ideas into fast, hook-led science videos for TikTok and short-form discovery feeds.",
    },
    {
      title: "Instagram Reels",
      description: "Shape one topic into compact educational Reels with a clear question, visual beats, and takeaway.",
    },
    {
      title: "AI Explainer Videos",
      description: "Break down AI tools, agents, workflows, and model concepts into short videos people can follow.",
    },
    {
      title: "Faceless Education Videos",
      description: "Create narrated learning videos built around visuals, captions, and simple step-by-step scenes.",
    },
  ],
  examples: [
    {
      title: "What Black Holes Really Do",
      image: "/picture/black-hole-video-visual-case.jpg",
      outputType: "Space Science",
      platform: "YouTube Shorts",
      category: "Physics",
      description:
        "A black hole is not an empty hole in space. It is a region where matter has been compressed so tightly that gravity bends space-time sharply. Beyond the event horizon, even light cannot escape, while material outside may heat up, swirl into an accretion disk, and reveal the black hole's presence through intense radiation.",
      topic:
        "A black hole forms when a huge amount of mass is packed into an extremely small region, creating gravity so strong that space-time curves dramatically. The event horizon marks the boundary where escape becomes impossible, even for light. Outside that boundary, gas and dust can spiral into a hot accretion disk, releasing energy before crossing inward. Scientists study black holes by watching how they affect nearby stars, light, and matter.",
    },
    {
      title: "How Blue Light Affects Sleep",
      image: "/picture/blue-light-health-poster-case.jpg",
      outputType: "Human Biology",
      platform: "YouTube Shorts",
      category: "Health Science",
      description:
        "Blue light is part of the visible light spectrum and is common in daylight and screens. In the evening, bright blue-rich light can signal the brain that it is still daytime, suppress melatonin, and make it harder for the body to shift into sleep. Timing, brightness, and viewing distance all affect the impact.",
      topic:
        "Blue light helps regulate the body's internal clock because morning daylight contains strong blue wavelengths that tell the brain to stay alert. At night, bright screens and overhead lights can delay melatonin release, making sleep feel farther away. The effect depends on brightness, exposure time, and how close the light is to the eyes. Dimming screens, reducing late-night exposure, and keeping a consistent sleep schedule can help the body wind down.",
    },
    {
      title: "Why Volcanoes Erupt",
      image: "/picture/volcano-eruption-ppt-case.jpg",
      outputType: "Earth Science",
      platform: "TikTok",
      category: "Geology",
      description:
        "Volcanoes erupt when molten rock, gases, and pressure move upward through weak points in Earth's crust. As magma rises, dissolved gases expand, pressure builds, and the volcano may release lava, ash, steam, and rock fragments. The eruption style depends on magma chemistry, gas content, and the shape of the volcanic system.",
      topic:
        "A volcano erupts when magma from inside Earth rises toward the surface through cracks and vents. As the magma moves upward, pressure drops and dissolved gases expand, similar to bubbles forming when a bottle is opened. If pressure builds faster than it can escape, the volcano can erupt explosively, throwing ash and rock into the air. If the magma flows more easily, lava may spread across the surface instead.",
    },
    {
      title: "How DNA Copies Itself",
      image: "/picture/dna-video-script-case.jpg",
      outputType: "Biology",
      platform: "TikTok",
      category: "Genetics",
      description:
        "DNA replication lets cells copy genetic instructions before they divide. The double helix unzips, each original strand acts as a template, and enzymes assemble matching nucleotides to create two nearly identical DNA molecules. This copying process allows new cells to inherit the information needed to function.",
      topic:
        "DNA stores genetic information in a double helix made of paired bases. Before a cell divides, enzymes separate the two strands, and each strand becomes a template for a new partner strand. Adenine pairs with thymine, and cytosine pairs with guanine, which helps preserve the code. Proofreading enzymes reduce mistakes, so the two resulting DNA molecules carry almost the same instructions as the original.",
    },
    {
      title: "Life in the Deep Sea",
      image: "/picture/deep-sea-podcast-visual-case.jpg",
      outputType: "Ocean Science",
      platform: "Instagram Reels",
      category: "Ecosystems",
      description:
        "The deep sea is dark, cold, and under crushing pressure, yet it supports life through remarkable adaptations. Some animals use bioluminescence to communicate or hunt, while communities near hydrothermal vents rely on microbes that turn chemicals into energy instead of sunlight.",
      topic:
        "Deep-sea environments receive little or no sunlight, so organisms survive with unusual adaptations. Many animals produce bioluminescent light to attract prey, confuse predators, or find mates. Near hydrothermal vents, bacteria use chemicals from the seafloor to make energy, forming the base of entire ecosystems. These habitats show that life can thrive even where pressure is extreme, temperatures vary sharply, and sunlight cannot reach.",
    },
    {
      title: "How Vaccines Train Immunity",
      image: "/picture/immune-mechanism-infographic-case.jpg",
      outputType: "Medical Science",
      platform: "YouTube Shorts",
      category: "Immunity",
      description:
        "Vaccines prepare the immune system by safely introducing a recognizable piece or weakened form of a germ. Immune cells learn the antigen, activate B cells and T cells, produce antibodies, and form memory cells so the body can respond faster if the real infection appears later.",
      topic:
        "A vaccine works like a safe rehearsal for the immune system. It introduces an antigen that immune cells can recognize without causing the full disease. Helper T cells coordinate the response, B cells produce antibodies, and some immune cells become long-lasting memory cells. If the real pathogen appears later, the body can recognize it quickly, produce defenses faster, and reduce the chance of severe illness.",
    },
  ],
  personas: [
    {
      title: "YouTube Shorts Educator",
      description:
        "Turn a rough science topic into short visual scenes with a strong hook, simple narration, and a structure that fits YouTube Shorts.",
      tag: "Science Shorts · Concept Videos",
    },
    {
      title: "TikTok / Shorts Creator",
      description:
        "Quickly shape one idea into a fast explainer with an opening question, visual beats, and a concise payoff for TikTok and Shorts.",
      tag: "TikTok Explainers · Hook Videos",
    },
    {
      title: "AI Content Creator",
      description:
        "Complex topics like AI agents, LLMs, and workflows become clearer when they are turned into short visual explainers with step-by-step scenes.",
      tag: "AI Explain Videos · Workflow Breakdowns",
    },
    {
      title: "Science Channel Creator",
      description:
        "Build repeatable video ideas for astronomy, biology, health, earth science, and everyday science stories viewers can understand quickly.",
      tag: "Science Stories · Visual Breakdowns",
    },
    {
      title: "Classroom Video Maker",
      description:
        "Turn lesson notes and learning topics into short narrated explainers that help students review one idea at a time.",
      tag: "Lesson Videos · Recap Clips",
    },
    {
      title: "Business Explainer Creator",
      description:
        "Explain trends, products, and strategy ideas as clear knowledge videos for creators who want sharper educational content without heavy editing.",
      tag: "Business Explainers · Short Scripts",
    },
  ],
  pricing: [
    { title: "More Generations", description: "Generate more short explainer videos for your content workflow." },
    { title: "HD Export", description: "Download higher-quality visuals for publishing." },
    { title: "Remove Watermark", description: "Create cleaner assets for professional use." },
    { title: "More Video Projects", description: "Produce more explainer videos for your content workflow." },
  ],
  faq: [
    {
      question: "Can I create AI explainer videos for YouTube Shorts?",
      answer:
        "Yes. KnowLens helps turn a script, article, or topic into an AI explainer video structure with visual scenes, captions, and a vertical format that works well for YouTube Shorts.",
    },
    {
      question: "Can I use it as a TikTok explainer video generator?",
      answer:
        "Yes. You can create TikTok-ready educational videos, science explainers, AI concept breakdowns, and short visual stories from a single idea or rough script.",
    },
    {
      question: "What types of topics work best for AI explainer videos?",
      answer:
        "KnowLens works best for educational topics, science videos, business explainers, AI tutorials, product ideas, and complex concepts that need a clear visual breakdown.",
    },
    {
      question: "Does KnowLens create talking-head or avatar videos?",
      answer:
        "KnowLens focuses on visual explainer videos with structured scenes, subtitles, and educational storytelling. It is not designed as a talking-head avatar generator.",
    },
    {
      question: "Do I need video editing skills to use it?",
      answer:
        "No. The workflow is designed for creators who want an AI video generator that helps plan the hook, scene flow, captions, and visual direction without manual editing from scratch.",
    },
    {
      question: "Can one script be adapted for YouTube Shorts, TikTok, and Reels?",
      answer:
        "Yes. Start with one script or topic, then use the visual explainer structure for YouTube Shorts, TikTok videos, Instagram Reels, and other short-form learning channels.",
    },
    {
      question: "Who is KnowLens best for?",
      answer:
        "KnowLens is built for YouTube educators, TikTok creators, science communicators, AI content creators, business explainers, and teams that need clearer visual learning content.",
    },
    {
      question: "Can I use KnowLens for commercial explainer videos?",
      answer:
        "Yes. You can use KnowLens for business explainers, product education, content marketing, and commercial creator workflows as long as you have the rights to the source material.",
    },
  ],
};

function sendLandingEvent(content: FocusedLandingPageContent, action: string, details: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const searchParams = new URLSearchParams(window.location.search);
  const eventDetails = {
    page_variant: content.pageVariant,
    landing_page_type: content.landingPageType,
    source: "focused_landing_page",
    utm_source: searchParams.get("utm_source") || "",
    utm_medium: searchParams.get("utm_medium") || "",
    utm_campaign: searchParams.get("utm_campaign") || "",
    ...details,
  };
  try {
    const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag === "function") {
      gtag("event", action, eventDetails);
    }
  } catch {
    // Analytics should not block navigation.
  }
  try {
    const payload = JSON.stringify({
      category: "landing",
      action,
      status: "info",
      source: "focused_landing_page",
      message: `Focused landing event: ${action}`,
      details: eventDetails,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/telemetry/event", new Blob([payload], { type: "application/json" }));
      return;
    }
    void fetch("/api/telemetry/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    });
  } catch {
    // Ignore telemetry failures.
  }
}

function startGeneration(content: FocusedLandingPageContent, topic: string, placement: string) {
  sendLandingEvent(content, placement === "example" ? "example_cta_click" : "hero_cta_click", {
    selected_format: "explainer_video",
    topic,
    placement,
  });
  sendLandingEvent(content, "try_topic_click", {
    selected_format: "explainer_video",
    topic,
    placement,
  });
  try {
    const projectId = `p-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    window.sessionStorage.setItem(
      HOME_DRAFT_KEY,
      JSON.stringify({
        prompt: topic,
        textModel: "gemini-2.5",
        imageModel: "gpt-image2",
        sources: [],
        project: { projectId },
      }),
    );
    window.sessionStorage.setItem(GENERATE_INTENT_KEY, JSON.stringify({ createdAt: Date.now() }));
  } catch {
    // The app still opens if browser storage is unavailable.
  }
  window.location.href = "/app?intent=generate";
}

function isVideoAsset(asset: PublicCaseAsset) {
  const mimeType = asset.mimeType || "";
  return mimeType.startsWith("video/") || /\.mp4(?:$|\?)/i.test(asset.fileUrl || "");
}

function mapPublicCaseToExample(item: PublicCase): ExampleCard | null {
  const slug = item.slug?.trim();
  const title = item.title?.trim();
  if (!slug || !title) return null;
  const assets = Array.isArray(item.assets) ? item.assets : [];
  const videoAsset = assets.find(isVideoAsset);
  const firstVisualAsset = assets.find((asset) => asset.thumbnailUrl || asset.fileUrl);
  if (item.outputType !== "video" && !videoAsset) return null;
  const image = item.coverUrl || videoAsset?.thumbnailUrl || firstVisualAsset?.thumbnailUrl || firstVisualAsset?.fileUrl || "";
  if (!image) return null;
  return {
    title,
    image,
    outputType: "Knowledge Topic",
    platform: "Case Study",
    category: item.category?.trim() || "Education",
    description: item.description?.trim() || "A KnowLens case built from a real educational topic and organized for clearer learning.",
    topic: item.description?.trim() || title,
    href: `/cases/${encodeURIComponent(slug)}`,
  };
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{eyebrow}</p> : null}
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">{title}</h2>
      <p className="mt-3 text-base leading-7 text-zinc-600">{description}</p>
    </div>
  );
}

function PlatformLogo({ title }: { title: string }) {
  const themedIcon = [
    { pattern: /classroom|lesson|educator/i, Icon: BookOpen, className: "bg-amber-50 text-amber-700 ring-amber-100" },
    { pattern: /science|biology|astronomy|earth/i, Icon: FlaskConical, className: "bg-cyan-50 text-cyan-700 ring-cyan-100" },
    { pattern: /social|post/i, Icon: Share2, className: "bg-violet-50 text-violet-700 ring-violet-100" },
    { pattern: /event|promo|campaign|announcement/i, Icon: CalendarDays, className: "bg-rose-50 text-rose-700 ring-rose-100" },
    { pattern: /slide|insert|deck/i, Icon: PanelsTopLeft, className: "bg-indigo-50 text-indigo-700 ring-indigo-100" },
  ].find((item) => item.pattern.test(title));

  if (themedIcon) {
    const Icon = themedIcon.Icon;
    return (
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${themedIcon.className}`}>
        <Icon size={18} strokeWidth={2} aria-hidden="true" />
      </span>
    );
  }

  if (/youtube/i.test(title)) {
    return (
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-red-100">
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path fill="currentColor" d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.6 12 4.6 12 4.6s-5.7 0-7.5.5a3 3 0 0 0-2.1 2.1A31.2 31.2 0 0 0 1.9 12c0 1.6.1 3.2.5 4.8a3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1c.4-1.6.5-3.2.5-4.8s-.1-3.2-.5-4.8ZM10 15.4V8.6l5.8 3.4-5.8 3.4Z" />
        </svg>
      </span>
    );
  }
  if (/tiktok/i.test(title)) {
    return (
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-950 text-white ring-1 ring-zinc-800">
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path fill="currentColor" d="M14.7 3h2.5c.2 1.2.7 2.2 1.5 3 .8.8 1.7 1.3 2.8 1.5v2.7a7.6 7.6 0 0 1-4.4-1.4v6.5c0 3.2-2.5 5.7-5.7 5.7a5.4 5.4 0 0 1-5.6-5.5c0-3.5 3.1-6.1 6.6-5.4v2.9c-1.7-.5-3.5.7-3.5 2.5 0 1.5 1.1 2.6 2.6 2.6s2.7-1.1 2.7-2.8V3Z" />
        </svg>
      </span>
    );
  }
  if (/instagram/i.test(title)) {
    return (
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-pink-50 text-pink-600 ring-1 ring-pink-100">
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path fill="currentColor" d="M7.6 2h8.8A5.6 5.6 0 0 1 22 7.6v8.8a5.6 5.6 0 0 1-5.6 5.6H7.6A5.6 5.6 0 0 1 2 16.4V7.6A5.6 5.6 0 0 1 7.6 2Zm0 2A3.6 3.6 0 0 0 4 7.6v8.8A3.6 3.6 0 0 0 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6A3.6 3.6 0 0 0 16.4 4H7.6Zm9.1 2.2a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2ZM12 7.2a4.8 4.8 0 1 1 0 9.6 4.8 4.8 0 0 1 0-9.6Zm0 2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z" />
        </svg>
      </span>
    );
  }
  if (/linkedin/i.test(title)) {
    return (
      <span className="inline-flex items-center -space-x-2">
        <span className="relative z-10 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path fill="currentColor" d="M5.3 8.8H2.4V21h2.9V8.8ZM3.8 3A1.8 1.8 0 1 0 3.8 6.6 1.8 1.8 0 0 0 3.8 3Zm6.4 5.8H7.4V21h2.9v-6.2c0-1.6.3-3.2 2.3-3.2s2 1.8 2 3.3V21h2.9v-6.9c0-3.4-.7-5.9-4.6-5.9-1.8 0-3.1 1-3.6 2h-.1V8.8Z" />
          </svg>
        </span>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border-2 border-white bg-zinc-950 text-white ring-1 ring-zinc-800">
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path fill="currentColor" d="M14 10.6 21.6 2h-1.8l-6.6 7.5L7.9 2H1.8l8 11.4L1.8 22h1.8l7-7.9 5.6 7.9h6.1L14 10.6Zm-2.5 2.8-.8-1.1L4.3 3.3H7l5.2 7.4.8 1.1 6.7 9.4H17l-5.5-7.8Z" />
          </svg>
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
      <FileText size={18} strokeWidth={2} aria-hidden="true" />
    </span>
  );
}

export function FocusedLandingPage({ content: providedContent }: { content?: Partial<FocusedLandingPageContent> }) {
  const content = useMemo<FocusedLandingPageContent>(() => {
    return {
      ...explainerVideoLandingContent,
      ...providedContent,
      hero: {
        ...explainerVideoLandingContent.hero,
        ...providedContent?.hero,
      },
      beforeAfter: providedContent?.beforeAfter || explainerVideoLandingContent.beforeAfter,
      formats: providedContent?.formats || explainerVideoLandingContent.formats,
      examples: providedContent?.examples || explainerVideoLandingContent.examples,
      personas: providedContent?.personas || explainerVideoLandingContent.personas,
      pricing: providedContent?.pricing || explainerVideoLandingContent.pricing,
      faq: providedContent?.faq || explainerVideoLandingContent.faq,
    };
  }, [providedContent]);
  const [caseExamples, setCaseExamples] = useState<ExampleCard[]>([]);

  useEffect(() => {
    sendLandingEvent(content, "landing_page_view");
  }, [content]);

  useEffect(() => {
    let cancelled = false;
    async function loadVideoCases() {
      if (content.usePublicCases === false) return;
      try {
        const response = await fetch("/api/public/cases", {
          headers: { Accept: "application/json" },
        });
        if (!response.ok) return;
        const data = (await response.json().catch(() => null)) as { cases?: PublicCase[] } | null;
        const nextExamples = (Array.isArray(data?.cases) ? data.cases : [])
          .map(mapPublicCaseToExample)
          .filter((item): item is ExampleCard => Boolean(item))
          .slice(0, MAX_EXAMPLE_CARDS);
        if (!cancelled && nextExamples.length) {
          setCaseExamples(nextExamples);
        }
      } catch {
        // Static fallback examples keep the landing page usable.
      }
    }
    void loadVideoCases();
    return () => {
      cancelled = true;
    };
  }, [content.usePublicCases]);

  const visibleExamples = useMemo(() => {
    if (!caseExamples.length) return content.examples;
    const fallbackExamples = content.examples.filter(
      (fallback) => !caseExamples.some((item) => item.title.toLowerCase() === fallback.title.toLowerCase()),
    );
    return [...caseExamples, ...fallbackExamples].slice(0, MAX_EXAMPLE_CARDS);
  }, [caseExamples, content.examples]);

  return (
    <MarketingChrome>
      <section className="mx-auto flex min-h-[calc(100svh-7rem)] w-full max-w-6xl flex-col items-center justify-center px-4 pb-12 pt-10 text-center sm:px-6 lg:pt-14">
        <div className="mx-auto max-w-5xl">
          <h1 className="mx-auto max-w-[1080px] text-5xl font-semibold tracking-tight text-zinc-950 sm:text-6xl lg:text-[4.35rem] lg:leading-[1.04]">
            {content.hero.title}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-zinc-600">{content.hero.subtitle}</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => startGeneration(content, content.hero.exampleTopic, "hero")}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-zinc-950 px-6 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(15,23,42,0.18)] transition hover:bg-zinc-800"
            >
              {content.hero.primaryCta}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            <a
              href="#examples"
              onClick={() => sendLandingEvent(content, "format_selected", { selected_format: "examples_anchor" })}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-zinc-300 bg-white px-6 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
            >
              {content.hero.secondaryCta}
            </a>
          </div>
          <div className="mt-5 inline-flex items-center gap-2 text-sm text-zinc-600">
            <BadgeCheck size={16} className="text-emerald-600" aria-hidden="true" />
            {content.hero.badge}
          </div>
        </div>

        <div className="mt-10 w-full max-w-4xl overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.10)]">
          <img
            src={content.hero.image || "/picture/explainer-videos-hero.jpg"}
            alt={content.hero.imageAlt || "Examples of visual explainer video thumbnails made for social platforms"}
            className="aspect-[936/527] w-full object-cover"
          />
        </div>
        {content.landingPageType === "information_generator" ? (
          <p className="mt-3 text-sm text-zinc-500">
            Generated examples: educational infographics, visual summaries, posters, carousel-style visuals.
          </p>
        ) : null}
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6" id="before-after">
        <SectionHeading title={content.beforeAfter.title} description={content.beforeAfter.description} />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {content.beforeAfter.steps.map((step, index) => (
            <div key={step.title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white">
                {index + 1}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-zinc-950">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{step.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => startGeneration(content, content.hero.exampleTopic, "before_after")}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            {content.landingPageType === "information_generator" ? "Try with Your Topic" : "Try This Topic"}
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading
          title={
            content.landingPageType === "information_generator"
              ? "Create Different Types of Infographics"
              : "Create Once. Adapt for Every Channel."
          }
          description={
            content.landingPageType === "information_generator"
              ? "Choose the right visual structure for your idea, from educational visuals to social media posters and carousel-style graphics."
              : "Turn one script or topic into short explainer videos for the channels your audience already watches."
          }
        />
        <div className="mt-8 grid gap-4 md:grid-cols-5">
          {content.formats.map((format) => {
            return (
              <button
                key={format.title}
                type="button"
                onClick={() => sendLandingEvent(content, "format_selected", { selected_format: format.title })}
                className="flex min-h-[13.25rem] flex-col rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
              >
                <div className="flex h-10 items-center">
                  <PlatformLogo title={format.title} />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-zinc-950">{format.title}</h3>
                <p className="mt-2 text-xs leading-5 text-zinc-600">{format.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section id="examples" className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading
          title={
            content.landingPageType === "information_generator"
              ? "AI-Generated Infographic Examples"
              : "See What You Can Create with KnowLens"
          }
          description={
            content.landingPageType === "information_generator"
              ? "Explore visual examples created from topics, notes, and short text prompts."
              : "Explore short explainer video ideas for science, tech, health, history, and everyday learning content."
          }
        />
        <div className="mt-8 grid items-start gap-5 md:grid-cols-2 lg:grid-cols-3">
          {visibleExamples.map((item) => (
            <article
              key={item.title}
              className="mb-5 break-inside-avoid overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
            >
              <div className="bg-zinc-100">
                <img
                  src={item.image}
                  alt={content.landingPageType === "information_generator" ? `${item.title} infographic example` : item.title}
                  className="h-auto w-full object-contain"
                />
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-2 text-[11px] font-medium text-zinc-600">
                  <span className="rounded-full bg-zinc-100 px-2 py-1">{item.outputType}</span>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">{item.category}</span>
                </div>
                <h3 className="mt-3 text-lg font-semibold text-zinc-950">{item.title}</h3>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {item.href ? (
                    <Link
                      href={item.href}
                      onClick={() =>
                        sendLandingEvent(content, "example_cta_click", {
                          selected_format: "explainer_video",
                          topic: item.title,
                          destination: item.href,
                        })
                      }
                      className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-950 hover:text-blue-700"
                    >
                      View Case
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => startGeneration(content, item.topic, "example")}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 hover:text-zinc-950"
                  >
                    {content.landingPageType === "information_generator" ? "Create Similar" : "Try topic"}
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading
          title={
            content.landingPageType === "information_generator"
              ? "Built for Anyone Who Needs Clear Visual Content"
              : "Built for Creators, Educators, and Teams"
          }
          description={
            content.landingPageType === "information_generator"
              ? "Use KnowLens to turn ideas, notes, and explanations into visual summaries for learning, social media, and presentations."
              : "From science Shorts to TikTok explainers, KnowLens helps creators turn ideas, scripts, and notes into short videos people can understand and share."
          }
        />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {content.personas.map((persona) => (
            <div key={persona.title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-zinc-950">{persona.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{persona.description}</p>
              <p className="mt-4 text-xs font-semibold text-blue-700">{persona.tag}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading
          eyebrow="HOW IT WORKS"
          title={
            content.landingPageType === "information_generator"
              ? "Create an Infographic in 3 Simple Steps"
              : "Create Short Explainer Videos in 3 Simple Steps"
          }
          description={
            content.landingPageType === "information_generator"
              ? "Start with a topic, outline, or notes. KnowLens helps organize the message into an infographic people can scan quickly."
              : "Start with a topic, script, article, or notes. KnowLens helps shape the idea into a short visual explainer for YouTube Shorts and TikTok."
          }
        />
        {content.landingPageType !== "information_generator" ? (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {["YouTube Shorts", "TikTok", "Reels", "Science", "AI", "Education"].map((tag) => (
              <span key={tag} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {(content.landingPageType === "information_generator"
            ? [
                ["Add a Topic, Text, or Notes", "Start from an idea, short explanation, rough notes, or an outline."],
                ["Choose a Visual Direction", "KnowLens organizes your content into sections, highlights, diagrams, and key points."],
                ["Generate and Download", "Create a polished infographic, poster, carousel-style image, or visual summary."],
              ]
            : [
                ["Add Your Source", "Paste a topic, script, article, lesson note, research summary, or rough idea. Start with the material you already have, whether it is a creator script, a classroom topic, or a business explanation."],
                ["Shape the Visual Story", "KnowLens organizes the main points into a clearer structure, highlights the key ideas, and turns scattered text into a visual flow that is easier to explain, teach, and share."],
                ["Generate for Your Platform", "Choose the video direction that fits your goal: YouTube Shorts, TikTok explainers, Reels, or short educational videos for your audience."],
              ]).map(([title, description], index) => (
            <div key={title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold text-zinc-500">0{index + 1}</p>
              <h3 className="mt-3 text-lg font-semibold text-zinc-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6" id="pricing">
        <div className="rounded-3xl border border-zinc-200 bg-white px-6 py-8 text-center shadow-sm sm:px-8 sm:py-10">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Start Free. Upgrade When You Need More.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-zinc-600">
              {content.landingPageType === "information_generator"
                ? "Try KnowLens with free credits. Upgrade when you want more infographic generations, HD exports, watermark removal, or more projects."
                : "Try KnowLens with free credits. Upgrade when you want more generations, HD exports, watermark removal, or more video projects."}
            </p>
          </div>
          <div className="mt-8 grid gap-x-8 gap-y-6 border-t border-zinc-200 pt-6 text-left md:grid-cols-4">
            {content.pricing.map((item) => (
              <div key={item.title}>
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-emerald-600" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-zinc-950">{item.title}</h3>
                </div>
                <p className="mt-2 text-xs leading-5 text-zinc-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
        <SectionHeading
          title="FAQ"
          description={
            content.landingPageType === "information_generator"
              ? "Common questions about creating infographics, posters, and visual summaries with KnowLens."
              : "Common questions about creating visual explainer videos with KnowLens."
          }
        />
        <div className="mt-8 divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white">
          {content.faq.map((item) => (
            <details key={item.question} className="group p-5">
              <summary className="cursor-pointer list-none text-base font-semibold text-zinc-950">
                {item.question}
              </summary>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <div className="rounded-[2rem] bg-zinc-950 px-6 py-12 text-center text-white sm:px-10">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            {content.landingPageType === "information_generator"
              ? "Turn Your Next Idea into an Infographic"
              : "Turn Your Next Idea into a Visual Explainer"}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-300">
            {content.landingPageType === "information_generator"
              ? "Start with a topic, notes, or plain text. Generate a clear visual summary in minutes."
              : "Start with a topic, script, article, or notes. Generate a short visual explainer video for YouTube Shorts, TikTok, or Reels in minutes."}
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => startGeneration(content, content.hero.exampleTopic, "final_cta")}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-zinc-950 hover:bg-zinc-100"
            >
              {content.landingPageType === "information_generator" ? "Create an Infographic" : "Generate Your First Video"}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            <a
              href="#examples"
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-6 text-sm font-semibold text-white hover:bg-white/10"
            >
              View Examples
            </a>
          </div>
        </div>
      </section>
    </MarketingChrome>
  );
}
