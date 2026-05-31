"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { ArrowRight, BadgeCheck, BriefcaseBusiness, Check, GraduationCap, Megaphone, Presentation, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import { PromoCountdownBanner } from "@/components/billing/PromoCountdownBanner";
import { findBillingPlan, type BillingCycle } from "@/lib/billing-plans";

const heroImage = "/picture/hero picture.jpg";
const LANDING_ASSET_VERSION = "20260531b";
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

const principleModules = [
  {
    id: "understand",
    titleEn: "Understand Your Text",
    titleZh: "理解你的文本",
    descEn: "KnowLens identifies the topic, key points, relationships, and explanation flow in your text.",
    descZh: "KnowLens 会识别你文本中的主题、重点、关系和讲解逻辑。",
    notesEn: ["It removes clutter and keeps the most important ideas for visual presentation."],
    notesZh: ["它会去掉干扰信息，只保留最适合可视化呈现的核心内容。"],
  },
  {
    id: "structure",
    titleEn: "Organize the Key Ideas",
    titleZh: "组织关键观点",
    descEn: "It turns raw text into a clear structure with hierarchy, sections, and visual emphasis.",
    descZh: "它会把原始文本整理为清晰结构，包含层级、分段与视觉重点。",
    notesEn: ["This helps the final output feel readable instead of crowded."],
    notesZh: ["这样最终内容更易读，不会显得拥挤和杂乱。"],
  },
  {
    id: "compose",
    titleEn: "Generate the Right Visual Format",
    titleZh: "生成合适的视觉形式",
    descEn: "Choose the format you need: infographic poster, presentation slides, or explainer video draft.",
    descZh: "选择你需要的形式：信息图海报、演示幻灯片或讲解视频草稿。",
    notesEn: ["Each format uses a different layout logic for better clarity."],
    notesZh: ["每种形式都使用不同的布局逻辑，以获得更好的清晰度。"],
  },
];

const generationPipeline = [
  {
    id: "text-input",
    stepEn: "Text Input",
    stepZh: "文本输入",
    detailEn: "Paste your explanation, notes, draft, or topic idea.",
    detailZh: "粘贴你的解释、笔记、草稿或主题想法。",
    noteEn: "",
    noteZh: "",
  },
  {
    id: "knowledge-structure",
    stepEn: "Knowledge Structure",
    stepZh: "知识结构",
    detailEn: "KnowLens extracts key points, creates an outline, and plans the visual hierarchy.",
    detailZh: "KnowLens 提取关键观点，生成大纲，并规划视觉层级。",
    noteEn: "",
    noteZh: "",
  },
  {
    id: "visual-draft",
    stepEn: "Visual Draft",
    stepZh: "视觉草稿",
    detailEn: "Generate a poster, slide draft, or explainer video draft based on your selected format.",
    detailZh: "根据你选择的格式生成海报、幻灯片草稿或讲解视频草稿。",
    noteEn: "",
    noteZh: "",
  },
];

const userVoices = [
  {
    id: "science-teacher",
    roleEn: "Science Teacher",
    roleZh: "科学老师",
    quoteEn:
      "KnowLens helps me turn lesson notes into AI infographic posters that make abstract science topics easier to explain.",
    quoteZh: "KnowLens 帮我把课堂笔记转成 AI 可视化海报，让抽象科学主题更容易讲清楚。",
    metaEn: "AI Infographic Poster · Slides · GPT-image2",
    metaZh: "AI 可视化海报 · 幻灯片 · GPT-image2",
    icon: GraduationCap,
  },
  {
    id: "medical-student",
    roleEn: "Medical Student",
    roleZh: "医学生",
    quoteEn:
      "Dense anatomy and treatment pathways become easier to review when they are organized into AI visual poster summaries.",
    quoteZh: "当解剖与治疗路径被整理成 AI 可视化海报总结后，复习会轻松很多。",
    metaEn: "AI Infographic Poster · GPT-image2",
    metaZh: "AI 可视化海报 · GPT-image2",
    icon: Users,
  },
  {
    id: "content-creator",
    roleEn: "Content Creator",
    roleZh: "内容创作者",
    quoteEn:
      "A rough explanation can quickly become an AI explainer video storyboard, helping me plan educational videos with clearer scenes and pacing.",
    quoteZh: "一个粗略说明可以很快变成 AI 讲解视频分镜，帮助我做出节奏更清晰的教育视频规划。",
    metaEn: "AI Explainer Video · GPT-image2",
    metaZh: "AI 讲解视频 · GPT-image2",
    icon: Megaphone,
  },
  {
    id: "business-analyst",
    roleEn: "Business Analyst",
    roleZh: "业务分析师",
    quoteEn:
      "Market trends and strategy notes become slide-ready visuals and AI infographic posters that help teams understand key points faster.",
    quoteZh: "市场趋势和策略笔记可以变成可上幻灯片的内容和 AI 可视化海报，团队理解重点更快。",
    metaEn: "Slides · AI Infographic Poster · GPT-image2",
    metaZh: "幻灯片 · AI 可视化海报 · GPT-image2",
    icon: BriefcaseBusiness,
  },
  {
    id: "university-student",
    roleEn: "University Student",
    roleZh: "大学生",
    quoteEn:
      "My study notes become memorable one-page AI visual posters, which makes review sessions feel less scattered.",
    quoteZh: "我的学习笔记会变成更好记的一页 AI 可视化海报，复习不再那么零散。",
    metaEn: "AI Infographic Poster · GPT-image2",
    metaZh: "AI 可视化海报 · GPT-image2",
    icon: Users,
  },
  {
    id: "product-manager",
    roleEn: "Product Manager",
    roleZh: "产品经理",
    quoteEn:
      "Complex product ideas are easier to communicate when they are turned into structured visual narratives, AI infographic posters, and AI explainer video drafts.",
    quoteZh: "复杂的产品想法转成结构化视觉叙事、AI 可视化海报和 AI 讲解视频草稿后，会更容易沟通。",
    metaEn: "Slides · AI Infographic Poster · AI Explainer Video · GPT-image2",
    metaZh: "幻灯片 · AI 可视化海报 · AI 讲解视频 · GPT-image2",
    icon: Presentation,
  },
];

const capabilityFlows = [
  {
    id: "infographic-poster",
    tabEn: "Infographic Poster",
    tabZh: "信息图海报",
    previewImage: "/picture/text-to-poster.jpg",
    inputEn: "Text input",
    inputZh: "任意来源内容",
    outputEn: "Infographic poster",
    outputZh: "信息图海报",
    noteEn: "Generate concise visual posters with clear hierarchy and key ideas.",
    noteZh: "生成层次清晰、重点突出的信息图海报。",
    cases: [
      { titleEn: "Inflation in Daily Life", titleZh: "通货膨胀影响生活", cover: "/picture/inflation-daily-life-poster-case.jpg" },
      { titleEn: "Immune Mechanism", titleZh: "免疫机制全景图", cover: "/picture/immune-mechanism-infographic-case.jpg" },
    ],
  },
  {
    id: "presentation-slides",
    tabEn: "Presentation Slides",
    tabZh: "演示幻灯片",
    previewImage: "/picture/text-to-ppt-workflow.jpg",
    inputEn: "Text input",
    inputZh: "任意来源内容",
    outputEn: "Presentation slides",
    outputZh: "演示幻灯片",
    noteEn: "Turn source material into structured, presentation-ready slide narratives.",
    noteZh: "将源内容转成结构化、可直接演示的幻灯片叙事。",
    cases: [
      { titleEn: "Volcano Eruption Process", titleZh: "火山喷发过程", cover: "/picture/volcano-eruption-ppt-case.jpg" },
      { titleEn: "Electrolysis Classroom", titleZh: "电解反应课堂版", cover: "/picture/electrolysis-classroom-ppt-case.jpg" },
    ],
  },
  {
    id: "explainer-video",
    tabEn: "Explainer Video",
    tabZh: "讲解视频",
    previewImage: "/picture/text to video.jpg",
    inputEn: "Text input",
    inputZh: "任意来源内容",
    outputEn: "Explainer video",
    outputZh: "讲解视频分镜",
    noteEn: "Build concise explainer video drafts with clear scenes and narration flow.",
    noteZh: "生成结构化讲解视频分镜，便于后续合成与编辑。",
    cases: [
      { titleEn: "Black Hole Video Draft", titleZh: "黑洞视频稿", cover: "/picture/black-hole-video-visual-case.jpg" },
      { titleEn: "DNA Video Script", titleZh: "DNA视频脚本", cover: "/picture/dna-video-script-case.jpg" },
    ],
  },
];

const DEFAULT_CAPABILITY_FLOW_ID = "infographic-poster";

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
      "6 credits/output during promo, up to ~200 outputs/month.",
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
      "6 credits/output during promo, up to ~500 outputs/month.",
    usageZh: "活动期 6 积分/输出，每月约可生成 500 个内容。",
    modelAccess: ["GPT-5.4", "GPT-5.5", "Gemini 3.1 Pro", "Claude Sonnet 4.6", "GPT-image2"],
    featuresEn: [
      "No watermark",
      "HD infographic export",
      "More visual styles",
      "Visual PPT generation",
      "Explainer video generation",
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
      "6 credits/output during promo, up to ~1,250 outputs/month.",
    usageZh: "活动期 6 积分/输出，每月约可生成 1,250 个内容。",
    modelAccess: ["GPT-5.4", "GPT-5.5", "Gemini 3.1 Pro", "Claude Sonnet 4.6", "GPT-image2"],
    featuresEn: [
      "No watermark",
      "Premium HD export",
      "Long infographic generation",
      "Full visual PPT generation",
      "Explainer video generation",
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

const landingFaqItems = [
  {
    id: "faq-input",
    questionEn: "What can I use as input?",
    questionZh: "我可以输入什么内容？",
    answerEn:
      "KnowLens currently supports pasted text and topic descriptions. You can paste notes, explanations, drafts, or simply describe the topic you want to visualize. This text-first workflow, powered by GPT-image2, is designed to quickly turn your ideas into an AI infographic poster or an AI explainer video draft.",
    answerZh:
      "KnowLens 当前支持粘贴文本和主题描述。你可以粘贴笔记、解释、草稿，或直接描述你想可视化的主题。通过由 GPT-image2 提供技术支持的文本优先流程，你可以更快把想法转换为 AI 可视化海报或 AI 讲解视频草稿。",
  },
  {
    id: "faq-files",
    questionEn: "Can I upload PDFs, files, or links?",
    questionZh: "可以上传 PDF、文件或链接吗？",
    answerEn:
      "Not yet. The current version focuses on text input only. Please paste the content directly into the text box, then choose an output format such as AI visual poster, presentation slides, or AI explainer video.",
    answerZh:
      "暂时不支持。当前版本仅支持文本输入，请将内容直接粘贴到文本框中，再选择输出形式，例如 AI 可视化海报、演示幻灯片或 AI 讲解视频。",
  },
  {
    id: "faq-generate",
    questionEn: "What can KnowLens generate?",
    questionZh: "KnowLens 可以生成什么？",
    answerEn:
      "You can choose one output format each time: Infographic Poster, Presentation Slides, or Explainer Video. Each output is optimized for clarity and powered by GPT-image2, whether you need an AI infographic poster for quick understanding or an AI explainer video draft for storytelling.",
    answerZh:
      "每次可选择一种输出形式：信息图海报、演示幻灯片或解释性视频。每种输出都由 GPT-image2 提供技术支持并针对清晰表达优化，无论你需要用于快速理解的 AI 可视化海报，还是用于叙事表达的 AI 讲解视频草稿。",
  },
  {
    id: "faq-all-formats",
    questionEn: "Does one input generate all formats at once?",
    questionZh: "一次输入会同时生成所有形式吗？",
    answerEn:
      "No. You paste your text first, then choose the format you want to generate. If needed, you can run separate generations from the same text to create an AI infographic poster, slides, and an AI explainer video draft one by one.",
    answerZh:
      "不会。你先粘贴文本，再选择想要生成的形式。如有需要，你可以基于同一段文本分别生成 AI 可视化海报、幻灯片和 AI 讲解视频草稿。",
  },
  {
    id: "faq-design-skills",
    questionEn: "Do I need design skills?",
    questionZh: "需要设计技能吗？",
    answerEn:
      "No. KnowLens helps organize your text, plan the visual structure, and generate a clear visual draft automatically. You can focus on ideas and explanation while GPT-image2-powered generation handles layout logic for AI visual posters, slides, and AI explainer videos.",
    answerZh:
      "不需要。KnowLens 会帮助你整理文本、规划视觉结构，并自动生成清晰的可视化草稿。你可以专注在观点和解释上，由 GPT-image2 提供技术支持的生成能力会处理 AI 可视化海报、幻灯片和 AI 讲解视频的布局逻辑。",
  },
  {
    id: "faq-free",
    questionEn: "Can I try KnowLens for free?",
    questionZh: "可以免费试用 KnowLens 吗？",
    answerEn:
      "Yes. Free users can generate sample outputs with watermark, including examples of AI infographic posters and AI explainer video drafts. Paid plans unlock more generations, better limits, and watermark-free export.",
    answerZh:
      "可以。免费用户可生成带水印示例结果，包括 AI 可视化海报和 AI 讲解视频草稿。付费方案可解锁更多生成次数、更高额度以及无水印导出。",
  },
  {
    id: "faq-paid",
    questionEn: "What do paid plans unlock?",
    questionZh: "付费方案可解锁什么？",
    answerEn:
      "Paid plans unlock watermark-free export, HD output, more generations, and access to poster, slide, and video generation features powered by GPT-image2. This is ideal if you need high-frequency production of AI visual posters, presentation materials, or AI explainer videos.",
    answerZh:
      "付费方案可解锁无水印导出、HD 输出、更多生成次数，以及由 GPT-image2 提供技术支持的海报/幻灯片/视频生成功能。如果你需要高频产出 AI 可视化海报、演示内容或 AI 讲解视频，这会更合适。",
  },
  {
    id: "faq-cancel",
    questionEn: "Can I cancel anytime?",
    questionZh: "可以随时取消吗？",
    answerEn: "Yes. You can cancel your subscription anytime from your account settings.",
    answerZh:
      "可以。你可以随时在账户设置中取消订阅。你的历史文本内容和已生成的 AI 可视化海报或 AI 讲解视频结果不会因为取消而自动删除。",
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
  if (!findBillingPlan(planId)) {
    throw new Error("Plan config is invalid. Please refresh and retry.");
  }
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
    error?: string;
  };
  if (!response.ok || !data.ok || !data.checkoutUrl) {
    throw new Error(data.error || "Unable to create checkout session.");
  }
  try {
    window.location.assign(data.checkoutUrl);
  } catch {
    window.location.replace(data.checkoutUrl);
  }
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
      "Turn webpages, videos, podcasts, and documents into visual posters, PPTs, and storyboard videos.",
      "将网页、视频和播客等内容，一键转化为可视化长图、PPT 或视频。",
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
    mainEntity: [
      {
        "@type": "Question",
        name: t(
          "What kinds of content can KnowLens.ai convert into visual outputs?",
          "KnowLens.ai 可以把哪些内容转成可视化？",
        ),
        acceptedAnswer: {
          "@type": "Answer",
          text: t(
            "It supports webpages, documents, videos, and podcasts, and can generate posters, PPTs, and storyboard videos.",
            "支持网页链接、文档资料、视频和播客内容，并可生成海报、PPT 与分镜视频。",
          ),
        },
      },
      {
        "@type": "Question",
        name: t(
          "Does it support subscription plans and a credit system?",
          "是否支持会员付费与积分体系？",
        ),
        acceptedAnswer: {
          "@type": "Answer",
          text: t(
            "Yes. Monthly and yearly plans are available with tiered credits and capabilities for different creator needs.",
            "支持月付与年付会员方案，并提供积分额度与能力分级，适合不同创作频率用户。",
          ),
        },
      },
    ],
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
          <div className="mx-auto flex max-w-[620px] flex-col items-center text-center lg:mx-0 lg:items-start lg:text-left">
            <div className="inline-flex items-center rounded-full border border-zinc-300 bg-white px-3 py-1 text-[11px] text-zinc-600">
              {t("Powered by GPT-image2", "Powered by GPT-image2")}
            </div>
            <h2 className="mt-4 text-[clamp(1.95rem,5.2vw,2.5rem)] font-semibold leading-[1.14] tracking-tight text-zinc-950 sm:text-[36px] lg:text-[40px]">
              {locale === "en" ? (
                <>
                  <span className="block whitespace-nowrap">AI Infographic Generator</span>
                  <span className="block whitespace-nowrap">for Learning</span>
                </>
              ) : (
                <>
                  <span className="block whitespace-nowrap">AI 信息图生成器</span>
                  <span className="block whitespace-nowrap">助力学习理解</span>
                </>
              )}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-600 sm:mt-4 sm:text-base">
              {t(
                "Paste your text or describe a topic. KnowLens turns it into infographic posters, presentation slides, and explainer videos in minutes.",
                "粘贴你的文本或描述一个主题。KnowLens 会在几分钟内将其转换为信息图海报、演示幻灯片和视频分镜。",
              )}
            </p>
            <div className="mt-5 flex w-full items-center justify-center sm:mt-6 lg:justify-start">
              <Link
                href="/auth?callbackUrl=%2Fapp"
                className="inline-flex h-12 min-w-[176px] items-center justify-center gap-2 rounded-xl bg-zinc-900 px-8 text-[15px] font-medium text-white transition hover:bg-zinc-700 sm:h-[52px]"
              >
                {t("Generate Free", "免费生成")}
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>

          <div className="w-full overflow-hidden rounded-lg lg:justify-self-end">
            <AspectSkeleton ratioClassName="aspect-square">
              <ProgressiveImage
                src={toOptimized(heroImage)}
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
              {t("From Text to Visual Learning Content", "从文本到可视化学习内容")}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-7 text-zinc-600">
              {t(
                "Start with a simple explanation and turn it into a clear visual draft.",
                "从一句简单解释开始，快速转成清晰的可视化草稿。",
              )}
            </p>

            <div className="mt-5">
              <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="mx-auto flex w-max min-w-full justify-center gap-2 px-1 sm:min-w-0 sm:px-0">
                {capabilityFlows.map((flow) => (
                  <button
                    key={flow.id}
                    type="button"
                    onClick={() => setActiveFlowId(flow.id)}
                    className={`shrink-0 rounded-lg border px-4 py-2 text-center text-xs leading-4 transition sm:px-5 sm:text-[12px] ${
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

        <section className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
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
              {t("HOW IT WORKS", "工作方式")}
            </p>
            <h2 className="mt-3 text-center text-[30px] font-semibold leading-tight tracking-tight text-zinc-950 sm:text-[40px]">
              {t("How KnowLens Turns Text into Visual Content", "KnowLens 如何将文本转成可视化内容")}
            </h2>
            <p className="mx-auto mt-3 max-w-3xl text-center text-sm leading-7 text-zinc-600">
              {t(
                "KnowLens reads your text, organizes the key ideas, and turns them into clear posters, slides, or explainer video drafts.",
                "KnowLens 会读取你的文本，整理关键观点，并生成清晰的海报、幻灯片或讲解视频草稿。",
              )}
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {principleModules.map((module, index) => (
                <article key={module.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
                  <p className="text-xs font-medium text-zinc-500">
                    {`0${index + 1}`}
                  </p>
                  <h3 className="mt-2 text-base font-semibold text-zinc-900">
                    {t(module.titleEn, module.titleZh)}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    {t(module.descEn, module.descZh)}
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {(t(module.notesEn.join("||"), module.notesZh.join("||")).split("||")).map((note) => (
                      <p key={note} className="text-sm leading-6 text-zinc-500">
                        {note}
                      </p>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-8 border-t border-zinc-200 pt-5">
              <p className="text-xs font-medium text-zinc-500">
                {t("Generation Flow", "生成流程")}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-stretch">
                {generationPipeline.map((step, index) => (
                  <div key={step.id} className="contents">
                    <article className="rounded-lg border border-zinc-200 bg-white px-3 py-3">
                      <h4 className="text-sm font-semibold text-zinc-900">{t(step.stepEn, step.stepZh)}</h4>
                      <p className="mt-1 text-sm leading-6 text-zinc-600">{t(step.detailEn, step.detailZh)}</p>
                    </article>
                    {index < generationPipeline.length - 1 ? (
                      <div className="hidden items-center justify-center text-zinc-400 sm:flex" aria-hidden="true">
                        <ArrowRight size={16} />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <p className="text-center text-xs font-medium tracking-[0.12em] text-zinc-500">
              {t("USER VOICES", "用户反馈")}
            </p>
            <h2 className="mt-3 text-center text-[30px] font-semibold leading-tight tracking-tight text-zinc-950 sm:text-[40px]">
              {t("What Users Say About KnowLens", "用户如何评价 KnowLens")}
            </h2>
            <p className="mx-auto mt-3 max-w-3xl text-center text-sm leading-7 text-zinc-600">
              {t(
                "Educators, students, creators, and teams use KnowLens to turn text and ideas into clearer visual content.",
                "教育者、学生、创作者与团队使用 KnowLens，把文本和想法转成更清晰的可视化内容。",
              )}
            </p>

            <div className="mt-7 grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
              {userVoices.map((item) => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.id}
                    className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-700">
                        <Icon size={16} />
                      </span>
                      <h3 className="text-[15px] font-semibold text-zinc-900 sm:text-base">{t(item.roleEn, item.roleZh)}</h3>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">“{t(item.quoteEn, item.quoteZh)}”</p>
                    <div className="mt-3 border-t border-zinc-200 pt-3 text-xs font-medium text-zinc-500">
                      {t(item.metaEn, item.metaZh)}
                    </div>
                  </article>
                );
              })}
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

        <section className="mx-auto w-full max-w-6xl px-4 pb-10 pt-3 sm:px-6 sm:pb-14">
          <div className="mx-auto max-w-5xl">
            <p className="text-center text-xs font-medium tracking-[0.12em] text-zinc-500">
              {t("FAQ", "常见问题")}
            </p>
            <h2 className="mt-3 text-center text-[28px] font-semibold leading-tight tracking-tight text-zinc-950 sm:text-[38px]">
              {t("Frequently Asked Questions", "常见问题")}
            </h2>
            <p className="mx-auto mt-3 max-w-3xl text-center text-sm leading-7 text-zinc-600">
              {t(
                "Everything you need to know before creating your first visual with KnowLens.",
                "在你用 KnowLens 创建第一个可视化内容前，先了解这些关键问题。",
              )}
            </p>

            <div className="mt-7 divide-y divide-zinc-200 border-y border-zinc-200">
              {landingFaqItems.map((item) => (
                <details key={item.id} className="group py-1">
                  <summary className="flex list-none items-center justify-between gap-3 py-3 text-left text-[15px] font-semibold leading-6 text-zinc-900 marker:content-none">
                    <span>{t(`Q: ${item.questionEn}`, `Q: ${item.questionZh}`)}</span>
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-zinc-500 transition group-open:rotate-45 group-open:text-zinc-800">
                      +
                    </span>
                  </summary>
                  <p className="pb-3 pr-9 text-sm leading-6 text-zinc-600">
                    {t(`A: ${item.answerEn}`, `A: ${item.answerZh}`)}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
    </MarketingChrome>
  );
}
