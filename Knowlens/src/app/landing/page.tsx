"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

const heroImage = "/picture/knowlens-hero.png";

const previewWideCases = [
  { id: "w-1", titleEn: "Volcano Eruption Mechanism", titleZh: "火山喷发机制", cover: "/picture/39f7e57c-2e46-4e53-8ba6-756b22ef6437.png" },
  { id: "w-2", titleEn: "Black Hole Visual Explainer", titleZh: "黑洞可视化讲解", cover: "/picture/eab2accf-e36a-45a2-89bb-0faa73e518e6.png" },
  { id: "w-3", titleEn: "Electrolysis Classroom", titleZh: "电解反应课堂版", cover: "/picture/fb1ec712-8275-4b22-989b-756e17684fbe.png" },
  { id: "w-4", titleEn: "Inflation Causal Flow", titleZh: "通货膨胀因果流图", cover: "/picture/989f14bd-ff95-4298-a091-57a54ac5332f.png" },
  { id: "w-5", titleEn: "Blue Light Science", titleZh: "蓝光伤眼机制", cover: "/picture/9cfe9227-c75b-40d0-a459-8d85064a1e55.png" },
  { id: "w-6", titleEn: "Cellular Process Map", titleZh: "细胞过程图解", cover: "/picture/176e6527-21ef-4528-a0fc-91c879a00b4c.png" },
];

const previewTallCases = [
  { id: "t-1", titleEn: "Ocean Circulation & Climate", titleZh: "洋流循环与气候", cover: "/picture/8755ea1a-c5cc-4644-a505-553ec5905d71.png" },
  { id: "t-2", titleEn: "Deep Sea Knowledge Card", titleZh: "深海科普卡片", cover: "/picture/feb2b176-157f-44f9-ac52-5a271e25ed6e.png" },
  { id: "t-3", titleEn: "DNA Replication Flow", titleZh: "DNA复制流程", cover: "/picture/c24ee34d-8ee2-498a-b95d-c17d30640f2a.png" },
  { id: "t-4", titleEn: "Immune Mechanism", titleZh: "免疫机制", cover: "/picture/e32aee6b-1845-409c-b91a-d7667e2f4381.png" },
  { id: "t-5", titleEn: "Clean Science Infographic", titleZh: "简洁科普信息图风", cover: "/style/clean-science-infographic.png" },
  { id: "t-6", titleEn: "Premium Editorial Style", titleZh: "高级报告信息图风", cover: "/style/premium-editorial-infographic.png" },
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
    nameEn: "Starter",
    nameZh: "基础版",
    periodEn: "Monthly",
    periodZh: "包月",
    price: "¥39",
    descEn: "Great for light daily creation and trial use",
    descZh: "适合日常轻量创作与试用",
    pointsEn: "2,000 credits / month",
    pointsZh: "每月 2,000 积分",
    featuresEn: ["Poster/PPT/video basic generation", "8 style templates", "Basic export options"],
    featuresZh: ["海报/PPT/视频基础生成", "8 种风格模板", "基础导出能力"],
    ctaEn: "Choose Starter",
    ctaZh: "选择基础版",
    highlight: false,
  },
  {
    nameEn: "Pro",
    nameZh: "专业版",
    periodEn: "Monthly",
    periodZh: "包月",
    price: "¥99",
    descEn: "Recommended for active creators",
    descZh: "内容创作者常用，推荐",
    pointsEn: "8,000 credits / month",
    pointsZh: "每月 8,000 积分",
    featuresEn: ["All 12 style presets", "Priority queue and faster generation", "High-resolution export and batch generation"],
    featuresZh: ["全部 12 种风格", "优先队列与更快生成", "高分辨率导出与批量生成"],
    ctaEn: "Start Pro",
    ctaZh: "开通专业版",
    highlight: true,
  },
  {
    nameEn: "Team",
    nameZh: "团队版",
    periodEn: "Yearly (30% off)",
    periodZh: "包年（7 折）",
    price: "¥699",
    descEn: "For collaboration and high-frequency output",
    descZh: "多人协作与高频产出",
    pointsEn: "120,000 credits / year",
    pointsZh: "每年 120,000 积分",
    featuresEn: ["Team member management", "Project templates and review flow", "Priority support and growth guidance"],
    featuresZh: ["团队成员管理", "项目模板与审核流", "会员优先支持与成长咨询"],
    ctaEn: "Contact Sales",
    ctaZh: "咨询团队方案",
    highlight: false,
  },
];

type ProgressiveImageProps = {
  src: string;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
  skeletonClassName?: string;
};

function ProgressiveImage({
  src,
  alt,
  className = "",
  loading = "lazy",
  skeletonClassName = "",
}: ProgressiveImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative h-full w-full">
      {!loaded ? (
        <div
          className={`absolute inset-0 ${failed ? "bg-zinc-200" : "animate-pulse bg-zinc-200/80"} ${skeletonClassName}`}
          aria-hidden="true"
        />
      ) : null}
      <img
        src={src}
        alt={alt}
        loading={loading}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => {
          setFailed(true);
          setLoaded(false);
        }}
        className={`${className} transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

export default function LandingPage() {
  const { t, locale } = useLocale();
  const previewWideLoop = [...previewWideCases, ...previewWideCases];
  const previewTallLoop = [...previewTallCases, ...previewTallCases];
  const [activeFlowId, setActiveFlowId] = useState(DEFAULT_CAPABILITY_FLOW_ID);
  const activeFlow =
    capabilityFlows.find((flow) => flow.id === activeFlowId) ??
    capabilityFlows.find((flow) => flow.id === DEFAULT_CAPABILITY_FLOW_ID) ??
    capabilityFlows[0];
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
    <MarketingChrome showLocaleSwitch>
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
                  Start Creating Visual
                  <br />
                  Knowledge with AI
                </>
              ) : (
                <>
                  开始使用 AI
                  <br />
                  创作知识可视化内容
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
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-700"
              >
                {t("Start now", "开始使用")}
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          <div className="w-full rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-sm sm:p-2 lg:justify-self-end">
            <div className="overflow-hidden rounded-xl bg-zinc-100">
              <ProgressiveImage
                src={heroImage}
                alt="KnowLens Hero"
                className="h-auto w-full object-contain"
                loading="eager"
              />
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
                  <ProgressiveImage
                    key={activeFlow.previewImage}
                    src={activeFlow.previewImage}
                    alt={t(`${activeFlow.tabEn} visual example`, `${activeFlow.tabZh} 案例示意`)}
                    className="block h-auto w-full object-contain"
                    loading="lazy"
                    skeletonClassName="bg-zinc-200"
                  />
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
                        src={item.cover}
                        alt={t(item.titleEn, item.titleZh)}
                        className="h-full w-full object-cover"
                        loading="lazy"
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
                        src={item.cover}
                        alt={t(item.titleEn, item.titleZh)}
                        className="h-full w-full object-cover"
                        loading="lazy"
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
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-zinc-500">{t("Membership & Billing", "会员支付")}</p>
                <h2 className="mt-1 text-xl font-semibold text-zinc-950 sm:text-2xl">
                  {t("Pick the plan that fits your workflow", "选择适合你的创作计划")}
                </h2>
                <p className="mt-2 text-sm text-zinc-600">
                  {t(
                    "Supports monthly/yearly subscriptions and Stripe checkout, with better annual value.",
                    "支持月付/年付与 Stripe 支付，年付方案默认享受更高折扣。",
                  )}
                </p>
              </div>
              <Link
                href="/membership"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
              >
                {t("Go to billing", "前往支付中心")}
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              {planCards.map((plan) => (
                <article
                  key={plan.nameEn}
                  className={`rounded-2xl border p-4 ${
                    plan.highlight ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-zinc-50 text-zinc-900"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-semibold">{t(plan.nameEn, plan.nameZh)}</h3>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] ${
                        plan.highlight ? "bg-white/20 text-white" : "bg-zinc-200 text-zinc-700"
                      }`}
                    >
                      {t(plan.periodEn, plan.periodZh)}
                    </span>
                  </div>
                  <p className={`mt-2 text-2xl font-semibold ${plan.highlight ? "text-white" : "text-zinc-950"}`}>{plan.price}</p>
                  <p className={`mt-1 text-xs ${plan.highlight ? "text-zinc-200" : "text-zinc-500"}`}>{t(plan.descEn, plan.descZh)}</p>
                  <p className={`mt-3 text-sm font-medium ${plan.highlight ? "text-white" : "text-zinc-800"}`}>{t(plan.pointsEn, plan.pointsZh)}</p>
                  <ul className="mt-3 space-y-1.5">
                    {(t(plan.featuresEn.join("||"), plan.featuresZh.join("||")).split("||")).map((feature) => (
                      <li key={feature} className={`flex items-start gap-1.5 text-xs ${plan.highlight ? "text-zinc-100" : "text-zinc-600"}`}>
                        <Check size={12} className="mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/membership"
                    className={`mt-4 inline-flex h-9 w-full items-center justify-center rounded-lg text-xs font-medium transition ${
                      plan.highlight ? "bg-white text-zinc-900 hover:bg-zinc-100" : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                    }`}
                  >
                    {t(plan.ctaEn, plan.ctaZh)}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>
    </MarketingChrome>
  );
}
