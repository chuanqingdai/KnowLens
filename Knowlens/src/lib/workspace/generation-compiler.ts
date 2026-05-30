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
  mapRegion?: string;
  chartType?: string;
  workflowType?: string;
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
    const seriesContext = cleanText([
      input.posterDraft.headline,
      input.posterDraft.subtitle,
      input.posterDraft.visualType || "",
      ...planList.slice(0, Math.min(3, normalizedCount)).map((item) => item.title),
    ].join(" | "));
    return Array.from({ length: normalizedCount }, (_, idx) => {
      const index = idx + 1;
      const plan = planList[idx];
      const contentTitle = cleanText(plan?.title) || input.posterDraft?.headline || `Poster ${index}`;
      const contentBody = cleanText([
        idx === 0 ? input.posterDraft?.body : "",
        plan?.focus || "",
        ...(plan?.keyFacts || []),
      ].join("\n"));
      const imagePromptDraft = cleanText(plan?.imagePromptDraft || plan?.imagePrompt);
      const visibleText: VisibleText = {
        title: contentTitle,
        subtitle: cleanText(input.posterDraft?.subtitle),
        labels: splitLabels([
          plan?.focus || "",
          ...(input.posterDraft?.points || []).slice(0, 3),
        ].join(" | ")),
      };
      const visualDesign: VisualDesign = {
        layout: cleanText(plan?.layoutHint || input.posterDraft?.layoutSuggestion) || "Single-page infographic with clear top-title and structured body modules.",
        mainVisual: cleanText(plan?.visualType || input.posterDraft?.visualType) || "Causal explainer illustration",
        composition: cleanText([
          plan?.role ? `Role=${plan.role}` : "",
          (plan?.visualElements || input.posterDraft?.visualElements || []).join(", "),
        ].join(" | ")) || "One key focal visual + supporting secondary nodes",
        textDensity: "medium",
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
    const visualDesign: VisualDesign = {
      layout: normalizedDirection === "video"
        ? "Short-view frame with one focal action and minimal text."
        : "Presentation page with one core point and one central visual.",
      mainVisual: cleanText(slide?.visual) || cleanText(input.visualizationTypeHint) || "Knowledge explainer visual",
      composition: cleanText([
        normalizedDirection === "video" ? "Frame-first storytelling composition" : "Slide-first explanatory composition",
        imagePromptDraft,
      ].join(" | ")),
      textDensity: normalizedDirection === "video" ? "low" : "medium",
      chartType: /chart|趋势|对比|柱|折线/i.test(slide?.visual || "") ? "comparison-or-trend-chart" : undefined,
      workflowType: /流程|步骤|闭环|workflow|loop/i.test(slide?.visual || "") ? "step-or-flow-workflow" : undefined,
      mapRegion: /地图|map|区域|东亚|中国|全球/i.test(slide?.visual || "") ? cleanText(slide?.visual) : undefined,
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
      visualHint,
      imagePromptDraft,
      composedPrompt,
    };
  });
}
