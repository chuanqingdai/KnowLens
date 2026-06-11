export type DraftDirection = "poster" | "ppt" | "video";
import type { OutputLanguage } from "@/lib/language";
import { isChineseLanguage } from "@/lib/language";

// Prompt2: unified draft generation for poster, PPT, and video.
// Prompt1 decides whether the request is ready; this layer turns ready input into user-visible content structure.
export type DraftTaskType =
  | "full-text"
  | "short-topic"
  | "data-summary"
  | "tutorial"
  | "science-explainer"
  | "business-analysis"
  | "creative-visual"
  | "recency-sensitive";

export type ContentDraftPromptInput = {
  direction: DraftDirection;
  topic: string;
  userPrompt: string;
  count: number;
  ratioOrSize?: string;
  outputLanguage?: OutputLanguage;
  draftBatch?: {
    enabled?: boolean;
    startIndex?: number;
    totalCount?: number;
    includeCover?: boolean;
  };
};

export type VisualizationType =
  | "causal-flow"
  | "metrics-summary"
  | "business-breakdown"
  | "timeline"
  | "comparison"
  | "geo-map"
  | "lifecycle"
  | "process-steps"
  | "mechanism-anatomy"
  | "risk-impact-matrix"
  | "hierarchy-tree"
  | "before-after"
  | "route-map"
  | "network-graph"
  | "heatmap"
  | "distribution-chart"
  | "ranking-list"
  | "myth-fact"
  | "decision-tree"
  | "system-loop"
  | "swot-grid"
  | "checklist-card";

export type VisualizationTypeDefinition = {
  label: string;
  whenToUse: string;
  suitableContentTypes: string[];
  avoidFor: string[];
  cueWords: string[];
};

export type ContentDraftPromptBundle = {
  systemPrompt: string;
  userPrompt: string;
  recommendedVisualizationType: VisualizationType;
  recommendedVisualizationReason: string;
};

export type VisualizationRecommendation = {
  type: VisualizationType;
  label: string;
  reason: string;
};

const QUALITY_DEFINITION = [
  "优质知识可视化内容的定义：",
  "1) 准确：关键概念、因果关系、时间顺序不出错。",
  "2) 具体：每段都能直接对应画面元素，避免抽象写作指导语。",
  "3) 克制：信息元素数量可控，单页只保留关键事实。",
  "4) 一致：术语、口径、叙事视角在全稿保持统一。",
  "5) 可生产：内容可直接进入绘制、排版或分镜生成。",
];

const CONSISTENCY_RULES = [
  "一致性规则：",
  "1) 同一概念只使用一种称呼，避免术语切换。",
  "2) 全稿保持统一叙事视角（如“课堂讲解视角”）。",
  "3) 数字口径统一（时间单位、比例单位、数量级）。",
  "4) 段落衔接遵循“现象 -> 原因 -> 影响/结论”。",
  "5) 后续段落引用前文结论时，不重复堆砌定义。",
];

const IMAGE2_RULES = [
  "Image2 提示词规范：",
  "1) 明确主体（谁/什么）+ 场景（在哪）+ 动作（发生什么）。",
  "2) 明确可视化类型（流程图/对比图/地图/时间线等）。",
  "3) 只保留 3-5 个核心视觉元素，避免拥挤。",
  "4) 避免要求复杂排版文字，默认无大段文字上图。",
  "5) 强调信息图风格：clean infographic, high contrast, clear labels zone。",
  "6) 输出提示词应为单句或短段，可直接传给 GPT Image 2。",
];

const OUTPUT_STRUCTURE_RULES = [
  "信息可视化输出结构与使用条件：",
  "1) 因果流图：适合解释为什么、如何影响、变量传导；多页时按现象->原因->传导->结果推进。",
  "2) 时间线：适合历史演变、事件过程、政策/技术发展；多页时按阶段推进，首屏给总时间跨度。",
  "3) 对比图：适合 A/B 差异、方案选择、前后变化；多页时每页一个对比维度。",
  "4) 步骤流程图：适合教程、方法、操作路径；多页时每页一个阶段或关键步骤。",
  "5) 结构机制图：适合系统组成、人体/设备/平台原理；多页时先总览结构，再拆关键部件。",
  "6) 层级树/分类图：适合概念体系、分类法、知识树；多页时先总类，再分支展开。",
  "7) 数据趋势图：适合指标变化、报告摘要、异常解释；没有原始数据时只做定性趋势，不编数字。",
  "8) 风险影响矩阵：适合风险、预警、优先级、影响范围；多页时按风险来源、影响对象、应对建议推进。",
  "9) 地图/路径图：适合空间分布、迁移、供应链、传播路径；多页时按区域或路径节点推进。",
  "10) 误区-事实卡：适合辟谣、常见误解、知识澄清；多页时每页一个误区和一个事实。",
];

const MULTI_PAGE_RULES = [
  "多页面/多分镜一致性规则：",
  "1) 输出数量必须等于用户选择数量，每页/张/帧一个独立知识重点，禁止复制同一文案换标题。",
  "2) 多页必须保持统一主题、术语、风格、色彩方向、图标语汇、叙事视角和难度等级。",
  "3) 第 1 页/第 1 张/第 1 帧承担封面或综述作用：给出总标题、核心问题、视觉钩子和整体方向。",
  "4) PPT 第 1 页通常是封面页：标题大、配一张主题主视觉、正文极少，不堆要点。",
  "5) 视频第 1 分镜要符合 YouTube 优质封面逻辑：高对比、强主体、明确冲突/问题、少字但有点击理由。",
  "6) 后续页面按讲解路径推进：概念->机制->证据/案例->影响->结论；页数少则压缩，页数多则展开。",
  "7) 最后一页/帧应负责总结、判断方法或行动建议，避免突然中断。",
  "8) 可以连续多页讲同一个大知识点，但每页必须换一个子问题、证据角度、因果环节、对比维度或应用场景；不要让相邻页看起来在重复解释同一句话。",
  "9) 相邻页面/分镜的 visual 必须有可见差异：主体、场景、构图、动作、状态或图解结构至少变化一项；禁止连续使用同一主体和同一画面结构。",
  "10) 生成前先在内部做 focus map：每页/帧分配一个不重复的 focus，再写 title/body/narration/visual。",
];

const MEDIUM_POLICY_RULES = [
  "载体与设备规则：",
  "1) 海报：手机近距离阅读，可有分层小字，但不能密到像文章；标题大，3-5 个核心视觉节点，小字只做注释。",
  "2) PPT：电脑/投影观看，每页一个观点，文字少于海报，留白充足，主视觉承担解释，远距离可读。",
  "3) 视频分镜：停留 6-10 秒，尽量少字或无小字，靠主体、动作、构图、旁白表达，每帧 1-3 个视觉元素。",
];

const DIRECTIONAL_QUALITY_STANDARDS = {
  poster: [
    "海报优质标准：",
    "1) 信息密度相对更高，但必须分层（标题层/解释层/结论层）。",
    "2) 可包含更多文字，但每个要点仍需单句可读。",
    "3) 强调“因果链完整性”，可呈现 3-5 个信息节点。",
    "4) 适合静态阅读，允许补充解释性细节。",
  ],
  ppt: [
    "PPT优质标准：",
    "1) 每页只保留一个重点（one slide, one point）。",
    "2) 主文案精简，避免段落堆砌。",
    "3) 允许小字补充（support note），用于定义、注释或来源位。",
    "4) 页面之间有清晰推进关系（问题 -> 解释 -> 结论）。",
    "5) 多页讲同一知识点时，要拆成不同教学功能：定义、机制、例子、误区、对比、判断方法、总结，不要多页重复同一个主视觉或同一句解释。",
  ],
  video: [
    "视频分镜优质标准：",
    "1) 单镜头信息要短平快，适合 6-10 秒节奏。",
    "2) 旁白直给结论，避免复杂从句。",
    "3) 画面尽量不用小字，核心信息通过主体和动作表达。",
    "4) 分镜之间要有连续性，避免叙事跳跃。",
    "5) 每个正文分镜只推进一个叙事节拍；相邻分镜可以承接，但旁白结论和画面主体不能重复。",
  ],
} as const;

const VISUALIZATION_TYPE_DEFINITIONS: Record<VisualizationType, VisualizationTypeDefinition> = {
  "causal-flow": {
    label: "因果流图",
    whenToUse: "解释某个现象为何发生、如何层层传导。",
    suitableContentTypes: ["经济传导", "气候影响链", "公共健康机制", "系统性问题拆解"],
    avoidFor: ["纯地理位置展示", "无因果关系的素材合集"],
    cueWords: ["为什么", "影响", "导致", "因果", "传导", "链路"],
  },
  "metrics-summary": {
    label: "指标摘要图",
    whenToUse: "用户提供财报、经营指标、统计摘要或表格式数据，需要保留具体数字并提炼关键结论。",
    suitableContentTypes: ["财报摘要", "业务指标", "运营数据", "统计结果", "季度报告"],
    avoidFor: ["没有任何数据的抽象科普", "需要逐步操作的教程"],
    cueWords: ["指标", "数据", "同比", "环比", "营收", "净利润", "eps", "财报", "收入", "增长", "%", "美元", "q1", "q2", "q3", "q4"],
  },
  "business-breakdown": {
    label: "业务拆解图",
    whenToUse: "解释公司、行业、产品或商业问题的结构、收入来源、增长驱动和风险边界。",
    suitableContentTypes: ["公司分析", "行业分析", "增长拆解", "商业模式", "产品结构"],
    avoidFor: ["纯自然科学机制", "纯空间地理分布"],
    cueWords: ["公司", "业务", "商业", "市场", "收入", "利润", "增长", "客户", "产品", "行业", "广告", "cloud", "云"],
  },
  timeline: {
    label: "时间线",
    whenToUse: "内容有明确的先后阶段和历史演化过程。",
    suitableContentTypes: ["历史事件", "技术发展", "灾害过程", "政策演进"],
    avoidFor: ["无时间顺序的并列概念"],
    cueWords: ["历史", "演化", "阶段", "发展", "先后", "年代", "过程"],
  },
  comparison: {
    label: "对比图",
    whenToUse: "并列比较多个对象的差异、优劣或适用条件。",
    suitableContentTypes: ["方案对比", "类型差异", "政策比较", "实验结果对照"],
    avoidFor: ["只有单一对象且无对照维度"],
    cueWords: ["对比", "区别", "不同", "vs", "比较", "优缺点"],
  },
  "geo-map": {
    label: "空间地图",
    whenToUse: "强调地理分布、区域差异或跨区域路径。",
    suitableContentTypes: ["气候带变化", "地震火山分布", "贸易路线", "疾病扩散区域"],
    avoidFor: ["与地理位置无关的抽象概念"],
    cueWords: ["全球", "地区", "路径", "迁移", "分布", "区域", "地图"],
  },
  lifecycle: {
    label: "生命周期图",
    whenToUse: "内容是从起始到结束的阶段性演进，常用于生命或产品周期。",
    suitableContentTypes: ["生物生命周期", "产品生命周期", "项目生命周期"],
    avoidFor: ["严格循环系统但无明确阶段终点"],
    cueWords: ["生命周期", "生长", "成熟", "衰退", "阶段循环"],
  },
  "process-steps": {
    label: "步骤流程图",
    whenToUse: "强调操作步骤或可执行流程。",
    suitableContentTypes: ["实验步骤", "应急流程", "学习路径", "系统操作指引"],
    avoidFor: ["随机并列信息", "无操作顺序的理论阐述"],
    cueWords: ["步骤", "流程", "操作", "怎么做", "顺序", "执行"],
  },
  "mechanism-anatomy": {
    label: "结构机制图",
    whenToUse: "解释系统内部构成、部件关系和运行机制。",
    suitableContentTypes: ["地球内部结构", "人体系统", "设备原理", "平台架构"],
    avoidFor: ["只需展示结果而不需内部结构"],
    cueWords: ["结构", "机制", "组成", "系统", "内部", "原理"],
  },
  "risk-impact-matrix": {
    label: "风险影响矩阵",
    whenToUse: "评估风险等级、概率和影响范围。",
    suitableContentTypes: ["安全风险", "投资风险", "项目风险", "灾害预警"],
    avoidFor: ["无风险评估维度的基础科普"],
    cueWords: ["风险", "影响", "预警", "损失", "概率", "严重性"],
  },
  "hierarchy-tree": {
    label: "层级树图",
    whenToUse: "概念存在父子层级、分类体系或知识树结构。",
    suitableContentTypes: ["学科知识树", "分类法", "组织结构", "物种分类"],
    avoidFor: ["连续流程类问题"],
    cueWords: ["分类", "层级", "上位", "下位", "体系", "分支"],
  },
  "before-after": {
    label: "前后变化图",
    whenToUse: "突出变化前后对比，强调结果差异。",
    suitableContentTypes: ["政策实施前后", "实验前后", "改造前后", "趋势拐点"],
    avoidFor: ["没有明显前后状态差异"],
    cueWords: ["前后", "变化", "改造", "优化后", "前后对比"],
  },
  "route-map": {
    label: "路径路线图",
    whenToUse: "关注节点和路径，如迁移、运输、传播路线。",
    suitableContentTypes: ["物流链路", "迁徙路线", "供应链流向", "传播路径"],
    avoidFor: ["只需要静态分类信息"],
    cueWords: ["路线", "路径", "通道", "流向", "迁徙", "运输"],
  },
  "network-graph": {
    label: "关系网络图",
    whenToUse: "多个主体之间是网状关系，非单链路。",
    suitableContentTypes: ["生态关系网", "产业关系网", "社交网络传播", "因子关联"],
    avoidFor: ["严格线性流程和时间线"],
    cueWords: ["网络", "关系", "关联", "节点", "连接", "协同"],
  },
  heatmap: {
    label: "热力图",
    whenToUse: "用颜色强弱表达密度、频次、强度差异。",
    suitableContentTypes: ["温度分布", "访问热度", "疾病密度", "风险集中度"],
    avoidFor: ["离散类别对比且无连续强度数据"],
    cueWords: ["热力", "密度", "强度", "分布强弱", "热点"],
  },
  "distribution-chart": {
    label: "分布图",
    whenToUse: "展示数据在区间或群体间的分布特征。",
    suitableContentTypes: ["年龄分布", "收入分布", "成绩分布", "降水分布"],
    avoidFor: ["叙事型、无统计数据内容"],
    cueWords: ["分布", "区间", "占比", "统计", "样本", "频率"],
  },
  "ranking-list": {
    label: "排序榜单图",
    whenToUse: "比较多个对象并按重要性或数值排序。",
    suitableContentTypes: ["TopN 榜单", "城市排名", "风险优先级", "资源优先级"],
    avoidFor: ["无可排序指标"],
    cueWords: ["排名", "top", "榜单", "优先级", "高低", "排序"],
  },
  "myth-fact": {
    label: "误区-事实卡",
    whenToUse: "快速澄清常见误解，适合碎片化传播。",
    suitableContentTypes: ["科学谣言澄清", "常识误区", "健康误区", "学习误区"],
    avoidFor: ["需要完整链路推导的复杂议题"],
    cueWords: ["误区", "谣言", "辟谣", "真相", "常见误解"],
  },
  "decision-tree": {
    label: "决策树",
    whenToUse: "根据条件分支给出路径选择。",
    suitableContentTypes: ["应急决策", "诊断流程", "选型指南", "行动建议"],
    avoidFor: ["没有明确判断条件和分支结果"],
    cueWords: ["如果", "那么", "选择", "判断", "分支", "决策"],
  },
  "system-loop": {
    label: "系统闭环图",
    whenToUse: "反馈回路明显，强调正反馈/负反馈机制。",
    suitableContentTypes: ["生态循环", "经济反馈", "控制系统", "学习迭代闭环"],
    avoidFor: ["只有单向流程无反馈"],
    cueWords: ["反馈", "闭环", "循环系统", "正反馈", "负反馈"],
  },
  "swot-grid": {
    label: "SWOT 四象限",
    whenToUse: "做综合评估，拆分优势、劣势、机会、威胁。",
    suitableContentTypes: ["策略分析", "项目评估", "竞品分析", "政策评估"],
    avoidFor: ["纯科普机制讲解"],
    cueWords: ["优势", "劣势", "机会", "威胁", "swot", "策略"],
  },
  "checklist-card": {
    label: "清单卡片",
    whenToUse: "强调可执行要点、速记条目和行动步骤。",
    suitableContentTypes: ["复习清单", "行动清单", "安全检查", "考试冲刺"],
    avoidFor: ["需要复杂关联关系解释"],
    cueWords: ["清单", "要点", "检查", "速记", "步骤卡", "备忘"],
  },
};

const DIRECTIONAL_VISUALIZATION_PRIORITIES: Record<DraftDirection, VisualizationType[]> = {
  poster: [
    "metrics-summary",
    "business-breakdown",
    "causal-flow",
    "comparison",
    "ranking-list",
    "myth-fact",
    "before-after",
    "checklist-card",
    "mechanism-anatomy",
    "process-steps",
  ],
  ppt: [
    "process-steps",
    "timeline",
    "comparison",
    "mechanism-anatomy",
    "hierarchy-tree",
    "decision-tree",
    "causal-flow",
  ],
  video: [
    "process-steps",
    "timeline",
    "causal-flow",
    "route-map",
    "before-after",
    "system-loop",
    "comparison",
  ],
};

const SHARED_CONSTRAINTS = [
  "文案禁止抽象写作提示语（如“先写”“再写”“拆解原理”）。",
  "每段必须对应可绘制元素，避免空泛结论。",
  "语言应专业、简洁、可用于正式可视化稿件。",
];

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function detectDraftTaskType(topic: string, userPrompt: string): DraftTaskType {
  const rawText = `${topic}\n${userPrompt}`.trim();
  const text = normalizeText(rawText);
  const hasFreshnessCue = /最新|今天|昨日|今年|当前|实时|新闻|财报|股价|政策|latest|today|current|real[-\s]?time|earnings|stock/.test(
    rawText.toLowerCase(),
  );
  const hasDataCue = /指标|数据|同比|环比|营收|净利润|每股收益|eps|财报|收入|利润|增长|亏损|美元|人民币|%|亿元|million|billion|revenue|profit|margin|q[1-4]/i.test(
    rawText,
  );
  const hasManyFacts =
    rawText.length >= 120 ||
    (rawText.match(/[。.!?\n]/g)?.length ?? 0) >= 3 ||
    (rawText.match(/\d/g)?.length ?? 0) >= 8;

  if (hasDataCue) {
    return hasFreshnessCue && !hasManyFacts ? "recency-sensitive" : "data-summary";
  }
  if (/教程|如何使用|怎么做|步骤|流程|上手|学习|操作|指南|workflow|tutorial|howto/.test(text)) {
    return "tutorial";
  }
  if (/公司|业务|商业|市场|行业|增长|用户|产品|成本|收益|投资|business|market|growth|strategy/.test(text)) {
    return "business-analysis";
  }
  if (/为什么|为何|原理|机制|形成|影响|导致|区别|科普|解释|why|how|mechanism|explain/.test(text)) {
    return "science-explainer";
  }
  if (/海报风格|创意|视觉|封面|插画|场景|氛围|posterstyle|creative|visual/.test(text)) {
    return "creative-visual";
  }
  if (hasManyFacts) {
    return "full-text";
  }
  return "short-topic";
}

function formatVisualizationCatalogForPrompt() {
  const rows: string[] = ["可视化类型体系（用于映射）："];
  for (const [key, value] of Object.entries(VISUALIZATION_TYPE_DEFINITIONS)) {
    rows.push(
      `- ${key}（${value.label}）：适合=${value.suitableContentTypes.join(" / ")}；不适合=${value.avoidFor.join(
        " / ",
      )}；使用场景=${value.whenToUse}`,
    );
  }
  return rows;
}

function pickVisualizationType(topic: string, userPrompt: string, direction: DraftDirection): {
  type: VisualizationType;
  reason: string;
} {
  const taskType = detectDraftTaskType(topic, userPrompt);
  if (taskType === "data-summary" || taskType === "recency-sensitive") {
    return {
      type: "metrics-summary",
      reason: "识别到数据/财报/指标类输入，应优先保留事实数字并生成指标摘要，而不是套用机制因果模板。",
    };
  }
  if (taskType === "business-analysis") {
    return {
      type: "business-breakdown",
      reason: "识别到商业/公司/行业分析输入，应优先做业务结构和指标拆解。",
    };
  }
  if (taskType === "tutorial") {
    return {
      type: "process-steps",
      reason: "识别到教程/操作路径输入，应优先用步骤流程和检查点组织内容。",
    };
  }
  const text = normalizeText(`${topic} ${userPrompt}`);
  let bestType: VisualizationType = DIRECTIONAL_VISUALIZATION_PRIORITIES[direction][0] ?? "causal-flow";
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestMatchedWords: string[] = [];

  for (const [type, definition] of Object.entries(VISUALIZATION_TYPE_DEFINITIONS) as Array<
    [VisualizationType, VisualizationTypeDefinition]
  >) {
    let score = 0;
    const matchedWords: string[] = [];

    for (const cueWord of definition.cueWords) {
      const normalizedCue = normalizeText(cueWord);
      if (normalizedCue && text.includes(normalizedCue)) {
        score += 3;
        matchedWords.push(cueWord);
      }
    }

    const priorityIndex = DIRECTIONAL_VISUALIZATION_PRIORITIES[direction].indexOf(type);
    if (priorityIndex >= 0) {
      score += Math.max(8 - priorityIndex, 1);
    }

    if (score > bestScore) {
      bestScore = score;
      bestType = type;
      bestMatchedWords = matchedWords;
    }
  }

  if (bestMatchedWords.length > 0) {
    return {
      type: bestType,
      reason: `命中关键词（${bestMatchedWords.slice(0, 3).join(" / ")}），并结合${direction}方向优先级，推荐使用${
        VISUALIZATION_TYPE_DEFINITIONS[bestType].label
      }。`,
    };
  }

  return {
    type: bestType,
    reason: `未命中强关键词，按${direction}方向默认优先级推荐${VISUALIZATION_TYPE_DEFINITIONS[bestType].label}。`,
  };
}

function buildSharedSystemPrompt() {
  return buildSharedSystemPromptByLanguage("zh");
}

function buildSharedSystemPromptByLanguage(outputLanguage: OutputLanguage) {
  if (!isChineseLanguage(outputLanguage)) {
    return [
      `Prompt2: You are the content-drafting layer for KnowLens.ai. Output strict JSON in ${outputLanguage}.`,
      "Your job is to turn the user's usable input into a reviewable, paginated, visualizable content draft.",
      "You are not a retrieval layer, blocker, or final image-prompt writer.",
      "",
      "First understand the input, then draft:",
      "1. If the user provided complete text, notes, an article, a data block, or structured content, preserve its core claims, facts, order, wording, and conclusions. Organize, compress, paginate, title, and make it visualizable; do not replace it with a generic template.",
      "2. If the user provided a short request, expand naturally around the topic with useful background, mechanism, steps, comparison, misconception, application, or summary framework. Each item must add distinct value.",
      "3. If the user provided concrete facts or data, keep important numbers, dates, amounts, percentages, metrics, names, and conclusions. Do not generalize them away.",
      "4. If the user wants data/current content but provided no data, create a framework-style draft describing what should be shown; do not invent specific figures, dates, rankings, or sources.",
      "Priority order (highest to lowest): source fidelity > factual integrity > logical completeness > brevity.",
      "When the user input is long and complete, do light organization, not heavy rewriting.",
      "Never output sentence fragments or half clauses. Keep complete semantic units.",
      "Do not break semantic bundles: subject+claim, concept+definition, cause+effect, condition+judgment, metric+value, event+time, problem+method.",
      "Prompt2 is a draft layer, not final on-image copy. Do not over-compress complete source text into short image labels.",
      "",
      "Quality principles:",
      "Write like a user-reviewable content draft, not a list of prompt rules.",
      "The selected item count must be matched exactly.",
      "Each page/frame should have one clear point and should not repeat neighboring content.",
      "Do not use sliding-window splitting, filler pages, or the same idea with new titles.",
      "If the requested count is high, add functional angles such as comparison, case, misconception, checklist, system model, or judgment framework instead of repetition.",
      "The final item should synthesize into a framework, checklist, method, relationship model, or actionable takeaway, not restate earlier pages.",
      "Keep all visible draft fields in one language, except proper nouns.",
      "Do not output internal instructions, layout rules, placeholders, or writing-process phrases as visible copy.",
      "Prompt2 may include a short visual hint, but must not write the final image2 prompt.",
    ].join("\n");
  }
  return [
    "Prompt2: You are the content-drafting layer for KnowLens.ai. Output strict JSON.",
    `Prompt logic is in English; every user-facing draft value must be written in ${outputLanguage}, except proper nouns.`,
    "Your job is to turn the user's usable input into a reviewable, paginated, visualizable content draft.",
    "You are not a retrieval layer, blocker, or final image-prompt writer.",
    "",
    "First understand the input, then draft:",
    "1. If the user provided complete text, notes, an article, a data block, or structured content, preserve its core claims, facts, order, wording, and conclusions. Organize, compress, paginate, title, and make it visualizable; do not replace it with a generic template.",
    "2. If the user provided a short request, expand naturally around the topic with useful background, mechanism, steps, comparison, misconception, application, or summary framework. Each page/frame must add distinct value.",
    "3. If the user provided concrete facts or data, keep important numbers, dates, amounts, percentages, metrics, names, and conclusions. Do not generalize them away.",
    "4. If the user wants data/current content but provided no data, create a framework-style draft describing what should be shown; do not invent specific figures, dates, rankings, sources, or conclusions.",
    "Priority order (highest to lowest): source fidelity > factual integrity > logical completeness > brevity.",
    "When the user input is long and complete, do light organization, not heavy rewriting.",
    "Never output sentence fragments or half clauses. Keep complete semantic units.",
    "Do not break semantic bundles: subject+claim, concept+definition, cause+effect, condition+judgment, metric+value, event+time, problem+method.",
    "Prompt2 is a draft layer, not final on-image copy. Do not over-compress complete source text into short image labels.",
    "",
    "Quality principles:",
    "Write like a user-reviewable content draft, not a list of prompt rules.",
    "The selected item count must be matched exactly.",
    "Each page/frame should have one clear point and should not repeat neighboring content.",
    "Do not use sliding-window splitting, filler pages, or the same idea with new titles.",
    "If the requested count is high, add functional angles such as comparison, case, misconception, checklist, system model, or judgment framework instead of repetition.",
    "The final item should synthesize into a framework, checklist, method, relationship model, or actionable takeaway, not restate earlier pages.",
    "Do not output English internal instructions, layout rules, placeholders, field explanations, or writing-process phrases as visible copy.",
    "Prompt2 may include a short visual hint, but must not write the final image2 prompt.",
  ].join("\n");
}

function buildDraftBatchLines(
  direction: DraftDirection,
  count: number,
  draftBatch?: ContentDraftPromptInput["draftBatch"],
) {
  if (!draftBatch?.enabled) {
    return [];
  }
  const startIndex = Math.max(1, Math.round(Number(draftBatch.startIndex) || 1));
  const totalCount = Math.max(count, Math.round(Number(draftBatch.totalCount) || count));
  const endIndex = Math.min(totalCount, startIndex + count - 1);
  const unit =
    direction === "video"
      ? "storyboard frames"
      : direction === "ppt"
        ? "slides"
        : "poster plan items";
  const lines = [
    `Batch mode: generate ONLY ${count} ${unit} for global positions ${startIndex}-${endIndex} of ${totalCount}.`,
    "Batch mode: keep continuity with the whole source, but do not summarize other batches.",
  ];
  if (direction === "ppt") {
    lines.push(
      draftBatch.includeCover === false
        ? "Batch mode: this is a continuation batch. Do NOT create a cover slide. Every slide must have isCover=false."
        : "Batch mode: this is the first batch. Only the first slide may be the cover with isCover=true.",
    );
  } else if (direction === "video") {
    lines.push(
      draftBatch.includeCover === false
        ? "Batch mode: this is a continuation batch. Do NOT create a cover frame. Every frame must have isCover=false and narration should be non-empty."
        : "Batch mode: this is the first batch. Only the first frame may be the cover with isCover=true and empty narration.",
    );
  }
  return lines;
}

function buildPosterPrompt(
  topic: string,
  userPrompt: string,
  count: number,
  ratioOrSize: string,
  recommendedType: VisualizationType,
  recommendedReason: string,
  outputLanguage: OutputLanguage,
  draftBatch?: ContentDraftPromptInput["draftBatch"],
) {
  const taskType = detectDraftTaskType(topic, userPrompt);
  const batchLines = buildDraftBatchLines("poster", count, draftBatch);
  if (!isChineseLanguage(outputLanguage)) {
    return [
      "Direction: Poster",
      `Topic: ${topic}`,
      `User request: ${userPrompt}`,
      `Poster count: ${count}`,
      `Size: ${ratioOrSize}`,
      `Reference taskType from code: ${taskType}`,
      `Reference visualization type from code: ${recommendedType}`,
      `Reference reason: ${recommendedReason}`,
      ...batchLines,
      "Schema (strict JSON keys): contentMeta, posterDraft, planList, legacyCompat.",
      "contentMeta fields: taskType, draftStrategy, sourceMode, textStrategy, visualStrategy, riskLevel.",
      "posterDraft fields: headline, subtitle, body, points, visualType, layoutSuggestion, visualElements, cta.",
      "planList item fields: index, role, title, focus, keyFacts, visualType, visualElements, layoutHint, imagePrompt.",
      "Drafting guidance:",
      "The reference taskType and visualization type are only hints. If they conflict with the user input, trust the user input and your own understanding.",
      "posterDraft is the lightweight overall overview; keep it compact and do not duplicate the full planList.",
      "planList carries the actual page-by-page content. Its length must equal poster count.",
      "Each planList.title must be concise and concrete, not a full sentence. Target roughly: Chinese 8-16 chars, English 3-8 words.",
      "Page 1 should introduce the topic or visual hook. Later pages should each have a distinct point, fact set, and visual direction.",
      "For complete text/data, preserve and reorganize the source instead of replacing it with generic mechanism pages.",
      "For complete source text, preserve semantic units and sentence integrity. Do not clip source lines into broken fragments.",
      "For long complete source input, do light editing only: preserve claims, numbers, dates, entities, and logic order.",
      "Do not convert complete source content into slogan-like short fragments at Prompt2 stage.",
      "For short topics, expand naturally with distinct page functions.",
      "If poster count is 1 and content is dense, build one-page information architecture: title/theme, core conclusion, key facts, supporting modules, and final judgment.",
      "If the user explicitly asks for modules (for example: core metrics, structure change, growth drivers, risks, next-quarter guidance), keep those modules visible in the single-page draft.",
      "For single-poster data summaries, include enough key facts to preserve meaning; do not over-compress to one metric line.",
      "For data/business content, organize around metrics, structure, changes, observations, risks, and follow-up questions. Preserve supplied figures exactly; if no figures are supplied, produce a framework without made-up numbers.",
      "Do not shorten fields when shortening would break factual relationships or complete meaning.",
      "Avoid generic mechanism-template wording for data/business content unless it is truly the user's source wording.",
      "keyFacts should be concise content facts, not labels copied from an internal template.",
      "imagePrompt is only a short visual hint for Prompt3: subject, composition, visual metaphor, or diagram direction. Do not write the final image prompt or dense on-image copy.",
    ].join("\n");
  }
  return [
    "Direction: Poster",
    `Topic: ${topic}`,
    `User request: ${userPrompt}`,
    `Poster count: ${count}`,
    `Size: ${ratioOrSize}`,
    `Reference taskType from code: ${taskType}`,
    `Reference visualization type from code: ${recommendedType}`,
    `Reference reason: ${recommendedReason}`,
    ...batchLines,
    "Schema (strict JSON keys): contentMeta, posterDraft, planList, legacyCompat.",
    `All user-facing values inside posterDraft, planList, and legacyCompat must be written in ${outputLanguage}, except proper nouns.`,
    "contentMeta fields: taskType, draftStrategy, sourceMode, textStrategy, visualStrategy, riskLevel.",
    "posterDraft fields: headline, subtitle, body, points, visualType, layoutSuggestion, visualElements, cta.",
    "planList item fields: index, role, title, focus, keyFacts, visualType, visualElements, layoutHint, imagePrompt.",
    "Drafting guidance:",
    "The reference taskType and visualization type are only hints. If they conflict with the user input, trust the user input and your own understanding.",
    "posterDraft is the lightweight overall overview; keep it compact and do not duplicate the full planList.",
    "planList carries the actual page-by-page content. Its length must equal poster count.",
    "Each planList.title must be concise and concrete, not a full sentence. Target roughly: Chinese 8-16 chars, English 3-8 words.",
    "Page 1 should introduce the topic or visual hook. Later pages should each have a distinct point, fact set, and visual direction.",
    "For complete text/data, preserve and reorganize the source instead of replacing it with generic mechanism pages.",
    "For complete source text, preserve semantic units and sentence integrity. Do not clip source lines into broken fragments.",
    "For long complete source input, do light editing only: preserve claims, numbers, dates, entities, and logic order.",
    "Do not convert complete source content into slogan-like short fragments at Prompt2 stage.",
    "For short topics, expand naturally with distinct page functions.",
    "If poster count is 1 and content is dense, build one-page information architecture: title/theme, core conclusion, key facts, supporting modules, and final judgment.",
    "If the user explicitly asks for modules (for example: core metrics, structure change, growth drivers, risks, next-quarter guidance), keep those modules visible in the single-page draft.",
    "For single-poster data summaries, include enough key facts to preserve meaning; do not over-compress to one metric line.",
    "For data/business content, organize around metrics, structure, changes, observations, risks, and follow-up questions. Preserve supplied figures exactly; if no figures are supplied, produce a framework without made-up numbers.",
    "Do not shorten fields when shortening would break factual relationships or complete meaning.",
    "Avoid generic mechanism-template wording for data/business content unless it is truly the user's source wording.",
    "keyFacts should be concise content facts, not labels copied from an internal template.",
    "imagePrompt is only a short visual hint for Prompt3: subject, composition, visual metaphor, or diagram direction. Do not write the final image prompt or dense on-image copy.",
    "Do not leak English prompt logic, schema explanations, internal rules, or placeholders into user-visible draft copy.",
  ].join("\n");
}

function buildPptPrompt(
  topic: string,
  userPrompt: string,
  count: number,
  ratioOrSize: string,
  recommendedType: VisualizationType,
  recommendedReason: string,
  outputLanguage: OutputLanguage,
  draftBatch?: ContentDraftPromptInput["draftBatch"],
) {
  const taskType = detectDraftTaskType(topic, userPrompt);
  const batchLines = buildDraftBatchLines("ppt", count, draftBatch);
  if (!isChineseLanguage(outputLanguage)) {
    return [
      "Direction: PPT",
      `Topic: ${topic}`,
      `User request: ${userPrompt}`,
      `Total slide image count: ${count}`,
      `Ratio: ${ratioOrSize}`,
      `Reference taskType from code: ${taskType}`,
      `Reference visualization type from code: ${recommendedType}`,
      `Reference reason: ${recommendedReason}`,
      ...batchLines,
      "Schema (strict JSON keys): contentMeta, outlineItems, slideDrafts.",
      "slideDrafts item fields: page, title, mainPoint, body, supportNote, visual, imagePrompt, isCover.",
      "Drafting guidance:",
      "The reference taskType and visualization type are hints only. Trust the user input when they conflict.",
      "PPT is a teaching/presentation structure, not an article split into equal chunks.",
      "outlineItems and slideDrafts length must equal total slide image count.",
      draftBatch?.enabled && draftBatch.includeCover === false
        ? "Because this is a continuation batch, do not generate a cover slide and keep every isCover=false."
        : "The first slide must be an independent cover with isCover=true. Its title must be generated by Prompt2 from the whole content. Its body/supportNote should be empty or omitted.",
      "The cover image direction should be title-only: large title text, one clean hero subject, no small labels, no notes, no numbers, no captions.",
      "After the cover, create the requested body slides in the user's selected count. Body slide page numbers may continue sequentially, but visible review can treat them as Page 1, Page 2, etc.",
      "Each body slide should have one main point, an appealing compact title, and concise body content.",
      "Before writing slideDrafts, assign a unique slide focus map across all non-cover slides. Adjacent body slides may connect, but they must not share the same mainPoint, same evidence angle, or same visual composition.",
      "If several slides explain one large concept, split it by teaching job: definition, mechanism step, example, contrast, misconception, consequence, checklist, or takeaway.",
      "visual must make the page's unique focus visible. Avoid repeating the same hero subject, diagram type, scene, or caption pattern across neighboring slides.",
      "Hard density limit for body slides: body should be 1-2 complete sentences or 2 short bullets maximum. Do not turn the source into paragraph-heavy slide copy.",
      "The image should not contain the full body text. Treat body as presenter context; avoid separate title/header bars in the image. If visible text is needed, use at most 1-2 short integrated labels.",
      "Title style: make slide titles more attractive like high-performing educational headlines, but still concise and credible. Prefer curiosity, contrast, result, mechanism, or misconception hooks. Avoid clickbait, hype words, vague labels, emojis, and repeated question marks.",
      "Each slide title must be concrete and punchy, not a full sentence. Target roughly: Chinese 10-24 chars, English 4-12 words.",
      "For complete text/data, follow the original logic and facts; do not replace it with a generic course outline.",
      "For complete source text, do not clip sentences into fragments. Keep complete meaning units when compressing.",
      "If the user provided explicit modules or focus areas, prioritize that order and structure over generic templates.",
      "For data/business decks, organize around metrics, insight, evidence, implication, risk, and next focus. Preserve supplied figures; do not force mechanism explanation.",
      "supportNote should be optional and short: one example, memory hook, caveat, or explanation.",
      "visual should describe the slide's visible idea. imagePrompt is only a compact visual hint for Prompt3, not the final image prompt.",
      "Do not output template or process-rule wording as user-visible copy.",
    ].join("\n");
  }
  return [
    "Direction: PPT",
    `Topic: ${topic}`,
    `User request: ${userPrompt}`,
      `Total slide image count: ${count}`,
    `Ratio: ${ratioOrSize}`,
    `Reference taskType from code: ${taskType}`,
    `Reference visualization type from code: ${recommendedType}`,
    `Reference reason: ${recommendedReason}`,
    ...batchLines,
    "Schema (strict JSON keys): contentMeta, outlineItems, slideDrafts.",
    `All user-facing values inside outlineItems and slideDrafts must be written in ${outputLanguage}, except proper nouns.`,
    isChineseLanguage(outputLanguage)
      ? "当输出语言是中文时，title、mainPoint、body、supportNote、visual、imagePrompt 里的描述语言必须统一为中文；不要写 Visual、Scene、Page、structure、framework、layout 等英文提示词或中英混排说明，专有名词除外。"
      : "Keep title, mainPoint, body, supportNote, visual, and imagePrompt in the selected output language; do not mix in another language for labels or descriptive phrases, except proper nouns.",
    "slideDrafts item fields: page, title, mainPoint, body, supportNote, visual, imagePrompt, isCover.",
    "Drafting guidance:",
    "The reference taskType and visualization type are hints only. Trust the user input when they conflict.",
    "PPT is a teaching/presentation structure, not an article split into equal chunks.",
    "outlineItems and slideDrafts length must equal total slide image count.",
    draftBatch?.enabled && draftBatch.includeCover === false
      ? "Because this is a continuation batch, do not generate a cover slide and keep every isCover=false."
      : "The first slide must be an independent cover with isCover=true. Its title must be generated by Prompt2 from the whole content. Its body/supportNote should be empty or omitted.",
    "The cover image direction should be title-only: large title text, one clean hero subject, no small labels, no notes, no numbers, no captions.",
    "After the cover, create the requested body slides in the user's selected count. Body slide page numbers may continue sequentially, but visible review can treat them as Page 1, Page 2, etc.",
    "Each body slide should have one main point, an appealing compact title, and concise body content.",
    "写 slideDrafts 前，先在内部给所有非封面页分配不重复的 focus map。相邻正文页可以承接，但不能共用同一个 mainPoint、同一个证据角度或同一种画面构图。",
    "如果多页解释同一个大概念，请按教学功能拆开：定义、机制步骤、例子、对比、误区、影响、判断清单或总结，不要换个标题重复讲同一句。",
    "visual 必须体现本页独有重点；相邻页避免重复同一个主视觉、同一种图解结构、同一个场景或同一套标签。",
    "Hard density limit for body slides: body should be 1-2 complete sentences or 2 short bullets maximum. Do not turn the source into paragraph-heavy slide copy.",
    "The image should not contain the full body text. Treat body as presenter context; 图片里不要单独做标题栏、页眉遮罩或大标题条；如需可见文字，最多使用 1-2 个融入画面的短标签。",
    "标题风格：PPT 标题要更有吸引力，接近高点击教育内容标题，但必须简洁、可信、贴合原文。优先使用好奇点、反差、结果、机制、误区澄清等钩子；不要标题党、不要夸张词、不要空泛标签、不要表情符号或连续问号。",
    "每页标题必须具体、有记忆点，但不要写成长句。建议中文 10-24 字，英文 4-12 个词。",
    "For complete text/data, follow the original logic and facts; do not replace it with a generic course outline.",
    "For complete source text, do not clip sentences into fragments. Keep complete meaning units when compressing.",
    "If the user provided explicit modules or focus areas, prioritize that order and structure over generic templates.",
    "For data/business decks, organize around metrics, insight, evidence, implication, risk, and next focus. Preserve supplied figures; do not force mechanism explanation.",
    "supportNote should be optional and short: one example, memory hook, caveat, or explanation.",
    "visual should describe the slide's visible idea. imagePrompt is only a compact visual hint for Prompt3, not the final image prompt.",
    "Do not output template, process-rule wording, English prompt logic, schema explanations, or placeholders as user-visible copy.",
  ].join("\n");
}

function buildVideoPrompt(
  topic: string,
  userPrompt: string,
  count: number,
  ratioOrSize: string,
  recommendedType: VisualizationType,
  recommendedReason: string,
  outputLanguage: OutputLanguage,
  draftBatch?: ContentDraftPromptInput["draftBatch"],
) {
  const taskType = detectDraftTaskType(topic, userPrompt);
  const batchLines = buildDraftBatchLines("video", count, draftBatch);
  const bodyFrameCount = Math.max(1, count - 1);
  const targetMinSec = bodyFrameCount * 8;
  const targetMaxSec = bodyFrameCount * 12;
  if (!isChineseLanguage(outputLanguage)) {
    return [
      "Direction: Video Storyboard",
      `Topic: ${topic}`,
      `User request: ${userPrompt}`,
      `Total storyboard image count: ${count}`,
      `Ratio: ${ratioOrSize}`,
      `Reference taskType from code: ${taskType}`,
      `Reference visualization type from code: ${recommendedType}`,
      `Reference reason: ${recommendedReason}`,
      ...batchLines,
      "Schema (strict JSON keys): contentMeta, outlineItems, storyboardDrafts.",
      "storyboardDrafts item fields: index, title, durationSec, narration, visual, onScreenText, isCover.",
      "Drafting guidance:",
      "The reference taskType and visualization type are hints only. Trust the user input when they conflict.",
      "Video storyboard is a sequence of visual and narration beats, not poster pages split into frames.",
      "outlineItems and storyboardDrafts length must equal total storyboard image count.",
      draftBatch?.enabled && draftBatch.includeCover === false
        ? "Because this is a continuation batch, do not generate a cover frame and keep every isCover=false with non-empty narration."
        : "The first frame must be an independent cover frame with isCover=true. Its title must be generated by Prompt2 from the whole content. Its narration/onScreenText should be empty or omitted.",
      "The cover image direction should be title-only: large title text, one clean hero subject, no small labels, no notes, no numbers, no captions.",
      "After the cover, create the requested body frames in the user's selected count.",
      "Each body frame should have an appealing compact title, a concrete still-frame visual, and narration that sounds like real voiceover.",
      "Before writing storyboardDrafts, assign a unique beat map across all non-cover frames. Adjacent frames may continue one idea, but each frame must add a new sub-question, cause/effect step, example, contrast, consequence, or takeaway.",
      "Do not repeat the same narration conclusion with a different title. Do not repeat the same visual subject/composition unless the state or action clearly changes.",
      "Title style: make frame titles more attractive like high-performing educational video chapter titles, but still concise and credible. Prefer curiosity, contrast, result, mechanism, tension, or misconception hooks. Avoid clickbait, hype words, vague labels, emojis, and repeated question marks.",
      "Each frame title must be concrete and punchy, not a full sentence. Target roughly: Chinese 10-24 chars, English 4-12 words.",
      "durationSec should usually be 8-12 seconds.",
      `Narration pacing: the cover has no narration; the ${bodyFrameCount} body frames should total roughly ${targetMinSec}-${targetMaxSec} seconds of voiceover.`,
      "If the user's source text is shorter than the target runtime, expand each body-frame narration with clear bridging explanation, cause/effect, examples, or context while staying faithful to the source.",
      "If the user's source text is longer than the target runtime, compress and polish it into the most important beats; preserve facts, order, numbers, and causal links, but remove repetition and secondary detail.",
      "Use narration density, not durationSec, to adapt: keep durationSec in the 8-12 second range and adjust how much is said per frame.",
      "narration is the voiceover script for explaining the frame. Generate it from the frame's draft content and visual idea, make it sound natural for spoken narration, and keep the cover narration empty.",
      "narration should be long enough for that duration but concise; do not write internal goals, process rules, or placeholders.",
      "onScreenText should usually be empty or very short because generated images are not editable subtitle tracks.",
      "For body frames, prefer no on-screen text. Do not ask Prompt3 to draw subtitles, long labels, bullet lists, tiny annotations, or UI-like small text.",
      "visual must be the still image that supports this exact narration beat. It should depict the narration's concrete object, cause/effect, contrast, example, motion cue, or state change, not a generic illustration of the overall topic.",
      "Before writing visual, compare it with narration: if the viewer heard only this narration and saw only this frame, they should feel they belong together.",
      "Describe a dominant subject, scene, composition, action, or change; do not write only 'comparison chart', 'flow diagram', or another abstract visual type.",
      "Each body frame should have one clear focal subject and one visible action/change. Keep the frame simple: 1-3 visual elements, clean background, no crowded details.",
      "For complete text/data, preserve facts and order while turning them into narrative beats.",
      "For complete source text, preserve semantic continuity across frames. Do not split one fact into broken narration fragments.",
      "If the user provided explicit modules or focus areas, prioritize that order and structure over generic templates.",
      "For data/business videos, show concrete visual scenes such as metric boards, segment comparison, timeline, analyst desk, or risk checklist; no fake numbers and no dense subtitles.",
      "Do NOT output imagePrompt or imagePromptDraft for video storyboard frames. Prompt3 will generate image prompts later from title, narration, and visual.",
      "Keep narration and visual consistent: same frame topic and facts, different jobs. Narration is for audio; visual is for the later image prompt.",
    ].join("\n");
  }
  return [
    "Direction: Video Storyboard",
    `Topic: ${topic}`,
    `User request: ${userPrompt}`,
    `Total storyboard image count: ${count}`,
    `Ratio: ${ratioOrSize}`,
    `Reference taskType from code: ${taskType}`,
    `Reference visualization type from code: ${recommendedType}`,
    `Reference reason: ${recommendedReason}`,
    ...batchLines,
    "Schema (strict JSON keys): contentMeta, outlineItems, storyboardDrafts.",
    `All user-facing values inside outlineItems and storyboardDrafts must be written in ${outputLanguage}, except proper nouns.`,
    isChineseLanguage(outputLanguage)
      ? "当输出语言是中文时，title、narration、visual、onScreenText 里的描述语言必须统一为中文；不要写 Visual、Scene、Frame、structure、comparison chart、flow diagram 等英文提示词或中英混排说明，专有名词除外。"
      : "Keep title, narration, visual, and onScreenText in the selected output language; do not mix in another language for labels or descriptive phrases, except proper nouns.",
    "storyboardDrafts item fields: index, title, durationSec, narration, visual, onScreenText, isCover.",
    "Drafting guidance:",
    "The reference taskType and visualization type are hints only. Trust the user input when they conflict.",
    "Video storyboard is a sequence of visual and narration beats, not poster pages split into frames.",
    "outlineItems and storyboardDrafts length must equal total storyboard image count.",
    draftBatch?.enabled && draftBatch.includeCover === false
      ? "Because this is a continuation batch, do not generate a cover frame and keep every isCover=false with non-empty narration."
      : "The first frame must be an independent cover frame with isCover=true. Its title must be generated by Prompt2 from the whole content. Its narration/onScreenText should be empty or omitted.",
    "The cover image direction should be title-only: large title text, one clean hero subject, no small labels, no notes, no numbers, no captions.",
    "After the cover, create the requested body frames in the user's selected count.",
      "每个正文分镜要有更吸引人的简洁标题、明确静帧画面和自然旁白。",
      "写 storyboardDrafts 前，先在内部给所有非封面分镜分配不重复的 beat map。相邻分镜可以延续同一个知识点，但每个分镜必须新增一个子问题、因果步骤、例子、对比、影响或结论。",
      "不要用不同标题重复同一个旁白结论；也不要重复同一个视觉主体和构图，除非状态或动作发生了明确变化。",
      "标题风格：视频分镜标题要接近高点击教育视频章节标题，但必须简洁、可信、贴合原文。优先使用好奇点、反差、结果、机制、张力、误区澄清等钩子；不要标题党、不要夸张词、不要空泛标签、不要表情符号或连续问号。",
      "每个分镜标题必须具体、有记忆点，但不要写成长句。建议中文 10-24 字，英文 4-12 个词。",
      "durationSec should usually be 8-12 seconds.",
      `旁白节奏：封面不写旁白；${bodyFrameCount} 个正文分镜的总旁白时长应约为 ${targetMinSec}-${targetMaxSec} 秒。`,
      "如果用户原稿短于目标总时长，请在每个正文分镜里适度扩写：补充承接句、因果解释、例子或背景，但不能编造新事实。",
      "如果用户原稿长于目标总时长，请压缩并润色成最重要的叙事节拍：保留事实、顺序、数字和因果关系，删掉重复和次要细节。",
      "通过调整 narration 的字数密度适配总时长，不要改 durationSec 的默认范围；durationSec 仍保持 8-12 秒。",
      "narration is the voiceover script for explaining the frame. Generate it from the frame's draft content and visual idea, make it sound natural for spoken narration, and keep the cover narration empty.",
      "narration should be long enough for that duration but concise; do not write internal goals, process rules, or placeholders.",
    "onScreenText should usually be empty or very short because generated images are not editable subtitle tracks.",
    "For body frames, prefer no on-screen text. Do not ask Prompt3 to draw subtitles, long labels, bullet lists, tiny annotations, or UI-like small text.",
    "visual 必须是服务于这一段旁白的静帧画面，要表现旁白里的具体对象、因果关系、对比、例子、动作线索或状态变化，而不是泛泛表现整个主题。",
    "写 visual 前先和 narration 对照：如果观众只听这一段旁白、只看这一张画面，也应该觉得两者是在讲同一个点。",
    "描述一个明确主体、场景、构图、动作或变化，不要只写“对比图”“流程图”这种抽象类型。",
    "每个正文分镜只保留一个视觉主体和一个动作/变化；画面简洁，最多 1-3 个主要视觉元素，背景干净，避免拥挤细节。",
    "For complete text/data, preserve facts and order while turning them into narrative beats.",
    "For complete source text, preserve semantic continuity across frames. Do not split one fact into broken narration fragments.",
    "If the user provided explicit modules or focus areas, prioritize that order and structure over generic templates.",
    "For data/business videos, show concrete visual scenes such as metric boards, segment comparison, timeline, analyst desk, or risk checklist; no fake numbers and no dense subtitles.",
    "视频分镜阶段不要输出 imagePrompt 或 imagePromptDraft。Prompt3 会在 step5 基于 title、narration 和 visual 再生成图片提示词。",
    "Keep narration and visual consistent: same frame topic and facts, different jobs. Narration is for audio; visual is for the later image prompt.",
    "Do not leak English prompt logic, schema explanations, internal rules, or placeholders into user-visible draft copy.",
  ].join("\n");
}

export function getVisualizationTypeCatalog(): Array<{
  key: VisualizationType;
  label: string;
  whenToUse: string;
  suitableContentTypes: string[];
  avoidFor: string[];
}> {
  return (Object.entries(VISUALIZATION_TYPE_DEFINITIONS) as Array<
    [VisualizationType, VisualizationTypeDefinition]
  >).map(([key, value]) => ({
    key,
    label: value.label,
    whenToUse: value.whenToUse,
    suitableContentTypes: value.suitableContentTypes,
    avoidFor: value.avoidFor,
  }));
}

export function getVisualizationRecommendation(input: {
  direction: DraftDirection;
  topic: string;
  userPrompt: string;
}): VisualizationRecommendation {
  const topic = (input.topic || "知识主题").trim();
  const userPrompt = (input.userPrompt || "").trim();
  const picked = pickVisualizationType(topic, userPrompt, input.direction);
  return {
    type: picked.type,
    label: VISUALIZATION_TYPE_DEFINITIONS[picked.type].label,
    reason: picked.reason,
  };
}

export function buildContentDraftPrompt(input: ContentDraftPromptInput): ContentDraftPromptBundle {
  const topic = (input.topic || "知识主题").trim();
  const userPrompt = (input.userPrompt || "").trim() || "无";
  const count = Math.max(1, Math.round(input.count || 1));
  const ratioOrSize = (input.ratioOrSize || "未指定").trim();
  const outputLanguage = input.outputLanguage ?? "en";
  const picked = pickVisualizationType(topic, userPrompt, input.direction);
  const systemPrompt = buildSharedSystemPromptByLanguage(outputLanguage);

  if (input.direction === "poster") {
    return {
      systemPrompt,
      userPrompt: buildPosterPrompt(
        topic,
        userPrompt,
        count,
        ratioOrSize,
        picked.type,
        picked.reason,
        outputLanguage,
        input.draftBatch,
      ),
      recommendedVisualizationType: picked.type,
      recommendedVisualizationReason: picked.reason,
    };
  }

  if (input.direction === "ppt") {
    return {
      systemPrompt,
      userPrompt: buildPptPrompt(
        topic,
        userPrompt,
        count,
        ratioOrSize,
        picked.type,
        picked.reason,
        outputLanguage,
        input.draftBatch,
      ),
      recommendedVisualizationType: picked.type,
      recommendedVisualizationReason: picked.reason,
    };
  }

  return {
    systemPrompt,
      userPrompt: buildVideoPrompt(
      topic,
      userPrompt,
      count,
      ratioOrSize,
        picked.type,
        picked.reason,
        outputLanguage,
        input.draftBatch,
      ),
    recommendedVisualizationType: picked.type,
    recommendedVisualizationReason: picked.reason,
  };
}
