import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import {
  buildImageRenderUrl,
  getLatestImageGenerationJobByProject,
} from "@/lib/server/image-generation-jobs";
import { logOpsEvent } from "@/lib/server/store";
import { listWorkspaceProjectPages } from "@/lib/server/workspace-project-pages";

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

function resolveTaskStorageKey(task: { assetPath?: string | null }) {
  const raw = (task.assetPath || "").trim();
  if (!raw) {
    return null;
  }
  const marker = "workspace-images/";
  const markerIndex = raw.indexOf(marker);
  if (markerIndex >= 0) {
    return raw.slice(markerIndex);
  }
  return raw;
}

function normalizeFallbackText(value: unknown, maxLength = 6000) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, maxLength);
}

function buildFallbackPagesFromRequestJson(requestJson: string | null | undefined, intent: string | null) {
  const raw = (requestJson || "").trim();
  if (!raw) {
    return [];
  }
  try {
    const payload = JSON.parse(raw) as {
      intent?: string;
      normalizedDirection?: string;
      tasks?: Array<{
        index?: number;
        page?: number;
        outputType?: string;
        pageRole?: string;
        contentTitle?: string;
        title?: string;
        contentSubtitle?: string;
        subtitle?: string;
        contentBody?: string;
        body?: string;
        visualDesign?: string;
        visual?: string;
        imagePromptDraft?: string;
        imagePrompt?: string;
      }>;
    };
    const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
    const outputType = normalizeFallbackText(
      intent || payload.intent || payload.normalizedDirection || "poster",
      40,
    );
    return tasks
      .map((task, idx) => {
        const pageIndex = Math.max(1, Math.round(Number(task.index || task.page || idx + 1)));
        return {
          pageIndex,
          outputType: normalizeFallbackText(task.outputType || outputType, 40) || outputType,
          pageRole: normalizeFallbackText(task.pageRole || (idx === 0 ? "cover" : "content"), 40),
          title: normalizeFallbackText(task.contentTitle || task.title, 400),
          subtitle: normalizeFallbackText(task.contentSubtitle || task.subtitle, 800),
          body: normalizeFallbackText(task.contentBody || task.body),
          visual: normalizeFallbackText(task.visualDesign || task.visual, 1200),
          imagePromptDraft: normalizeFallbackText(task.imagePromptDraft || task.imagePrompt, 2000),
        };
      })
      .filter((page) => page.pageIndex > 0);
  } catch {
    return [];
  }
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
    const normalizedProjectId = normalizeProjectId(projectId);
    const intent = (request.nextUrl.searchParams.get("intent") || "").trim() || null;
    const result = await getLatestImageGenerationJobByProject({
      userEmail: email,
      projectId: normalizedProjectId,
      intent,
    });
    const persistedPages = listWorkspaceProjectPages({
      userEmail: email,
      projectId: normalizedProjectId,
      outputType: intent,
    });
    if (!result) {
      return NextResponse.json({ ok: true, job: null, tasks: [], pages: persistedPages });
    }
    if (result.job.userEmail.trim().toLowerCase() !== email) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    const pages =
      persistedPages.length > 0
        ? persistedPages
        : buildFallbackPagesFromRequestJson(result.job.requestJson, intent);

    return NextResponse.json({
      ok: true,
      job: result.job,
      pages,
      tasks: result.tasks.map((task) => ({
        taskId: task.id,
        index: task.taskIndex,
        status: task.status,
        attempts: task.attempts,
        rawImageUrl: task.rawImageUrl,
        imageUrl: task.renderUrl || buildImageRenderUrl(task.id, task.updatedAt),
        renderUrl: task.renderUrl || buildImageRenderUrl(task.id, task.updatedAt),
        storageKey: resolveTaskStorageKey(task),
        errorCode: task.errorCode,
        errorMessage: task.errorMessage,
        width: task.width,
        height: task.height,
        mimeType: task.mimeType,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch latest image generation job.";
    logOpsEvent({
      category: "image",
      action: "latest_image_job_query_failed",
      status: "error",
      source: "unknown",
      code: "LATEST_IMAGE_JOB_QUERY_FAILED",
      message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
