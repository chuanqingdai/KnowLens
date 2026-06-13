import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import {
  getImageGenerationTaskWithJob,
  getMockGeneratedImageAsset,
  isMockImageGenerationTaskId,
  readImageAsset,
} from "@/lib/server/image-generation-jobs";
import { logOpsEvent } from "@/lib/server/store";

export const runtime = "nodejs";

function jsonNoStore(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function ensureSafeOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) {
    return true;
  }
  return origin === req.nextUrl.origin;
}

function normalizeTaskId(value: string) {
  return value.trim().slice(0, 120);
}

export async function GET(request: NextRequest, context: { params: Promise<{ taskId: string }> }) {
  const routeStartedAt = Date.now();
  try {
    if (!ensureSafeOrigin(request)) {
      return jsonNoStore({ error: "Forbidden request origin." }, 403);
    }
    const session = await getServerSession(nextAuthOptions);
    const email = session?.user?.email?.trim().toLowerCase() || "";
    if (!email) {
      return jsonNoStore({ error: "Please sign in first." }, 401);
    }

    const { taskId } = await context.params;
    const normalizedTaskId = normalizeTaskId(taskId);
    if (isMockImageGenerationTaskId(normalizedTaskId)) {
      const mockAsset = getMockGeneratedImageAsset();
      return new NextResponse(mockAsset.bytes, {
        status: 200,
        headers: {
          "Content-Type": mockAsset.mimeType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    const taskWithJob = await getImageGenerationTaskWithJob(normalizedTaskId);
    if (!taskWithJob) {
      return jsonNoStore({ error: "Asset not found.", code: "IMAGE_ASSET_TASK_NOT_FOUND" }, 404);
    }
    if (taskWithJob.job.userEmail.trim().toLowerCase() !== email) {
      return jsonNoStore({ error: "Forbidden." }, 403);
    }

    const asset = await readImageAsset(normalizedTaskId);
    if (!asset) {
      const message = "Image asset is not available.";
      logOpsEvent({
        category: "image",
        action: "image_asset_unavailable",
        status: "error",
        source: "workspace",
        code: "IMAGE_ASSET_UNAVAILABLE",
        message,
        userEmail: email,
        projectId: taskWithJob.job.projectId ?? undefined,
        details: {
          routeName: "image_asset_read",
          jobId: taskWithJob.job.id,
          taskId: normalizedTaskId,
          status: taskWithJob.task.status,
          durationMs: Date.now() - routeStartedAt,
          errorName: "AssetUnavailable",
          errorMessage: message,
        },
      });
      return jsonNoStore({ error: message, code: "IMAGE_ASSET_UNAVAILABLE" }, 404);
    }
    if (asset.redirectUrl) {
      return NextResponse.redirect(asset.redirectUrl, {
        status: 307,
        headers: {
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
    if (!asset.bytes) {
      return jsonNoStore({ error: "Asset not available.", code: "IMAGE_ASSET_BYTES_MISSING" }, 404);
    }

    return new NextResponse(asset.bytes, {
      status: 200,
      headers: {
        "Content-Type": asset.mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read image asset.";
    logOpsEvent({
      category: "image",
      action: "image_asset_failed",
      status: "error",
      source: "workspace",
      code: "IMAGE_ASSET_READ_FAILED",
      message,
      details: {
        routeName: "image_asset_read",
        durationMs: Date.now() - routeStartedAt,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: message,
      },
    });
    return jsonNoStore({ error: message, code: "IMAGE_ASSET_READ_FAILED" }, 500);
  }
}
