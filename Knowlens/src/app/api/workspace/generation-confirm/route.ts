import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import { incrementUsageCounter } from "@/lib/server/guard";
import { getLatestSubscriptionDb } from "@/lib/server/store";
import { buildImage2ProviderConfig, requestImage2Generation, resolveImage2Size } from "@/lib/server/image2";

export const runtime = "nodejs";

type GenerationConfirmPayload = {
  intent?: string;
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

export async function POST(request: NextRequest) {
  try {
    if (!ensureSafeOrigin(request)) {
      return NextResponse.json({ error: "Forbidden request origin." }, { status: 403 });
    }
    const session = await getServerSession(nextAuthOptions);
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Please sign in before confirming generation." }, { status: 401 });
    }
    let payload: GenerationConfirmPayload | null = null;
    try {
      payload = (await request.json()) as GenerationConfirmPayload;
    } catch {
      payload = null;
    }
    const scopeKey = getScopeFromRequest(request, email);
    const count = incrementUsageCounter({
      scopeKey,
      metricKey: "workspace:generation_confirmed",
    });
    const taskCount = Array.isArray(payload?.tasks) ? payload.tasks.length : 0;
    const imageModel = normalizeImageModel(payload?.imageModel);
    const isFreeUser = isFreeUserBySubscription(email);
    const image2ProviderConfig = buildImage2ProviderConfig();

    const shouldCallImageProvider = taskCount > 0 && /gpt-image-?2/i.test(imageModel);
    const taskResults: GenerationTaskResult[] = [];
    if (shouldCallImageProvider) {
      if (!image2ProviderConfig) {
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
          continue;
        }

        const generated = await requestImage2Generation(image2ProviderConfig, {
          size: resolveImage2Size(task.aspectRatio || payload?.ratio),
          prompt: isFreeUser ? appendFreeWatermarkInstruction(prompt) : prompt,
        });
        if (generated.ok) {
          taskResults.push({
            index,
            ok: true,
            imageUrl: generated.imageUrl,
          });
        } else {
          taskResults.push({
            index,
            ok: false,
            error: generated.errorMessage,
            errorCode: generated.errorCode,
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      count,
      accepted: {
        intent: payload?.intent ?? "unknown",
        outputs: Number.isFinite(payload?.outputs) ? payload?.outputs : 0,
        ratio: payload?.ratio ?? "",
        imageModel,
        styleId: payload?.style?.id ?? "",
        styleName: payload?.style?.name ?? "",
        taskCount,
      },
      generation: {
        providerCalled: shouldCallImageProvider,
        results: taskResults,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation confirm failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
