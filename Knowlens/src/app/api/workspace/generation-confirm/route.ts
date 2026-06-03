import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import { incrementUsageCounter } from "@/lib/server/guard";
import { getLatestSubscriptionDb, logOpsEvent } from "@/lib/server/store";
import {
  buildImageRenderUrl,
  createImageGenerationJob,
  findImageGenerationJobByIdempotency,
  getImageGenerationJobById,
  persistRemoteImageAsset,
  syncImageGenerationJobFinalStatus,
  updateImageGenerationJobStatus,
  updateImageGenerationTask,
} from "@/lib/server/image-generation-jobs";
import { buildImage2ProviderConfig, requestImage2Generation, resolveImage2Size } from "@/lib/server/image2";

export const runtime = "nodejs";

type GenerationConfirmPayload = {
  intent?: string;
  normalizedDirection?: "poster" | "ppt" | "video";
  normalizedCount?: number;
  normalizedRatio?: string;
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
      mapRegion?: string;
      chartType?: string;
      workflowType?: string;
    };
    factualRules?: string[];
    negativeRules?: string[];
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

const MAX_FINAL_IMAGE_PROMPT_CHARS = 2000;

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
    return clampPromptForImage(task.composedPrompt.trim());
  }
  const labels = Array.isArray(task.visibleText?.labels) ? task.visibleText.labels.join(" | ") : "";
  const factualRules = Array.isArray(task.factualRules) ? task.factualRules.join(" | ") : "";
  const protectedFacts = [
    task.contentTitle,
    task.contentBody,
    labels,
    factualRules,
  ]
    .join(" ")
    .split(/(?<=[。！？.!?])\s+|[；;]/)
    .filter((item) =>
      /(\d|%|％|\$|美元|人民币|亿元|亿|万|q[1-4]|20\d{2}|19\d{2}|营收|收入|净利润|eps|每股收益|同比|环比|增长|下降|亏损|google|alphabet|nvidia|英伟达|cloud|广告)/i.test(item),
    )
    .slice(0, 6)
    .join(" | ");
  return clampPromptForImage([
    task.stylePrompt ? `Style prompt: ${task.stylePrompt}` : "",
    task.outputType ? `Output type: ${task.outputType}` : "",
    task.aspectRatio ? `Aspect ratio: ${task.aspectRatio}` : "",
    task.contentTitle ? `Title: ${task.contentTitle}` : "",
    task.contentBody ? `Current page content to translate visually:\n${task.contentBody}` : "",
    protectedFacts ? `Protected facts that must remain accurate: ${protectedFacts}` : "",
    labels ? `Short label ideas for this page only: ${labels}` : "",
    task.visualDesign?.layout ? `Layout: ${task.visualDesign.layout}` : "",
    task.visualDesign?.mainVisual ? `Main visual: ${task.visualDesign.mainVisual}` : "",
    task.visualDesign?.composition ? `Composition: ${task.visualDesign.composition}` : "",
    task.visualDesign?.textDensity ? `Text density: ${task.visualDesign.textDensity}` : "",
    task.imagePromptDraft ? `Draft visual hint: ${task.imagePromptDraft}` : "",
    factualRules ? `Factual rules: ${factualRules}` : "",
    Array.isArray(task.negativeRules) && task.negativeRules.length ? `Negative rules: ${task.negativeRules.join(" | ")}` : "",
    task.visualHint ? `Visual hint: ${task.visualHint}` : "",
  ]
    .filter(Boolean)
    .join("\n"));
}

function clampPromptForImage(prompt: string) {
  return prompt
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_FINAL_IMAGE_PROMPT_CHARS)
    .trim();
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

function getImageGenerationMockUrl() {
  if (process.env.IMAGE_GENERATION_MOCK !== "true") {
    return "";
  }
  return (process.env.IMAGE_GENERATION_MOCK_URL || "https://picsum.photos/1024/1024").trim();
}

export async function POST(request: NextRequest) {
  try {
    if (!ensureSafeOrigin(request)) {
      return NextResponse.json({ error: "Forbidden request origin." }, { status: 403 });
    }
    const session = await getServerSession(nextAuthOptions);
    const allowDevLocalAuthBypass =
      process.env.NODE_ENV !== "production" &&
      process.env.NEXTAUTH_ALLOW_DEV_LOGIN === "true" &&
      isLocalNetworkRequest(request);
    const email = session?.user?.email?.trim().toLowerCase() || (allowDevLocalAuthBypass ? "local-dev@knowlens.ai" : "");
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
    const mockImageUrl = getImageGenerationMockUrl();

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

    const count = await incrementUsageCounter({
      scopeKey,
      metricKey: "workspace:generation_confirmed",
    });
    if (mockImageUrl && wantsImageProvider) {
      const taskResults = (payload.tasks ?? []).map((task, idx) => ({
        index: extractTaskIndexFromPayload(task, idx + 1),
        ok: true,
        imageUrl: mockImageUrl,
        rawImageUrl: mockImageUrl,
      }));
      logOpsEvent({
        category: "image",
        action: "image_generation_mocked",
        status: "ok",
        source: imageModel,
        userEmail: email,
        projectId: projectId ?? undefined,
        message: "IMAGE_GENERATION_MOCK=true; skipped real image provider call.",
        details: {
          projectTraceId,
          intent: payload.intent ?? "unknown",
          outputs: requestedOutputs,
          ratio: payload.ratio ?? "",
          taskCount,
          mockImageUrl,
        },
      });
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
          providerCalled: false,
          mocked: true,
          results: taskResults,
        },
      });
    }
    const isFreeUser = await isFreeUserBySubscription(email);
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
