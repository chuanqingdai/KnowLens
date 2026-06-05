import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import { logOpsEvent } from "@/lib/server/store";

export const runtime = "nodejs";

const MAX_VIDEO_UPLOAD_BYTES = 220 * 1024 * 1024;
const EXPORT_INPUT_PREFIX = "video-exports/input/";
const ALLOWED_UPLOAD_TYPES = [
  "video/webm",
  "video/mp4",
  "video/quicktime",
  "video/x-m4v",
  "application/octet-stream",
];

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as HandleUploadBody;
  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const session = await getServerSession(nextAuthOptions);
        const email = session?.user?.email?.trim().toLowerCase();
        if (!email) {
          throw new Error("Please sign in before exporting video.");
        }
        if (!pathname.startsWith(EXPORT_INPUT_PREFIX)) {
          throw new Error("Invalid video upload path.");
        }
        logOpsEvent({
          category: "download",
          action: "video_export_upload_token",
          status: "ok",
          source: "video",
          userEmail: email,
          message: "Blob client upload token issued for video export.",
          details: {
            pathname,
            clientPayload,
          },
        });
        return {
          allowedContentTypes: ALLOWED_UPLOAD_TYPES,
          maximumSizeInBytes: MAX_VIDEO_UPLOAD_BYTES,
          addRandomSuffix: true,
          cacheControlMaxAge: 60,
          tokenPayload: JSON.stringify({ userEmail: email }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        let userEmail: string | undefined;
        try {
          const parsed = JSON.parse(tokenPayload || "{}") as { userEmail?: string };
          userEmail = parsed.userEmail?.trim().toLowerCase();
        } catch {
          userEmail = undefined;
        }
        logOpsEvent({
          category: "download",
          action: "video_export_upload_completed",
          status: "ok",
          source: "video",
          userEmail,
          message: "Video export input uploaded to Blob.",
          details: {
            pathname: blob.pathname,
            contentType: blob.contentType,
          },
        });
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Video upload could not be prepared.";
    logOpsEvent({
      category: "download",
      action: "video_export_upload_failed",
      status: "error",
      source: "video",
      message,
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
