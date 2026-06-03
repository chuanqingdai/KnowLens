import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import { rateLimitOrThrow } from "@/lib/server/rate-limit";
import { RATE_LIMIT_CONFIG } from "@/lib/server/rate-limit-config";
import { incrementAndCheckUsageLimit } from "@/lib/server/guard";
import { logOpsEvent, saveProject, upsertUser } from "@/lib/server/store";
import { attributionSource, normalizeAttributionPayload } from "@/lib/server/attribution";

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
    contentText?: string;
  }>;
  project?: {
    projectId?: string;
    projectTraceId?: string;
    projectUserId?: string;
    projectTitle?: string;
  };
  attribution?: unknown;
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

function normalizeProjectId(raw?: string) {
  const value = (raw ?? "").trim().slice(0, 120);
  if (!value) {
    return "";
  }
  if (/^[a-zA-Z0-9._:-]+$/.test(value)) {
    return value;
  }
  return "";
}

function buildProjectTitle(input: { prompt: string; sources: Array<{ name: string }> }) {
  const prompt = input.prompt.trim();
  if (prompt) {
    return prompt.slice(0, 48);
  }
  const sourceName = input.sources[0]?.name?.trim();
  if (sourceName) {
    return `${sourceName.slice(0, 36)} · Workspace Draft`;
  }
  return "Workspace Draft";
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
      return NextResponse.json(
        { code: "WORKSPACE_START_FORBIDDEN_ORIGIN", error: "Forbidden request origin." },
        { status: 403 },
      );
    }

    const session = await getServerSession(nextAuthOptions);
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json(
        {
          code: "WORKSPACE_START_AUTH_REQUIRED",
          error: "Please sign in before starting a workspace project.",
        },
        { status: 401 },
      );
    }

    const scopeKey = getScopeFromRequest(request, email);
    await rateLimitOrThrow({
      scopeKey: `workspace-start:${scopeKey}`,
      endpoint: "workspace-start-generate",
      limit: RATE_LIMIT_CONFIG.appStartGenerate.limit,
      windowMs: RATE_LIMIT_CONFIG.appStartGenerate.windowMs,
    });

    const dailyNewProjectLimit = parseIntEnv("ABUSE_GUARD_DAILY_NEW_PROJECT_LIMIT", 40);
    const dailyUsage = await incrementAndCheckUsageLimit({
      scopeKey,
      metricKey: "workspace:new_project",
      limit: dailyNewProjectLimit,
    });
    if (!dailyUsage.ok) {
      return NextResponse.json(
        {
          code: "WORKSPACE_START_DAILY_LIMIT",
          error:
            "Daily new-project limit reached. Please continue in existing conversations or retry tomorrow.",
        },
        { status: 429 },
      );
    }

    const payload = (await request.json()) as WorkspaceStartPayload;
    const attribution = normalizeAttributionPayload(payload.attribution);
    const normalizedPrompt = safeTrim(payload.prompt, 6000);
    const normalizedSources =
      Array.isArray(payload.sources) && payload.sources.length
        ? payload.sources.slice(0, 30).map((item, idx) => ({
            id: safeTrim(item.id || `src-${idx}`, 80),
            kind: safeTrim(item.kind || "file", 20),
            name: safeTrim(item.name || "Untitled Source", 120),
            origin: safeTrim(item.origin || "", 500),
            status: safeTrim(item.status || "ready", 20),
            excerpt: safeTrim(item.excerpt || "", 800),
            contentText: safeTrim(item.contentText || "", 6000),
          }))
        : [];
    if (!normalizedPrompt && normalizedSources.length === 0) {
      return NextResponse.json(
        {
          code: "WORKSPACE_START_EMPTY_INPUT",
          error: "Please enter text or upload at least one source before generating.",
        },
        { status: 400 },
      );
    }

    const userId = await upsertUser({
      email,
      name: session?.user?.name?.trim() || email.split("@")[0] || "User",
      role: "user",
    });
    const requestedProjectId = normalizeProjectId(payload.project?.projectId);
    const projectRawId = requestedProjectId || `p-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const projectTraceId = `${userId}_${projectRawId}`;
    const projectTitle = buildProjectTitle({
      prompt: normalizedPrompt,
      sources: normalizedSources.map((item) => ({ name: item.name })),
    });
    await saveProject({
      id: projectRawId,
      userEmail: email,
      title: projectTitle,
      status: "进行中",
      updatedAt: new Date().toISOString(),
    });
    logOpsEvent({
      category: "project",
      action: "workspace_project_started",
      status: "ok",
      source: attribution ? attributionSource(attribution) : "app_home",
      userEmail: email,
      projectId: projectRawId,
      message: "Workspace project initialized from home generate flow.",
      details: {
        attribution,
        projectTraceId,
        projectUserId: userId,
        hasPrompt: Boolean(normalizedPrompt),
        sourceCount: normalizedSources.length,
      },
    });

    return NextResponse.json({
      ok: true,
      payload: {
        prompt: normalizedPrompt,
        textModel: safeTrim(payload.textModel, 40),
        imageModel: safeTrim(payload.imageModel, 40),
        sources: normalizedSources,
        project: {
          projectId: projectRawId,
          projectTraceId,
          projectUserId: userId,
          projectTitle,
        },
      },
    });
  } catch (error) {
    const retryAfter = (error as Error & { retryAfterSeconds?: number }).retryAfterSeconds;
    if (retryAfter) {
      return NextResponse.json(
        {
          code: "WORKSPACE_START_RATE_LIMIT",
          error: "Too many new project attempts. Please retry later.",
        },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
    const message = error instanceof Error ? error.message : "Workspace start failed.";
    return NextResponse.json({ code: "WORKSPACE_START_INTERNAL", error: message }, { status: 500 });
  }
}
