import { NextRequest, NextResponse } from "next/server";
import { buildContentDraftPrompt } from "@/lib/prompts/content-draft";

export const runtime = "nodejs";

type PosterDraft = {
  headline: string;
  subtitle: string;
  body: string;
  points: string[];
  cta: string;
  size?: string;
  visualType?: string;
  layoutSuggestion?: string;
  visualElements?: string[];
};

type PosterPlanItem = {
  index: number;
  title: string;
  focus: string;
};

type PosterDraftRequest = {
  topic?: string;
  prompt?: string;
  posterCount?: number;
  posterSizeLabel?: string;
};

type PosterRenderSpec = {
  version: "v1";
  language: "zh-CN";
  layoutTemplate: "three-column-causal-infographic";
  ratio: string;
  title: string;
  subtitle: string;
  topic: string;
  visualType: string;
  sections: {
    leftPanel: {
      title: string;
      objective: string;
      exampleItems: string[];
      emphasis: string;
    };
    middlePanel: {
      title: string;
      causalSteps: string[];
      visualAnchors: string[];
    };
    rightPanel: {
      title: string;
      beforeState: string[];
      afterState: string[];
      conclusion: string;
    };
    bottomSummary: {
      chain: string[];
      finalTakeaway: string;
    };
  };
  renderingConstraints: {
    maxTextLinesPerBlock: number;
    avoidLongParagraph: boolean;
    emphasizeNumbers: boolean;
    iconStyle: "flat-illustration";
    chartStyle: "simple-high-contrast";
  };
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function cleanSentence(input: string) {
  return input.replace(/\s+/g, "").trim();
}

function buildFallbackPosterDraft(
  topic: string,
  sizeLabel: string | undefined,
  prompt: string,
): PosterDraft {
  if (/洋流|海流/.test(topic)) {
    return {
      headline: "洋流循环如何影响全球气候？",
      subtitle: "三条链路看懂“海洋输送带”",
      body: "洋流把热量和水汽从低纬输送到高纬，直接改变沿海地区的温度、降水和渔业分布。海温异常时，这些影响会在一个季节内被放大。",
      points: [
        "热量输送：暖流让高纬沿海更温和。",
        "降水变化：洋流改变水汽路径与降雨带。",
        "生态与渔业：海温变化会推动鱼群迁移。",
        "极端事件：异常海温会放大局地气候波动。",
      ],
      cta: "先画三条箭头：热量、水汽、鱼群迁移。",
      size: sizeLabel,
      visualType: "路径流向图",
      layoutSuggestion: "上方标题 + 中部三链路箭头 + 下方影响结论",
      visualElements: ["海洋环流箭头", "低纬/高纬温差", "降水带变化", "渔业迁移路径"],
    };
  }

  if (/通货膨胀/.test(topic)) {
    return {
      headline: "通货膨胀为什么会影响日常生活？",
      subtitle: "同样的钱，为什么越花越不经用",
      body: "通货膨胀不是抽象名词，它会直接改变你每天的消费体验。比如去年 20 元能买到一份午餐，今年可能需要 24 元；同样预算下，能买到的商品和服务变少，这就是购买力下降。",
      points: [
        "食品和交通价格上涨最先被感知：买菜、打车、外卖会更贵。",
        "固定工资人群压力更大：收入不变，但房租、水电和日用品持续涨价。",
        "储蓄会被“慢慢稀释”：如果存款利率低于通胀率，钱的实际价值会下降。",
        "消费结构会变化：家庭会优先保留刚需支出。",
      ],
      cta: "学会看 CPI、控制不必要支出、优先配置抗通胀资产。",
      size: sizeLabel,
      visualType: "因果流图",
      layoutSuggestion: "左侧价格变化示例 + 中部四节点因果链 + 右侧家庭预算变化",
      visualElements: ["20元→24元价格标签", "工资与物价对比线", "储蓄购买力下降", "刚需占比上升饼图"],
    };
  }

  const tone = /生动|趣味|轻松/.test(prompt) ? "更生动" : /专业|严谨/.test(prompt) ? "更专业" : "更清晰";
  return {
    headline: `${topic}：关键机制与现实影响`,
    subtitle: tone,
    body: `${topic}会直接改变日常决策与成本结构。典型表现是同样预算下可获得资源减少、选择范围变窄，个体需要在效率、价格和风险之间重新平衡。`,
    points: [
      `${topic}的上游变量变化会先体现在成本端，并在短周期内传导到终端价格。`,
      "终端价格上行后，用户通常会从高弹性消费转向刚需消费，消费结构出现收缩。",
      "当收入增速低于相关成本增速时，实际购买力下降，储蓄和消费决策会同步调整。",
      "可跟踪一个核心指标作为判断基准，并结合连续周期变化评估趋势是否延续。",
    ],
    cta: "收藏这张图，1 分钟复习知识主线",
    size: sizeLabel,
    visualType: "因果流图",
    layoutSuggestion: "上方标题 + 中部机制链路 + 下方结论区",
    visualElements: ["关键变量A", "关键变量B", "变化结果", "行动建议"],
  };
}

function buildFallbackPlanList(topic: string, count: number): PosterPlanItem[] {
  const seed = [
    { title: `${topic} · 核心问题`, focus: "用一句话提出问题并建立兴趣" },
    { title: `${topic} · 关键机制`, focus: "拆解机制过程，突出因果关系" },
    { title: `${topic} · 结论与应用`, focus: "总结重点并给出应用场景" },
    { title: `${topic} · 复习速记`, focus: "高密度关键词速查版" },
    { title: `${topic} · 关键案例`, focus: "增加真实场景案例，提高理解与记忆" },
    { title: `${topic} · 误区澄清`, focus: "澄清常见误解，避免概念混淆" },
    { title: `${topic} · 图解总结`, focus: "将重点压缩成可视化结论" },
    { title: `${topic} · 延展阅读`, focus: "补充延伸问题与探索方向" },
    { title: `${topic} · 对比视角`, focus: "通过对比强化关键差异" },
    { title: `${topic} · 快速复盘`, focus: "用一屏完成核心要点复习" },
  ];
  const list = Array.from({ length: count }, (_, idx) => seed[idx % seed.length]);
  return list.map((item, idx) => ({
    index: idx + 1,
    title: item.title,
    focus: item.focus,
  }));
}

function parseJsonContent(content: string) {
  try {
    return JSON.parse(content) as {
      headline?: string;
      subtitle?: string;
      body?: string;
      points?: string[];
      cta?: string;
      visualType?: string;
      layoutSuggestion?: string;
      visualElements?: string[];
      posterDraft?: {
        headline?: string;
        subtitle?: string;
        body?: string;
        points?: string[];
        cta?: string;
        visualType?: string;
        layoutSuggestion?: string;
        visualElements?: string[];
      };
      legacyCompat?: {
        headline?: string;
        subtitle?: string;
        body?: string;
        points?: string[];
        cta?: string;
        visualType?: string;
        layoutSuggestion?: string;
        visualElements?: string[];
      };
      planList?: Array<{ title?: string; focus?: string }>;
    };
  } catch {
    return null;
  }
}

function enforcePosterSpecificity(draft: PosterDraft, topic: string): PosterDraft {
  const genericPointPatterns = [/关键变量/, /变化结果/, /行动建议/, /机制链路/, /补充指标/, /可执行/];
  const hasGenericPoint = draft.points.some((point) => genericPointPatterns.some((rule) => rule.test(point)));
  if (!hasGenericPoint) {
    return draft;
  }

  if (/通货膨胀/.test(topic)) {
    return {
      ...draft,
      headline: "通货膨胀为什么会影响日常生活？",
      subtitle: "同样的钱，为什么越花越不经用",
      body: "通货膨胀会直接改变你的日常开销。比如去年 20 元能买到一份午餐，今年可能需要 24 元；同样预算下，买到的东西更少，这就是购买力下降。",
      points: [
        "菜价、外卖、交通费用上涨最先被感知。",
        "工资增速跟不上物价时，家庭可支配收入会被压缩。",
        "存款利率低于通胀率时，钱的实际价值会被慢慢稀释。",
        "家庭预算会向刚需倾斜，非必要消费被延后。",
      ],
      visualType: "因果流图",
      layoutSuggestion: "左侧价格变化示例 + 中部四节点因果链 + 右侧家庭预算变化",
      visualElements: ["20元→24元价格标签", "工资与物价对比线", "储蓄购买力下降", "刚需占比上升饼图"],
    };
  }

  return {
    ...draft,
    points: draft.points.map((item) => item.replace(/关键变量|变化结果|行动建议/g, topic)),
  };
}

function buildPosterRenderSpec(params: {
  topic: string;
  sizeLabel?: string;
  draft: PosterDraft;
}): PosterRenderSpec {
  const { topic, sizeLabel, draft } = params;
  const chainItems =
    draft.points.length >= 4
      ? draft.points.slice(0, 4).map((item) => cleanSentence(item))
      : [
          `${topic}先体现在高频消费价格变化`,
          "工资与物价增速差拉低可支配收入",
          "储蓄实际购买力持续下降",
          "家庭预算向刚需倾斜并压缩非必要消费",
        ];

  return {
    version: "v1",
    language: "zh-CN",
    layoutTemplate: "three-column-causal-infographic",
    ratio: sizeLabel || "9:16",
    title: draft.headline,
    subtitle: draft.subtitle,
    topic,
    visualType: draft.visualType || "因果流图",
    sections: {
      leftPanel: {
        title: "价格变化示例",
        objective: "用 2-4 个日常高频项目建立通胀感知",
        exampleItems: [
          "午餐价格：去年 20 元 → 今年 24 元",
          "蔬菜价格：去年 3.5 元 → 今年 4.6 元",
          "外卖咖啡：去年 16 元 → 今年 20 元",
          "地铁单程：去年 2 元 → 今年 2.5 元",
        ],
        emphasis: "同样预算下可购买数量下降，购买力下滑。",
      },
      middlePanel: {
        title: draft.layoutSuggestion || "通胀影响链路（四步因果）",
        causalSteps: chainItems,
        visualAnchors: draft.visualElements?.length
          ? draft.visualElements
          : ["价格标签对比", "工资/物价双线", "利率与通胀对比", "预算结构变化"],
      },
      rightPanel: {
        title: "家庭预算变化",
        beforeState: ["住房 30%", "食品 20%", "交通 15%", "其他 35%"],
        afterState: ["住房 32%", "食品 25%", "交通 18%", "其他 25%"],
        conclusion: "刚需占比上升，非必要消费占比下降。",
      },
      bottomSummary: {
        chain: ["物价上涨", "收入跟不上", "储蓄贬值", "预算收紧"],
        finalTakeaway: draft.cta || "通胀不止是数字变化，它会改变你的生活选择。",
      },
    },
    renderingConstraints: {
      maxTextLinesPerBlock: 3,
      avoidLongParagraph: true,
      emphasizeNumbers: true,
      iconStyle: "flat-illustration",
      chartStyle: "simple-high-contrast",
    },
  };
}

function buildInternalModelPrompt(spec: PosterRenderSpec) {
  return [
    "You are generating one Chinese knowledge infographic poster.",
    `Topic: ${spec.topic}`,
    `Title: ${spec.title}`,
    `Subtitle: ${spec.subtitle}`,
    `Layout: ${spec.layoutTemplate}`,
    `Visual type: ${spec.visualType}`,
    `Aspect ratio: ${spec.ratio}`,
    "Panel rules:",
    `1) Left panel = ${spec.sections.leftPanel.title}; show concrete price changes with arrows and numeric deltas.`,
    `2) Middle panel = ${spec.sections.middlePanel.title}; render 4-step causal chain with downward flow arrows.`,
    `3) Right panel = ${spec.sections.rightPanel.title}; show before/after budget composition using pie charts.`,
    `4) Bottom summary chain = ${spec.sections.bottomSummary.chain.join(" -> ")}.`,
    "Constraints: high legibility, strong hierarchy, concise Chinese labels, no decorative clutter, no extra narrative blocks.",
    "Use flat illustration icons and simple high-contrast charts.",
  ].join("\n");
}

function hasAbstractPosterDraft(posterDraft: PosterDraft) {
  const body = posterDraft.body.replace(/\s+/g, "");
  const abstractBody =
    /问题引入|机制解释|关键结论|写作结构|用一句话|拆解原理|建议补充|展开|可感知场景|先给一个可观察现象/.test(
      body,
    );
  const templateBody =
    /围绕|先.*再.*最后|便于|用于|建议|可执行结论|可观察现象|直接绘制|图文内容|结构化/.test(body);
  const abstractPoint = posterDraft.points.some((point) =>
    /用一句话|解释背后|拆解|给出|建议补充|写作|结构|关键原因\d|供给端变化|需求端变化|外部冲击|现象：|原因：|结论：|提示：|补充指标/.test(
      point.replace(/\s+/g, ""),
    ),
  );
  return abstractBody || templateBody || abstractPoint;
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as PosterDraftRequest;
    const topic = (payload.topic ?? "知识主题").trim() || "知识主题";
    const prompt = (payload.prompt ?? "").trim();
    const posterCount = clamp(Math.round(payload.posterCount ?? 1), 1, 10);
    const posterSizeLabel = payload.posterSizeLabel?.trim();

    const fallbackDraft = buildFallbackPosterDraft(topic, posterSizeLabel, prompt);
    const fallbackPlan = buildFallbackPlanList(topic, posterCount);
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        posterDraft: fallbackDraft,
        planList: fallbackPlan,
        source: "fallback",
      });
    }

    const model = process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini";
    const promptBundle = buildContentDraftPrompt({
      direction: "poster",
      topic,
      userPrompt: prompt,
      count: posterCount,
      ratioOrSize: posterSizeLabel,
    });

    const completionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.6,
        messages: [
          { role: "system", content: promptBundle.systemPrompt },
          { role: "user", content: promptBundle.userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!completionResponse.ok) {
      const errText = await completionResponse.text();
      return NextResponse.json(
        {
          posterDraft: fallbackDraft,
          planList: fallbackPlan,
          source: "fallback",
          error: `LLM request failed: ${errText.slice(0, 200)}`,
        },
        { status: 200 },
      );
    }

    const data = (await completionResponse.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = parseJsonContent(content);

    if (!parsed) {
      return NextResponse.json({
        posterDraft: fallbackDraft,
        planList: fallbackPlan,
        source: "fallback",
      });
    }

    const mergedPosterDraft = parsed.posterDraft ?? parsed.legacyCompat ?? parsed;
    const posterDraft: PosterDraft = {
      headline: mergedPosterDraft.headline?.trim() || fallbackDraft.headline,
      subtitle: mergedPosterDraft.subtitle?.trim() || fallbackDraft.subtitle,
      body: mergedPosterDraft.body?.trim() || fallbackDraft.body,
      points:
        Array.isArray(mergedPosterDraft.points) && mergedPosterDraft.points.length
          ? mergedPosterDraft.points.slice(0, 5).map((item) => item.trim()).filter(Boolean)
          : fallbackDraft.points,
      cta: mergedPosterDraft.cta?.trim() || fallbackDraft.cta,
      size: posterSizeLabel,
      visualType: mergedPosterDraft.visualType?.trim() || fallbackDraft.visualType,
      layoutSuggestion: mergedPosterDraft.layoutSuggestion?.trim() || fallbackDraft.layoutSuggestion,
      visualElements:
        Array.isArray(mergedPosterDraft.visualElements) && mergedPosterDraft.visualElements.length
          ? mergedPosterDraft.visualElements.slice(0, 6).map((item) => item.trim()).filter(Boolean)
          : fallbackDraft.visualElements,
    };

    if (hasAbstractPosterDraft(posterDraft)) {
      posterDraft.body = fallbackDraft.body;
      posterDraft.points = fallbackDraft.points;
    }

    const specificPosterDraft = enforcePosterSpecificity(posterDraft, topic);

    const compactBody = specificPosterDraft.body
      .split(/[。！？]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 3)
      .join("。");
    specificPosterDraft.body = compactBody ? `${compactBody}。` : fallbackDraft.body;
    specificPosterDraft.points = (specificPosterDraft.points.length ? specificPosterDraft.points : fallbackDraft.points)
      .slice(0, 5)
      .map((point) => point.trim())
      .filter(Boolean);
    if (!specificPosterDraft.visualType) {
      specificPosterDraft.visualType = fallbackDraft.visualType;
    }
    if (!specificPosterDraft.layoutSuggestion) {
      specificPosterDraft.layoutSuggestion = fallbackDraft.layoutSuggestion;
    }
    if (!specificPosterDraft.visualElements?.length) {
      specificPosterDraft.visualElements = fallbackDraft.visualElements;
    }

    const renderSpec = buildPosterRenderSpec({
      topic,
      sizeLabel: posterSizeLabel,
      draft: specificPosterDraft,
    });
    const internalModelPrompt = buildInternalModelPrompt(renderSpec);

    const planList: PosterPlanItem[] =
      Array.isArray(parsed.planList) && parsed.planList.length
        ? Array.from({ length: posterCount }, (_, idx) => {
            const item = parsed.planList?.[idx] ?? parsed.planList?.[parsed.planList.length - 1];
            const fallback = fallbackPlan[idx];
            return {
              index: idx + 1,
              title: item?.title?.trim() || fallback.title,
              focus: item?.focus?.trim() || fallback.focus,
            };
          })
        : fallbackPlan;

    return NextResponse.json({
      posterDraft: specificPosterDraft,
      planList,
      source: "llm",
      _internal: {
        renderSpec,
        modelPrompt: internalModelPrompt,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
