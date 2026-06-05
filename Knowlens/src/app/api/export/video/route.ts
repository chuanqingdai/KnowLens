import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import ffmpegStatic from "ffmpeg-static";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import { logOpsEvent } from "@/lib/server/store";

const execFileAsync = promisify(execFile);
const MAX_VIDEO_BYTES = 220 * 1024 * 1024;
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
  try {
    const session = await getServerSession(nextAuthOptions);
    const email = session?.user?.email?.trim().toLowerCase();
    const formData = await request.formData();
    const file = formData.get("video");
    if (!(file instanceof File)) {
      logOpsEvent({
        category: "download",
        action: "video_export_failed",
        status: "error",
        source: "video",
        userEmail: email,
        code: "VIDEO_MISSING_FILE",
        message: "Missing video file in export request.",
      });
      return NextResponse.json({ error: "Missing video file." }, { status: 400 });
    }

    const sourceType = normalizeMimeType(file.type || "application/octet-stream");
    if (!ALLOWED_INPUT_TYPES.has(sourceType)) {
      logOpsEvent({
        category: "download",
        action: "video_export_failed",
        status: "error",
        source: "video",
        userEmail: email,
        code: "VIDEO_TYPE_UNSUPPORTED",
        message: `Unsupported video type: ${sourceType}`,
      });
      return NextResponse.json(
        { error: "This video format is not supported. Please retry the export." },
        { status: 400 },
      );
    }

    if (file.size <= 0) {
      logOpsEvent({
        category: "download",
        action: "video_export_failed",
        status: "error",
        source: "video",
        userEmail: email,
        code: "VIDEO_EMPTY_FILE",
        message: "Video file is empty.",
      });
      return NextResponse.json({ error: "The video file is empty. Please retry." }, { status: 400 });
    }

    if (file.size > MAX_VIDEO_BYTES) {
      logOpsEvent({
        category: "download",
        action: "video_export_failed",
        status: "error",
        source: "video",
        userEmail: email,
        code: "VIDEO_FILE_TOO_LARGE",
        message: `Video file too large: ${file.size}`,
      });
      return NextResponse.json(
        { error: "The video file is too large. Please keep it under 220MB." },
        { status: 400 },
      );
    }

    const basename = `knowlens-video-${randomUUID()}`;
    inputPath = path.join(os.tmpdir(), `${basename}.webm`);
    outputPath = path.join(os.tmpdir(), `${basename}.mp4`);
    inputBytes = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(inputPath, inputBytes);

    try {
      await transcodeWithFfmpeg(inputPath, outputPath);
      const data = await fs.readFile(outputPath);
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
        },
      });
      return new Response(data, {
        status: 200,
        headers: {
          "Content-Type": "video/mp4",
          "Cache-Control": "no-store",
          "Content-Disposition":
            "attachment; filename*=UTF-8''KnowLens.ai-storyboard-video.mp4",
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
          inputBytes: inputBytes?.length ?? file.size,
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
  }
}
