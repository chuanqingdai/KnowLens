import { activityTemplates } from "./insurance-activity-templates.js";
import { criticalIllnessTemplates } from "./insurance-critical-illness-templates.js";
import { dailyQuoteTemplates } from "./insurance-daily-templates.js";
import { gaoding067InsuranceTemplates } from "./insurance-gaoding-067-templates.js";
import { gaoding068InsuranceTemplates } from "./insurance-gaoding-068-templates.js";
import { gaodingExtractedInsuranceTemplates } from "./insurance-gaoding-extracted-templates.js";
import { gaodingFinanceInsuranceTemplates } from "./insurance-gaoding-finance-templates.js";
import { gaodingKepuInsuranceTemplates } from "./insurance-gaoding-kepu-templates.js";
import { gaodingPensionInsuranceTemplates } from "./insurance-gaoding-pension-templates.js";
import { businessInsuranceTemplates } from "./insurance-business-templates.js";
import { insuranceXibaoSimpleTemplates } from "./insurance-xibao-simple-templates.js";
import { marketingInsuranceTemplates } from "./insurance-marketing-templates.js";
import { productMarketingTemplates } from "./insurance-product-marketing-templates.js";
import { productTemplates } from "./insurance-product-templates.js";
import { solarTermTemplates } from "./insurance-solar-term-templates.js";

const pinxuanAdultCriticalTemplate = {
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
  imageSrc: "custom://pinxuan-adult-critical",
  aspectRatio: "9:16",
};

const pinxuanMedicalTemplate = {
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
  imageSrc: "custom://pinxuan-medical",
  aspectRatio: "9:16",
};

const pinxuanLifeTemplate = {
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
  imageSrc: "custom://pinxuan-life",
  aspectRatio: "9:16",
};

const festivalSources = {
  "festival-qixi-02": {
    title: "七夕到了，把爱和保障都说清楚",
    category: "节日",
    primaryCategory: "节日",
    secondaryCategory: "七夕关怀",
    description: "适合七夕伴侣问候、客户关怀和轻营销触达。",
    prompt:
      "基于保险节日问候模板，生成一张中文七夕海报。只显示输入文案，不显示字段名和分类词。画面强调花束、烛光、星点和陪伴感，但仍保留保险行业的守护气质；不要生成机构名称、二维码、价格或虚假承诺。",
    format: "9:16 海报",
    audience: "伴侣与家庭客户",
    fields: ["标题", "核心文案", "辅助信息"],
    accent: "#f6dbe5",
    rows: ["节日问候可以柔和，但要有分寸", "适合伴侣和家庭客户轻触达", "用守护感代替促销感", "把温柔和责任一起表达出来"],
    auxiliaryInfo: "保障责任以保险合同约定为准",
    illustration: "花束、香槟色礼盒、烛光、夜空星点和丝带构成温柔七夕场景，画面里有低调守护符号。",
    imageSrc: "custom://festival-qixi-02",
    aspectRatio: "9:16",
  },
  "festival-zhongqiu-03": {
    title: "中秋团圆，把安心留给家人",
    category: "节日",
    primaryCategory: "节日",
    secondaryCategory: "中秋问候",
    description: "适合中秋家庭问候、团圆祝福和客户关系维护。",
    prompt:
      "基于保险节日问候模板，生成一张中文中秋海报。只显示输入文案，不显示字段名和分类词。画面要有明月、花束、月饼、团圆感和温暖家庭氛围，同时保留保险守护感；不要生成机构名称、二维码、价格或真实品牌。",
    format: "9:16 海报",
    audience: "家庭客户节日关怀",
    fields: ["标题", "核心文案", "辅助信息"],
    accent: "#efe0c8",
    rows: ["团圆主题更适合家庭客户沟通", "节庆感要温暖，不要俗艳", "适合社群问候和朋友圈触达", "让安心感自然嵌在节日情绪里"],
    auxiliaryInfo: "具体保障责任以保险合同约定为准",
    illustration: "暖金月光照在餐桌和花束上，月饼、茶盏、窗景与一家人团圆剪影交织，整体温柔克制。",
    imageSrc: "custom://festival-zhongqiu-03",
    aspectRatio: "9:16",
  },
  "festival-guoqing-04": {
    title: "国庆出行前，先把保障看一眼",
    category: "节日",
    primaryCategory: "节日",
    secondaryCategory: "国庆出行",
    description: "适合国庆出行提醒、车主和家庭客户节前触达。",
    prompt:
      "基于保险节日出行模板，生成一张中文国庆海报。只显示输入文案，不显示字段名和分类词。画面有出行路线、花束、行李箱和轻节庆色彩，同时保留保险行业的清单感与安心感；不要生成机构名称、二维码、票价或虚假数字。",
    format: "9:16 海报",
    audience: "节前出行客户",
    fields: ["标题", "核心文案", "辅助信息"],
    accent: "#f2d7d1",
    rows: ["节前提醒更适合车主和亲子家庭", "轻节庆元素可以有，但不要太满", "把出行清单感和守护感结合起来", "适合国庆前一周持续触达"],
    auxiliaryInfo: "保障范围以保险合同约定为准",
    illustration: "城市天际线、出行路线、行李箱、花束、红金丝带和轻节庆光影组合成国庆出行前的温柔提醒场景。",
    imageSrc: "custom://festival-guoqing-04",
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
  ...gaoding067InsuranceTemplates,
  ...gaoding068InsuranceTemplates,
  ...gaodingExtractedInsuranceTemplates,
  ...gaodingFinanceInsuranceTemplates,
  ...gaodingKepuInsuranceTemplates,
  ...gaodingPensionInsuranceTemplates,
  ...businessInsuranceTemplates,
  ...insuranceXibaoSimpleTemplates,
  ...marketingInsuranceTemplates,
  ...productMarketingTemplates,
  ...productTemplates,
  ...solarTermTemplates,
  pinxuanAdultCriticalTemplate,
  pinxuanMedicalTemplate,
  pinxuanLifeTemplate,
  ...Object.values(festivalSources),
];

const femaleNextwaveConfig = [
  { sourceImageSrc: "/insurance/posters/riqian-02.png", outputImageSrc: "/insurance/posters/female-riqian-02.png", styleId: "warm-family", accent: "#f3ddd3", illustrationNote: "加入暖米色晨光、花束小卡、柔软窗纱和陪伴感桌面细节，让日签更有女性客户喜欢的轻柔生活感。" },
  { sourceImageSrc: "/insurance/posters/riqian-05.png", outputImageSrc: "/insurance/posters/female-riqian-03.png", styleId: "light-luxury", accent: "#f2d9e2", illustrationNote: "加入淡金边框、珍珠白便笺、粉白花枝和温柔留白，让关怀型日签更显高级。" },
  { sourceImageSrc: "/insurance/posters/riqian-08.png", outputImageSrc: "/insurance/posters/female-riqian-04.png", styleId: "soft-3d", accent: "#eadff2", illustrationNote: "加入柔雾粉紫、圆润亚克力卡片和精致桌面光影，让长期规划类日签更松弛耐看。" },

  { sourceKey: "festival-qixi-02", outputImageSrc: "/insurance/posters/female-jieri-02.png", styleId: "warm-family", accent: "#f5ddd7", illustrationNote: "加入奶杏色花束、轻烛光和柔雾窗景，让七夕问候更温柔但不过度甜腻。" },
  { sourceKey: "festival-zhongqiu-03", outputImageSrc: "/insurance/posters/female-jieri-03.png", styleId: "light-luxury", accent: "#efe2d1", illustrationNote: "加入月光金线、玉兰花瓣、米金桌面和团圆茶席，让中秋问候更有精致感。" },
  { sourceKey: "festival-guoqing-04", outputImageSrc: "/insurance/posters/female-jieri-04.png", styleId: "watercolor-story", accent: "#f2d7d2", illustrationNote: "加入柔和路线光带、粉白花枝和轻水彩城市背景，让节前提醒更轻盈专业。" },

  { sourceImageSrc: "/insurance/posters/jieqi-04.png", outputImageSrc: "/insurance/posters/female-jieqi-02.png", styleId: "watercolor-story", accent: "#f7ddd5", illustrationNote: "加入柔白云影、花叶水彩和清透风感，让小暑出行主题更清爽细腻。" },
  { sourceImageSrc: "/insurance/posters/jieqi-05.png", outputImageSrc: "/insurance/posters/female-jieqi-03.png", styleId: "warm-family", accent: "#f4ddd2", illustrationNote: "加入暖光树荫、淡花束和陪伴式构图，让父母关怀类节气图更有女性客户偏好的情绪温度。" },
  { sourceImageSrc: "/insurance/posters/jieqi-07.png", outputImageSrc: "/insurance/posters/female-jieqi-04.png", styleId: "minimal-white", accent: "#e5eef4", illustrationNote: "加入奶白留白、玻璃感清单卡和淡雅花枝，让大暑健康提醒更干净高级。" },

  { sourceImageSrc: "/insurance/posters/gaoding-182.png", outputImageSrc: "/insurance/posters/female-kepu-02.png", styleId: "handdrawn-care", accent: "#ecd8d2", illustrationNote: "加入手账纸边、羽毛笔、花叶线稿和柔和纸纹，让传承工具类科普更像精致收藏图。" },
  { sourceImageSrc: "/insurance/posters/gaoding-187.png", outputImageSrc: "/insurance/posters/female-kepu-03.png", styleId: "minimal-white", accent: "#f0e2dc", illustrationNote: "加入极简留白、奶油白卡片和花瓣感小标签，让法条知识点也能更亲和易转发。" },
  { sourceImageSrc: "/insurance/posters/gaoding-188.png", outputImageSrc: "/insurance/posters/female-kepu-04.png", styleId: "watercolor-story", accent: "#e8ddd4", illustrationNote: "加入柔雾水彩边缘、花叶墨迹和细线标注，让保险条款科普更柔和不板正。" },

  { sourceImageSrc: "/insurance/posters/gaoding-112.png", outputImageSrc: "/insurance/posters/female-xibao-02.png", styleId: "light-luxury", accent: "#f5d8e0", illustrationNote: "加入玫瑰金光泽、花束礼盒和细闪纸片，让签单突破喜报更显精致庆祝感。" },
  { sourceImageSrc: "/insurance/posters/gaoding-117.png", outputImageSrc: "/insurance/posters/female-xibao-03.png", styleId: "warm-family", accent: "#f4d8d0", illustrationNote: "加入柔光花艺、暖金卡片和轻丝带，让续保达成类喜报看起来更温暖有人情味。" },
  { sourceImageSrc: "/insurance/posters/gaoding-118.png", outputImageSrc: "/insurance/posters/female-xibao-04.png", styleId: "soft-3d", accent: "#eadcf0", illustrationNote: "加入圆润亚克力徽章、粉金高光和柔雾庆祝元素，让服务突破类喜报更现代。" },

  { sourceImageSrc: "/insurance/posters/gaoding-240.png", outputImageSrc: "/insurance/posters/female-chanpin-02.png", styleId: "handdrawn-care", accent: "#ecd7d1", illustrationNote: "加入手账边签、温柔纸纹、浅粉贴纸和家庭场景留白，让产品故事海报更适合女性客户阅读。" },
  { sourceImageSrc: "/insurance/posters/yingxiao-06.png", outputImageSrc: "/insurance/posters/female-chanpin-03.png", styleId: "minimal-white", accent: "#e9edf2", illustrationNote: "加入奶白留白、细花枝和清透资料卡，让医疗产品类海报更精致清爽。" },
  { sourceImageSrc: "/insurance/posters/chanpin-yx-05.png", outputImageSrc: "/insurance/posters/female-chanpin-04.png", styleId: "watercolor-story", accent: "#dfe7f5", illustrationNote: "加入柔雾蓝光、花叶线稿和轻水彩道路背景，让车险产品提醒更柔和不生硬。" },

  { sourceImageSrc: "/insurance/posters/gaoding-001.png", outputImageSrc: "/insurance/posters/female-lipei-02.png", styleId: "minimal-white", accent: "#eee1d7", illustrationNote: "加入奶白资料页、香槟金分隔线和浅花枝点缀，让案例解析更像高质感服务说明。" },
  { sourceImageSrc: "/insurance/posters/gaoding-046.png", outputImageSrc: "/insurance/posters/female-lipei-03.png", styleId: "warm-family", accent: "#f3ddd4", illustrationNote: "加入柔和服务台光影、暖米色文件夹和亲切指引卡，让理赔案例更有人情味。" },
  { sourceImageSrc: "/insurance/posters/yingxiao-15.png", outputImageSrc: "/insurance/posters/female-lipei-04.png", styleId: "watercolor-story", accent: "#e6edf4", illustrationNote: "加入清透水彩留白、花叶边饰和温柔流程箭头，让出险提醒更易读也更舒缓。" },

  { sourceImageSrc: "/insurance/posters/gaoding-229.png", outputImageSrc: "/insurance/posters/female-yanglao-02.png", styleId: "light-luxury", accent: "#f1ded0", illustrationNote: "加入米金桌面、花束小景和柔和晨光，让退休时间表主题更精致耐看。" },
  { sourceImageSrc: "/insurance/posters/gaoding-230.png", outputImageSrc: "/insurance/posters/female-yanglao-03.png", styleId: "warm-family", accent: "#f4ddd2", illustrationNote: "加入陪伴式客厅、淡花叶和暖色纸感，让代际养老规划更温柔亲切。" },
  { sourceImageSrc: "/insurance/posters/gaoding-010.png", outputImageSrc: "/insurance/posters/female-yanglao-04.png", styleId: "watercolor-story", accent: "#e4eef2", illustrationNote: "加入柔白窗光、花叶水彩和轻雾蓝层次，让养老金产品海报更清透。" },

  { sourceImageSrc: "/insurance/posters/gaoding-152.png", outputImageSrc: "/insurance/posters/female-licai-02.png", styleId: "light-luxury", accent: "#ecd8c7", illustrationNote: "加入香槟金丝线、珍珠白卡片和柔雾花束，让理财计划海报更高级克制。" },
  { sourceImageSrc: "/insurance/posters/gaoding-155.png", outputImageSrc: "/insurance/posters/female-licai-03.png", styleId: "warm-family", accent: "#f0ddd1", illustrationNote: "加入暖金家居、陪伴式人物关系和柔和花枝，让财富规划更像面向家庭客户的沟通图。" },
  { sourceImageSrc: "/insurance/posters/gaoding-065.png", outputImageSrc: "/insurance/posters/female-licai-04.png", styleId: "soft-3d", accent: "#eadff2", illustrationNote: "加入圆润亚克力理财模块、柔雾高光和细腻留白，让年金选择更显现代精致。" },

  { sourceImageSrc: "/insurance/posters/gaoding-245.png", outputImageSrc: "/insurance/posters/female-chexian-02.png", styleId: "soft-3d", accent: "#dfe4f4", illustrationNote: "加入浅雾蓝车身高光、花叶线稿和柔白模块卡，让三者险额度主题更清楚柔和。" },
  { sourceImageSrc: "/insurance/posters/yingxiao-12.png", outputImageSrc: "/insurance/posters/female-chexian-03.png", styleId: "watercolor-story", accent: "#dee8f5", illustrationNote: "加入轻水彩公路、花束角标和柔雾留白，让自驾前提醒更适合女性客户转发。" },
  { sourceImageSrc: "/insurance/posters/chanpin-yx-05.png", outputImageSrc: "/insurance/posters/female-chexian-04.png", styleId: "minimal-white", accent: "#e8edf2", illustrationNote: "加入奶白资料卡、淡花枝和清爽阴影，让车险检查清单更像干净服务海报。" },

  { sourceImageSrc: "/insurance/posters/yingxiao-01.png", outputImageSrc: "/insurance/posters/female-zhongji-02.png", styleId: "warm-family", accent: "#f5ddd5", illustrationNote: "加入柔和花束、奶杏色人物环境和温暖桌面光影，让重疾提醒更有陪伴感。" },
  { sourceImageSrc: "/insurance/posters/yingxiao-02.png", outputImageSrc: "/insurance/posters/female-zhongji-03.png", styleId: "minimal-white", accent: "#f1e1e7", illustrationNote: "加入粉白手账边签、轻花瓣装饰和留白，让投保科普更适合收藏阅读。" },
  { sourceImageSrc: "/insurance/posters/zhongji-03.png", outputImageSrc: "/insurance/posters/female-zhongji-04.png", styleId: "watercolor-story", accent: "#f4dde6", illustrationNote: "加入柔雾粉紫、花叶水彩和女性友好配色，让女性健康风险主题更精致柔和。" },

  { sourceImageSrc: "/insurance/posters/gaoding-233.png", outputImageSrc: "/insurance/posters/female-jiankang-02.png", styleId: "minimal-white", accent: "#e6edf3", illustrationNote: "加入奶白说明卡、淡雅花枝和清透留白，让医疗险科普更轻松好读。" },
  { sourceImageSrc: "/insurance/posters/gaoding-234.png", outputImageSrc: "/insurance/posters/female-jiankang-03.png", styleId: "watercolor-story", accent: "#dfeef1", illustrationNote: "加入柔白窗光、花叶边饰和蓝绿水彩，让对比型健康海报更轻盈。" },
  { sourceImageSrc: "/insurance/posters/gaoding-235.png", outputImageSrc: "/insurance/posters/female-jiankang-04.png", styleId: "warm-family", accent: "#f1ddd4", illustrationNote: "加入暖调桌面、花束小景和柔和光晕，让健康告知提醒更不压迫。" },

  { sourceImageSrc: "custom://pinxuan-adult-critical", outputImageSrc: "/insurance/posters/female-pinxuan-02.png", styleId: "warm-family", accent: "#f3ddd4", illustrationNote: "加入暖米色花束、陪伴式家庭关系和柔和室内光，让成人重疾品宣更有信任感。" },
  { sourceImageSrc: "custom://pinxuan-medical", outputImageSrc: "/insurance/posters/female-pinxuan-03.png", styleId: "minimal-white", accent: "#e8edf2", illustrationNote: "加入奶白留白、花叶线稿和清透资料卡，让百万医疗品宣更干净专业。" },
  { sourceImageSrc: "custom://pinxuan-life", outputImageSrc: "/insurance/posters/female-pinxuan-04.png", styleId: "light-luxury", accent: "#efdae3", illustrationNote: "加入珍珠白卡片、柔粉金边和轻花束点缀，让寿险责任品宣更温柔但不失分量。" },

  { sourceImageSrc: "/insurance/posters/yingxiao-31.png", outputImageSrc: "/insurance/posters/female-shengri-02.png", styleId: "watercolor-story", accent: "#f3ddd5", illustrationNote: "加入奶油花束、水彩烛光和轻雾窗景，让生日祝福更温柔耐看。" },
  { sourceImageSrc: "/insurance/posters/yingxiao-32.png", outputImageSrc: "/insurance/posters/female-shengri-03.png", styleId: "light-luxury", accent: "#f4dbe1", illustrationNote: "加入香槟金丝带、珍珠白蛋糕和暖金礼盒，让生日关怀更有精致仪式感。" },
  { sourceImageSrc: "/insurance/posters/yingxiao-33.png", outputImageSrc: "/insurance/posters/female-shengri-04.png", styleId: "warm-family", accent: "#f2ddd3", illustrationNote: "加入暖光花束、奶杏色桌面和柔和礼物摆件，让祝福语更像真客户海报。" },

  { sourceImageSrc: "/insurance/posters/huodong-07.png", outputImageSrc: "/insurance/posters/female-huodong-02.png", styleId: "warm-family", accent: "#f1ddd1", illustrationNote: "加入茶歇花艺、圆桌柔光和淡米色背景，让活动邀约更像高质感女性沙龙。" },
  { sourceImageSrc: "/insurance/posters/huodong-11.png", outputImageSrc: "/insurance/posters/female-huodong-03.png", styleId: "light-luxury", accent: "#efdae1", illustrationNote: "加入珍珠白指引卡、花束角景和细金线，让问诊式活动更显品质感。" },
  { sourceImageSrc: "/insurance/posters/huodong-17.png", outputImageSrc: "/insurance/posters/female-huodong-04.png", styleId: "soft-3d", accent: "#eadff0", illustrationNote: "加入圆润亚克力模块、柔粉灯光和轻花叶点缀，让女性健康沙龙更现代。" },

  { sourceImageSrc: "/insurance/posters/gaoding-237.png", outputImageSrc: "/insurance/posters/female-baoxian-02.png", styleId: "minimal-white", accent: "#ececf2", illustrationNote: "加入奶白留白、细花枝和清透提示卡，让保险认知类海报更安静好读。" },
  { sourceImageSrc: "/insurance/posters/gaoding-238.png", outputImageSrc: "/insurance/posters/female-baoxian-03.png", styleId: "watercolor-story", accent: "#e6e3f1", illustrationNote: "加入柔雾花叶、米紫水彩和轻家庭场景，让受益人主题更柔和有情绪。" },
  { sourceImageSrc: "/insurance/posters/gaoding-239.png", outputImageSrc: "/insurance/posters/female-baoxian-04.png", styleId: "light-luxury", accent: "#ead9e7", illustrationNote: "加入珍珠白信息卡、柔粉金边和精致留白，让长期型保险说明更有品质感。" },

  { sourceImageSrc: "/insurance/posters/gaoding-021.png", outputImageSrc: "/insurance/posters/female-riqian-05.png", styleId: "watercolor-story", accent: "#f4dce7", illustrationNote: "保留稿定原文文案，只把视觉改成女性偏好的柔粉水彩晨光、花束书桌和精致便笺。" },
  { sourceImageSrc: "/insurance/posters/gaoding-024.png", outputImageSrc: "/insurance/posters/female-riqian-06.png", styleId: "minimal-white", accent: "#f1e2e8", illustrationNote: "保留稿定原文文案，只把视觉改成女性偏好的奶白留白、淡粉便笺和柔光桌面。" },

  { sourceImageSrc: "/insurance/posters/gaoding-043.png", outputImageSrc: "/insurance/posters/female-jieri-05.png", styleId: "watercolor-story", accent: "#e2efe8", illustrationNote: "保留稿定原文文案，只把视觉改成女性偏好的清透花束、浅绿水彩和柔白留白。" },
  { sourceImageSrc: "/insurance/posters/gaoding-014.png", outputImageSrc: "/insurance/posters/female-jieri-06.png", styleId: "minimal-white", accent: "#ece8e2", illustrationNote: "保留稿定原文文案，只把视觉改成女性偏好的浅灰纸纹、白花、柔光和安静留白。" },

  { sourceImageSrc: "/insurance/posters/gaoding-157.png", outputImageSrc: "/insurance/posters/female-jieqi-05.png", styleId: "minimal-white", accent: "#e9eff2", illustrationNote: "保留稿定原文文案，只把视觉改成女性偏好的奶白清单卡、玻璃高光和淡雅花枝。" },
  { sourceImageSrc: "/insurance/posters/gaoding-171.png", outputImageSrc: "/insurance/posters/female-jieqi-06.png", styleId: "warm-family", accent: "#f3ded4", illustrationNote: "保留稿定原文文案，只把视觉改成女性偏好的暖光桌面、浅米色花叶和柔软留白。" },

  { sourceImageSrc: "/insurance/posters/gaoding-189.png", outputImageSrc: "/insurance/posters/female-kepu-05.png", styleId: "handdrawn-care", accent: "#ecdcd4", illustrationNote: "加入手账式资料袋、细线箭头和花叶标注，让出险通知科普更亲和好读。" },
  { sourceImageSrc: "/insurance/posters/gaoding-190.png", outputImageSrc: "/insurance/posters/female-kepu-06.png", styleId: "minimal-white", accent: "#e9eef3", illustrationNote: "加入奶白时间轴、清透信息卡和浅粉标签，让理赔核定时间线更整洁专业。" },

  { sourceImageSrc: "/insurance/posters/gaoding-079.png", outputImageSrc: "/insurance/posters/female-xibao-05.png", styleId: "light-luxury", accent: "#f2d7df", illustrationNote: "保留稿定原文文案，只把视觉改成女性偏好的玫瑰金奖杯、缎带花束和柔金纸片。" },
  { sourceImageSrc: "/insurance/posters/gaoding-089.png", outputImageSrc: "/insurance/posters/female-xibao-06.png", styleId: "soft-3d", accent: "#eadff1", illustrationNote: "保留稿定原文文案，只把视觉改成女性偏好的圆润荣誉徽章、粉紫高光和精致庆祝层次。" },

  { sourceImageSrc: "/insurance/posters/gaoding-031.png", outputImageSrc: "/insurance/posters/female-chanpin-05.png", styleId: "watercolor-story", accent: "#efe0d6", illustrationNote: "保留稿定原文文案，只把视觉改成女性偏好的温柔书桌、花束便笺和柔和产品卡片。" },
  { sourceImageSrc: "/insurance/posters/gaoding-032.png", outputImageSrc: "/insurance/posters/female-chanpin-06.png", styleId: "minimal-white", accent: "#e8edf2", illustrationNote: "保留稿定原文文案，只把视觉改成女性偏好的奶白家庭卡片、淡花枝和亲子用品留白。" },

  { sourceImageSrc: "/insurance/posters/gaoding-017.png", outputImageSrc: "/insurance/posters/female-lipei-05.png", styleId: "minimal-white", accent: "#eee2d8", illustrationNote: "加入奶白资料清单、浅金分隔线和柔光服务台，让报案方式海报更像专业服务指引。" },
  { sourceImageSrc: "/insurance/posters/gaoding-044.png", outputImageSrc: "/insurance/posters/female-lipei-06.png", styleId: "warm-family", accent: "#f2ddd3", illustrationNote: "加入暖米色文件夹、花束角标和亲切咨询场景，让理赔注意事项更不冰冷。" },

  { sourceImageSrc: "/insurance/posters/gaoding-231.png", outputImageSrc: "/insurance/posters/female-yanglao-05.png", styleId: "watercolor-story", accent: "#e3edf0", illustrationNote: "加入清透水彩窗光、照护清单和柔和花叶，让长期照护主题更细腻安心。" },
  { sourceImageSrc: "/insurance/posters/gaoding-248.png", outputImageSrc: "/insurance/posters/female-yanglao-06.png", styleId: "light-luxury", accent: "#ecdbc8", illustrationNote: "加入香槟金领取节奏线、珍珠白账户卡和温柔花束，让年金领取安排更有品质感。" },

  { sourceImageSrc: "/insurance/posters/gaoding-159.png", outputImageSrc: "/insurance/posters/female-licai-05.png", styleId: "soft-3d", accent: "#eadff1", illustrationNote: "加入圆润理财模块、柔紫高光和珍珠白卡片，让智慧理财主题更现代精致。" },
  { sourceImageSrc: "/insurance/posters/gaoding-161.png", outputImageSrc: "/insurance/posters/female-licai-06.png", styleId: "light-luxury", accent: "#ead8c8", illustrationNote: "加入香槟金曲线、柔雾花束和米金桌面，让财智规划更显稳健高级。" },

  { sourceImageSrc: "/insurance/posters/gaoding-244.png", outputImageSrc: "/insurance/posters/female-chexian-05.png", styleId: "watercolor-story", accent: "#dfeaf5", illustrationNote: "加入轻水彩道路、花束角标和蓝白留白，让交强险风险场景更易读、更温柔。" },
  { sourceImageSrc: "/insurance/posters/gaoding-245.png", outputImageSrc: "/insurance/posters/female-chexian-06.png", styleId: "minimal-white", accent: "#e8edf3", illustrationNote: "加入奶白责任清单、浅雾蓝车身和细花枝，让三者险额度说明更干净专业。" },

  { sourceImageSrc: "/insurance/posters/gaoding-042.png", outputImageSrc: "/insurance/posters/female-zhongji-05.png", styleId: "medical-fresh", accent: "#dfeef0", illustrationNote: "保留稿定原文文案，只把视觉改成女性偏好的清透医疗卡片、淡花叶和蓝绿柔光。" },
  { sourceImageSrc: "/insurance/posters/gaoding-061.png", outputImageSrc: "/insurance/posters/female-zhongji-06.png", styleId: "light-luxury", accent: "#f0dce4", illustrationNote: "保留稿定原文文案，只把视觉改成女性偏好的柔粉金边、康复花束和珍珠白信息块。" },

  { sourceImageSrc: "/insurance/posters/gaoding-045.png", outputImageSrc: "/insurance/posters/female-jiankang-05.png", styleId: "watercolor-story", accent: "#dfeef1", illustrationNote: "保留稿定原文文案，只把视觉改成女性偏好的清透花叶水彩、柔白窗光和健康手账。" },
  { sourceImageSrc: "/insurance/posters/gaoding-052.png", outputImageSrc: "/insurance/posters/female-jiankang-06.png", styleId: "warm-family", accent: "#f2ddd4", illustrationNote: "保留稿定原文文案，只把视觉改成女性偏好的暖光桌面、花束和轻柔医疗提示卡。" },

  { sourceImageSrc: "/insurance/posters/gaoding-005.png", outputImageSrc: "/insurance/posters/female-pinxuan-05.png", styleId: "light-luxury", accent: "#efdae2", illustrationNote: "保留稿定原文文案，只把视觉改成女性偏好的珍珠白家庭信息卡、柔粉金边和低调盾牌光影。" },
  { sourceImageSrc: "/insurance/posters/gaoding-057.png", outputImageSrc: "/insurance/posters/female-pinxuan-06.png", styleId: "watercolor-story", accent: "#dfeef2", illustrationNote: "保留稿定原文文案，只把视觉改成女性偏好的蓝绿水彩、花叶边饰和清透留白。" },

  { sourceImageSrc: "/insurance/posters/gaoding-056.png", outputImageSrc: "/insurance/posters/female-shengri-05.png", styleId: "watercolor-story", accent: "#f3ddd8", illustrationNote: "保留稿定原文文案，只把视觉改成女性偏好的奶油花束、水彩礼盒和柔光窗景。" },
  { sourceImageSrc: "/insurance/posters/gaoding-132.png", outputImageSrc: "/insurance/posters/female-shengri-06.png", styleId: "minimal-white", accent: "#f0e2e8", illustrationNote: "保留稿定原文文案，只把视觉改成女性偏好的奶白留白、淡粉便笺和精致小花束。" },

  { sourceImageSrc: "/insurance/posters/gaoding-083.png", outputImageSrc: "/insurance/posters/female-huodong-05.png", styleId: "warm-family", accent: "#f2ddd3", illustrationNote: "保留稿定原文文案，只把视觉改成女性偏好的暖光花艺、柔软信息卡和沙龙场景。" },
  { sourceImageSrc: "/insurance/posters/gaoding-087.png", outputImageSrc: "/insurance/posters/female-huodong-06.png", styleId: "light-luxury", accent: "#ead8c8", illustrationNote: "保留稿定原文文案，只把视觉改成女性偏好的米金圆桌、珍珠白卡片和花束茶歇。" },

  { sourceImageSrc: "/insurance/posters/gaoding-033.png", outputImageSrc: "/insurance/posters/female-baoxian-05.png", styleId: "warm-family", accent: "#f2ddd4", illustrationNote: "保留稿定原文文案，只把视觉改成女性偏好的暖米色家庭场景、保单卡片和淡花枝。" },
  { sourceImageSrc: "/insurance/posters/gaoding-059.png", outputImageSrc: "/insurance/posters/female-baoxian-06.png", styleId: "minimal-white", accent: "#ececf2", illustrationNote: "保留稿定原文文案，只把视觉改成女性偏好的奶白知识卡、细线分隔和柔粉提示标签。" },
];

function findSourceTemplate(config) {
  if (config.sourceKey) {
    const template = festivalSources[config.sourceKey];
    if (!template) {
      throw new Error(`Missing custom festival source: ${config.sourceKey}`);
    }
    return template;
  }
  const template = sourceTemplatePool.find((item) => item.imageSrc === config.sourceImageSrc);
  if (!template) {
    throw new Error(`Missing source template for ${config.sourceImageSrc}`);
  }
  return template;
}

function createFemaleNextwaveTemplate(config) {
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
    posterDescription: "",
    description: source.description || "",
    prompt: `${source.prompt} 画面采用更符合女性客户偏好的保险营销风格，重点体现温柔、精致、干净、松弛、有生活质感的审美；多用花束、茶席、亲子、柔光桌面、手账纸感、珍珠白、奶杏色、柔粉、浅蓝绿、香槟金等元素；保持保险行业专业感，不要做成男性商务大字报、硬科技风、强促销图或红黑战报。`,
    illustration: `${source.illustration} ${config.illustrationNote} 整体要像女性客户愿意收藏和转发的精致保险营销海报，柔和但不幼稚，温暖但不俗艳。`,
    auxiliaryInfo: "",
  };
}

export const femaleNextwaveTemplates = femaleNextwaveConfig.map(createFemaleNextwaveTemplate);
