import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import {
  listWorkspaceProjectPages,
  upsertWorkspaceProjectPages,
} from "@/lib/server/workspace-project-pages";
import { getProjectByIdForUser, logOpsEvent, saveProject } from "@/lib/server/store";

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
    const pages = await listWorkspaceProjectPages({
      userEmail: email,
      projectId: normalizeProjectId(projectId),
      outputType: outputType ? normalizeOutputType(outputType) : null,
    });
    return NextResponse.json({ ok: true, pages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load project pages.";
      void logOpsEvent({
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
    const normalizedProjectId = normalizeProjectId(projectId);
    const normalizedOutputType = normalizeOutputType(payload?.outputType || null);
    const saved = await upsertWorkspaceProjectPages({
      userEmail: email,
      projectId: normalizedProjectId,
      outputType: normalizedOutputType,
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
    if (saved > 0) {
      const existingProject = (await getProjectByIdForUser(email, normalizedProjectId)) as
        | { title?: string; status?: string; duration?: string | null }
        | null;
      const firstTitle =
        pages.find((page) => typeof page.title === "string" && page.title.trim())?.title?.trim() ||
        existingProject?.title ||
        "Untitled project";
      await saveProject({
        id: normalizedProjectId,
        userEmail: email,
        title: firstTitle,
        status: existingProject?.status || "draft",
        format: normalizedOutputType,
        duration: existingProject?.duration || undefined,
        updatedAt: new Date().toISOString(),
      });
    }
    return NextResponse.json({ ok: true, saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save project pages.";
    void logOpsEvent({
      category: "workspace",
      action: "project_pages_save_failed",
      status: "error",
      code: "PROJECT_PAGES_SAVE_FAILED",
      message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
