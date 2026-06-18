"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { ArrowRight, BadgeCheck, Check, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import { PromoCountdownBanner } from "@/components/billing/PromoCountdownBanner";
import { findBillingPlan, type BillingCycle } from "@/lib/billing-plans";

const heroImage = "/picture/hero picture.jpg";
const LANDING_ASSET_VERSION = "20260528c";
const ENABLE_IMAGE_DEBUG = process.env.NEXT_PUBLIC_DEBUG_IMAGE_LOAD === "true";
const MEMBERSHIP_SOURCE = "landing-page";
const LANDING_CTA_CLASS =
  "inline-flex items-center justify-center rounded-full border border-transparent bg-zinc-900 font-medium text-white shadow-[0_8px_20px_rgba(15,23,42,0.18)] transition hover:bg-zinc-700 hover:shadow-[0_10px_24px_rgba(15,23,42,0.20)] active:translate-y-px active:shadow-[0_6px_16px_rgba(15,23,42,0.16)]";

function trackLandingGenerateClick(placement: "hero" | "footer_cta") {
  if (typeof window === "undefined") {
    return;
  }
  const details = {
    placement,
    buttonId: `landing_generate_${placement}`,
    destination: "/app",
    stepNumber: 1,
  };
  try {
    const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag === "function") {
      gtag("event", "landing_generate_button_click", details);
    }
  } catch {
    // Analytics should never interrupt navigation.
  }
  const payload = JSON.stringify({
    category: "button",
    action: "landing_generate_button_click",
    status: "info",
    source: "landing",
    message: "Landing page Generate Free button clicked.",
    details,
  });
  try {
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
    // Analytics should never interrupt navigation.
  }
}

const previewWideCases = [
  {
    id: "w-1",
    titleEn: "Featured Visual Case 01",
    titleZh: "精选案例 01",
    cover: "/en-picture/featured-visual-case-01.jpg",
    keywordsEn: "knowledge visual, education, infographic, featured case",
    keywordsZh: "知识可视化, 教育, 信息图, 精选案例",
  },
  {
    id: "w-2",
    titleEn: "Featured Visual Case 02",
    titleZh: "精选案例 02",
    cover: "/en-picture/featured-visual-case-02.jpg",
    keywordsEn: "knowledge visual, education, infographic, featured case",
    keywordsZh: "知识可视化, 教育, 信息图, 精选案例",
  },
  {
    id: "w-3",
    titleEn: "Featured Visual Case 03",
    titleZh: "精选案例 03",
    cover: "/en-picture/featured-visual-case-03.jpg",
    keywordsEn: "knowledge visual, education, infographic, featured case",
    keywordsZh: "知识可视化, 教育, 信息图, 精选案例",
  },
  {
    id: "w-4",
    titleEn: "How Photosynthesis Works",
    titleZh: "光合作用如何运作",
    cover: "/en-picture/photosynthesis-infographic-case.jpg",
    keywordsEn: "photosynthesis, plant, biology, science, infographic",
    keywordsZh: "光合作用, 植物, 生物, 科学, 信息图",
  },
  {
    id: "w-5",
    titleEn: "Why Inflation Changes Daily Life",
    titleZh: "为什么通胀会改变日常生活",
    cover: "/en-picture/inflation-daily-life-infographic-case.jpg",
    keywordsEn: "inflation, economy, daily life, finance, infographic",
    keywordsZh: "通胀, 经济, 日常生活, 金融, 信息图",
  },
  {
    id: "w-6",
    titleEn: "Plate Tectonics and Earthquakes",
    titleZh: "板块构造与地震",
    cover: "/en-picture/plate-tectonics-earthquake-infographic-case.jpg",
    keywordsEn: "plate tectonics, earthquake, geology, earth science, infographic",
    keywordsZh: "板块构造, 地震, 地质, 地球科学, 信息图",
  },
  {
    id: "w-7",
    titleEn: "The Printing Press",
    titleZh: "印刷术",
    cover: "/en-picture/printing-press-history-infographic-case.jpg",
    keywordsEn: "printing press, history, invention, education, infographic",
    keywordsZh: "印刷术, 历史, 发明, 教育, 信息图",
  },
];

const previewTallCases = [
  { id: "t-1", titleEn: "Astronomy Card", titleZh: "天文卡片", cover: "/en-picture/astronomy/astronomy-infographic-card.jpg" },
  { id: "t-2", titleEn: "Biology Card", titleZh: "生物卡片", cover: "/en-picture/biology/biology-infographic-card.jpg" },
  { id: "t-3", titleEn: "Economics Card", titleZh: "经济卡片", cover: "/en-picture/economics/economics-infographic-card.jpg" },
  { id: "t-4", titleEn: "Geography Card", titleZh: "地理卡片", cover: "/en-picture/geography/geography-infographic-card.jpg" },
  { id: "t-5", titleEn: "History Card", titleZh: "历史卡片", cover: "/en-picture/history/history-infographic-card.jpg" },
  { id: "t-6", titleEn: "Medicine Card", titleZh: "医学卡片", cover: "/en-picture/mdeicine/medical-infographic-card.jpg" },
  { id: "t-7", titleEn: "Astronomy Long Visual", titleZh: "天文长图", cover: "/en-picture/astronomy/astronomy-long-infographic.jpg" },
  { id: "t-8", titleEn: "Biology Long Visual", titleZh: "生物长图", cover: "/en-picture/biology/biology-long-infographic.jpg" },
  { id: "t-9", titleEn: "Geography Long Visual", titleZh: "地理长图", cover: "/en-picture/geography/geography-long-infographic.jpg" },
];

const capabilityFlows = [
  {
    id: "infographic-poster",
    tabEn: "AI Infographic",
    tabZh: "AI 信息图",
    previewImage: "/picture/text-to-poster.jpg",
  },
  {
    id: "visual-summary",
    tabEn: "Visual Summary",
    tabZh: "视觉摘要",
    previewImage: "/picture/text-to-ppt-workflow.jpg",
  },
  {
    id: "explainer-video",
    tabEn: "Short Explainer Video",
    tabZh: "短解说视频",
    previewImage: "/picture/text to video.jpg",
  },
];

const DEFAULT_CAPABILITY_FLOW_ID = "infographic-poster";

const howItWorksTags = [
  "AI Infographic Generator",
  "AI Video Generator",
  "Infographic Maker",
  "Visual Summary",
  "AI Poster",
  "Carousel-style Visual",
];

const howItWorksTagZh: Record<string, string> = {
  "AI Infographic Generator": "AI 信息图生成器",
  "AI Video Generator": "AI 视频生成器",
  "Infographic Maker": "信息图制作器",
  "Visual Summary": "视觉摘要",
  "AI Poster": "AI 海报",
  "Carousel-style Visual": "轮播式视觉",
};

const homepageToolCards = [
  {
    title: "Text to Video",
    titleZh: "文本转视频",
    description: "Create short educational videos and science explainers from topics, notes, or short scripts.",
    descriptionZh: "用主题、笔记或短脚本创建教学短视频和科学解说。",
    href: "/text-to-video-ai",
  },
  {
    title: "Infographic Maker",
    titleZh: "信息图制作器",
    description: "Make educational infographics, visual summaries, posters, and carousel-style visuals from simple text.",
    descriptionZh: "把简单文本做成教育信息图、视觉摘要、海报和轮播图。",
    href: "/infographic-maker",
  },
  {
    title: "Text to Infographic",
    titleZh: "文本转信息图",
    description: "Turn plain text, notes, and topics into clear infographics, posters, and visual summaries.",
    descriptionZh: "把纯文本、笔记和主题转成清晰的信息图、海报和视觉摘要。",
    href: "/text-to-infographic",
  },
  {
    title: "AI Poster Generator",
    titleZh: "AI 海报生成器",
    description: "Turn topics, notes, and plain text into clear posters, visual summaries, and infographic-style designs.",
    descriptionZh: "用主题、笔记和纯文本生成清晰海报、视觉摘要和信息图式设计。",
    href: "/ai-poster-generator",
  },
  {
    title: "AI Carousel Generator",
    titleZh: "AI 轮播图生成器",
    description: "Turn text, notes, and topics into multi-slide carousel visuals and infographic-style slides.",
    descriptionZh: "把文本、笔记和主题转成多页轮播图和信息图式幻灯片。",
    href: "/ai-carousel-generator",
  },
  {
    title: "Infographic & Video Tools",
    titleZh: "信息图与视频工具",
    description: "Create short explainer videos, infographic-style overlays, and visual summaries from topics, notes, or plain text.",
    descriptionZh: "从主题、笔记或纯文本创建短解说视频、信息图叠加视觉和视觉摘要。",
    href: "/ai-video-generator",
  },
  {
    title: "AI Infographic Generator",
    titleZh: "AI 信息图生成器",
    description: "Turn ideas and notes into infographics, posters, and carousel-style visuals.",
    descriptionZh: "把想法和笔记变成信息图、海报和轮播式视觉内容。",
    href: "/ai-infographic-generator",
  },
];

const howItWorksCards = [
  {
    id: "understand",
    title: "Add Your Idea",
    titleZh: "输入你的想法",
    description:
      "Start with a topic, notes, plain text, a short script, or a rough outline. Give KnowLens the core idea, audience, and context you want people to understand.",
    descriptionZh:
      "从主题、笔记、纯文本、短脚本或大纲开始。告诉 KnowLens 你想表达的核心内容、受众和背景。",
  },
  {
    id: "organize",
    title: "Shape the Message",
    titleZh: "整理内容结构",
    description:
      "KnowLens breaks the idea into key points, sections, captions, visual hierarchy, and scene flow so the explanation is easier to scan, teach, and share.",
    descriptionZh:
      "KnowLens 会把想法拆成重点、分区、标题、视觉层级和分镜流程，让内容更容易阅读、教学和分享。",
  },
  {
    id: "generate",
    title: "Generate the Visual",
    titleZh: "生成视觉内容",
    description:
      "Create a polished infographic, poster, carousel-style visual, visual summary, or short explainer video, then refine the direction before sharing or downloading.",
    descriptionZh:
      "生成精致的信息图、海报、轮播图、视觉摘要或短解说视频，再根据需要调整方向并分享或下载。",
  },
];

const personaUseCases = [
  {
    id: "students",
    role: "Students",
    roleZh: "学生",
    quote:
      "Turn class notes, study topics, and short explanations into visual summaries that are easier to review and remember.",
    quoteZh: "把课堂笔记、复习主题和短说明转成更容易回顾和记忆的视觉摘要。",
    tags: "Study notes · Visual summaries",
    tagsZh: "学习笔记 · 视觉摘要",
  },
  {
    id: "teachers",
    role: "Teachers",
    roleZh: "老师",
    quote:
      "Create educational infographics and short visual explainers that make lesson topics clearer for students.",
    quoteZh: "创建教育信息图和短解说视觉，让课堂主题对学生更清楚。",
    tags: "Educational infographics · Lesson visuals",
    tagsZh: "教育信息图 · 课堂视觉",
  },
  {
    id: "content-creators",
    role: "Content Creators",
    roleZh: "内容创作者",
    quote:
      "Turn one idea into social visuals, carousel-style graphics, posters, and short explainer videos for audience-friendly publishing.",
    quoteZh: "把一个想法变成社媒视觉、轮播图、海报和短解说视频，更适合面向受众发布。",
    tags: "Social visuals · Short explainers",
    tagsZh: "社媒视觉 · 短解说",
  },
  {
    id: "science-communicators",
    role: "Science Communicators",
    roleZh: "科学传播者",
    quote:
      "Explain science, health, history, technology, and everyday concepts with clear visual structure instead of dense text.",
    quoteZh: "用清晰的视觉结构解释科学、健康、历史、技术和日常概念，减少大段文字负担。",
    tags: "Science infographics · Knowledge visuals",
    tagsZh: "科学信息图 · 知识视觉",
  },
  {
    id: "small-teams",
    role: "Small Teams",
    roleZh: "小团队",
    quote:
      "Summarize product ideas, workflows, campaign messages, and internal concepts into clear visual content.",
    quoteZh: "把产品想法、工作流、活动信息和内部概念整理成清晰的视觉内容。",
    tags: "Team explainers · Visual briefs",
    tagsZh: "团队说明 · 视觉简报",
  },
  {
    id: "marketers",
    role: "Marketers",
    roleZh: "市场营销人员",
    quote:
      "Turn plain text into promotional posters, visual summaries, and carousel-style content without starting from a blank canvas.",
    quoteZh: "无需从空白画布开始，把纯文本转成推广海报、视觉摘要和轮播内容。",
    tags: "Posters · Carousel visuals",
    tagsZh: "海报 · 轮播图",
  },
];

const faqItems = [
  {
    id: "q1",
    question: "What is an AI infographic and video generator?",
    answer:
      "An AI infographic and video generator turns a topic, notes, plain text, or a rough outline into visual content such as infographics, visual summaries, posters, carousel-style visuals, and short explainer videos.",
  },
  {
    id: "q2",
    question: "Can I use KnowLens as an infographic maker?",
    answer:
      "Yes. KnowLens works as an AI infographic maker for topics, notes, short explanations, and plain text. It helps organize your message into sections, highlights, and infographic-style visuals.",
  },
  {
    id: "q3",
    question: "Can I use KnowLens to generate videos?",
    answer:
      "Yes. KnowLens can help create short explainer video drafts from a topic, notes, or a rough outline. It is useful for educational content, science topics, YouTube Shorts, TikTok, and quick visual explanations.",
  },
  {
    id: "q4",
    question: "What can I use as input?",
    answer:
      "You can start with a topic, notes, plain text, a short explanation, an idea, or a rough outline. KnowLens currently focuses on text-based input so the creation flow stays simple and predictable.",
  },
  {
    id: "q5",
    question: "Does KnowLens support PDF or report uploads?",
    answer:
      "Not yet. KnowLens does not currently support PDF, report, document, white paper, or file uploads. Please paste the key text, notes, or topic directly into the editor.",
  },
  {
    id: "q6",
    question: "Is KnowLens only for science infographics?",
    answer:
      "No. You can use KnowLens for science infographics, educational visuals, business explainers, social media visuals, visual summaries, posters, and short explainer videos.",
  },
  {
    id: "q7",
    question: "Do I need design experience?",
    answer:
      "No. KnowLens helps structure your text, choose a visual direction, and generate a polished visual draft. You can start with messy notes or a simple topic.",
  },
  {
    id: "q8",
    question: "How is this different from a normal poster maker?",
    answer:
      "A normal poster maker usually starts with templates. KnowLens starts with your idea or notes, then helps turn the content into infographics, visual summaries, carousel-style visuals, posters, or short explainer videos.",
  },
];

const planCards = [
  {
    id: "starter",
    nameEn: "Starter",
    nameZh: "入门版",
    subtitleEn: "Create clean infographics and visual summaries without watermark.",
    subtitleZh: "无水印生成清晰的信息图和视觉摘要，适合日常轻量使用。",
    monthlyPrice: 14.9,
    yearlyPrice: 124.9,
    monthlyEquivalent: 10.43,
    monthlyCreditsEn: "1,200 credits / month",
    monthlyCreditsZh: "每月 1,200 积分",
    usageEn:
      "6 credits/image during promo, up to ~200 images/month.",
    usageZh: "活动期 6 积分/输出，每月约可生成 200 个内容。",
    modelAccess: ["GPT-image2", "GPT-5.5", "Gemini 3.5", "Claude 4.7"],
    featuresEn: [
      "No watermark",
      "Standard infographic generation",
      "Visual summary generation",
      "Standard image export",
      "Basic visual styles",
      "Standard queue",
    ],
    featuresZh: ["无水印输出", "标准信息图生成", "视觉摘要生成", "标准图片导出", "基础视觉风格", "标准生成队列"],
    ctaEn: "Subscribe with Stripe",
    ctaZh: "通过 Stripe 订阅",
    highlight: false,
  },
  {
    id: "pro",
    nameEn: "Creator",
    nameZh: "创作者版",
    subtitleEn: "Best for creators turning topics, notes, and ideas into visual content.",
    subtitleZh: "适合经常把主题、笔记和想法做成视觉内容的创作者。",
    monthlyPrice: 29,
    yearlyPrice: 242,
    monthlyEquivalent: 20.17,
    monthlyCreditsEn: "3,000 credits / month",
    monthlyCreditsZh: "每月 3,000 积分",
    usageEn:
      "6 credits/image during promo, up to ~500 images/month.",
    usageZh: "活动期 6 积分/输出，每月约可生成 500 个内容。",
    modelAccess: ["GPT-image2", "GPT-5.5", "Gemini 3.5", "Claude 4.7"],
    featuresEn: [
      "No watermark",
      "HD infographic export",
      "More visual styles",
      "Poster and carousel-style visuals",
      "Short explainer video generation",
      "Faster generation queue",
      "Commercial usage",
    ],
    featuresZh: ["无水印输出", "高清信息图导出", "更多视觉风格", "海报与轮播式视觉", "短解说视频生成", "更快生成队列", "可商用"],
    ctaEn: "Subscribe with Stripe",
    ctaZh: "通过 Stripe 订阅",
    highlight: true,
  },
  {
    id: "scale",
    nameEn: "Pro",
    nameZh: "专业版",
    subtitleEn: "For high-volume creators producing HD infographics, posters, and short explainer videos regularly.",
    subtitleZh: "适合高频生成高清信息图、海报和短解说视频的团队或个人。",
    monthlyPrice: 59,
    yearlyPrice: 489.9,
    monthlyEquivalent: 40.83,
    monthlyCreditsEn: "7,500 credits / month",
    monthlyCreditsZh: "每月 7,500 积分",
    usageEn:
      "6 credits/image during promo, up to ~1,250 images/month.",
    usageZh: "活动期 6 积分/输出，每月约可生成 1,250 个内容。",
    modelAccess: ["GPT-image2", "GPT-5.5", "Gemini 3.5", "Claude 4.7"],
    featuresEn: [
      "No watermark",
      "Premium HD export",
      "Long infographic generation",
      "Visual summary generation",
      "Short explainer video generation",
      "Priority rendering",
      "Batch generation",
      "Commercial usage",
    ],
    featuresZh: ["无水印输出", "高级高清导出", "长信息图生成", "视觉摘要生成", "短解说视频生成", "优先渲染", "批量生成", "可商用"],
    ctaEn: "Subscribe with Stripe",
    ctaZh: "通过 Stripe 订阅",
    highlight: false,
  },
];

type ProgressiveImageProps = {
  src: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
  skeletonClassName?: string;
  title?: string;
};

function normalizeAssetPath(assetPath: string) {
  if (!assetPath.startsWith("/")) {
    return assetPath;
  }
  return assetPath
    .split("/")
    .map((segment, index) => (index === 0 ? segment : encodeURIComponent(segment)))
    .join("/");
}

function withAssetVersion(assetPath: string) {
  const sep = assetPath.includes("?") ? "&" : "?";
  return `${assetPath}${sep}v=${LANDING_ASSET_VERSION}`;
}

async function startStripeCheckout(planId: string, cycle: BillingCycle) {
  if (typeof window === "undefined") {
    return;
  }
  const trackLandingCheckout = (input: {
    action: string;
    status?: "ok" | "error" | "info";
    message?: string;
    details?: Record<string, unknown>;
  }) => {
    void fetch("/api/telemetry/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "billing",
        action: input.action,
        status: input.status ?? "info",
        source: MEMBERSHIP_SOURCE,
        message: input.message,
        details: {
          planId,
          cycle,
          ...(input.details ?? {}),
        },
      }),
    }).catch(() => undefined);
  };
  if (!findBillingPlan(planId)) {
    throw new Error("Plan config is invalid. Please refresh and retry.");
  }
  trackLandingCheckout({
    action: "pay_button_clicked",
    status: "info",
  });
  const response = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      planId,
      cycle,
      source: MEMBERSHIP_SOURCE,
    }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    checkoutUrl?: string;
    directCheckoutUrl?: string;
    error?: string;
  };
  if (!response.ok || !data.ok || !data.checkoutUrl) {
    const message = data.error || "Unable to create checkout session.";
    trackLandingCheckout({
      action: "checkout_redirect_failed",
      status: "error",
      message,
      details: { statusCode: response.status },
    });
    throw new Error(message);
  }
  trackLandingCheckout({
    action: "checkout_redirect_started",
    status: "ok",
    details: {
      hasDirectCheckoutUrl: Boolean(data.directCheckoutUrl),
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
}

function ProgressiveImage({
  src,
  fallbackSrc,
  alt,
  className = "",
  loading = "lazy",
  fetchPriority = "auto",
  skeletonClassName = "",
  title,
}: ProgressiveImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const actualSrc = usingFallback && fallbackSrc ? fallbackSrc : src;
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    setUsingFallback(false);
  }, [src, fallbackSrc]);

  useEffect(() => {
    const img = imageRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      setLoaded(true);
      setFailed(false);
    }
  }, [actualSrc]);

  return (
    <div className="relative h-full w-full">
      {!loaded ? (
        <div
          className={`absolute inset-0 z-[2] ${failed ? "bg-zinc-200" : "skeleton-shimmer"} ${skeletonClassName}`}
          aria-hidden="true"
        />
      ) : null}
      <img
        src={actualSrc}
        alt={alt}
        title={title}
        data-keywords={title}
        ref={imageRef}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding="async"
        onLoad={() => {
          setLoaded(true);
          setFailed(false);
        }}
        onError={() => {
          if (fallbackSrc && !usingFallback) {
            if (ENABLE_IMAGE_DEBUG) {
              console.error("[ImageDebug][landing] optimized load failed, fallback enabled", {
                src,
                fallbackSrc,
                currentSrc: actualSrc,
                page: typeof window !== "undefined" ? window.location.pathname : "",
                title,
              });
            }
            setUsingFallback(true);
            setLoaded(false);
            return;
          }
          if (ENABLE_IMAGE_DEBUG) {
            console.error("[ImageDebug][landing] image load failed", {
              src,
              fallbackSrc,
              currentSrc: actualSrc,
              page: typeof window !== "undefined" ? window.location.pathname : "",
              title,
            });
          }
          setFailed(true);
          setLoaded(false);
        }}
        className={`!rounded-none ${className} transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

function AspectSkeleton({
  ratioClassName,
  className = "",
  children,
}: {
  ratioClassName: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`relative overflow-hidden bg-zinc-100 ${ratioClassName} ${className}`}>
      {children ? <div className="absolute inset-0 z-[1]">{children}</div> : null}
      <div className="pointer-events-none absolute inset-0 z-0 skeleton-shimmer" />
    </div>
  );
}

export default function LandingPage() {
  const { t, locale } = useLocale();
  const toOptimized = (imagePath: string) =>
    withAssetVersion(normalizeAssetPath(`/landing-optimized${imagePath}`));
  const toOriginal = (imagePath: string) =>
    withAssetVersion(normalizeAssetPath(imagePath));
  const previewWideLoop = [...previewWideCases, ...previewWideCases];
  const previewTallLoop = [...previewTallCases, ...previewTallCases];
  const [activeFlowId, setActiveFlowId] = useState(DEFAULT_CAPABILITY_FLOW_ID);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [activeFlowPreviewSrc, setActiveFlowPreviewSrc] = useState(() =>
    toOptimized(
      capabilityFlows.find((flow) => flow.id === DEFAULT_CAPABILITY_FLOW_ID)?.previewImage ??
        capabilityFlows[0].previewImage,
    ),
  );
  const [activeFlowPreviewFallbackSrc, setActiveFlowPreviewFallbackSrc] = useState(() =>
    toOriginal(
      capabilityFlows.find((flow) => flow.id === DEFAULT_CAPABILITY_FLOW_ID)?.previewImage ??
        capabilityFlows[0].previewImage,
    ),
  );
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null);
  const [openFaqIds, setOpenFaqIds] = useState<Set<string>>(new Set(["q1", "q2"]));
  const activeFlow =
    capabilityFlows.find((flow) => flow.id === activeFlowId) ??
    capabilityFlows.find((flow) => flow.id === DEFAULT_CAPABILITY_FLOW_ID) ??
    capabilityFlows[0];

  const handleCheckoutClick = async (planId: string, cycle: BillingCycle) => {
    if (checkoutPlanId) {
      return;
    }
    setCheckoutPlanId(planId);
    try {
      await startStripeCheckout(planId, cycle);
    } catch (error) {
      console.error(error);
      setCheckoutPlanId(null);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const nextOptimizedSrc = withAssetVersion(
      normalizeAssetPath(`/landing-optimized${activeFlow.previewImage}`),
    );
    const nextRawSrc = withAssetVersion(normalizeAssetPath(activeFlow.previewImage));
    if (
      activeFlowPreviewSrc === nextOptimizedSrc &&
      activeFlowPreviewFallbackSrc === nextRawSrc
    ) {
      return;
    }

    const activePreview = new Image();
    activePreview.decoding = "async";
    activePreview.src = nextOptimizedSrc;
    activePreview.onload = () => {
      setActiveFlowPreviewSrc(nextOptimizedSrc);
      setActiveFlowPreviewFallbackSrc(nextRawSrc);
    };
    activePreview.onerror = () => {
      setActiveFlowPreviewSrc(nextRawSrc);
      setActiveFlowPreviewFallbackSrc(nextRawSrc);
    };
  }, [
    activeFlow.previewImage,
    activeFlowPreviewFallbackSrc,
    activeFlowPreviewSrc,
  ]);
  const softwareAppSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "KnowLens.ai",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: t(
      "Turn topics, notes, and plain text into infographics, visual summaries, posters, carousel-style visuals, and short explainer videos with KnowLens.ai.",
      "Turn topics, notes, and plain text into infographics, visual summaries, posters, carousel-style visuals, and short explainer videos with KnowLens.ai.",
    ),
    offers: {
      "@type": "Offer",
      category: "SaaS Subscription",
      priceCurrency: "CNY",
      price: "39",
    },
    url: "https://knowlens.ai",
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <MarketingChrome>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
 
        <h1 className="sr-only">{t("AI Infographic and AI Video Generator", "AI 信息图与 AI 视频生成器")}</h1>

        <section className="mx-auto grid w-full max-w-6xl gap-5 px-4 pb-4 pt-6 sm:gap-8 sm:px-6 sm:pt-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:items-center lg:gap-10 lg:pt-14">
          <div className="mx-auto max-w-[620px] text-center lg:mx-0 lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-white px-3.5 py-1.5 text-[11px] text-zinc-700 shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
              <span className="inline-flex items-center gap-0.5 text-amber-400">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star key={index} size={11} fill="currentColor" strokeWidth={1.8} />
                ))}
              </span>
              <span className="font-medium">{t("AI Infographic & Video Generator", "AI 信息图与视频生成器")}</span>
            </div>
            <h2 className="mt-4 text-[clamp(1.95rem,5.2vw,2.5rem)] font-semibold leading-[1.14] tracking-tight text-zinc-950 sm:text-[36px] lg:text-[40px]">
              <span className="block">{t("AI Infographic and", "AI 信息图")}</span>
              <span className="block">{t("AI Video Generator", "与 AI 视频生成器")}</span>
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-zinc-600 sm:mt-4 sm:text-base lg:mx-0">
              {t(
                "Turn topics, notes, or plain text into infographics, visual summaries, posters, carousel-style visuals, and short explainer videos in minutes.",
                "把主题、笔记或纯文本快速变成信息图、视觉摘要、海报、轮播图和短解说视频。",
              )}
            </p>
            <div className="mt-5 flex items-center justify-center sm:mt-6 lg:justify-start">
              <Link
                href="/app"
                onClick={() => trackLandingGenerateClick("hero")}
                className={`${LANDING_CTA_CLASS} h-12 min-w-[148px] gap-2 px-6 text-[15px] sm:h-[52px]`}
              >
                {t("Create Now", "立即创建")}
                <ArrowRight size={15} />
              </Link>
            </div>
            <p className="mt-3 text-xs leading-5 text-zinc-500">
              {t("No design skills needed.", "无需设计技能。")}
            </p>
          </div>

          <div className="w-full overflow-hidden rounded-lg lg:justify-self-end">
            <AspectSkeleton ratioClassName="aspect-square">
              <ProgressiveImage
                src={toOriginal(heroImage)}
                fallbackSrc={toOriginal(heroImage)}
                alt="AI-generated infographic and short video examples for education, science, visual summaries, posters, and carousel-style visuals"
                title="AI Infographic and Video Generator Examples"
                className="absolute inset-0 block h-full w-full scale-[1.02] object-cover align-top"
                loading="eager"
                fetchPriority="high"
              />
            </AspectSkeleton>
            <p className="mt-2 text-center text-xs leading-5 text-zinc-500">
              {t(
                "Generated examples: educational infographics, science visuals, visual summaries, posters, and short explainer videos.",
                "案例包含教育信息图、科学图解、视觉摘要、海报和短解说视频。",
              )}
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <h2 className="mt-2 text-center text-[30px] font-semibold leading-tight tracking-tight text-zinc-950 sm:text-[42px]">
              {t(
                "Create Different Types of Infographics & Videos",
                "一站式创建多种信息图与视频",
              )}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-7 text-zinc-600">
              {t(
                "Choose the right format for your idea, from educational visuals to social media posters, carousel-style graphics, and short explainer videos.",
                "根据你的内容选择合适形式：教学图解、社媒海报、轮播图，或短解说视频。",
              )}
            </p>

            <div className="mt-5">
              <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
                <div className="flex min-w-full justify-center gap-2 sm:mx-auto sm:min-w-0 sm:w-auto">
                {capabilityFlows.map((flow) => (
                  <button
                    key={flow.id}
                    type="button"
                    onClick={() => setActiveFlowId(flow.id)}
                    className={`shrink-0 rounded-xl border px-4 py-2 text-center text-xs leading-5 transition sm:px-5 sm:py-2.5 sm:text-sm lg:whitespace-nowrap ${
                      activeFlowId === flow.id
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
                    }`}
                  >
                    {t(flow.tabEn, flow.tabZh)}
                  </button>
                ))}
                </div>
              </div>
            </div>

            <div className="mx-auto mt-4 max-w-5xl">
              <article className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
                <div className="relative overflow-hidden bg-zinc-100">
                  <AspectSkeleton ratioClassName="aspect-[16/9]">
                    <ProgressiveImage
                      src={activeFlowPreviewSrc}
                      fallbackSrc={activeFlowPreviewFallbackSrc}
                      alt={t(`${activeFlow.tabEn} example generated from text`, `${activeFlow.tabZh} example generated from text`)}
                      className="absolute inset-0 h-full w-full object-contain"
                      loading="eager"
                      fetchPriority="high"
                      skeletonClassName="bg-zinc-200"
                    />
                  </AspectSkeleton>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <div className="text-center">
            <h2 className="text-[30px] font-semibold leading-tight tracking-tight text-zinc-950 sm:text-[42px]">
              {t("AI-Generated Infographic & Video Examples", "AI 生成的信息图与视频案例")}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-zinc-600">
              {t(
                "Explore visual examples created from topics, notes, and short text prompts.",
                "浏览由主题、笔记和短提示词生成的视觉案例。",
              )}
            </p>
          </div>

          <div className="mt-5 space-y-3 overflow-hidden">
            <div className="landing-marquee-row">
              <div className="landing-marquee-track landing-marquee-track-left">
                {previewWideLoop.map((item, index) => (
                  <article
                    key={`${item.id}-wide-${index}`}
                    aria-hidden={index >= previewWideCases.length}
                    className="w-[250px] shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-white sm:w-[280px] lg:w-[300px]"
                  >
                    <div className="aspect-video overflow-hidden bg-zinc-100">
                      <ProgressiveImage
                        src={toOptimized(item.cover)}
                        fallbackSrc={toOriginal(item.cover)}
                        alt={t(`${item.titleEn} AI infographic example`, `${item.titleEn} AI infographic example`)}
                        title={t(item.titleEn, item.titleZh)}
                        className="block h-full w-full object-cover align-top"
                        loading={index < previewWideCases.length ? "eager" : "lazy"}
                        fetchPriority={index < previewWideCases.length ? "high" : "low"}
                        skeletonClassName="bg-zinc-200"
                      />
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="landing-marquee-row">
              <div className="landing-marquee-track landing-marquee-track-right">
                {previewTallLoop.map((item, index) => (
                  <article
                    key={`${item.id}-tall-${index}`}
                    aria-hidden={index >= previewTallCases.length}
                    className="w-[150px] shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-white sm:w-[170px] lg:w-[180px]"
                  >
                    <div className="aspect-[9/16] overflow-hidden bg-zinc-100">
                      <ProgressiveImage
                        src={toOptimized(item.cover)}
                        fallbackSrc={toOriginal(item.cover)}
                        alt={t(`${item.titleEn} visual summary example`, `${item.titleEn} visual summary example`)}
                        title={t(item.titleEn, item.titleZh)}
                        className="block h-full w-full object-cover align-top"
                        loading={index < previewTallCases.length ? "eager" : "lazy"}
                        fetchPriority={index < previewTallCases.length ? "high" : "low"}
                        skeletonClassName="bg-zinc-200"
                      />
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-8 w-full max-w-6xl px-4 py-6 sm:mt-10 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <p className="text-center text-xs font-medium tracking-[0.12em] text-zinc-500">
              {t("HOW IT WORKS", "使用流程")}
            </p>
            <h2 className="mt-3 text-center text-[30px] font-semibold leading-tight tracking-tight text-zinc-950 sm:text-[40px]">
              {t("Create an Infographic or Video in 3 Simple Steps", "三步创建信息图或视频")}
            </h2>
            <p className="mx-auto mt-3 max-w-3xl text-center text-sm leading-7 text-zinc-600">
              {t(
                "Start with a topic, notes, or rough outline. KnowLens helps structure your message and turn it into polished visuals or short explainer videos.",
                "从主题、笔记或大纲开始，KnowLens 会帮你整理结构，并生成精致的视觉内容或短解说视频。",
              )}
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {howItWorksTags.map((domain) => (
                <span key={domain} className="rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] text-zinc-600">
                  {t(domain, howItWorksTagZh[domain] || domain)}
                </span>
              ))}
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {howItWorksCards.map((module) => (
                <article key={module.id} className="border-t border-zinc-300 pt-4">
                  <h3 className="mt-2 text-base font-semibold text-zinc-900">
                    {t(module.title, module.titleZh)}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-zinc-600">
                    {t(module.description, module.descriptionZh)}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-2">
              {homepageToolCards.map((tool) => (
                <Link
                  key={`${tool.href}-${tool.title}`}
                  href={tool.href}
                  className="group rounded-xl border border-zinc-200 bg-white/90 p-4 text-left transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-sm"
                >
                  <h3 className="text-base font-semibold text-zinc-950">{t(tool.title, tool.titleZh)}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{t(tool.description, tool.descriptionZh)}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-zinc-950 group-hover:text-zinc-600">
                    {t("Open tool", "打开工具")}
                    <ArrowRight size={14} aria-hidden="true" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <div className="mx-auto mt-12 max-w-5xl sm:mt-14">
            <p className="text-center text-xs font-medium tracking-[0.12em] text-zinc-500">
              {t("USE CASES", "适用场景")}
            </p>
            <h2 className="mt-3 text-center text-[30px] font-semibold leading-tight tracking-tight text-zinc-950 sm:text-[40px]">
              {t("Built for Anyone Who Needs Clear Visual Content", "适合任何需要清晰视觉内容的人")}
            </h2>
            <p className="mx-auto mt-3 max-w-3xl text-center text-sm leading-7 text-zinc-600">
              {t(
                "Use KnowLens to turn ideas, notes, and explanations into visual summaries, infographics, posters, and short explainer videos for learning, social media, and presentations.",
                "用 KnowLens 把想法、笔记和解释变成视觉摘要、信息图、海报和短解说视频，适合学习、社媒和演示。",
              )}
            </p>

            <div className="mt-7 grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
              {personaUseCases.map((voice) => (
                <article key={voice.id} className="rounded-xl border border-zinc-200 bg-white/90 p-3.5 sm:p-4">
                  <h3 className="text-[15px] font-semibold text-zinc-900 sm:text-base">{t(voice.role, voice.roleZh)}</h3>
                  <p className="mt-2 text-sm leading-7 text-zinc-700">{t(voice.quote, voice.quoteZh)}</p>
                  <p className="mt-3 text-xs font-medium text-zinc-500">{t(voice.tags, voice.tagsZh)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
            <PromoCountdownBanner variant="inline" />

            <section className="mt-5 flex justify-center">
              <div className="inline-flex rounded-full border border-zinc-200 bg-zinc-100 p-1">
                <button
                  type="button"
                  onClick={() => setBillingCycle("monthly")}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    billingCycle === "monthly" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  {t("Monthly", "月付")}
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle("yearly")}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    billingCycle === "yearly" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  {t("Annual (Save 30%)", "包年（省 30%）")}
                </button>
              </div>
            </section>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {planCards.map((plan) => (
                <article
                  key={plan.id}
                  className={`relative flex h-full flex-col rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${
                    plan.highlight ? "border-zinc-900 ring-1 ring-zinc-900/15" : "border-zinc-200"
                  }`}
                >
                  {plan.highlight ? (
                    <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                      <BadgeCheck size={12} />
                      {t("Most Popular", "最受欢迎")}
                    </span>
                  ) : null}

                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-semibold">{t(plan.nameEn, plan.nameZh)}</h3>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">{t(plan.subtitleEn, plan.subtitleZh)}</p>
                  <p className="mt-1 text-sm text-zinc-500">{t(plan.monthlyCreditsEn, plan.monthlyCreditsZh)}</p>

                  <div className="mt-4">
                    <p className="text-3xl font-semibold leading-none text-zinc-900">
                      $
                      {billingCycle === "monthly"
                        ? Number.isInteger(plan.monthlyPrice)
                          ? plan.monthlyPrice.toString()
                          : plan.monthlyPrice.toFixed(1)
                        : Number.isInteger(plan.yearlyPrice)
                          ? plan.yearlyPrice.toString()
                          : plan.yearlyPrice.toFixed(1)}
                      <span className="ml-1 text-base font-medium text-zinc-500">
                        {billingCycle === "monthly" ? "/mo" : "/yr"}
                      </span>
                    </p>
                    {billingCycle === "yearly" ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        {t("Equivalent to", "折合")} $
                        {Number.isInteger(plan.monthlyEquivalent)
                          ? plan.monthlyEquivalent.toString()
                          : plan.monthlyEquivalent.toFixed(2)}
                        /mo
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCheckoutClick(plan.id, billingCycle)}
                    disabled={checkoutPlanId === plan.id}
                    className={`mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-70 ${
                      plan.highlight
                        ? "bg-zinc-900 text-white hover:bg-zinc-700"
                        : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100"
                    }`}
                  >
                    {checkoutPlanId === plan.id ? t("Redirecting...", "正在跳转...") : t(plan.ctaEn, plan.ctaZh)}
                  </button>

                  <p className="mt-2 text-xs text-zinc-500">{t(plan.usageEn, plan.usageZh)}</p>

                  <ul className="mt-4 space-y-2 text-sm text-zinc-700">
                    <li className="border-b border-zinc-200 pb-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-900">
                        {t("Model Access", "模型权限")}
                      </p>
                      <div className="mt-2 space-y-1">
                        {plan.modelAccess.map((model) => (
                          <p key={`${plan.id}-${model}`} className="flex items-center gap-2 text-[12px] leading-5 text-zinc-700">
                            <Check size={12} className="shrink-0 text-zinc-900" />
                            <span className="flex items-center gap-1.5">
                              <span>{model}</span>
                              {model === "GPT-image2" ? (
                                <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                                  {t("Limited-time 70% off", "限时 3 折")}
                                </span>
                              ) : null}
                            </span>
                          </p>
                        ))}
                      </div>
                    </li>
                    {(t(plan.featuresEn.join("||"), plan.featuresZh.join("||")).split("||")).map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check size={14} className="mt-0.5 text-zinc-900" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-amber-800">
              * GPT-image2 limited-time 70% off offer. Availability windows may change.
            </p>
          </div>
        </section>
        
        <section className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <div className="mx-auto w-full max-w-[860px]">
            <h2 className="text-center text-[30px] font-semibold leading-tight tracking-tight text-zinc-950 sm:text-[40px]">
              Frequently Asked Questions
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-7 text-zinc-600">
              Answers about KnowLens, AI infographic generation, AI video generation, text to infographic workflows, visual summaries, posters, and short explainer videos.
            </p>

            <div className="mt-6 space-y-2">
              {faqItems.map((item) => {
                const isOpen = openFaqIds.has(item.id);
                return (
                  <article key={item.id} className="rounded-xl border border-zinc-200 bg-white">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenFaqIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(item.id)) {
                            next.delete(item.id);
                          } else {
                            next.add(item.id);
                          }
                          return next;
                        })
                      }
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    >
                      <span className="text-sm font-medium text-zinc-900">{item.question}</span>
                      <span className="text-xs text-zinc-500">{isOpen ? "−" : "+"}</span>
                    </button>
                    {isOpen ? (
                      <div className="border-t border-zinc-200 px-4 py-3 text-sm leading-7 text-zinc-600">
                        {item.answer}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-10 pt-2 sm:px-6">
          <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-8 text-center sm:px-10">
            <h3 className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
              Create an Infographic or Video with KnowLens
            </h3>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-zinc-600">
              Start with a topic, notes, or plain text. Generate clear visual summaries, posters, carousel-style visuals, and short explainer videos in minutes.
            </p>
            <div className="mt-5">
              <Link
                href="/app"
                onClick={() => trackLandingGenerateClick("footer_cta")}
                className={`${LANDING_CTA_CLASS} h-11 min-w-[164px] px-6 text-sm`}
              >
                Create an Infographic or Video
              </Link>
            </div>
          </div>
        </section>
    </MarketingChrome>
  );
}
