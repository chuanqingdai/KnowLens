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
}) {
  const topic = compactText(input.draftContent, 1400);
  const style = compactText(input.selectedStyle, 260);
  const ratio = compactText(input.aspectRatio, 24) || "9:16";
  const index = Number.isFinite(input.posterIndex) ? Math.max(1, Math.round(input.posterIndex)) : 1;
  const total = Number.isFinite(input.totalCount) ? Math.max(1, Math.round(input.totalCount)) : 1;

  const narrativeGuidance =
    total <= 1
      ? "Create one complete infographic poster with clear title hierarchy, key mechanism flow, and concise takeaway."
      : index === 1
        ? "This is poster 1. Create a strong thematic cover with the main question and visual hook."
        : index === 2
          ? "This is poster 2. Focus on mechanism or process explanation with clear step-by-step flow."
          : "This is poster 3. Focus on summary, comparison, and practical takeaway.";

  return [
    `Create an educational infographic poster in ${ratio}.`,
    `Style direction: ${style || "Clean modern educational infographic."}`,
    `Topic content: ${topic}`,
    narrativeGuidance,
    "Use clean typography, high contrast, and accurate visual metaphors.",
    "Keep text concise and readable. Avoid UI or billing-related words.",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2400);
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
