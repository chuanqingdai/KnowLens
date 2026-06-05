import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import {
  buildImageRenderUrl,
  expireAbandonedImageGenerationJob,
  readImageGenerationJobStatus,
  sanitizeImageGenerationRawImageUrl,
  sanitizeImageGenerationTaskErrorMessage,
} from "@/lib/server/image-generation-jobs";
import { logOpsEvent } from "@/lib/server/store";

export const runtime = "nodejs";

function ensureSafeOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) {
    return true;
  }
  return origin === req.nextUrl.origin;
}

function normalizeJobId(value: string) {
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

export async function GET(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const routeStartedAt = Date.now();
  try {
    if (!ensureSafeOrigin(request)) {
      return NextResponse.json({ error: "Forbidden request origin." }, { status: 403 });
    }
    const session = await getServerSession(nextAuthOptions);
    const email = session?.user?.email?.trim().toLowerCase() || "";
    if (!email) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }

    const { jobId } = await context.params;
    const normalizedJobId = normalizeJobId(jobId);
    const result = await readImageGenerationJobStatus(normalizedJobId);
    if (!result) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    if (result.job.userEmail.trim().toLowerCase() !== email) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const durationMs = Date.now() - routeStartedAt;
    if (durationMs > 1000) {
      console.warn("[image.job-status] slow-read", {
        routeName: "image_job_status",
        jobId: result.job.id,
        status: result.job.status,
        taskCount: result.tasks.length,
        durationMs,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        job: result.job,
        tasks: result.tasks.map((task) => ({
          taskId: task.id,
          index: task.taskIndex,
          status: task.status,
          attempts: task.attempts,
          providerUsed: task.providerUsed,
          rawImageUrl: sanitizeImageGenerationRawImageUrl(task.rawImageUrl),
          imageUrl: task.renderUrl || buildImageRenderUrl(task.id, task.updatedAt),
          renderUrl: task.renderUrl || buildImageRenderUrl(task.id, task.updatedAt),
          storageKey: resolveTaskStorageKey(task),
          errorCode: task.errorCode,
          errorMessage: sanitizeImageGenerationTaskErrorMessage(task.errorMessage),
          width: task.width,
          height: task.height,
          mimeType: task.mimeType,
        })),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch image generation job.";
    logOpsEvent({
      category: "image",
      action: "image_job_query_failed",
      status: "error",
      source: "unknown",
      code: "IMAGE_JOB_QUERY_FAILED",
      message,
      details: {
        routeName: "image_job_status",
        durationMs: Date.now() - routeStartedAt,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: message,
      },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const routeStartedAt = Date.now();
  try {
    if (!ensureSafeOrigin(request)) {
      return NextResponse.json({ error: "Forbidden request origin." }, { status: 403 });
    }
    const session = await getServerSession(nextAuthOptions);
    const email = session?.user?.email?.trim().toLowerCase() || "";
    if (!email) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as { action?: string; reason?: string } | null;
    const action = (body?.action || "").trim().toLowerCase();
    if (action !== "timeout") {
      return NextResponse.json({ error: "Unsupported job action." }, { status: 400 });
    }

    const { jobId } = await context.params;
    const normalizedJobId = normalizeJobId(jobId);
    const current = await readImageGenerationJobStatus(normalizedJobId);
    if (!current) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    if (current.job.userEmail.trim().toLowerCase() !== email) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const finalized = await expireAbandonedImageGenerationJob({
      jobId: normalizedJobId,
      source: "image_job_poll_timeout",
      emitAbandonedLog: true,
      force: true,
    });
    const result = finalized || (await readImageGenerationJobStatus(normalizedJobId));
    if (!result) {
      return NextResponse.json({ error: "Job not found after timeout." }, { status: 404 });
    }

    const durationMs = Date.now() - routeStartedAt;
    console.warn("[image.job-status] timeout-finalized", {
      routeName: "image_job_status",
      jobId: result.job.id,
      status: result.job.status,
      taskStatuses: result.tasks.map((task) => task.status),
      durationMs,
      reason: body?.reason || "poll_timeout",
    });

    return NextResponse.json(
      {
        ok: true,
        job: result.job,
        tasks: result.tasks.map((task) => ({
          taskId: task.id,
          index: task.taskIndex,
          status: task.status,
          attempts: task.attempts,
          providerUsed: task.providerUsed,
          rawImageUrl: sanitizeImageGenerationRawImageUrl(task.rawImageUrl),
          imageUrl: task.renderUrl || buildImageRenderUrl(task.id, task.updatedAt),
          renderUrl: task.renderUrl || buildImageRenderUrl(task.id, task.updatedAt),
          storageKey: resolveTaskStorageKey(task),
          errorCode: task.errorCode,
          errorMessage: sanitizeImageGenerationTaskErrorMessage(task.errorMessage),
          width: task.width,
          height: task.height,
          mimeType: task.mimeType,
        })),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to finalize image generation job timeout.";
    logOpsEvent({
      category: "image",
      action: "image_job_timeout_finalize_failed",
      status: "error",
      source: "unknown",
      code: "IMAGE_JOB_TIMEOUT_FINALIZE_FAILED",
      message,
      details: {
        routeName: "image_job_status",
        durationMs: Date.now() - routeStartedAt,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: message,
      },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
