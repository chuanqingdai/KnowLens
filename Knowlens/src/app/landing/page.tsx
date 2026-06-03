"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { ArrowRight, BadgeCheck, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import { PromoCountdownBanner } from "@/components/billing/PromoCountdownBanner";
import { findBillingPlan, type BillingCycle } from "@/lib/billing-plans";

const heroImage = "/picture/hero picture.jpg";
const LANDING_ASSET_VERSION = "20260528c";
const ENABLE_IMAGE_DEBUG = process.env.NEXT_PUBLIC_DEBUG_IMAGE_LOAD === "true";
const MEMBERSHIP_SOURCE = "landing-page";

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
    tabEn: "Infographic Poster",
    tabZh: "信息图海报",
    previewImage: "/picture/text-to-poster.jpg",
  },
  {
    id: "presentation-slides",
    tabEn: "Presentation Slides",
    tabZh: "演示幻灯片",
    previewImage: "/picture/text-to-ppt-workflow.jpg",
  },
  {
    id: "explainer-video",
    tabEn: "Explainer Video",
    tabZh: "讲解视频",
    previewImage: "/picture/text to video.jpg",
  },
];

const DEFAULT_CAPABILITY_FLOW_ID = "infographic-poster";

const howItWorksTags = [
  "Science",
  "Education",
  "Business",
  "Health",
  "Technology",
  "Research",
];

const howItWorksCards = [
  {
    id: "understand",
    title: "Understand Your Text",
    description:
      "KnowLens identifies the topic, audience, key points, definitions, timelines, data, relationships, and explanation flow in your text.",
  },
  {
    id: "organize",
    title: "Organize the Key Ideas",
    description:
      "It turns notes, lessons, research summaries, investor updates, product ideas, and business analysis into a clear structure with hierarchy, sections, comparisons, and visual emphasis.",
  },
  {
    id: "generate",
    title: "Generate the Right Format",
    description:
      "Choose the format you need: infographic poster, presentation slides, or explainer video storyboards for learning, teaching, reporting, training, and content creation.",
  },
];

const userVoices = [
  {
    id: "science-teacher",
    role: "Science Teacher",
    quote:
      "KnowLens helps me turn lesson notes into visual posters that make abstract science topics easier to explain.",
    tags: "Poster · Slides",
  },
  {
    id: "medical-student",
    role: "Medical Student",
    quote:
      "Dense anatomy and treatment pathways become easier to review when they are organized into structured visual summaries.",
    tags: "Poster",
  },
  {
    id: "content-creator",
    role: "Content Creator",
    quote:
      "A rough explanation can quickly become a storyboard, helping me plan educational videos with clearer scenes and pacing.",
    tags: "Explainer Video",
  },
  {
    id: "business-analyst",
    role: "Business Analyst",
    quote:
      "Market trends and strategy notes become slide-ready visuals that help teams understand the key points faster.",
    tags: "Slides",
  },
  {
    id: "university-student",
    role: "University Student",
    quote:
      "My study notes become memorable one-page summaries, which makes review sessions feel less scattered.",
    tags: "Poster",
  },
  {
    id: "product-manager",
    role: "Product Manager",
    quote:
      "Complex product ideas are easier to communicate when they are turned into structured visual narratives.",
    tags: "Slides · Poster",
  },
];

const faqItems = [
  {
    id: "q1",
    question: "What can I use as input?",
    answer:
      "KnowLens currently supports pasted text and topic descriptions. You can paste study notes, lesson outlines, explanations, business drafts, research summaries, product ideas, or simply describe the topic you want to visualize.",
  },
  {
    id: "q2",
    question: "Do I need design skills?",
    answer:
      "No. KnowLens helps organize your text, plan the visual structure, choose an appropriate format, and generate a clear visual draft automatically. You can start from rough notes or a simple topic without preparing a layout yourself.",
  },
  {
    id: "q3",
    question: "Can I upload PDFs, files, or links?",
    answer:
      "Not yet. The current version focuses on text input only so the creation flow stays simple and predictable. Please paste the content directly into the text box, or summarize the topic you want KnowLens to explain visually.",
  },
  {
    id: "q4",
    question: "What can KnowLens generate?",
    answer:
      "You can choose one output format each time: Infographic Poster, Presentation Slides, or Explainer Video. Posters are best for one-page explainers, slides are useful for teaching and business communication, and explainer video drafts help plan scenes and narration.",
  },
  {
    id: "q5",
    question: "Does one input generate all formats at once?",
    answer:
      "No. You paste your text first, then choose the format you want to generate. This keeps each result focused. If you need multiple formats, you can create posters, slides, and explainer video drafts separately from the same idea.",
  },
  {
    id: "q6",
    question: "Can I try KnowLens for free?",
    answer:
      "Yes. Free users can generate sample outputs with watermark. It is a good way to test how KnowLens turns your text into visual learning content before upgrading.",
  },
  {
    id: "q7",
    question: "What do paid plans unlock?",
    answer:
      "Paid plans unlock watermark-free export, HD output, more generations, and broader access to poster, slide, and video generation features. They are designed for users who create visuals regularly for learning, teaching, research, content, or team communication.",
  },
  {
    id: "q8",
    question: "Can I cancel anytime?",
    answer:
      "Yes. You can cancel your subscription anytime from your account settings. Your plan access remains available during the active billing period according to your subscription status.",
  },
];

const planCards = [
  {
    id: "starter",
    nameEn: "Starter",
    nameZh: "Starter",
    subtitleEn: "Create clean infographics and simple slides without watermark.",
    subtitleZh: "创建简洁信息图和基础幻灯片，无水印。",
    monthlyPrice: 14.9,
    yearlyPrice: 124.9,
    monthlyEquivalent: 10.43,
    monthlyCreditsEn: "1,200 credits / month",
    monthlyCreditsZh: "每月 1,200 积分",
    usageEn:
      "6 credits/image during promo, up to ~200 images/month.",
    usageZh: "活动期 6 积分/输出，每月约可生成 200 个内容。",
    modelAccess: ["GPT-5.4", "GPT-5.5", "Gemini 3.1 Pro", "Claude Sonnet 4.6", "GPT-image2"],
    featuresEn: [
      "No watermark",
      "Standard infographic generation",
      "Basic PPT generation",
      "Standard image export",
      "Basic visual styles",
      "Standard queue",
    ],
    featuresZh: ["无水印", "标准信息图生成", "基础 PPT 生成", "标准图像导出", "基础风格", "标准队列"],
    ctaEn: "Subscribe with Stripe",
    ctaZh: "Stripe 订阅",
    highlight: false,
  },
  {
    id: "pro",
    nameEn: "Creator",
    nameZh: "Creator",
    subtitleEn: "Best for creators turning articles, videos, and ideas into visual content.",
    subtitleZh: "最适合把文章、视频和想法转成视觉内容的创作者。",
    monthlyPrice: 29,
    yearlyPrice: 242,
    monthlyEquivalent: 20.17,
    monthlyCreditsEn: "3,000 credits / month",
    monthlyCreditsZh: "每月 3,000 积分",
    usageEn:
      "6 credits/image during promo, up to ~500 images/month.",
    usageZh: "活动期 6 积分/输出，每月约可生成 500 个内容。",
    modelAccess: ["GPT-5.4", "GPT-5.5", "Gemini 3.1 Pro", "Claude Sonnet 4.6", "GPT-image2"],
    featuresEn: [
      "No watermark",
      "HD infographic export",
      "More visual styles",
      "Visual PPT generation",
      "Video storyboard generation",
      "Faster generation queue",
      "Commercial usage",
    ],
    featuresZh: ["无水印", "HD 信息图导出", "更多视觉风格", "视觉化 PPT 生成", "视频分镜生成", "更快队列", "商用授权"],
    ctaEn: "Subscribe with Stripe",
    ctaZh: "Stripe 订阅",
    highlight: true,
  },
  {
    id: "scale",
    nameEn: "Pro",
    nameZh: "Pro",
    subtitleEn: "For high-volume creators producing HD visuals, presentations, and video-ready content regularly.",
    subtitleZh: "适合高频产出 HD 视觉、演示文稿和视频内容的用户。",
    monthlyPrice: 59,
    yearlyPrice: 489.9,
    monthlyEquivalent: 40.83,
    monthlyCreditsEn: "7,500 credits / month",
    monthlyCreditsZh: "每月 7,500 积分",
    usageEn:
      "6 credits/image during promo, up to ~1,250 images/month.",
    usageZh: "活动期 6 积分/输出，每月约可生成 1,250 个内容。",
    modelAccess: ["GPT-5.4", "GPT-5.5", "Gemini 3.1 Pro", "Claude Sonnet 4.6", "GPT-image2"],
    featuresEn: [
      "No watermark",
      "Premium HD export",
      "Long infographic generation",
      "Full visual PPT generation",
      "Video storyboard generation",
      "Priority rendering",
      "Batch generation",
      "Commercial usage",
    ],
    featuresZh: ["无水印", "高级 HD 导出", "长图信息图生成", "完整视觉化 PPT 生成", "视频分镜生成", "优先渲染", "批量生成", "商用授权"],
    ctaEn: "Subscribe with Stripe",
    ctaZh: "Stripe 订阅",
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
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
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
      "Paste your text or describe a topic. KnowLens turns it into infographic posters, presentation slides, and explainer videos.",
      "粘贴文本或描述一个主题，KnowLens 会将其转换为信息图海报、演示幻灯片和讲解视频。",
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
 
        <h1 className="sr-only">{t("KnowLens.ai visual creation platform", "KnowLens.ai 知识可视化创作平台")}</h1>

        <section className="mx-auto grid w-full max-w-6xl gap-5 px-4 pb-4 pt-6 sm:gap-8 sm:px-6 sm:pt-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:items-center lg:gap-10 lg:pt-14">
          <div className="mx-auto max-w-[620px] text-center lg:mx-0 lg:text-left">
            <div className="inline-flex items-center rounded-full border border-zinc-300 bg-white px-3 py-1 text-[11px] text-zinc-600">
              Powered by GPT-image2
            </div>
            <h2 className="mt-4 text-[clamp(1.95rem,5.2vw,2.5rem)] font-semibold leading-[1.14] tracking-tight text-zinc-950 sm:text-[36px] lg:text-[40px]">
              AI Infographic Generator for Learning
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-zinc-600 sm:mt-4 sm:text-base lg:mx-0">
              Paste your text or describe a topic. KnowLens turns it into infographic posters, presentation slides, and explainer videos in minutes.
            </p>
            <div className="mt-5 flex items-center justify-center sm:mt-6 lg:justify-start">
              <Link
                href="/app"
                className="inline-flex h-12 min-w-[176px] items-center justify-center gap-2 rounded-xl bg-zinc-900 px-8 text-[15px] font-medium text-white transition hover:bg-zinc-700 sm:h-[52px]"
              >
                Generate Free
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>

          <div className="w-full overflow-hidden rounded-lg lg:justify-self-end">
            <AspectSkeleton ratioClassName="aspect-square">
              <ProgressiveImage
                src={toOriginal(heroImage)}
                fallbackSrc={toOriginal(heroImage)}
                alt="KnowLens Hero"
                className="absolute inset-0 block h-full w-full scale-[1.02] object-cover align-top"
                loading="eager"
                fetchPriority="high"
              />
            </AspectSkeleton>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <h2 className="mt-2 text-center text-[30px] font-semibold leading-tight tracking-tight text-zinc-950 sm:text-[42px]">
              {t("From Text to Visual Learning Content", "From Text to Visual Learning Content")}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-7 text-zinc-600">
              {t("Start with text, then choose the format you want to generate.", "Start with text, then choose the format you want to generate.")}
            </p>

            <div className="mt-5">
              <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
                <div className="flex min-w-full justify-center gap-2 sm:mx-auto sm:min-w-0 sm:w-auto">
                {capabilityFlows.map((flow) => (
                  <button
                    key={flow.id}
                    type="button"
                    onClick={() => setActiveFlowId(flow.id)}
                    className={`shrink-0 rounded-lg border px-3 py-1.5 text-center text-[10px] leading-4 transition sm:px-4 lg:whitespace-nowrap ${
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
                      alt={t(`${activeFlow.tabEn} visual example`, `${activeFlow.tabZh} 案例示意`)}
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
              {t("Featured Case Gallery", "精选案例画廊")}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-zinc-600">
              {t(
                "Explore curated visual cases shown in their original aspect ratios for true, distortion-free preview.",
                "浏览精选可视化案例，按原始比例真实呈现，预览不裁切不变形。",
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
                        alt={t(item.titleEn, item.titleZh)}
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
                        alt={t(item.titleEn, item.titleZh)}
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

        <section className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <p className="text-center text-xs font-medium tracking-[0.12em] text-zinc-500">
              HOW IT WORKS
            </p>
            <h2 className="mt-3 text-center text-[30px] font-semibold leading-tight tracking-tight text-zinc-950 sm:text-[40px]">
              {t("How KnowLens Turns Text into Visual Content", "How KnowLens Turns Text into Visual Content")}
            </h2>
            <p className="mx-auto mt-3 max-w-3xl text-center text-sm leading-7 text-zinc-600">
              {t(
                "KnowLens reads your text, organizes key ideas, finds relationships, timelines, data points, processes, and summaries, then turns them into clear posters, slides, or explainer video drafts.",
                "KnowLens reads your text, organizes key ideas, finds relationships, timelines, data points, processes, and summaries, then turns them into clear posters, slides, or explainer video drafts.",
              )}
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {howItWorksTags.map((domain) => (
                <span key={domain} className="rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] text-zinc-600">
                  {domain}
                </span>
              ))}
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {howItWorksCards.map((module) => (
                <article key={module.id} className="border-t border-zinc-300 pt-4">
                  <h3 className="mt-2 text-base font-semibold text-zinc-900">
                    {module.title}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-zinc-600">
                    {module.description}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-8 border-t border-zinc-200 pt-5 text-center">
              <p className="text-sm font-medium text-zinc-700">Text Input → Knowledge Structure → Visual Draft</p>
              <p className="mx-auto mt-2 max-w-3xl text-xs leading-6 text-zinc-500">
                Built for study notes, lesson plans, research summaries, financial reports, market analysis, product explainers, medical education, employee training, AI learning, and business communication.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <p className="text-center text-xs font-medium tracking-[0.12em] text-zinc-500">
              USER VOICES
            </p>
            <h2 className="mt-3 text-center text-[30px] font-semibold leading-tight tracking-tight text-zinc-950 sm:text-[40px]">
              {t("What Users Say About KnowLens", "What Users Say About KnowLens")}
            </h2>
            <p className="mx-auto mt-3 max-w-3xl text-center text-sm leading-7 text-zinc-600">
              {t(
                "Educators, students, creators, and teams use KnowLens to turn text and ideas into clearer visual content.",
                "Educators, students, creators, and teams use KnowLens to turn text and ideas into clearer visual content.",
              )}
            </p>

            <div className="mt-7 grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
              {userVoices.map((voice) => (
                <article key={voice.id} className="rounded-xl border border-zinc-200 bg-white/90 p-3.5 sm:p-4">
                  <h3 className="text-[15px] font-semibold text-zinc-900 sm:text-base">{voice.role}</h3>
                  <p className="mt-2 text-sm leading-7 text-zinc-700">{voice.quote}</p>
                  <p className="mt-3 text-xs font-medium text-zinc-500">{voice.tags}</p>
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
              Everything you need to know before creating your first visual with KnowLens.
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
              Start Creating with KnowLens
            </h3>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-zinc-600">
              Paste your text, choose one format, and generate your first visual draft in minutes.
            </p>
            <div className="mt-5">
              <Link
                href="/app"
                className="inline-flex h-11 min-w-[164px] items-center justify-center rounded-xl bg-zinc-900 px-6 text-sm font-medium text-white transition hover:bg-zinc-700"
              >
                Generate Free
              </Link>
            </div>
          </div>
        </section>
    </MarketingChrome>
  );
}
