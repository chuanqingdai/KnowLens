export type DraftDirection = "poster" | "ppt" | "video";

export type ContentDraftPromptInput = {
  direction: DraftDirection;
  topic: string;
  userPrompt: string;
  count: number;
  ratioOrSize?: string;
};

export type VisualizationType =
  | "causal-flow"
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
  ],
  video: [
    "视频分镜优质标准：",
    "1) 单镜头信息要短平快，适合 6-10 秒节奏。",
    "2) 旁白直给结论，避免复杂从句。",
    "3) 画面尽量不用小字，核心信息通过主体和动作表达。",
    "4) 分镜之间要有连续性，避免叙事跳跃。",
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
  return [
    "你是知识可视化内容生成助手。输出必须为中文 JSON。",
    ...QUALITY_DEFINITION,
    ...CONSISTENCY_RULES,
    ...IMAGE2_RULES,
    ...formatVisualizationCatalogForPrompt(),
    ...SHARED_CONSTRAINTS,
  ].join("\n");
}

function buildPosterPrompt(
  topic: string,
  userPrompt: string,
  count: number,
  ratioOrSize: string,
  recommendedType: VisualizationType,
  recommendedReason: string,
) {
  return [
    "方向：海报",
    `主题：${topic}`,
    `用户原始需求：${userPrompt}`,
    `海报数量：${count}`,
    `尺寸：${ratioOrSize}`,
    `推荐可视化类型：${recommendedType}`,
    `推荐原因：${recommendedReason}`,
    ...DIRECTIONAL_QUALITY_STANDARDS.poster,
    "输出结构（必须严格遵守）：",
    "{",
    '  "contentMeta": { "visualizationType": "...", "visualizationReason": "...", "consistencyNotes": ["..."] },',
    '  "posterDraft": { "headline": "...", "subtitle": "...", "body": "...", "points": ["...","...","..."], "visualType": "...", "layoutSuggestion": "...", "visualElements": ["..."], "cta": "..." },',
    '  "planList": [',
    '    { "index": 1, "title": "...", "focus": "...", "visualType": "...", "imagePrompt": "..." }',
    "  ],",
    '  "legacyCompat": { "headline": "...", "subtitle": "...", "body": "...", "points": ["..."], "visualType": "...", "layoutSuggestion": "...", "visualElements": ["..."], "cta": "..." }',
    "}",
    "硬约束：",
    "1) body 控制在 3-4 句，信息完整且可画，允许比 PPT/视频更高的信息密度。",
    "2) points 为 5-6 条，每条一句，建议 18-36 个中文字符。",
    "3) planList 长度必须等于海报数量。",
    "4) imagePrompt 必须符合 GPT Image 2 要求，包含主体+场景+构图+风格关键词。",
    "5) 禁止输出总结性写作提示语（如“围绕…展开”“先…再…最后…”“采用…结构”）。",
    "6) 每条 points 必须是可直接上图的信息点，包含明确主体或现象，不可写“补充/建议/说明”。",
    "7) body 必须直接陈述可验证事实或机制，不可写抽象元叙事。",
    "8) visualType 必须填写可视化类型（例如：因果流图/对比图/时间线）。",
    "9) layoutSuggestion 必须给出版式建议（一句话，直接用于排版）。",
    "10) visualElements 输出 4-6 个元素词组，用于直接绘制。",
  ].join("\n");
}

function buildPptPrompt(
  topic: string,
  userPrompt: string,
  count: number,
  ratioOrSize: string,
  recommendedType: VisualizationType,
  recommendedReason: string,
) {
  return [
    "方向：PPT",
    `主题：${topic}`,
    `用户原始需求：${userPrompt}`,
    `页数：${count}`,
    `比例：${ratioOrSize}`,
    `推荐可视化类型：${recommendedType}`,
    `推荐原因：${recommendedReason}`,
    ...DIRECTIONAL_QUALITY_STANDARDS.ppt,
    "输出结构（必须严格遵守）：",
    "{",
    '  "contentMeta": { "visualizationType": "...", "visualizationReason": "...", "consistencyNotes": ["..."] },',
    '  "outlineItems": ["..."],',
    '  "slideDrafts": [',
    '    { "page": 1, "title": "...", "mainPoint": "...", "body": "...", "supportNote": "...", "visual": "...", "imagePrompt": "..." }',
    "  ]",
    "}",
    "硬约束：",
    "1) outlineItems 和 slideDrafts 长度都必须等于页数。",
    "2) 每页必须有 mainPoint（一句话重点）。",
    "3) 每页 body 控制在 1-2 句，信息密度中等，具体且一致，不得空泛。",
    "4) supportNote 为可选小字，1 句以内，用于补充定义/来源提示。",
    "5) 每页 visual 必须明确图形类型与元素数量。",
    "6) imagePrompt 符合 GPT Image 2 要求，可直接用于生成页面主视觉。",
  ].join("\n");
}

function buildVideoPrompt(
  topic: string,
  userPrompt: string,
  count: number,
  ratioOrSize: string,
  recommendedType: VisualizationType,
  recommendedReason: string,
) {
  return [
    "方向：视频分镜",
    `主题：${topic}`,
    `用户原始需求：${userPrompt}`,
    `分镜数量：${count}`,
    `比例：${ratioOrSize}`,
    `推荐可视化类型：${recommendedType}`,
    `推荐原因：${recommendedReason}`,
    ...DIRECTIONAL_QUALITY_STANDARDS.video,
    "输出结构（必须严格遵守）：",
    "{",
    '  "contentMeta": { "visualizationType": "...", "visualizationReason": "...", "consistencyNotes": ["..."] },',
    '  "outlineItems": ["..."],',
    '  "storyboardDrafts": [',
    '    { "index": 1, "title": "...", "durationSec": 8, "narration": "...", "visual": "...", "onScreenText": "...", "imagePrompt": "..." }',
    "  ]",
    "}",
    "硬约束：",
    "1) outlineItems 与 storyboardDrafts 长度必须等于分镜数量。",
    "2) 每个分镜 durationSec 默认 6-10 秒。",
    "3) narration 每条必须 1 句，尽量 14-26 个中文字符，适合 TTS 快速播报。",
    "4) onScreenText 默认留空；若必须出现，最多 6 个中文字符，严禁小字说明。",
    "5) 画面信息优先靠主体动作和构图表达，不依赖屏幕文字解释。",
    "6) visual 和 imagePrompt 必须描述清楚镜头主体、环境、构图与动作。",
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
  const picked = pickVisualizationType(topic, userPrompt, input.direction);
  const systemPrompt = buildSharedSystemPrompt();

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
    ),
    recommendedVisualizationType: picked.type,
    recommendedVisualizationReason: picked.reason,
  };
}
