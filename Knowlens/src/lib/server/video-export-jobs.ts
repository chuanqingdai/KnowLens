import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { get as getBlob, put as putBlob } from "@vercel/blob";
import ffmpegStatic from "ffmpeg-static";
import {
  synthesizeWorkspaceTtsAudio,
  type TtsAudioResult,
} from "@/lib/server/tts-synthesis";
import { logOpsEvent } from "@/lib/server/store";

const execFileAsync = promisify(execFile);

const VIDEO_JOB_PREFIX = "video-exports/jobs";
const VIDEO_OUTPUT_PREFIX = "video-exports/output";
const VIDEO_DOWNLOAD_FILENAME = "KnowLens.ai-storyboard-video.mp4";
const MAX_SCENES = 40;
const MAX_NARRATION_CHARS_PER_SCENE = 1800;
const DEFAULT_SCENE_DURATION_SEC = 3.4;
const COVER_SCENE_DURATION_SEC = 1;
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const DEFAULT_FPS = 30;

export type VideoExportJobStatus = "queued" | "running" | "success" | "error";
export type VideoExportJobStep = "queued" | "tts" | "render" | "upload" | "done";

export type VideoExportSceneInput = {
  id?: string;
  page?: number;
  title?: string;
  imageUrl?: string;
  narrationText?: string;
  ttsId?: string;
  isCover?: boolean;
};

export type VideoExportTimelineInput = {
  projectId?: string | null;
  scenes?: VideoExportSceneInput[];
  width?: number;
  height?: number;
  fps?: number;
  transitionPresetId?: string | null;
};

export type VideoExportScene = Required<
  Pick<VideoExportSceneInput, "id" | "page" | "title" | "imageUrl">
> &
  Pick<VideoExportSceneInput, "narrationText" | "ttsId" | "isCover">;

export type VideoExportJob = {
  id: string;
  userEmail: string | null;
  projectId: string | null;
  status: VideoExportJobStatus;
  step: VideoExportJobStep;
  progress: number;
  message: string;
  currentScene: number;
  totalScenes: number;
  resultUrl: string | null;
  downloadUrl: string | null;
  filename: string;
  contentType: string;
  size: number | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  timeline: {
    scenes: VideoExportScene[];
    width: number;
    height: number;
    fps: number;
    transitionPresetId: string | null;
  };
};

type NormalizedScene = VideoExportScene;

function nowIso() {
  return new Date().toISOString();
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function normalizeText(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function getJobPath(jobId: string) {
  return `${VIDEO_JOB_PREFIX}/${jobId}.json`;
}

function getBlobAccess(): "public" | "private" {
  return process.env.VIDEO_EXPORT_JOB_BLOB_ACCESS === "private" ? "private" : "public";
}

function sanitizeProcessOutput(value: unknown) {
  const text =
    typeof value === "string" ? value : value instanceof Buffer ? value.toString("utf8") : "";
  return text
    .replaceAll(process.cwd(), "$PROJECT")
    .replaceAll(os.tmpdir(), "$TMPDIR")
    .replace(/\s+/g, " ")
    .trim()
    .slice(-1800);
}

function getProcessErrorMessage(error: unknown) {
  const candidate = error as { message?: unknown; stderr?: unknown; stdout?: unknown };
  return (
    sanitizeProcessOutput(candidate.stderr) ||
    sanitizeProcessOutput(candidate.stdout) ||
    (typeof candidate.message === "string" ? candidate.message : "ffmpeg failed")
  );
}

function extensionFromContentType(contentType: string, fallback: string) {
  const normalized = contentType.toLowerCase().split(";")[0]?.trim() || "";
  if (normalized === "image/jpeg" || normalized === "image/jpg") return ".jpg";
  if (normalized === "image/png") return ".png";
  if (normalized === "image/webp") return ".webp";
  if (normalized === "audio/wav" || normalized === "audio/wave") return ".wav";
  if (normalized === "audio/mp4" || normalized === "audio/x-m4a") return ".m4a";
  if (normalized === "audio/mpeg" || normalized === "audio/mp3") return ".mp3";
  return fallback;
}

async function readBlobJson<T>(pathname: string): Promise<T | null> {
  const blob = await getBlob(pathname, { access: getBlobAccess() });
  if (!blob || blob.statusCode !== 200 || !blob.stream) {
    return null;
  }
  const text = await new Response(blob.stream).text();
  if (!text.trim()) {
    return null;
  }
  return JSON.parse(text) as T;
}

async function writeBlobJson(pathname: string, data: unknown) {
  await putBlob(pathname, JSON.stringify(data), {
    access: getBlobAccess(),
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 0,
    contentType: "application/json",
  });
}

async function updateJob(job: VideoExportJob, patch: Partial<VideoExportJob>) {
  const next: VideoExportJob = {
    ...job,
    ...patch,
    updatedAt: nowIso(),
  };
  await writeBlobJson(getJobPath(job.id), next);
  return next;
}

function normalizeTimeline(input: VideoExportTimelineInput) {
  const scenes = Array.isArray(input.scenes) ? input.scenes : [];
  if (!scenes.length) {
    throw new Error("Missing video scenes.");
  }
  if (scenes.length > MAX_SCENES) {
    throw new Error(`Video export supports up to ${MAX_SCENES} scenes.`);
  }
  const normalizedScenes: NormalizedScene[] = scenes.map((scene, index) => {
    const imageUrl = normalizeText(scene.imageUrl, 4000);
    if (!imageUrl) {
      throw new Error(`Scene ${index + 1} image is not ready.`);
    }
    return {
      id: normalizeText(scene.id, 120) || `scene-${index + 1}`,
      page: clampNumber(scene.page, index + 1, 1, 999),
      title: normalizeText(scene.title, 240) || `Scene ${index + 1}`,
      imageUrl,
      narrationText: normalizeText(scene.narrationText, MAX_NARRATION_CHARS_PER_SCENE),
      ttsId: normalizeText(scene.ttsId, 120),
      isCover: scene.isCover === true,
    };
  });
  return {
    scenes: normalizedScenes,
    width: clampNumber(input.width, DEFAULT_WIDTH, 320, 3840),
    height: clampNumber(input.height, DEFAULT_HEIGHT, 240, 2160),
    fps: clampNumber(input.fps, DEFAULT_FPS, 12, 60),
    transitionPresetId: normalizeText(input.transitionPresetId, 120) || null,
  };
}

async function fetchBinaryAsset(urlValue: string, accept: string) {
  if (urlValue.startsWith("data:")) {
    const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(urlValue);
    if (!match) {
      throw new Error("Invalid data URL asset.");
    }
    const contentType = match[1] || "application/octet-stream";
    const payload = match[3] || "";
    const bytes = match[2]
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8");
    return { bytes, contentType };
  }

  const url = new URL(urlValue);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Unsupported asset URL.");
  }
  const response = await fetch(url, { headers: { Accept: accept } });
  if (!response.ok) {
    throw new Error(`Asset fetch failed (${response.status}).`);
  }
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "application/octet-stream",
  };
}

async function writeSceneImage(scene: NormalizedScene, tmpDir: string, index: number) {
  const asset = await fetchBinaryAsset(scene.imageUrl, "image/*,*/*");
  if (!asset.bytes.length) {
    throw new Error(`Scene ${scene.page} image is empty.`);
  }
  const imagePath = path.join(
    tmpDir,
    `scene-${String(index + 1).padStart(3, "0")}${extensionFromContentType(
      asset.contentType,
      ".png",
    )}`,
  );
  await fs.writeFile(imagePath, asset.bytes);
  return imagePath;
}

async function writeSceneAudio(
  scene: NormalizedScene,
  tmpDir: string,
  index: number,
): Promise<string | null> {
  const text = scene.narrationText?.trim() || "";
  if (!text) {
    return null;
  }
  const audio: TtsAudioResult = await synthesizeWorkspaceTtsAudio({
    text,
    voice: scene.ttsId || undefined,
  });
  const audioPath = path.join(
    tmpDir,
    `scene-${String(index + 1).padStart(3, "0")}${extensionFromContentType(
      audio.contentType,
      ".mp3",
    )}`,
  );
  await fs.writeFile(audioPath, Buffer.from(audio.data));
  return audioPath;
}

async function runFfmpeg(args: string[], timeout = 180_000) {
  if (!ffmpegStatic) {
    throw new Error("ffmpeg binary is unavailable");
  }
  try {
    await execFileAsync(ffmpegStatic, ["-hide_banner", "-y", ...args], {
      timeout,
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch (error) {
    throw new Error(getProcessErrorMessage(error));
  }
}

async function renderSceneSegment(input: {
  imagePath: string;
  audioPath: string | null;
  outputPath: string;
  width: number;
  height: number;
  fps: number;
  durationSec: number;
}) {
  const scaleFilter =
    `scale=${input.width}:${input.height}:force_original_aspect_ratio=decrease,` +
    `pad=${input.width}:${input.height}:(ow-iw)/2:(oh-ih)/2:color=0x0b0c0f,` +
    "format=yuv420p";
  const baseVideoArgs = [
    "-loop",
    "1",
    "-framerate",
    String(input.fps),
    "-i",
    input.imagePath,
  ];

  if (input.audioPath) {
    await runFfmpeg([
      ...baseVideoArgs,
      "-i",
      input.audioPath,
      "-vf",
      scaleFilter,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
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
      "-shortest",
      "-movflags",
      "+faststart",
      input.outputPath,
    ]);
    return;
  }

  await runFfmpeg([
    ...baseVideoArgs,
    "-f",
    "lavfi",
    "-t",
    input.durationSec.toFixed(3),
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=48000",
    "-t",
    input.durationSec.toFixed(3),
    "-vf",
    scaleFilter,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
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
    "-shortest",
    "-movflags",
    "+faststart",
    input.outputPath,
  ]);
}

async function concatSegments(segmentPaths: string[], outputPath: string) {
  const listPath = path.join(path.dirname(outputPath), "concat.txt");
  const content = segmentPaths
    .map((segmentPath) => `file '${segmentPath.replaceAll("'", "'\\''")}'`)
    .join("\n");
  await fs.writeFile(listPath, content);
  await runFfmpeg(
    [
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
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
    ],
    240_000,
  );
}

export async function createVideoExportJob(input: {
  userEmail?: string | null;
  projectId?: string | null;
  timeline: VideoExportTimelineInput;
}) {
  const now = nowIso();
  const normalized = normalizeTimeline(input.timeline);
  const job: VideoExportJob = {
    id: randomUUID(),
    userEmail: input.userEmail?.trim().toLowerCase() || null,
    projectId: input.projectId?.trim() || input.timeline.projectId?.trim() || null,
    status: "queued",
    step: "queued",
    progress: 0,
    message: "Queued",
    currentScene: 0,
    totalScenes: normalized.scenes.length,
    resultUrl: null,
    downloadUrl: null,
    filename: VIDEO_DOWNLOAD_FILENAME,
    contentType: "video/mp4",
    size: null,
    error: null,
    createdAt: now,
    updatedAt: now,
    timeline: normalized,
  };
  await writeBlobJson(getJobPath(job.id), job);
  return job;
}

export async function getVideoExportJob(jobId: string) {
  const normalized = jobId.trim();
  if (!normalized || !/^[a-z0-9-]{20,80}$/i.test(normalized)) {
    return null;
  }
  return readBlobJson<VideoExportJob>(getJobPath(normalized));
}

export async function runVideoExportJob(jobId: string) {
  let job = await getVideoExportJob(jobId);
  if (!job || job.status !== "queued") {
    return;
  }
  const tmpDir = path.join(os.tmpdir(), `knowlens-video-${job.id}`);
  try {
    await fs.mkdir(tmpDir, { recursive: true });
    job = await updateJob(job, {
      status: "running",
      step: "tts",
      progress: 2,
      message: `Generating 0/${job.totalScenes}`,
    });

    const segmentPaths: string[] = [];
    for (let index = 0; index < job.timeline.scenes.length; index += 1) {
      const scene = job.timeline.scenes[index];
      job = await updateJob(job, {
        step: "tts",
        currentScene: index + 1,
        progress: Math.min(65, Math.round(((index + 0.15) / job.totalScenes) * 70)),
        message: `Generating ${index + 1}/${job.totalScenes}`,
      });
      const imagePath = await writeSceneImage(scene, tmpDir, index);
      const audioPath = await writeSceneAudio(scene, tmpDir, index);
      const segmentPath = path.join(tmpDir, `segment-${String(index + 1).padStart(3, "0")}.mp4`);
      job = await updateJob(job, {
        step: "render",
        progress: Math.min(82, Math.round(((index + 0.5) / job.totalScenes) * 82)),
        message: `Rendering scene ${index + 1}/${job.totalScenes}`,
      });
      await renderSceneSegment({
        imagePath,
        audioPath,
        outputPath: segmentPath,
        width: job.timeline.width,
        height: job.timeline.height,
        fps: job.timeline.fps,
        durationSec: scene.isCover ? COVER_SCENE_DURATION_SEC : DEFAULT_SCENE_DURATION_SEC,
      });
      segmentPaths.push(segmentPath);
    }

    job = await updateJob(job, {
      step: "render",
      progress: 88,
      message: "Rendering video",
    });
    const outputPath = path.join(tmpDir, "knowlens-storyboard.mp4");
    await concatSegments(segmentPaths, outputPath);
    const data = await fs.readFile(outputPath);
    if (data.length <= 0) {
      throw new Error("Rendered video is empty.");
    }

    job = await updateJob(job, {
      step: "upload",
      progress: 96,
      message: "Uploading video",
    });
    const blob = await putBlob(`${VIDEO_OUTPUT_PREFIX}/${job.id}.mp4`, data, {
      access: "public",
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: "video/mp4",
    });
    await updateJob(job, {
      status: "success",
      step: "done",
      progress: 100,
      message: "Ready",
      resultUrl: blob.url,
      downloadUrl: blob.downloadUrl || blob.url,
      size: data.length,
    });
    logOpsEvent({
      category: "download",
      action: "video_export_job_success",
      status: "ok",
      source: "video",
      userEmail: job.userEmail || undefined,
      details: {
        jobId: job.id,
        scenes: job.totalScenes,
        bytes: data.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "MP4 export failed";
    if (job) {
      await updateJob(job, {
        status: "error",
        step: job.step === "queued" ? "tts" : job.step,
        progress: 0,
        message: "MP4 export failed. Please retry.",
        error: "MP4 export failed. Please retry.",
      }).catch(() => undefined);
    }
    logOpsEvent({
      category: "download",
      action: "video_export_job_failed",
      status: "error",
      source: "video",
      userEmail: job?.userEmail || undefined,
      code: "VIDEO_EXPORT_JOB_FAILED",
      message,
      details: {
        jobId,
      },
    });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
