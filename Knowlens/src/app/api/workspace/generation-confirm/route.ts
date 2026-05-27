import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import { incrementUsageCounter } from "@/lib/server/guard";

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
    return NextResponse.json({
      ok: true,
      count,
      accepted: {
        intent: payload?.intent ?? "unknown",
        outputs: Number.isFinite(payload?.outputs) ? payload?.outputs : 0,
        ratio: payload?.ratio ?? "",
        imageModel: payload?.imageModel ?? "",
        styleId: payload?.style?.id ?? "",
        styleName: payload?.style?.name ?? "",
        taskCount,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation confirm failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
