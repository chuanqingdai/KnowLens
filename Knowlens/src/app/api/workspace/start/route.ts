import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import { rateLimitOrThrow } from "@/lib/server/rate-limit";
import { RATE_LIMIT_CONFIG } from "@/lib/server/rate-limit-config";
import { incrementAndCheckUsageLimit } from "@/lib/server/guard";

export const runtime = "nodejs";

type WorkspaceStartPayload = {
  prompt?: string;
  textModel?: string;
  imageModel?: string;
  sources?: Array<{
    id?: string;
    kind?: string;
    name?: string;
    origin?: string;
    status?: string;
    excerpt?: string;
  }>;
};

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

function safeTrim(input: string | undefined, max = 2000) {
  return (input ?? "").trim().slice(0, max);
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
      return NextResponse.json({ error: "Please sign in before starting a workspace project." }, { status: 401 });
    }

    const scopeKey = getScopeFromRequest(request, email);
    rateLimitOrThrow({
      scopeKey: `workspace-start:${scopeKey}`,
      endpoint: "workspace-start-generate",
      limit: RATE_LIMIT_CONFIG.appStartGenerate.limit,
      windowMs: RATE_LIMIT_CONFIG.appStartGenerate.windowMs,
    });

    const dailyNewProjectLimit = parseIntEnv("ABUSE_GUARD_DAILY_NEW_PROJECT_LIMIT", 40);
    const dailyUsage = incrementAndCheckUsageLimit({
      scopeKey,
      metricKey: "workspace:new_project",
      limit: dailyNewProjectLimit,
    });
    if (!dailyUsage.ok) {
      return NextResponse.json(
        {
          error:
            "Daily new-project limit reached. Please continue in existing conversations or retry tomorrow.",
        },
        { status: 429 },
      );
    }

    const payload = (await request.json()) as WorkspaceStartPayload;
    const normalizedSources =
      Array.isArray(payload.sources) && payload.sources.length
        ? payload.sources.slice(0, 30).map((item, idx) => ({
            id: safeTrim(item.id || `src-${idx}`, 80),
            kind: safeTrim(item.kind || "file", 20),
            name: safeTrim(item.name || "Untitled Source", 120),
            origin: safeTrim(item.origin || "", 500),
            status: safeTrim(item.status || "ready", 20),
            excerpt: safeTrim(item.excerpt || "", 800),
          }))
        : [];

    return NextResponse.json({
      ok: true,
      payload: {
        prompt: safeTrim(payload.prompt, 6000),
        textModel: safeTrim(payload.textModel, 40),
        imageModel: safeTrim(payload.imageModel, 40),
        sources: normalizedSources,
      },
    });
  } catch (error) {
    const retryAfter = (error as Error & { retryAfterSeconds?: number }).retryAfterSeconds;
    if (retryAfter) {
      return NextResponse.json(
        { error: "Too many new project attempts. Please retry later." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
    const message = error instanceof Error ? error.message : "Workspace start failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
