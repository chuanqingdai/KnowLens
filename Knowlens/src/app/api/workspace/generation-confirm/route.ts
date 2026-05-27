import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import { incrementUsageCounter } from "@/lib/server/guard";
import { getLatestSubscriptionDb } from "@/lib/server/store";

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

type ImageProviderResponse = {
  data?: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
  image?: string[] | string;
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

type GenerationTaskResult = {
  index: number;
  ok: boolean;
  imageUrl?: string;
  error?: string;
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

const IMAGE2_SUPPORTED_SIZES = {
  square: "1024x1024",
  portrait916: "1024x1792",
  portraitLong: "864x2016",
  portrait23: "1152x1728",
  portrait45: "1152x1440",
  portrait34: "1152x1536",
  portraitA4: "1240x1754",
  landscape169: "1792x1024",
  landscape43: "1536x1152",
} as const;

function resolveImageSize(aspectRatio?: string) {
  const raw = (aspectRatio || "").trim().toLowerCase();
  if (!raw) {
    return IMAGE2_SUPPORTED_SIZES.square;
  }

  if (raw === "1:1" || raw === "poster-1-1") {
    return IMAGE2_SUPPORTED_SIZES.square;
  }
  if (raw === "4:3") {
    return IMAGE2_SUPPORTED_SIZES.landscape43;
  }
  if (raw === "9:21" || raw === "poster-9-21") {
    return IMAGE2_SUPPORTED_SIZES.portraitLong;
  }
  if (raw === "9:16" || raw === "poster-9-16") {
    return IMAGE2_SUPPORTED_SIZES.portrait916;
  }
  if (raw === "2:3" || raw === "poster-2-3") {
    return IMAGE2_SUPPORTED_SIZES.portrait23;
  }
  if (raw === "4:5" || raw === "poster-4-5") {
    return IMAGE2_SUPPORTED_SIZES.portrait45;
  }
  if (raw === "3:4" || raw === "poster-3-4") {
    return IMAGE2_SUPPORTED_SIZES.portrait34;
  }
  if (raw === "poster-a4") {
    return IMAGE2_SUPPORTED_SIZES.portraitA4;
  }
  if (raw === "16:9" || raw === "poster-16-9") {
    return IMAGE2_SUPPORTED_SIZES.landscape169;
  }

  const parsed = raw.match(/^(\d+(?:\.\d+)?)\s*[:x]\s*(\d+(?:\.\d+)?)$/);
  if (parsed) {
    const left = Number(parsed[1]);
    const right = Number(parsed[2]);
    if (Number.isFinite(left) && Number.isFinite(right) && left > 0 && right > 0) {
      const ratio = left / right;
      if (Math.abs(ratio - 1) <= 0.08) {
        return IMAGE2_SUPPORTED_SIZES.square;
      }
      if (Math.abs(ratio - 16 / 9) <= 0.08) {
        return IMAGE2_SUPPORTED_SIZES.landscape169;
      }
      if (Math.abs(ratio - 4 / 3) <= 0.08) {
        return IMAGE2_SUPPORTED_SIZES.landscape43;
      }
      if (Math.abs(ratio - 9 / 21) <= 0.05) {
        return IMAGE2_SUPPORTED_SIZES.portraitLong;
      }
      if (Math.abs(ratio - 9 / 16) <= 0.07) {
        return IMAGE2_SUPPORTED_SIZES.portrait916;
      }
      if (Math.abs(ratio - 2 / 3) <= 0.06) {
        return IMAGE2_SUPPORTED_SIZES.portrait23;
      }
      if (Math.abs(ratio - 4 / 5) <= 0.06) {
        return IMAGE2_SUPPORTED_SIZES.portrait45;
      }
      if (Math.abs(ratio - 3 / 4) <= 0.06) {
        return IMAGE2_SUPPORTED_SIZES.portrait34;
      }
      if (Math.abs(ratio - 1 / 1.4142) <= 0.05) {
        return IMAGE2_SUPPORTED_SIZES.portraitA4;
      }
      return IMAGE2_SUPPORTED_SIZES.square;
    }
  }
  return IMAGE2_SUPPORTED_SIZES.square;
}

function resolveImageQuality() {
  return "standard" as const;
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

function extractImageUrl(data: ImageProviderResponse) {
  const urlFromData = data.data?.find((item) => typeof item.url === "string" && item.url.trim())?.url?.trim();
  if (urlFromData) {
    return urlFromData;
  }

  if (Array.isArray(data.image)) {
    const item = data.image.find((entry) => typeof entry === "string" && entry.trim());
    if (item) {
      return item.trim();
    }
  } else if (typeof data.image === "string" && data.image.trim()) {
    return data.image.trim();
  }

  const choiceText = data.choices?.[0]?.message?.content?.trim();
  if (choiceText?.startsWith("http://") || choiceText?.startsWith("https://")) {
    return choiceText;
  }

  return "";
}

async function generateImageWithImage2(input: {
  model: string;
  size?: string;
  prompt: string;
}) {
  const endpoint = process.env.IMAGE2_PROVIDER_ENDPOINT || "https://api.tu-zi.com/v1/images/generations";
  const apiKey =
    process.env.IMAGE2_PROVIDER_API_KEY ||
    process.env.PAID_IMAGE_API_KEY ||
    process.env.PAID_LLM_API_KEY ||
    "";

  if (!apiKey) {
    return { ok: false as const, error: "Missing IMAGE2 provider API key." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        prompt: input.prompt,
        size: input.size || IMAGE2_SUPPORTED_SIZES.square,
        n: 1,
        quality: resolveImageQuality(),
        response_format: "url",
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        ok: false as const,
        error: `Image API failed (${response.status}): ${errText.slice(0, 220)}`,
      };
    }

    const data = (await response.json()) as ImageProviderResponse;
    const imageUrl = extractImageUrl(data);
    if (!imageUrl) {
      return {
        ok: false as const,
        error: data.error?.message || "Image API returned no image URL.",
      };
    }

    return { ok: true as const, imageUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image API request failed.";
    return { ok: false as const, error: message };
  } finally {
    clearTimeout(timeout);
  }
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

    const shouldCallImageProvider = taskCount > 0 && /gpt-image-?2/i.test(imageModel);
    const taskResults: GenerationTaskResult[] = [];
    if (shouldCallImageProvider) {
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

        const generated = await generateImageWithImage2({
          model: imageModel,
          size: resolveImageSize(task.aspectRatio || payload?.ratio),
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
            error: generated.error,
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
