import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import {
  buildImageRenderUrl,
  expireAbandonedImageGenerationJob,
  getImageGenerationJobById,
} from "@/lib/server/image-generation-jobs";
import {
  buildGenerationTaskStatusSummary,
  logGenerationOpsEvent,
  logOpsEvent,
} from "@/lib/server/store";

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
    const result =
      (await expireAbandonedImageGenerationJob({
        jobId: normalizedJobId,
        source: "image_job_status",
      })) || (await getImageGenerationJobById(normalizedJobId));
    if (!result) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    if (result.job.userEmail.trim().toLowerCase() !== email) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    await logGenerationOpsEvent({
      action: "generation.job.poll",
      status: result.job.status === "failed" || result.job.status === "timed_out" || result.job.status === "billing_failed" ? "error" : "info",
      source: "image_job_status",
      code: result.job.errorCode ?? undefined,
      message: result.job.errorMessage || "Job status polled.",
      userEmail: email,
      projectId: result.job.projectId ?? undefined,
      runId: result.job.runId ?? undefined,
      jobId: result.job.id,
      idempotencyKey: result.job.idempotencyKey ?? undefined,
      jobStatus: result.job.status,
      taskStatusSummary: buildGenerationTaskStatusSummary(result.tasks),
      ratio: result.job.ratio ?? undefined,
      taskCount: result.tasks.length,
      errorCode: result.job.errorCode ?? undefined,
      safeErrorMessage: result.job.errorMessage ?? undefined,
    });

    return NextResponse.json({
      ok: true,
      job: result.job,
      tasks: result.tasks.map((task) => ({
        taskId: task.id,
        index: task.taskIndex,
        status: task.status,
        attempts: task.attempts,
        providerUsed: task.providerUsed,
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
    const message = error instanceof Error ? error.message : "Failed to fetch image generation job.";
    logOpsEvent({
      category: "image",
      action: "image_job_query_failed",
      status: "error",
      source: "unknown",
      code: "IMAGE_JOB_QUERY_FAILED",
      message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
