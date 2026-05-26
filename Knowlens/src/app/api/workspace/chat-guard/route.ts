import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import { rateLimitOrThrow } from "@/lib/server/rate-limit";
import { RATE_LIMIT_CONFIG } from "@/lib/server/rate-limit-config";
import { getUsageCounter, incrementAndCheckUsageLimit } from "@/lib/server/guard";

export const runtime = "nodejs";

function parseIntEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const value = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
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

export async function POST(request: NextRequest) {
  try {
    if (!ensureSafeOrigin(request)) {
      return NextResponse.json({ error: "Forbidden request origin." }, { status: 403 });
    }
    const session = await getServerSession(nextAuthOptions);
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Please sign in before sending chat requests." }, { status: 401 });
    }

    const scopeKey = getScopeFromRequest(request, email);
    rateLimitOrThrow({
      scopeKey: `workspace-chat:${scopeKey}`,
      endpoint: "workspace-chat-input",
      limit: RATE_LIMIT_CONFIG.workspaceChatInput.limit,
      windowMs: RATE_LIMIT_CONFIG.workspaceChatInput.windowMs,
    });

    const dailyChatOnlyLimit = parseIntEnv("ABUSE_GUARD_DAILY_CHAT_ONLY_LIMIT", 120);
    const chatMetric = incrementAndCheckUsageLimit({
      scopeKey,
      metricKey: "workspace:chat_input",
      limit: Math.max(dailyChatOnlyLimit * 3, 10_000),
    });
    const generated = getUsageCounter({
      scopeKey,
      metricKey: "workspace:generation_confirmed",
    });
    const chatWithoutGeneration = Math.max(0, chatMetric.current - generated);
    if (chatWithoutGeneration > dailyChatOnlyLimit) {
      return NextResponse.json(
        {
          error:
            "Chat usage limit reached without generation confirmation. Please generate content or retry tomorrow.",
        },
        { status: 429 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const retryAfter = (error as Error & { retryAfterSeconds?: number }).retryAfterSeconds;
    if (retryAfter) {
      return NextResponse.json(
        { error: "Too many chat requests. Please retry later." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
    const message = error instanceof Error ? error.message : "Chat guard failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

