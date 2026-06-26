import { activityTemplates } from "./insurance-activity-templates.js";
import { criticalIllnessTemplates } from "./insurance-critical-illness-templates.js";
import { dailyQuoteTemplates } from "./insurance-daily-templates.js";
import { festivalTemplates } from "./insurance-festival-templates.js";
import { gaoding067InsuranceTemplates } from "./insurance-gaoding-067-templates.js";
import { gaoding068InsuranceTemplates } from "./insurance-gaoding-068-templates.js";
import { gaodingExtractedInsuranceTemplates } from "./insurance-gaoding-extracted-templates.js";
import { gaodingFinanceInsuranceTemplates } from "./insurance-gaoding-finance-templates.js";
import { gaodingKepuInsuranceTemplates } from "./insurance-gaoding-kepu-templates.js";
import { gaodingPensionInsuranceTemplates } from "./insurance-gaoding-pension-templates.js";
import { insuranceXibaoSimpleTemplates } from "./insurance-xibao-simple-templates.js";
import { marketingInsuranceTemplates } from "./insurance-marketing-templates.js";
import { productTemplates } from "./insurance-product-templates.js";
import { solarTermTemplates } from "./insurance-solar-term-templates.js";

const pinxuanSourceTemplate = {
  title: "家庭保障配置，先抓重点",
  category: "品宣",
  primaryCategory: "品宣",
  secondaryCategory: "家庭配置",
  description: "适合家庭保障配置讲解、全家方案沟通和咨询前需求引导。",
  prompt: "基于品宣模板，生成一张中文家庭保障配置海报。只显示输入文案，不显示字段名和分类词。",
  format: "9:16 海报",
  audience: "家庭客户",
  fields: ["标题", "副标题", "核心要点", "辅助信息", "机构名称"],
  accent: "#e0f2fe",
  rows: ["先保障家庭经济支柱", "再完善孩子和老人保障", "医疗与重疾搭配考虑", "预算内逐步补齐"],
  auxiliaryInfo: "配置方案需结合家庭实际情况",
  illustration: "家庭成员站在不同保障层级上，周围有医疗、重疾、意外、寿险图标组成保护环。",
  imageSrc: "/insurance/posters/pinxuan-10.png",
  aspectRatio: "9:16",
};

const customSourceTemplates = {
  "festival-qixi-01": {
    title: "七夕心意，把守护送给在乎的人",
    category: "节日",
    primaryCategory: "节日",
    secondaryCategory: "七夕祝福",
    description: "适合七夕客户问候、伴侣关怀和节日轻触达。",
    prompt:
      "基于保险节日问候模板，生成一张中文七夕海报。只显示输入文案，不显示字段名和分类词。画面强调爱意、陪伴、花束、礼盒和温柔光影，但仍保留保险行业的安心守护感；不要生成机构名称、二维码、价格或虚假承诺。",
    format: "9:16 海报",
    audience: "节日客户关怀",
    fields: ["标题", "核心文案", "辅助信息"],
    accent: "#f7d8e1",
    rows: ["把爱说出口，也把保障想周全", "适合伴侣互相提醒未来责任", "节日问候不必太硬，也不能太空", "安心感比热闹更容易留下好印象"],
    auxiliaryInfo: "保障责任以保险合同约定为准",
    illustration:
      "七夕夜色与暖金灯光交织，花束、丝带礼盒、星点、弯月和柔雾窗光组成温柔节日场景，中心保留低调守护盾牌意象。",
    imageSrc: "custom://festival-qixi-01",
    aspectRatio: "9:16",
  },
};

const categoryByFemaleSlug = {
  riqian: "日签",
  jieri: "节日",
  jieqi: "节气",
  kepu: "科普",
  xibao: "喜报",
  chanpin: "产品",
  lipei: "理赔",
  yanglao: "养老",
  licai: "理财",
  chexian: "车险",
  zhongji: "重疾",
  jiankang: "健康",
  pinxuan: "品宣",
  shengri: "生日",
  huodong: "活动",
  baoxian: "保险",
};

const sourceTemplatePool = [
  ...activityTemplates,
  ...criticalIllnessTemplates,
  ...dailyQuoteTemplates,
  ...festivalTemplates,
  ...gaoding067InsuranceTemplates,
  ...gaoding068InsuranceTemplates,
  ...gaodingExtractedInsuranceTemplates,
  ...gaodingFinanceInsuranceTemplates,
  ...gaodingKepuInsuranceTemplates,
  ...gaodingPensionInsuranceTemplates,
  ...insuranceXibaoSimpleTemplates,
  ...marketingInsuranceTemplates,
  ...productTemplates,
  ...solarTermTemplates,
  pinxuanSourceTemplate,
  ...Object.values(customSourceTemplates),
];

const femaleFirstwaveConfig = [
  {
    sourceImageSrc: "/insurance/posters/riqian-01.png",
    outputImageSrc: "/insurance/posters/female-riqian-01.png",
    styleId: "watercolor-story",
    accent: "#f7d8e8",
    illustrationNote:
      "加入晨雾粉光、花束便笺、珍珠白桌面和细腻玻璃花瓶，让清晨氛围更温柔松弛，符合女性偏好的轻柔质感。",
  },
  {
    sourceKey: "festival-qixi-01",
    outputImageSrc: "/insurance/posters/female-jieri-01.png",
    styleId: "light-luxury",
    accent: "#f3d8c6",
    illustrationNote:
      "加入香槟金丝带、玉兰花瓣、淡米色织物和柔和节庆光影，保留节日祝福感，同时更精致更适合女性客户审美。",
  },
  {
    sourceImageSrc: "/insurance/posters/jieqi-10.png",
    outputImageSrc: "/insurance/posters/female-jieqi-01.png",
    styleId: "warm-family",
    accent: "#f9d9cf",
    illustrationNote:
      "加入奶杏色风铃、柔光窗纱、清透花叶和淡淡纸感层次，让节气海报更有生活感与陪伴感。",
  },
  {
    sourceImageSrc: "/insurance/posters/gaoding-181.png",
    outputImageSrc: "/insurance/posters/female-kepu-01.png",
    styleId: "handdrawn-care",
    accent: "#efd6d1",
    illustrationNote:
      "加入手账花边、温柔纸纹、花叶线稿和浅粉米色标注贴纸，让知识型海报依旧专业但更亲和。",
  },
  {
    sourceImageSrc: "/insurance/posters/gaoding-111.png",
    outputImageSrc: "/insurance/posters/female-xibao-01.png",
    styleId: "light-luxury",
    accent: "#f6d6df",
    illustrationNote:
      "加入缎带花束、柔金礼盒、玫瑰金高光和细闪纸片，让喜报氛围更明亮精致但不过分张扬。",
  },
  {
    sourceImageSrc: "/insurance/posters/chanpin-08.png",
    outputImageSrc: "/insurance/posters/female-chanpin-01.png",
    styleId: "soft-3d",
    accent: "#f5d8e8",
    illustrationNote:
      "加入柔粉亚克力、花朵轮廓、圆润光泽和女性偏好的洁净白粉空间，强化产品种草的精致感。",
  },
  {
    sourceImageSrc: "/insurance/posters/gaoding-044.png",
    outputImageSrc: "/insurance/posters/female-lipei-01.png",
    styleId: "minimal-white",
    accent: "#ead9cf",
    illustrationNote:
      "加入奶白文件夹、香槟金分隔线、柔光花枝和极简留白，让理赔信息更清楚也更不冰冷。",
  },
  {
    sourceImageSrc: "/insurance/posters/gaoding-228.png",
    outputImageSrc: "/insurance/posters/female-yanglao-01.png",
    styleId: "warm-family",
    accent: "#f4dccf",
    illustrationNote:
      "加入暖米色茶具、窗边绿植、花瓣光斑和陪伴感人物关系，营造更温和的养老规划氛围。",
  },
  {
    sourceImageSrc: "/insurance/posters/gaoding-151.png",
    outputImageSrc: "/insurance/posters/female-licai-01.png",
    styleId: "light-luxury",
    accent: "#ecd8c5",
    illustrationNote:
      "加入香槟金丝线、珍珠白卡片、柔雾花束和温润米金背景，让理财海报更精致优雅。",
  },
  {
    sourceImageSrc: "/insurance/posters/gaoding-244.png",
    outputImageSrc: "/insurance/posters/female-chexian-01.png",
    styleId: "soft-3d",
    accent: "#dfe4f6",
    illustrationNote:
      "加入浅雾蓝车身高光、柔白道路光带、花叶线稿和圆润信息卡，让车险主题更清爽不生硬。",
  },
  {
    sourceImageSrc: "/insurance/posters/gaoding-061.png",
    outputImageSrc: "/insurance/posters/female-zhongji-01.png",
    styleId: "minimal-white",
    accent: "#f3dfe7",
    illustrationNote:
      "加入粉白手账标签、柔和高光、花瓣边签和整洁留白，让重疾科普更适合收藏转发。",
  },
  {
    sourceImageSrc: "/insurance/posters/gaoding-232.png",
    outputImageSrc: "/insurance/posters/female-jiankang-01.png",
    styleId: "watercolor-story",
    accent: "#d8ebe8",
    illustrationNote:
      "加入清透花叶水彩、柔白窗光和米青色纸张层次，让健康保障主题更安心、更细腻。",
  },
  {
    sourceImageSrc: "/insurance/posters/pinxuan-10.png",
    outputImageSrc: "/insurance/posters/female-pinxuan-01.png",
    styleId: "light-luxury",
    accent: "#f0d8e3",
    illustrationNote:
      "加入珍珠白信息卡、柔粉金边、轻花束点缀和温柔家庭场景，让品牌宣发既专业又更有好感。",
  },
  {
    sourceImageSrc: "/insurance/posters/yingxiao-26.png",
    outputImageSrc: "/insurance/posters/female-shengri-01.png",
    styleId: "warm-family",
    accent: "#f4ddd4",
    illustrationNote:
      "加入暖米色花束、柔光蛋糕、丝带礼盒和轻雾窗光，让生日祝福更温柔亲切，同时保留保险客户关怀感。",
  },
  {
    sourceImageSrc: "/insurance/posters/huodong-06.png",
    outputImageSrc: "/insurance/posters/female-huodong-01.png",
    styleId: "warm-family",
    accent: "#f3d8d1",
    illustrationNote:
      "加入茶歇花艺、柔粉布景、暖光圆桌和轻雾背景，让活动邀约看起来更像高质感女性沙龙。",
  },
  {
    sourceImageSrc: "/insurance/posters/gaoding-236.png",
    outputImageSrc: "/insurance/posters/female-baoxian-01.png",
    styleId: "soft-3d",
    accent: "#e8ddee",
    illustrationNote:
      "加入柔光家居、圆润信息模块、浅粉米紫层次和轻花叶光影，让责任型保险主题更温和但不失分量。",
  },
];

function findSourceTemplate(config) {
  if (config.sourceKey) {
    const customTemplate = customSourceTemplates[config.sourceKey];
    if (!customTemplate) {
      throw new Error(`Missing custom source template for ${config.sourceKey}`);
    }
    return customTemplate;
  }
  const template = sourceTemplatePool.find((item) => item.imageSrc === config.sourceImageSrc);
  if (!template) {
    throw new Error(`Missing source template for ${config.sourceImageSrc}`);
  }
  return template;
}

function createFemaleFirstwaveTemplate(config) {
  const source = findSourceTemplate(config);
  const slugMatch = config.outputImageSrc.match(/female-([a-z]+)-\d+\.png$/);
  const targetCategory = slugMatch ? categoryByFemaleSlug[slugMatch[1]] || source.primaryCategory || source.category : source.primaryCategory || source.category;
  return {
    ...source,
    category: targetCategory,
    primaryCategory: targetCategory,
    imageSrc: config.outputImageSrc,
    styleId: config.styleId,
    accent: config.accent,
    format: "9:16 海报",
    aspectRatio: "9:16",
    description: source.description || `${source.primaryCategory || source.category}女性风格海报`,
    prompt: `${source.prompt} 画面采用更符合女性客户偏好的保险营销风格，保持行业专业感，不要做成电商促销图。`,
    illustration: `${source.illustration} ${config.illustrationNote}`,
    auxiliaryInfo: source.auxiliaryInfo || "",
  };
}

export const femaleFirstwaveTemplates = femaleFirstwaveConfig.map(createFemaleFirstwaveTemplate);
