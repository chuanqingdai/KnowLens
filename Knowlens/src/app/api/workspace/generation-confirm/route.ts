import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import { incrementUsageCounter } from "@/lib/server/guard";
import { getLatestSubscriptionDb, logOpsEvent } from "@/lib/server/store";
import { buildImage2ProviderConfig, requestImage2Generation, resolveImage2Size } from "@/lib/server/image2";

export const runtime = "nodejs";

type GenerationConfirmPayload = {
  intent?: string;
  projectId?: string;
  projectTraceId?: string;
  outputs?: number;
  ratio?: string;
  imageModel?: string;
  style?: {
    id?: string;
    name?: string;
    prompt?: string;
  };
  tasks?: Array<{
    index?: number;
    outputType?: string;
    aspectRatio?: string;
    stylePrompt?: string;
    contentTitle?: string;
    contentBody?: string;
    visualHint?: string;
    composedPrompt?: string;
  }>;
};

type ImageGenerationTask = NonNullable<GenerationConfirmPayload["tasks"]>[number];

type GenerationTaskResult = {
  index: number;
  ok: boolean;
  imageUrl?: string;
  error?: string;
  errorCode?: string;
  rawImageUrl?: string;
};

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

function isLocalNetworkRequest(req: NextRequest) {
  const host = (req.headers.get("host") || req.nextUrl.host || "").toLowerCase();
  const hostname = host.split(":")[0];
  if (!hostname) {
    return false;
  }
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return true;
  }
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }
  return false;
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

function buildPromptFromTask(task: ImageGenerationTask) {
  if (typeof task.composedPrompt === "string" && task.composedPrompt.trim()) {
    return task.composedPrompt.trim();
  }
  return [
    task.stylePrompt ? `Style prompt: ${task.stylePrompt}` : "",
    task.outputType ? `Output type: ${task.outputType}` : "",
    task.aspectRatio ? `Aspect ratio: ${task.aspectRatio}` : "",
    task.contentTitle ? `Title: ${task.contentTitle}` : "",
    task.contentBody ? `Content:\n${task.contentBody}` : "",
    task.visualHint ? `Visual hint: ${task.visualHint}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function isFreeUserBySubscription(email: string) {
  const row = getLatestSubscriptionDb(email) as { status?: string } | null;
  if (!row) {
    return true;
  }
  const status = (row.status || "").trim().toLowerCase();
  return !(status === "active" || status === "canceling");
}

function appendFreeWatermarkInstruction(prompt: string) {
  const watermarkLine = 'Add a visible English watermark at the top: "Generated with KnowLens.ai".';
  return `${prompt}\n\n[Internal rendering constraint]\n${watermarkLine}`;
}

function extractTaskIndexFromPayload(task: ImageGenerationTask, fallbackIndex: number) {
  if (Number.isFinite(task.index)) {
    return Number(task.index);
  }
  return fallbackIndex;
}

function resolveImageFailureStage(code?: string) {
  const normalized = (code || "").trim().toUpperCase();
  if (normalized.startsWith("DUOMI_")) {
    return "image_fallback_duomi";
  }
  if (normalized.startsWith("GPTSAPI_")) {
    return "image_fallback_gptsapi";
  }
  if (normalized.startsWith("IMAGE2_")) {
    return "image_primary_tuzi";
  }
  return "image_pipeline";
}

function normalizeProjectId(value?: string) {
  return (value || "").trim().slice(0, 120) || null;
}

function normalizeProjectTraceId(value?: string) {
  return (value || "").trim().slice(0, 200) || null;
}

export async function POST(request: NextRequest) {
  try {
    if (!ensureSafeOrigin(request)) {
      return NextResponse.json({ error: "Forbidden request origin." }, { status: 403 });
    }
    const session = await getServerSession(nextAuthOptions);
    const localBypassAllowed =
      process.env.NODE_ENV !== "production" &&
      isLocalNetworkRequest(request) &&
      (process.env.NEXT_PUBLIC_ALLOW_DEV_LOGIN === "true" || process.env.NEXT_PUBLIC_ALLOW_DEV_LOGIN == null);
    const email = session?.user?.email?.trim().toLowerCase() || (localBypassAllowed ? "local-dev@knowlens.ai" : "");
    if (!email) {
      logOpsEvent({
        category: "image",
        action: "image_generation_failed",
        status: "error",
        source: "unknown",
        code: "IMAGE_AUTH_REQUIRED",
        message: "Image generation confirm requested without sign-in session.",
      });
      return NextResponse.json({ error: "Please sign in before confirming generation." }, { status: 401 });
    }
    let payload: GenerationConfirmPayload | null = null;
    try {
      payload = (await request.json()) as GenerationConfirmPayload;
    } catch {
      payload = null;
    }
    if (!payload) {
      logOpsEvent({
        category: "image",
        action: "image_generation_failed",
        status: "error",
        source: "unknown",
        userEmail: email,
        code: "IMAGE_INVALID_PAYLOAD",
        message: "Invalid generation payload.",
      });
      return NextResponse.json({ error: "Invalid generation payload." }, { status: 400 });
    }

    const scopeKey = getScopeFromRequest(request, email);
    const taskCount = Array.isArray(payload.tasks) ? payload.tasks.length : 0;
    const requestedOutputs =
      Number.isFinite(payload.outputs) && Number(payload.outputs) > 0
        ? Math.round(Number(payload.outputs))
        : 0;
    const projectId = normalizeProjectId(payload.projectId);
    const projectTraceId = normalizeProjectTraceId(payload.projectTraceId);
    const imageModel = normalizeImageModel(payload.imageModel);
    const wantsImageProvider = taskCount > 0;

    if (wantsImageProvider && requestedOutputs > 0 && taskCount === 0) {
      logOpsEvent({
        category: "image",
        action: "image_generation_failed",
        status: "error",
        source: imageModel,
        userEmail: email,
        projectId: projectId ?? undefined,
        code: "GENERATION_TASKS_REQUIRED",
        message: "Generation tasks are required before confirming image generation.",
        details: {
          stage: "image_pipeline",
          projectTraceId,
        },
      });
      return NextResponse.json(
        {
          error: "Generation tasks are required before confirming image generation.",
          code: "GENERATION_TASKS_REQUIRED",
        },
        { status: 400 },
      );
    }

    const count = incrementUsageCounter({
      scopeKey,
      metricKey: "workspace:generation_confirmed",
    });
    const isFreeUser = isFreeUserBySubscription(email);
    const image2ProviderConfig = buildImage2ProviderConfig();

    const shouldCallImageProvider = taskCount > 0 && wantsImageProvider;
    const taskResults: GenerationTaskResult[] = [];
    if (shouldCallImageProvider) {
      if (!image2ProviderConfig) {
        logOpsEvent({
          category: "image",
          action: "image_generation_failed",
          status: "error",
          source: imageModel,
          userEmail: email,
          projectId: projectId ?? undefined,
          code: "IMAGE_PROVIDER_KEY_MISSING",
          message: "Missing IMAGE2 provider API key.",
          details: {
            stage: "image_pipeline",
            projectTraceId,
          },
        });
        return NextResponse.json({ error: "Missing IMAGE2 provider API key." }, { status: 500 });
      }
      const tasks = payload?.tasks ?? [];
      for (const task of tasks) {
        const index = Number.isFinite(task.index) ? Number(task.index) : taskResults.length + 1;
        const prompt = buildPromptFromTask(task);
        if (!prompt) {
          taskResults.push({
            index,
            ok: false,
            error: "Empty generation prompt.",
          });
          logOpsEvent({
            category: "image",
            action: "image_generation_failed",
            status: "error",
            source: imageModel,
            userEmail: email,
            projectId: projectId ?? undefined,
            code: "EMPTY_GENERATION_PROMPT",
            message: `Empty generation prompt for task ${index}.`,
            details: {
              stage: "image_prompt_composition",
              projectTraceId,
              taskIndex: index,
            },
          });
          continue;
        }

        const generated = await requestImage2Generation(image2ProviderConfig, {
          size: resolveImage2Size(task.aspectRatio || payload?.ratio),
          aspectRatio: task.aspectRatio || payload?.ratio,
          prompt: isFreeUser ? appendFreeWatermarkInstruction(prompt) : prompt,
        });
        if (generated.ok) {
          taskResults.push({
            index: extractTaskIndexFromPayload(task, index),
            ok: true,
            imageUrl: generated.imageUrl,
            rawImageUrl: generated.imageUrl,
          });
        } else {
          taskResults.push({
            index: extractTaskIndexFromPayload(task, index),
            ok: false,
            error: generated.errorMessage,
            errorCode: generated.errorCode,
          });
          logOpsEvent({
            category: "image",
            action: "image_generation_failed",
            status: "error",
            source: imageModel,
            userEmail: email,
            projectId: projectId ?? undefined,
            code: generated.errorCode || "IMAGE_PROVIDER_FAILED",
            message: generated.errorMessage || "Image generation failed.",
            details: {
              stage: resolveImageFailureStage(generated.errorCode),
              projectTraceId,
              intent: payload.intent ?? "unknown",
              taskIndex: index,
              ratio: task.aspectRatio || payload?.ratio || null,
              outputType: task.outputType || null,
              providerDetail: generated.detail || null,
              providerStatus: generated.status ?? null,
            },
          });
        }
      }
      const successCount = taskResults.filter((item) => item.ok).length;
      if (successCount > 0) {
        logOpsEvent({
          category: "image",
          action: "image_generation_success",
          status: "ok",
          source: imageModel,
          userEmail: email,
          projectId: projectId ?? undefined,
          message: `${successCount}/${taskResults.length} tasks succeeded`,
          details: {
            projectTraceId,
            intent: payload.intent ?? "unknown",
            outputs: requestedOutputs,
            ratio: payload.ratio ?? "",
          },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      count,
      accepted: {
        intent: payload.intent ?? "unknown",
        outputs: requestedOutputs,
        ratio: payload.ratio ?? "",
        imageModel,
        styleId: payload.style?.id ?? "",
        styleName: payload.style?.name ?? "",
        taskCount,
      },
      generation: {
        providerCalled: shouldCallImageProvider,
        results: taskResults,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation confirm failed.";
    logOpsEvent({
      category: "image",
      action: "image_generation_failed",
      status: "error",
      source: "unknown",
      code: "IMAGE_CONFIRM_INTERNAL",
      message,
      details: {
        stage: "image_confirm_internal",
      },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
