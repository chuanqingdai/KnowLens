import type { Metadata } from "next";
import { InsurancePageClient } from "@/app/insurance/InsurancePageClient";
import type { InsuranceTemplateCard } from "@/app/insurance/InsuranceTemplateGallery";
import { availableInsuranceTemplateImages } from "@/lib/insurance-available-template-images";
import { activityTemplates } from "@/lib/insurance-activity-templates";
import { criticalIllnessTemplates } from "@/lib/insurance-critical-illness-templates";
import { dailyQuoteTemplates } from "@/lib/insurance-daily-templates";
import { festivalTemplates } from "@/lib/insurance-festival-templates";
import { gaoding067InsuranceTemplates } from "@/lib/insurance-gaoding-067-templates";
import { gaoding068InsuranceTemplates } from "@/lib/insurance-gaoding-068-templates";
import { gaodingExtractedInsuranceTemplates } from "@/lib/insurance-gaoding-extracted-templates";
import { gaodingFinanceInsuranceTemplates } from "@/lib/insurance-gaoding-finance-templates";
import { gaodingKepuInsuranceTemplates } from "@/lib/insurance-gaoding-kepu-templates";
import { gaodingPensionInsuranceTemplates } from "@/lib/insurance-gaoding-pension-templates";
import { businessInsuranceTemplates } from "@/lib/insurance-business-templates";
import { femaleFirstwaveTemplates } from "@/lib/insurance-female-firstwave-templates";
import { femaleNextwaveTemplates } from "@/lib/insurance-female-nextwave-templates";
import { hongKongInsuranceTemplates } from "@/lib/insurance-hongkong-templates";
import { liabilityProductTemplates } from "@/lib/insurance-liability-product-templates";
import { marketingInsuranceTemplates } from "@/lib/insurance-marketing-templates";
import { medicalReminderTemplates } from "@/lib/insurance-medical-reminder-templates";
import { productMarketingTemplates } from "@/lib/insurance-product-marketing-templates";
import { productScienceTemplates } from "@/lib/insurance-product-science-templates";
import { productTemplates } from "@/lib/insurance-product-templates";
import { solarTermTemplates } from "@/lib/insurance-solar-term-templates";
import { wealthProductTemplates } from "@/lib/insurance-wealth-product-templates";
import { insuranceXibaoSimpleTemplates } from "@/lib/insurance-xibao-simple-templates";
import { insuranceXibaoTemplates } from "@/lib/insurance-xibao-templates";

const siteOrigin = "https://knowlens.ai";
const pagePath = "/baox";
const pageLink = `${siteOrigin}${pagePath}`;
const heroImagePath = "/insurance/hero-insurance-poster-wide.webp";
const heroImageUrl = `${siteOrigin}${heroImagePath}`;
const hideHongKongInsuranceTemplates = true;
const INITIAL_SHOWCASE_TEMPLATE_COUNT = 8;
const EXPIRED_SEASONAL_TEMPLATE_KEYWORDS = ["父亲节", "端午", "夏至", "小暑"];
const EXPIRED_SEASONAL_TEMPLATE_IMAGE_MARKERS = [
  "/father-",
  "/xiazhi-",
  "/duanwu-",
  "/duanwu-free-",
];
const FEATURED_SHOWCASE_TEMPLATE_LIMIT = 12;
const FEATURED_SHOWCASE_TEMPLATE_IMAGE_ORDER = [
  "/insurance/posters/jieqi-dashu-brush-01.png",
  "/insurance/posters/female-jiankang-03.png",
  "/insurance/posters/festival-qixi-brush-01.png",
  "/insurance/posters/female-kepu-04.png",
  "/insurance/posters/female-lipei-04.png",
  "/insurance/posters/female-chexian-03.png",
  "/insurance/posters/female-baoxian-03.png",
  "/insurance/posters/female-yanglao-05.png",
  "/insurance/posters/jieqi-liqiu-brush-01.png",
  "/insurance/posters/female-jiankang-05.png",
  "/insurance/posters/jieqi-chushu-brush-01.png",
  "/insurance/posters/health-check-notice-01.png",
  "/insurance/posters/jieqi-bailu-brush-01.png",
  "/insurance/posters/jieqi-qiufen-brush-01.png",
];
const SHOWCASE_BASE_CATEGORIES = [
  "全部",
  "日签",
  "节日",
  "节气",
  "科普",
  "喜报",
  "产品",
  "理赔",
  "养老",
  "理财",
  "车险",
  "重疾",
  "健康",
  "品宣",
  "生日",
  "活动",
  "保险",
  "港险",
] as const;

export const metadata: Metadata = {
  title: "保险模板中心 | 保险营销内容生成 | KnowLens.ai",
  description:
    "KnowLens 保险模板中心支持保险宣传图、产品说明、客户教育、理赔服务、续保提醒和代理人展业素材生成，支持套用模板并精确控制文案。",
  keywords: [
    "保险海报",
    "保险营销海报",
    "保险宣传图",
    "保险模板",
    "保险文案",
    "insurance poster",
    "insurance marketing poster",
    "insurance template",
    "AI insurance poster generator",
  ],
  alternates: {
    canonical: pageLink,
    languages: {
      "zh-CN": pageLink,
      en: pageLink,
      "x-default": pageLink,
    },
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

const baseTemplates: InsuranceTemplateCard[] = [
  ...(hideHongKongInsuranceTemplates ? [] : (hongKongInsuranceTemplates as InsuranceTemplateCard[])),
  ...(femaleFirstwaveTemplates as InsuranceTemplateCard[]),
  ...(femaleNextwaveTemplates as InsuranceTemplateCard[]),
  ...(gaodingKepuInsuranceTemplates as InsuranceTemplateCard[]),
  ...(gaodingFinanceInsuranceTemplates as InsuranceTemplateCard[]),
  ...(gaodingPensionInsuranceTemplates as InsuranceTemplateCard[]),
  ...(insuranceXibaoSimpleTemplates as InsuranceTemplateCard[]),
  ...(insuranceXibaoTemplates as InsuranceTemplateCard[]),
  ...(gaoding068InsuranceTemplates as InsuranceTemplateCard[]),
  ...(gaoding067InsuranceTemplates as InsuranceTemplateCard[]),
  ...(gaodingExtractedInsuranceTemplates as InsuranceTemplateCard[]),
  ...(festivalTemplates as InsuranceTemplateCard[]),
  ...(dailyQuoteTemplates as InsuranceTemplateCard[]),
  ...(solarTermTemplates as InsuranceTemplateCard[]),
  ...(activityTemplates as InsuranceTemplateCard[]),
  ...(productTemplates as InsuranceTemplateCard[]),
  ...(criticalIllnessTemplates as InsuranceTemplateCard[]),
  ...(medicalReminderTemplates as InsuranceTemplateCard[]),
  ...(marketingInsuranceTemplates as InsuranceTemplateCard[]),
  ...(productMarketingTemplates as InsuranceTemplateCard[]),
  ...(liabilityProductTemplates as InsuranceTemplateCard[]),
  ...(wealthProductTemplates as InsuranceTemplateCard[]),
  ...(productScienceTemplates as InsuranceTemplateCard[]),
  ...(businessInsuranceTemplates as InsuranceTemplateCard[]),
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

function hasAvailableTemplateImage(template: InsuranceTemplateCard) {
  if (!template.imageSrc) {
    return false;
  }
  if (!template.imageSrc.startsWith("/")) {
    return true;
  }
  if (availableInsuranceTemplateImages.has(template.imageSrc)) {
    return true;
  }
  return false;
}

function isExpiredSeasonalShowcaseTemplate(template: InsuranceTemplateCard) {
  const imageSrc = template.imageSrc || "";
  const categoryText = [
    template.primaryCategory,
    template.category,
    template.secondaryCategory,
    template.title,
    template.description,
  ]
    .filter(Boolean)
    .join(" ");

  if (EXPIRED_SEASONAL_TEMPLATE_IMAGE_MARKERS.some((marker) => imageSrc.includes(marker))) {
    return true;
  }

  return EXPIRED_SEASONAL_TEMPLATE_KEYWORDS.some((keyword) => categoryText.includes(keyword));
}

function getTemplateIdentity(template: InsuranceTemplateCard) {
  return template.imageSrc || `${template.primaryCategory}:${template.secondaryCategory}:${template.title}`;
}

function getTemplateFileNumber(template: InsuranceTemplateCard, prefix: string) {
  const match = template.imageSrc?.match(new RegExp(`/insurance/posters/${prefix}-(\\d+)\\.png$`));
  return match ? Number.parseInt(match[1], 10) : 0;
}

function getTemplateQualityPriority(template: InsuranceTemplateCard) {
  const gaodingMatch = template.imageSrc?.match(/\/insurance\/posters\/gaoding-(\d+)\.png$/);
  const category = template.primaryCategory || template.category;

  if (gaodingMatch) {
    const fileNumber = Number.parseInt(gaodingMatch[1], 10);
    if (fileNumber >= 228 && fileNumber <= 248) return 1_250;
    if (fileNumber >= 181 && fileNumber <= 186) return 1_180;
    if (fileNumber >= 151 && fileNumber <= 180) return 1_120;
    if (fileNumber >= 121 && fileNumber <= 150) return 1_100;
    if (fileNumber >= 111 && fileNumber <= 120) return 1_060;
    if (fileNumber >= 1 && fileNumber <= 30) return 980;
    if (fileNumber >= 31 && fileNumber <= 60) return 960;
    if (fileNumber >= 61 && fileNumber <= 90) return 940;
    if (fileNumber >= 91 && fileNumber <= 110) return 880;
    if (fileNumber >= 197 && fileNumber <= 227) return 840;
    if (fileNumber >= 187 && fileNumber <= 196) return 760;
  }

  if (category === "科普") return 900;
  if (category === "产品" || category === "养老" || category === "理财" || category === "理赔") return 860;
  if (category === "喜报" || category === "重疾" || category === "健康" || category === "车险") return 820;
  if (category === "品宣" || category === "日签" || category === "保险") return 760;
  return 700;
}

function getSeasonalTemplatePriority(template: InsuranceTemplateCard) {
  const imageSrc = template.imageSrc || "";
  const secondaryCategory = template.secondaryCategory || "";
  const title = template.title || "";

  if (imageSrc.includes("/hongkong-")) {
    return -500;
  }
  if (isExpiredSeasonalShowcaseTemplate(template)) {
    return -900;
  }
  if (secondaryCategory.includes("七夕") || title.includes("七夕")) {
    return 180;
  }
  if (secondaryCategory.includes("中秋") || title.includes("中秋")) {
    return 160;
  }
  if (secondaryCategory.includes("国庆") || title.includes("国庆")) {
    return 140;
  }

  return 0;
}

function hashStringToNumber(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getTemplateShuffleScore(template: InsuranceTemplateCard, seed: number) {
  const identity = getTemplateIdentity(template);
  return hashStringToNumber(`${seed}:${identity}`);
}

function getTemplateSourceBucket(template: InsuranceTemplateCard) {
  const imageSrc = template.imageSrc || "";
  if (imageSrc.includes("/insurance/posters/gaoding-")) {
    return "gaoding";
  }
  if (imageSrc.includes("/insurance/posters/female-")) {
    return "female";
  }
  return "standard";
}

function getTemplateQualityTier(template: InsuranceTemplateCard) {
  const priority = getTemplateQualityPriority(template);
  if (priority >= 1_000) return "premium";
  if (priority >= 860) return "strong";
  return "standard";
}

function getFeaturedShowcaseTemplateRank(template: InsuranceTemplateCard) {
  const index = FEATURED_SHOWCASE_TEMPLATE_IMAGE_ORDER.indexOf(template.imageSrc || "");
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

function pinFeaturedShowcaseTemplates(templates: InsuranceTemplateCard[]) {
  const featured = templates
    .filter((template) => getFeaturedShowcaseTemplateRank(template) !== Number.POSITIVE_INFINITY)
    .sort((left, right) => getFeaturedShowcaseTemplateRank(left) - getFeaturedShowcaseTemplateRank(right))
    .slice(0, FEATURED_SHOWCASE_TEMPLATE_LIMIT);
  if (!featured.length) {
    return templates;
  }

  const featuredIds = new Set(featured.map(getTemplateIdentity));
  return [...featured, ...templates.filter((template) => !featuredIds.has(getTemplateIdentity(template)))];
}

function sortTemplatesWithinCategory(templates: InsuranceTemplateCard[], seed: number) {
  return [...templates].sort((left, right) => {
    const priorityDelta = getSeasonalTemplatePriority(right) - getSeasonalTemplatePriority(left);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }
    const qualityDelta = getTemplateQualityPriority(right) - getTemplateQualityPriority(left);
    if (qualityDelta !== 0) {
      return qualityDelta;
    }
    const shuffleDelta = getTemplateShuffleScore(left, seed) - getTemplateShuffleScore(right, seed);
    if (shuffleDelta !== 0) {
      return shuffleDelta;
    }
    const fileNumberDelta =
      getTemplateFileNumber(right, "father") +
      getTemplateFileNumber(right, "xiazhi") +
      getTemplateFileNumber(right, "duanwu-free") +
      getTemplateFileNumber(right, "duanwu") -
      (getTemplateFileNumber(left, "father") +
        getTemplateFileNumber(left, "xiazhi") +
        getTemplateFileNumber(left, "duanwu-free") +
        getTemplateFileNumber(left, "duanwu"));
    if (fileNumberDelta !== 0) {
      return fileNumberDelta;
    }
    return 0;
  });
}

function scatterTemplatesWithinCategory(templates: InsuranceTemplateCard[], seed: number) {
  const sourceOrder = ["gaoding", "female", "standard"];
  const grouped = new Map<string, InsuranceTemplateCard[]>();

  for (const template of sortTemplatesWithinCategory(templates, seed)) {
    const source = getTemplateSourceBucket(template);
    const current = grouped.get(source) || [];
    current.push(template);
    grouped.set(source, current);
  }

  const ordered: InsuranceTemplateCard[] = [];
  let hasRemaining = true;
  while (hasRemaining) {
    hasRemaining = false;
    for (const source of sourceOrder) {
      const queue = grouped.get(source);
      if (queue && queue.length > 0) {
        ordered.push(queue.shift() as InsuranceTemplateCard);
        hasRemaining = true;
      }
    }
  }

  return ordered;
}

function applyInsuranceTemplateAccessStrategy(availableTemplates: InsuranceTemplateCard[]) {
  return availableTemplates.map((template) => ({ ...template, isFree: false }));
}

function orderInsuranceTemplatesForShowcase(availableTemplates: InsuranceTemplateCard[], seed: number) {
  const categoryOrder = [
    "科普",
    "产品",
    "养老",
    "理财",
    "理赔",
    "喜报",
    "重疾",
    "健康",
    "车险",
    "保险",
    "品宣",
    "日签",
    "生日",
    "活动",
    "节日",
    "节气",
  ];
  const categoryRoundOrder = [
    "科普",
    "产品",
    "养老",
    "理财",
    "理赔",
    "喜报",
    "重疾",
    "健康",
    "车险",
    "保险",
    "科普",
    "产品",
    "养老",
    "理财",
    "理赔",
    "喜报",
    "品宣",
    "日签",
    "生日",
    "活动",
    "节日",
    "节气",
    "科普",
    "产品",
    "养老",
    "理财",
    "重疾",
    "健康",
    "车险",
    "保险",
    "品宣",
    "生日",
    "活动",
    "日签",
  ];
  const tierOrder = ["premium", "strong", "standard"] as const;
  const grouped = new Map<string, Map<string, InsuranceTemplateCard[]>>();
  const extras: InsuranceTemplateCard[] = [];

  for (const template of availableTemplates) {
    const category = template.primaryCategory || template.category;
    if (!categoryOrder.includes(category)) {
      extras.push(template);
      continue;
    }
    const tier = getTemplateQualityTier(template);
    const tierMap = grouped.get(tier) || new Map<string, InsuranceTemplateCard[]>();
    const current = tierMap.get(category) || [];
    current.push(template);
    tierMap.set(category, current);
    grouped.set(tier, tierMap);
  }

  for (const tier of tierOrder) {
    const tierMap = grouped.get(tier);
    if (!tierMap) {
      continue;
    }
    for (const [category, templates] of tierMap) {
      tierMap.set(category, scatterTemplatesWithinCategory(templates, seed + hashStringToNumber(`${tier}:${category}`)));
    }
  }

  const ordered: InsuranceTemplateCard[] = [];
  for (const tier of tierOrder) {
    const tierMap = grouped.get(tier);
    if (!tierMap) {
      continue;
    }
    let hasRemaining = true;
    while (hasRemaining) {
      hasRemaining = false;
      for (const category of categoryRoundOrder) {
        const queue = tierMap.get(category);
        if (queue && queue.length > 0) {
          ordered.push(queue.shift() as InsuranceTemplateCard);
          hasRemaining = true;
        }
      }
    }
  }

  return pinFeaturedShowcaseTemplates([...ordered, ...sortTemplatesWithinCategory(extras, seed)]);
}

export const insuranceShowcaseTemplates = orderInsuranceTemplatesForShowcase(
  applyInsuranceTemplateAccessStrategy(
    baseTemplates.filter(hasAvailableTemplateImage).filter((template) => !isExpiredSeasonalShowcaseTemplate(template)),
  ),
  0,
);
const initialShowcaseTemplates = insuranceShowcaseTemplates.slice(0, INITIAL_SHOWCASE_TEMPLATE_COUNT);

const showcaseCategories = SHOWCASE_BASE_CATEGORIES.filter(
  (category) => !hideHongKongInsuranceTemplates || category !== "港险",
);

export default function InsurancePage() {
  return (
    <InsurancePageClient
      templates={initialShowcaseTemplates}
      categories={showcaseCategories}
      initialCategory="全部"
      totalTemplateCount={insuranceShowcaseTemplates.length}
    />
  );
}
