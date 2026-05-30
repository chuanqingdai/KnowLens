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

const MAX_FINAL_IMAGE_PROMPT_CHARS = 2000;

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
    mapRegion?: string;
    chartType?: string;
    workflowType?: string;
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
  // Budget-first composition: keep core intent + style + medium guidance clear, then fill optional context.
  const topic = compactText(input.draftContent, 760);
  const fullContent = compactText(input.fullContent || "", 220);
  const style = compactText(input.selectedStyle, 220);
  const ratio = compactText(input.aspectRatio, 24) || "9:16";
  const index = Number.isFinite(input.posterIndex) ? Math.max(1, Math.round(input.posterIndex)) : 1;
  const total = Number.isFinite(input.totalCount) ? Math.max(1, Math.round(input.totalCount)) : 1;
  const outputType = input.outputType || "poster";
  const visualType = compactText(input.visualType || "", 110);
  const visualElements = (input.visualElements || [])
    .map((item) => compactText(item, 60))
    .filter(Boolean)
    .slice(0, 6)
    .join(", ");
  // Draft-layer prompt text should only be treated as hint, not final prompt source.
  const sourceImagePromptDraft = compactText(input.imagePromptDraft || input.imagePrompt || "", 320);
  const visibleTitle = compactText(input.visibleText?.title || "", 120);
  const visibleSubtitle = compactText(input.visibleText?.subtitle || "", 120);
  const visibleLabels = (input.visibleText?.labels || [])
    .map((item) => compactText(item, 56))
    .filter(Boolean)
    .slice(0, 4)
    .join(" | ");
  const visualDesignLayout = compactText(input.visualDesign?.layout || "", 180);
  const visualDesignMainVisual = compactText(input.visualDesign?.mainVisual || "", 180);
  const visualDesignComposition = compactText(input.visualDesign?.composition || "", 220);
  const visualDesignTextDensity = compactText(input.visualDesign?.textDensity || "", 24);
  const visualDesignMapRegion = compactText(input.visualDesign?.mapRegion || "", 120);
  const visualDesignChartType = compactText(input.visualDesign?.chartType || "", 80);
  const visualDesignWorkflowType = compactText(input.visualDesign?.workflowType || "", 80);
  const factualRules = (input.factualRules || [])
    .map((item) => compactText(item, 120))
    .filter(Boolean)
    .slice(0, 5)
    .join(" | ");
  const negativeRules = (input.negativeRules || [])
    .map((item) => compactText(item, 120))
    .filter(Boolean)
    .slice(0, 6)
    .join(" | ");
  const seriesTitleArea = compactText(input.seriesStyle?.titleArea || "", 120);
  const seriesIconSystem = compactText(input.seriesStyle?.iconSystem || "", 120);
  const seriesColorSystem = compactText(input.seriesStyle?.colorSystem || "", 120);
  const seriesPageModule = compactText(input.seriesStyle?.pageModuleStyle || "", 120);
  const seriesLanguageRule = compactText(input.seriesStyle?.languageRule || "", 120);

  const mediumGuidance = (() => {
    if (outputType === "ppt") {
      return index === 1
        ? "Presentation slide 1: create a title/cover slide with a strong thematic visual, minimal body text, generous whitespace, and readable title for desktop/projector viewing."
        : "Presentation slide: one slide, one point; use one central diagram, minimal text, generous whitespace, readable from distance.";
    }
    if (outputType === "video") {
      return index === 1
        ? "Video storyboard frame 1: make it work like a premium YouTube thumbnail, high contrast, strong subject, clear question/conflict, minimal on-screen text."
        : "Video storyboard frame: 6-10 second viewing, minimal text, visual action first, one clear idea, cinematic educational composition.";
    }
    return index === 1 && total > 1
      ? "Poster 1: create a strong mobile-first cover/overview with the main question, visual hook, large title, and clear hierarchy."
      : "Mobile-first infographic poster: layered readable content, title hierarchy, 3-5 core visual nodes, small annotations allowed but no dense paragraph blocks.";
  })();

  const coreSections = [
    `Draw one ${outputType} image in ${ratio}.`,
    `Current page/frame (${index}/${total}) must be the only mandatory content.`,
    `Style direction: ${style || "Clean modern educational infographic."}`,
    `Current page/frame content: ${topic}`,
    mediumGuidance,
    "Do not include facts or labels from other pages/frames.",
    "Keep text concise and readable with clear hierarchy and contrast.",
    "Avoid UI, billing, settings, or workflow words in the rendered image.",
    "Only render text explicitly listed in Visible text. Do not invent extra text blocks.",
  ];
  const optionalSections = [
    fullContent
      ? `Series consistency anchors (do not force unrelated details into this page): ${fullContent}`
      : "",
    visualType ? `Visualization structure: ${visualType}.` : "",
    visualElements ? `Core drawable elements for this page: ${visualElements}.` : "",
    sourceImagePromptDraft ? `Image hint from draft layer (reference only): ${sourceImagePromptDraft}` : "",
    visibleTitle ? `Visible text > title: ${visibleTitle}` : "",
    visibleSubtitle ? `Visible text > subtitle: ${visibleSubtitle}` : "",
    visibleLabels ? `Visible text > labels: ${visibleLabels}` : "",
    visualDesignLayout ? `Visual design > layout: ${visualDesignLayout}` : "",
    visualDesignMainVisual ? `Visual design > main visual: ${visualDesignMainVisual}` : "",
    visualDesignComposition ? `Visual design > composition: ${visualDesignComposition}` : "",
    visualDesignTextDensity ? `Visual design > text density: ${visualDesignTextDensity}` : "",
    visualDesignMapRegion ? `Visual design > map region: ${visualDesignMapRegion}` : "",
    visualDesignChartType ? `Visual design > chart type: ${visualDesignChartType}` : "",
    visualDesignWorkflowType ? `Visual design > workflow type: ${visualDesignWorkflowType}` : "",
    factualRules ? `Factual rules: ${factualRules}` : "",
    negativeRules ? `Negative rules: ${negativeRules}` : "",
    seriesTitleArea ? `Series style > title area: ${seriesTitleArea}` : "",
    seriesIconSystem ? `Series style > icon system: ${seriesIconSystem}` : "",
    seriesColorSystem ? `Series style > color system: ${seriesColorSystem}` : "",
    seriesPageModule ? `Series style > page module style: ${seriesPageModule}` : "",
    seriesLanguageRule ? `Series style > language rule: ${seriesLanguageRule}` : "",
  ].filter(Boolean);
  return joinPromptSectionsWithBudget(
    [...coreSections, ...optionalSections],
    MAX_FINAL_IMAGE_PROMPT_CHARS,
  );
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
