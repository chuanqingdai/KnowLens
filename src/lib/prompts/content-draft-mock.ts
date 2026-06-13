import type { DraftDirection } from "./content-draft";

export type DraftMode = "mock" | "auto";

export type MockDraftPayload =
  | {
      direction: "poster";
      contentMeta: {
        visualizationType: string;
        visualizationReason: string;
        consistencyNotes: string[];
      };
      posterDraft: {
        headline: string;
        subtitle: string;
        body: string;
        points: string[];
        cta: string;
        visualType: string;
        layoutSuggestion: string;
        visualElements: string[];
      };
      planList: Array<{ index: number; title: string; focus: string }>;
    }
  | {
      direction: "ppt";
      contentMeta: {
        visualizationType: string;
        visualizationReason: string;
        consistencyNotes: string[];
      };
      outlineItems: string[];
      slideDrafts: Array<{
        page: number;
        title: string;
        mainPoint: string;
        body: string;
        supportNote: string;
        visual: string;
        imagePrompt: string;
      }>;
    }
  | {
      direction: "video";
      contentMeta: {
        visualizationType: string;
        visualizationReason: string;
        consistencyNotes: string[];
      };
      outlineItems: string[];
      storyboardDrafts: Array<{
        index: number;
        title: string;
        durationSec: number;
        narration: string;
        visual: string;
        onScreenText: string;
        imagePrompt: string;
      }>;
    };

function makeMeta(direction: DraftDirection) {
  const label = direction === "poster" ? "因果流图" : direction === "ppt" ? "步骤流程图" : "时间线";
  return {
    visualizationType: label,
    visualizationReason: `Mock mode for ${direction} flow testing.`,
    consistencyNotes: ["Mock draft enabled for stable UI testing.", "All content is deterministic."],
  };
}

function makePosterMock(topic: string, count: number): MockDraftPayload {
  const outline = Array.from({ length: count }, (_, idx) => idx + 1).map((index) => ({
    index,
    title: `${topic} · 第${index}张`,
    focus: `固定测试草稿 ${index}`,
  }));
  return {
    direction: "poster",
    contentMeta: makeMeta("poster"),
    posterDraft: {
      headline: `${topic} 的可视化草稿`,
      subtitle: "Mock 模式稳定输出，用于流程联调",
      body: `这是 ${topic} 的测试草稿，用于验证海报文案、配置确认和后续绘制流程。`,
      points: [
        "第一条测试要点：结构稳定",
        "第二条测试要点：字段完整",
        "第三条测试要点：可直接进入绘制",
        "第四条测试要点：联调用例清晰",
      ],
      cta: "下一步进入风格选择",
      visualType: "因果流图",
      layoutSuggestion: "标题 + 3 个信息块 + 结论条",
      visualElements: ["标题", "箭头链路", "重点数字", "结论区"],
    },
    planList: outline,
  };
}

function makePptMock(topic: string, count: number): MockDraftPayload {
  const outlineItems = Array.from({ length: count }, (_, idx) => `${topic} · 第${idx + 1}页`);
  const slideDrafts = outlineItems.map((title, idx) => ({
    page: idx + 1,
    title,
    mainPoint: `PPT 测试重点 ${idx + 1}`,
    body: `这是第 ${idx + 1} 页的测试文稿，用于验证 PPT 大纲、页面文案和风格选择流程。`,
    supportNote: "Mock 小字注释",
    visual: "单页重点 + 单一图形元素",
    imagePrompt: "clean infographic slide, simple layout, one key visual, readable title",
  }));
  return {
    direction: "ppt",
    contentMeta: makeMeta("ppt"),
    outlineItems,
    slideDrafts,
  };
}

function makeVideoMock(topic: string, count: number): MockDraftPayload {
  const outlineItems = Array.from({ length: count }, (_, idx) => `${topic} · 镜头 ${idx + 1}`);
  const storyboardDrafts = outlineItems.map((title, idx) => ({
    index: idx + 1,
    title,
    durationSec: 8,
    narration: `第 ${idx + 1} 个镜头测试旁白。`,
    visual: "主体居中，动作明确，字幕极少",
    onScreenText: "",
    imagePrompt: "cinematic explainer frame, centered subject, clear motion, minimal text",
  }));
  return {
    direction: "video",
    contentMeta: makeMeta("video"),
    outlineItems,
    storyboardDrafts,
  };
}

export function buildMockDraftPayload(input: {
  direction: DraftDirection;
  topic: string;
  count: number;
}): MockDraftPayload {
  const topic = input.topic.trim() || "知识主题";
  const count = Math.max(1, Math.round(input.count || 1));
  if (input.direction === "ppt") {
    return makePptMock(topic, count);
  }
  if (input.direction === "video") {
    return makeVideoMock(topic, count);
  }
  return makePosterMock(topic, count);
}

