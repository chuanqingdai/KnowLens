import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import {
  buildImage2ProviderConfig,
  createDuomiImageGenerationTask,
  pollDuomiImageGenerationTask,
  requestImage2Generation,
  type Image2AllowedAspectRatio,
  type Image2AsyncProviderConfig,
  type Image2ProviderFailure,
} from "@/lib/server/image2";
import {
  applyRefundsForFailedImageGenerationTasks,
  buildImageRenderUrl,
  claimQueuedImageGenerationTask,
  decodeImageGenerationProviderTaskMetadata,
  encodeImageGenerationProviderTaskMetadata,
  expireAbandonedImageGenerationJob,
  getImageGenerationJobById,
  persistRemoteImageAsset,
  sanitizeImageGenerationRawImageUrl,
  sanitizeImageGenerationTaskErrorMessage,
  syncImageGenerationJobFinalStatus,
  updateImageGenerationTask,
  type ImageGenerationTaskRow,
} from "@/lib/server/image-generation-jobs";
import {
  buildGenerationTaskStatusSummary,
  isFreeUserBySubscriptionSafe,
  logGenerationOpsEvent,
  logOpsEvent,
} from "@/lib/server/store";
import { updateWorkspaceProjectPageImage } from "@/lib/server/workspace-project-pages";
import {
  parseTuziImageUrl,
  resolveTuziImageSize,
} from "@/lib/workspace/tuzi-image";

export const runtime = "nodejs";
export const maxDuration = 600;

type OrderedImageProvider = "tuzi" | "duomi" | "gptsapi";

const DEFAULT_PROVIDER_POLICY: OrderedImageProvider[] = ["tuzi", "duomi", "gptsapi"];
const PROVIDER_CALL_TIMEOUT_MS = Number.parseInt(process.env.IMAGE2_PROVIDER_CALL_TIMEOUT_MS || "360000", 10);
const FALLBACK_PROVIDER_CALL_TIMEOUT_MS = Number.parseInt(process.env.IMAGE2_PROVIDER_FALLBACK_CALL_TIMEOUT_MS || "360000", 10);
const ROUTE_EXECUTION_BUDGET_MS = Number.parseInt(process.env.IMAGE2_ROUTE_EXECUTION_BUDGET_MS || "590000", 10);
const TASK_EXECUTION_BUDGET_MS = Number.parseInt(process.env.IMAGE2_TASK_EXECUTION_BUDGET_MS || "570000", 10);
const ASSET_DOWNLOAD_TIMEOUT_MS = Number.parseInt(process.env.IMAGE2_ASSET_DOWNLOAD_TIMEOUT_MS || "45000", 10);
const STEP_RUN_MAX_ACTIVE_TASKS = 5;

function ensureSafeOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) {
    return true;
  }
  return origin === req.nextUrl.origin;
}

function normalizeJobId(value?: string) {
  return (value || "").trim().slice(0, 120);
}

function normalizeTaskId(value?: string) {
  return (value || "").trim().slice(0, 120);
}

function parseBooleanEnv(name: string, fallback = false) {
  const raw = (process.env[name] || "").trim().toLowerCase();
  if (!raw) {
    return fallback;
  }
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function parseProviderPolicy(rawPolicy?: string | null) {
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

function normalizeProviderTimeoutMs() {
  if (!Number.isFinite(PROVIDER_CALL_TIMEOUT_MS)) {
    return 360_000;
  }
  return Math.max(60_000, Math.min(360_000, PROVIDER_CALL_TIMEOUT_MS));
}

function normalizeFallbackProviderTimeoutMs() {
  if (!Number.isFinite(FALLBACK_PROVIDER_CALL_TIMEOUT_MS)) {
    return 360_000;
  }
  return Math.max(30_000, Math.min(360_000, FALLBACK_PROVIDER_CALL_TIMEOUT_MS));
}

function normalizeRouteBudgetMs() {
  if (!Number.isFinite(ROUTE_EXECUTION_BUDGET_MS)) {
    return 590_000;
  }
  return Math.max(120_000, Math.min(590_000, ROUTE_EXECUTION_BUDGET_MS));
}

function normalizeTaskBudgetMs() {
  if (!Number.isFinite(TASK_EXECUTION_BUDGET_MS)) {
    return 570_000;
  }
  return Math.max(120_000, Math.min(570_000, TASK_EXECUTION_BUDGET_MS));
}

function normalizeAssetDownloadTimeoutMs() {
  if (!Number.isFinite(ASSET_DOWNLOAD_TIMEOUT_MS)) {
    return 45_000;
  }
  return Math.max(15_000, Math.min(60_000, ASSET_DOWNLOAD_TIMEOUT_MS));
}

function normalizeStepRunMaxActiveTasks() {
  const raw = Number.parseInt(process.env.IMAGE2_STEP_RUN_MAX_ACTIVE_TASKS || "", 10);
  if (!Number.isFinite(raw)) {
    return STEP_RUN_MAX_ACTIVE_TASKS;
  }
  return Math.max(1, Math.min(5, raw));
}

function isTimeoutCode(code?: string | null) {
  return /TIMEOUT|BUDGET_EXHAUSTED/i.test(code || "");
}

function normalizeImageModel(imageModel?: string | null) {
  const raw = (imageModel || "").trim();
  if (!raw) {
    return process.env.IMAGE2_PROVIDER_MODEL || "gpt-image-2";
  }
  if (raw === "gpt-image2") {
    return "gpt-image-2";
  }
  return raw;
}

function resolveTaskStorageKey(task: { assetPath?: string | null }) {
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

function appendFreeWatermarkInstruction(prompt: string) {
  const watermarkLine = [
    'Render this exact free-plan watermark text: "Generated by KnowLens.ai".',
    "Watermark placement must be consistent across posters, slides, and video frames: top center, inside the safe margin, above or separate from the main content.",
    "Watermark style must be fixed and unobtrusive: small sans-serif text, medium weight, neutral gray on light backgrounds or soft warm white on dark backgrounds, low contrast but readable.",
    "Do not use accent colors, colored badges, borders, rounded pills, shadows, glow, icons, logos, or decorative containers for the watermark.",
    "Keep the watermark size, alignment, and color treatment stable across the whole series; do not let the selected visual style redesign it.",
  ].join(" ");
  return `${prompt.trim()}\n\n[Internal rendering constraint]\n${watermarkLine}`.trim();
}

function logImageTaskRunEvent(payload: Record<string, unknown>) {
  console.info("[image.task-run]", {
    timestamp: new Date().toISOString(),
    ...payload,
  });
}

function readProjectTraceId(job: { requestJson?: string | null }) {
  try {
    const snapshot = job.requestJson ? JSON.parse(job.requestJson) : null;
    return typeof snapshot?.projectTraceId === "string" && snapshot.projectTraceId.trim()
      ? snapshot.projectTraceId.trim().slice(0, 200)
      : null;
  } catch {
    return null;
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

function serializeTask(task: ImageGenerationTaskRow, imageModel: string) {
  const readyUrl = task.renderUrl || (task.status === "asset_ready" ? buildImageRenderUrl(task.id, task.updatedAt) : undefined);
  return {
    taskId: task.id,
    index: task.taskIndex,
    status: task.status,
    attempts: task.attempts,
    providerUsed: task.providerUsed,
    ok: task.status === "asset_ready",
    imageUrl: readyUrl,
    renderUrl: readyUrl,
    rawImageUrl: sanitizeImageGenerationRawImageUrl(task.rawImageUrl),
    storageKey: resolveTaskStorageKey(task),
    provider: task.providerUsed,
    model: imageModel,
    error: sanitizeImageGenerationTaskErrorMessage(task.errorMessage),
    errorCode: task.errorCode,
    errorMessage: sanitizeImageGenerationTaskErrorMessage(task.errorMessage),
    width: task.width,
    height: task.height,
    mimeType: task.mimeType,
  };
}

function resolveDuomiStepRunConfig(): Image2AsyncProviderConfig | null {
  const config = buildImage2ProviderConfig("duomi");
  if (!config) {
    return null;
  }
  return config.duomiProvider ?? {
    endpoint: config.endpoint,
    apiKey: config.apiKey,
    model: config.model,
  };
}

function normalizeDuomiAspectRatio(value?: string | null): Image2AllowedAspectRatio {
  const normalized = (value || "").trim();
  return normalized === "1:1" ||
    normalized === "9:16" ||
    normalized === "16:9" ||
    normalized === "4:3" ||
    normalized === "3:4"
    ? normalized
    : "auto";
}

function mapAssetPersistError(message: string) {
  if (/IMAGE_STORAGE_NOT_CONFIGURED/i.test(message)) return "IMAGE_STORAGE_NOT_CONFIGURED";
  if (/IMAGE_DOWNLOAD_INVALID_CONTENT_TYPE/i.test(message)) return "IMAGE_DOWNLOAD_INVALID_CONTENT_TYPE";
  if (/IMAGE_UPLOAD_FAILED/i.test(message)) return "IMAGE_UPLOAD_FAILED";
  if (/IMAGE_DOWNLOAD_FAILED/i.test(message)) return "IMAGE_DOWNLOAD_FAILED";
  if (/IMAGE_TASK_TIMEOUT/i.test(message)) return "IMAGE_TASK_TIMEOUT";
  return "IMAGE_ASSET_PERSIST_FAILED";
}

function isTerminalTaskStatus(status?: string | null) {
  const normalized = (status || "").trim();
  return normalized === "asset_ready" || normalized === "failed" || normalized === "timed_out" || normalized === "billing_failed";
}

export async function POST(request: NextRequest) {
  const routeStartedAt = Date.now();
  let cleanupContext: {
    email?: string;
    jobId?: string;
    current?: Awaited<ReturnType<typeof getImageGenerationJobById>>;
    queuedTask?: ImageGenerationTaskRow;
    imageModel?: string;
    providerUsed?: string;
    projectId?: string | null;
  } = {};
  try {
    if (!ensureSafeOrigin(request)) {
      return NextResponse.json({ error: "Forbidden request origin." }, { status: 403 });
    }

    const session = await getServerSession(nextAuthOptions);
    const email = session?.user?.email?.trim().toLowerCase() || "";
    if (!email) {
      return NextResponse.json({ error: "Please sign in before generating images." }, { status: 401 });
    }
    cleanupContext.email = email;

    const body = (await request.json().catch(() => null)) as { jobId?: string; taskId?: string } | null;
    const jobId = normalizeJobId(body?.jobId);
    if (!jobId) {
      return NextResponse.json({ error: "jobId is required.", code: "IMAGE_JOB_ID_REQUIRED" }, { status: 400 });
    }
    const requestedTaskId = normalizeTaskId(body?.taskId);
    cleanupContext.jobId = jobId;

    const current =
      (await expireAbandonedImageGenerationJob({
        jobId,
        source: "image_task_run_precheck",
      })) || (await getImageGenerationJobById(jobId));
    if (!current) {
      return NextResponse.json({ error: "Job not found.", code: "IMAGE_JOB_NOT_FOUND" }, { status: 404 });
    }
    if (current.job.userEmail.trim().toLowerCase() !== email) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    cleanupContext.current = current;

    const imageModel = normalizeImageModel(process.env.IMAGE2_PROVIDER_MODEL || "gpt-image-2");
    const billingBlockedStatus = current.job.status === "billing_pending" || current.tasks.some((task) => task.status === "billing_pending")
      ? "pending"
      : current.job.status === "billing_failed" || current.tasks.some((task) => task.status === "billing_failed")
        ? "failed"
        : "";
    if (billingBlockedStatus) {
      return NextResponse.json(
        {
          ok: false,
          processed: false,
          code: billingBlockedStatus === "pending" ? "IMAGE_BILLING_PENDING" : "IMAGE_BILLING_FAILED",
          error: billingBlockedStatus === "pending"
            ? "Image generation billing has not completed. Provider generation was not started."
            : "Image generation billing failed. Provider generation was not started.",
          job: current.job,
          tasks: current.tasks.map((task) => serializeTask(task, imageModel)),
        },
        { status: 409 },
      );
    }

    cleanupContext.imageModel = imageModel;
    const activeTaskStatuses = new Set(["generating", "asset_downloading"]);
    const activeTaskCount = current.tasks.filter((task) => activeTaskStatuses.has(task.status)).length;
    const maxActiveTasks = normalizeStepRunMaxActiveTasks();
    const requestedTask = requestedTaskId
      ? current.tasks.find((task) => task.id === requestedTaskId)
      : null;
    if (requestedTaskId && !requestedTask) {
      return NextResponse.json(
        {
          ok: false,
          processed: false,
          code: "IMAGE_TASK_NOT_FOUND",
          error: "Image generation task was not found.",
          job: current.job,
          tasks: current.tasks.map((task) => serializeTask(task, imageModel)),
        },
        { status: 404 },
      );
    }
    if (requestedTask?.status === "queued" && activeTaskCount >= maxActiveTasks) {
      return NextResponse.json(
        {
          ok: true,
          accepted: false,
          processed: false,
          code: "IMAGE_TASK_ACTIVE_LIMIT",
          status: "processing",
          job: current.job,
          tasks: current.tasks.map((task) => serializeTask(task, imageModel)),
          maxActiveTasks,
        },
        { status: 202 },
      );
    }
    const runnableTask =
      requestedTask ||
      (activeTaskCount < maxActiveTasks ? current.tasks.find((task) => task.status === "queued") : undefined) ||
      current.tasks.find((task) => activeTaskStatuses.has(task.status));
    if (!runnableTask) {
      const finalState = await syncImageGenerationJobFinalStatus(jobId);
      await applyRefundsForFailedImageGenerationTasks({
        job: finalState?.job ?? current.job,
        tasks: finalState?.tasks ?? current.tasks,
        source: "image_task_run",
      });
      return NextResponse.json({
        ok: true,
        job: finalState?.job ?? current.job,
        tasks: (finalState?.tasks ?? current.tasks).map((task) => serializeTask(task, imageModel)),
        processed: false,
      });
    }
    if (isTerminalTaskStatus(runnableTask.status)) {
      return NextResponse.json({
        ok: true,
        job: current.job,
        tasks: current.tasks.map((task) => serializeTask(task, imageModel)),
        processed: false,
      });
    }
    const queuedTask = runnableTask;
    cleanupContext.queuedTask = queuedTask;

    const providerPolicy = parseProviderPolicy(current.job.imageModelPolicy);
    const allowProviderFallback = false;
    const defaultProvider: OrderedImageProvider = "duomi";
    const taskStartedAt = Date.now();
    const taskDeadlineAt = taskStartedAt + normalizeTaskBudgetMs();
    const projectId = current.job.projectId;
    cleanupContext.projectId = projectId;
    const projectTraceId = readProjectTraceId(current.job);
    const duomiConfig = resolveDuomiStepRunConfig();
    const aspectRatio = queuedTask.aspectRatio || current.job.ratio || "9:16";
    const size = resolveTuziImageSize(aspectRatio) || "864x1536";
    const basePrompt = queuedTask.promptText.trim();
    const markTaskFailed = async (input: {
      task: ImageGenerationTaskRow;
      status: "failed" | "timed_out";
      providerUsed?: string | null;
      errorCode: string;
      errorMessage: string;
      source: string;
    }) => {
      await updateImageGenerationTask({
        taskId: input.task.id,
        status: input.status,
        providerUsed: input.providerUsed || input.task.providerUsed || defaultProvider,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
      });
      if (projectId) {
        await updateWorkspaceProjectPageImage({
          userEmail: email,
          projectId,
          outputType: input.task.outputType || current.job.intent || "poster",
          pageIndex: input.task.taskIndex,
          taskId: input.task.id,
          status: input.status,
          errorCode: input.errorCode,
        });
      }
      const finalState = await syncImageGenerationJobFinalStatus(jobId);
      await applyRefundsForFailedImageGenerationTasks({
        job: finalState?.job ?? current.job,
        tasks: finalState?.tasks ?? current.tasks,
        source: input.source,
      });
      const resolvedTasks = finalState?.tasks ?? current.tasks;
      const resolvedJob = finalState?.job ?? current.job;
      await logGenerationOpsEvent({
        action: "generation.tasks.run.failure",
        status: "error",
        source: input.providerUsed || input.task.providerUsed || defaultProvider,
        code: input.errorCode,
        message: input.errorMessage,
        userEmail: email,
        projectId: projectId ?? undefined,
        runId: resolvedJob.runId ?? undefined,
        jobId,
        taskId: input.task.id,
        taskIndex: input.task.taskIndex,
        idempotencyKey: resolvedJob.idempotencyKey ?? undefined,
        jobStatus: resolvedJob.status,
        taskStatus: input.status,
        taskStatusSummary: buildGenerationTaskStatusSummary(resolvedTasks),
        outputType: input.task.outputType,
        aspectRatio: input.task.aspectRatio,
        ratio: resolvedJob.ratio ?? undefined,
        taskCount: resolvedTasks.length,
        providerOrder: providerPolicy.join(","),
        providerUsed: input.providerUsed || input.task.providerUsed || defaultProvider,
        attempts: input.task.attempts,
        durationMs: Date.now() - routeStartedAt,
        errorCode: input.errorCode,
        safeErrorMessage: input.errorMessage,
      });
      return NextResponse.json({
        ok: true,
        job: resolvedJob,
        tasks: resolvedTasks.map((task) => serializeTask(task, imageModel)),
        processed: true,
        error: input.errorMessage,
        code: input.errorCode,
      });
    };
    const persistGeneratedImage = async (input: {
      task: ImageGenerationTaskRow;
      providerUsed: string;
      imageUrl: string;
    }) => {
      await logGenerationOpsEvent({
        action: "generation.asset.persist.start",
        status: "info",
        source: input.providerUsed,
        message: "Persisting generated image asset.",
        userEmail: email,
        projectId: projectId ?? undefined,
        runId: current.job.runId ?? undefined,
        jobId,
        taskId: input.task.id,
        taskIndex: input.task.taskIndex,
        jobStatus: "running",
        taskStatus: "asset_downloading",
        providerUsed: input.providerUsed,
        durationMs: Date.now() - taskStartedAt,
      });
      await updateImageGenerationTask({
        taskId: input.task.id,
        status: "asset_downloading",
        providerUsed: input.providerUsed,
        rawImageUrl: input.imageUrl,
      });
      try {
        const persisted = await persistRemoteImageAsset({
          taskId: input.task.id,
          projectId,
          sourceUrl: input.imageUrl,
          timeoutMs: normalizeAssetDownloadTimeoutMs(),
        });
        const renderUrl = persisted.renderUrl || buildImageRenderUrl(input.task.id, Date.now());
        await updateImageGenerationTask({
          taskId: input.task.id,
          status: "asset_ready",
          providerUsed: input.providerUsed,
          rawImageUrl: input.imageUrl,
          renderUrl,
          assetPath: persisted.assetPath,
          mimeType: persisted.mimeType,
          errorCode: null,
          errorMessage: null,
        });
        if (projectId) {
          await updateWorkspaceProjectPageImage({
            userEmail: email,
            projectId,
            outputType: input.task.outputType || current.job.intent || "poster",
            pageIndex: input.task.taskIndex,
            taskId: input.task.id,
            status: "asset_ready",
            imageUrl: renderUrl,
            rawImageUrl: input.imageUrl,
            assetPath: persisted.assetPath,
            errorCode: null,
          });
        }
        const finalState = await syncImageGenerationJobFinalStatus(jobId);
        const resolvedTasks = finalState?.tasks ?? (await getImageGenerationJobById(jobId))?.tasks ?? current.tasks;
        const resolvedJob = finalState?.job ?? current.job;
        logOpsEvent({
          category: "image",
          action: "image_task_generation_success",
          status: "ok",
          source: input.providerUsed,
          userEmail: email,
          projectId: projectId ?? undefined,
          message: "Image task generated and asset persisted.",
          details: {
            stage: "asset_ready",
            jobId,
            taskId: input.task.id,
            taskIndex: input.task.taskIndex,
            provider: input.providerUsed,
            renderUrlExists: Boolean(renderUrl),
            assetPathExists: Boolean(persisted.assetPath),
            durationMs: Date.now() - taskStartedAt,
          },
        });
        await logGenerationOpsEvent({
          action: "generation.asset.persist.success",
          status: "ok",
          source: input.providerUsed,
          message: "Image asset persisted successfully.",
          userEmail: email,
          projectId: projectId ?? undefined,
          runId: resolvedJob.runId ?? undefined,
          jobId,
          taskId: input.task.id,
          taskIndex: input.task.taskIndex,
          idempotencyKey: resolvedJob.idempotencyKey ?? undefined,
          jobStatus: resolvedJob.status,
          taskStatus: "asset_ready",
          taskStatusSummary: buildGenerationTaskStatusSummary(resolvedTasks),
          outputType: input.task.outputType,
          aspectRatio: input.task.aspectRatio,
          ratio: resolvedJob.ratio ?? undefined,
          taskCount: resolvedTasks.length,
          providerUsed: input.providerUsed,
          durationMs: Date.now() - taskStartedAt,
        });
        await logGenerationOpsEvent({
          action: "generation.tasks.run.success",
          status: "ok",
          source: input.providerUsed,
          message: "Image task completed successfully.",
          userEmail: email,
          projectId: projectId ?? undefined,
          runId: resolvedJob.runId ?? undefined,
          jobId,
          taskId: input.task.id,
          taskIndex: input.task.taskIndex,
          idempotencyKey: resolvedJob.idempotencyKey ?? undefined,
          jobStatus: resolvedJob.status,
          taskStatus: "asset_ready",
          taskStatusSummary: buildGenerationTaskStatusSummary(resolvedTasks),
          outputType: input.task.outputType,
          aspectRatio: input.task.aspectRatio,
          ratio: resolvedJob.ratio ?? undefined,
          taskCount: resolvedTasks.length,
          providerUsed: input.providerUsed,
          durationMs: Date.now() - routeStartedAt,
        });
        return NextResponse.json({
          ok: true,
          job: resolvedJob,
          tasks: resolvedTasks.map((task) => serializeTask(task, imageModel)),
          processed: true,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Image asset persistence failed.";
        const mappedCode = mapAssetPersistError(message);
        return markTaskFailed({
          task: input.task,
          status: isTimeoutCode(mappedCode) ? "timed_out" : "failed",
          providerUsed: input.providerUsed,
          errorCode: mappedCode,
          errorMessage: message,
          source: "image_task_run_asset_persist",
        });
      }
    };
    const runDirectProviderFallback = async (input: {
      task: ImageGenerationTaskRow;
      causeCode: string;
      causeMessage: string;
      source: string;
    }) => {
      const fallbackPolicy = providerPolicy.filter((provider) => provider !== "duomi");
      if (!fallbackPolicy.length) {
        return markTaskFailed({
          task: input.task,
          status: isTimeoutCode(input.causeCode) ? "timed_out" : "failed",
          providerUsed: "duomi",
          errorCode: input.causeCode,
          errorMessage: input.causeMessage,
          source: input.source,
        });
      }
      const isFreeUser = await isFreeUserBySubscriptionSafe({
        email,
        source: "workspace_image_task_run_fallback",
        projectId,
        details: {
          stage: "provider_fallback",
          jobId,
          taskId: input.task.id,
          taskIndex: input.task.taskIndex,
          causeCode: input.causeCode,
        },
      });
      const prompt = isFreeUser ? appendFreeWatermarkInstruction(basePrompt) : basePrompt;
      const fallback = await requestImageByPolicy({
        providerPolicy: fallbackPolicy,
        imageModel,
        prompt,
        aspectRatio,
        size,
        routeStartedAt,
        taskDeadlineAt: Date.now() + normalizeTaskBudgetMs(),
        allowProviderFallback: true,
      });
      if (fallback.result.ok) {
        return persistGeneratedImage({
          task: input.task,
          providerUsed: fallback.providerUsed,
          imageUrl: fallback.result.imageUrl,
        });
      }
      return markTaskFailed({
        task: input.task,
        status: isTimeoutCode(fallback.result.errorCode) || isTimeoutCode(input.causeCode) ? "timed_out" : "failed",
        providerUsed: fallback.providerUsed,
        errorCode: fallback.result.errorCode || input.causeCode,
        errorMessage: fallback.result.errorMessage || input.causeMessage,
        source: input.source,
      });
    };

    if (!basePrompt) {
      return markTaskFailed({
        task: queuedTask,
        status: "failed",
        providerUsed: queuedTask.providerUsed || defaultProvider,
        errorCode: "IMAGE_GENERATION_PROMPT_EMPTY",
        errorMessage: "Image generation prompt is empty.",
        source: "image_task_run_prompt_empty",
      });
    }
    if (!duomiConfig) {
      return runDirectProviderFallback({
        task: queuedTask,
        causeCode: "DUOMI_PROVIDER_NOT_CONFIGURED",
        causeMessage: "Duomi image provider is not configured.",
        source: "image_task_run_provider_config",
      });
    }
    await logGenerationOpsEvent({
      action: "generation.tasks.run.start",
      status: "info",
      source: "image_tasks_run",
      message: "Started processing the next runnable image task.",
      userEmail: email,
      projectId: projectId ?? undefined,
      runId: current.job.runId ?? undefined,
      jobId,
      taskId: queuedTask.id,
      taskIndex: queuedTask.taskIndex,
      idempotencyKey: current.job.idempotencyKey ?? undefined,
      jobStatus: current.job.status,
      taskStatus: queuedTask.status,
      taskStatusSummary: buildGenerationTaskStatusSummary(current.tasks),
      outputType: queuedTask.outputType,
      aspectRatio: queuedTask.aspectRatio,
      ratio: current.job.ratio ?? undefined,
      taskCount: current.tasks.length,
      providerOrder: providerPolicy.join(","),
      attempts: queuedTask.attempts,
      promptText: queuedTask.promptText,
      extraDetails: {
        maxActiveTasks,
        activeTaskCount,
        requestedTaskId: requestedTaskId || null,
      },
    });

    if (queuedTask.status === "generating") {
      const metadata = decodeImageGenerationProviderTaskMetadata(queuedTask.errorMessage);
      if (!metadata || metadata.provider !== "duomi") {
        return markTaskFailed({
          task: queuedTask,
          status: "failed",
          providerUsed: queuedTask.providerUsed || defaultProvider,
          errorCode: "IMAGE_PROVIDER_METADATA_MISSING",
          errorMessage: "Image provider task metadata is missing. Please retry manually.",
          source: "image_task_run_metadata_missing",
        });
      }
      if (metadata.deadlineAt && Date.now() >= metadata.deadlineAt) {
        return runDirectProviderFallback({
          task: queuedTask,
          causeCode: "IMAGE_PROVIDER_DEADLINE_EXCEEDED",
          causeMessage: "Image provider task timed out.",
          source: "image_task_run_provider_deadline",
        });
      }
      await logGenerationOpsEvent({
        action: "generation.provider.poll.start",
        status: "info",
        source: "duomi",
        message: "Polling Duomi image provider task.",
        userEmail: email,
        projectId: projectId ?? undefined,
        runId: current.job.runId ?? undefined,
        jobId,
        taskId: queuedTask.id,
        taskIndex: queuedTask.taskIndex,
        jobStatus: current.job.status,
        taskStatus: queuedTask.status,
        providerUsed: "duomi",
      });
      const pollResult = await pollDuomiImageGenerationTask(duomiConfig, {
        providerTaskId: metadata.providerTaskId,
      });
      if (pollResult.ok && pollResult.status === "processing") {
        await updateImageGenerationTask({
          taskId: queuedTask.id,
          status: "generating",
          providerUsed: "duomi",
          errorCode: null,
          errorMessage: encodeImageGenerationProviderTaskMetadata({
            ...metadata,
            status: pollResult.providerStatus || "processing",
            lastPolledAt: Date.now(),
          }),
        });
        const latestState = await getImageGenerationJobById(jobId);
        await logGenerationOpsEvent({
          action: "generation.provider.poll.processing",
          status: "info",
          source: "duomi",
          message: "Duomi image provider task is still processing.",
          userEmail: email,
          projectId: projectId ?? undefined,
          runId: current.job.runId ?? undefined,
          jobId,
          taskId: queuedTask.id,
          taskIndex: queuedTask.taskIndex,
          jobStatus: latestState?.job.status ?? current.job.status,
          taskStatus: "generating",
          providerUsed: "duomi",
          durationMs: Date.now() - taskStartedAt,
        });
        return NextResponse.json(
          {
            ok: true,
            accepted: true,
            processed: false,
            status: "processing",
            job: latestState?.job ?? current.job,
            tasks: (latestState?.tasks ?? current.tasks).map((task) => serializeTask(task, imageModel)),
            taskId: queuedTask.id,
          },
          { status: 202 },
        );
      }
      if (pollResult.ok && pollResult.status === "succeeded") {
        await logGenerationOpsEvent({
          action: "generation.provider.poll.success",
          status: "ok",
          source: "duomi",
          message: "Duomi image provider returned an image.",
          userEmail: email,
          projectId: projectId ?? undefined,
          runId: current.job.runId ?? undefined,
          jobId,
          taskId: queuedTask.id,
          taskIndex: queuedTask.taskIndex,
          jobStatus: current.job.status,
          taskStatus: "asset_downloading",
          providerUsed: "duomi",
          durationMs: Date.now() - taskStartedAt,
        });
        return persistGeneratedImage({
          task: queuedTask,
          providerUsed: "duomi",
          imageUrl: pollResult.imageUrl,
        });
      }
      return runDirectProviderFallback({
        task: queuedTask,
        causeCode: pollResult.errorCode || "DUOMI_POLL_FAILED",
        causeMessage: pollResult.errorMessage || "Duomi provider polling failed.",
        source: "image_task_run_provider_poll",
      });
    }

    if (queuedTask.status === "asset_downloading") {
      const rawImageUrl = sanitizeImageGenerationRawImageUrl(queuedTask.rawImageUrl);
      if (!rawImageUrl || !/^https?:\/\//i.test(rawImageUrl)) {
        return markTaskFailed({
          task: queuedTask,
          status: "failed",
          providerUsed: queuedTask.providerUsed || defaultProvider,
          errorCode: "IMAGE_ASSET_SOURCE_MISSING",
          errorMessage: "Generated image source is missing. Please retry manually.",
          source: "image_task_run_asset_source_missing",
        });
      }
      return persistGeneratedImage({
        task: queuedTask,
        providerUsed: queuedTask.providerUsed || defaultProvider,
        imageUrl: rawImageUrl,
      });
    }

    const claimedTask = await claimQueuedImageGenerationTask({
      taskId: queuedTask.id,
      providerUsed: defaultProvider,
    });
    if (!claimedTask) {
      const latestState = await getImageGenerationJobById(jobId);
      return NextResponse.json(
        {
          ok: true,
          accepted: false,
          processed: false,
          code: "IMAGE_TASK_ALREADY_CLAIMED",
          status: "processing",
          job: latestState?.job ?? current.job,
          tasks: (latestState?.tasks ?? current.tasks).map((task) => serializeTask(task, imageModel)),
        },
        { status: 202 },
      );
    }

    const isFreeUser = await isFreeUserBySubscriptionSafe({
      email,
      source: "workspace_image_task_run_step_create",
      projectId,
      details: {
        stage: "subscription_gate",
        jobId,
        taskId: queuedTask.id,
        taskIndex: queuedTask.taskIndex,
      },
    });
    const prompt = isFreeUser ? appendFreeWatermarkInstruction(basePrompt) : basePrompt;
    await logGenerationOpsEvent({
      action: "generation.provider.create.start",
      status: "info",
      source: "duomi",
      message: "Creating Duomi async image provider task.",
      userEmail: email,
      projectId: projectId ?? undefined,
      runId: current.job.runId ?? undefined,
      jobId,
      taskId: queuedTask.id,
      taskIndex: queuedTask.taskIndex,
      jobStatus: "running",
      taskStatus: "generating",
      providerUsed: "duomi",
    });
    const createResult = await createDuomiImageGenerationTask(duomiConfig, {
      prompt,
      aspectRatio: normalizeDuomiAspectRatio(aspectRatio),
    });
    if (createResult.ok && createResult.status === "created") {
      await updateImageGenerationTask({
        taskId: queuedTask.id,
        status: "generating",
        providerUsed: "duomi",
        rawImageUrl: null,
        errorCode: null,
        errorMessage: encodeImageGenerationProviderTaskMetadata({
          provider: "duomi",
          providerTaskId: createResult.providerTaskId,
          status: "created",
          startedAt: taskStartedAt,
          lastPolledAt: Date.now(),
          deadlineAt: taskDeadlineAt,
        }),
      });
      if (projectId) {
        await updateWorkspaceProjectPageImage({
          userEmail: email,
          projectId,
          outputType: queuedTask.outputType || current.job.intent || "poster",
          pageIndex: queuedTask.taskIndex,
          taskId: queuedTask.id,
          status: "generating",
          errorCode: null,
        });
      }
      const latestState = await getImageGenerationJobById(jobId);
      await logGenerationOpsEvent({
        action: "generation.provider.create.success",
        status: "ok",
        source: "duomi",
        message: "Duomi async image provider task was created.",
        userEmail: email,
        projectId: projectId ?? undefined,
        runId: current.job.runId ?? undefined,
        jobId,
        taskId: queuedTask.id,
        taskIndex: queuedTask.taskIndex,
        jobStatus: latestState?.job.status ?? "running",
        taskStatus: "generating",
        providerUsed: "duomi",
        durationMs: Date.now() - taskStartedAt,
      });
      return NextResponse.json(
        {
          ok: true,
          accepted: true,
          processed: false,
          status: "processing",
          job: latestState?.job ?? current.job,
          tasks: (latestState?.tasks ?? current.tasks).map((task) => serializeTask(task, imageModel)),
          taskId: claimedTask.id,
        },
        { status: 202 },
      );
    }
    if (createResult.ok && createResult.status === "succeeded") {
      await logGenerationOpsEvent({
        action: "generation.provider.create.success",
        status: "ok",
        source: "duomi",
        message: "Duomi async create returned an image immediately.",
        userEmail: email,
        projectId: projectId ?? undefined,
        runId: current.job.runId ?? undefined,
        jobId,
        taskId: queuedTask.id,
        taskIndex: queuedTask.taskIndex,
        jobStatus: "running",
        taskStatus: "asset_downloading",
        providerUsed: "duomi",
        durationMs: Date.now() - taskStartedAt,
      });
      return persistGeneratedImage({
        task: queuedTask,
        providerUsed: "duomi",
        imageUrl: createResult.imageUrl,
      });
    }
    return runDirectProviderFallback({
      task: queuedTask,
      causeCode: createResult.errorCode || "DUOMI_CREATE_FAILED",
      causeMessage: createResult.errorMessage || "Duomi provider task creation failed.",
      source: "image_task_run_provider_create",
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Image task runner failed.";
    const code = isTimeoutCode(message) ? "IMAGE_TASK_TIMEOUT" : "IMAGE_TASK_RUN_FAILED";
    logOpsEvent({
      category: "image",
      action: "image_task_run_failed",
      status: "error",
      source: "unknown",
      code,
      message,
      details: {
        stage: "image_task_run_preclaim",
        errorStack: error instanceof Error ? error.stack : null,
        durationMs: Date.now() - routeStartedAt,
      },
    });
    return NextResponse.json({ error: message, code }, { status: 500 });
  }
}
