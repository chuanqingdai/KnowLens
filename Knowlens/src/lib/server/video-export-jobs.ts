import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { get as getBlob, list as listBlobs, put as putBlob } from "@vercel/blob";
import ffmpegStatic from "ffmpeg-static";
import {
  synthesizeWorkspaceTtsAudio,
  type TtsAudioResult,
} from "@/lib/server/tts-synthesis";
import {
  getImageGenerationTaskWithJob,
  getMockGeneratedImageAsset,
  isMockImageGenerationTaskId,
  readImageAsset,
} from "@/lib/server/image-generation-jobs";
import { linkVideoExportToPublishedCases } from "@/lib/server/published-case-video-assets";
import { logOpsEvent } from "@/lib/server/store";
import {
  buildSceneTransitions,
  TRANSITION_PRESETS,
  type SceneTransition,
  type TransitionPresetId,
} from "@/lib/video/transitions";

const execFileAsync = promisify(execFile);

const VIDEO_JOB_PREFIX = "video-exports/jobs";
const VIDEO_OUTPUT_PREFIX = "video-exports/output";
const VIDEO_DOWNLOAD_FILENAME = "KnowLens.ai-storyboard-video.mp4";
const MAX_SCENES = 40;
const MAX_NARRATION_CHARS_PER_SCENE = 1800;
const DEFAULT_SCENE_DURATION_SEC = 3.4;
const COVER_SCENE_DURATION_SEC = 1;
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;
const DEFAULT_FPS = 30;
const VIDEO_TTS_PLAYBACK_RATE = 1.2;
const VIDEO_EXPORT_CRF = "17";
const VIDEO_EXPORT_PRESET = "veryfast";
const VIDEO_EXPORT_AUDIO_BITRATE = "192k";
const VIDEO_TRANSITION_CONCAT_BASE_TIMEOUT_MS = 180_000;
const VIDEO_TRANSITION_CONCAT_TIMEOUT_PER_SCENE_MS = 25_000;
const VIDEO_TRANSITION_CONCAT_MAX_TIMEOUT_MS = 540_000;
const MIN_VISIBLE_TRANSITION_DURATION_SEC = 0.8;
const MAX_VISIBLE_TRANSITION_DURATION_SEC = 1.25;

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
  errorDebug: string | null;
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

function normalizeTransitionPresetId(value: string | null | undefined): TransitionPresetId | undefined {
  const normalized = normalizeText(value, 120);
  return TRANSITION_PRESETS.some((item) => item.id === normalized)
    ? (normalized as TransitionPresetId)
    : undefined;
}

function mapTransitionToFfmpegXfade(transition: SceneTransition) {
  if (transition.type === "cross_dissolve") {
    return "fade";
  }
  if (transition.type === "dip_to_color") {
    return "fadeblack";
  }
  if (transition.type === "light_sweep") {
    if (transition.direction === "up") return "wipeup";
    if (transition.direction === "down") return "wipedown";
    if (transition.direction === "left") return "wipeleft";
    return "wiperight";
  }
  if (transition.type === "wipe") {
    if (transition.direction === "right") return "wiperight";
    if (transition.direction === "up") return "wipeup";
    if (transition.direction === "down") return "wipedown";
    return "wipeleft";
  }
  if (transition.type === "slide") {
    if (transition.direction === "right") return "slideright";
    if (transition.direction === "up") return "slideup";
    if (transition.direction === "down") return "slidedown";
    return "slideleft";
  }
  return "fade";
}

function buildVideoNormalizeFilter(fps: number) {
  const safeFps = Math.max(1, Math.round(fps || DEFAULT_FPS));
  return `fps=${safeFps},settb=expr=1/${safeFps},setpts=N/(${safeFps}*TB),setsar=1,format=yuv420p`;
}

function countTransitionsByType(transitions: SceneTransition[]) {
  return transitions.reduce<Record<string, number>>((summary, transition) => {
    const key = transition.type;
    summary[key] = (summary[key] || 0) + 1;
    return summary;
  }, {});
}

function buildExportSceneTransitions(input: {
  scenes: VideoExportScene[];
  fps: number;
  transitionPresetId: string | null;
}) {
  return buildSceneTransitions(
    input.scenes.map((scene) => ({
      id: scene.id,
      title: scene.title,
      voiceover: scene.narrationText || "",
    })),
    {
      fps: input.fps,
      preset: normalizeTransitionPresetId(input.transitionPresetId),
    },
  );
}

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

function getImageSourceKind(urlValue: string) {
  if (urlValue.startsWith("data:")) {
    return "data";
  }
  return getWorkspaceImageAssetTaskId(urlValue) ? "workspace_asset" : "remote_url";
}

function getTimelineSourceSummary(scenes: NormalizedScene[]) {
  return scenes.reduce(
    (summary, scene) => {
      const sourceKind = getImageSourceKind(scene.imageUrl);
      summary[sourceKind] += 1;
      if (scene.narrationText?.trim()) {
        summary.voiced += 1;
      }
      return summary;
    },
    {
      data: 0,
      remote_url: 0,
      workspace_asset: 0,
      voiced: 0,
    },
  );
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

async function logVideoExportJobEvent(input: {
  job: Pick<
    VideoExportJob,
    "id" | "userEmail" | "projectId" | "step" | "progress" | "currentScene" | "totalScenes"
  >;
  action: string;
  status?: "ok" | "error" | "info";
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
}) {
  const job = input.job;
  await logOpsEvent({
    category: "download",
    action: input.action,
    status: input.status || "info",
    source: "video",
    userEmail: job.userEmail || undefined,
    projectId: job.projectId || undefined,
    code: input.code,
    message: input.message,
    details: {
      jobId: job.id,
      step: job.step,
      progress: job.progress,
      currentScene: job.currentScene,
      totalScenes: job.totalScenes,
      ...input.details,
    },
  });
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

function getWorkspaceImageAssetTaskId(urlValue: string) {
  try {
    const url = new URL(urlValue);
    const match = /^\/api\/workspace\/image\/assets\/([^/?#]+)$/.exec(url.pathname);
    if (!match?.[1]) {
      return null;
    }
    return decodeURIComponent(match[1]).trim().slice(0, 120) || null;
  } catch {
    return null;
  }
}

async function fetchHttpBinaryAsset(urlValue: string, accept: string) {
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

async function fetchWorkspaceImageAsset(taskId: string, userEmail: string | null) {
  if (isMockImageGenerationTaskId(taskId)) {
    const mockAsset = getMockGeneratedImageAsset();
    return {
      bytes: Buffer.from(mockAsset.bytes),
      contentType: mockAsset.mimeType,
    };
  }
  if (!userEmail) {
    throw new Error("Please sign in before exporting protected scene images.");
  }
  const taskWithJob = await getImageGenerationTaskWithJob(taskId);
  if (!taskWithJob) {
    throw new Error(`Scene image asset ${taskId} was not found.`);
  }
  if (taskWithJob.job.userEmail.trim().toLowerCase() !== userEmail) {
    throw new Error("Scene image asset is not available for this user.");
  }
  const asset = await readImageAsset(taskId);
  if (!asset) {
    throw new Error(`Scene image asset ${taskId} is not available.`);
  }
  if (asset.redirectUrl) {
    return fetchHttpBinaryAsset(asset.redirectUrl, "image/*,*/*");
  }
  if (!asset.bytes) {
    throw new Error(`Scene image asset ${taskId} is empty.`);
  }
  return {
    bytes: Buffer.from(asset.bytes),
    contentType: asset.mimeType,
  };
}

async function fetchBinaryAsset(urlValue: string, accept: string, userEmail: string | null) {
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

  const workspaceTaskId = getWorkspaceImageAssetTaskId(urlValue);
  if (workspaceTaskId) {
    return fetchWorkspaceImageAsset(workspaceTaskId, userEmail);
  }

  return fetchHttpBinaryAsset(urlValue, accept);
}

async function writeSceneImage(
  scene: NormalizedScene,
  tmpDir: string,
  index: number,
  userEmail: string | null,
) {
  const asset = await fetchBinaryAsset(scene.imageUrl, "image/*,*/*", userEmail);
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

function escapeConcatPath(filePath: string) {
  return filePath.replace(/'/g, "'\\''");
}

async function getMediaDurationSec(filePath: string, fallbackSec: number) {
  if (!ffmpegStatic) {
    return fallbackSec;
  }
  const parseDuration = (output: string) => {
    const match = /Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(output);
    if (!match) {
      return null;
    }
    const hours = Number(match[1] || 0);
    const minutes = Number(match[2] || 0);
    const seconds = Number(match[3] || 0);
    const durationSec = hours * 3600 + minutes * 60 + seconds;
    return Number.isFinite(durationSec) && durationSec > 0 ? durationSec : null;
  };
  try {
    const result = await execFileAsync(ffmpegStatic, ["-hide_banner", "-i", filePath, "-f", "null", "-"], {
      timeout: 60_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    return parseDuration(String(result.stderr || "")) ?? fallbackSec;
  } catch (error) {
    const output = getProcessErrorMessage(error);
    return parseDuration(output) ?? fallbackSec;
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
  const safeFps = Math.max(1, Math.round(input.fps || DEFAULT_FPS));
  const scaleFilter =
    `scale=${input.width}:${input.height}:force_original_aspect_ratio=decrease,` +
    `pad=${input.width}:${input.height}:(ow-iw)/2:(oh-ih)/2:color=0x0b0c0f,` +
    "format=yuv420p";
  if (input.audioPath) {
    const rawDurationSec = await getMediaDurationSec(input.audioPath, input.durationSec);
    const durationSec = Math.max(0.5, rawDurationSec / VIDEO_TTS_PLAYBACK_RATE);
    const durationText = durationSec.toFixed(3);
    const audioTempoFilter = `atempo=${VIDEO_TTS_PLAYBACK_RATE.toFixed(2)}`;
    const videoFilter = `${scaleFilter},${buildVideoNormalizeFilter(safeFps)}`;
    const audioFilter =
      `${audioTempoFilter},apad=whole_dur=${durationText},atrim=0:${durationText},` +
      "aresample=async=1:first_pts=0,aformat=sample_rates=48000:channel_layouts=stereo," +
      "asetpts=PTS-STARTPTS,alimiter=limit=0.95";
    await runFfmpeg([
      "-loop",
      "1",
      "-framerate",
      String(safeFps),
      "-t",
      durationText,
      "-i",
      input.imagePath,
      "-i",
      input.audioPath,
      "-t",
      durationText,
      "-filter_complex",
      `[0:v]${videoFilter}[v];[1:a]${audioFilter}[a]`,
      "-map",
      "[v]",
      "-map",
      "[a]",
      "-c:v",
      "libx264",
      "-preset",
      VIDEO_EXPORT_PRESET,
      "-crf",
      VIDEO_EXPORT_CRF,
      "-tune",
      "stillimage",
      "-pix_fmt",
      "yuv420p",
      "-r",
      String(safeFps),
      "-c:a",
      "aac",
      "-b:a",
      VIDEO_EXPORT_AUDIO_BITRATE,
      "-movflags",
      "+faststart",
      "-avoid_negative_ts",
      "make_zero",
      input.outputPath,
    ]);
    return;
  }

  await runFfmpeg([
    "-loop",
    "1",
    "-framerate",
    String(safeFps),
    "-t",
    input.durationSec.toFixed(3),
    "-i",
    input.imagePath,
    "-f",
    "lavfi",
    "-t",
    input.durationSec.toFixed(3),
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=48000",
    "-t",
    input.durationSec.toFixed(3),
    "-filter_complex",
    `[0:v]${scaleFilter},${buildVideoNormalizeFilter(safeFps)}[v];[1:a]aresample=async=1:first_pts=0,aformat=sample_rates=48000:channel_layouts=stereo,asetpts=PTS-STARTPTS[a]`,
    "-map",
    "[v]",
    "-map",
    "[a]",
    "-c:v",
    "libx264",
    "-preset",
    VIDEO_EXPORT_PRESET,
    "-crf",
    VIDEO_EXPORT_CRF,
    "-tune",
    "stillimage",
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(safeFps),
    "-c:a",
    "aac",
    "-b:a",
    VIDEO_EXPORT_AUDIO_BITRATE,
    "-movflags",
    "+faststart",
    "-avoid_negative_ts",
    "make_zero",
    input.outputPath,
  ]);
}

async function concatSegmentsWithDemuxer(segmentPaths: string[], outputPath: string, fps = DEFAULT_FPS) {
  if (!segmentPaths.length) {
    throw new Error("No rendered video segments to concatenate.");
  }
  const safeFps = Math.max(1, Math.round(fps || DEFAULT_FPS));
  const listPath = path.join(path.dirname(outputPath), "segments.txt");
  const listBody = segmentPaths.map((segmentPath) => `file '${escapeConcatPath(segmentPath)}'`).join("\n");
  await fs.writeFile(listPath, `${listBody}\n`, "utf8");
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
      VIDEO_EXPORT_PRESET,
      "-crf",
      VIDEO_EXPORT_CRF,
      "-tune",
      "stillimage",
      "-pix_fmt",
      "yuv420p",
      "-r",
      String(safeFps),
      "-c:a",
      "aac",
      "-b:a",
      VIDEO_EXPORT_AUDIO_BITRATE,
      "-movflags",
      "+faststart",
      "-avoid_negative_ts",
      "make_zero",
      outputPath,
    ],
    240_000,
  );
}

async function concatSegments(segmentPaths: string[], outputPath: string, fps = DEFAULT_FPS) {
  if (!segmentPaths.length) {
    throw new Error("No rendered video segments to concatenate.");
  }
  const inputArgs = segmentPaths.flatMap((segmentPath) => ["-i", segmentPath]);
  const safeFps = Math.max(1, Math.round(fps || DEFAULT_FPS));
  const videoNormalizeFilter = buildVideoNormalizeFilter(safeFps);
  const normalizedInputs = segmentPaths
    .map((_, index) => {
      return (
        `[${index}:v]${videoNormalizeFilter}[v${index}];` +
        `[${index}:a]aresample=async=1:first_pts=0,aformat=sample_rates=48000:channel_layouts=stereo,asetpts=PTS-STARTPTS[a${index}]`
      );
    })
    .join(";");
  const concatInputs = segmentPaths.map((_, index) => `[v${index}][a${index}]`).join("");
  try {
    await runFfmpeg(
      [
        ...inputArgs,
        "-filter_complex",
        `${normalizedInputs};${concatInputs}concat=n=${segmentPaths.length}:v=1:a=1[v][a]`,
        "-map",
        "[v]",
        "-map",
        "[a]",
        "-c:v",
        "libx264",
        "-preset",
        VIDEO_EXPORT_PRESET,
        "-crf",
        VIDEO_EXPORT_CRF,
        "-tune",
        "stillimage",
        "-pix_fmt",
        "yuv420p",
        "-r",
        String(safeFps),
        "-c:a",
        "aac",
        "-b:a",
        VIDEO_EXPORT_AUDIO_BITRATE,
        "-movflags",
        "+faststart",
        "-avoid_negative_ts",
        "make_zero",
        outputPath,
      ],
      240_000,
    );
  } catch {
    await concatSegmentsWithDemuxer(segmentPaths, outputPath, safeFps);
  }
}

async function concatSegmentsWithTransitions(input: {
  segmentPaths: string[];
  segmentDurationsSec: number[];
  transitions: SceneTransition[];
  fps: number;
  outputPath: string;
}) {
  const { segmentPaths, segmentDurationsSec, outputPath } = input;
  const fps = Math.max(1, Math.round(input.fps || DEFAULT_FPS));
  const transitions = input.transitions.slice(0, Math.max(0, segmentPaths.length - 1));
  if (segmentPaths.length <= 1 || !transitions.length) {
    await concatSegments(segmentPaths, outputPath, fps);
    return;
  }
  if (segmentDurationsSec.length !== segmentPaths.length) {
    throw new Error("Video transition input durations are incomplete.");
  }

  const inputArgs = segmentPaths.flatMap((segmentPath) => ["-i", segmentPath]);
  const transitionDurations = transitions.map((transition, index) => {
    const requested = Math.max(
      MIN_VISIBLE_TRANSITION_DURATION_SEC,
      Math.min(MAX_VISIBLE_TRANSITION_DURATION_SEC, transition.durationSeconds || MIN_VISIBLE_TRANSITION_DURATION_SEC),
    );
    const currentDuration = Math.max(0.25, segmentDurationsSec[index] || DEFAULT_SCENE_DURATION_SEC);
    const nextDuration = Math.max(0.25, segmentDurationsSec[index + 1] || DEFAULT_SCENE_DURATION_SEC);
    const maxSafeDuration = Math.max(0.2, Math.min(currentDuration, nextDuration) - 0.05);
    return Math.min(requested, maxSafeDuration);
  });
  const videoInputs = segmentPaths.map((_, index) => {
    const outgoingTransitionSec = transitionDurations[index] || 0;
    const padFilter =
      outgoingTransitionSec > 0
        ? `,tpad=stop_mode=clone:stop_duration=${outgoingTransitionSec.toFixed(3)}`
        : "";
    return `[${index}:v]fps=${fps},settb=AVTB,setpts=PTS-STARTPTS,setsar=1,format=yuv420p${padFilter},fps=${fps},settb=AVTB,setpts=PTS-STARTPTS[tv${index}]`;
  });
  const audioInputs = segmentPaths.map((_, index) => {
    return `[${index}:a]aresample=async=1:first_pts=0,aformat=sample_rates=48000:channel_layouts=stereo,asetpts=PTS-STARTPTS[a${index}]`;
  });

  const transitionFilters: string[] = [];
  let currentVideoLabel = "tv0";
  let currentVideoDurationSec =
    Math.max(0.25, segmentDurationsSec[0] || DEFAULT_SCENE_DURATION_SEC) +
    (transitionDurations[0] || 0);
  transitions.forEach((transition, index) => {
    const durationSec = transitionDurations[index] || 0.45;
    const transitionName = mapTransitionToFfmpegXfade(transition);
    const nextVideoLabel = `tv${index + 1}`;
    const rawOutputLabel = `xvraw${index}`;
    const outputLabel = `xv${index}`;
    const offsetSec = Math.max(0.05, currentVideoDurationSec - durationSec);
    transitionFilters.push(
      `[${currentVideoLabel}][${nextVideoLabel}]xfade=transition=${transitionName}:duration=${durationSec.toFixed(
        3,
      )}:offset=${offsetSec.toFixed(3)}[${rawOutputLabel}]`,
      `[${rawOutputLabel}]fps=${fps},settb=AVTB,setpts=PTS-STARTPTS,format=yuv420p[${outputLabel}]`,
    );
    currentVideoLabel = outputLabel;
    currentVideoDurationSec =
      currentVideoDurationSec +
      Math.max(0.25, segmentDurationsSec[index + 1] || DEFAULT_SCENE_DURATION_SEC) +
      (transitionDurations[index + 1] || 0) -
      durationSec;
  });

  const audioConcatInputs = segmentPaths.map((_, index) => `[a${index}]`).join("");
  const filterComplex = [
    ...videoInputs,
    ...audioInputs,
    ...transitionFilters,
    `[${currentVideoLabel}]format=yuv420p[v]`,
    `${audioConcatInputs}concat=n=${segmentPaths.length}:v=0:a=1[a]`,
  ].join(";");

  const timeoutMs = Math.min(
    VIDEO_TRANSITION_CONCAT_MAX_TIMEOUT_MS,
    VIDEO_TRANSITION_CONCAT_BASE_TIMEOUT_MS +
      segmentPaths.length * VIDEO_TRANSITION_CONCAT_TIMEOUT_PER_SCENE_MS,
  );

  await runFfmpeg(
    [
      ...inputArgs,
      "-filter_complex",
      filterComplex,
      "-map",
      "[v]",
      "-map",
      "[a]",
      "-c:v",
      "libx264",
      "-preset",
      VIDEO_EXPORT_PRESET,
      "-crf",
      VIDEO_EXPORT_CRF,
      "-tune",
      "stillimage",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      VIDEO_EXPORT_AUDIO_BITRATE,
      "-movflags",
      "+faststart",
      "-avoid_negative_ts",
      "make_zero",
      outputPath,
    ],
    timeoutMs,
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
    errorDebug: null,
    createdAt: now,
    updatedAt: now,
    timeline: normalized,
  };
  await writeBlobJson(getJobPath(job.id), job);
  const sourceSummary = getTimelineSourceSummary(normalized.scenes);
  await logVideoExportJobEvent({
    job,
    action: "video_export_job_created",
    status: "ok",
    message: "Video export job created",
    details: {
      sceneCount: normalized.scenes.length,
      voicedSceneCount: sourceSummary.voiced,
      imageSourceDataCount: sourceSummary.data,
      imageSourceRemoteUrlCount: sourceSummary.remote_url,
      imageSourceWorkspaceAssetCount: sourceSummary.workspace_asset,
      width: normalized.width,
      height: normalized.height,
      fps: normalized.fps,
      transitionPresetId: normalized.transitionPresetId,
    },
  });
  return job;
}

export async function getVideoExportJob(jobId: string) {
  const normalized = jobId.trim();
  if (!normalized || !/^[a-z0-9-]{20,80}$/i.test(normalized)) {
    return null;
  }
  return readBlobJson<VideoExportJob>(getJobPath(normalized));
}

export async function findLatestSuccessfulVideoExportJobForProject(input: {
  projectId: string;
  userEmail?: string | null;
}) {
  const projectId = input.projectId.trim();
  const userEmail = input.userEmail?.trim().toLowerCase() || "";
  if (!projectId) {
    return null;
  }

  const jobs: VideoExportJob[] = [];
  let cursor: string | undefined;
  let scanned = 0;
  try {
    do {
      const page = await listBlobs({
        prefix: `${VIDEO_JOB_PREFIX}/`,
        limit: 100,
        cursor,
      });
      scanned += page.blobs.length;
      for (const blob of page.blobs) {
        if (!blob.pathname.endsWith(".json")) {
          continue;
        }
        const job = await readBlobJson<VideoExportJob>(blob.pathname).catch(() => null);
        if (
          job?.status === "success" &&
          job.projectId === projectId &&
          (!userEmail || job.userEmail === userEmail) &&
          (job.resultUrl || job.downloadUrl)
        ) {
          jobs.push(job);
        }
      }
      cursor = page.cursor;
    } while (cursor && scanned < 500);
  } catch {
    return null;
  }

  return jobs.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] || null;
}

function videoExportProjectKey(projectId: string, userEmail?: string | null) {
  return `${projectId.trim()}\u0000${userEmail?.trim().toLowerCase() || ""}`;
}

export async function findLatestSuccessfulVideoExportJobsForProjects(
  inputs: Array<{
    projectId: string;
    userEmail?: string | null;
  }>,
) {
  const targets = new Map<string, { projectId: string; userEmail: string }>();
  for (const input of inputs) {
    const projectId = input.projectId.trim();
    if (!projectId) {
      continue;
    }
    const userEmail = input.userEmail?.trim().toLowerCase() || "";
    targets.set(videoExportProjectKey(projectId, userEmail), { projectId, userEmail });
  }
  const latestByTarget = new Map<string, VideoExportJob>();
  if (!targets.size) {
    return latestByTarget;
  }

  let cursor: string | undefined;
  let scanned = 0;
  try {
    do {
      const page = await listBlobs({
        prefix: `${VIDEO_JOB_PREFIX}/`,
        limit: 100,
        cursor,
      });
      scanned += page.blobs.length;
      for (const blob of page.blobs) {
        if (!blob.pathname.endsWith(".json")) {
          continue;
        }
        const job = await readBlobJson<VideoExportJob>(blob.pathname).catch(() => null);
        if (job?.status !== "success" || !job.projectId || !(job.resultUrl || job.downloadUrl)) {
          continue;
        }
        const directKey = videoExportProjectKey(job.projectId, job.userEmail);
        const projectOnlyKey = videoExportProjectKey(job.projectId);
        const targetKey = targets.has(directKey) ? directKey : targets.has(projectOnlyKey) ? projectOnlyKey : "";
        if (!targetKey) {
          continue;
        }
        const current = latestByTarget.get(targetKey);
        if (!current || job.updatedAt.localeCompare(current.updatedAt) > 0) {
          latestByTarget.set(targetKey, job);
        }
      }
      cursor = page.cursor;
    } while (cursor && scanned < 500);
  } catch {
    return latestByTarget;
  }

  return latestByTarget;
}

export async function runVideoExportJob(jobId: string) {
  let job = await getVideoExportJob(jobId);
  if (!job || job.status !== "queued") {
    return;
  }
  const tmpDir = path.join(os.tmpdir(), `knowlens-video-${job.id}`);
  const jobStartedAt = Date.now();
  try {
    await fs.mkdir(tmpDir, { recursive: true });
    job = await updateJob(job, {
      status: "running",
      step: "tts",
      progress: 2,
      message: `Generating 0/${job.totalScenes}`,
    });
    await logVideoExportJobEvent({
      job,
      action: "video_export_job_started",
      status: "ok",
      message: "Video export job started",
      details: {
        tmpDir: "$TMPDIR",
        sceneCount: job.totalScenes,
        width: job.timeline.width,
        height: job.timeline.height,
        fps: job.timeline.fps,
      },
    });

    const segmentPaths: string[] = [];
    const segmentDurationsSec: number[] = [];
    for (let index = 0; index < job.timeline.scenes.length; index += 1) {
      const scene = job.timeline.scenes[index];
      const sceneStartedAt = Date.now();
      job = await updateJob(job, {
        step: "tts",
        currentScene: index + 1,
        progress: Math.min(65, Math.round(((index + 0.15) / job.totalScenes) * 70)),
        message: `Generating ${index + 1}/${job.totalScenes}`,
      });
      await logVideoExportJobEvent({
        job,
        action: "video_export_scene_started",
        status: "ok",
        message: `Scene ${index + 1}/${job.totalScenes} started`,
        details: {
          sceneIndex: index,
          scenePage: scene.page,
          sceneId: scene.id,
          hasNarration: Boolean(scene.narrationText?.trim()),
          narrationChars: scene.narrationText?.trim().length || 0,
          imageSourceKind: getImageSourceKind(scene.imageUrl),
        },
      });
      const imagePath = await writeSceneImage(scene, tmpDir, index, job.userEmail);
      await logVideoExportJobEvent({
        job,
        action: "video_export_scene_image_ready",
        status: "ok",
        message: `Scene ${index + 1}/${job.totalScenes} image ready`,
        details: {
          sceneIndex: index,
          scenePage: scene.page,
          sceneId: scene.id,
          imageSourceKind: getImageSourceKind(scene.imageUrl),
          durationMs: Date.now() - sceneStartedAt,
        },
      });
      const audioPath = await writeSceneAudio(scene, tmpDir, index);
      await logVideoExportJobEvent({
        job,
        action: audioPath ? "video_export_scene_audio_ready" : "video_export_scene_audio_skipped",
        status: "ok",
        message: audioPath
          ? `Scene ${index + 1}/${job.totalScenes} audio ready`
          : `Scene ${index + 1}/${job.totalScenes} audio skipped`,
        details: {
          sceneIndex: index,
          scenePage: scene.page,
          sceneId: scene.id,
          hasNarration: Boolean(scene.narrationText?.trim()),
          narrationChars: scene.narrationText?.trim().length || 0,
          ttsId: scene.ttsId || null,
          durationMs: Date.now() - sceneStartedAt,
        },
      });
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
      const segmentDurationSec = await getMediaDurationSec(
        segmentPath,
        scene.isCover ? COVER_SCENE_DURATION_SEC : DEFAULT_SCENE_DURATION_SEC,
      );
      segmentPaths.push(segmentPath);
      segmentDurationsSec.push(segmentDurationSec);
      await logVideoExportJobEvent({
        job,
        action: "video_export_scene_segment_ready",
        status: "ok",
        message: `Scene ${index + 1}/${job.totalScenes} segment ready`,
        details: {
          sceneIndex: index,
          scenePage: scene.page,
          sceneId: scene.id,
          durationSec: segmentDurationSec,
          durationMs: Date.now() - sceneStartedAt,
        },
      });
    }

    job = await updateJob(job, {
      step: "render",
      progress: 88,
      message: "Rendering video",
    });
    const transitions = buildExportSceneTransitions({
      scenes: job.timeline.scenes,
      fps: job.timeline.fps,
      transitionPresetId: job.timeline.transitionPresetId,
    });
    await logVideoExportJobEvent({
      job,
      action: "video_export_concat_started",
      status: "ok",
      message: "Video concat started",
      details: {
        segmentCount: segmentPaths.length,
        transitionPresetId: job.timeline.transitionPresetId,
        transitionCount: transitions.length,
        transitionTypes: countTransitionsByType(transitions),
      },
    });
    const outputPath = path.join(tmpDir, "knowlens-storyboard.mp4");
    if (transitions.length) {
      try {
        await concatSegmentsWithTransitions({
          segmentPaths,
          segmentDurationsSec,
          transitions,
          fps: job.timeline.fps,
          outputPath,
        });
      } catch (error) {
        await logVideoExportJobEvent({
          job,
          action: "video_export_transition_concat_fallback",
          status: "error",
          code: "VIDEO_TRANSITION_CONCAT_FAILED",
          message: "Transition concat failed; retrying with simple fade transitions.",
          details: {
            transitionPresetId: job.timeline.transitionPresetId,
            segmentCount: segmentPaths.length,
            transitionCount: transitions.length,
            transitionTypes: countTransitionsByType(transitions),
            error: getProcessErrorMessage(error),
          },
        });
        const fadeTransitions = transitions.map((transition) => ({
          ...transition,
          type: "fade" as const,
          durationSeconds: Math.max(
            MIN_VISIBLE_TRANSITION_DURATION_SEC,
            Math.min(
              MAX_VISIBLE_TRANSITION_DURATION_SEC,
              transition.durationSeconds || MIN_VISIBLE_TRANSITION_DURATION_SEC,
            ),
          ),
        }));
        try {
          await concatSegmentsWithTransitions({
            segmentPaths,
            segmentDurationsSec,
            transitions: fadeTransitions,
            fps: job.timeline.fps,
            outputPath,
          });
          await logVideoExportJobEvent({
            job,
            action: "video_export_transition_concat_fade_fallback",
            status: "ok",
            message: "Transition concat recovered with fade transitions.",
            details: {
              transitionPresetId: job.timeline.transitionPresetId,
              segmentCount: segmentPaths.length,
              transitionCount: fadeTransitions.length,
            },
          });
        } catch (fadeError) {
          await logVideoExportJobEvent({
            job,
            action: "video_export_transition_concat_failed",
            status: "error",
            code: "VIDEO_TRANSITION_FADE_FALLBACK_FAILED",
            message: "Fade transition concat failed.",
            details: {
              transitionPresetId: job.timeline.transitionPresetId,
              segmentCount: segmentPaths.length,
              transitionCount: fadeTransitions.length,
              error: getProcessErrorMessage(fadeError),
            },
          });
          await logVideoExportJobEvent({
            job,
            action: "video_export_transition_concat_plain_fallback",
            status: "info",
            code: "VIDEO_TRANSITION_PLAIN_FALLBACK",
            message: "Fade transition concat failed; retrying without transitions.",
            details: {
              transitionPresetId: job.timeline.transitionPresetId,
              segmentCount: segmentPaths.length,
              transitionCount: fadeTransitions.length,
              error: getProcessErrorMessage(fadeError),
            },
          });
          await concatSegments(segmentPaths, outputPath, job.timeline.fps);
          await logVideoExportJobEvent({
            job,
            action: "video_export_transition_concat_plain_recovered",
            status: "ok",
            message: "Video concat recovered without transitions.",
            details: {
              transitionPresetId: job.timeline.transitionPresetId,
              segmentCount: segmentPaths.length,
            },
          });
        }
      }
    } else {
      await concatSegments(segmentPaths, outputPath, job.timeline.fps);
    }
    const data = await fs.readFile(outputPath);
    if (data.length <= 0) {
      throw new Error("Rendered video is empty.");
    }
    await logVideoExportJobEvent({
      job,
      action: "video_export_concat_ready",
      status: "ok",
      message: "Video concat ready",
      details: {
        bytes: data.length,
        transitionPresetId: job.timeline.transitionPresetId,
        transitionCount: transitions.length,
        transitionTypes: countTransitionsByType(transitions),
        durationMs: Date.now() - jobStartedAt,
      },
    });

    job = await updateJob(job, {
      step: "upload",
      progress: 96,
      message: "Uploading video",
    });
    await logVideoExportJobEvent({
      job,
      action: "video_export_upload_started",
      status: "ok",
      message: "Video upload started",
      details: {
        bytes: data.length,
      },
    });
    const blob = await putBlob(`${VIDEO_OUTPUT_PREFIX}/${job.id}.mp4`, data, {
      access: "public",
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: "video/mp4",
    });
    const completedJob = job;
    await updateJob(job, {
      status: "success",
      step: "done",
      progress: 100,
      message: "Ready",
      resultUrl: blob.url,
      downloadUrl: blob.downloadUrl || blob.url,
      size: data.length,
    });
    const publicCaseLink = await linkVideoExportToPublishedCases({
      projectId: completedJob.projectId,
      userEmail: completedJob.userEmail,
      resultUrl: blob.url,
      downloadUrl: blob.downloadUrl || blob.url,
      jobId: completedJob.id,
      title: completedJob.timeline.scenes[0]?.title || null,
      contentType: "video/mp4",
      size: data.length,
      width: completedJob.timeline.width,
      height: completedJob.timeline.height,
    }).catch((error) => {
      console.error("[video-export-public-case-link-failed]", {
        jobId: completedJob.id,
        projectId: completedJob.projectId,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return { linked: 0 };
    });
    await logVideoExportJobEvent({
      job: {
        ...job,
        step: "done",
        progress: 100,
      },
      action: "video_export_job_success",
      status: "ok",
      message: "Video export job completed",
      details: {
        scenes: job.totalScenes,
        bytes: data.length,
        resultUrl: blob.url,
        linkedPublicVideoCases: publicCaseLink.linked,
        durationMs: Date.now() - jobStartedAt,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "MP4 export failed";
    const errorDebug = message.trim().slice(0, 1800) || "Unknown video export error";
    if (job) {
      await updateJob(job, {
        status: "error",
        step: job.step === "queued" ? "tts" : job.step,
        progress: 0,
        message: "MP4 export failed. Please retry.",
        error: "MP4 export failed. Please retry.",
        errorDebug,
      }).catch(() => undefined);
    }
    console.error("[video-export-job-failed]", {
      jobId,
      projectId: job?.projectId || null,
      step: job?.step || "queued",
      currentScene: job?.currentScene || 0,
      totalScenes: job?.totalScenes || 0,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: errorDebug,
    });
    await logVideoExportJobEvent({
      job: job || {
        id: jobId,
        userEmail: null,
        projectId: null,
        step: "queued",
        progress: 0,
        currentScene: 0,
        totalScenes: 0,
      },
      action: "video_export_job_failed",
      status: "error",
      code: "VIDEO_EXPORT_JOB_FAILED",
      message,
      details: {
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: errorDebug,
        durationMs: Date.now() - jobStartedAt,
      },
    });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
