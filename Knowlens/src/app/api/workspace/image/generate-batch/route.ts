import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import {
  buildImage2ProviderConfig,
  requestImage2Generation,
  type Image2ProviderFailure,
} from "@/lib/server/image2";
import { incrementUsageCounter } from "@/lib/server/guard";
import {
  buildImageAssetStorageKey,
  buildImageRenderUrl,
  createImageGenerationJob,
  findImageGenerationJobByIdempotency,
  getImageGenerationJobById,
  persistRemoteImageAsset,
  syncImageGenerationJobFinalStatus,
  updateImageGenerationJobStatus,
  updateImageGenerationTask,
  type ImageGenerationTaskPayload,
} from "@/lib/server/image-generation-jobs";
import { getLatestSubscriptionDb, logOpsEvent } from "@/lib/server/store";
import {
  bindWorkspaceProjectPageTask,
  updateWorkspaceProjectPageImage,
  upsertWorkspaceProjectPages,
} from "@/lib/server/workspace-project-pages";
import {
  parseTuziImageUrl,
  normalizeTuziAspectRatio,
  resolveTuziImageSize,
} from "@/lib/workspace/tuzi-image";

export const runtime = "nodejs";
export const maxDuration = 300;

type GenerateBatchPayload = {
  idempotencyKey?: string;
  runId?: string;
  projectId?: string;
  projectTraceId?: string;
  intent?: string;
  normalizedDirection?: "poster" | "ppt" | "video";
  normalizedCount?: number;
  normalizedRatio?: string;
  ratio?: string;
  imageModel?: string;
  imageModelPolicy?: string;
  tasks?: Array<{
    index?: number;
    outputType?: string;
    aspectRatio?: string;
    size?: string;
    prompt?: string;
    stylePrompt?: string;
    contentTitle?: string;
    contentBody?: string;
    imagePromptDraft?: string;
    visibleText?: {
      title?: string;
      subtitle?: string;
      labels?: string[];
    };
    visualDesign?: {
      layout?: string;
      mainVisual?: string;
      composition?: string;
      textDensity?: string;
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
      mode?: "strict" | "guided" | "minimal";
      titleIdea?: string;
      keyConcepts?: string[];
      language?: string;
      density?: "low" | "medium" | "high" | string;
      allowRewrite?: boolean;
    };
    pageRole?:
      | "cover"
      | "mechanism"
      | "layered-diagram"
      | "comparison"
      | "misconception-fact"
      | "checklist"
      | "system-model";
    factualRules?: string[];
    negativeRules?: string[];
    visualHint?: string;
    composedPrompt?: string;
    provider?: string;
    model?: string;
    quality?: string;
    response_format?: string;
    responseFormat?: string;
  }>;
};

type OrderedImageProvider = "tuzi" | "duomi" | "gptsapi";
type ImageGenerationMode = "mock" | "real" | "dry-run";

const DEFAULT_PROVIDER_POLICY: OrderedImageProvider[] = ["tuzi", "duomi", "gptsapi"];
const PROVIDER_CALL_TIMEOUT_MS = Number.parseInt(process.env.IMAGE2_PROVIDER_CALL_TIMEOUT_MS || "220000", 10);
const FALLBACK_PROVIDER_CALL_TIMEOUT_MS = Number.parseInt(process.env.IMAGE2_PROVIDER_FALLBACK_CALL_TIMEOUT_MS || "60000", 10);
const ROUTE_EXECUTION_BUDGET_MS = Number.parseInt(process.env.IMAGE2_ROUTE_EXECUTION_BUDGET_MS || "260000", 10);
const TASK_EXECUTION_BUDGET_MS = Number.parseInt(process.env.IMAGE2_TASK_EXECUTION_BUDGET_MS || "240000", 10);
const TASKS_PER_REQUEST = Number.parseInt(process.env.IMAGE2_TASKS_PER_REQUEST || "1", 10);
const ASSET_DOWNLOAD_TIMEOUT_MS = Number.parseInt(process.env.IMAGE2_ASSET_DOWNLOAD_TIMEOUT_MS || "45000", 10);
const PROMPT_MAX_CHARS = Number.parseInt(process.env.IMAGE2_PROMPT_MAX_CHARS || "2000", 10);
const WORKSPACE_FLOW_AUDIT = process.env.NODE_ENV === "development";

function logWorkspaceFlowAudit(payload: Record<string, unknown>) {
  if (!WORKSPACE_FLOW_AUDIT) {
    return;
  }
  console.info("[WorkspaceFlowAudit]", payload);
}

function getScopeFromRequest(req: NextRequest, email: string) {
  const forwardedFor = req.headers.get("x-forwarded-for") ?? "";
  const ip = forwardedFor.split(",")[0]?.trim() || "unknown";
  return email ? `user:${email}` : `ip:${ip}`;
}

function ensureSafeOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) {
    return true;
  }
  return origin === req.nextUrl.origin;
}

function normalizeImageModel(imageModel?: string) {
  const raw = (imageModel || "").trim();
  if (!raw) {
    return process.env.IMAGE2_PROVIDER_MODEL || "gpt-image-2";
  }
  if (raw === "gpt-image2") {
    return "gpt-image-2";
  }
  return raw;
}

function normalizeProjectId(value?: string) {
  return (value || "").trim().slice(0, 120) || null;
}

function normalizeProjectTraceId(value?: string) {
  return (value || "").trim().slice(0, 200) || null;
}

function normalizeGenerationRunId(value?: string) {
  return (value || "").trim().slice(0, 120) || null;
}

function compactPromptText(value: string, maxLen: number) {
  return value
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .slice(0, maxLen)
    .trim();
}

function buildDominantLanguageRule(language: string) {
  const dominantLanguage = compactPromptText(language, 48) || "English";
  return [
    `Dominant visible language must be ${dominantLanguage}.`,
    "Page titles, headings, body copy, labels, and callouts must primarily use that language.",
    "Foreign proper nouns, product names, acronyms, and technical terms may remain unchanged as terms only.",
    "Do not let style references, technology terms, or mixed-language source snippets switch the whole visual into another language.",
  ].join(" ");
}

function uniquePromptItems(items: string[], maxItems: number) {
  const seen = new Set<string>();
  const result: string[] = [];
  items.forEach((item) => {
    const compact = compactPromptText(item, 140);
    const key = compact.toLowerCase();
    if (!compact || seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(compact);
  });
  return result.slice(0, maxItems);
}

function buildPromptFromPayloadTask(task: NonNullable<GenerateBatchPayload["tasks"]>[number]) {
  const outputType = compactPromptText(task.outputType || "poster", 20) || "poster";
  const aspectRatio = compactPromptText(task.aspectRatio || "9:16", 24) || "9:16";
  const stylePrompt = compactPromptText(task.stylePrompt || "", 520);
  const title = compactPromptText(task.contentTitle || "", 120);
  const contentBody = compactPromptText(
    task.contentBody || task.prompt || task.composedPrompt || "",
    220,
  );
  const visualHint = compactPromptText(task.visualHint || "", 160);
  const visibleTitle = compactPromptText(task.visibleText?.title || "", 120);
  const visibleSubtitle = compactPromptText(task.visibleText?.subtitle || "", 120);
  const visibleLabels = Array.isArray(task.visibleText?.labels)
    ? uniquePromptItems(
        task.visibleText.labels.map((item) => compactPromptText(String(item || ""), 54)).filter(Boolean),
        4,
      ).join(" | ")
    : "";
  const layout = compactPromptText(task.visualDesign?.layout || "", 180);
  const mainVisual = compactPromptText(task.visualDesign?.mainVisual || "", 180);
  const composition = compactPromptText(task.visualDesign?.composition || "", 180);
  const textDensity = compactPromptText(task.visualDesign?.textDensity || "", 24);
  const textMode = compactPromptText(task.textStrategy?.mode || "", 20) || "guided";
  const textTitleIdea = compactPromptText(task.textStrategy?.titleIdea || "", 80);
  const textConcepts = Array.isArray(task.textStrategy?.keyConcepts)
    ? task.textStrategy?.keyConcepts.map((item) => compactPromptText(String(item || ""), 40)).filter(Boolean).slice(0, 5).join(" | ")
    : "";
  const textLanguage = compactPromptText(task.textStrategy?.language || "", 40) || "Simplified Chinese";
  const dominantLanguageRule = buildDominantLanguageRule(textLanguage);
  const textAllowRewrite = task.textStrategy?.allowRewrite;
  const draftHint = compactPromptText(task.imagePromptDraft || "", 220);
  const factualRules = Array.isArray(task.factualRules)
    ? uniquePromptItems(
        task.factualRules.map((item) => compactPromptText(String(item || ""), 76)).filter(Boolean),
        3,
      ).join(" | ")
    : "";
  const negativeRules = Array.isArray(task.negativeRules)
    ? task.negativeRules.map((item) => compactPromptText(String(item || ""), 80)).filter(Boolean).join(" | ")
    : "";
  const protectedFacts = uniquePromptItems(
    [
      title,
      contentBody,
      visibleLabels,
      factualRules,
    ]
      .join(" ")
      .split(/(?<=[。！？.!?])\s+|[；;]/)
      .filter((item) =>
        /(\d|%|％|\$|美元|人民币|亿元|亿|万|q[1-4]|20\d{2}|19\d{2}|营收|收入|净利润|eps|每股收益|同比|环比|增长|下降|亏损|google|alphabet|nvidia|英伟达|cloud|广告)/i.test(item),
      )
      .map((item) => compactPromptText(item, 110)),
    textMode === "strict" ? 7 : 4,
  ).join(" | ");
  const shortViewVideoRule =
    outputType === "video"
      ? "Video storyboard readability rule: frames are viewed briefly, so avoid small text, dense labels, subtitle-style overlays, tiny chart annotations, fine print, and multi-line notes. If any text appears, keep it very short, large, bold, and glance-readable."
      : "";

  return [
    `Create one ${aspectRatio} ${outputType} visual.`,
    title ? `Topic: ${title}` : "",
    contentBody ? `Current-page brief: ${contentBody}` : "",
    protectedFacts ? `Must keep accurate: ${protectedFacts}` : "",
    mainVisual ? `Hero visual: ${mainVisual}` : "",
    composition ? `Composition: ${composition}` : "",
    stylePrompt ? `Style: ${stylePrompt}` : "",
    stylePrompt
      ? "Style priority: the selected style is mandatory and must override topic/company brand color associations, logos, trademark marks, and corporate visual identity."
      : "",
    "Use one dominant hero visual, integrated infographic composition, embedded callouts, whitespace, and readable hierarchy.",
    "Only use this current page/frame; do not pull facts, labels, titles, or body text from other pages.",
    textMode === "strict" && visibleTitle ? `Source title fact/text: ${visibleTitle}` : "",
    textMode === "strict" && visibleSubtitle ? `Source subtitle fact/text: ${visibleSubtitle}` : "",
    textMode === "strict" && visibleLabels ? `Optional short label ideas: ${visibleLabels}` : "",
    !composition && layout ? `Layout direction: ${layout}` : "",
    textDensity ? `Text density: ${textDensity}` : "",
    shortViewVideoRule,
    `Text: ${textMode === "strict" ? "fact-strict, expression-guided" : textMode}.`,
    textMode === "guided"
      ? `Use concise ${textLanguage} labels. ${dominantLanguageRule} Light rewrite is ${textAllowRewrite === false ? "disabled" : "allowed"} for clarity. No fake numbers, unrelated terms, wrong-language labels, or dense paragraphs.`
      : textMode === "strict"
        ? `Keep protected facts exact. ${dominantLanguageRule} Auxiliary titles and labels may be lightly optimized, but do not invent missing figures, dates, sources, rankings, or conclusions.`
        : "Use minimal on-image text; keep labels extremely short only when needed.",
    textTitleIdea ? `Text title idea: ${textTitleIdea}` : "",
    textConcepts ? `Text key concepts: ${textConcepts}` : "",
    draftHint ? `Optional visual hint: ${draftHint}` : "",
    factualRules && !protectedFacts ? `Factual boundary: ${factualRules}` : "",
    negativeRules ? `Negative rules: ${negativeRules}` : "",
    visualHint ? `Visual guidance: ${visualHint}` : "",
    "Avoid heavy boxed segmentation, dashboard-like panels, internal field names, low-contrast text, and clutter.",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

function clampPromptForImage(prompt: string) {
  const compact = prompt
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
  if (!compact) {
    return "";
  }
  const configuredLimit = Number.isFinite(PROMPT_MAX_CHARS) ? PROMPT_MAX_CHARS : 2000;
  const limit = Math.max(800, Math.min(2000, configuredLimit));
  return compact.slice(0, limit);
}

function parseProviderPolicy(rawPolicy?: string) {
  const raw = (process.env.IMAGE2_PROVIDER_POLICY || rawPolicy || "").trim().toLowerCase();
  if (!raw || raw === "tuzi") {
    return DEFAULT_PROVIDER_POLICY;
  }
  const seen = new Set<OrderedImageProvider>();
  const providers = raw
    .split(/[,\s>]+/)
    .map((item) => item.trim())
    .filter((item): item is OrderedImageProvider =>
      item === "tuzi" || item === "duomi" || item === "gptsapi",
    )
    .filter((item) => {
      if (seen.has(item)) {
        return false;
      }
      seen.add(item);
      return true;
    });
  return providers.length ? providers : DEFAULT_PROVIDER_POLICY;
}

function resolveTaskStorageKey(task: {
  assetPath?: string | null;
}) {
  const raw = (task.assetPath || "").trim();
  if (!raw) {
    return null;
  }
  const marker = "workspace-images/";
  const markerIndex = raw.indexOf(marker);
  if (markerIndex >= 0) {
    return raw.slice(markerIndex);
  }
  return raw;
}

function parseBooleanEnv(name: string, fallback = false) {
  const raw = (process.env[name] || "").trim().toLowerCase();
  if (!raw) {
    return fallback;
  }
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function normalizeImageGenerationModeValue(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "mock" || normalized === "real" || normalized === "dry-run") {
    return normalized;
  }
  return "";
}

function resolveImageGenerationMode(request: NextRequest): ImageGenerationMode {
  const envMode = normalizeImageGenerationModeValue(process.env.IMAGE_GENERATION_MODE || "");
  const legacyMock = parseBooleanEnv("IMAGE_GENERATION_MOCK", false);
  let mode: ImageGenerationMode = envMode
    ? (envMode as ImageGenerationMode)
    : legacyMock
      ? "mock"
      : "real";

  if (process.env.NODE_ENV !== "production") {
    const headerMode = normalizeImageGenerationModeValue(
      request.headers.get("x-knowlens-image-mode") || "",
    );
    const queryMode = normalizeImageGenerationModeValue(
      request.nextUrl.searchParams.get("imageMode") || "",
    );
    const debugMode = headerMode || queryMode;
    if (debugMode) {
      mode = debugMode as ImageGenerationMode;
    } else if (mode === "real") {
      // Local debug helper only; IMAGE_GENERATION_MODE remains the primary switch.
      const legacyHeader = (request.headers.get("x-knowlens-image-mock") || "").trim().toLowerCase();
      const legacyQuery = (request.nextUrl.searchParams.get("mockImage") || "").trim().toLowerCase();
      if (legacyHeader === "1" || legacyHeader === "true" || legacyQuery === "1" || legacyQuery === "true") {
        mode = "mock";
      }
    }
  }
  return mode;
}

function normalizeProviderTimeoutMs() {
  if (!Number.isFinite(PROVIDER_CALL_TIMEOUT_MS)) {
    return 220_000;
  }
  return Math.max(60_000, Math.min(240_000, PROVIDER_CALL_TIMEOUT_MS));
}

function normalizeFallbackProviderTimeoutMs() {
  if (!Number.isFinite(FALLBACK_PROVIDER_CALL_TIMEOUT_MS)) {
    return 60_000;
  }
  return Math.max(30_000, Math.min(90_000, FALLBACK_PROVIDER_CALL_TIMEOUT_MS));
}

function normalizeRouteBudgetMs() {
  if (!Number.isFinite(ROUTE_EXECUTION_BUDGET_MS)) {
    return 260_000;
  }
  return Math.max(120_000, Math.min(260_000, ROUTE_EXECUTION_BUDGET_MS));
}

function normalizeTaskBudgetMs() {
  if (!Number.isFinite(TASK_EXECUTION_BUDGET_MS)) {
    return 240_000;
  }
  return Math.max(120_000, Math.min(240_000, TASK_EXECUTION_BUDGET_MS));
}

function normalizeTasksPerRequest() {
  if (!Number.isFinite(TASKS_PER_REQUEST)) {
    return 1;
  }
  return Math.max(1, Math.min(2, TASKS_PER_REQUEST));
}

function normalizeAssetDownloadTimeoutMs() {
  if (!Number.isFinite(ASSET_DOWNLOAD_TIMEOUT_MS)) {
    return 45_000;
  }
  return Math.max(15_000, Math.min(60_000, ASSET_DOWNLOAD_TIMEOUT_MS));
}

function isTimeoutCode(code?: string | null) {
  return /TIMEOUT|BUDGET_EXHAUSTED/i.test(code || "");
}

function logImageBatchEvent(payload: Record<string, unknown>) {
  console.info("[image.generate-batch]", {
    timestamp: new Date().toISOString(),
    ...payload,
  });
}

function buildProviderFailure(
  provider: OrderedImageProvider,
  errorCode: string,
  errorMessage: string,
  detail?: string,
): Image2ProviderFailure {
  return {
    ok: false,
    errorCode,
    errorMessage,
    detail: detail || provider,
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function requestImageByPolicy(input: {
  providerPolicy: OrderedImageProvider[];
  imageModel: string;
  prompt: string;
  aspectRatio: string;
  size: string;
  routeStartedAt: number;
  taskDeadlineAt: number;
  allowProviderFallback: boolean;
}) {
  const skippedProviderSet = new Set<OrderedImageProvider>();
  const providerFallbackDisabled = !input.allowProviderFallback;
  const attemptedProviders: OrderedImageProvider[] = [];
  const attempts: Array<{
    provider: OrderedImageProvider;
    ok: boolean;
    elapsedMs: number;
    errorCode?: string;
    errorMessage?: string;
  }> = [];
  const routeBudgetMs = normalizeRouteBudgetMs();
  const orderedProviders = input.allowProviderFallback
    ? input.providerPolicy
    : input.providerPolicy.slice(0, 1);
  let lastFailure: Image2ProviderFailure | null = null;
  let lastProvider: OrderedImageProvider = orderedProviders[0] ?? "tuzi";

  for (const provider of orderedProviders) {
    const elapsed = Date.now() - input.routeStartedAt;
    const remainingBudget = routeBudgetMs - elapsed;
    const remainingTaskBudget = input.taskDeadlineAt - Date.now();
    if (remainingBudget < 18_000 || remainingTaskBudget < 10_000) {
      const result = buildProviderFailure(
        provider,
        remainingTaskBudget < 10_000 ? "IMAGE_TASK_TIMEOUT" : "IMAGE_ROUTE_BUDGET_EXHAUSTED",
        remainingTaskBudget < 10_000
          ? "Image task exceeded its execution budget."
          : "Image generation exceeded route execution budget.",
        `remainingBudget=${remainingBudget};remainingTaskBudget=${remainingTaskBudget}`,
      );
      return {
        providerUsed: provider,
        attemptedProviders,
        skippedProviders: Array.from(skippedProviderSet),
        providerFallbackDisabled,
        attempts,
        result,
      };
    }

    const config = buildImage2ProviderConfig(provider);
    if (!config) {
      skippedProviderSet.add(provider);
      attempts.push({
        provider,
        ok: false,
        elapsedMs: 0,
        errorCode: `${provider.toUpperCase()}_KEY_MISSING`,
        errorMessage: `${provider} provider key is not configured.`,
      });
      continue;
    }

    attemptedProviders.push(provider);
    lastProvider = provider;
    config.model = provider === "tuzi" ? input.imageModel : config.model;
    if (provider === "tuzi") {
      const endpoint = (process.env.IMAGE2_TUZI_PROVIDER_ENDPOINT || "https://api.tu-zi.com/v1/images/generations").trim();
      config.endpoint = /\/images\/edits(?:$|\?)/i.test(endpoint)
        ? endpoint.replace(/\/images\/edits(?=$|\?)/i, "/images/generations")
        : endpoint;
    }

    const fallbackAwareTimeoutMs = input.allowProviderFallback
      ? normalizeFallbackProviderTimeoutMs()
      : normalizeProviderTimeoutMs();
    const timeoutMs = Math.min(
      fallbackAwareTimeoutMs,
      Math.max(10_000, remainingBudget - 5_000),
      Math.max(10_000, remainingTaskBudget - 5_000),
    );
    const providerStartedAt = Date.now();
    try {
      const result = await withTimeout(
        requestImage2Generation(config, {
          size: input.size,
          aspectRatio: input.aspectRatio,
          prompt: input.prompt,
        }),
        timeoutMs,
        `${provider} provider timeout`,
      );

      if (result.ok) {
        const parsedFromRaw =
          provider === "tuzi"
            ? parseTuziImageUrl((() => {
                try {
                  return result.rawText ? JSON.parse(result.rawText) : null;
                } catch {
                  return null;
                }
              })())
            : "";
        const resolvedImageUrl = parsedFromRaw || result.imageUrl;
        if (!resolvedImageUrl) {
          const missingUrlFailure = buildProviderFailure(
            provider,
            `${provider.toUpperCase()}_IMAGE_URL_MISSING`,
            "Image provider response did not include image URL.",
          );
          attempts.push({
            provider,
            ok: false,
            elapsedMs: Date.now() - providerStartedAt,
            errorCode: missingUrlFailure.errorCode,
            errorMessage: missingUrlFailure.errorMessage,
          });
          lastFailure = missingUrlFailure;
          continue;
        }
        attempts.push({
          provider,
          ok: true,
          elapsedMs: Date.now() - providerStartedAt,
        });
        return {
          providerUsed: provider,
          attemptedProviders,
          skippedProviders: Array.from(skippedProviderSet),
          providerFallbackDisabled,
          attempts,
          result: {
            ...result,
            imageUrl: resolvedImageUrl,
          },
        };
      }

      const mappedFailure: Image2ProviderFailure = {
        ...result,
        errorCode:
          result.errorCode === "IMAGE2_NO_URL"
            ? `${provider.toUpperCase()}_IMAGE_URL_MISSING`
            : result.errorCode,
      };
      attempts.push({
        provider,
        ok: false,
        elapsedMs: Date.now() - providerStartedAt,
        errorCode: mappedFailure.errorCode,
        errorMessage: mappedFailure.errorMessage,
      });
      lastFailure = mappedFailure;
    } catch (error) {
      const timeoutFailure = buildProviderFailure(
        provider,
        `${provider.toUpperCase()}_TIMEOUT`,
        "Image provider request timed out.",
        error instanceof Error ? error.message : "Unknown timeout",
      );
      attempts.push({
        provider,
        ok: false,
        elapsedMs: Date.now() - providerStartedAt,
        errorCode: timeoutFailure.errorCode,
        errorMessage: timeoutFailure.errorMessage,
      });
      lastFailure = timeoutFailure;
    }
  }

  const result =
    lastFailure ||
    buildProviderFailure(
      lastProvider,
      "IMAGE_PROVIDER_NOT_CONFIGURED",
      "No image provider is configured.",
    );
  return {
    providerUsed: lastProvider,
    attemptedProviders,
    skippedProviders: Array.from(skippedProviderSet),
    providerFallbackDisabled,
    attempts,
    result,
  };
}

async function isFreeUserBySubscription(email: string) {
  const row = (await getLatestSubscriptionDb(email)) as { status?: string } | null;
  if (!row) {
    return true;
  }
  const status = (row.status || "").trim().toLowerCase();
  return !(status === "active" || status === "canceling");
}

function appendFreeWatermarkInstruction(prompt: string) {
  const watermarkLine = [
    'Render this exact free-plan watermark text: "Generated by KnowLens.ai".',
    "Watermark placement must be consistent across posters, slides, and video frames: top center, inside the safe margin, above or separate from the main content.",
    "Watermark style must be fixed and unobtrusive: small sans-serif text, medium weight, neutral gray on light backgrounds or soft warm white on dark backgrounds, low contrast but readable.",
    "Do not use accent colors, colored badges, borders, rounded pills, shadows, glow, icons, logos, or decorative containers for the watermark.",
    "Keep the watermark size, alignment, and color treatment stable across the whole series; do not let the selected visual style redesign it.",
  ].join(" ");
  return clampPromptForImage(`${prompt}\n\n[Internal rendering constraint]\n${watermarkLine}`);
}

function normalizeTasksFromPayload(payload: GenerateBatchPayload) {
  const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
  const normalized = tasks
    .map((task, idx) => {
      const index = Number.isFinite(task.index) ? Math.max(1, Math.round(Number(task.index))) : idx + 1;
      const prompt = clampPromptForImage(task.prompt || task.composedPrompt || buildPromptFromPayloadTask(task));
      if (!prompt) {
        return null;
      }
      const aspectRatio = (task.aspectRatio || payload.normalizedRatio || payload.ratio || "9:16").trim() || "9:16";
      const normalizedRatio = normalizeTuziAspectRatio(aspectRatio);
      const resolvedSize = (task.size || "").trim() || (normalizedRatio ? resolveTuziImageSize(normalizedRatio) || "" : "");
      if (!normalizedRatio || !resolvedSize) {
        return null;
      }
      return {
        index,
        outputType: (task.outputType || "poster").trim() || "poster",
        aspectRatio: normalizedRatio,
        size: resolvedSize,
        prompt,
        provider: "tuzi",
        model: normalizeImageModel(task.model || payload.imageModel || "gpt-image-2"),
        quality: (task.quality || "standard").trim().toLowerCase() === "standard" ? "standard" : "standard",
        responseFormat:
          (task.response_format || task.responseFormat || "url").trim().toLowerCase() === "url" ? "url" : "url",
      } satisfies ImageGenerationTaskPayload;
    })
  .filter(Boolean) as ImageGenerationTaskPayload[];
  return normalized;
}

function buildProjectPagesFromPayload(payload: GenerateBatchPayload, normalizedTasks: ImageGenerationTaskPayload[]) {
  const rawTasks = Array.isArray(payload.tasks) ? payload.tasks : [];
  return normalizedTasks.map((task) => {
    const rawTask =
      rawTasks.find((item) => Math.round(Number(item.index || 0)) === task.index) ||
      rawTasks[task.index - 1] ||
      null;
    const visualDesign = rawTask?.visualDesign;
    return {
      index: task.index,
      outputType: task.outputType,
      pageRole: rawTask?.pageRole || visualDesign?.pageRole || null,
      title: rawTask?.contentTitle || rawTask?.visibleText?.title || "",
      subtitle: rawTask?.visibleText?.subtitle || "",
      body: rawTask?.contentBody || "",
      visual:
        visualDesign?.mainVisual ||
        visualDesign?.composition ||
        visualDesign?.layout ||
        rawTask?.visualHint ||
        "",
      imagePromptDraft: rawTask?.imagePromptDraft || rawTask?.visualHint || "",
    };
  });
}

function getImageGenerationMockUrl() {
  return (process.env.IMAGE_GENERATION_MOCK_URL || "https://picsum.photos/1024/1024").trim();
}

export async function POST(request: NextRequest) {
  try {
    const routeStartedAt = Date.now();
    if (!ensureSafeOrigin(request)) {
      return NextResponse.json({ error: "Forbidden request origin." }, { status: 403 });
    }
    const session = await getServerSession(nextAuthOptions);
    const email = session?.user?.email?.trim().toLowerCase() || "";
    if (!email) {
      return NextResponse.json({ error: "Please sign in before generating images." }, { status: 401 });
    }

    let payload: GenerateBatchPayload | null = null;
    try {
      payload = (await request.json()) as GenerateBatchPayload;
    } catch {
      payload = null;
    }
    if (!payload) {
      return NextResponse.json({ error: "Invalid generation payload." }, { status: 400 });
    }

    logWorkspaceFlowAudit({
      stage: "8.backend-generate-batch-receive",
      status: "received",
      decision: "parse-request-payload",
      reason: "request-json-parsed",
      keyFields: {
        projectId: payload.projectId || null,
        runId: payload.runId || null,
        idempotencyKey: payload.idempotencyKey || null,
        taskCount: Array.isArray(payload.tasks) ? payload.tasks.length : 0,
      },
    });

    const normalizedTasks = normalizeTasksFromPayload(payload);
    if (!normalizedTasks.length) {
      return NextResponse.json(
        {
          error: "At least one valid generation task is required.",
          code: "GENERATION_TASKS_REQUIRED",
        },
        { status: 400 },
      );
    }
    logWorkspaceFlowAudit({
      stage: "8.backend-generate-batch-validate",
      status: "accepted",
      decision: "normalized-tasks-ready",
      reason: "payload-valid",
      keyFields: {
        projectId: payload.projectId || null,
        runId: payload.runId || null,
        normalizedTaskCount: normalizedTasks.length,
        normalizedTaskIndexes: normalizedTasks.map((task) => task.index),
        provider: "tuzi",
      },
    });

    const imageGenerationMode = resolveImageGenerationMode(request);
    if (process.env.NODE_ENV === "production" && imageGenerationMode === "mock") {
      return NextResponse.json(
        {
          error: "IMAGE_GENERATION_MODE=mock is disabled in production.",
          code: "IMAGE_MODE_MOCK_DISABLED",
        },
        { status: 400 },
      );
    }
    const productionRequiresRemoteState =
      process.env.NODE_ENV === "production" &&
      parseBooleanEnv("IMAGE_GENERATION_USE_BLOB_STATE", true) &&
      !parseBooleanEnv("IMAGE_GENERATION_ALLOW_SQLITE_IN_PRODUCTION", false);
    if (
      productionRequiresRemoteState &&
      !process.env.BLOB_READ_WRITE_TOKEN &&
      !process.env.BLOB_STORE_ID
    ) {
      return NextResponse.json(
        {
          error:
            "Image generation state store is not configured for production. Configure Vercel Blob state (BLOB_READ_WRITE_TOKEN) or explicitly allow sqlite fallback.",
          code: "IMAGE_STATE_STORE_NOT_CONFIGURED",
        },
        { status: 503 },
      );
    }

    const imageModelPolicy = process.env.IMAGE2_PROVIDER_POLICY || payload.imageModelPolicy || "tuzi,duomi,gptsapi";
    const providerPolicy = parseProviderPolicy(imageModelPolicy);
    const allowProviderFallback = parseBooleanEnv("IMAGE2_PROVIDER_FALLBACK_ENABLED", false) && providerPolicy.length > 1;
    const fallbackSkippedProviders = [] as OrderedImageProvider[];
    const idempotencyKey = (payload.idempotencyKey || "").trim().slice(0, 220);
    const generationRunId =
      normalizeGenerationRunId(payload.runId) ||
      `run-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
    const imageModel = normalizeImageModel(payload.imageModel);
    const mockImageUrl = getImageGenerationMockUrl();
    if (imageGenerationMode === "mock") {
      const projectId = normalizeProjectId(payload.projectId);
      const projectTraceId = normalizeProjectTraceId(payload.projectTraceId);
      const mockJobId = `mock-imgjob-${Date.now()}`;
      logOpsEvent({
        category: "image",
        action: "image_generation_mocked",
        status: "ok",
        source: imageModel,
        userEmail: email,
        projectId: projectId ?? undefined,
        message: "imageGenerationMode=mock; skipped real image provider call.",
        details: {
          imageGenerationMode: "mock",
          runId: generationRunId,
          projectTraceId,
          intent: payload.intent ?? "poster",
          ratio: payload.ratio ?? null,
          taskCount: normalizedTasks.length,
          imageModelPolicy,
          providerPolicy,
          attemptedProviders: ["mock"],
          skippedProviders: fallbackSkippedProviders.length ? fallbackSkippedProviders : providerPolicy,
          providerFallbackDisabled: !allowProviderFallback,
          mockImageUrl,
        },
      });
      return NextResponse.json({
        ok: true,
        reused: false,
        imageGenerationMode: "mock",
        attemptedProviders: ["mock"],
        skippedProviders: fallbackSkippedProviders.length ? fallbackSkippedProviders : providerPolicy,
        job: {
          id: mockJobId,
          runId: generationRunId,
          status: "completed",
        },
        tasks: normalizedTasks.map((task) => ({
          taskId: `mock-imgtask-${task.index}`,
          index: task.index,
          status: "asset_ready",
          ok: true,
          imageUrl: buildImageRenderUrl(`mock-imgtask-${task.index}`, "mock"),
          renderUrl: buildImageRenderUrl(`mock-imgtask-${task.index}`, "mock"),
          rawImageUrl: mockImageUrl,
          storageKey: `workspace-images/mock/mock-imgtask-${task.index}.png`,
          provider: "tuzi",
          model: "gpt-image-2",
          error: null,
          errorCode: null,
        })),
      });
    }

    logWorkspaceFlowAudit({
      stage: "8.backend-generate-batch-mode",
      status: "running",
      decision: "real-generation",
      reason: "imageGenerationMode=real",
      keyFields: {
        projectId: payload.projectId || null,
        runId: generationRunId,
        imageGenerationMode,
        providerPolicy,
      },
    });
    if (idempotencyKey) {
      const existingJob = await findImageGenerationJobByIdempotency({
        userEmail: email,
        idempotencyKey,
        runId: generationRunId,
      });
      if (existingJob) {
        const existingDetails = await getImageGenerationJobById(existingJob.id);
        if (existingDetails) {
          const attemptedProviders = Array.from(
            new Set(existingDetails.tasks.map((task) => task.providerUsed).filter(Boolean)),
          );
          return NextResponse.json({
            ok: true,
            reused: true,
            imageGenerationMode,
            attemptedProviders,
            skippedProviders: [],
            job: {
              ...existingDetails.job,
              runId: existingDetails.job.runId || generationRunId,
            },
            tasks: existingDetails.tasks.map((task) => ({
              taskId: task.id,
              index: task.taskIndex,
              status: task.status,
              ok: task.status === "asset_ready",
              imageUrl: task.renderUrl || buildImageRenderUrl(task.id, task.updatedAt),
              renderUrl: task.renderUrl || buildImageRenderUrl(task.id, task.updatedAt),
              rawImageUrl: task.rawImageUrl,
              storageKey: resolveTaskStorageKey(task),
              provider: task.providerUsed,
              model: imageModel,
              error: task.errorMessage,
              errorCode: task.errorCode,
            })),
          });
        }
      }
    }

    const projectId = normalizeProjectId(payload.projectId);
    const projectTraceId = normalizeProjectTraceId(payload.projectTraceId);
    const job = await createImageGenerationJob({
      userEmail: email,
      projectId: projectId ?? undefined,
      intent: payload.intent || "poster",
      ratio: payload.ratio || normalizedTasks[0]?.aspectRatio || "9:16",
      imageModelPolicy,
      idempotencyKey: idempotencyKey || undefined,
      runId: generationRunId,
      requestSnapshot: payload,
      tasks: normalizedTasks,
    });

    if (projectId) {
      const projectPages = buildProjectPagesFromPayload(payload, normalizedTasks);
      await upsertWorkspaceProjectPages({
        userEmail: email,
        projectId,
        outputType: payload.intent || payload.normalizedDirection || normalizedTasks[0]?.outputType || "poster",
        pages: projectPages,
      });
      for (const task of job.tasks) {
        await bindWorkspaceProjectPageTask({
          userEmail: email,
          projectId,
          outputType: task.outputType || payload.intent || "poster",
          pageIndex: task.taskIndex,
          taskId: task.id,
          status: "queued",
        });
      }
    }

    if (imageGenerationMode === "dry-run") {
      logOpsEvent({
        category: "image",
        action: "image_job_dry_run_created",
        status: "ok",
        source: imageModel,
        userEmail: email,
        projectId: projectId ?? undefined,
        message: "imageGenerationMode=dry-run; job/tasks created without provider call.",
        details: {
          imageGenerationMode: "dry-run",
          runId: generationRunId,
          projectTraceId,
          intent: payload.intent ?? "poster",
          ratio: payload.ratio ?? null,
          taskCount: normalizedTasks.length,
          imageModelPolicy,
          providerPolicy,
          attemptedProviders: [],
          skippedProviders: providerPolicy,
          providerFallbackDisabled: !allowProviderFallback,
        },
      });
      return NextResponse.json({
        ok: true,
        reused: false,
        imageGenerationMode: "dry-run",
        attemptedProviders: [],
        skippedProviders: providerPolicy,
        job: {
          id: job.jobId,
          runId: generationRunId,
          status: "queued",
        },
        tasks: job.tasks.map((task) => {
          const payloadTask = normalizedTasks.find((item) => item.index === task.taskIndex) ?? normalizedTasks[0];
          const expectedStorageKey = buildImageAssetStorageKey({
            projectId,
            taskId: task.id,
            mimeType: "image/png",
          });
          return {
            taskId: task.id,
            index: task.taskIndex,
            status: task.status,
            ok: false,
            imageUrl: buildImageRenderUrl(task.id, "dry-run"),
            renderUrl: buildImageRenderUrl(task.id, "dry-run"),
            rawImageUrl: task.rawImageUrl,
            provider: "tuzi",
            model: payloadTask?.model || imageModel,
            storageKey: expectedStorageKey,
            expectedStorageKey,
            expectedRenderUrl: buildImageRenderUrl(task.id, "dry-run"),
            tuziPayload: payloadTask
              ? {
                  model: payloadTask.model || imageModel,
                  prompt: payloadTask.prompt,
                  size: payloadTask.size,
                  n: 1,
                  quality: payloadTask.quality || "standard",
                  response_format: payloadTask.responseFormat || "url",
                }
              : null,
            error: task.errorMessage,
            errorCode: task.errorCode,
          };
        }),
      });
    }

    await incrementUsageCounter({
      scopeKey: getScopeFromRequest(request, email),
      metricKey: "workspace:image_generate_batch",
    });

    await updateImageGenerationJobStatus({
      jobId: job.jobId,
      status: "running",
    });

    logImageBatchEvent({
      requestId: idempotencyKey || generationRunId,
      jobId: job.jobId,
      projectId,
      userEmail: email,
      taskCount: normalizedTasks.length,
      currentStep: "job-created",
      provider: providerPolicy[0] ?? "unknown",
      model: imageModel,
      durationMs: Date.now() - routeStartedAt,
      generatedCount: 0,
      failedCount: 0,
    });

    logOpsEvent({
      category: "image",
      action: "image_job_started",
      status: "info",
      source: imageModel,
      userEmail: email,
      projectId: projectId ?? undefined,
      message: `Image generation job ${job.jobId} started.`,
      details: {
        imageGenerationMode: "real",
        runId: generationRunId,
        projectTraceId,
        intent: payload.intent ?? "poster",
        ratio: payload.ratio ?? null,
        taskCount: normalizedTasks.length,
        imageModelPolicy,
        providerFallbackDisabled: !allowProviderFallback,
      },
    });
    if (!allowProviderFallback && providerPolicy.length > 1) {
      logOpsEvent({
        category: "image",
        action: "provider_fallback_disabled",
        status: "info",
        source: imageModel,
        userEmail: email,
        projectId: projectId ?? undefined,
        message: "providerFallbackDisabled: only primary provider will be attempted.",
        details: {
          imageGenerationMode: "real",
          runId: generationRunId,
          providerFallbackDisabled: true,
          attemptedProviders: [],
          skippedProviders: providerPolicy.slice(1),
          providerPolicy,
        },
      });
    }

    logImageBatchEvent({
      requestId: idempotencyKey || generationRunId,
      jobId: job.jobId,
      projectId,
      userEmail: email,
      taskCount: job.tasks.length,
      currentStep: "queued-return",
      provider: providerPolicy[0] ?? "unknown",
      model: imageModel,
      durationMs: Date.now() - routeStartedAt,
      generatedCount: 0,
      failedCount: 0,
    });

    return NextResponse.json({
      ok: true,
      reused: false,
      imageGenerationMode: "real",
      attemptedProviders: [],
      skippedProviders: [],
      job: {
        id: job.jobId,
        runId: generationRunId,
        status: "running",
      },
      tasks: job.tasks.map((task) => ({
        taskId: task.id,
        index: task.taskIndex,
        status: task.status,
        ok: false,
        imageUrl: undefined,
        renderUrl: undefined,
        rawImageUrl: task.rawImageUrl,
        storageKey: resolveTaskStorageKey(task),
        provider: task.providerUsed,
        model: imageModel,
        error: task.errorMessage,
        errorCode: task.errorCode,
      })),
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Image generate-batch failed.";
    logOpsEvent({
      category: "image",
      action: "image_generation_failed",
      status: "error",
      source: "unknown",
      code: "IMAGE_BATCH_INTERNAL",
      message,
      details: {
        stage: "image_generate_batch_internal",
      },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
