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
    isCover?: boolean;
  }>;
};

function resolveDominantVisibleLanguage(outputLanguage: string) {
  const normalized = outputLanguage.trim().toLowerCase();
  if (/^(zh|zh-cn|zh-hans|cn|chinese|simplified)/.test(normalized)) {
    return "Simplified Chinese";
  }
  if (/^(zh-tw|zh-hant|traditional)/.test(normalized)) {
    return "Traditional Chinese";
  }
  if (/^(ja|jp|japanese)/.test(normalized)) {
    return "Japanese";
  }
  if (/^(ko|kr|korean)/.test(normalized)) {
    return "Korean";
  }
  if (/^(fr|french)/.test(normalized)) {
    return "French";
  }
  if (/^(de|german)/.test(normalized)) {
    return "German";
  }
  if (/^(es|spanish)/.test(normalized)) {
    return "Spanish";
  }
  if (/^(pt|portuguese)/.test(normalized)) {
    return "Portuguese";
  }
  return outputLanguage.trim() || "English";
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function cleanText(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function compactVisualBrief(value: string, outputType: NormalizedDirection) {
  const source = cleanText(value);
  if (!source) {
    return "";
  }
  const maxChars = outputType === "ppt" ? 180 : outputType === "video" ? 120 : 320;
  const maxSentences = outputType === "ppt" ? 2 : outputType === "video" ? 1 : 3;
  const matches = source.match(/[^。！？!?;；.]+[。！？!?;；.]?/g) || [source];
  const kept: string[] = [];
  for (const match of matches) {
    const sentence = cleanText(match);
    if (!sentence) {
      continue;
    }
    const next = cleanText([...kept, sentence].join(" "));
    if (kept.length >= maxSentences || (kept.length > 0 && next.length > maxChars)) {
      break;
    }
    kept.push(sentence);
  }
  const brief = cleanText(kept.join(" ")) || source;
  if (brief.length <= maxChars) {
    return brief;
  }
  return cleanText(brief.slice(0, maxChars).replace(/\s+\S*$/g, ""));
}

function sanitizeBrandSensitiveVisualText(value: string | null | undefined) {
  const source = cleanText(value);
  if (!source) {
    return "";
  }
  return cleanText(
    source
      .replace(/公司\s*logo|公司\s*Logo|公司标志|品牌\s*logo|品牌\s*Logo/gi, "公司名称文字标识")
      .replace(/\bofficial\s+logo\b/gi, "plain company name wordmark")
      .replace(/\bbrand\s+logo\b/gi, "plain brand name wordmark")
      .replace(/\blogo\b/gi, "plain text wordmark"),
  );
}

const PROMPT_NOISE_PATTERNS = [
  /本页重点|画面结构|讲解文稿|输出格式|写作结构|版式建议|讲解目标|机制说明|应用收束/i,
  /核心结论|机制解释|记忆点|关键发现|事实证据|结论启发|step\s*\d+|phase\s*\d+|阶段\s*\d+/i,
  /围绕当前标题补充关键变量的变化路径|给出一个对比、例子或判断口诀/i,
  /先明确.*关键驱动因素|必要条件|放大因素|触发条件.?机制传导.?结果呈现/i,
  /page role|information structure|visualization structure|role=/i,
];

function stripSectionPrefix(text: string) {
  return cleanText(
    text
      .replace(/^(核心结论|机制解释|记忆点|关键发现|事实证据|结论启发|coremessage|mechanism|memoryhook|insight|evidence|takeaway)\s*[：:]\s*/i, "")
      .replace(/^(本页重点|画面结构|讲解文稿)\s*[：:]\s*/i, ""),
  );
}

function sanitizePromptLine(text: string) {
  const normalized = stripSectionPrefix(text);
  if (!normalized) {
    return "";
  }
  if (PROMPT_NOISE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "";
  }
  return normalized;
}

function stripVisibleAspectRatioText(text: string) {
  return cleanText(
    text
      .replace(
        /(?:^|[\s,，;；|])(?:aspect\s*ratio|ratio)\s*(?:of|:|=)?\s*(?:16\s*:\s*9|9\s*:\s*16|4\s*:\s*3|3\s*:\s*4|1\s*:\s*1)\b/gi,
        " ",
      )
      .replace(
        /(?:^|[\s,，;；|])(?:16\s*:\s*9|9\s*:\s*16|4\s*:\s*3|3\s*:\s*4|1\s*:\s*1)\s*(?:aspect\s*ratio|ratio)\b/gi,
        " ",
      )
      .replace(/^[\s.,，;；|。]+$/g, "")
      .replace(/\s*[,，;；|]\s*$/g, ""),
  );
}

function buildVideoScenePromptDraft(input: {
  title: string;
  sceneText: string;
  visual: string;
  promptDraft: string;
  isCover: boolean;
}) {
  const narrationSource = stripVisibleAspectRatioText(sanitizePromptLine(input.sceneText));
  const visualDirection = stripVisibleAspectRatioText(sanitizePromptLine(input.visual));
  const fallbackPrompt = stripVisibleAspectRatioText(input.promptDraft);
  const sceneBasis = cleanText([narrationSource, visualDirection, fallbackPrompt].filter(Boolean).join(" | "));
  if (input.isCover) {
    return cleanText(
      [
        input.title ? `Cover title: ${input.title}` : "",
        sceneBasis,
        "one dominant hero subject, clean background, title-only cover, no small labels",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return cleanText(
    [
      input.title ? `Scene title: ${input.title}` : "",
      narrationSource ? `Voiceover to support visually: ${narrationSource}` : "",
      visualDirection ? `Storyboard visual direction: ${visualDirection}` : "",
      fallbackPrompt && fallbackPrompt !== visualDirection ? `Extra visual hint: ${fallbackPrompt}` : "",
      sceneBasis ? `Scene basis: ${sceneBasis}` : "",
      "Use the voiceover as the source of truth for this frame.",
      "The image must help explain the exact narration beat: show its concrete subject, cause/effect, contrast, example, motion cue, or state change.",
      "Do not create a generic topic illustration if it does not directly support what the narration says.",
      "Create one clear focal subject with one visible action or change that matches the voiceover.",
      "Simple composition, 1-3 visual elements maximum, no subtitles, no bullet lists, no tiny labels, no UI text, no dense annotations.",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function splitLabels(value: string, maxCount = 4) {
  return value
    .split(/[\n,，;；|、]/g)
    .map((item) => sanitizePromptLine(item))
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

function isHighRiskDataContent(text: string) {
  const source = cleanText(text);
  if (!source) {
    return false;
  }
  const hasMetricCue = /指标|数据|同比|环比|营收|净利润|每股收益|EPS|财报|收入|利润|亏损|增长|revenue|profit|earnings|margin/i.test(
    source,
  );
  const hasNumberCue = /\d[\d,.]*\s*(?:亿|万|美元|元|%|百分点|million|billion|usd)?/i.test(source);
  const hasTimeCue = /20\d{2}|Q[1-4]|季度|全年|截至|latest|current|最新|本季|本季度/i.test(source);
  const hasFinanceCue = /财报|业绩|earnings|guidance|营收|净利润|eps|revenue|profit|云业务|广告收入/i.test(source);
  return (hasMetricCue && hasNumberCue && (hasTimeCue || hasFinanceCue)) || (hasFinanceCue && hasTimeCue);
}

function isDataLikeRole(text: string) {
  return /data|metric|指标|数据|财报|商业|business|summary/i.test(cleanText(text));
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
  const dominantLanguage = resolveDominantVisibleLanguage(outputLanguage);
  return {
    titleArea: "Consistent top title zone with stable spacing and alignment.",
    iconSystem: "Use one icon style family and stroke weight across all pages.",
    colorSystem: `Primary style anchored by ${styleName}, with fixed accent and neutral palette.`,
    pageModuleStyle: "Use consistent section cards and divider rhythm. Do not add visible page numbers or pagination markers.",
    languageRule: `Dominant visible language must remain ${dominantLanguage} across the series. Foreign proper nouns, product names, acronyms, and technical terms may remain as terms only; do not switch page titles, body copy, labels, or callouts into another language.`,
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
    "No official brand logo, trademark mark, third-party watermark, or pseudo product screenshot. A system free-plan watermark is allowed only when explicitly requested by the rendering constraint.",
    "If a company identity is needed, use plain text company names or abstract brand-safe symbols instead of official logos.",
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
      normalizedCount: clamp(Math.round(input.pptPageCount || 6), 6, 24),
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
  const dominantVisibleLanguage = resolveDominantVisibleLanguage(input.outputLanguage);
  const { factualRules, negativeRules } = buildSharedRules(normalizedDirection);

  if (normalizedDirection === "poster" && input.posterDraft) {
    const planList = input.posterPlanList || [];
    const singlePoster = normalizedCount === 1;
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
      const focusForBody = sanitizePromptLine(normalizePosterLabelText(plan?.focus || "", singlePoster));
      const keyFactsForBody = (plan?.keyFacts || [])
        .map((item) => sanitizePromptLine(normalizePosterLabelText(item, singlePoster)))
        .filter(Boolean);
      const isDataLikePlan =
        isDataLikeRole(plan?.role || "") || /metrics|data|指标|数据|财报|营收|利润|同比|环比/i.test(plan?.visualType || "");
      const pageFactLimit =
        isDataLikePlan
          ? singlePoster
            ? 8
            : 5
          : pageRole === "comparison" || pageRole === "checklist" || pageRole === "system-model"
            ? 4
            : isFirstPoster
              ? 3
              : 3;
      const pageKeyFacts = keyFactsForBody.slice(0, pageFactLimit);
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
      const isDataLike = isHighRiskDataContent(
        [contentTitle, contentBody, input.posterDraft?.headline, input.posterDraft?.body, ...(input.posterDraft?.points || [])].join(" "),
      );
      const imagePromptDraft = sanitizeBrandSensitiveVisualText(
        normalizePosterFreeText(plan?.imagePromptDraft || plan?.imagePrompt || "", singlePoster),
      );
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
      const sanitizedVisibleLabels = visibleLabelCandidates
        .map((item) => sanitizePromptLine(item))
        .filter(Boolean);
      const visibleText: VisibleText = {
        title: contentTitle,
        subtitle: isFirstPoster ? cleanText(input.posterDraft?.subtitle) : "",
        labels: splitLabels(sanitizedVisibleLabels.join(" | "), pageRole === "cover" ? 3 : pageFactLimit),
      };
      const visualDesign: VisualDesign = {
        layout: isFirstPoster
          ? isDataLike
            ? "Integrated metrics summary poster: one hero number/insight, supporting metric clusters, comparison strip, and concise takeaway."
            : cleanText(plan?.layoutHint || input.posterDraft?.layoutSuggestion) || "Overview poster with clear top title, one main comparison/summary visual, and minimal supporting labels."
          : "Single-focus poster page: one main idea, one central visual, no repeated overview panels.",
        mainVisual: isDataLike
          ? "Metrics summary infographic with business breakdown"
          : sanitizeBrandSensitiveVisualText(plan?.visualType || input.posterDraft?.visualType) || "Causal explainer illustration",
        composition: cleanText([
          pageRole === "cover"
            ? "Overview treatment for the opening page."
            : pageRole === "system-model"
              ? "Framework treatment for synthesis or judgment."
              : pageRole === "comparison"
                ? "Comparison treatment for this page's single contrast."
                : "Single-focus treatment for this page's idea.",
          sanitizeBrandSensitiveVisualText((plan?.visualElements || input.posterDraft?.visualElements || []).join(", ")),
          isDataLike
            ? "Preserve supplied numbers exactly; use an integrated data editorial layout, not generic causal mechanism panels."
            : "",
          isFirstPoster
            ? "Use this page as the series overview; show the big question and the complete mental model only once."
            : "Focus only on this page's point; use one main panel, avoid repeated day/night overview blocks or unrelated summary strips.",
        ].join(" | ")) || "One key focal visual + supporting labels",
        informationStructure: isDataLike
          ? "metrics-summary"
          : pageRole === "system-model"
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
        textDensity:
          pageRole === "cover"
            ? "low"
            : isDataLike || pageRole === "comparison" || pageRole === "checklist" || pageRole === "system-model"
              ? "medium"
              : "medium",
      };
      const textStrategy: TextStrategy = {
        mode: isDataLike ? "strict" : "guided",
        titleIdea: contentTitle,
        keyConcepts: splitLabels([focusForBody, ...pageKeyFacts].join(" | "), 5),
        language: dominantVisibleLanguage,
        density: visualDesign.textDensity,
        allowRewrite: !isDataLike,
      };
      const taskFactualRules = isDataLike
        ? [
            ...factualRules,
            "For supplied metrics, preserve exact numbers, dates, currency units, percentages, company/segment names, and comparison direction.",
            "Do not invent missing financial figures, axes, rankings, or sources.",
          ]
        : factualRules;
      const taskNegativeRules = isDataLike
        ? [
            ...negativeRules,
            "No fake trading dashboard, stock chart, unsupported logo, or made-up financial data.",
            "Avoid generic mechanism-flow templates when the content is a metric summary.",
          ]
        : negativeRules;
      const visualHint = cleanText([
        visualDesign.mainVisual,
        visualDesign.layout,
        visualDesign.composition,
        imagePromptDraft,
      ].join(" | "));
      const composedPrompt = buildTuziImagePrompt({
        draftContent: cleanText([contentTitle, contentBody].join("\n")),
        selectedStyle: input.style.prompt || input.style.name,
        aspectRatio: normalizedAspectRatio,
        posterIndex: index,
        totalCount: normalizedCount,
        outputType: "poster",
        imagePromptDraft,
        visibleText,
        visualDesign,
        pageRole,
        textStrategy,
        factualRules: taskFactualRules,
        negativeRules: taskNegativeRules,
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
        factualRules: taskFactualRules,
        negativeRules: taskNegativeRules,
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
  const generatedCount = Math.max(normalizedCount, slides.length || 0);
  return Array.from({ length: generatedCount }, (_, idx) => {
    const index = idx + 1;
    const slide = slides[idx];
    const contentTitle = cleanText(slide?.title) || cleanText(outline[idx]) || `${normalizedDirection === "ppt" ? "Slide" : "Frame"} ${index}`;
    const contentBody = cleanText(slide?.body) || cleanText(outline[idx]) || input.topic;
    const visualBrief = compactVisualBrief(contentBody, normalizedDirection);
    const rawSlideVisual = sanitizeBrandSensitiveVisualText(slide?.visual || "");
    const sourceImagePromptDraft = sanitizeBrandSensitiveVisualText(
      sanitizePromptLine(cleanText(slide?.imagePromptDraft || slide?.imagePrompt)),
    );
    const isIndependentCover = slide?.isCover === true;
    const imagePromptDraft =
      normalizedDirection === "video"
        ? buildVideoScenePromptDraft({
            title: contentTitle,
            sceneText: contentBody,
            visual: rawSlideVisual,
            promptDraft: sourceImagePromptDraft,
            isCover: isIndependentCover,
          })
        : sourceImagePromptDraft;
    const videoImageSignal = cleanText([contentTitle, contentBody, rawSlideVisual, imagePromptDraft].join("\n"));
    const visibleLabelSource =
      normalizedDirection === "video"
        ? ""
        : sanitizePromptLine(rawSlideVisual) || sanitizePromptLine(visualBrief);
    const conceptSource =
      normalizedDirection === "video"
        ? ""
        : cleanText([contentTitle, visualBrief].join(" | "));
    const isDataLikeSlide =
      !isIndependentCover &&
      (isHighRiskDataContent([contentTitle, normalizedDirection === "video" ? "" : contentBody, rawSlideVisual, imagePromptDraft].join(" ")) ||
        /metrics|data|指标|数据|财报|营收|利润|同比|环比|EPS|每股收益|guidance|revenue|profit|earnings/i.test(
          [contentTitle, normalizedDirection === "video" ? "" : contentBody, rawSlideVisual].join(" "),
        ));
    const visibleText: VisibleText = {
      title: normalizedDirection === "video" && !isIndependentCover ? "" : contentTitle,
      labels: isIndependentCover
        ? []
        : splitLabels(visibleLabelSource, isDataLikeSlide ? 3 : 2),
    };
    const pageRole: CompiledGenerationTask["pageRole"] =
      isIndependentCover
        ? "cover"
        : isDataLikeSlide
        ? index === normalizedCount
          ? "system-model"
          : "comparison"
        : index === 1
          ? "cover"
          : index === normalizedCount
            ? "system-model"
            : "mechanism";
    const visualDesign: VisualDesign = {
      layout: isIndependentCover
          ? "Independent cover visual with one simple hero subject and one large title only."
        : normalizedDirection === "video"
        ? "Short-view frame with one focal action and minimal text."
          : isDataLikeSlide
          ? "Presentation data-summary page with core metrics, business breakdown, guidance, and investor takeaways."
          : "Presentation page with one core point and one central visual.",
      mainVisual: isIndependentCover
        ? rawSlideVisual || "One simple symbolic hero object representing the full topic"
        : isDataLikeSlide
        ? "Financial metrics summary with supplied data and investor-oriented structure"
        : rawSlideVisual || sanitizeBrandSensitiveVisualText(input.visualizationTypeHint) || "Knowledge explainer visual",
      composition: cleanText([
        isIndependentCover
          ? "Title-only independent cover composition with exactly one main subject element, clean background, and one large title text only."
          : pageRole === "cover"
          ? "Opening visual treatment."
          : pageRole === "system-model"
            ? "Closing framework treatment."
            : "Single-point visual treatment.",
        normalizedDirection === "video" ? "Frame-first storytelling composition" : "Slide-first explanatory composition",
        isDataLikeSlide
          ? "Preserve supplied metrics exactly; use an integrated data editorial layout, not generic mechanism panels."
          : "",
        imagePromptDraft,
      ].join(" | ")),
      informationStructure: isIndependentCover
        ? "title-only-cover"
        : isDataLikeSlide
        ? "metrics-summary"
        : normalizedDirection === "video"
          ? "single-frame-keypoint"
          : "single-slide-keypoint",
      pageRole,
      textDensity: isIndependentCover || normalizedDirection === "video" || !isDataLikeSlide ? "low" : "medium",
      chartType: isDataLikeSlide || /chart|趋势|对比|柱|折线/i.test(rawSlideVisual) ? "comparison-or-trend-chart" : undefined,
      workflowType: /流程|步骤|闭环|workflow|loop/i.test(rawSlideVisual) ? "step-or-flow-workflow" : undefined,
      mapRegion: /地图|map|区域|东亚|中国|全球/i.test(rawSlideVisual) ? rawSlideVisual : undefined,
    };
    const textStrategy: TextStrategy = {
      mode: isIndependentCover || normalizedDirection === "video" ? "minimal" : isDataLikeSlide ? "strict" : "guided",
      titleIdea: isIndependentCover || normalizedDirection === "video" ? "" : contentTitle,
      keyConcepts: isIndependentCover || normalizedDirection === "video" ? [] : splitLabels(conceptSource, isDataLikeSlide ? 3 : 2),
      language: dominantVisibleLanguage,
      density: visualDesign.textDensity,
      allowRewrite: !isIndependentCover && !isDataLikeSlide,
    };
    const taskFactualRules = isDataLikeSlide
      ? [
          ...factualRules,
          "For supplied metrics, preserve exact numbers, dates, currency units, percentages, company/segment names, and comparison direction.",
          "Do not invent missing financial figures, axes, rankings, sources, or official logos.",
        ]
      : factualRules;
    const taskNegativeRules = isIndependentCover
        ? [
            ...negativeRules,
          "Cover image must contain only the supplied title as large prominent text. No subtitle, small captions, labels, numbers, notes, charts, interface text, or logo marks.",
          "Use only one simple hero subject element; avoid clutter, detailed data, and multi-panel information layout.",
        ]
      : isDataLikeSlide
      ? [
          ...negativeRules,
          "No fake trading dashboard, unsupported official logo, or made-up financial data.",
          "Avoid generic mechanism-flow templates when the content is a metric summary.",
        ]
      : normalizedDirection === "video"
      ? [
          ...negativeRules,
          "Body storyboard frames must be based on that scene's own copy and visual direction.",
          "Use one clear main subject and one visible action or change; avoid multi-panel layouts unless the scene explicitly asks for contrast.",
          "Use little to no visible text; avoid subtitles, bullet lists, tiny callouts, dense labels, UI text, and small annotations.",
          "Keep the frame simple: 1-3 visual elements maximum and a clean background.",
        ]
      : negativeRules;
    const visualHint = cleanText([sanitizePromptLine(rawSlideVisual), imagePromptDraft].join(" | "));
    const composedPrompt = buildTuziImagePrompt({
      draftContent: isIndependentCover
        ? cleanText([contentTitle, "Independent title-only cover image. Use this title as the only on-image text. One simple hero subject."].join("\n"))
        : normalizedDirection === "video"
          ? videoImageSignal
          : cleanText([contentTitle, sanitizePromptLine(visualBrief)].join("\n")),
      selectedStyle: input.style.prompt || input.style.name,
      aspectRatio: normalizedAspectRatio,
      posterIndex: index,
      totalCount: generatedCount,
      outputType: normalizedDirection,
      imagePromptDraft,
      visibleText,
      visualDesign,
      pageRole,
      textStrategy,
      factualRules: taskFactualRules,
      negativeRules: taskNegativeRules,
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
      factualRules: taskFactualRules,
      negativeRules: taskNegativeRules,
      seriesStyle,
      pageRole,
      textStrategy,
      visualHint,
      imagePromptDraft,
      composedPrompt,
    };
  });
}
