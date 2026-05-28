import { NextResponse } from "next/server";
import {
  buildImage2ProviderConfig,
  requestImage2Generation,
  resolveImage2Size,
  toImage2ErrorPayload,
  type Image2ProviderChoice,
} from "@/lib/server/image2";

export const runtime = "nodejs";

const PROVIDER_CHOICES: Image2ProviderChoice[] = ["auto", "tuzi", "duomi", "gptsapi"];

function normalizeProviderChoice(raw: string | null | undefined): Image2ProviderChoice {
  const normalized = (raw || "").trim().toLowerCase();
  if (normalized === "tuzi" || normalized === "duomi" || normalized === "gptsapi") {
    return normalized;
  }
  return "auto";
}

export async function POST(request: Request) {
  let bodyProvider: string | null = null;
  try {
    const body = (await request.json()) as { provider?: string } | null;
    bodyProvider = body?.provider?.trim() || null;
  } catch {
    bodyProvider = null;
  }
  const url = new URL(request.url);
  const queryProvider = url.searchParams.get("provider");
  const providerChoice = normalizeProviderChoice(queryProvider || bodyProvider);
  const provider = buildImage2ProviderConfig(providerChoice);
  const endpoint = provider?.endpoint || "https://api.tu-zi.com/v1/images/generations";
  const model = provider?.model || "gpt-image-2";
  const size = "1024x1792";

  if (!provider) {
    return NextResponse.json(
      {
        ok: false,
        provider: providerChoice,
        supportedProviders: PROVIDER_CHOICES,
        error: {
          code: "IMAGE2_API_KEY_MISSING",
          message: "Missing IMAGE2 API key in server environment.",
        },
      },
      { status: 500 },
    );
  }

  try {
    const result = await requestImage2Generation(provider, {
      prompt: "Create a clean science-style poster cover with a simple geometric focal object on a light background.",
      size: resolveImage2Size("9:16"),
    });
    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          provider: providerChoice,
          endpoint,
          model,
          size,
          error: toImage2ErrorPayload(result),
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        provider: providerChoice,
        endpoint,
        model,
        size,
        imageUrl: result.imageUrl,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        provider: providerChoice,
        endpoint,
        model,
        size,
        error: {
          code: "IMAGE2_SMOKE_FAILED",
          message: "Image provider request failed.",
          detail: error instanceof Error ? error.message.slice(0, 360) : "Unknown error",
        },
      },
      { status: 200 },
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
