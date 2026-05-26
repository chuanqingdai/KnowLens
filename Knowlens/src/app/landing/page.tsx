"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { ArrowRight, BadgeCheck, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import { PromoCountdownBanner } from "@/components/billing/PromoCountdownBanner";

const heroImage = "/picture/hero picture.png";
const LANDING_ASSET_VERSION = "20260526b";
const ENABLE_IMAGE_DEBUG = process.env.NEXT_PUBLIC_DEBUG_IMAGE_LOAD === "true";

const previewWideCases = [
  {
    id: "w-1",
    titleEn: "Featured Visual Case 01",
    titleZh: "精选案例 01",
    cover: "/en-picture/c2b3c799-28c9-4267-a18e-fe3145449df7.png",
    keywordsEn: "knowledge visual, education, infographic, featured case",
    keywordsZh: "知识可视化, 教育, 信息图, 精选案例",
  },
  {
    id: "w-2",
    titleEn: "Featured Visual Case 02",
    titleZh: "精选案例 02",
    cover: "/en-picture/ce307920-892e-46eb-a193-fe228d4b9c31.png",
    keywordsEn: "knowledge visual, education, infographic, featured case",
    keywordsZh: "知识可视化, 教育, 信息图, 精选案例",
  },
  {
    id: "w-3",
    titleEn: "Featured Visual Case 03",
    titleZh: "精选案例 03",
    cover: "/en-picture/17e1c7f5-b04e-4e54-88af-787c79d1e8e3.png",
    keywordsEn: "knowledge visual, education, infographic, featured case",
    keywordsZh: "知识可视化, 教育, 信息图, 精选案例",
  },
  {
    id: "w-4",
    titleEn: "How Photosynthesis Works",
    titleZh: "光合作用如何运作",
    cover: "/en-picture/645ecabf-1b29-4d05-a377-1c886b5a2ae8.png",
    keywordsEn: "photosynthesis, plant, biology, science, infographic",
    keywordsZh: "光合作用, 植物, 生物, 科学, 信息图",
  },
  {
    id: "w-5",
    titleEn: "Why Inflation Changes Daily Life",
    titleZh: "为什么通胀会改变日常生活",
    cover: "/en-picture/a4e1d8cf-9ce8-4301-8eaf-c2a0981ef380.png",
    keywordsEn: "inflation, economy, daily life, finance, infographic",
    keywordsZh: "通胀, 经济, 日常生活, 金融, 信息图",
  },
  {
    id: "w-6",
    titleEn: "Plate Tectonics and Earthquakes",
    titleZh: "板块构造与地震",
    cover: "/en-picture/a93133f7-46f9-4da1-a488-375e9f909169.png",
    keywordsEn: "plate tectonics, earthquake, geology, earth science, infographic",
    keywordsZh: "板块构造, 地震, 地质, 地球科学, 信息图",
  },
  {
    id: "w-7",
    titleEn: "The Printing Press",
    titleZh: "印刷术",
    cover: "/en-picture/d561aaef-2126-479e-bef3-5726b925f88e.png",
    keywordsEn: "printing press, history, invention, education, infographic",
    keywordsZh: "印刷术, 历史, 发明, 教育, 信息图",
  },
];

const previewTallCases = [
  { id: "t-1", titleEn: "Astronomy Card", titleZh: "天文卡片", cover: "/en-picture/astronomy/f811316c-2452-4a84-8785-c6de347998d4.png" },
  { id: "t-2", titleEn: "Biology Card", titleZh: "生物卡片", cover: "/en-picture/biology/74380d3a-9a1b-44a2-998a-7c3482175ff4.png" },
  { id: "t-3", titleEn: "Economics Card", titleZh: "经济卡片", cover: "/en-picture/economics/3e26f31b-fb9c-4855-8a32-d14e060ea98c.png" },
  { id: "t-4", titleEn: "Geography Card", titleZh: "地理卡片", cover: "/en-picture/geography/8f861cf8-f326-4dcd-9c54-e1673f2caf13.png" },
  { id: "t-5", titleEn: "History Card", titleZh: "历史卡片", cover: "/en-picture/history/88e45522-e408-429c-b670-92c62faa47d9.png" },
  { id: "t-6", titleEn: "Medicine Card", titleZh: "医学卡片", cover: "/en-picture/mdeicine/15454ff0-b0e6-46b9-bc2a-787cb8ff2080.png" },
  { id: "t-7", titleEn: "Astronomy Long Visual", titleZh: "天文长图", cover: "/en-picture/astronomy/63f2d8b5-da95-4f3c-9e02-46a61519071d.png" },
  { id: "t-8", titleEn: "Biology Long Visual", titleZh: "生物长图", cover: "/en-picture/biology/c03468d1-6e9d-4808-9a69-2a3852412d0b.png" },
  { id: "t-9", titleEn: "Geography Long Visual", titleZh: "地理长图", cover: "/en-picture/geography/94a41a11-5983-4b03-924c-e1e47aa8d945.png" },
];

const principleModules = [
  {
    id: "understand",
    titleEn: "Semantic Understanding",
    titleZh: "语义理解层",
    descEn: "Parse source context, identify topic boundaries, and detect key intent before generation starts.",
    descZh: "在生成前解析上下文，识别主题边界与核心意图。",
    notesEn: [
      "Normalizes noisy source content from text, docs, URLs, and transcripts.",
      "Builds a domain-aware concept map before visual planning begins.",
    ],
    notesZh: [
      "统一处理文本、文档、链接与转写内容中的噪声信息。",
      "在视觉规划前先建立领域感知的概念关系图。",
    ],
  },
  {
    id: "structure",
    titleEn: "Structural Planning",
    titleZh: "结构规划层",
    descEn: "Convert intent into an explicit information architecture with hierarchy, pacing, and visual priority.",
    descZh: "将意图转换为显式信息架构，明确层次、节奏与视觉优先级。",
    notesEn: [
      "Maps content into reusable patterns such as causal flow, timeline, and comparison.",
      "Balances readability and density for poster, slide, and short-video contexts.",
    ],
    notesZh: [
      "将内容映射为因果流、时间线、对比图等可复用结构。",
      "针对海报、幻灯片和短视频平衡信息密度与可读性。",
    ],
  },
  {
    id: "compose",
    titleEn: "Multi-format Composition",
    titleZh: "多形态编排层",
    descEn: "Render poster, slides, and video drafts from one shared content backbone for consistent delivery.",
    descZh: "基于同一内容主干生成海报、PPT 与视频稿，保持跨形态一致性。",
    notesEn: [
      "Applies style grammar, typography rhythm, and layout constraints per output type.",
      "Keeps message consistency while adapting to different visual formats.",
    ],
    notesZh: [
      "按输出类型应用风格语法、文字节奏与版式约束。",
      "在不同视觉形态下保持核心信息表达一致。",
    ],
  },
];

const generationPipeline = [
  {
    id: "ingest",
    stepEn: "Ingest",
    stepZh: "输入接入",
    detailEn: "Text · Document · URL · Video/Podcast",
    detailZh: "文本 · 文档 · 链接 · 视频/播客",
    noteEn: "Unifies mixed sources into one structured draft input.",
    noteZh: "将混合来源统一为结构化草稿输入。",
  },
  {
    id: "reason",
    stepEn: "Reason",
    stepZh: "结构推理",
    detailEn: "Intent recognition · Outline · Content blocks",
    detailZh: "意图识别 · 大纲 · 内容块",
    noteEn: "Plans scope, sequencing, and visual emphasis before rendering.",
    noteZh: "在渲染前规划范围、顺序与视觉重点。",
  },
  {
    id: "deliver",
    stepEn: "Deliver",
    stepZh: "可视化交付",
    detailEn: "Poster · PPT · Video draft",
    detailZh: "海报 · PPT · 视频稿",
    noteEn: "Outputs editable results for publishing or downstream production.",
    noteZh: "输出可编辑成果，便于发布与后续制作。",
  },
];

const knowledgeDomains = [
  { en: "Economics", zh: "经济学" },
  { en: "Medicine", zh: "医学" },
  { en: "Geography", zh: "地理" },
  { en: "Biology", zh: "生物" },
  { en: "Physics", zh: "物理" },
  { en: "Technology", zh: "科技" },
];

const userVoices = [
  {
    id: "economics",
    nameEn: "Dr. Emily Carter",
    nameZh: "林博士",
    identityEn: "Economics Scholar",
    identityZh: "经济学学者",
    quoteEn:
      "I can turn inflation and macro-policy analysis into clean causal visuals that students understand in one glance.",
    quoteZh: "我可以把通胀与宏观政策分析转成清晰因果图，学生一眼就能理解核心逻辑。",
  },
  {
    id: "medicine",
    nameEn: "Ava Johnson",
    nameZh: "陈安薇",
    identityEn: "Medical Student",
    identityZh: "医学学生",
    quoteEn:
      "Pathways, organs, and treatment logic become structured poster notes, so revision is less fragmented and more memorable.",
    quoteZh: "通路、器官与治疗逻辑可以快速整理成结构化海报笔记，复习不再碎片化。",
  },
  {
    id: "middle-school",
    nameEn: "Noah Miller",
    nameZh: "王乐",
    identityEn: "Middle School Student",
    identityZh: "中学生",
    quoteEn:
      "Hard science topics become visual stories with clear steps, so I finally know what to focus on first.",
    quoteZh: "难懂的科学知识变成有步骤的可视化故事，我能更快抓住重点。",
  },
  {
    id: "youtube-creator",
    nameEn: "Mia Thompson",
    nameZh: "周米娅",
    identityEn: "YouTube Science Creator",
    identityZh: "YouTube 科普作者",
    quoteEn:
      "From one source script, I get storyboard-ready visuals and concise narration blocks that reduce production time a lot.",
    quoteZh: "同一份脚本可以同时产出分镜视觉和旁白要点，视频制作周期缩短很多。",
  },
  {
    id: "high-school-teacher",
    nameEn: "Mr. Daniel Brooks",
    nameZh: "赵老师",
    identityEn: "High School Teacher",
    identityZh: "高中老师",
    quoteEn:
      "I can convert textbook chapters into visual slide sequences, so students stay focused and discussion quality improves.",
    quoteZh: "我能把教材章节转成可视化分页讲解，学生更专注，课堂讨论质量也更高。",
  },
  {
    id: "product-manager",
    nameEn: "Olivia Harris",
    nameZh: "刘伊然",
    identityEn: "Product Manager",
    identityZh: "产品经理",
    quoteEn:
      "Complex strategy and market insights become understandable visual narratives that design, engineering, and ops can align on quickly.",
    quoteZh: "复杂策略和市场洞察能快速变成可理解的视觉叙事，设计、研发、运营更容易达成共识。",
  },
  {
    id: "training-specialist",
    nameEn: "Nora Bennett",
    nameZh: "孙诺拉",
    identityEn: "Corporate Trainer",
    identityZh: "企业培训负责人",
    quoteEn:
      "Policy documents and process manuals are easier to digest when transformed into visual training assets.",
    quoteZh: "制度文档和流程手册转成可视化培训素材后，理解门槛明显降低。",
  },
  {
    id: "independent-creator",
    nameEn: "Ethan Walker",
    nameZh: "金诺亚",
    identityEn: "Independent Creator",
    identityZh: "独立创作者",
    quoteEn:
      "I can turn one research source into poster, PPT, and video drafts with consistent style and message.",
    quoteZh: "一份研究素材可以同步产出海报、PPT 和视频草稿，风格和信息保持一致。",
  },
];

const capabilityFlows = [
  {
    id: "text-to-poster",
    tabEn: "Text → Poster",
    tabZh: "文本 → 海报",
    previewImage: "/picture/text-to-poster.png",
    inputEn: "Topic / Text prompt",
    inputZh: "主题 / 文本需求",
    outputEn: "Visual poster",
    outputZh: "信息可视化海报",
    noteEn: "Turn a raw idea into a concise poster with clear key points and visual hierarchy.",
    noteZh: "把一句主题快速转成重点清晰、结构明确的可视化海报。",
    cases: [
      { titleEn: "Inflation in Daily Life", titleZh: "通货膨胀影响生活", cover: "/picture/989f14bd-ff95-4298-a091-57a54ac5332f.png" },
      { titleEn: "Immune Mechanism", titleZh: "免疫机制全景图", cover: "/picture/e32aee6b-1845-409c-b91a-d7667e2f4381.png" },
    ],
  },
  {
    id: "text-to-ppt",
    tabEn: "Text → PPT",
    tabZh: "文本 → PPT",
    previewImage: "/picture/text-to-ppt.png",
    inputEn: "Topic / Script draft",
    inputZh: "主题 / 讲解文案",
    outputEn: "Structured PPT",
    outputZh: "结构化教学PPT",
    noteEn: "Expand text into a multi-page presentation with slide-by-slide narrative flow.",
    noteZh: "把文案扩展为分页演示内容，形成完整的讲解节奏。",
    cases: [
      { titleEn: "Volcano Eruption Process", titleZh: "火山喷发过程", cover: "/picture/39f7e57c-2e46-4e53-8ba6-756b22ef6437.png" },
      { titleEn: "Electrolysis Classroom", titleZh: "电解反应课堂版", cover: "/picture/fb1ec712-8275-4b22-989b-756e17684fbe.png" },
    ],
  },
  {
    id: "web-to-poster",
    tabEn: "Web → Poster",
    tabZh: "网页链接 → 海报",
    previewImage: "/picture/web-to-poster.png",
    inputEn: "Webpage URL",
    inputZh: "网页链接",
    outputEn: "Visual poster",
    outputZh: "信息可视化海报",
    noteEn: "Extract key points from long articles and convert them into a concise visual poster.",
    noteZh: "从长文中提炼核心观点，生成可直接传播的信息海报。",
    cases: [
      { titleEn: "Inflation in Daily Life", titleZh: "通货膨胀影响生活", cover: "/picture/989f14bd-ff95-4298-a091-57a54ac5332f.png" },
      { titleEn: "Ocean Circulation Basics", titleZh: "洋流循环与气候", cover: "/picture/8755ea1a-c5cc-4644-a505-553ec5905d71.png" },
    ],
  },
  {
    id: "doc-to-ppt",
    tabEn: "Doc → PPT",
    tabZh: "文档资料 → PPT",
    previewImage: "/picture/doc-to-ppt.png",
    inputEn: "PDF / PPT / Docs",
    inputZh: "PDF / PPT / 文档",
    outputEn: "Structured PPT",
    outputZh: "结构化教学PPT",
    noteEn: "Turn fragmented materials into coherent slides with clear narrative progression.",
    noteZh: "把零散资料整合成有叙事主线的完整演示文稿。",
    cases: [
      { titleEn: "Volcano Eruption Process", titleZh: "火山喷发过程", cover: "/picture/39f7e57c-2e46-4e53-8ba6-756b22ef6437.png" },
      { titleEn: "Electrolysis Classroom", titleZh: "电解反应课堂版", cover: "/picture/fb1ec712-8275-4b22-989b-756e17684fbe.png" },
    ],
  },
  {
    id: "video-to-video",
    tabEn: "Video → Video",
    tabZh: "视频 → 视频",
    previewImage: "/picture/video-to-video.png",
    inputEn: "Video",
    inputZh: "视频",
    outputEn: "Edited short video",
    outputZh: "可编辑短视频",
    noteEn: "Extract transcript and highlights, then generate a reusable video draft pipeline.",
    noteZh: "提取字幕和关键片段，生成可继续编辑与合成的视频稿件。",
    cases: [
      { titleEn: "Black Hole Video Draft", titleZh: "黑洞视频稿", cover: "/picture/eab2accf-e36a-45a2-89bb-0faa73e518e6.png" },
      { titleEn: "DNA Video Script", titleZh: "DNA视频脚本", cover: "/picture/c24ee34d-8ee2-498a-b95d-c17d30640f2a.png" },
    ],
  },
  {
    id: "podcast-to-video",
    tabEn: "Podcast → Video",
    tabZh: "播客 → 视频",
    previewImage: "/picture/podcast-to-video.png",
    inputEn: "Podcast Audio",
    inputZh: "播客音频",
    outputEn: "Narrated video draft",
    outputZh: "旁白视频草稿",
    noteEn: "Turn spoken episodes into structured video scenes with concise narration flow.",
    noteZh: "将播客口播内容转成结构化视频分镜与简洁旁白流程。",
    cases: [
      { titleEn: "Ocean Podcast Storyboard", titleZh: "洋流播客分镜稿", cover: "/picture/8755ea1a-c5cc-4644-a505-553ec5905d71.png" },
      { titleEn: "Deep Sea Episode Visuals", titleZh: "深海播客可视化", cover: "/picture/feb2b176-157f-44f9-ac52-5a271e25ed6e.png" },
    ],
  },
  {
    id: "video-to-poster",
    tabEn: "Video → Poster",
    tabZh: "视频 → 海报",
    previewImage: "/picture/video-to-poster.png",
    inputEn: "Video",
    inputZh: "视频",
    outputEn: "Visual poster",
    outputZh: "信息可视化海报",
    noteEn: "Extract key moments from video and compress them into a concise visual poster.",
    noteZh: "提取视频核心片段与结论，压缩为重点明确的可视化海报。",
    cases: [
      { titleEn: "Black Hole Key Takeaways", titleZh: "黑洞视频要点海报", cover: "/picture/eab2accf-e36a-45a2-89bb-0faa73e518e6.png" },
      { titleEn: "Blue Light Health Summary", titleZh: "蓝光伤眼总结海报", cover: "/picture/9cfe9227-c75b-40d0-a459-8d85064a1e55.png" },
    ],
  },
];

const DEFAULT_CAPABILITY_FLOW_ID = "text-to-poster";

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
      "6 credits/output during promo, up to ~1,250 outputs/month.",
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
          className={`absolute inset-0 z-[2] ${failed ? "bg-zinc-200" : "animate-pulse bg-zinc-200/80"} ${skeletonClassName}`}
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
        className={`${className} transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
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
      <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.85),rgba(229,231,235,0.55),rgba(255,255,255,0.7))] opacity-90" />
      <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent)] animate-[pulse_1.6s_ease-in-out_infinite]" />
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
  const activeFlow =
    capabilityFlows.find((flow) => flow.id === activeFlowId) ??
    capabilityFlows.find((flow) => flow.id === DEFAULT_CAPABILITY_FLOW_ID) ??
    capabilityFlows[0];

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

        <section className="mx-auto grid w-full max-w-6xl gap-5 px-4 pb-4 pt-6 sm:gap-8 sm:px-6 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center lg:gap-10 lg:pt-14">
          <div className="max-w-[560px]">
            <div className="inline-flex items-center rounded-full border border-zinc-300 bg-white px-3 py-1 text-[11px] text-zinc-600">
              {t("From Source Content to Visual Delivery", "从源内容到可视化交付")}
            </div>
            <h2 className="mt-4 text-[30px] font-semibold leading-tight tracking-tight text-zinc-950 sm:text-[46px]">
              {locale === "en" ? (
                <>
                  Turn Knowledge
                  <br />
                  into Visual Content
                </>
              ) : (
                <>
                  将知识转化为
                  <br />
                  可视化内容
                </>
              )}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-600 sm:mt-4 sm:text-base">
              {t(
                "Transform articles, documents, videos, and podcasts into shareable posters, presentation-ready slides, and editable content drafts — in minutes.",
                "将文章、文档、视频和播客在几分钟内转化为可分享海报、可直接演示的幻灯片和可编辑内容草稿。",
              )}
            </p>
            <div className="mt-5 flex items-center sm:mt-6">
              <Link
                href="/auth?callbackUrl=%2Fapp"
                className="inline-flex h-12 min-w-[176px] items-center justify-center gap-2 rounded-xl bg-zinc-900 px-8 text-[15px] font-medium text-white transition hover:bg-zinc-700 sm:h-[52px]"
              >
                {t("Start now", "开始使用")}
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>

          <div className="w-full rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-sm sm:p-2 lg:justify-self-end">
            <div className="overflow-hidden rounded-xl bg-zinc-100">
              <AspectSkeleton ratioClassName="aspect-square">
                <ProgressiveImage
                  src={toOptimized(heroImage)}
                  fallbackSrc={toOriginal(heroImage)}
                  alt="KnowLens Hero"
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="eager"
                  fetchPriority="high"
                />
              </AspectSkeleton>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <h2 className="mt-2 text-center text-[30px] font-semibold leading-tight tracking-tight text-zinc-950 sm:text-[42px]">
              {t("Convert source content directly into deliverables", "把源内容直接转换为可交付成果")}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-7 text-zinc-600">
              {t(
                "Pick one workflow and preview real examples before you start creating.",
                "选择一个生成链路，并先查看对应真实案例。",
              )}
            </p>

            <div className="mt-5">
              <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
                <div className="inline-flex min-w-full gap-2 sm:grid sm:w-full sm:max-w-6xl sm:grid-cols-3 lg:grid-cols-7">
                {capabilityFlows.map((flow) => (
                  <button
                    key={flow.id}
                    type="button"
                    onClick={() => setActiveFlowId(flow.id)}
                    className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-center text-[10px] leading-4 transition sm:shrink sm:px-2 lg:whitespace-nowrap ${
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
              <article className="rounded-2xl border border-zinc-200 bg-white p-2.5 shadow-sm">
                <div className="relative overflow-hidden rounded-xl bg-zinc-100">
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
                    className="w-[250px] shrink-0 rounded-2xl border border-zinc-200 bg-white p-2 sm:w-[280px] lg:w-[300px]"
                  >
                    <div className="aspect-video overflow-hidden rounded-xl bg-zinc-100">
                      <ProgressiveImage
                        src={toOptimized(item.cover)}
                        fallbackSrc={toOriginal(item.cover)}
                        alt={t(item.titleEn, item.titleZh)}
                        title={t(item.titleEn, item.titleZh)}
                        className="h-full w-full object-cover"
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
                    className="w-[150px] shrink-0 rounded-2xl border border-zinc-200 bg-white p-2 sm:w-[170px] lg:w-[180px]"
                  >
                    <div className="aspect-[9/16] overflow-hidden rounded-xl bg-zinc-100">
                      <ProgressiveImage
                        src={toOptimized(item.cover)}
                        fallbackSrc={toOriginal(item.cover)}
                        alt={t(item.titleEn, item.titleZh)}
                        title={t(item.titleEn, item.titleZh)}
                        className="h-full w-full object-cover"
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
              {t("PRODUCT PRINCIPLES", "产品原理")}
            </p>
            <h2 className="mt-3 text-center text-[30px] font-semibold leading-tight tracking-tight text-zinc-950 sm:text-[40px]">
              {t("Built on an AI-Native Visual Intelligence Engine", "基于 AI 原生视觉智能引擎")}
            </h2>
            <p className="mx-auto mt-3 max-w-3xl text-center text-sm leading-7 text-zinc-600">
              {t(
                "A structured AI system that turns source knowledge into controllable, delivery-ready visual content.",
                "结构化 AI 引擎，将源知识转换为可控、可交付的可视化内容。",
              )}
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {knowledgeDomains.map((domain) => (
                <span key={domain.en} className="rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] text-zinc-600">
                  {t(domain.en, domain.zh)}
                </span>
              ))}
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {principleModules.map((module, index) => (
                <article key={module.id} className="border-t border-zinc-300 pt-4">
                  <p className="text-xs font-medium text-zinc-500">
                    {`0${index + 1}`}
                  </p>
                  <h3 className="mt-2 text-base font-semibold text-zinc-900">
                    {t(module.titleEn, module.titleZh)}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-zinc-600">
                    {t(module.descEn, module.descZh)}
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {(t(module.notesEn.join("||"), module.notesZh.join("||")).split("||")).map((note) => (
                      <p key={note} className="text-sm leading-7 text-zinc-600">
                        {note}
                      </p>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-8 border-t border-zinc-200 pt-5">
              <p className="text-xs font-medium text-zinc-500">
                {t("Generation Pipeline", "生成流程")}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {generationPipeline.map((step) => (
                  <article key={step.id} className="border-l border-zinc-300 pl-3 py-1">
                    <h4 className="text-sm font-semibold text-zinc-900">
                      {t(step.stepEn, step.stepZh)}
                    </h4>
                    <p className="mt-1 text-xs leading-6 text-zinc-600">
                      {t(step.detailEn, step.detailZh)}
                    </p>
                    <p className="mt-1 text-xs leading-6 text-zinc-500">
                      {t(step.noteEn, step.noteZh)}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <p className="text-center text-xs font-medium tracking-[0.12em] text-zinc-500">
              {t("USER VOICES", "用户评价")}
            </p>
            <h2 className="mt-3 text-center text-[30px] font-semibold leading-tight tracking-tight text-zinc-950 sm:text-[40px]">
              {t("How Users Create with KnowLens", "用户如何用 KnowLens 创作")}
            </h2>
            <p className="mx-auto mt-3 max-w-3xl text-center text-sm leading-7 text-zinc-600">
              {t(
                "From scholars to students to creators, KnowLens helps people convert dense knowledge into visuals they can explain, remember, and publish.",
                "从学者、学生到内容创作者，KnowLens 帮助用户把复杂知识转成可讲解、可记忆、可发布的可视化内容。",
              )}
            </p>

            <div className="mt-7 grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
              {userVoices.map((voice) => (
                <article key={voice.id} className="rounded-xl border border-zinc-200 bg-white/90 p-3.5 sm:p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-[15px] font-semibold text-zinc-900 sm:text-base">{t(voice.nameEn, voice.nameZh)}</h3>
                    <span className="text-[11px] text-zinc-500 sm:text-xs">
                      {t(voice.identityEn, voice.identityZh)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-zinc-700">{t(voice.quoteEn, voice.quoteZh)}</p>
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

                  <Link
                    href="/membership"
                    className={`mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition ${
                      plan.highlight
                        ? "bg-zinc-900 text-white hover:bg-zinc-700"
                        : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100"
                    }`}
                  >
                    {t(plan.ctaEn, plan.ctaZh)}
                  </Link>

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
    </MarketingChrome>
  );
}
