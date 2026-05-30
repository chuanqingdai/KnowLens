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
  try {
    if (!ensureSafeOrigin(request)) {
      return NextResponse.json({ error: "Forbidden request origin." }, { status: 403 });
    }
    const session = await getServerSession(nextAuthOptions);
    const email = session?.user?.email?.trim().toLowerCase() || "";
    if (!email) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
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
      return NextResponse.json({ error: "Asset not found." }, { status: 404 });
    }
    if (taskWithJob.job.userEmail.trim().toLowerCase() !== email) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const asset = await readImageAsset(normalizedTaskId);
    if (!asset) {
      return NextResponse.json({ error: "Asset not found." }, { status: 404 });
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
      return NextResponse.json({ error: "Asset not available." }, { status: 404 });
    }

    logOpsEvent({
      category: "image",
      action: "image_asset_served",
      status: "ok",
      source: "workspace",
      userEmail: email,
      message: "Image asset served to frontend.",
      details: {
        taskId: normalizedTaskId,
        bytes: asset.bytes.byteLength,
        mimeType: asset.mimeType,
      },
    });

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
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
