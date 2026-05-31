import { normalizeTuziAspectRatio, resolveTuziImageSize, buildTuziImagePrompt } from "@/lib/workspace/tuzi-image";

export type NormalizedDirection = "poster" | "ppt" | "video";

export type NormalizedGenerationConfig = {
  normalizedDirection: NormalizedDirection;
  normalizedCount: number;
  normalizedRatio: string;
};

export type VisibleText = {
  title: string;
  subtitle?: string;
  labels: string[];
};

export type VisualDesign = {
  layout: string;
  mainVisual: string;
  composition: string;
  textDensity: "low" | "medium" | "high";
  informationStructure?: string;
  pageRole?:
    | "cover"
    | "mechanism"
    | "layered-diagram"
    | "comparison"
    | "misconception-fact"
    | "checklist"
    | "system-model";
  mapRegion?: string;
  chartType?: string;
  workflowType?: string;
};

export type TextStrategy = {
  mode: "strict" | "guided" | "minimal";
  titleIdea?: string;
  keyConcepts?: string[];
  language: string;
  density: "low" | "medium" | "high";
  allowRewrite: boolean;
};

export type SeriesStyle = {
  titleArea: string;
  iconSystem: string;
  colorSystem: string;
  pageModuleStyle: string;
  languageRule: string;
};

export type CompiledGenerationTask = {
  index: number;
  outputType: NormalizedDirection;
  aspectRatio: string;
  size: string;
  contentTitle: string;
  contentBody: string;
  visibleText: VisibleText;
  visualDesign: VisualDesign;
  factualRules: string[];
  negativeRules: string[];
  seriesStyle: SeriesStyle;
  pageRole?:
    | "cover"
    | "mechanism"
    | "layered-diagram"
    | "comparison"
    | "misconception-fact"
    | "checklist"
    | "system-model";
  textStrategy: TextStrategy;
  visualHint: string;
  imagePromptDraft: string;
  composedPrompt: string;
};

type BuildGenerationTasksInput = {
  topic: string;
  outputLanguage: string;
  config: NormalizedGenerationConfig;
  style: {
    id: string;
    name: string;
    prompt: string;
  };
  visualizationTypeHint?: string | null;
  posterDraft?: {
    headline: string;
    subtitle: string;
    body: string;
    points: string[];
    visualType?: string;
    layoutSuggestion?: string;
    visualElements?: string[];
  } | null;
  posterPlanList?: Array<{
    index: number;
    title: string;
    focus: string;
    role?: string;
    keyFacts?: string[];
    visualType?: string;
    visualElements?: string[];
    layoutHint?: string;
    imagePrompt?: string;
    imagePromptDraft?: string;
  }>;
  outlineItems?: string[];
  slideDrafts?: Array<{
    page: number;
    title: string;
    body: string;
    visual: string;
    imagePrompt?: string;
    imagePromptDraft?: string;
  }>;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function cleanText(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function splitLabels(value: string, maxCount = 4) {
  return value
    .split(/[\n,，;；|、]/g)
    .map((item) => cleanText(item))
    .filter(Boolean)
    .slice(0, maxCount);
}

function isGenericPosterFocus(text: string) {
  const normalized = cleanText(text);
  if (!normalized) {
    return false;
  }
  return [
    /用一句话提出问题并建立兴趣/i,
    /frame the key question in one sentence/i,
    /frame the central question in one line/i,
    /建立兴趣/i,
  ].some((pattern) => pattern.test(normalized));
}

function removeGenericPosterGuidance(text: string) {
  return cleanText(
    text
      .replace(/用一句话提出问题并建立兴趣/gi, "")
      .replace(/frame the key question in one sentence/gi, "")
      .replace(/frame the central question in one line/gi, "")
      .replace(/建立兴趣/gi, ""),
  );
}

function stripPosterStagePrefix(text: string) {
  return cleanText(
    text.replace(
      /^(起点|上升|储集|触发|阶段\s*\d+|step\s*\d+|phase\s*\d+)\s*[:：]\s*/i,
      "",
    ),
  );
}

function stripPosterStageMarkerInSentence(text: string) {
  return cleanText(
    text.replace(
      /(^|[。；;.!?]\s*)(起点|上升|储集|触发|阶段\s*\d+|step\s*\d+|phase\s*\d+)\s*[:：]\s*/gi,
      "$1",
    ),
  );
}

function normalizePosterFreeText(text: string, singlePoster: boolean) {
  const withoutGuidance = removeGenericPosterGuidance(text);
  if (!singlePoster) {
    return withoutGuidance;
  }
  return stripPosterStageMarkerInSentence(stripPosterStagePrefix(withoutGuidance));
}

function normalizePosterLabelText(text: string, singlePoster: boolean) {
  const normalized = normalizePosterFreeText(text, singlePoster);
  if (!normalized || isGenericPosterFocus(normalized)) {
    return "";
  }
  return normalized;
}

function isCjkText(text: string) {
  return /[\u3400-\u9fff]/.test(text);
}

function buildFallbackCompactTitle(text: string) {
  const normalized = cleanText(text);
  if (!normalized) {
    return "知识图解";
  }
  if (/火山|岩浆|喷发/.test(normalized)) {
    return "火山形成机制";
  }
  if (/地震|断层/.test(normalized)) {
    return "地震机制讲解";
  }
  if (/黑洞|引力|时空/.test(normalized)) {
    return "黑洞机制讲解";
  }
  if (/免疫|病原|抗体/.test(normalized)) {
    return "免疫机制讲解";
  }
  if (/气候|温室|变暖/.test(normalized)) {
    return "气候变化机制";
  }
  if (/通胀|通货膨胀|价格/.test(normalized)) {
    return "通胀影响机制";
  }
  if (/AI|人工智能|模型/.test(normalized)) {
    return "AI 机制讲解";
  }
  return isCjkText(normalized) ? "主题机制讲解" : "Knowledge Explainer";
}

function buildConcisePosterTitle(rawTitle: string, singlePoster: boolean) {
  const normalized = cleanText(rawTitle);
  if (!normalized) {
    return "";
  }
  let title = normalized;
  const colonMatch = title.match(/^(.{2,40}?)[：:]\s*(.+)$/);
  if (colonMatch && singlePoster) {
    const left = cleanText(colonMatch[1]);
    const right = cleanText(colonMatch[2]);
    if (left && right.length >= 6) {
      title = left;
    }
  }
  title = cleanText(
    title
      .replace(/(核心问题|关键机制与现实影响|关键机制|现实影响)$/gi, "")
      .replace(/[：:]\s*$/g, ""),
  );
  if (!title) {
    return buildFallbackCompactTitle(rawTitle);
  }
  const maxLen = isCjkText(title) ? 18 : 56;
  if (title.length <= maxLen) {
    return title;
  }

  // 禁止硬截断：仅做语义级压缩（分句/分隔提取），不做字符切割。
  const semanticCandidates = [
    ...title.split(/[，,。；;！!？?\-—|]/g),
    ...title.split(/\s+/g),
  ]
    .map((item) =>
      cleanText(
        item
          .replace(/^(关于|围绕|基于|针对)\s*/i, "")
          .replace(/(讲解|解析|分析|说明|介绍)$/i, ""),
      ),
    )
    .filter(Boolean)
    .filter((item) => item.length <= maxLen);

  if (semanticCandidates.length) {
    semanticCandidates.sort((a, b) => {
      const scoreA = (/[如何|机制|过程|影响]/.test(a) ? 1 : 0) + a.length / 100;
      const scoreB = (/[如何|机制|过程|影响]/.test(b) ? 1 : 0) + b.length / 100;
      return scoreB - scoreA;
    });
    return semanticCandidates[0];
  }

  return buildFallbackCompactTitle(title);
}

function buildSeriesStyle(styleName: string, outputLanguage: string): SeriesStyle {
  const isZh = outputLanguage.toLowerCase().startsWith("zh");
  return {
    titleArea: "Consistent top title zone with stable spacing and alignment.",
    iconSystem: "Use one icon style family and stroke weight across all pages.",
    colorSystem: `Primary style anchored by ${styleName}, with fixed accent and neutral palette.`,
    pageModuleStyle: "Use consistent section cards, divider rhythm, and page index marker treatment.",
    languageRule: isZh
      ? "All visible text must stay in Chinese and use concise labels."
      : "All visible text must stay in English and use concise labels.",
  };
}

function buildSharedRules(outputType: NormalizedDirection) {
  const factualRules = [
    "Do not invent statistics, dates, rankings, or named sources.",
    "Do not place incorrect labels, axes, regions, or causality arrows.",
    "If a number is not explicitly provided, use qualitative phrasing only.",
    "Keep terminology consistent with the current page content and series topic.",
  ];
  const negativeRules = [
    "No tiny unreadable text.",
    "No long paragraph blocks.",
    "No overcrowded layout.",
    "No unrelated information or decorative fake UI.",
    "No brand logo, watermark, or pseudo product screenshot.",
  ];
  if (outputType === "video") {
    negativeRules.push("No dense on-screen text; frame must be understandable within short viewing time.");
  }
  return { factualRules, negativeRules };
}

export function normalizeGenerationConfig(input: {
  direction: NormalizedDirection;
  posterCount: number;
  posterSizeLabel: string;
  pptPageCount: number;
  pptRatio: "16:9" | "4:3";
  videoStoryboardCount: number;
  videoRatio: "16:9" | "9:16";
}): NormalizedGenerationConfig {
  const normalizedDirection = input.direction;
  if (normalizedDirection === "poster") {
    return {
      normalizedDirection,
      normalizedCount: clamp(Math.round(input.posterCount || 1), 1, 10),
      normalizedRatio: cleanText(input.posterSizeLabel) || "9:16",
    };
  }
  if (normalizedDirection === "ppt") {
    return {
      normalizedDirection,
      normalizedCount: clamp(Math.round(input.pptPageCount || 10), 6, 24),
      normalizedRatio: cleanText(input.pptRatio) || "16:9",
    };
  }
  return {
    normalizedDirection,
    normalizedCount: clamp(Math.round(input.videoStoryboardCount || 10), 6, 24),
    normalizedRatio: cleanText(input.videoRatio) || "16:9",
  };
}

export function buildGenerationTasksFromDraft(input: BuildGenerationTasksInput): CompiledGenerationTask[] {
  const { normalizedDirection, normalizedCount, normalizedRatio } = input.config;
  const normalizedAspectRatio = normalizeTuziAspectRatio(normalizedRatio);
  const size = normalizedAspectRatio ? resolveTuziImageSize(normalizedAspectRatio) : null;
  if (!normalizedAspectRatio || !size) {
    return [];
  }

  const seriesStyle = buildSeriesStyle(input.style.name || input.style.prompt, input.outputLanguage);
  const { factualRules, negativeRules } = buildSharedRules(normalizedDirection);

  if (normalizedDirection === "poster" && input.posterDraft) {
    const planList = input.posterPlanList || [];
    const singlePoster = normalizedCount === 1;
    const contextPlanTitles = singlePoster
      ? []
      : planList
        .slice(0, Math.min(3, normalizedCount))
        .map((item) => normalizePosterLabelText(item.title || "", false))
        .filter(Boolean);
    const seriesContext = cleanText([
      input.posterDraft.headline,
      input.posterDraft.subtitle,
      input.posterDraft.visualType || "",
      ...contextPlanTitles,
    ].join(" | "));
    return Array.from({ length: normalizedCount }, (_, idx) => {
      const index = idx + 1;
      const plan = planList[idx];
      const isFirstPoster = idx === 0;
      const normalizedRoleRaw = cleanText(String(plan?.role || "")).toLowerCase();
      const pageRole: CompiledGenerationTask["pageRole"] =
        normalizedRoleRaw === "cover" ||
        normalizedRoleRaw === "mechanism" ||
        normalizedRoleRaw === "layered-diagram" ||
        normalizedRoleRaw === "comparison" ||
        normalizedRoleRaw === "misconception-fact" ||
        normalizedRoleRaw === "checklist" ||
        normalizedRoleRaw === "system-model"
          ? normalizedRoleRaw
          : isFirstPoster
            ? "cover"
            : index === normalizedCount
              ? "system-model"
              : "mechanism";
      const focusForBody = normalizePosterLabelText(plan?.focus || "", singlePoster);
      const keyFactsForBody = (plan?.keyFacts || [])
        .map((item) => normalizePosterLabelText(item, singlePoster))
        .filter(Boolean);
      const pageKeyFacts = keyFactsForBody.slice(0, isFirstPoster ? 3 : 2);
      const bodyForCurrentPoster = normalizePosterFreeText(input.posterDraft?.body || "", singlePoster);
      const sanitizedPlanTitle = normalizePosterLabelText(plan?.title || "", singlePoster);
      const rawTitleCandidate =
        sanitizedPlanTitle || cleanText(plan?.title) || cleanText(input.posterDraft?.headline) || `Poster ${index}`;
      const concisePosterTitle = buildConcisePosterTitle(rawTitleCandidate, singlePoster);
      const contentTitle = concisePosterTitle || rawTitleCandidate;
      const contentBody = cleanText([
        isFirstPoster ? bodyForCurrentPoster : "",
        focusForBody,
        ...pageKeyFacts,
      ].join("\n"));
      const imagePromptDraft = normalizePosterFreeText(plan?.imagePromptDraft || plan?.imagePrompt || "", singlePoster);
      const visibleLabelCandidates: string[] = [];
      if (!singlePoster && focusForBody && isFirstPoster) {
        visibleLabelCandidates.push(focusForBody);
      }
      const pageVisibleFacts = pageKeyFacts.length
        ? pageKeyFacts
        : (isFirstPoster ? input.posterDraft?.points || [] : [])
            .slice(0, 2)
            .map((item) => normalizePosterLabelText(item, singlePoster))
            .filter(Boolean);
      pageVisibleFacts.forEach((item) => visibleLabelCandidates.push(item));
      const visibleText: VisibleText = {
        title: contentTitle,
        subtitle: isFirstPoster ? cleanText(input.posterDraft?.subtitle) : "",
        labels: splitLabels(visibleLabelCandidates.join(" | "), isFirstPoster ? 3 : 2),
      };
      const visualDesign: VisualDesign = {
        layout: isFirstPoster
          ? cleanText(plan?.layoutHint || input.posterDraft?.layoutSuggestion) || "Overview poster with clear top title, one main comparison/summary visual, and minimal supporting labels."
          : "Single-focus poster page: one main idea, one central visual, no repeated overview panels.",
        mainVisual: cleanText(plan?.visualType || input.posterDraft?.visualType) || "Causal explainer illustration",
        composition: cleanText([
          `Role=${pageRole}`,
          (plan?.visualElements || input.posterDraft?.visualElements || []).join(", "),
          isFirstPoster
            ? "Use this page as the series overview; show the big question and the complete mental model only once."
            : "Focus only on this page's point; use one main panel, avoid repeated day/night overview blocks or unrelated summary strips.",
        ].join(" | ")) || "One key focal visual + supporting labels",
        informationStructure: pageRole === "system-model"
          ? "judgment-framework"
          : pageRole === "comparison"
            ? "comparison-cards"
            : pageRole === "misconception-fact"
              ? "myth-vs-fact"
              : pageRole === "checklist"
                ? "checklist-grid"
                : pageRole === "layered-diagram"
                  ? "layered-diagram"
              : "mechanism-diagram",
        pageRole,
        textDensity: isFirstPoster ? "medium" : "low",
      };
      const textStrategy: TextStrategy = {
        mode: "guided",
        titleIdea: contentTitle,
        keyConcepts: splitLabels([focusForBody, ...pageKeyFacts].join(" | "), 5),
        language: input.outputLanguage.toLowerCase().startsWith("zh") ? "Simplified Chinese" : "English",
        density: visualDesign.textDensity,
        allowRewrite: true,
      };
      const visualHint = cleanText([
        visualDesign.mainVisual,
        visualDesign.layout,
        visualDesign.composition,
        imagePromptDraft,
      ].join(" | "));
      const composedPrompt = buildTuziImagePrompt({
        draftContent: cleanText([contentTitle, contentBody, visualHint].join("\n")),
        selectedStyle: input.style.name || input.style.prompt,
        aspectRatio: normalizedAspectRatio,
        posterIndex: index,
        totalCount: normalizedCount,
        outputType: "poster",
        fullContent: seriesContext,
        imagePromptDraft,
        visibleText,
        visualDesign,
        pageRole,
        textStrategy,
        factualRules,
        negativeRules,
        seriesStyle,
      });
      return {
        index,
        outputType: "poster",
        aspectRatio: normalizedAspectRatio,
        size,
        contentTitle,
        contentBody,
        visibleText,
        visualDesign,
        factualRules,
        negativeRules,
        seriesStyle,
        pageRole,
        textStrategy,
        visualHint,
        imagePromptDraft,
        composedPrompt,
      };
    });
  }

  const outline = input.outlineItems || [];
  const slides = input.slideDrafts || [];
  const seriesContext = cleanText([
    input.topic,
    ...(outline.slice(0, Math.min(4, normalizedCount))),
    cleanText(input.visualizationTypeHint || ""),
  ].join(" | "));
  return Array.from({ length: normalizedCount }, (_, idx) => {
    const index = idx + 1;
    const slide = slides[idx];
    const contentTitle = cleanText(slide?.title) || cleanText(outline[idx]) || `${normalizedDirection === "ppt" ? "Slide" : "Frame"} ${index}`;
    const contentBody = cleanText(slide?.body) || cleanText(outline[idx]) || input.topic;
    const imagePromptDraft = cleanText(slide?.imagePromptDraft || slide?.imagePrompt);
    const visibleText: VisibleText = {
      title: contentTitle,
      labels: splitLabels(cleanText(slide?.visual) || cleanText(contentBody), normalizedDirection === "video" ? 2 : 4),
    };
    const pageRole: CompiledGenerationTask["pageRole"] =
      index === 1 ? "cover" : index === normalizedCount ? "system-model" : "mechanism";
    const visualDesign: VisualDesign = {
      layout: normalizedDirection === "video"
        ? "Short-view frame with one focal action and minimal text."
        : "Presentation page with one core point and one central visual.",
      mainVisual: cleanText(slide?.visual) || cleanText(input.visualizationTypeHint) || "Knowledge explainer visual",
      composition: cleanText([
        `Role=${pageRole}`,
        normalizedDirection === "video" ? "Frame-first storytelling composition" : "Slide-first explanatory composition",
        imagePromptDraft,
      ].join(" | ")),
      informationStructure: normalizedDirection === "video" ? "single-frame-keypoint" : "single-slide-keypoint",
      pageRole,
      textDensity: normalizedDirection === "video" ? "low" : "medium",
      chartType: /chart|趋势|对比|柱|折线/i.test(slide?.visual || "") ? "comparison-or-trend-chart" : undefined,
      workflowType: /流程|步骤|闭环|workflow|loop/i.test(slide?.visual || "") ? "step-or-flow-workflow" : undefined,
      mapRegion: /地图|map|区域|东亚|中国|全球/i.test(slide?.visual || "") ? cleanText(slide?.visual) : undefined,
    };
    const textStrategy: TextStrategy = {
      mode: "guided",
      titleIdea: contentTitle,
      keyConcepts: splitLabels([contentTitle, contentBody].join(" | "), normalizedDirection === "video" ? 3 : 5),
      language: input.outputLanguage.toLowerCase().startsWith("zh") ? "Simplified Chinese" : "English",
      density: visualDesign.textDensity,
      allowRewrite: true,
    };
    const visualHint = cleanText([slide?.visual || "", imagePromptDraft].join(" | "));
    const composedPrompt = buildTuziImagePrompt({
      draftContent: cleanText([contentTitle, contentBody, visualHint].join("\n")),
      selectedStyle: input.style.name || input.style.prompt,
      aspectRatio: normalizedAspectRatio,
      posterIndex: index,
      totalCount: normalizedCount,
      outputType: normalizedDirection,
      fullContent: seriesContext,
      imagePromptDraft,
      visibleText,
      visualDesign,
      pageRole,
      textStrategy,
      factualRules,
      negativeRules,
      seriesStyle,
    });
    return {
      index,
      outputType: normalizedDirection,
      aspectRatio: normalizedAspectRatio,
      size,
      contentTitle,
      contentBody,
      visibleText,
      visualDesign,
      factualRules,
      negativeRules,
      seriesStyle,
      pageRole,
      textStrategy,
      visualHint,
      imagePromptDraft,
      composedPrompt,
    };
  });
}
