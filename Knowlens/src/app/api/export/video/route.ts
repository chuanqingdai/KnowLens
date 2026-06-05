import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { del as deleteBlob, put as putBlob } from "@vercel/blob";
import { NextResponse } from "next/server";
import ffmpegStatic from "ffmpeg-static";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import { logOpsEvent } from "@/lib/server/store";

const execFileAsync = promisify(execFile);
const MAX_VIDEO_BYTES = 220 * 1024 * 1024;
const VIDEO_DOWNLOAD_FILENAME = "KnowLens.ai-storyboard-video.mp4";
const TEMP_EXPORT_BLOB_PREFIX = "/video-exports/input/";
const ALLOWED_INPUT_TYPES = new Set([
  "video/webm",
  "video/mp4",
  "video/quicktime",
  "video/x-m4v",
  "application/octet-stream",
]);

export const runtime = "nodejs";

function normalizeMimeType(value: string) {
  return value.toLowerCase().split(";")[0]?.trim() || "application/octet-stream";
}

async function safeUnlink(filePath: string) {
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore
  }
}

function safeProcessOutput(value: unknown) {
  const text = typeof value === "string" ? value : value instanceof Buffer ? value.toString("utf8") : "";
  return text
    .replaceAll(process.cwd(), "$PROJECT")
    .replaceAll(os.tmpdir(), "$TMPDIR")
    .replace(/\s+/g, " ")
    .trim()
    .slice(-1800);
}

function buildProcessErrorMessage(error: unknown) {
  const candidate = error as { message?: unknown; stderr?: unknown; stdout?: unknown };
  const stderr = safeProcessOutput(candidate.stderr);
  const stdout = safeProcessOutput(candidate.stdout);
  const message = typeof candidate.message === "string" ? candidate.message : "ffmpeg failed";
  return [stderr || stdout || message].filter(Boolean).join(" | ");
}

function wantsJsonResponse(request: Request) {
  const accept = request.headers.get("accept") || "";
  const contentType = request.headers.get("content-type") || "";
  return accept.includes("application/json") || contentType.includes("application/json");
}

function validateExportBlobUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid video upload URL.");
  }
  if (url.protocol !== "https:" || !url.hostname.endsWith(".blob.vercel-storage.com")) {
    throw new Error("Unsupported video upload URL.");
  }
  return url;
}

function isTemporaryExportBlobUrl(value: string) {
  try {
    return new URL(value).pathname.startsWith(TEMP_EXPORT_BLOB_PREFIX);
  } catch {
    return false;
  }
}

async function readUploadedBlobInput(sourceUrl: string) {
  const url = validateExportBlobUrl(sourceUrl);
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "video/*,application/octet-stream",
    },
  });
  if (!response.ok) {
    throw new Error(`Uploaded video could not be fetched (${response.status}).`);
  }
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_VIDEO_BYTES) {
    throw new Error("The video file is too large. Please keep it under 220MB.");
  }
  const sourceType = normalizeMimeType(
    response.headers.get("content-type") || "application/octet-stream",
  );
  if (!ALLOWED_INPUT_TYPES.has(sourceType)) {
    throw new Error(`Unsupported video type: ${sourceType}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length <= 0) {
    throw new Error("The video file is empty. Please retry.");
  }
  if (bytes.length > MAX_VIDEO_BYTES) {
    throw new Error("The video file is too large. Please keep it under 220MB.");
  }
  return {
    bytes,
    sourceType,
    sourceUrl: url.toString(),
  };
}

async function readMultipartInput(request: Request) {
  const formData = await request.formData();
  const file = formData.get("video");
  if (!(file instanceof File)) {
    throw new Error("Missing video file.");
  }
  const sourceType = normalizeMimeType(file.type || "application/octet-stream");
  if (!ALLOWED_INPUT_TYPES.has(sourceType)) {
    throw new Error(`Unsupported video type: ${sourceType}`);
  }
  if (file.size <= 0) {
    throw new Error("The video file is empty. Please retry.");
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error("The video file is too large. Please keep it under 220MB.");
  }
  return {
    bytes: Buffer.from(await file.arrayBuffer()),
    sourceType,
    sourceUrl: null,
  };
}

async function uploadMp4Result(data: Buffer) {
  return putBlob(`video-exports/output/${randomUUID()}.mp4`, data, {
    access: "public",
    contentType: "video/mp4",
    addRandomSuffix: false,
  });
}

async function transcodeWithFfmpeg(inputPath: string, outputPath: string) {
  if (!ffmpegStatic) {
    throw new Error("ffmpeg binary is unavailable");
  }
  try {
    await execFileAsync(
      ffmpegStatic,
      [
        "-hide_banner",
        "-y",
        "-fflags",
        "+genpts",
        "-analyzeduration",
        "100M",
        "-probesize",
        "100M",
        "-i",
        inputPath,
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-vf",
        "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        outputPath,
      ],
      {
        timeout: 180_000,
        maxBuffer: 4 * 1024 * 1024,
      },
    );
  } catch (error) {
    throw new Error(`ffmpeg transcode failed: ${buildProcessErrorMessage(error)}`);
  }
}

export async function POST(request: Request) {
  let inputPath = "";
  let outputPath = "";
  let inputBytes: Buffer | null = null;
  let cleanupInputBlobUrl: string | null = null;
  const shouldReturnJson = wantsJsonResponse(request);
  try {
    const session = await getServerSession(nextAuthOptions);
    const email = session?.user?.email?.trim().toLowerCase();
    let sourceType = "application/octet-stream";
    try {
      if (request.headers.get("content-type")?.includes("application/json")) {
        const body = (await request.json().catch(() => ({}))) as { blobUrl?: string };
        if (!body.blobUrl?.trim()) {
          throw new Error("Missing uploaded video URL.");
        }
        const input = await readUploadedBlobInput(body.blobUrl.trim());
        inputBytes = input.bytes;
        sourceType = input.sourceType;
        cleanupInputBlobUrl = isTemporaryExportBlobUrl(input.sourceUrl) ? input.sourceUrl : null;
      } else {
        const input = await readMultipartInput(request);
        inputBytes = input.bytes;
        sourceType = input.sourceType;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Video export input is invalid.";
      const lower = message.toLowerCase();
      const code = lower.includes("missing")
        ? "VIDEO_MISSING_FILE"
        : lower.includes("unsupported")
          ? "VIDEO_TYPE_UNSUPPORTED"
          : lower.includes("empty")
            ? "VIDEO_EMPTY_FILE"
            : lower.includes("too large")
              ? "VIDEO_FILE_TOO_LARGE"
              : "VIDEO_INPUT_INVALID";
      logOpsEvent({
        category: "download",
        action: "video_export_failed",
        status: "error",
        source: "video",
        userEmail: email,
        code,
        message,
      });
      const status = code === "VIDEO_FILE_TOO_LARGE" ? 413 : code === "VIDEO_TYPE_UNSUPPORTED" ? 400 : 400;
      return NextResponse.json({ error: message }, { status });
    }

    const basename = `knowlens-video-${randomUUID()}`;
    inputPath = path.join(os.tmpdir(), `${basename}.webm`);
    outputPath = path.join(os.tmpdir(), `${basename}.mp4`);
    await fs.writeFile(inputPath, inputBytes);

    try {
      await transcodeWithFfmpeg(inputPath, outputPath);
      const data = await fs.readFile(outputPath);
      const outputBlob = shouldReturnJson ? await uploadMp4Result(data) : null;
      logOpsEvent({
        category: "download",
        action: "video_export_success",
        status: "ok",
        source: "video",
        userEmail: email,
        message: "video/mp4",
        details: {
          inputType: sourceType,
          inputBytes: inputBytes.length,
          outputBytes: data.length,
          outputDelivery: shouldReturnJson ? "blob" : "response",
        },
      });
      if (outputBlob) {
        return NextResponse.json({
          url: outputBlob.url,
          downloadUrl: outputBlob.downloadUrl || outputBlob.url,
          contentType: "video/mp4",
          size: data.length,
          filename: VIDEO_DOWNLOAD_FILENAME,
        });
      }
      return new Response(data, {
        status: 200,
        headers: {
          "Content-Type": "video/mp4",
          "Cache-Control": "no-store",
          "Content-Disposition":
            `attachment; filename*=UTF-8''${VIDEO_DOWNLOAD_FILENAME}`,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "MP4 export failed";
      logOpsEvent({
        category: "download",
        action: "video_export_failed",
        status: "error",
        source: "video",
        userEmail: email,
        code: "VIDEO_MP4_TRANSCODE_FAILED",
        message,
        details: {
          inputType: sourceType,
          inputBytes: inputBytes?.length ?? 0,
        },
      });
      return NextResponse.json({ error: "MP4 export failed. Please retry." }, { status: 500 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Video export failed";
    logOpsEvent({
      category: "download",
      action: "video_export_failed",
      status: "error",
      source: "video",
      code: "VIDEO_EXPORT_INTERNAL",
      message,
    });
    return NextResponse.json({ error: "Video export failed. Please retry." }, { status: 500 });
  } finally {
    if (inputPath) {
      await safeUnlink(inputPath);
    }
    if (outputPath) {
      await safeUnlink(outputPath);
    }
    if (cleanupInputBlobUrl) {
      await deleteBlob(cleanupInputBlobUrl).catch(() => undefined);
    }
  }
}
