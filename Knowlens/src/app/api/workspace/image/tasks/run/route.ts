import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import {
  buildImage2ProviderConfig,
  requestImage2Generation,
  type Image2ProviderFailure,
} from "@/lib/server/image2";
import {
  applyRefundsForFailedImageGenerationTasks,
  buildImageRenderUrl,
  expireAbandonedImageGenerationJob,
  getImageGenerationJobById,
  persistRemoteImageAsset,
  syncImageGenerationJobFinalStatus,
  updateImageGenerationJobStatus,
  updateImageGenerationTask,
  type ImageGenerationTaskRow,
} from "@/lib/server/image-generation-jobs";
import {
  isFreeUserBySubscriptionSafe,
  logOpsEvent,
} from "@/lib/server/store";
import { updateWorkspaceProjectPageImage } from "@/lib/server/workspace-project-pages";
import {
  parseTuziImageUrl,
  resolveTuziImageSize,
} from "@/lib/workspace/tuzi-image";

export const runtime = "nodejs";
export const maxDuration = 300;

type OrderedImageProvider = "tuzi" | "duomi" | "gptsapi";

const DEFAULT_PROVIDER_POLICY: OrderedImageProvider[] = ["tuzi", "duomi", "gptsapi"];
const PROVIDER_CALL_TIMEOUT_MS = Number.parseInt(process.env.IMAGE2_PROVIDER_CALL_TIMEOUT_MS || "220000", 10);
const FALLBACK_PROVIDER_CALL_TIMEOUT_MS = Number.parseInt(process.env.IMAGE2_PROVIDER_FALLBACK_CALL_TIMEOUT_MS || "60000", 10);
const ROUTE_EXECUTION_BUDGET_MS = Number.parseInt(process.env.IMAGE2_ROUTE_EXECUTION_BUDGET_MS || "260000", 10);
const TASK_EXECUTION_BUDGET_MS = Number.parseInt(process.env.IMAGE2_TASK_EXECUTION_BUDGET_MS || "240000", 10);
const ASSET_DOWNLOAD_TIMEOUT_MS = Number.parseInt(process.env.IMAGE2_ASSET_DOWNLOAD_TIMEOUT_MS || "45000", 10);

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

function normalizeAssetDownloadTimeoutMs() {
  if (!Number.isFinite(ASSET_DOWNLOAD_TIMEOUT_MS)) {
    return 45_000;
  }
  return Math.max(15_000, Math.min(60_000, ASSET_DOWNLOAD_TIMEOUT_MS));
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
    rawImageUrl: task.rawImageUrl,
    storageKey: resolveTaskStorageKey(task),
    provider: task.providerUsed,
    model: imageModel,
    error: task.errorMessage,
    errorCode: task.errorCode,
    width: task.width,
    height: task.height,
    mimeType: task.mimeType,
  };
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

    const body = (await request.json().catch(() => null)) as { jobId?: string } | null;
    const jobId = normalizeJobId(body?.jobId);
    if (!jobId) {
      return NextResponse.json({ error: "jobId is required.", code: "IMAGE_JOB_ID_REQUIRED" }, { status: 400 });
    }
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
    const queuedTask = current.tasks.find((task) => task.status === "queued");
    if (!queuedTask) {
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
    cleanupContext.queuedTask = queuedTask;

    const providerPolicy = parseProviderPolicy(current.job.imageModelPolicy);
    const allowProviderFallback = parseBooleanEnv("IMAGE2_PROVIDER_FALLBACK_ENABLED", false) && providerPolicy.length > 1;
    const defaultProvider = providerPolicy[0] ?? "tuzi";
    const taskStartedAt = Date.now();
    const taskDeadlineAt = taskStartedAt + normalizeTaskBudgetMs();
    const projectId = current.job.projectId;
    cleanupContext.projectId = projectId;
    const projectTraceId = readProjectTraceId(current.job);

    await updateImageGenerationJobStatus({
      jobId,
      status: "running",
    });
    await updateImageGenerationTask({
      taskId: queuedTask.id,
      status: "generating",
      attempts: queuedTask.attempts + 1,
      providerUsed: defaultProvider,
    });

    logImageTaskRunEvent({
      requestId: current.job.idempotencyKey || current.job.runId || jobId,
      jobId,
      projectId,
      userEmail: email,
      taskCount: current.tasks.length,
      currentStep: "provider-generation-start",
      provider: defaultProvider,
      model: imageModel,
      durationMs: Date.now() - routeStartedAt,
      generatedCount: 0,
      failedCount: 0,
      taskId: queuedTask.id,
      taskIndex: queuedTask.taskIndex,
    });

    const basePrompt = queuedTask.promptText.trim();
    const isFreeUser = await isFreeUserBySubscriptionSafe({
      email,
      source: "workspace_image_task_run",
      projectId,
      details: {
        stage: "subscription_gate",
        jobId,
        taskId: queuedTask.id,
        taskIndex: queuedTask.taskIndex,
      },
    });
    const prompt = isFreeUser ? appendFreeWatermarkInstruction(basePrompt) : basePrompt;
    const aspectRatio = queuedTask.aspectRatio || current.job.ratio || "9:16";
    const size = resolveTuziImageSize(aspectRatio) || "864x1536";
    const generatedByPolicy = await requestImageByPolicy({
      providerPolicy,
      imageModel,
      prompt,
      aspectRatio,
      size,
      routeStartedAt,
      taskDeadlineAt,
      allowProviderFallback,
    });
    const generated = generatedByPolicy.result;
    const providerUsed = generatedByPolicy.providerUsed || defaultProvider;
    cleanupContext.providerUsed = providerUsed;

    if (!generated.ok) {
      const failedStatus = isTimeoutCode(generated.errorCode) ? "timed_out" : "failed";
      await updateImageGenerationTask({
        taskId: queuedTask.id,
        status: failedStatus,
        providerUsed,
        errorCode: generated.errorCode || "IMAGE_PROVIDER_FAILED",
        errorMessage: generated.errorMessage || "Image generation failed.",
      });
      if (projectId) {
        await updateWorkspaceProjectPageImage({
          userEmail: email,
          projectId,
          outputType: queuedTask.outputType || current.job.intent || "poster",
          pageIndex: queuedTask.taskIndex,
          taskId: queuedTask.id,
          status: failedStatus,
          errorCode: generated.errorCode || "IMAGE_PROVIDER_FAILED",
        });
      }
      logOpsEvent({
        category: "image",
        action: "image_task_generation_failed",
        status: "error",
        source: providerUsed,
        userEmail: email,
        projectId: projectId ?? undefined,
        code: generated.errorCode || "IMAGE_PROVIDER_FAILED",
        message: generated.errorMessage || "Image generation failed.",
        details: {
          stage: "provider_generation",
          projectTraceId,
          jobId,
          taskId: queuedTask.id,
          taskIndex: queuedTask.taskIndex,
          ratio: aspectRatio,
          providerPolicy,
          attemptedProviders: generatedByPolicy.attemptedProviders,
          skippedProviders: generatedByPolicy.skippedProviders,
          providerFallbackDisabled: generatedByPolicy.providerFallbackDisabled,
          providerAttempts: generatedByPolicy.attempts,
        },
      });
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
        processed: true,
        error: generated.errorMessage || "Image generation failed.",
        code: generated.errorCode || "IMAGE_PROVIDER_FAILED",
      });
    }

    await updateImageGenerationTask({
      taskId: queuedTask.id,
      status: "asset_downloading",
      providerUsed,
      rawImageUrl: generated.imageUrl,
    });

    const remainingRouteBudget = normalizeRouteBudgetMs() - (Date.now() - routeStartedAt);
    const remainingTaskBudget = taskDeadlineAt - Date.now();
    const assetDownloadTimeoutMs = Math.min(
      normalizeAssetDownloadTimeoutMs(),
      Math.max(15_000, remainingRouteBudget - 4_000),
      Math.max(10_000, remainingTaskBudget - 4_000),
    );
    if (remainingTaskBudget < 10_000) {
      throw new Error("IMAGE_TASK_TIMEOUT: no task budget left before asset persistence.");
    }

    let persisted: Awaited<ReturnType<typeof persistRemoteImageAsset>>;
    try {
      persisted = await persistRemoteImageAsset({
        taskId: queuedTask.id,
        projectId,
        sourceUrl: generated.imageUrl,
        timeoutMs: assetDownloadTimeoutMs,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Image asset persistence failed.";
      const mappedCode = (() => {
        if (/IMAGE_STORAGE_NOT_CONFIGURED/i.test(message)) return "IMAGE_STORAGE_NOT_CONFIGURED";
        if (/IMAGE_DOWNLOAD_INVALID_CONTENT_TYPE/i.test(message)) return "IMAGE_DOWNLOAD_INVALID_CONTENT_TYPE";
        if (/IMAGE_UPLOAD_FAILED/i.test(message)) return "IMAGE_UPLOAD_FAILED";
        if (/IMAGE_DOWNLOAD_FAILED/i.test(message)) return "IMAGE_DOWNLOAD_FAILED";
        if (/IMAGE_TASK_TIMEOUT/i.test(message)) return "IMAGE_TASK_TIMEOUT";
        return "IMAGE_ASSET_PERSIST_FAILED";
      })();
      const failedStatus = isTimeoutCode(mappedCode) ? "timed_out" : "failed";
      await updateImageGenerationTask({
        taskId: queuedTask.id,
        status: failedStatus,
        providerUsed,
        rawImageUrl: generated.imageUrl,
        errorCode: mappedCode,
        errorMessage: message,
      });
      if (projectId) {
        await updateWorkspaceProjectPageImage({
          userEmail: email,
          projectId,
          outputType: queuedTask.outputType || current.job.intent || "poster",
          pageIndex: queuedTask.taskIndex,
          taskId: queuedTask.id,
          status: failedStatus,
          rawImageUrl: generated.imageUrl,
          errorCode: mappedCode,
        });
      }
      logOpsEvent({
        category: "image",
        action: "image_task_generation_failed",
        status: "error",
        source: providerUsed,
        userEmail: email,
        projectId: projectId ?? undefined,
        code: mappedCode,
        message,
        details: {
          stage: "asset_download",
          projectTraceId,
          jobId,
          taskId: queuedTask.id,
          taskIndex: queuedTask.taskIndex,
          rawImageUrl: generated.imageUrl,
          providerPolicy,
          attemptedProviders: generatedByPolicy.attemptedProviders,
          skippedProviders: generatedByPolicy.skippedProviders,
          providerFallbackDisabled: generatedByPolicy.providerFallbackDisabled,
          providerAttempts: generatedByPolicy.attempts,
        },
      });
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
        processed: true,
        error: message,
        code: mappedCode,
      });
    }
    const renderUrl = persisted.renderUrl || buildImageRenderUrl(queuedTask.id, Date.now());
    await updateImageGenerationTask({
      taskId: queuedTask.id,
      status: "asset_ready",
      providerUsed,
      rawImageUrl: generated.imageUrl,
      renderUrl,
      assetPath: persisted.assetPath,
      mimeType: persisted.mimeType,
    });
    if (projectId) {
      await updateWorkspaceProjectPageImage({
        userEmail: email,
        projectId,
        outputType: queuedTask.outputType || current.job.intent || "poster",
        pageIndex: queuedTask.taskIndex,
        taskId: queuedTask.id,
        status: "asset_ready",
        imageUrl: renderUrl,
        rawImageUrl: generated.imageUrl,
        assetPath: persisted.assetPath,
        errorCode: null,
      });
    }

    logImageTaskRunEvent({
      requestId: current.job.idempotencyKey || current.job.runId || jobId,
      jobId,
      projectId,
      userEmail: email,
      taskCount: current.tasks.length,
      currentStep: "asset-ready",
      provider: providerUsed,
      model: imageModel,
      durationMs: Date.now() - taskStartedAt,
      generatedCount: 1,
      failedCount: 0,
      taskId: queuedTask.id,
      taskIndex: queuedTask.taskIndex,
    });
    logOpsEvent({
      category: "image",
      action: "image_task_generation_success",
      status: "ok",
      source: providerUsed,
      userEmail: email,
      projectId: projectId ?? undefined,
      message: "Image task generated and asset persisted.",
      details: {
        stage: "asset_ready",
        projectTraceId,
        jobId,
        taskId: queuedTask.id,
        taskIndex: queuedTask.taskIndex,
        imageUrl: renderUrl,
        rawImageUrl: generated.imageUrl,
        bytes: persisted.byteLength,
        storageKey: persisted.storageKey || persisted.assetPath,
        providerPolicy,
        attemptedProviders: generatedByPolicy.attemptedProviders,
        skippedProviders: generatedByPolicy.skippedProviders,
        providerFallbackDisabled: generatedByPolicy.providerFallbackDisabled,
        providerAttempts: generatedByPolicy.attempts,
      },
    });

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
      processed: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image task run failed.";
    const code = isTimeoutCode(message) ? "IMAGE_TASK_TIMEOUT" : "IMAGE_TASK_RUN_FAILED";
    const failedStatus = isTimeoutCode(code) ? "timed_out" : "failed";
    const { email, jobId, queuedTask, current, imageModel, providerUsed, projectId } = cleanupContext;
    if (email && jobId && queuedTask && current) {
      await updateImageGenerationTask({
        taskId: queuedTask.id,
        status: failedStatus,
        providerUsed: providerUsed || queuedTask.providerUsed,
        errorCode: code,
        errorMessage: message,
      }).catch(() => undefined);
      if (projectId) {
        await updateWorkspaceProjectPageImage({
          userEmail: email,
          projectId,
          outputType: queuedTask.outputType || current.job.intent || "poster",
          pageIndex: queuedTask.taskIndex,
          taskId: queuedTask.id,
          status: failedStatus,
          errorCode: code,
        }).catch(() => undefined);
      }
      const finalState = await syncImageGenerationJobFinalStatus(jobId).catch(() => null);
      await applyRefundsForFailedImageGenerationTasks({
        job: finalState?.job ?? current.job,
        tasks: finalState?.tasks ?? current.tasks,
        source: "image_task_run_internal_failure",
      }).catch(() => undefined);
      logOpsEvent({
        category: "image",
        action: "image_task_internal_failure_marked",
        status: "error",
        source: providerUsed || "unknown",
        userEmail: email,
        projectId: projectId ?? undefined,
        code,
        message,
        details: {
          stage: "image_task_run_internal_cleanup",
          jobId,
          taskId: queuedTask.id,
          taskIndex: queuedTask.taskIndex,
          durationMs: Date.now() - routeStartedAt,
        },
      });
      return NextResponse.json({
        ok: true,
        job: finalState?.job ?? current.job,
        tasks: (finalState?.tasks ?? current.tasks).map((task) => serializeTask(task, imageModel || normalizeImageModel())),
        processed: true,
        error: message,
        code,
      });
    }
    logOpsEvent({
      category: "image",
      action: "image_task_run_failed",
      status: "error",
      source: "unknown",
      code,
      message,
      details: {
        stage: "image_task_run_internal",
        errorStack: error instanceof Error ? error.stack : null,
        durationMs: Date.now() - routeStartedAt,
      },
    });
    return NextResponse.json({ error: message, code }, { status: 500 });
  }
}
