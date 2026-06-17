"use client";

import { useEffect } from "react";
import { useLocale } from "./LocaleProvider";

const marketingTextTranslations: Record<string, string> = {
  "STRUCTURED KNOWLEDGE VISUALS": "结构化知识视觉",
  "TURN TEXT INTO VISUALS": "把文本变成视觉内容",
  "NO DESIGN SKILLS NEEDED": "无需设计技能",
  "SCIENCE VISUAL LEARNING": "科学可视化学习",
  "LIFE SCIENCE VISUAL LEARNING": "生命科学可视化学习",
  "EARTH SYSTEM VISUALS": "地球系统视觉",
  "LEARNING MADE VISUAL": "让学习变得可视化",
  "WORKFLOW TO VISUAL GUIDE": "把流程变成视觉指南",
  "COOKING STEPS TO CARDS": "把烹饪步骤变成卡片",
  "CURATED VISUAL IDEAS": "精选视觉灵感",
  "BOLD VISUAL OUTPUTS": "清晰醒目的视觉输出",
  "SLIDE-LIKE VISUALS": "幻灯片式视觉内容",
  "EXPLAIN IDEAS VISUALLY": "用视觉解释想法",
  "TEXT TO VISUAL MOTION": "文本到动态视觉",
  "PROMPT TO SHORT CLIP": "提示词到短视频",

  "AI Infographic Generator for Clear Visuals": "AI 信息图生成器，创建清晰视觉",
  "Text to Infographic Made Simple": "轻松把文本转成信息图",
  "Infographic Maker for Clear Visuals": "信息图制作器，创建清晰视觉",
  "Science Infographic Generator for Clear Visuals": "科学信息图生成器，创建清晰视觉",
  "Biology Infographic Generator for Clear Visuals": "生物信息图生成器，创建清晰视觉",
  "Earth Science Infographic Generator for Visual Learning": "地球科学信息图生成器，用于可视化学习",
  "Educational Infographic Maker for Classroom Visuals": "教育信息图制作器，创建课堂视觉",
  "Process Infographic Generator for Step-by-Step Visuals": "流程信息图生成器，创建分步视觉",
  "Recipe Infographic Maker for Visual Recipe Cards": "食谱信息图制作器，创建视觉食谱卡",
  "Infographic Examples for Visual Inspiration": "信息图案例与视觉灵感",
  "AI Poster Generator for Clear Posters": "AI 海报生成器，创建清晰海报",
  "AI Carousel Generator for Multi-Part Visuals": "AI 轮播图生成器，创建多页视觉",
  "AI Explainer Videos for Clear Ideas": "AI 解说视频，让想法更清晰",
  "AI Video Generator for Short Stories": "AI 视频生成器，创建短故事",
  "Text to Video AI for Short Videos": "文本转视频 AI，创建短视频",

  "Create an Infographic": "创建信息图",
  "Create Your Infographic": "创建你的信息图",
  "Create a Biology Infographic": "创建生物信息图",
  "Create an Earth Science Infographic": "创建地球科学信息图",
  "Create a Process Infographic": "创建流程信息图",
  "Create a Recipe Infographic": "创建食谱信息图",
  "Create Similar": "生成同款",
  "Try This Topic": "试试这个主题",
  "Try with Your Topic": "使用你的主题试试",
  "Generate Your First Video": "生成第一个视频",
  "Generate Free": "免费生成",
  "View Examples": "查看案例",
  "Browse Examples": "浏览案例",
  "View details": "查看详情",
  "Open detail page": "打开详情页",
  "Start with notes or a topic. KnowLens structures the visual.": "从笔记或主题开始，KnowLens 会组织视觉结构。",
  "No design skills needed.": "无需设计技能。",
  "No professional skills needed.": "无需专业技能。",

  "AI Infographic Examples": "AI 信息图案例",
  "Biology Infographic Examples": "生物信息图案例",
  "Science Infographic Examples": "科学信息图案例",
  "Earth Science Infographic Examples": "地球科学信息图案例",
  "Process Infographic Examples": "流程信息图案例",
  "Recipe Infographic Examples": "食谱信息图案例",
  "Infographic Examples Made with KnowLens": "KnowLens 信息图案例",
  "Carousel Examples": "轮播图案例",
  "Poster Examples": "海报案例",
  "What You Can Create": "你可以创建什么",
  "Related Infographic Tools": "相关信息图工具",
  "FAQ": "常见问题",
  "HOW IT WORKS": "工作方式",

  "Create Clear Infographics from Text": "用文本创建清晰信息图",
  "Designed for Readable, Structured Infographics": "为可读、结构化的信息图而设计",
  "Create an Infographic in 3 Steps": "三步创建信息图",
  "Who Can Use the AI Infographic Generator?": "谁适合使用 AI 信息图生成器？",
  "Turn Your Text into a Clear Infographic": "把你的文本变成清晰信息图",
  "Create Biology Infographics for Clear Learning": "创建用于清晰学习的生物信息图",
  "Create a Biology Infographic in 3 Steps": "三步创建生物信息图",
  "Biology Topics You Can Turn into Infographics": "可以转成信息图的生物主题",
  "Built for Biology Learning and Communication": "为生物学习与传播而设计",
  "Designed for Readable Biology Infographics": "为可读的生物信息图而设计",

  "Turn topics, notes, or plain text into clear, structured infographics with readable labels, sections, and visual hierarchy.":
    "把主题、笔记或纯文本转成结构清晰的信息图，包含可读标签、分区和视觉层级。",
  "Explore infographics, posters, and visual summaries created from topics, notes, and short text prompts.":
    "浏览由主题、笔记和短文本提示词生成的信息图、海报和视觉摘要。",
  "Explore biology infographics and visual summaries created from topics, notes, and short text prompts.":
    "浏览由主题、笔记和短文本提示词生成的生物信息图与视觉摘要。",
  "Use KnowLens to turn simple text into structured visual content for learning, explaining, and sharing.":
    "使用 KnowLens 将简单文本变成结构化视觉内容，用于学习、解释和分享。",
  "KnowLens is built for information-heavy visuals, not generic AI art.":
    "KnowLens 面向信息密集型视觉内容，而不是通用 AI 图片。",
  "Start with a topic, notes, or plain text. KnowLens helps organize your message and turn it into a clear visual output.":
    "从主题、笔记或纯文本开始，KnowLens 会组织内容并生成清晰视觉输出。",
  "Use KnowLens when an idea needs to be explained clearly, visually, and quickly.":
    "当一个想法需要被清晰、快速、可视化地解释时，就使用 KnowLens。",
  "Common questions about creating infographics and visual summaries with KnowLens.":
    "关于使用 KnowLens 创建信息图和视觉摘要的常见问题。",
  "Start with a topic, notes, or plain text. Generate a structured infographic, visual summary, or poster-style design in minutes.":
    "从主题、笔记或纯文本开始，几分钟内生成结构化信息图、视觉摘要或海报式设计。",
  "Turn biology topics, notes, or plain text into clear biology infographics with readable labels, structured sections, and visual hierarchy.":
    "把生物主题、笔记或纯文本转成清晰的生物信息图，包含可读标签、结构化分区和视觉层级。",
  "Use KnowLens to turn biology ideas into structured visuals for studying, teaching, explaining, and sharing.":
    "使用 KnowLens 将生物知识变成结构化视觉内容，用于学习、教学、解释和分享。",
  "Start with a biology topic or explanation. KnowLens helps organize the idea into a clear visual structure.":
    "从生物主题或解释开始，KnowLens 会把内容组织成清晰的视觉结构。",
  "Start with a complete explanation or a short topic. Add key points, steps, facts, or examples for better results.":
    "从完整说明或简短主题开始，加入关键点、步骤、事实或示例，效果会更好。",
  "KnowLens is built for visual explanation, not generic AI art.":
    "KnowLens 为视觉解释而设计，不是通用 AI 图片工具。",
  "Common questions about creating biology infographics with KnowLens.":
    "关于使用 KnowLens 创建生物信息图的常见问题。",
  "Explore nearby KnowLens tools for turning text and topics into structured visuals.":
    "继续探索 KnowLens 中可将文本和主题转成结构化视觉的相关工具。",
};

const originalTextByNode = new WeakMap<Text, string>();

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function shouldSkipNode(node: Text) {
  const parent = node.parentElement;
  if (!parent) {
    return true;
  }
  return !!parent.closest("script, style, noscript, textarea, input, select, option, code, pre, svg");
}

function translateTextNode(node: Text) {
  if (shouldSkipNode(node)) {
    return;
  }
  const current = node.nodeValue ?? "";
  if (!current.trim()) {
    return;
  }
  const original = originalTextByNode.get(node) ?? current;
  const translated = marketingTextTranslations[normalizeText(original)];
  if (!translated) {
    return;
  }
  if (!originalTextByNode.has(node)) {
    originalTextByNode.set(node, original);
  }
  const leading = current.match(/^\s*/)?.[0] ?? "";
  const trailing = current.match(/\s*$/)?.[0] ?? "";
  const nextValue = `${leading}${translated}${trailing}`;
  if (node.nodeValue !== nextValue) {
    node.nodeValue = nextValue;
  }
}

function restoreTextNode(node: Text) {
  const original = originalTextByNode.get(node);
  if (original !== undefined && node.nodeValue !== original) {
    node.nodeValue = original;
  }
}

function visitTextNodes(root: Node, callback: (node: Text) => void) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return shouldSkipNode(node as Text) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    },
  });
  let current = walker.nextNode();
  while (current) {
    callback(current as Text);
    current = walker.nextNode();
  }
}

export function LocalizedMarketingText() {
  const { locale } = useLocale();

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const applyLocale = () => {
      visitTextNodes(document.body, locale === "zh" ? translateTextNode : restoreTextNode);
    };

    applyLocale();
    if (locale !== "zh") {
      return;
    }

    const observer = new MutationObserver(() => applyLocale());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [locale]);

  return null;
}
