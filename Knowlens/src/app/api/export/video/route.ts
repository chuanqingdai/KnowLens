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

async function safeUnlink(filePath: string) {
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore
  }
}

async function transcodeWithFfmpeg(inputPath: string, outputPath: string) {
  if (!ffmpegStatic) {
    throw new Error("ffmpeg binary is unavailable");
  }
  await execFileAsync(ffmpegStatic, [
    "-y",
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
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

async function transcodeWithAvconvert(inputPath: string, outputPath: string) {
  await execFileAsync("/usr/bin/avconvert", [
    "--source",
    inputPath,
    "--preset",
    "Preset1920x1080",
    "--output",
    outputPath,
    "--replace",
  ]);
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
      return NextResponse.json({ error: "缺少视频文件" }, { status: 400 });
    }

    const sourceType = (file.type || "application/octet-stream").toLowerCase();
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
      return NextResponse.json({ error: "暂不支持该视频格式" }, { status: 400 });
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
      return NextResponse.json({ error: "视频文件为空" }, { status: 400 });
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
      return NextResponse.json({ error: "视频文件过大，请控制在 220MB 以内" }, { status: 400 });
    }

    const basename = `knowlens-video-${randomUUID()}`;
    inputPath = path.join(os.tmpdir(), `${basename}.webm`);
    outputPath = path.join(os.tmpdir(), `${basename}.mp4`);
    inputBytes = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(inputPath, inputBytes);

    try {
      try {
        await transcodeWithFfmpeg(inputPath, outputPath);
      } catch {
        // 本地开发环境兜底（macOS）
        await transcodeWithAvconvert(inputPath, outputPath);
      }
      const data = await fs.readFile(outputPath);
      logOpsEvent({
        category: "download",
        action: "video_export_success",
        status: "ok",
        source: "video",
        userEmail: email,
        message: "video/mp4",
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
    } catch {
      // 部分运行环境不存在 avconvert，自动回退为原始 webm 导出，避免中断用户下载。
      logOpsEvent({
        category: "download",
        action: "video_export_success",
        status: "ok",
        source: "video",
        userEmail: email,
        message: "fallback_original_media",
      });
      return new Response(new Uint8Array(inputBytes), {
        status: 200,
        headers: {
          "Content-Type": sourceType === "application/octet-stream" ? "video/webm" : sourceType,
          "Cache-Control": "no-store",
          "Content-Disposition":
            "attachment; filename*=UTF-8''KnowLens.ai-storyboard-video.webm",
        },
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "视频导出失败";
    logOpsEvent({
      category: "download",
      action: "video_export_failed",
      status: "error",
      source: "video",
      code: "VIDEO_EXPORT_INTERNAL",
      message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (inputPath) {
      await safeUnlink(inputPath);
    }
    if (outputPath) {
      await safeUnlink(outputPath);
    }
  }
}
