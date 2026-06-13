export const TUZI_ASPECT_RATIO_TO_SIZE = {
  "1:1": "1024x1024",
  "16:9": "1536x864",
  "9:16": "864x1536",
  "4:3": "1344x1008",
  "3:4": "1008x1344",
} as const;

export type TuziAspectRatio = keyof typeof TUZI_ASPECT_RATIO_TO_SIZE;

export type TuziImagePayload = {
  model: string;
  prompt: string;
  size: string;
  n: 1;
  quality: "standard";
  response_format: "url";
};

const MAX_FINAL_IMAGE_PROMPT_CHARS = 1500;
const IMAGE_PROMPT_POLISH_SUFFIX =
  "Make the image feel like a refined, professional, and aesthetically polished educational infographic with one dominant hero visual, integrated poster-like composition, soft visual transitions, natural embedded callouts, clear diagrammatic storytelling, elegant spacing, balanced information density, and cohesive premium design.";
const VIDEO_IMAGE_PROMPT_POLISH_SUFFIX =
  "Make the frame feel like a polished educational video still with one dominant subject, clear action, cinematic composition, generous negative space, minimal or no on-screen text, and strong readability at a glance.";
const IMAGE_PROMPT_NOISE_PATTERNS = [
  /本页重点|画面结构|讲解文稿|输出格式|写作结构|版式建议|讲解目标|机制说明|应用收束/i,
  /核心结论|机制解释|记忆点|关键发现|事实证据|结论启发|page role|information structure|visualization structure/i,
  /围绕当前标题补充关键变量的变化路径|给出一个对比、例子或判断口诀/i,
  /先明确.*关键驱动因素|必要条件|放大因素|触发条件.?机制传导.?结果呈现/i,
];

function compactText(input: string, maxLength: number) {
  return input
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .slice(0, maxLength)
    .trim();
}

function stripMetaPrefix(input: string) {
  return input
    .replace(/^(核心结论|机制解释|记忆点|关键发现|事实证据|结论启发|coremessage|mechanism|memoryhook|insight|evidence|takeaway)\s*[：:]\s*/i, "")
    .replace(/^(本页重点|画面结构|讲解文稿)\s*[：:]\s*/i, "")
    .trim();
}

function sanitizePromptSignal(input: string, maxLength: number) {
  const compact = compactText(stripMetaPrefix(input), maxLength);
  if (!compact) {
    return "";
  }
  if (IMAGE_PROMPT_NOISE_PATTERNS.some((pattern) => pattern.test(compact))) {
    return "";
  }
  return compact;
}

function buildDominantLanguageRule(language: string) {
  const dominantLanguage = compactText(language, 48) || "English";
  return [
    `Dominant visible language: ${dominantLanguage}.`,
    "Page titles, headings, body copy, labels, and callouts must primarily use that language.",
    "Foreign proper nouns, product names, acronyms, and technical terms may remain unchanged as terms only.",
    "Do not let style references, technology terms, or mixed-language source snippets switch the whole visual into another language.",
  ].join(" ");
}

function splitPromptSentences(input: string, maxItems: number, maxLength: number) {
  const normalized = compactText(input, maxLength * Math.max(1, maxItems));
  if (!normalized) {
    return [];
  }
  return normalized
    .split(/(?<=[。！？.!?])\s+|[；;]/)
    .map((item) => sanitizePromptSignal(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function uniquePromptItems(items: string[], maxItems: number) {
  const seen = new Set<string>();
  const result: string[] = [];
  items.forEach((item) => {
    const compact = compactText(item, 160);
    const key = compact.toLowerCase();
    if (!compact || seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(compact);
  });
  return result.slice(0, maxItems);
}

function extractProtectedFacts(input: string, maxItems = 6) {
  const candidates = splitPromptSentences(input, 12, 110);
  const factPattern =
    /(\d|%|％|\$|美元|人民币|亿元|亿|万|q[1-4]|fy\d{2,4}|20\d{2}|19\d{2}|营收|收入|净利润|eps|每股收益|同比|环比|增长|下降|亏损|google|alphabet|nvidia|英伟达|苹果|微软|tesla|meta|cloud|广告)/i;
  return candidates.filter((item) => factPattern.test(item)).slice(0, maxItems);
}

function describeTextDensity(role: string, outputType: string, density: string) {
  if (outputType === "video") {
    return "Text density: ultra low; prioritize the scene and motion cue. Use no text on body frames unless one large label is essential.";
  }
  if (role === "cover") {
    return "Text density: low; for title-only cover tasks, use the supplied title as the only visible text.";
  }
  if (outputType === "ppt") {
    if (role === "comparison" || role === "checklist" || role === "system-model") {
      return "Text density: low-medium; use at most 3 large, short labels and avoid paragraph copy.";
    }
    return "Text density: low; use 1-2 large, short labels around one dominant visual. Do not render body paragraphs.";
  }
  if (role === "comparison") {
    return "Text density: medium; use 3-5 short comparison points if they help explain the contrast.";
  }
  if (role === "checklist") {
    return "Text density: medium; use 3-5 compact checklist or step labels.";
  }
  if (role === "system-model") {
    return "Text density: medium; use a compact framework with 3-5 short factor labels.";
  }
  if (density === "high") {
    return "Text density: controlled high; preserve important facts but avoid paragraph blocks.";
  }
  return "Text density: balanced; use 2-4 short labels around one dominant visual when helpful.";
}

function trimWithEllipsis(input: string, maxLength: number) {
  if (maxLength <= 0) {
    return "";
  }
  const normalized = input.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  if (maxLength <= 3) {
    return normalized.slice(0, maxLength);
  }
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function joinPromptSectionsWithBudget(sections: string[], maxChars: number) {
  const normalized = sections.map((item) => item.trim()).filter(Boolean);
  if (!normalized.length) {
    return "";
  }
  let used = 0;
  const chosen: string[] = [];
  for (const line of normalized) {
    const sep = chosen.length ? 1 : 0; // newline
    const nextLen = used + sep + line.length;
    if (nextLen <= maxChars) {
      chosen.push(line);
      used = nextLen;
      continue;
    }
    const remain = maxChars - used - sep;
    if (remain <= 24) {
      break;
    }
    const trimmed = trimWithEllipsis(line, remain);
    if (trimmed) {
      chosen.push(trimmed);
      used += sep + trimmed.length;
    }
    break;
  }
  return chosen.join("\n");
}

function describePageRole(role: string) {
  if (role === "cover") {
    return "Use an overview/cover treatment with one strong hook and a clear main subject.";
  }
  if (role === "comparison") {
    return "Show a clear before/after or side-by-side comparison around this page's idea.";
  }
  if (role === "misconception-fact") {
    return "Show a simple misconception-versus-fact contrast without turning it into a text-heavy card.";
  }
  if (role === "checklist") {
    return "Show a concise checklist or decision path with a strong central visual.";
  }
  if (role === "system-model") {
    return "Show a compact framework or system model that helps the viewer make a judgment.";
  }
  if (role === "layered-diagram") {
    return "Show a layered diagram or cutaway-style explanation of the current idea.";
  }
  return "Show the current idea as a clear mechanism or explanatory diagram.";
}

function describeInformationLayout(layout: string) {
  if (layout === "title-only-cover") {
    return "Use a title-only cover layout with one simple hero subject, generous negative space, and one large title as the only text.";
  }
  if (layout === "comparison-cards") {
    return "Use a comparison layout with two or three clearly separated but visually integrated zones.";
  }
  if (layout === "myth-vs-fact") {
    return "Use a misconception-versus-fact layout with short labels and a decisive visual contrast.";
  }
  if (layout === "variable-framework") {
    return "Use a compact variable framework with connected factors and an outcome area.";
  }
  if (layout === "checklist-grid") {
    return "Use a concise checklist layout with a clear reading path and restrained labels.";
  }
  if (layout === "layered-diagram") {
    return "Use a layered diagram layout that reveals parts, levels, or process stages.";
  }
  if (layout === "metrics-summary") {
    return "Use a data-summary layout with supplied metrics emphasized exactly and no invented figures.";
  }
  return "Use a structured explainer layout with one dominant visual and a few short annotations.";
}

export function normalizeTuziAspectRatio(value: string | null | undefined): TuziAspectRatio | null {
  const raw = (value || "").trim().toLowerCase();
  if (!raw) {
    return null;
  }
  if (raw.includes("1:1") || raw.includes("poster-1-1")) {
    return "1:1";
  }
  if (raw.includes("16:9") || raw.includes("poster-16-9")) {
    return "16:9";
  }
  if (raw.includes("9:16") || raw.includes("poster-9-16")) {
    return "9:16";
  }
  if (raw.includes("4:3") || raw.includes("poster-4-3")) {
    return "4:3";
  }
  if (raw.includes("3:4") || raw.includes("poster-3-4")) {
    return "3:4";
  }
  return null;
}

export function resolveTuziImageSize(aspectRatio: string | null | undefined) {
  const normalized = normalizeTuziAspectRatio(aspectRatio);
  if (!normalized) {
    return null;
  }
  return TUZI_ASPECT_RATIO_TO_SIZE[normalized];
}

export function buildTuziImagePrompt(input: {
  draftContent: string;
  selectedStyle: string;
  aspectRatio: string;
  posterIndex: number;
  totalCount: number;
  outputType?: "poster" | "ppt" | "video";
  pageRole?:
    | "cover"
    | "mechanism"
    | "layered-diagram"
    | "comparison"
    | "misconception-fact"
    | "checklist"
    | "system-model";
  fullContent?: string;
  visualType?: string;
  visualElements?: string[];
  imagePrompt?: string;
  imagePromptDraft?: string;
  visibleText?: {
    title: string;
    subtitle?: string;
    labels: string[];
  };
  visualDesign?: {
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
  textStrategy?: {
    mode: "strict" | "guided" | "minimal";
    titleIdea?: string;
    keyConcepts?: string[];
    language: string;
    density: "low" | "medium" | "high";
    allowRewrite: boolean;
  };
  factualRules?: string[];
  negativeRules?: string[];
  seriesStyle?: {
    titleArea: string;
    iconSystem: string;
    colorSystem: string;
    pageModuleStyle: string;
    languageRule: string;
  };
}) {
  // Prompt3: compile one confirmed draft page/frame into one image-generation prompt.
  // Visual-translation composition: current-page task first, optional fields only when they sharpen that task.
  const style = compactText(input.selectedStyle, 520);
  const ratio = compactText(input.aspectRatio, 24) || "9:16";
  const index = Number.isFinite(input.posterIndex) ? Math.max(1, Math.round(input.posterIndex)) : 1;
  const total = Number.isFinite(input.totalCount) ? Math.max(1, Math.round(input.totalCount)) : 1;
  const outputType = input.outputType || "poster";
  const currentContent = sanitizePromptSignal(input.draftContent, outputType === "video" ? 760 : 420);
  const pageRole = input.pageRole || input.visualDesign?.pageRole || "mechanism";
  const visualType = sanitizePromptSignal(input.visualType || "", 110);
  const visualElements = (input.visualElements || [])
    .map((item) => sanitizePromptSignal(item, 60))
    .filter(Boolean)
    .slice(0, 5)
    .join(", ");
  // Draft-layer prompt text should only be treated as hint, not final prompt source.
  const sourceImagePromptDraft = sanitizePromptSignal(
    input.imagePromptDraft || input.imagePrompt || "",
    outputType === "video" ? 360 : 120,
  );
  const visibleTitle = sanitizePromptSignal(input.visibleText?.title || "", 120);
  const visibleSubtitle = sanitizePromptSignal(input.visibleText?.subtitle || "", 120);
  const visibleLabelLimit =
    pageRole === "cover"
      ? 2
      : outputType === "video"
        ? 0
        : outputType === "ppt"
          ? pageRole === "comparison" || pageRole === "checklist" || pageRole === "system-model"
            ? 3
            : 2
          : 4;
  const visibleLabels = uniquePromptItems((input.visibleText?.labels || [])
    .map((item) => sanitizePromptSignal(item, 56))
    .filter(Boolean), visibleLabelLimit)
    .join(" | ");
  const visualDesignLayout = sanitizePromptSignal(input.visualDesign?.layout || "", 140);
  const visualDesignMainVisual = sanitizePromptSignal(input.visualDesign?.mainVisual || "", 150);
  const visualDesignComposition = sanitizePromptSignal(input.visualDesign?.composition || "", 180);
  const visualDesignTextDensity = compactText(input.visualDesign?.textDensity || "", 24);
  const visualDesignInfoStructure = sanitizePromptSignal(input.visualDesign?.informationStructure || "", 80);
  const visualDesignMapRegion = sanitizePromptSignal(input.visualDesign?.mapRegion || "", 120);
  const visualDesignChartType = sanitizePromptSignal(input.visualDesign?.chartType || "", 80);
  const visualDesignWorkflowType = sanitizePromptSignal(input.visualDesign?.workflowType || "", 80);
  const textStrategyMode = input.textStrategy?.mode || "guided";
  const textStrategyTitleIdea = sanitizePromptSignal(input.textStrategy?.titleIdea || "", 80);
  const textStrategyConcepts = (input.textStrategy?.keyConcepts || [])
    .map((item) => sanitizePromptSignal(item, 40))
    .filter(Boolean)
    .slice(0, 5)
    .join(" | ");
  const textStrategyLanguage = compactText(input.textStrategy?.language || "", 40) || "Simplified Chinese";
  const dominantLanguageRule = buildDominantLanguageRule(textStrategyLanguage);
  const textStrategyDensity = compactText(input.textStrategy?.density || "", 20) || visualDesignTextDensity || "medium";
  const textStrategyAllowRewrite = input.textStrategy?.allowRewrite ?? (textStrategyMode === "guided");
  const factualRules = uniquePromptItems(
    (input.factualRules || [])
      .map((item) => sanitizePromptSignal(item, 90))
      .filter(Boolean),
    3,
  ).join(" | ");
  const negativeRules = (input.negativeRules || [])
    .map((item) => sanitizePromptSignal(item, 120))
    .filter(Boolean)
    .slice(0, 6)
    .join(" | ");
  const isStrictText = textStrategyMode === "strict";
  const protectedFacts = uniquePromptItems(extractProtectedFacts(
    [
      currentContent,
      visibleTitle,
      visibleSubtitle,
      visibleLabels,
      factualRules,
    ].join(" "),
    isStrictText ? 8 : 4,
  ), isStrictText ? 8 : 4).join(" | ");
  const seriesTitleArea = sanitizePromptSignal(input.seriesStyle?.titleArea || "", 120);
  const seriesIconSystem = sanitizePromptSignal(input.seriesStyle?.iconSystem || "", 120);
  const seriesColorSystem = sanitizePromptSignal(input.seriesStyle?.colorSystem || "", 120);
  const seriesPageModule = sanitizePromptSignal(input.seriesStyle?.pageModuleStyle || "", 120);
  const seriesLanguageRule = sanitizePromptSignal(input.seriesStyle?.languageRule || "", 120);

  const mediumGuidance = (() => {
    if (pageRole === "cover" && textStrategyMode === "minimal") {
      return outputType === "video"
        ? "Independent video cover frame: one large title only, one simple hero subject, strong clean cover composition, cinematic educational mood."
        : "Independent presentation cover image: one large title only, one simple hero subject, clean premium cover composition, generous whitespace.";
    }
    if (outputType === "ppt") {
      return index === 1
        ? "Presentation slide 1: create a title/cover slide with a strong thematic visual, minimal body text, generous whitespace, and readable title for desktop/projector viewing."
        : "Presentation slide: one slide, one point; use one central diagram, minimal text, generous whitespace, readable from distance.";
    }
    if (outputType === "video") {
      return index === 1
        ? "Video storyboard frame 1: make it work like a premium YouTube thumbnail, high contrast, strong subject, clear question/conflict, minimal on-screen text."
        : "Video storyboard frame: 6-10 second viewing, visual action first, one clear idea, cinematic educational composition, and no small unreadable text.";
    }
    return index === 1 && total > 1
      ? "Poster 1: create a strong mobile-first cover/overview with the main question, visual hook, large title, and clear hierarchy."
      : "Mobile-first infographic poster: one page, one key point; use one central visual, role-appropriate short labels, and no repeated overview panels.";
  })();

  const defaultInformationStructure =
    pageRole === "comparison"
      ? "comparison-cards"
      : pageRole === "misconception-fact"
        ? "myth-vs-fact"
        : pageRole === "system-model"
          ? "variable-framework"
          : pageRole === "checklist"
            ? "checklist-grid"
            : pageRole === "layered-diagram"
              ? "layered-diagram"
          : "mechanism-diagram";
  const describedRole = describePageRole(pageRole);
  const describedLayout = describeInformationLayout(visualDesignInfoStructure || defaultInformationStructure);

  const textStrategyGuidance = (() => {
    if (textStrategyMode === "strict") {
      return [
        "Text: fact-strict, expression-guided.",
        dominantLanguageRule,
        "Keep protected facts exact; do not invent missing numbers, dates, sources, rankings, or conclusions.",
        "Auxiliary titles and labels may be lightly optimized for readability.",
      ].join(" ");
    }
    if (textStrategyMode === "minimal") {
      if (pageRole === "cover") {
        return [
          "Text strategy: title-only cover.",
          "Render the supplied title as the only visible text, large and prominent.",
          "Do not add subtitles, labels, numbers, captions, interface text, logo text, small notes, or extra words.",
        ].join(" ");
      }
      return [
        "Text strategy: minimal.",
        "Use little to no on-image text; prioritize visual explanation with very short labels only if needed.",
      ].join(" ");
    }
    if (outputType === "video") {
      return [
        "Text: guided for short-view video frames.",
        `Use concise ${textStrategyLanguage} labels with low density.`,
        dominantLanguageRule,
        textStrategyAllowRewrite
          ? "Lightly rewrite ordinary wording for visual clarity while preserving meaning."
          : "Keep supplied wording close to the source.",
        "No dense paragraphs, subtitle-style overlays, fine print, tiny chart labels, footnotes, or small unreadable text.",
      ].join(" ");
    }
    return [
      "Text: guided.",
      `Use concise ${textStrategyLanguage} labels with ${textStrategyDensity} density.`,
      dominantLanguageRule,
      textStrategyAllowRewrite
        ? "Lightly rewrite ordinary wording for visual clarity while preserving meaning."
        : "Keep supplied wording close to the source.",
      "No fake numbers, unrelated concepts, wrong-language labels, or dense paragraphs.",
    ].join(" ");
  })();

  const coreSections = [
    `Create one ${ratio} ${outputType} visual for the current page/frame.`,
    currentContent ? `Current-page brief: ${currentContent}` : "",
    protectedFacts ? `Must keep accurate: ${protectedFacts}` : "",
    visualDesignMainVisual ? `Hero visual: ${visualDesignMainVisual}` : "",
    visualDesignComposition ? `Composition: ${visualDesignComposition}` : describedRole,
    `Style: ${style || "Clean modern educational infographic."}`,
    "Style priority: the user-selected style is mandatory. Its palette, background, texture, typography, lighting, and component language must override topic or company brand associations.",
    mediumGuidance,
    describedLayout,
    describeTextDensity(pageRole, outputType, textStrategyDensity),
    textStrategyGuidance,
    outputType === "video"
      ? "Video readability rule: assume the frame is seen briefly. If any text appears, it must be large, bold, sparse, and readable at a glance; never rely on small labels or multi-line notes."
      : "",
    outputType === "video"
      ? "Voiceover alignment rule: the visual must directly support the current frame's narration, showing the same concrete object, action, cause/effect, contrast, example, or state change instead of a generic topic scene."
      : "",
    "Only use this current page/frame. Do not import other pages' facts or labels.",
    "Do not infer or render official brand colors, logos, trademark symbols, product marks, or corporate visual identity unless the selected style prompt or user text explicitly asks for them.",
    "Do not render page numbers, slide numbers, scene numbers, pagination markers, or fraction labels such as 4/7 unless the user explicitly provided them as content.",
    "Avoid heavy boxed segmentation, dashboard-like panels, many large rectangular cards, scenic-background-plus-arrows, UI/billing/workflow words, and internal field names.",
  ];
  const optionalSections = [
    visualType ? `A suitable visual form is ${visualType}.` : "",
    visualElements ? `Use these drawable elements when they fit this page: ${visualElements}.` : "",
    sourceImagePromptDraft ? `Optional visual hint: ${sourceImagePromptDraft}` : "",
    textStrategyTitleIdea ? `Main title idea: ${textStrategyTitleIdea}` : "",
    textStrategyConcepts ? `Key concepts to express visually: ${textStrategyConcepts}` : "",
    visibleTitle && pageRole === "cover" && textStrategyMode === "minimal" ? `Cover title to render exactly as the only text: ${visibleTitle}` : "",
    visibleTitle && textStrategyMode === "strict" ? `Source title fact/text: ${visibleTitle}` : "",
    visibleSubtitle && textStrategyMode === "strict" ? `Source subtitle fact/text: ${visibleSubtitle}` : "",
    visibleLabels && textStrategyMode === "strict" ? `Optional short label ideas: ${visibleLabels}` : "",
    visualDesignLayout && !visualDesignComposition ? `Layout direction: ${visualDesignLayout}` : "",
    visualDesignMapRegion ? `Relevant map/region context: ${visualDesignMapRegion}` : "",
    visualDesignChartType ? `If charting is needed, use this chart direction: ${visualDesignChartType}` : "",
    visualDesignWorkflowType ? `If showing a workflow, use this direction: ${visualDesignWorkflowType}` : "",
    factualRules && !protectedFacts ? `Factual boundary: ${factualRules}` : "",
    negativeRules ? `Avoid: ${negativeRules}` : "",
    seriesTitleArea ? `Series visual consistency: title placement ${seriesTitleArea}` : "",
    seriesIconSystem ? `Series visual consistency: icon style ${seriesIconSystem}` : "",
    seriesColorSystem ? `Series visual consistency: colors ${seriesColorSystem}` : "",
    seriesPageModule ? `Series visual consistency: callout/module style ${seriesPageModule}` : "",
    seriesLanguageRule ? `Language rule: ${seriesLanguageRule}` : "",
  ].filter(Boolean);
  const polishedSuffix = (
    outputType === "video" ? VIDEO_IMAGE_PROMPT_POLISH_SUFFIX : IMAGE_PROMPT_POLISH_SUFFIX
  ).trim();
  const reservedLength = polishedSuffix ? polishedSuffix.length + 2 : 0;
  const maxBodyLength = Math.max(80, MAX_FINAL_IMAGE_PROMPT_CHARS - reservedLength);
  const bodyPrompt = joinPromptSectionsWithBudget(
    [...coreSections, ...optionalSections],
    maxBodyLength,
  );
  if (!polishedSuffix) {
    return bodyPrompt;
  }
  const normalizedBody = bodyPrompt.trim();
  if (!normalizedBody) {
    return trimWithEllipsis(polishedSuffix, MAX_FINAL_IMAGE_PROMPT_CHARS);
  }
  return `${normalizedBody}\n\n${polishedSuffix}`;
}

function readNestedUrl(candidate: unknown) {
  if (!candidate) {
    return "";
  }
  if (typeof candidate === "string") {
    return candidate.trim();
  }
  if (typeof candidate !== "object") {
    return "";
  }
  const entry = candidate as Record<string, unknown>;
  const direct = typeof entry.url === "string" ? entry.url.trim() : "";
  if (direct) {
    return direct;
  }
  return "";
}

export function parseTuziImageUrl(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const obj = payload as Record<string, unknown>;

  const data = Array.isArray(obj.data) ? obj.data : [];
  if (data.length) {
    const url = readNestedUrl(data[0]);
    if (url) {
      return url;
    }
  }

  const images = Array.isArray(obj.images) ? obj.images : [];
  if (images.length) {
    const url = readNestedUrl(images[0]);
    if (url) {
      return url;
    }
  }

  const rootUrl = typeof obj.url === "string" ? obj.url.trim() : "";
  if (rootUrl) {
    return rootUrl;
  }

  const output = Array.isArray(obj.output) ? obj.output : [];
  if (output.length) {
    const firstOutput = output[0];
    if (typeof firstOutput === "string" && firstOutput.trim()) {
      return firstOutput.trim();
    }
    const url = readNestedUrl(firstOutput);
    if (url) {
      return url;
    }
  }

  const result = obj.result;
  if (result && typeof result === "object") {
    const resultUrl = typeof (result as Record<string, unknown>).url === "string"
      ? ((result as Record<string, unknown>).url as string).trim()
      : "";
    if (resultUrl) {
      return resultUrl;
    }
  }

  return "";
}

export function buildTuziPayload(input: {
  model: string;
  prompt: string;
  size: string;
}): TuziImagePayload {
  return {
    model: input.model.trim() || "gpt-image-2",
    prompt: input.prompt.trim(),
    size: input.size.trim(),
    n: 1,
    quality: "standard",
    response_format: "url",
  };
}
