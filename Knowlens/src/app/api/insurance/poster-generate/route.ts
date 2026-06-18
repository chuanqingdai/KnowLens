import { NextResponse } from "next/server";
import {
  buildImage2ProviderConfig,
  requestImage2Generation,
  resolveImage2Size,
  toImage2ErrorPayload,
} from "@/lib/server/image2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  prompt?: string;
  aspectRatio?: string;
};

function normalizeAspectRatio(value?: string) {
  const raw = (value || "").trim();
  if (raw === "1:1" || raw === "9:16" || raw === "3:4" || raw === "4:3" || raw === "16:9") {
    return raw;
  }
  return "9:16";
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "BAD_REQUEST",
          message: "Invalid generation request.",
        },
      },
      { status: 400 },
    );
  }

  const prompt = (body.prompt || "").trim();
  if (!prompt) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "PROMPT_REQUIRED",
          message: "Prompt is required.",
        },
      },
      { status: 400 },
    );
  }

  const aspectRatio = normalizeAspectRatio(body.aspectRatio);
  const provider = buildImage2ProviderConfig("duomi");
  if (!provider) {
    return NextResponse.json(
      {
        ok: false,
        provider: "duomi",
        error: {
          code: "IMAGE2_API_KEY_MISSING",
          message: "Missing IMAGE2 API key in server environment.",
        },
      },
      { status: 500 },
    );
  }

  const result = await requestImage2Generation(provider, {
    prompt,
    aspectRatio,
    size: resolveImage2Size(aspectRatio),
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        provider: "duomi",
        error: toImage2ErrorPayload(result),
      },
      { status: 502 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      provider: "duomi",
      imageUrl: result.imageUrl,
      aspectRatio,
    },
    { status: 200 },
  );
}
