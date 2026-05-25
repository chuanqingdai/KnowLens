"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowUp, LoaderCircle } from "lucide-react";
import { useSession } from "next-auth/react";

import {
  ChatPanel,
  type ChatTurn,
  type WorkspaceIntent,
} from "@/components/workspace/ChatPanel";
import { StoryboardCanvas } from "@/components/workspace/StoryboardCanvas";
import { PosterCanvas } from "@/components/workspace/PosterCanvas";
import { TopBar } from "@/components/workspace/TopBar";
import { outlineItems as volcanoOutlineItems, slideDrafts as volcanoSlideDrafts } from "@/components/workspace/mockData";
import {
  appendCreditRecord,
  getCreditRecords,
  getSubscriptionByUser,
} from "@/lib/billing";
import {
  STANDARD_OUTPUT_PROMO_CREDITS,
  STANDARD_OUTPUT_REGULAR_CREDITS,
} from "@/lib/credit-pricing";
import {
  ensureUserProjectByEmail,
  getAdminProjects,
  getAdminUserByEmail,
  getProjectsByUser,
} from "@/lib/admin";
import { getVisualizationRecommendation } from "@/lib/prompts/content-draft";

type HomeSourceKind = "file" | "web" | "youtube";
type HomeSourceItem = {
  id: string;
  kind: HomeSourceKind;
  name: string;
  origin: string;
  status: "extracting" | "ready";
  excerpt: string;
};
type HomeDraftPayload = {
  prompt?: string;
  textModel?: string;
  imageModel?: string;
  sources?: HomeSourceItem[];
};

type SlideDraft = {
  page: number;
  title: string;
  body: string;
  visual: string;
};

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

type FlowStage = "intent" | "config" | "content" | "style" | "billing" | "generate";

type ParsedContentEditCommand = {
  target:
    | { kind: "slide"; index: number }
    | { kind: "poster"; index: number }
    | { kind: "all" };
  action: "shorten" | "enhance" | "append";
  payload: string;
};

type WorkspaceSessionPrefs = {
  intent: Exclude<WorkspaceIntent, "unknown">;
  posterCount: number;
  posterSizeId: string | null;
  pptPageCount: number;
  pptRatio: "16:9" | "4:3";
  videoStoryboardCount: number;
  videoRatio: "16:9" | "9:16";
  styleId: string;
};

type ConfirmedConfigSnapshot = {
  intent: Exclude<WorkspaceIntent, "unknown">;
  posterCount: number;
  posterSizeId: string | null;
  pptPageCount: number;
  pptRatio: "16:9" | "4:3";
  videoStoryboardCount: number;
  videoRatio: "16:9" | "9:16";
};

const HOME_DRAFT_KEY = "knowlens-home-draft";
const WORKSPACE_DRAFT_CACHE_KEY = "knowlens-workspace-draft-v1";
const WORKSPACE_SESSION_PREFS_KEY = "knowlens-workspace-session-prefs-v1";
const DRAFT_MODE = process.env.NEXT_PUBLIC_KNOWLENS_DRAFT_MODE === "mock" ? "mock" : "auto";

type StyleDirection = "ppt" | "poster" | "video";
type StyleOption = {
  id: string;
  name: string;
  englishName: string;
  fit: string;
  prompt: string;
  suitableTopics: string;
  carrierPriority: StyleDirection[];
  topicKeywords: string[];
  palette: [string, string, string];
  coverImage: string;
};

const styleCoverFileById: Record<string, string> = {
  "clean-science-infographic": "Clean Science Infographic Style.png",
  "premium-editorial-infographic": "Premium Editorial Infographic Style.png",
  "youtube-science-thumbnail": "YouTube Science Thumbnail Style.png",
  "minimal-line-art": "Minimal Line Art Style.png",
  "hand-drawn-explainer": "Hand-drawn Explainer Style.png",
  "cute-3d-educational": "Cute 3D Educational Style.png",
  "3d-isometric-tech": "3D Isometric Tech Style.png",
  "dark-premium-tech": "Dark Premium Tech Style.png",
  "technical-blueprint": "Technical Blueprint Style.png",
  "medical-educational-illustration": "Medical Educational Illustration Style.png",
  "cinematic-science-illustration": "Cinematic Science Illustration Style.png",
  "premium-sketchnote-science": "Premium Sketchnote Science Style.png",
};

function styleCoverById(styleId: string) {
  const filename = styleCoverFileById[styleId] ?? styleCoverFileById["clean-science-infographic"];
  return `/style/${encodeURIComponent(filename)}`;
}

const styleOptions = [
  {
    id: "clean-science-infographic",
    name: "简洁科普信息图风",
    englishName: "Clean Science Infographic",
    fit: "结构清晰、可读性高，适合机制讲解和通用科普。",
    prompt:
      "clean science infographic style, modern educational design, minimal labels, clear visual hierarchy, soft gradients, high readability, balanced composition",
    suitableTopics: "通用科普、自然科学、物理、地理、人体、机制解释",
    carrierPriority: ["ppt", "poster", "video"],
    topicKeywords: ["科普", "自然", "物理", "地理", "人体", "机制", "原理", "解释"],
    palette: ["#1f2937", "#3b82f6", "#e5e7eb"],
    coverImage: styleCoverById("clean-science-infographic"),
  },
  {
    id: "premium-editorial-infographic",
    name: "高级报告信息图风",
    englishName: "Premium Editorial Infographic",
    fit: "更像专业报告与杂志版式，适合商业与趋势分析。",
    prompt:
      "premium editorial infographic style, professional magazine layout feeling, elegant typography, refined spacing, restrained colors, polished data presentation",
    suitableTopics: "商业分析、经济学、产业研究、AI趋势、社会议题",
    carrierPriority: ["ppt", "poster", "video"],
    topicKeywords: ["商业", "经济", "产业", "趋势", "社会", "市场", "报告", "分析"],
    palette: ["#111827", "#f59e0b", "#f3f4f6"],
    coverImage: styleCoverById("premium-editorial-infographic"),
  },
  {
    id: "youtube-science-thumbnail",
    name: "大主体科普封面风",
    englishName: "YouTube Science Thumbnail Style",
    fit: "冲击力强，适合热点知识和强视觉传播。",
    prompt:
      "bold YouTube science thumbnail style, strong central visual, high contrast, cinematic lighting, eye-catching, dramatic but clean, minimal large text",
    suitableTopics: "宇宙、AI、深海、灾难、人体、科技热点",
    carrierPriority: ["poster", "video", "ppt"],
    topicKeywords: ["宇宙", "ai", "深海", "灾难", "人体", "热点", "火山", "科技"],
    palette: ["#111827", "#ef4444", "#f8fafc"],
    coverImage: styleCoverById("youtube-science-thumbnail"),
  },
  {
    id: "minimal-line-art",
    name: "极简线稿风",
    englishName: "Minimal Line Art",
    fit: "线条克制、留白多，适合基础概念与结构说明。",
    prompt:
      "minimal line art style, thin clean lines, geometric simplicity, strong whitespace, elegant outline drawing, few colors, precise and calm",
    suitableTopics: "基础概念、产品说明、AI原理、简单科学机制",
    carrierPriority: ["ppt", "poster", "video"],
    topicKeywords: ["基础", "概念", "产品", "ai原理", "机制", "结构", "说明"],
    palette: ["#111827", "#64748b", "#f8fafc"],
    coverImage: styleCoverById("minimal-line-art"),
  },
  {
    id: "hand-drawn-explainer",
    name: "手绘教学风",
    englishName: "Hand-drawn Explainer Style",
    fit: "亲和力强，适合儿童和入门向知识讲解。",
    prompt:
      "hand-drawn explainer style, simple sketch lines, soft color fills, friendly educational tone, clear shapes, natural imperfect linework",
    suitableTopics: "儿童科普、生活常识、健康知识、基础物理、心理学",
    carrierPriority: ["video", "ppt", "poster"],
    topicKeywords: ["儿童", "生活常识", "健康", "基础物理", "心理", "入门", "低龄"],
    palette: ["#334155", "#f59e0b", "#fef3c7"],
    coverImage: styleCoverById("hand-drawn-explainer"),
  },
  {
    id: "cute-3d-educational",
    name: "3D 可爱教育风",
    englishName: "Cute 3D Educational Style",
    fit: "形体圆润、学习氛围轻松，适合低龄健康与动物题材。",
    prompt:
      "cute 3D educational style, rounded shapes, soft lighting, friendly objects, playful but clean, bright colors, approachable learning visual",
    suitableTopics: "儿童科普、动物、人体健康、营养、低龄教育",
    carrierPriority: ["video", "poster", "ppt"],
    topicKeywords: ["儿童", "动物", "人体健康", "营养", "低龄", "亲子", "启蒙"],
    palette: ["#0f172a", "#22d3ee", "#dbeafe"],
    coverImage: styleCoverById("cute-3d-educational"),
  },
  {
    id: "3d-isometric-tech",
    name: "3D 等距科技风",
    englishName: "3D Isometric Tech Style",
    fit: "空间结构清晰，适合系统、城市、数据基础设施主题。",
    prompt:
      "3D isometric technology style, modular objects, soft shadows, clean perspective, futuristic but minimal, organized spatial design",
    suitableTopics: "AI系统、数据中心、芯片、城市系统、互联网、能源",
    carrierPriority: ["ppt", "poster", "video"],
    topicKeywords: ["ai系统", "数据中心", "芯片", "城市系统", "互联网", "能源", "架构", "模块"],
    palette: ["#0f172a", "#10b981", "#d1fae5"],
    coverImage: styleCoverById("3d-isometric-tech"),
  },
  {
    id: "dark-premium-tech",
    name: "黑金高端科技风",
    englishName: "Dark Premium Tech Style",
    fit: "高对比、强质感，适合金融科技与未来科技表达。",
    prompt:
      "dark premium tech style, black background, subtle glow, gold or blue highlights, futuristic interface feeling, sleek and high-end",
    suitableTopics: "AI、芯片、金融科技、机器人、数据、未来科技",
    carrierPriority: ["poster", "ppt", "video"],
    topicKeywords: ["ai", "芯片", "金融科技", "机器人", "数据", "未来科技", "前沿"],
    palette: ["#09090b", "#f59e0b", "#1d4ed8"],
    coverImage: styleCoverById("dark-premium-tech"),
  },
  {
    id: "technical-blueprint",
    name: "科技蓝图风",
    englishName: "Technical Blueprint Style",
    fit: "工程感强，适合航天、机械、结构类知识。",
    prompt:
      "technical blueprint style, dark blue grid background, precise schematic lines, engineering drawing aesthetic, clean technical annotations",
    suitableTopics: "航空航天、机械、潜艇、机器人、军事科技、工程结构",
    carrierPriority: ["poster", "ppt", "video"],
    topicKeywords: ["航天", "机械", "潜艇", "机器人", "军事", "工程", "结构", "蓝图"],
    palette: ["#0b2447", "#38bdf8", "#bfdbfe"],
    coverImage: styleCoverById("technical-blueprint"),
  },
  {
    id: "medical-educational-illustration",
    name: "医学科普插画风",
    englishName: "Medical Educational Illustration",
    fit: "专业但不压迫，适合人体与疾病机制科普。",
    prompt:
      "clean medical educational illustration style, soft clinical colors, simplified anatomy, professional healthcare visual, accurate but not overly realistic",
    suitableTopics: "心血管、人体器官、代谢、疾病机制、营养健康",
    carrierPriority: ["ppt", "video", "poster"],
    topicKeywords: ["心血管", "器官", "代谢", "疾病", "营养", "医学", "健康", "人体"],
    palette: ["#0f172a", "#14b8a6", "#e0f2fe"],
    coverImage: styleCoverById("medical-educational-illustration"),
  },
  {
    id: "cinematic-science-illustration",
    name: "电影级科普视觉风",
    englishName: "Cinematic Science Illustration",
    fit: "氛围感和沉浸感强，适合宇宙、灾难、史前等大题材。",
    prompt:
      "cinematic science illustration style, dramatic lighting, realistic atmosphere, strong depth, epic scale, visually immersive but educational",
    suitableTopics: "宇宙、深海、火山、恐龙、灾难、未来城市",
    carrierPriority: ["poster", "video", "ppt"],
    topicKeywords: ["宇宙", "深海", "火山", "恐龙", "灾难", "未来城市", "史前", "行星"],
    palette: ["#111827", "#7c3aed", "#e2e8f0"],
    coverImage: styleCoverById("cinematic-science-illustration"),
  },
  {
    id: "premium-sketchnote-science",
    name: "精致手账科普风",
    englishName: "Premium Sketchnote Science Style",
    fit: "像高质量知识手账与学习卡，适合视觉化笔记表达。",
    prompt:
      "premium sketchnote science style, refined hand-drawn lines, soft color blocks, sticker-like mini icons, subtle paper texture, highlighted key phrases, elegant educational note layout, high readability",
    suitableTopics: "心理学、健康、生活科学、儿童科普、学习方法、认知科学、经济学入门",
    carrierPriority: ["poster", "ppt", "video"],
    topicKeywords: ["心理学", "健康", "生活科学", "儿童科普", "学习方法", "认知科学", "经济学", "入门"],
    palette: ["#1f2937", "#ec4899", "#dbeafe"],
    coverImage: styleCoverById("premium-sketchnote-science"),
  },
] as StyleOption[];

const intentOptions: { id: "ppt" | "video" | "poster"; label: string; desc: string }[] = [
  { id: "poster", label: "生成海报", desc: "用于一图讲清、社媒传播" },
  { id: "video", label: "生成视频", desc: "用于口播、短视频传播" },
  { id: "ppt", label: "生成 PPT", desc: "用于课堂讲解、汇报展示" },
];

const posterSizeOptions = [
  { id: "poster-9-16", label: "9:16 竖版", desc: "适合短视频封面和手机全屏" },
  { id: "poster-9-21", label: "9:21 超长竖版", desc: "适合更长内容与连续图解" },
  { id: "poster-2-3", label: "2:3 长竖版", desc: "适合图文步骤和知识长图" },
  { id: "poster-4-5", label: "4:5 竖版", desc: "适合社交平台信息流" },
  { id: "poster-3-4", label: "3:4 竖版", desc: "兼顾阅读和视觉信息密度" },
  { id: "poster-1-1", label: "1:1 方图", desc: "适合卡片化展示" },
  { id: "poster-16-9", label: "16:9 横版", desc: "适合横向讲解与封面展示" },
  { id: "poster-a4", label: "A4 竖版", desc: "适合打印与课堂张贴" },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(input: string) {
  return input.toLowerCase().replace(/\s+/g, "");
}

function containsAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function detectIntent(
  prompt: string,
  sources: HomeSourceItem[],
): { intent: WorkspaceIntent; confidence: number; reason: string } {
  const text = normalizeText(prompt);
  const scores: Record<Exclude<WorkspaceIntent, "unknown">, number> = {
    ppt: 0,
    video: 0,
    poster: 0,
  };

  if (containsAny(text, ["ppt", "幻灯", "课件", "演示"])) {
    scores.ppt += 4;
  }
  if (containsAny(text, ["视频", "口播", "配音", "短片", "剪辑"])) {
    scores.video += 4;
  }
  if (containsAny(text, ["海报", "长图", "poster", "封面", "图文卡片"])) {
    scores.poster += 4;
  }

  if (containsAny(text, ["10页", "12页", "每页"])) {
    scores.ppt += 2;
  }
  if (containsAny(text, ["分镜", "镜头", "音轨", "tts", "时长"])) {
    scores.video += 2;
  }
  if (containsAny(text, ["尺寸", "9:16", "4:5", "1:1", "a4"])) {
    scores.poster += 2;
  }

  sources.forEach((source) => {
    const sourceText = normalizeText(`${source.name} ${source.origin}`);
    if (source.kind === "youtube") {
      scores.video += 3;
    }
    if (/\.pptx?|课件/.test(sourceText)) {
      scores.ppt += 2;
    }
    if (/\.mp4|\.mov|视频/.test(sourceText)) {
      scores.video += 2;
    }
    if (/\.png|\.jpg|\.jpeg|\.webp|海报|封面|长图/.test(sourceText)) {
      scores.poster += 2;
    }
  });

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  const second = sorted[1];
  const topScore = top?.[1] ?? 0;
  const secondScore = second?.[1] ?? 0;

  if (topScore <= 0) {
    return {
      intent: "unknown",
      confidence: 0.2,
      reason: "没有检测到明确输出类型关键词。",
    };
  }

  if (topScore < 3 || topScore - secondScore <= 1) {
    return {
      intent: "unknown",
      confidence: clamp(0.35 + topScore * 0.08, 0.35, 0.62),
      reason: "检测到多种可能输出方向，需要进一步确认。",
    };
  }

  const intent = top[0] as Exclude<WorkspaceIntent, "unknown">;
  const confidence = clamp(0.5 + (topScore - secondScore) * 0.08 + topScore * 0.03, 0.58, 0.95);
  return {
    intent,
    confidence,
    reason: `已根据关键词和素材类型判断为${intent === "ppt" ? "PPT" : intent === "video" ? "视频" : "海报"}生成。`,
  };
}

function inferRecommendedIntent(
  prompt: string,
  sources: HomeSourceItem[],
): "ppt" | "video" | "poster" {
  const text = normalizeText(prompt);
  if (containsAny(text, ["海报", "长图", "poster", "封面"])) {
    return "poster";
  }
  if (containsAny(text, ["视频", "口播", "分镜", "短片"]) || sources.some((item) => item.kind === "youtube")) {
    return "video";
  }
  return "ppt";
}

function extractTopic(prompt: string, sources: HomeSourceItem[]) {
  const trimmed = prompt.trim();
  if (trimmed) {
    const cleaned = trimmed
      .replace(/^(请|帮我|麻烦|我想|需要)?(生成|制作|做|创建)?/g, "")
      .replace(/(一个|一份|一套|一个关于)/g, "")
      .replace(/(的)?(ppt|视频|海报|长图).*/i, "")
      .replace(/[，。；,.]/g, " ")
      .trim();
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 26);
    }
    return trimmed.slice(0, 26);
  }
  const source = sources[0];
  if (source) {
    return source.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 26);
  }
  return "知识主题";
}

function isWeakPrompt(prompt: string, sources: HomeSourceItem[]) {
  const text = prompt.trim().toLowerCase();
  if (sources.length > 0) {
    return false;
  }
  if (!text) {
    return true;
  }
  if (text.length <= 3) {
    return true;
  }
  const weakPatterns = [
    /^hello\b/,
    /^hi\b/,
    /^hey\b/,
    /^hello world\b/,
    /^test\b/,
    /^你好\b/,
    /^在吗\b/,
    /^测试\b/,
    /^开始\b/,
  ];
  return weakPatterns.some((pattern) => pattern.test(text));
}

function topicHintText(value: string) {
  return value.trim() || "知识主题";
}

function extractPageCount(prompt: string) {
  const match = prompt.match(/(\d+)\s*页/);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

function extractVideoStoryboardCount(prompt: string) {
  const text = normalizeText(prompt);
  const storyboardMatch = text.match(/(\d+)\s*个?分镜/);
  if (storyboardMatch) {
    const value = Number(storyboardMatch[1]);
    if (Number.isFinite(value) && value > 0) {
      return clamp(Math.round(value), 1, 20);
    }
  }
  const durationMatch = text.match(/(\d+)\s*秒/);
  if (durationMatch) {
    const seconds = Number(durationMatch[1]);
    if (Number.isFinite(seconds) && seconds > 0) {
      return clamp(Math.max(1, Math.round(seconds / 10)), 1, 20);
    }
  }
  return null;
}

function extractPosterSize(prompt: string) {
  const text = normalizeText(prompt);
  if (text.includes("9:21") || text.includes("超长竖版")) {
    return "poster-9-21";
  }
  if (text.includes("9:16") || text.includes("竖版") || text.includes("手机全屏")) {
    return "poster-9-16";
  }
  if (text.includes("2:3")) {
    return "poster-2-3";
  }
  if (text.includes("4:5")) {
    return "poster-4-5";
  }
  if (text.includes("3:4")) {
    return "poster-3-4";
  }
  if (text.includes("1:1") || text.includes("方图")) {
    return "poster-1-1";
  }
  if (text.includes("16:9") || text.includes("横版")) {
    return "poster-16-9";
  }
  if (text.includes("a4")) {
    return "poster-a4";
  }
  return null;
}

function buildMissingHints(intent: WorkspaceIntent, prompt: string, posterSizeId: string | null) {
  const hints: string[] = [];
  const text = normalizeText(prompt);
  const hasStyle = containsAny(text, ["风格", "语气", "视觉", "简洁", "生动", "专业", "图解"]);

  if (intent === "unknown") {
    hints.push("你想生成哪种内容：PPT、视频，还是海报");
    return hints;
  }
  if (intent === "ppt") {
    if (!extractPageCount(prompt)) {
      hints.push("建议补充页数（例如：10页）");
    }
    if (!hasStyle) {
      hints.push("建议补充风格偏好（例如：图解化、简洁）");
    }
  }
  if (intent === "video") {
    if (!containsAny(text, ["分镜", "秒", "时长"])) {
      hints.push("建议补充分镜数量（按每个分镜 10 秒估算）");
    }
    if (!containsAny(text, ["口播", "旁白", "配音", "节奏"])) {
      hints.push("建议补充口播或节奏偏好");
    }
  }
  if (intent === "poster") {
    if (!posterSizeId) {
      hints.push("请选择海报尺寸（9:16 / 4:5 / 1:1 / A4）");
    }
    if (!hasStyle) {
      hints.push("建议补充文案风格（例如：专业、简洁、生动）");
    }
  }
  return hints;
}

function buildGenericOutline(topic: string, intent: WorkspaceIntent, count: number) {
  const pptSeed = [
    `${topic}的核心问题与学习目标`,
    `${topic}在现实中的典型场景`,
    `${topic}需要先理解的关键概念`,
    `${topic}的机制链路：触发条件到结果`,
    `${topic}的关键变量与变化路径`,
    `${topic}的常见类型与对比差异`,
    `${topic}案例拆解：一个可复述的真实情境`,
    `${topic}影响评估：个人、行业与系统层面`,
    `${topic}常见误区与纠偏方法`,
    `${topic}总结与行动建议`,
  ];
  const videoSeed = [
    `${topic}开场钩子：一句话提出冲突`,
    `${topic}场景建立：观众可感知的变化`,
    `${topic}机制拆解①：第一层因果`,
    `${topic}机制拆解②：关键变量如何传导`,
    `${topic}对比视角：变化前后差异`,
    `${topic}案例镜头：真实情境复现`,
    `${topic}结论收束：可执行判断`,
    `${topic}行动建议：下一步怎么做`,
  ];
  const defaultSeed = [
    `${topic}是什么`,
    `${topic}的背景与场景`,
    `${topic}的关键机制`,
    `${topic}的影响与应用`,
  ];
  const seed = intent === "video" ? videoSeed : intent === "ppt" ? pptSeed : defaultSeed;
  if (count <= seed.length) {
    return seed.slice(0, count);
  }
  const extra = Array.from({ length: count - seed.length }, (_, idx) => `${topic}进阶补充：扩展主题 ${idx + 1}`);
  return [...seed, ...extra];
}

function buildGenericSlides(topic: string, outline: string[], intent: WorkspaceIntent) {
  return outline.map((title, index) => {
    if (intent === "video") {
      return {
        page: index + 1,
        title,
        body: `镜头目标：用 10 秒讲清“${title}”。口播要点：先说现象，再点出原因，最后落在一个可执行判断；字幕控制为 1 句关键词，避免小字堆叠。`,
        visual: `画面建议：主体居中 + 单一箭头或对比元素；第 ${index + 1} 镜头聚焦一个核心变化，减少装饰信息。`,
      };
    }
    return {
      page: index + 1,
      title,
      body: `本页目标：围绕“${title}”给出可直接讲解的内容。讲解顺序：先定义/现象，再解释机制，最后给一个生活化例子；正文保持 3-4 句，确保能直接用于页面绘制。`,
      visual: `版式建议：标题 + 3 要点 + 1 个示意图；第 ${index + 1} 页突出单一结论，避免信息分散。`,
    };
  });
}

function makePptDensitySlides(slides: SlideDraft[]) {
  return slides.map((slide) => ({
    ...slide,
    body: slide.body.trim(),
  }));
}

function makeVideoDensitySlides(slides: SlideDraft[]) {
  return slides.map((slide) => {
    const conciseBody = slide.body
      .replace(/\s+/g, "")
      .split(/[。！？]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join("。");
    return {
      ...slide,
      body: conciseBody ? `${conciseBody}。` : slide.body,
      visual: slide.visual.replace(/，/g, "、"),
    };
  });
}

function parseContentEditCommand(input: string): ParsedContentEditCommand {
  const raw = input.trim();
  const normalized = normalizeText(raw);
  const slideMatch = raw.match(/第\s*(\d+)\s*(页|段|个分镜)/);
  const posterMatch = raw.match(/第\s*(\d+)\s*张/);
  const target: ParsedContentEditCommand["target"] = slideMatch
    ? { kind: "slide", index: Number(slideMatch[1]) - 1 }
    : posterMatch
      ? { kind: "poster", index: Number(posterMatch[1]) - 1 }
      : { kind: "all" };

  if (containsAny(normalized, ["缩短", "简化", "精简", "短一点"])) {
    return { target, action: "shorten", payload: raw };
  }
  if (containsAny(normalized, ["更生动", "趣味", "案例", "口语化"])) {
    return { target, action: "enhance", payload: raw };
  }
  return { target, action: "append", payload: raw };
}

function buildPosterDraft(
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
      body: "通货膨胀会直接改变你的日常开销。比如去年 20 元能买到一份午餐，今年可能需要 24 元；同样预算下，买到的东西更少，这就是购买力下降。",
      points: [
        "菜价、外卖、交通费用上涨最先被感知。",
        "工资增速跟不上物价时，家庭可支配收入会被压缩。",
        "存款利率低于通胀率时，钱的实际价值会被慢慢稀释。",
        "家庭预算会向刚需倾斜，非必要消费被延后。",
      ],
      cta: "学会看 CPI，优先保留刚需预算，减少冲动消费。",
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

function hasAbstractPosterDraft(draft: PosterDraft) {
  const body = draft.body.replace(/\s+/g, "");
  const abstractBody =
    /问题引入|机制解释|关键结论|写作结构|用一句话|拆解原理|建议补充|展开|可感知场景|先给一个可观察现象/.test(
      body,
    );
  const templateBody =
    /围绕|先.*再.*最后|便于|用于|建议|可执行结论|可观察现象|直接绘制|图文内容|结构化/.test(body);
  const abstractPoint = draft.points.some((point) =>
    /用一句话|解释背后|拆解|给出|建议补充|写作|结构|关键原因\d|供给端变化|需求端变化|外部冲击|现象：|原因：|结论：|提示：|补充指标/.test(
      point.replace(/\s+/g, ""),
    ),
  );
  return abstractBody || templateBody || abstractPoint;
}

function pickSmartStyle(prompt: string, sources: HomeSourceItem[]) {
  return pickSmartStyleByIntent(prompt, sources, "poster");
}

function pickSmartStyleByIntent(
  prompt: string,
  sources: HomeSourceItem[],
  intent: Exclude<WorkspaceIntent, "unknown">,
) {
  const bag = normalizeText(`${prompt} ${sources.map((item) => `${item.name} ${item.excerpt}`).join(" ")}`);
  const intentRankWeight: Record<StyleDirection, number> = {
    poster: 12,
    ppt: 12,
    video: 12,
  };
  const typeSignalWeight = 3;
  const baseScore = 1;

  let best = styleOptions[0];
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const style of styleOptions) {
    let score = baseScore;

    const intentRank = style.carrierPriority.indexOf(intent);
    if (intentRank >= 0) {
      score += (style.carrierPriority.length - intentRank) * intentRankWeight[intent];
    }

    for (const keyword of style.topicKeywords) {
      if (bag.includes(normalizeText(keyword))) {
        score += typeSignalWeight;
      }
    }

    if (score > bestScore) {
      best = style;
      bestScore = score;
    }
  }

  return best;
}

function readHomeDraftPayload() {
  const empty = {
    prompt: "",
    sources: [] as HomeSourceItem[],
    models: null as { textModel: string; imageModel: string } | null,
  };

  if (typeof window === "undefined") {
    return empty;
  }

  const raw =
    window.sessionStorage.getItem(HOME_DRAFT_KEY) ||
    window.localStorage.getItem(WORKSPACE_DRAFT_CACHE_KEY);
  if (!raw) {
    return empty;
  }

  try {
    const payload = JSON.parse(raw) as HomeDraftPayload;
    const next = {
      prompt: (payload.prompt ?? "").trim(),
      sources: Array.isArray(payload.sources) ? payload.sources.slice(0, 6) : [],
      models:
        payload.textModel || payload.imageModel
          ? {
              textModel: payload.textModel ?? "gpt-4.1",
            imageModel: payload.imageModel ?? "gpt-image2",
          }
          : null,
    };
    window.localStorage.setItem(WORKSPACE_DRAFT_CACHE_KEY, JSON.stringify(payload));
    return next;
  } catch {
    return empty;
  }
}

function buildWorkspaceSessionScopeKey(entry: { prompt: string; sources: HomeSourceItem[] }) {
  const base = `${entry.prompt}|${entry.sources.map((item) => `${item.kind}:${item.origin}`).join("|")}`;
  let hash = 0;
  for (let i = 0; i < base.length; i += 1) {
    hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
  }
  return `${WORKSPACE_SESSION_PREFS_KEY}:${hash.toString(16)}`;
}

function readWorkspaceSessionPrefs(scopeKey: string) {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.sessionStorage.getItem(scopeKey);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as Partial<WorkspaceSessionPrefs>;
  } catch {
    return null;
  }
}

export default function WorkspacePage() {
  const { data: session } = useSession();
  const currentEmail = session?.user?.email?.trim().toLowerCase() ?? "";
  const [initialEntry] = useState(() => readHomeDraftPayload());
  const [sessionPrefsScopeKey] = useState(() => buildWorkspaceSessionScopeKey(initialEntry));
  const [sessionPrefs] = useState(() => readWorkspaceSessionPrefs(sessionPrefsScopeKey));
  const [topicContextPrompt, setTopicContextPrompt] = useState(() => initialEntry.prompt);
  const [creditVersion, setCreditVersion] = useState(0);
  const credits = useMemo(() => {
    void creditVersion;
    return getCreditRecords(currentEmail)[0]?.balance ?? 80;
  }, [currentEmail, creditVersion]);
  const isFreeUser = useMemo(() => {
    const subscription = getSubscriptionByUser(currentEmail);
    if (!subscription) {
      return true;
    }
    return !(subscription.status === "active" || subscription.status === "canceling");
  }, [currentEmail]);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [updates, setUpdates] = useState<ChatTurn[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [selectedTopicSuggestion, setSelectedTopicSuggestion] = useState<string | null>(null);
  const [topicSuggestionLocked, setTopicSuggestionLocked] = useState(false);
  const [lockedTopicSuggestion, setLockedTopicSuggestion] = useState<string | null>(null);

  const [manualIntent, setManualIntent] = useState<Exclude<WorkspaceIntent, "unknown"> | null>(
    sessionPrefs?.intent === "ppt" || sessionPrefs?.intent === "video" || sessionPrefs?.intent === "poster"
      ? sessionPrefs.intent
      : "poster",
  );
  const [posterSizeId, setPosterSizeId] = useState<string | null>(() =>
    sessionPrefs?.posterSizeId ?? extractPosterSize(initialEntry.prompt) ?? "poster-9-16",
  );
  const [posterCount, setPosterCount] = useState(() =>
    clamp(sessionPrefs?.posterCount ?? 1, 1, 10),
  );
  const [pptPageCount, setPptPageCount] = useState(() =>
    clamp(sessionPrefs?.pptPageCount ?? extractPageCount(initialEntry.prompt) ?? 10, 1, 30),
  );
  const [pptRatio, setPptRatio] = useState<"16:9" | "4:3">(() => {
    if (sessionPrefs?.pptRatio === "16:9" || sessionPrefs?.pptRatio === "4:3") {
      return sessionPrefs.pptRatio;
    }
    const text = normalizeText(initialEntry.prompt);
    if (text.includes("4:3")) {
      return "4:3";
    }
    return "16:9";
  });
  const [videoStoryboardCount, setVideoStoryboardCount] = useState<number>(() => {
    return clamp(sessionPrefs?.videoStoryboardCount ?? extractVideoStoryboardCount(initialEntry.prompt) ?? 6, 1, 20);
  });
  const [videoRatio, setVideoRatio] = useState<"16:9" | "9:16">(() => {
    if (sessionPrefs?.videoRatio === "16:9" || sessionPrefs?.videoRatio === "9:16") {
      return sessionPrefs.videoRatio;
    }
    const text = normalizeText(initialEntry.prompt);
    if (text.includes("9:16")) {
      return "9:16";
    }
    return "16:9";
  });

  const [flowStage, setFlowStage] = useState<FlowStage>("intent");
  const [selectedStyleId, setSelectedStyleId] = useState(() => {
    const preferredId = sessionPrefs?.styleId;
    if (preferredId && styleOptions.some((item) => item.id === preferredId)) {
      return preferredId;
    }
    return pickSmartStyle(initialEntry.prompt, initialEntry.sources).id;
  });
  const [billingConfirmed, setBillingConfirmed] = useState(false);
  const [isPlanningNextStep, setIsPlanningNextStep] = useState(false);
  const [isPlanningStyleStep, setIsPlanningStyleStep] = useState(false);
  const [isPlanningBillingStep, setIsPlanningBillingStep] = useState(false);
  const [configConfirmed, setConfigConfirmed] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [mobileWorkspaceView, setMobileWorkspaceView] = useState<"chat" | "canvas">("chat");
  const [pendingConfigResetReason, setPendingConfigResetReason] = useState<null | "direction-change" | "config-change">(null);
  const [confirmedConfigSnapshot, setConfirmedConfigSnapshot] = useState<ConfirmedConfigSnapshot | null>(null);

  const [thinkingState, setThinkingState] = useState<{
    active: boolean;
    module: string;
    text: string;
  }>({
    active: false,
    module: "",
    text: "",
  });
  const [isExportingPpt, setIsExportingPpt] = useState(false);
  const [isComposingVideo, setIsComposingVideo] = useState(false);
  const posterDraftRequestRef = useRef(0);

  const modeActionsRef = useRef<{
    exportPpt: () => void;
    downloadVideo: () => void;
  }>({
    exportPpt: () => {},
    downloadVideo: () => {},
  });
  const storyboardPanelRef = useRef<HTMLElement | null>(null);

  const entryPrompt = initialEntry.prompt;
  const contextPrompt = topicContextPrompt;
  const entrySources = initialEntry.sources;

  const detectedIntent = useMemo(
    () => detectIntent(contextPrompt, entrySources),
    [contextPrompt, entrySources],
  );
  const [weakPromptResolved, setWeakPromptResolved] = useState(() =>
    !isWeakPrompt(initialEntry.prompt, initialEntry.sources),
  );
  const weakPrompt = useMemo(
    () => isWeakPrompt(contextPrompt, entrySources) && !weakPromptResolved,
    [contextPrompt, entrySources, weakPromptResolved],
  );
  const recommendedIntent = useMemo(
    () => inferRecommendedIntent(contextPrompt, entrySources),
    [contextPrompt, entrySources],
  );
  const effectiveIntent: WorkspaceIntent = manualIntent ?? detectedIntent.intent;
  const topic = useMemo(() => extractTopic(contextPrompt, entrySources), [contextPrompt, entrySources]);
  const posterSizeLabel = useMemo(
    () => posterSizeOptions.find((item) => item.id === posterSizeId)?.label,
    [posterSizeId],
  );
  const missingHints = useMemo(
    () => buildMissingHints(effectiveIntent, contextPrompt, posterSizeId),
    [effectiveIntent, contextPrompt, posterSizeId],
  );
  const shouldClarifyIntent = weakPrompt || effectiveIntent === "unknown" || detectedIntent.confidence < 0.58;
  const waitingTopicSuggestionConfirm = weakPrompt;
  const showPosterSizeSelector = effectiveIntent === "poster" && !posterSizeId;
  const canProceed = configConfirmed && !showPosterSizeSelector;
  const showDirectionGuide = flowStage === "intent" || flowStage === "config";
  const showStyleStage = flowStage === "style";
  const showBillingConfirm = flowStage === "billing";
  const showStoryboard = flowStage === "generate" && (effectiveIntent === "ppt" || effectiveIntent === "video");
  const showPosterCanvas = flowStage === "generate" && effectiveIntent === "poster";
  const hasCanvasPanel = showStoryboard || showPosterCanvas;
  const showChatPanelInLayout = !isMobileViewport || !hasCanvasPanel || mobileWorkspaceView === "chat";
  const showCanvasPanelInLayout = hasCanvasPanel && (!isMobileViewport || mobileWorkspaceView === "canvas");
  const targetSectionCount =
    effectiveIntent === "poster" ? posterCount : effectiveIntent === "video" ? videoStoryboardCount : pptPageCount;

  const baseOutlineItems = useMemo(() => {
    if (effectiveIntent !== "ppt" && effectiveIntent !== "video") {
      return [] as string[];
    }
    if (/火山/.test(topic)) {
      if (targetSectionCount <= volcanoOutlineItems.length) {
        return volcanoOutlineItems.slice(0, targetSectionCount);
      }
      const extra = buildGenericOutline(topic, effectiveIntent, targetSectionCount - volcanoOutlineItems.length).map(
        (item, idx) => `${volcanoOutlineItems.length + idx + 1}. ${item}`,
      );
      return [...volcanoOutlineItems, ...extra.map((item) => item.replace(/^\d+\.\s*/, ""))];
    }
    return buildGenericOutline(topic, effectiveIntent, targetSectionCount);
  }, [effectiveIntent, targetSectionCount, topic]);

  const baseSlideDrafts = useMemo(() => {
    if (effectiveIntent !== "ppt" && effectiveIntent !== "video") {
      return [] as SlideDraft[];
    }
    if (/火山/.test(topic)) {
      const base = volcanoSlideDrafts.slice(0, targetSectionCount).map((item) => ({ ...item }));
      if (base.length >= targetSectionCount) {
        return base;
      }
      const extraOutline = buildGenericOutline(topic, effectiveIntent, targetSectionCount - base.length);
      const extraSlides = buildGenericSlides(topic, extraOutline, effectiveIntent).map((slide, idx) => ({
        ...slide,
        page: base.length + idx + 1,
      }));
      return [...base, ...extraSlides];
    }
    return buildGenericSlides(topic, baseOutlineItems, effectiveIntent);
  }, [effectiveIntent, baseOutlineItems, targetSectionCount, topic]);

  const basePosterDraft = useMemo(() => {
    if (effectiveIntent !== "poster" || showPosterSizeSelector) {
      return null;
    }
    return buildPosterDraft(topic, posterSizeLabel, contextPrompt);
  }, [contextPrompt, effectiveIntent, posterSizeLabel, showPosterSizeSelector, topic]);

  const summaryText = useMemo(() => {
    if (!contextPrompt && !entrySources.length) {
      return "你还没有传入素材。可以直接输入主题，或返回首页上传文件、网页链接、YouTube 链接。";
    }
    const sourcePart = entrySources.length ? `我收到了 ${entrySources.length} 条素材。` : "当前是纯文本输入。";
    const intentPart = shouldClarifyIntent
      ? "你的需求还不够完整，我先和你确认一下生成方向。"
      : `我已识别你的目标方向，并完成基础配置。`;
    if (manualIntent === "ppt") {
      return `${sourcePart}${intentPart} 默认按 ${pptPageCount} 页、${pptRatio} 比例生成。`;
    }
    if (manualIntent === "video") {
      return `${sourcePart}${intentPart} 默认按 ${videoStoryboardCount} 个分镜（约 ${
        videoStoryboardCount * 10
      } 秒）、${videoRatio} 比例生成。`;
    }
    if (manualIntent === "poster") {
      const sizeLabel = posterSizeOptions.find((item) => item.id === posterSizeId)?.label ?? "未选尺寸";
      return `${sourcePart}${intentPart} 默认生成 ${posterCount} 张，尺寸 ${sizeLabel}。`;
    }
    return `${sourcePart}${intentPart}`;
  }, [
    contextPrompt,
    entrySources.length,
    manualIntent,
    posterCount,
    posterSizeId,
    pptPageCount,
    pptRatio,
    shouldClarifyIntent,
    videoStoryboardCount,
    videoRatio,
  ]);

  const analysisText = useMemo(() => {
    if (weakPrompt) {
      return "我还没有收到可用于生成的明确主题。你可以告诉我想讲解什么知识点，或先选择生成方向，我会给你一版可直接继续的草稿。";
    }
    if (!contextPrompt && !entrySources.length) {
      return "我还没有收到明确需求。你可以先选择生成方向，我会引导你补齐配置并开始生成。";
    }
    return `我已理解主题“${topicHintText(topic)}”。接下来请选择生成方向并确认配置，我会据此生成对应的结构化内容。`;
  }, [contextPrompt, entrySources.length, topic, weakPrompt]);

  const basePosterPlanList = useMemo(() => {
    if (effectiveIntent !== "poster" || !basePosterDraft || !configConfirmed) {
      return [] as PosterPlanItem[];
    }
    const base = [
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
    const list = Array.from({ length: posterCount }, (_, idx) => base[idx % base.length]);
    return list.map((item, idx) => ({
      index: idx + 1,
      title: item.title,
      focus: item.focus,
    }));
  }, [basePosterDraft, configConfirmed, effectiveIntent, posterCount, topic]);

  const [editableOutlineItems, setEditableOutlineItems] = useState<string[]>([]);
  const [editableSlideDrafts, setEditableSlideDrafts] = useState<SlideDraft[]>([]);
  const [editablePosterDraft, setEditablePosterDraft] = useState<PosterDraft | null>(null);
  const [editablePosterPlanList, setEditablePosterPlanList] = useState<PosterPlanItem[]>([]);

  const outlineItems = editableOutlineItems.length ? editableOutlineItems : baseOutlineItems;
  const slideDrafts = editableSlideDrafts.length ? editableSlideDrafts : baseSlideDrafts;
  const densityAdjustedSlideDrafts = useMemo(() => {
    if (effectiveIntent === "video") {
      return makeVideoDensitySlides(slideDrafts);
    }
    if (effectiveIntent === "ppt") {
      return makePptDensitySlides(slideDrafts);
    }
    return slideDrafts;
  }, [effectiveIntent, slideDrafts]);
  const posterDraftRaw = editablePosterDraft ?? basePosterDraft;
  const posterDraft =
    posterDraftRaw && hasAbstractPosterDraft(posterDraftRaw)
      ? buildPosterDraft(topic, posterSizeLabel, contextPrompt)
      : posterDraftRaw;
  const selectedStyle =
    styleOptions.find((style) => style.id === selectedStyleId) ?? styleOptions[0];
  const visualizationRecommendation = useMemo(() => {
    if (!configConfirmed || effectiveIntent === "unknown") {
      return null;
    }
    return getVisualizationRecommendation({
      direction: effectiveIntent,
      topic,
      userPrompt: contextPrompt,
    });
  }, [configConfirmed, contextPrompt, effectiveIntent, topic]);
  const visualizationTypeHint = posterDraft?.visualType || visualizationRecommendation?.label || null;

  const standardOutputCount =
    effectiveIntent === "poster"
      ? posterCount
      : effectiveIntent === "ppt"
        ? pptPageCount
        : effectiveIntent === "video"
          ? videoStoryboardCount
          : 0;
  const billingCost = standardOutputCount * STANDARD_OUTPUT_PROMO_CREDITS;
  const canConfirmBilling = credits >= billingCost;
  const lockedCanvasMode: "free" | "ppt" = effectiveIntent === "ppt" ? "ppt" : "free";

  const stageLabel = shouldClarifyIntent ? "需求理解中" : "内容规划中";
  const projectTitle = `${topicHintText(topic)} · 用户意图总结`;
  const topicSuggestions = useMemo(() => {
    const mixedSuggestions = [
      "黑洞为什么连光都逃不出去？",
      "工业革命为什么改变了世界？",
      "通货膨胀为什么会影响日常生活？",
      "洋流循环是如何影响全球气候的？",
    ];
    const paidSuggestions = [
      "黑洞是怎么形成的？",
      "郑和下西洋背后的航海技术是什么？",
      "供需关系为什么会影响价格？",
      "板块运动为什么会引发地震和火山？",
    ];
    return isFreeUser ? mixedSuggestions : paidSuggestions;
  }, [isFreeUser]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!manualIntent) {
      return;
    }
    const payload: WorkspaceSessionPrefs = {
      intent: manualIntent,
      posterCount,
      posterSizeId,
      pptPageCount,
      pptRatio,
      videoStoryboardCount,
      videoRatio,
      styleId: selectedStyleId,
    };
    window.sessionStorage.setItem(sessionPrefsScopeKey, JSON.stringify(payload));
  }, [
    manualIntent,
    posterCount,
    posterSizeId,
    pptPageCount,
    pptRatio,
    selectedStyleId,
    sessionPrefsScopeKey,
    videoRatio,
    videoStoryboardCount,
  ]);

  function pushAssistantMessage(content: string, module = "内容改写") {
    setUpdates((prev) => [
      ...prev,
      {
        id: `a-${Date.now()}-${Math.round(Math.random() * 9999)}`,
        role: "assistant",
        module,
        content,
      },
    ]);
  }

  function pushUserMessage(content: string, module = "内容改写") {
    setUpdates((prev) => [
      ...prev,
      {
        id: `u-${Date.now()}-${Math.round(Math.random() * 9999)}`,
        role: "user",
        module,
        content,
      },
    ]);
  }

  function startThinking(module: string, text: string) {
    setThinkingState({ active: true, module, text });
  }

  function stopThinking() {
    setThinkingState({ active: false, module: "", text: "" });
  }

  function resetToConfigStage(reason: "direction-change" | "config-change") {
    if (flowStage === "content" || flowStage === "style" || flowStage === "billing" || flowStage === "generate") {
      setPendingConfigResetReason(reason);
      return;
    }
    setConfigConfirmed(false);
    setFlowStage("config");
    setBillingConfirmed(false);
    setEditableOutlineItems([]);
    setEditableSlideDrafts([]);
    setEditablePosterDraft(null);
    setEditablePosterPlanList([]);
  }

  function confirmResetToConfigStage() {
    setPendingConfigResetReason(null);
    setConfigConfirmed(false);
    setFlowStage("config");
    setBillingConfirmed(false);
    setEditableOutlineItems([]);
    setEditableSlideDrafts([]);
    setEditablePosterDraft(null);
    setEditablePosterPlanList([]);
    pushAssistantMessage("已回到配置阶段，请重新确认配置后继续生成。", "需求确认");
  }

  function cancelResetToConfigStage() {
    if (confirmedConfigSnapshot) {
      setManualIntent(confirmedConfigSnapshot.intent);
      setPosterCount(confirmedConfigSnapshot.posterCount);
      setPosterSizeId(confirmedConfigSnapshot.posterSizeId);
      setPptPageCount(confirmedConfigSnapshot.pptPageCount);
      setPptRatio(confirmedConfigSnapshot.pptRatio);
      setVideoStoryboardCount(confirmedConfigSnapshot.videoStoryboardCount);
      setVideoRatio(confirmedConfigSnapshot.videoRatio);
      setConfigConfirmed(true);
    }
    setPendingConfigResetReason(null);
  }

  function handleSelectIntentOption(intent: Exclude<WorkspaceIntent, "unknown">) {
    setManualIntent(intent);
    if (intent === "poster" && !posterSizeId) {
      setPosterSizeId("poster-9-16");
    }
    resetToConfigStage("direction-change");
  }

  function handleSelectTopicSuggestion(text: string) {
    if (!text || isSending || topicSuggestionLocked) {
      return;
    }
    setSelectedTopicSuggestion(text);
  }

  async function handleConfirmTopicSuggestion() {
    if (!selectedTopicSuggestion || isSending || topicSuggestionLocked) {
      return;
    }
    const text = selectedTopicSuggestion;
    setTopicSuggestionLocked(true);
    setLockedTopicSuggestion(text);
    setSelectedTopicSuggestion(null);
    setTopicContextPrompt(text);
    setWeakPromptResolved(true);
    setFlowStage("intent");
    setConfigConfirmed(false);
    setBillingConfirmed(false);
    setEditableOutlineItems([]);
    setEditableSlideDrafts([]);
    setEditablePosterDraft(null);
    setEditablePosterPlanList([]);
    await handleSendInput(text, { source: "suggestion" });
  }

  function handleSelectPosterSize(sizeId: string) {
    setPosterSizeId(sizeId);
    if (configConfirmed) {
      resetToConfigStage("config-change");
      return;
    }
    setConfigConfirmed(false);
  }

  function handlePosterCountChange(count: number) {
    setPosterCount(count);
    if (configConfirmed) {
      resetToConfigStage("config-change");
      return;
    }
    setConfigConfirmed(false);
  }

  function handlePptPageCountChange(count: number) {
    setPptPageCount(count);
    if (configConfirmed) {
      resetToConfigStage("config-change");
      return;
    }
    setConfigConfirmed(false);
  }

  function handlePptRatioChange(ratio: "16:9" | "4:3") {
    setPptRatio(ratio);
    if (configConfirmed) {
      resetToConfigStage("config-change");
      return;
    }
    setConfigConfirmed(false);
  }

  function handleVideoStoryboardCountChange(count: number) {
    setVideoStoryboardCount(count);
    if (configConfirmed) {
      resetToConfigStage("config-change");
      return;
    }
    setConfigConfirmed(false);
  }

  function handleVideoRatioChange(ratio: "16:9" | "9:16") {
    setVideoRatio(ratio);
    if (configConfirmed) {
      resetToConfigStage("config-change");
      return;
    }
    setConfigConfirmed(false);
  }

  async function handleConfirmConfig() {
    setConfigConfirmed(true);
    setFlowStage("content");
    if (manualIntent) {
      setConfirmedConfigSnapshot({
        intent: manualIntent,
        posterCount,
        posterSizeId,
        pptPageCount,
        pptRatio,
        videoStoryboardCount,
        videoRatio,
      });
    }
    setEditableOutlineItems(baseOutlineItems);
    setEditableSlideDrafts(baseSlideDrafts);

    if (effectiveIntent !== "poster") {
      setEditablePosterDraft(basePosterDraft);
      setEditablePosterPlanList(basePosterPlanList);
      if (effectiveIntent === "ppt" || effectiveIntent === "video") {
        const nextRecommendedStyle = pickSmartStyleByIntent(contextPrompt, entrySources, effectiveIntent);
        setSelectedStyleId(nextRecommendedStyle.id);
        setFlowStage("style");
      }
      return;
    }

    const requestId = posterDraftRequestRef.current + 1;
    posterDraftRequestRef.current = requestId;
    setEditablePosterDraft(null);
    setEditablePosterPlanList([]);
    startThinking("海报文案草稿", "正在调用语言模型生成海报文案草稿...");

    try {
      const response = await fetch("/api/content/poster-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic,
          prompt: contextPrompt,
          posterCount,
          posterSizeLabel,
          direction: effectiveIntent,
          draftMode: DRAFT_MODE,
        }),
      });
      if (!response.ok) {
        throw new Error(`poster draft request failed: ${response.status}`);
      }
      const data = (await response.json()) as {
        posterDraft?: PosterDraft;
        planList?: PosterPlanItem[];
        source?: "llm" | "fallback";
        _internal?: {
          renderSpec?: unknown;
          modelPrompt?: string;
        };
      };
      if (posterDraftRequestRef.current !== requestId) {
        return;
      }
      setEditablePosterDraft(data.posterDraft ?? basePosterDraft);
      setEditablePosterPlanList(
        Array.isArray(data.planList) && data.planList.length ? data.planList : basePosterPlanList,
      );
    } catch {
      if (posterDraftRequestRef.current !== requestId) {
        return;
      }
      setEditablePosterDraft(basePosterDraft);
      setEditablePosterPlanList(basePosterPlanList);
    } finally {
      if (posterDraftRequestRef.current === requestId) {
        stopThinking();
      }
    }
  }

  async function handleNextStep() {
    if (isPlanningNextStep) {
      return;
    }
    if (showPosterSizeSelector) {
      pushAssistantMessage("海报方向还缺少尺寸，请先选择一个尺寸后再继续。", "需求确认");
      return;
    }
    if (!configConfirmed) {
      pushAssistantMessage("请先确认当前配置，再进入下一步。", "需求确认");
      return;
    }
    const hasDraftReady =
      effectiveIntent === "poster" ? Boolean(posterDraft) : outlineItems.length > 0 || slideDrafts.length > 0;
    if (!hasDraftReady) {
      pushAssistantMessage("草稿内容尚未准备完成，请稍后再试。", "内容生成");
      return;
    }

    setIsPlanningNextStep(true);
    startThinking("风格推荐", "正在理解目标并匹配最合适的风格...");
    await new Promise((resolve) => window.setTimeout(resolve, 480));
    if (effectiveIntent === "poster" || effectiveIntent === "ppt" || effectiveIntent === "video") {
      const nextRecommendedStyle = pickSmartStyleByIntent(contextPrompt, entrySources, effectiveIntent);
      setSelectedStyleId(nextRecommendedStyle.id);
    }
    setFlowStage("style");
    stopThinking();
    setIsPlanningNextStep(false);
  }

  async function handleStyleNext() {
    if (isPlanningStyleStep) {
      return;
    }
    setIsPlanningStyleStep(true);
    startThinking("账单确认", "正在计算生成成本与积分消耗...");
    await new Promise((resolve) => window.setTimeout(resolve, 420));
    setFlowStage("billing");
    setBillingConfirmed(false);
    stopThinking();
    setIsPlanningStyleStep(false);
  }

  async function handleConfirmBilling() {
    if (credits < billingCost) {
      pushAssistantMessage(
        `当前积分不足（余额 ${credits}，需要 ${billingCost}），请先升级后再继续。`,
        "账单确认",
      );
      return;
    }
    if (isPlanningBillingStep) {
      return;
    }
    setIsPlanningBillingStep(true);
    startThinking(
      effectiveIntent === "poster" ? "海报生成" : "分镜生成",
      effectiveIntent === "poster"
        ? "正在生成海报结构与文案..."
        : "正在创建分镜结构，并同步画面与音轨字段...",
    );
    await new Promise((resolve) => window.setTimeout(resolve, 560));

    const user = currentEmail ? getAdminUserByEmail(currentEmail) : null;
    const ownerProjects = currentEmail ? getProjectsByUser(currentEmail) : [];
    const selectedProject =
      ownerProjects[0] ??
      (currentEmail
        ? ensureUserProjectByEmail({
            email: currentEmail,
            name: session?.user?.name ?? undefined,
            title: `${topic || "Knowledge Topic"} · Workspace Draft`,
            format: effectiveIntent === "poster" ? "海报" : effectiveIntent === "video" ? "视频" : "PPT",
          })
        : getAdminProjects()[0]);

    appendCreditRecord({
      type: "consume",
      description: `${selectedProject?.title ?? "生成项目"} · ${
        effectiveIntent === "poster" ? "海报生成" : "分镜生成"
      }（限时优惠：${STANDARD_OUTPUT_PROMO_CREDITS} 积分/标准输出，原价 ${STANDARD_OUTPUT_REGULAR_CREDITS}）`,
      delta: -billingCost,
      userId: user?.id,
      userEmail: currentEmail || undefined,
      projectId: selectedProject?.id,
      projectTitle: selectedProject?.title,
    }, currentEmail);

    setCreditVersion((prev) => prev + 1);
    setBillingConfirmed(true);

    if (effectiveIntent === "ppt" || effectiveIntent === "video") {
      setFlowStage("generate");
      requestAnimationFrame(() => {
        storyboardPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      pushAssistantMessage(
        `账单已确认，已按限时优惠价（${STANDARD_OUTPUT_PROMO_CREDITS} 积分/标准输出，原价 ${STANDARD_OUTPUT_REGULAR_CREDITS}）扣除 ${billingCost} 积分。分镜已开始生成，右侧已打开画布区域。`,
        "分镜生成",
      );
    } else {
      setFlowStage("generate");
      requestAnimationFrame(() => {
        storyboardPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      pushAssistantMessage(
        `账单已确认，已按限时优惠价（${STANDARD_OUTPUT_PROMO_CREDITS} 积分/标准输出，原价 ${STANDARD_OUTPUT_REGULAR_CREDITS}）扣除 ${billingCost} 积分。右侧已进入海报绘制页面，正在按顺序生成 ${posterCount} 张海报。`,
        "海报生成",
      );
    }
    stopThinking();
    setIsPlanningBillingStep(false);
  }

  async function handleSendInput(
    raw?: string,
    options?: {
      source?: "manual" | "suggestion";
    },
  ) {
    const value = (raw ?? chatInput).trim();
    if (!value || isSending) {
      return;
    }
    const inputSource = options?.source ?? "manual";
    setIsSending(true);
    setChatInput("");
    if (inputSource === "manual") {
      pushUserMessage(value, "对话输入");
    }
    startThinking("需求理解", "正在理解你的补充需求...");
    await new Promise((resolve) => window.setTimeout(resolve, 280));

    const normalized = normalizeText(value);
    const hasDirectionHint = containsAny(normalized, ["海报", "视频", "ppt", "课件", "分镜", "长图"]);
    const isConfigCommand = containsAny(normalized, ["9:16", "16:9", "4:3", "页", "张", "尺寸", "比例"]);
    const isEditCommand = containsAny(normalized, ["改第", "重写", "缩短", "更生动", "补充"]);
    const likelyTopicText = !hasDirectionHint && !isConfigCommand && !isEditCommand;

    if (likelyTopicText && (flowStage === "intent" || flowStage === "config" || shouldClarifyIntent)) {
      setTopicContextPrompt(value);
    }

    if (value.trim().length >= 6 || containsAny(normalized, ["天文", "经济", "历史", "地理", "火山", "气候", "物理"])) {
      setWeakPromptResolved(true);
    }

    if (weakPrompt && !hasDirectionHint) {
      if (inputSource === "suggestion") {
        stopThinking();
        setIsSending(false);
        return;
      }
      pushAssistantMessage(
        "我先帮你确认生成方向。你可以直接回复：生成海报、生成视频，或生成PPT；也可以先告诉我具体主题。",
        "需求确认",
      );
      stopThinking();
      setIsSending(false);
      return;
    }
    if (containsAny(normalized, ["ppt", "课件", "幻灯"])) {
      if (manualIntent !== "ppt") {
        setManualIntent("ppt");
        resetToConfigStage("direction-change");
        pushAssistantMessage("已切换到 PPT 方向。请先确认页数和比例，我再继续生成内容。", "需求确认");
      } else {
        pushAssistantMessage("当前已是 PPT 方向。你可以调整页数和比例后点击下一步。", "需求确认");
      }
      stopThinking();
      setIsSending(false);
      return;
    }
    if (containsAny(normalized, ["视频", "口播", "分镜"])) {
      if (manualIntent !== "video") {
        setManualIntent("video");
        resetToConfigStage("direction-change");
        pushAssistantMessage("已切换到视频方向。请先确认分镜数量和比例，我再继续生成内容。", "需求确认");
      } else {
        pushAssistantMessage("当前已是视频方向。你可以调整分镜数量和比例后点击下一步。", "需求确认");
      }
      stopThinking();
      setIsSending(false);
      return;
    }
    if (containsAny(normalized, ["海报", "长图", "poster"])) {
      if (manualIntent !== "poster") {
        setManualIntent("poster");
        resetToConfigStage("direction-change");
        pushAssistantMessage("已切换到海报方向。请先确认张数和尺寸，我再继续生成内容。", "需求确认");
      } else {
        pushAssistantMessage("当前已是海报方向。你可以调整张数和尺寸后点击下一步。", "需求确认");
      }
      stopThinking();
      setIsSending(false);
      return;
    }

    if (isConfigCommand && (manualIntent === "poster" || manualIntent === "video" || manualIntent === "ppt")) {
      pushAssistantMessage("我已记录你的配置意图。请在下方配置区直接调整后点击“下一步”，这样会更准确。", "需求确认");
      stopThinking();
      setIsSending(false);
      return;
    }

    if (shouldClarifyIntent) {
      pushAssistantMessage("我还不能确定你要生成的类型。请直接回复：PPT、视频或海报。", "需求确认");
      stopThinking();
      setIsSending(false);
      return;
    }

    const cmd = parseContentEditCommand(value);
    if (effectiveIntent === "poster") {
      if (cmd.target.kind === "poster" && cmd.target.index >= 0 && cmd.target.index < editablePosterPlanList.length) {
        const next = [...editablePosterPlanList];
        const focusPatch =
          cmd.action === "shorten"
            ? "已压缩为更短文案"
            : cmd.action === "enhance"
              ? "已增强案例感与表达张力"
              : "已按补充要求调整";
        next[cmd.target.index] = {
          ...next[cmd.target.index],
          focus: `${next[cmd.target.index].focus}（${focusPatch}）`,
        };
        setEditablePosterPlanList(next);
        pushAssistantMessage(`已更新第 ${cmd.target.index + 1} 张海报内容。`, "内容改写");
      } else if (editablePosterDraft) {
        const bodyPatch =
          cmd.action === "shorten"
            ? `${editablePosterDraft.body.slice(0, 80)}...`
            : cmd.action === "enhance"
              ? `${editablePosterDraft.body}\n\n补充：加入一个真实场景案例和更生动表达。`
              : `${editablePosterDraft.body}\n\n补充：${cmd.payload}`;
        setEditablePosterDraft({
          ...editablePosterDraft,
          body: bodyPatch,
        });
        pushAssistantMessage("已更新海报文案草稿。", "海报生成");
      }
      stopThinking();
      setIsSending(false);
      return;
    }

    if (editableSlideDrafts.length) {
      const updateSlide = (index: number) => {
        if (index < 0 || index >= editableSlideDrafts.length) {
          return false;
        }
        const next = [...editableSlideDrafts];
        const current = next[index];
        next[index] = {
          ...current,
          body:
            cmd.action === "shorten"
              ? current.body.length > 62
                ? `${current.body.slice(0, 62)}...`
                : current.body
              : cmd.action === "enhance"
                ? `${current.body} 同时加入一个贴近生活的类比示例。`
                : `${current.body}\n补充要求：${cmd.payload}`,
        };
        setEditableSlideDrafts(next);
        pushAssistantMessage(`已更新第 ${index + 1} 页内容。`, "内容改写");
        return true;
      };

      if (cmd.target.kind === "slide") {
        if (updateSlide(cmd.target.index)) {
          stopThinking();
          setIsSending(false);
          return;
        }
      } else if (cmd.target.kind === "all") {
        setEditableSlideDrafts((prev) =>
          prev.map((slide) => ({
            ...slide,
            body:
              cmd.action === "shorten"
                ? slide.body.length > 62
                  ? `${slide.body.slice(0, 62)}...`
                  : slide.body
                : cmd.action === "enhance"
                  ? `${slide.body} 同时加入一个贴近生活的类比示例。`
                  : `${slide.body}\n补充要求：${cmd.payload}`,
          })),
        );
        pushAssistantMessage(
          cmd.action === "shorten"
            ? "已将全部页文案压缩为更短表达。"
            : cmd.action === "enhance"
              ? "已将全部页文案调整为更生动表达。"
              : "已将你的补充要求应用到全部页面。",
          "内容改写",
        );
        stopThinking();
        setIsSending(false);
        return;
      }
    }

    pushAssistantMessage(
      "已记录你的补充。你可以继续指定“改第几页 + 怎么改”，我会按页精确调整。",
      "内容改写",
    );
    stopThinking();
    setIsSending(false);
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const media = window.matchMedia("(max-width: 1023px)");
    const apply = () => setIsMobileViewport(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!isMobileViewport) {
      return;
    }
    if (!hasCanvasPanel) {
      return;
    }
    window.requestAnimationFrame(() => {
      setMobileWorkspaceView((prev) => (prev === "canvas" ? prev : "canvas"));
    });
  }, [hasCanvasPanel, isMobileViewport]);

  return (
    <div className="min-h-screen overflow-y-auto bg-[#f7f7f8] text-zinc-900">
      <TopBar
        title={projectTitle}
        stageLabel={stageLabel}
        credits={credits}
        saveState={saveState}
        hasUnsavedChanges={hasUnsavedChanges}
        canvasMode={lockedCanvasMode}
        onDownloadPpt={
          showStoryboard && lockedCanvasMode === "ppt"
            ? () => {
                modeActionsRef.current.exportPpt();
              }
            : undefined
        }
        onDownloadVideo={
          showStoryboard && lockedCanvasMode === "free"
            ? () => {
                modeActionsRef.current.downloadVideo();
              }
            : undefined
        }
        actionsDisabled={!showStoryboard}
        isExportingPpt={isExportingPpt}
        isComposingVideo={isComposingVideo}
      />

      <main className="mx-auto mt-[56px] max-w-none px-2 pb-3 pt-3 sm:px-3">
        <div
          className={`grid gap-2 ${
            hasCanvasPanel ? "lg:grid-cols-[416px_minmax(0,1fr)]" : "lg:grid-cols-1"
          }`}
        >
          <section
            className={`min-h-0 ${
              hasCanvasPanel ? "" : "lg:mx-auto lg:w-full lg:max-w-[980px]"
            } ${showChatPanelInLayout ? "" : "hidden"}`}
          >
            <div className="flex min-h-0 flex-col">
              {isMobileViewport && hasCanvasPanel ? (
                <div className="mb-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setMobileWorkspaceView("canvas")}
                    className="inline-flex h-8 items-center rounded-lg border border-zinc-300 bg-white px-3 text-xs text-zinc-700 hover:bg-zinc-100"
                  >
                    查看画布
                  </button>
                </div>
              ) : null}
              <div className={hasCanvasPanel ? "pr-1.5 pt-4" : "pt-4"}>
                <ChatPanel
                  userPrompt={entryPrompt}
                  entrySources={entrySources}
                  intent={effectiveIntent}
                  selectedIntent={manualIntent}
                  analysisText={analysisText}
                  showDirectionGuide={showDirectionGuide}
                  shouldClarifyIntent={shouldClarifyIntent}
                  showWeakPromptSuggestions={showDirectionGuide && shouldClarifyIntent && waitingTopicSuggestionConfirm}
                  topicSuggestions={topicSuggestions}
                  selectedTopicSuggestion={selectedTopicSuggestion}
                  topicSuggestionLocked={topicSuggestionLocked}
                  lockedTopicSuggestion={lockedTopicSuggestion}
                  onApplyTopicSuggestion={(text) => {
                    handleSelectTopicSuggestion(text);
                  }}
                  onConfirmTopicSuggestion={() => {
                    void handleConfirmTopicSuggestion();
                  }}
                  missingHints={missingHints}
                  intentOptions={intentOptions}
                  recommendedIntent={recommendedIntent}
                  onSelectIntentOption={handleSelectIntentOption}
                  posterSizeOptions={posterSizeOptions}
                  selectedPosterSize={posterSizeId}
                  onSelectPosterSize={handleSelectPosterSize}
                  posterCount={posterCount}
                  onPosterCountChange={handlePosterCountChange}
                  pptPageCount={pptPageCount}
                  onPptPageCountChange={handlePptPageCountChange}
                  pptRatio={pptRatio}
                  onPptRatioChange={handlePptRatioChange}
                  videoStoryboardCount={videoStoryboardCount}
                  onVideoStoryboardCountChange={handleVideoStoryboardCountChange}
                  videoRatio={videoRatio}
                  onVideoRatioChange={handleVideoRatioChange}
                  configConfirmed={configConfirmed}
                  onConfirmConfig={handleConfirmConfig}
                  outlineItems={outlineItems}
                  slideDrafts={densityAdjustedSlideDrafts}
                  posterDraft={posterDraft}
                  summaryText={summaryText}
                  updates={updates}
                  onConfirm={handleNextStep}
                  isPlanningNextStep={isPlanningNextStep}
                  canProceed={canProceed}
                  showStyleStage={showStyleStage}
                  styleConfirmed={flowStage === "billing" || flowStage === "generate"}
                  isPlanningStyleStep={isPlanningStyleStep}
                  showBillingConfirm={showBillingConfirm}
                  isPlanningBillingStep={isPlanningBillingStep}
                  billingConfirmed={billingConfirmed}
                  canConfirmBilling={canConfirmBilling}
                  billingSummary={{
                    styleName: selectedStyle.name,
                    totalCost: billingCost,
                    availableCredits: credits,
                    remainingCredits: Math.max(0, credits - billingCost),
                    standardOutputCount,
                    promoCreditsPerOutput: STANDARD_OUTPUT_PROMO_CREDITS,
                    regularCreditsPerOutput: STANDARD_OUTPUT_REGULAR_CREDITS,
                  }}
                  styleOptions={styleOptions}
                  selectedStyleId={selectedStyleId}
                  onSelectStyle={setSelectedStyleId}
                  onStyleNext={handleStyleNext}
                  onConfirmBilling={handleConfirmBilling}
                  visualizationTypeHint={visualizationTypeHint}
                  thinkingState={thinkingState}
                />
              </div>

              <div className="shrink-0 pb-3 pt-3">
                <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
                  <div className="flex items-center gap-2">
                    <textarea
                      value={chatInput}
                      onChange={(event) => setChatInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void handleSendInput();
                        }
                      }}
                      className="max-h-32 min-h-[38px] w-full resize-none bg-transparent py-1 text-sm text-zinc-800 outline-none"
                      placeholder="继续补充需求"
                    />
                    <button
                      type="button"
                      disabled={!chatInput.trim() || isSending}
                      onClick={() => void handleSendInput()}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
                      aria-label="发送"
                    >
                      {isSending ? <LoaderCircle size={14} className="animate-spin" /> : <ArrowUp size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {showStoryboard && showCanvasPanelInLayout ? (
            <section
              ref={storyboardPanelRef}
              className="workspace-canvas-shell relative min-h-0 h-[62vh] overflow-hidden sm:h-[66vh] lg:h-full"
            >
              {isMobileViewport ? (
                <div className="absolute left-3 top-3 z-20">
                  <button
                    type="button"
                    onClick={() => setMobileWorkspaceView("chat")}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-200 bg-white/95 px-2.5 text-xs text-zinc-700 shadow-sm"
                  >
                    <ArrowLeft size={12} />
                    返回对话
                  </button>
                </div>
              ) : null}
              <StoryboardCanvas
                onSaveStateChange={(nextState, unsaved) => {
                  setSaveState(nextState);
                  setHasUnsavedChanges(unsaved);
                }}
                canvasModeExternal={lockedCanvasMode}
                onExportingPptChange={setIsExportingPpt}
                onComposingVideoChange={setIsComposingVideo}
                onModeActionRegister={(actions) => {
                  modeActionsRef.current = actions;
                }}
              />
            </section>
          ) : null}

          {showPosterCanvas && showCanvasPanelInLayout ? (
            <section
              ref={storyboardPanelRef}
              className="workspace-canvas-shell relative min-h-0 h-[62vh] overflow-hidden sm:h-[66vh] lg:h-full"
            >
              {isMobileViewport ? (
                <div className="absolute left-3 top-3 z-20">
                  <button
                    type="button"
                    onClick={() => setMobileWorkspaceView("chat")}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-200 bg-white/95 px-2.5 text-xs text-zinc-700 shadow-sm"
                  >
                    <ArrowLeft size={12} />
                    返回对话
                  </button>
                </div>
              ) : null}
              <PosterCanvas
                posterCount={posterCount}
                posterDraft={posterDraft}
                posterPlanList={editablePosterPlanList.length ? editablePosterPlanList : basePosterPlanList}
                onSaveStateChange={(nextState, unsaved) => {
                  setSaveState(nextState);
                  setHasUnsavedChanges(unsaved);
                }}
              />
            </section>
          ) : null}
        </div>
      </main>

      {pendingConfigResetReason ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl">
            <h3 className="text-sm font-semibold text-zinc-900">确认重置配置</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-700">
              {pendingConfigResetReason === "direction-change"
                ? "你正在切换生成方向，当前已确认的内容将失效并重新进入配置阶段。是否继续？"
                : "你正在修改关键配置（页数/分镜/尺寸/比例），当前内容将按新配置重生成。是否继续？"}
            </p>
            {confirmedConfigSnapshot ? (
              <p className="mt-2 text-xs text-zinc-500">
                当前配置：
                {confirmedConfigSnapshot.intent === "poster"
                  ? `${confirmedConfigSnapshot.posterCount} 张 / ${
                      posterSizeOptions.find((item) => item.id === confirmedConfigSnapshot.posterSizeId)?.label ??
                      confirmedConfigSnapshot.posterSizeId
                    }`
                  : confirmedConfigSnapshot.intent === "video"
                    ? `${confirmedConfigSnapshot.videoStoryboardCount} 分镜 / ${confirmedConfigSnapshot.videoRatio}`
                    : `${confirmedConfigSnapshot.pptPageCount} 页 / ${confirmedConfigSnapshot.pptRatio}`}
              </p>
            ) : null}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={cancelResetToConfigStage}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm text-zinc-700 hover:bg-zinc-100"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmResetToConfigStage}
                className="inline-flex h-9 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
              >
                继续
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
