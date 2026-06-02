import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import {
  listWorkspaceProjectPages,
  upsertWorkspaceProjectPages,
} from "@/lib/server/workspace-project-pages";
import { logOpsEvent } from "@/lib/server/store";

export const runtime = "nodejs";

function ensureSafeOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) {
    return true;
  }
  return origin === req.nextUrl.origin;
}

function normalizeProjectId(value: string) {
  return value.trim().slice(0, 120);
}

function normalizeOutputType(value: string | null) {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "ppt" || normalized === "video" || normalized === "poster") {
    return normalized;
  }
  return "poster";
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    if (!ensureSafeOrigin(request)) {
      return NextResponse.json({ error: "Forbidden request origin." }, { status: 403 });
    }
    const session = await getServerSession(nextAuthOptions);
    const email = session?.user?.email?.trim().toLowerCase() || "";
    if (!email) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }
    const { projectId } = await context.params;
    const outputType = request.nextUrl.searchParams.get("outputType");
    const pages = listWorkspaceProjectPages({
      userEmail: email,
      projectId: normalizeProjectId(projectId),
      outputType: outputType ? normalizeOutputType(outputType) : null,
    });
    return NextResponse.json({ ok: true, pages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load project pages.";
    logOpsEvent({
      category: "workspace",
      action: "project_pages_query_failed",
      status: "error",
      code: "PROJECT_PAGES_QUERY_FAILED",
      message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    if (!ensureSafeOrigin(request)) {
      return NextResponse.json({ error: "Forbidden request origin." }, { status: 403 });
    }
    const session = await getServerSession(nextAuthOptions);
    const email = session?.user?.email?.trim().toLowerCase() || "";
    if (!email) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }
    const { projectId } = await context.params;
    const payload = (await request.json().catch(() => null)) as {
      outputType?: string;
      pages?: Array<{
        index?: number;
        pageRole?: string;
        title?: string;
        subtitle?: string;
        body?: string;
        visual?: string;
        imagePromptDraft?: string;
      }>;
    } | null;
    const pages = Array.isArray(payload?.pages) ? payload.pages : [];
    const saved = upsertWorkspaceProjectPages({
      userEmail: email,
      projectId: normalizeProjectId(projectId),
      outputType: normalizeOutputType(payload?.outputType || null),
      pages: pages.map((page, idx) => ({
        index: Number.isFinite(page.index) ? Number(page.index) : idx + 1,
        pageRole: page.pageRole,
        title: page.title,
        subtitle: page.subtitle,
        body: page.body,
        visual: page.visual,
        imagePromptDraft: page.imagePromptDraft,
      })),
    });
    return NextResponse.json({ ok: true, saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save project pages.";
    logOpsEvent({
      category: "workspace",
      action: "project_pages_save_failed",
      status: "error",
      code: "PROJECT_PAGES_SAVE_FAILED",
      message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
