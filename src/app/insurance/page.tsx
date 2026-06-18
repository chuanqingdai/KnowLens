import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Sparkles,
} from "lucide-react";
import {
  InsuranceTemplateGallery,
  type InsuranceTemplateCard,
} from "@/app/insurance/InsuranceTemplateGallery";
import { InsuranceScrollLink } from "@/app/insurance/InsuranceScrollLink";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import { dailyQuoteTemplates } from "@/lib/insurance-daily-templates";
import { festivalTemplates } from "@/lib/insurance-festival-templates";
import { solarTermTemplates } from "@/lib/insurance-solar-term-templates";

const siteOrigin = "https://knowlens.ai";
const pagePath = "/insurance";
const pageLink = `${siteOrigin}${pagePath}`;
const generatorHref = "/app?intent=generate";
const heroImageUrl = `${siteOrigin}/insurance/hero-insurance-poster-wide.webp`;

export const metadata: Metadata = {
  title: "保险模板中心 | 保险营销内容生成 | KnowLens.ai",
  description:
    "KnowLens 保险模板中心支持保险宣传图、产品说明、客户教育、理赔服务、续保提醒和代理人展业素材生成，支持套用模板并精确控制文案。",
  alternates: {
    canonical: pageLink,
  },
  openGraph: {
    type: "website",
    siteName: "KnowLens.ai",
    title: "保险模板中心 | KnowLens.ai",
    description:
      "为保险行业快速生成可复用营销模板，支持选择模板、自定义生成、制作同款和字段级文案控制。",
    url: pageLink,
    images: [
      {
        url: heroImageUrl,
        width: 1200,
        height: 675,
        alt: "KnowLens insurance template center",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "保险模板中心 | KnowLens.ai",
    description: "选择保险模板或自定义生成，快速制作可复用的保险营销视觉内容。",
    images: [heroImageUrl],
  },
};

function createSimilarHref(prompt: string) {
  return `${generatorHref}&prompt=${encodeURIComponent(prompt)}`;
}

const templates: InsuranceTemplateCard[] = [
  ...(dailyQuoteTemplates as InsuranceTemplateCard[]),
  ...(festivalTemplates as InsuranceTemplateCard[]),
  ...(solarTermTemplates as InsuranceTemplateCard[]),
  {
    title: "成人重疾险，给家庭多一份底气",
    category: "品宣",
    primaryCategory: "品宣",
    secondaryCategory: "成人重疾",
    description: "适合成人重疾险种草、家庭经济支柱保障沟通和朋友圈转发。",
    prompt: "基于品宣模板，生成一张中文成人重疾险海报。只显示输入文案，不显示字段名和分类词。",
    format: "9:16 海报",
    audience: "家庭经济支柱",
    fields: ["标题", "副标题", "核心要点", "辅助信息", "机构名称"],
    accent: "#e0f2fe",
    rows: ["覆盖多种重大疾病", "确诊符合条件可给付", "可用于康复和生活支出", "家庭责任不断档"],
    auxiliaryInfo: "保障责任以合同为准",
    illustration: "一家三口站在半透明蓝色盾牌前，柔和城市和家庭轮廓背景，表现家庭责任、健康守护、长期安心。",
    imageSrc: "/insurance/posters/pinxuan-01.png",
    aspectRatio: "9:16",
  },
  {
    title: "孩子成长路上，健康保障先准备",
    category: "品宣",
    primaryCategory: "品宣",
    secondaryCategory: "少儿重疾",
    description: "适合少儿重疾险讲解、亲子家庭保障沟通和客户初次触达。",
    prompt: "基于品宣模板，生成一张中文少儿重疾险海报。只显示输入文案，不显示字段名和分类词。",
    format: "9:16 海报",
    audience: "少儿家庭",
    fields: ["标题", "副标题", "核心要点", "辅助信息", "机构名称"],
    accent: "#dbeafe",
    rows: ["关注少儿高发疾病", "符合条件可一次给付", "可补充康复费用", "陪伴治疗更从容"],
    auxiliaryInfo: "具体病种和责任以合同为准",
    illustration: "孩子背着书包走向阳光草地，父母在身后守护，旁边有柔和医疗十字和盾牌元素。",
    imageSrc: "/insurance/posters/pinxuan-02.png",
    aspectRatio: "9:16",
  },
  {
    title: "大额医疗支出，提前做好准备",
    category: "品宣",
    primaryCategory: "品宣",
    secondaryCategory: "百万医疗",
    description: "适合百万医疗险科普、住院费用风险提示和社群客户教育。",
    prompt: "基于品宣模板，生成一张中文百万医疗险海报。只显示输入文案，不显示字段名和分类词。",
    format: "9:16 海报",
    audience: "医疗险客户",
    fields: ["标题", "副标题", "核心要点", "辅助信息", "机构名称"],
    accent: "#dcfce7",
    rows: ["关注住院医疗费用", "可补充社保外支出", "报销规则看清楚", "免赔额需提前了解"],
    auxiliaryInfo: "报销范围以合同约定为准",
    illustration: "医院楼体、病历单、医保卡和保护伞组合成清晰医疗保障场景。",
    imageSrc: "/insurance/posters/pinxuan-03.png",
    aspectRatio: "9:16",
  },
  {
    title: "日常小意外，也要有保障",
    category: "品宣",
    primaryCategory: "品宣",
    secondaryCategory: "意外险",
    description: "适合意外险种草、通勤出行提醒和日常生活风险教育。",
    prompt: "基于品宣模板，生成一张中文意外险海报。只显示输入文案，不显示字段名和分类词。",
    format: "9:16 海报",
    audience: "基础保障客户",
    fields: ["标题", "副标题", "核心要点", "辅助信息", "机构名称"],
    accent: "#ffedd5",
    rows: ["覆盖常见意外风险", "关注意外医疗责任", "出行通勤都可配置", "保费轻、保障实用"],
    auxiliaryInfo: "责任范围以合同为准",
    illustration: "通勤路口、骑行、楼梯、运动等生活场景，用安全橙色保护圈连接起来。",
    imageSrc: "/insurance/posters/pinxuan-04.png",
    aspectRatio: "9:16",
  },
  {
    title: "爱与责任，需要一份长期安排",
    category: "品宣",
    primaryCategory: "品宣",
    secondaryCategory: "寿险",
    description: "适合寿险责任说明、家庭责任人沟通和长期保障规划引导。",
    prompt: "基于品宣模板，生成一张中文寿险海报。只显示输入文案，不显示字段名和分类词。",
    format: "9:16 海报",
    audience: "家庭责任人",
    fields: ["标题", "副标题", "核心要点", "辅助信息", "机构名称"],
    accent: "#fef3c7",
    rows: ["覆盖身故或全残责任", "适合家庭经济支柱", "可覆盖房贷与子女教育责任", "让家人生活不断档"],
    auxiliaryInfo: "投保条件以核保结果为准",
    illustration: "一家人站在房子前，父母牵着孩子，背景有房屋、教育、生活账单的轻量图标。",
    imageSrc: "/insurance/posters/pinxuan-05.png",
    aspectRatio: "9:16",
  },
  {
    title: "给未来养老，提前做一份安排",
    category: "品宣",
    primaryCategory: "品宣",
    secondaryCategory: "养老年金",
    description: "适合养老年金说明、退休现金流规划和长期储备意识唤起。",
    prompt: "基于品宣模板，生成一张中文养老年金海报。只显示输入文案，不显示字段名和分类词。",
    format: "9:16 海报",
    audience: "养老规划客户",
    fields: ["标题", "副标题", "核心要点", "辅助信息", "机构名称"],
    accent: "#fed7aa",
    rows: ["提前规划退休现金流", "领取安排更清晰", "适合长期稳健准备", "让养老生活更安心"],
    auxiliaryInfo: "领取规则以合同为准",
    illustration: "中年夫妻在阳台看向远方，旁边有时间轴、日历、存折和养老金账户图形。",
    imageSrc: "/insurance/posters/pinxuan-06.png",
    aspectRatio: "9:16",
  },
  {
    title: "孩子的教育规划，从现在开始",
    category: "品宣",
    primaryCategory: "品宣",
    secondaryCategory: "教育金",
    description: "适合教育金规划、孩子成长节点沟通和亲子家庭资金准备。",
    prompt: "基于品宣模板，生成一张中文教育金海报。只显示输入文案，不显示字段名和分类词。",
    format: "9:16 海报",
    audience: "亲子家庭",
    fields: ["标题", "副标题", "核心要点", "辅助信息", "机构名称"],
    accent: "#fce7f3",
    rows: ["提前准备教育费用", "专款规划更清晰", "陪伴孩子关键阶段", "给未来更多选择"],
    auxiliaryInfo: "领取安排以合同约定为准",
    illustration: "孩子在书桌前学习，窗外有校园、书本、成长阶梯和星星元素。",
    imageSrc: "/insurance/posters/pinxuan-07.png",
    aspectRatio: "9:16",
  },
  {
    title: "健康告知，要如实填写",
    category: "品宣",
    primaryCategory: "品宣",
    secondaryCategory: "健康告知",
    description: "适合投保前提醒、健康告知答疑和如实填写合规教育。",
    prompt: "基于品宣模板，生成一张中文健康告知海报。只显示输入文案，不显示字段名和分类词。",
    format: "9:16 海报",
    audience: "投保客户",
    fields: ["标题", "副标题", "核心要点", "辅助信息", "机构名称"],
    accent: "#e0f2fe",
    rows: ["看清每一项询问", "已知情况如实说明", "不确定内容及时咨询", "避免影响后续理赔"],
    auxiliaryInfo: "核保结果以保险公司审核为准",
    illustration: "一份健康问卷被认真勾选，旁边有医生图标、听诊器、提示灯和审核印章。",
    imageSrc: "/insurance/posters/pinxuan-08.png",
    aspectRatio: "9:16",
  },
  {
    title: "保单也需要定期体检",
    category: "品宣",
    primaryCategory: "品宣",
    secondaryCategory: "保单年检",
    description: "适合老客户服务、保单年检提醒和年度保障复盘邀约。",
    prompt: "基于品宣模板，生成一张中文保单年检海报。只显示输入文案，不显示字段名和分类词。",
    format: "3:4 海报",
    audience: "老客户服务",
    fields: ["标题", "副标题", "核心要点", "辅助信息", "机构名称"],
    accent: "#dbeafe",
    rows: ["检查保障额度是否够", "核对受益人信息", "查看缴费状态", "更新家庭成员变化"],
    auxiliaryInfo: "建议每年做一次保单梳理",
    illustration: "一张保单体检报告，搭配放大镜、勾选清单、家庭头像和保障盾牌。",
    imageSrc: "/insurance/posters/pinxuan-09.png",
    aspectRatio: "3:4",
  },
  {
    title: "家庭保障配置，先抓重点",
    category: "品宣",
    primaryCategory: "品宣",
    secondaryCategory: "家庭配置",
    description: "适合家庭保障配置讲解、全家方案沟通和咨询前需求引导。",
    prompt: "基于品宣模板，生成一张中文家庭保障配置海报。只显示输入文案，不显示字段名和分类词。",
    format: "3:4 海报",
    audience: "家庭客户",
    fields: ["标题", "副标题", "核心要点", "辅助信息", "机构名称"],
    accent: "#e0f2fe",
    rows: ["先保障家庭经济支柱", "再完善孩子和老人保障", "医疗与重疾搭配考虑", "预算内逐步补齐"],
    auxiliaryInfo: "配置方案需结合家庭实际情况",
    illustration: "家庭成员站在不同保障层级上，周围有医疗、重疾、意外、寿险图标组成保护环。",
    imageSrc: "/insurance/posters/pinxuan-10.png",
    aspectRatio: "3:4",
  },
];

const valuePoints = [
  {
    title: "模板复用",
    description: "把常用保险场景沉淀成模板，代理人和运营团队可直接制作同款。",
  },
  {
    title: "文案可控",
    description: "标题、卖点、风险提示和机构信息都可以按字段控制。",
  },
  {
    title: "场景覆盖",
    description: "覆盖获客、转化、服务、续保、理赔、培训和消费者教育。",
  },
  {
    title: "中文优先",
    description: "先面向中文保险营销语境，表达专业、克制、便于客户理解。",
  },
];

const showcaseCategories = [
  "全部",
  "日签",
  "生日",
  "节日",
  "品宣",
  "节气",
  "活动",
  "产品",
  "健康",
  "保险",
  "28种重疾",
];

export default function InsurancePage() {
  return (
    <MarketingChrome showLocaleSwitch showExamplesLink={false} forceLocale="zh">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 sm:gap-12 sm:px-6 sm:py-10 lg:gap-12 lg:py-10">
        <section className="grid justify-items-center gap-8 py-8 text-center sm:py-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:justify-items-stretch lg:py-12 lg:text-left">
          <div className="flex max-w-3xl flex-col items-center lg:items-start">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-cyan-700 shadow-sm sm:mb-5 sm:px-4 sm:py-2 sm:text-xs">
              <Sparkles size={14} />
              保险模板中心
            </div>
            <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-zinc-950 sm:text-5xl sm:leading-tight">
              <span className="block">保险营销海报</span>
              <span className="block">一键制作同款</span>
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-zinc-600 sm:mt-5 sm:text-base sm:leading-7">
              面向保险宣传图、产品说明、客户教育、续保提醒和理赔服务，快速生成可复用的中文视觉内容。标题、卖点、风险提示和机构信息都能按字段精确控制。
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row">
              <InsuranceScrollLink
                className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-950 px-6 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800"
              >
                选择模板
                <ArrowRight size={16} className="ml-2" />
              </InsuranceScrollLink>
              <Link
                href={createSimilarHref("自定义生成一张中文保险营销视觉内容，请根据我的主题组织结构，保留标题、核心卖点、风险提示和机构信息。")}
                className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-300 bg-white px-6 text-sm font-medium text-zinc-900 shadow-sm transition hover:bg-zinc-100"
              >
                自定义
              </Link>
            </div>
          </div>

          <div className="relative aspect-[16/9] w-full max-w-2xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm sm:rounded-[2rem] lg:max-w-none">
            <Image
              src="/insurance/hero-insurance-poster-wide.webp"
              alt="保险文案生成海报示例"
              fill
              priority
              sizes="(min-width: 1024px) 610px, 100vw"
              className="object-contain"
            />
          </div>
        </section>

        <section id="templates" className="scroll-mt-20">
          <div className="mb-5 sm:mb-7">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">精选案例</h2>
          </div>
          <InsuranceTemplateGallery templates={templates} categories={showcaseCategories} />
        </section>

        <section>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">核心能力</h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              保险内容需要稳定、清晰、可复用。KnowLens 的重点是把模板结构和文案字段固定下来，让内容生成更可控。
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {valuePoints.map((point) => (
              <div key={point.title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-50 text-zinc-800">
                  <BadgeCheck size={18} />
                </div>
                <h3 className="mt-5 text-base font-semibold text-zinc-950">{point.title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-600">{point.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-zinc-950 p-6 text-center text-white shadow-sm sm:rounded-[2rem] sm:p-10">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-4xl">开始制作保险模板</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-300">
            从模板开始更快，也可以直接自定义主题。生成时保留可控字段，方便团队持续复用。
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <InsuranceScrollLink
              className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200"
            >
              选择模板
              <ArrowRight size={16} className="ml-2" />
            </InsuranceScrollLink>
            <Link
              href={createSimilarHref("自定义生成一张中文保险行业营销图。请根据主题自动选择适合结构，并保留文案字段、风险提示和机构信息。")}
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-6 text-sm font-medium text-white transition hover:bg-white/10"
            >
              自定义
            </Link>
          </div>
        </section>
      </div>
    </MarketingChrome>
  );
}
