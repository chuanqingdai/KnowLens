import { createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { fetchTranscript } from "youtube-transcript";
import JSZip from "jszip";
import ytdl from "ytdl-core";
import Parser from "rss-parser";
import ffmpegStatic from "ffmpeg-static";
import { createUploadJob, updateUploadJob } from "./store";

const execFileAsync = promisify(execFile);
const rssParser = new Parser();

export const MAX_UPLOAD_SIZE_BYTES = 80 * 1024 * 1024;
export const MAX_TEXT_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_CONCURRENCY = 3;
export const MAX_UPLOAD_RETRIES = 3;
const MAX_MEDIA_TRANSCRIBE_BYTES = 120 * 1024 * 1024;
const DEFAULT_UPLOAD_WORKER_TIMEOUT_MS = 180000;

export type UploadSourceKind = "file" | "web" | "youtube" | "podcast";

export type EnqueuedUpload = {
  jobId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  sourceKind: UploadSourceKind;
};

type WorkerResult = {
  storageKey?: string;
  publicUrl?: string;
  excerpt?: string;
  text?: string;
  kind?: string;
  title?: string;
  sourceUrl?: string;
};

const allowedMimePrefixes = [
  "text/",
  "image/",
  "audio/",
  "video/",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

function safeTrim(value: string | undefined | null, max = 2000) {
  return (value ?? "").trim().slice(0, max);
}

function parseIntEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const value = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function cleanText(value: string) {
  return value
    .replace(/\u0000/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function ensureAudioMime(mimeType: string, fileName: string) {
  if (mimeType.startsWith("audio/")) {
    return mimeType;
  }
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".wav") return "audio/wav";
  if (ext === ".m4a") return "audio/mp4";
  if (ext === ".ogg") return "audio/ogg";
  return "audio/mpeg";
}

function parseYoutubeVideoId(input: string) {
  try {
    const url = new URL(input);
    const host = url.hostname.replace(/^www\./, "");
    if (host.includes("youtu.be")) {
      const id = url.pathname.replace("/", "").trim();
      return id || null;
    }
    if (host.includes("youtube.com")) {
      const id = url.searchParams.get("v")?.trim();
      return id || null;
    }
  } catch {
    return null;
  }
  return null;
}

export function validateUploadFile(file: { name: string; type: string; size: number }) {
  if (!file.name.trim()) {
    return { ok: false, reason: "文件名不能为空" };
  }
  if (file.size <= 0) {
    return { ok: false, reason: "文件内容为空" };
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return { ok: false, reason: "文件过大，请压缩后再试" };
  }
  if (!allowedMimePrefixes.some((prefix) => file.type.startsWith(prefix))) {
    return { ok: false, reason: "暂不支持当前文件类型" };
  }
  return { ok: true as const };
}

export function enqueueUpload(input: {
  userScope: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  sourceKind: UploadSourceKind;
  sourceUrl?: string;
  inputPath?: string;
  sourceText?: string;
}) {
  const jobId = createUploadJob({
    userScope: input.userScope,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    sourceKind: input.sourceKind,
    sourceUrl: input.sourceUrl,
    inputPath: input.inputPath,
    sourceText: input.sourceText,
  });
  return {
    jobId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    sourceKind: input.sourceKind,
  } satisfies EnqueuedUpload;
}

function isLikelyTimeoutMessage(message: string) {
  return /timed out/i.test(message);
}

function classifyUploadWorkerError(message: string) {
  const normalized = message.toLowerCase();

  if (isLikelyTimeoutMessage(message)) {
    return { code: "UPLOAD_WORKER_TIMEOUT", retryable: true };
  }
  if (
    normalized.includes("requires openai_api_key") ||
    normalized.includes("missing paid model api key") ||
    normalized.includes("missing image2 provider api key")
  ) {
    return { code: "UPLOAD_PROVIDER_NOT_CONFIGURED", retryable: false };
  }
  if (
    normalized.includes("missing uploaded file path") ||
    normalized.includes("missing url") ||
    normalized.includes("invalid youtube url") ||
    normalized.includes("failed to parse url")
  ) {
    return { code: "UPLOAD_INPUT_INVALID", retryable: false };
  }
  if (normalized.includes("too large for transcription")) {
    return { code: "UPLOAD_INPUT_TOO_LARGE", retryable: false };
  }
  if (/web fetch failed:\s*4\d\d/i.test(message)) {
    return { code: "UPLOAD_SOURCE_FETCH_4XX", retryable: false };
  }
  if (
    normalized.includes("fetch failed") ||
    normalized.includes("network") ||
    normalized.includes("econnreset") ||
    normalized.includes("enotfound")
  ) {
    return { code: "UPLOAD_NETWORK_FAILURE", retryable: true };
  }

  return { code: "UPLOAD_WORKER_FAILED", retryable: true };
}

export async function runUploadJob(jobId: string, worker: () => Promise<WorkerResult>) {
  updateUploadJob(jobId, { status: "processing", progress: 8, attempts: 1 });
  const workerTimeoutMs = parseIntEnv("UPLOAD_WORKER_TIMEOUT_MS", DEFAULT_UPLOAD_WORKER_TIMEOUT_MS);
  let attempt = 1;
  while (attempt <= MAX_UPLOAD_RETRIES) {
    try {
      updateUploadJob(jobId, { attempts: attempt, progress: Math.min(20 + attempt * 15, 65) });
      const result = await withTimeout(
        worker(),
        workerTimeoutMs,
        `Upload worker timed out after ${Math.round(workerTimeoutMs / 1000)}s`,
      );
      updateUploadJob(jobId, {
        status: "done",
        progress: 100,
        storageKey: result.storageKey ?? null,
        publicUrl: result.publicUrl ?? null,
        errorMessage: null,
        errorCode: null,
        resultExcerpt: result.excerpt ?? null,
        resultText: result.text ?? null,
        resultKind: result.kind ?? null,
        sourceUrl: result.sourceUrl ?? null,
      });
      return { ok: true as const, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload worker failed";
      const classified = classifyUploadWorkerError(message);
      if (!classified.retryable || attempt >= MAX_UPLOAD_RETRIES) {
        updateUploadJob(jobId, {
          status: "failed",
          progress: 100,
          errorMessage: message,
          errorCode: classified.code,
        });
        return { ok: false as const, error: message };
      }
      attempt += 1;
      updateUploadJob(jobId, {
        status: "processing",
        progress: Math.min(15 + attempt * 10, 80),
        errorMessage: `${message}. Retrying...`,
        errorCode: "UPLOAD_WORKER_RETRY",
      });
    }
  }
  return { ok: false as const, error: "Upload worker failed" };
}

export async function buildUploadWorkerResult(input: {
  jobId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  sourceKind: UploadSourceKind;
  sourceUrl?: string;
  inputPath?: string;
  sourceText?: string;
}) {
  const normalizedKind = detectSourceKind(input);
  const sourceText = safeTrim(input.sourceText, 12000);

  if (sourceText) {
    return resultFromText(input, normalizedKind, sourceText);
  }

  if (normalizedKind === "web") {
    return resultFromText(input, normalizedKind, await extractWebText(input.sourceUrl ?? ""));
  }

  if (normalizedKind === "youtube") {
    return resultFromText(input, normalizedKind, await extractYoutubeContent(input.sourceUrl ?? ""));
  }

  if (normalizedKind === "podcast") {
    return resultFromText(input, normalizedKind, await extractPodcastContent(input.sourceUrl ?? ""));
  }

  if (!input.inputPath) {
    throw new Error("Missing uploaded file path");
  }

  return resultFromText(
    input,
    "file",
    await extractFileText({
      filePath: input.inputPath,
      fileName: input.fileName,
      mimeType: input.mimeType,
    }),
  );
}

function detectSourceKind(input: {
  sourceKind: UploadSourceKind;
  sourceUrl?: string;
}) {
  if (input.sourceKind !== "file") {
    return input.sourceKind;
  }
  if (!input.sourceUrl) {
    return "file";
  }
  const url = input.sourceUrl.toLowerCase();
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return "youtube";
  }
  if (
    url.includes("podcasts.apple.com") ||
    url.includes("open.spotify.com") ||
    url.includes("anchor.fm") ||
    url.includes("castbox.fm") ||
    url.includes("overcast.fm") ||
    url.includes("pocketcasts.com")
  ) {
    return "podcast";
  }
  return "web";
}

function resultFromText(
  input: {
    fileName: string;
    sourceUrl?: string;
    inputPath?: string;
  },
  kind: string,
  text: string,
): WorkerResult {
  const clean = cleanText(safeTrim(text, 12000));
  return {
    kind,
    title: input.fileName,
    text: clean,
    excerpt: clean.slice(0, 900) || `Parsed ${input.fileName}`,
    sourceUrl: input.sourceUrl,
    storageKey: input.inputPath,
    publicUrl: input.sourceUrl,
  };
}

async function extractFileText(input: { filePath: string; fileName: string; mimeType: string }) {
  const ext = path.extname(input.fileName).toLowerCase();
  if (
    input.mimeType.startsWith("text/") ||
    [".txt", ".md", ".csv", ".tsv", ".json", ".xml", ".srt", ".vtt"].includes(ext)
  ) {
    return cleanText(await fs.readFile(input.filePath, "utf8"));
  }

  if (input.mimeType === "application/pdf" || ext === ".pdf") {
    const parser = new PDFParse({ data: await fs.readFile(input.filePath) });
    const result = await parser.getText();
    await parser.destroy();
    return cleanText(result.text ?? "");
  }

  if (ext === ".docx" || input.mimeType.includes("wordprocessingml")) {
    const result = await mammoth.extractRawText({ path: input.filePath });
    return cleanText(result.value ?? "");
  }

  if (ext === ".pptx" || input.mimeType.includes("presentationml")) {
    return extractPptxText(input.filePath);
  }

  if (input.mimeType.startsWith("image/")) {
    return extractImageText(input.filePath, input.fileName, input.mimeType);
  }

  if (input.mimeType.startsWith("audio/") || input.mimeType.startsWith("video/")) {
    return extractMediaText(input.filePath, input.fileName, input.mimeType);
  }

  return cleanText(await fs.readFile(input.filePath, "utf8"));
}

async function extractPptxText(filePath: string) {
  const buffer = await fs.readFile(filePath);
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const texts: string[] = [];
  for (const slideFile of slideFiles) {
    const xml = await zip.file(slideFile)?.async("string");
    if (!xml) {
      continue;
    }
    const slideText = xml
      .replace(/<a:t>(.*?)<\/a:t>/g, (_, text: string) => `${text} `)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (slideText) {
      texts.push(slideText);
    }
  }
  return cleanText(texts.join("\n\n"));
}

async function extractWebText(url: string) {
  if (!url) {
    throw new Error("Missing URL");
  }
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`Web fetch failed: ${response.status}`);
  }
  const html = await response.text();
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim();
  const textBlocks = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleanText([title, textBlocks].filter(Boolean).join("\n"));
}

async function extractYoutubeContent(url: string) {
  let transcript = "";
  try {
    const videoId = parseYoutubeVideoId(url);
    if (!videoId) {
      throw new Error("Invalid YouTube URL");
    }
    const segments = await fetchTranscript(videoId);
    transcript = cleanText(segments.map((item) => item.text).join(" "));
  } catch {
    transcript = "";
  }

  if (transcript) {
    return transcript;
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("YouTube transcript fallback requires OPENAI_API_KEY.");
  }

  const downloaded = await downloadYoutubeAudio(url);
  if (!downloaded) {
    throw new Error("YouTube transcript extraction failed");
  }
  try {
    return await extractMediaText(downloaded.filePath, downloaded.fileName, downloaded.mimeType);
  } finally {
    await fs.unlink(downloaded.filePath).catch(() => undefined);
  }
}

async function downloadYoutubeAudio(url: string) {
  if (!ytdl.validateURL(url)) {
    return null;
  }
  const filePath = path.join("/tmp", `knowlens-youtube-${Date.now()}.m4a`);
  const stream = ytdl(url, { quality: "lowestaudio", filter: "audioonly", highWaterMark: 1 << 20 });
  let downloaded = 0;
  stream.on("data", (chunk: Buffer) => {
    downloaded += chunk.length;
    if (downloaded > MAX_MEDIA_TRANSCRIBE_BYTES) {
      stream.destroy(new Error("YouTube audio exceeds transcript size limit"));
    }
  });
  await pipeline(stream, createWriteStream(filePath));
  return {
    filePath,
    fileName: "youtube-audio.m4a",
    mimeType: "audio/mp4",
  };
}

async function extractPodcastContent(url: string) {
  const candidates: string[] = [url];
  const feedTextParts: string[] = [];
  const hasTranscribeApiKey = Boolean(process.env.OPENAI_API_KEY?.trim());

  if (!hasTranscribeApiKey) {
    throw new Error("Podcast transcript extraction requires OPENAI_API_KEY.");
  }

  try {
    const feed = await rssParser.parseURL(url);
    if (feed.title) {
      feedTextParts.push(feed.title);
    }
    if (feed.description) {
      feedTextParts.push(feed.description);
    }
    for (const item of feed.items.slice(0, 3)) {
      if (item.title) feedTextParts.push(item.title);
      if (item.contentSnippet) feedTextParts.push(item.contentSnippet);
      const enclosure = (item as { enclosure?: { url?: string } }).enclosure?.url;
      if (enclosure) {
        candidates.push(enclosure);
      }
      if (item.link) {
        candidates.push(item.link);
      }
    }
  } catch {
    // Ignore RSS parse failures and fallback to raw page text.
  }

  for (const candidate of candidates) {
    const downloadable = await tryDownloadAudio(candidate);
    if (!downloadable) {
      continue;
    }
    try {
      const transcript = await extractMediaText(downloadable.filePath, downloadable.fileName, downloadable.mimeType);
      const combined = cleanText([transcript, ...feedTextParts].filter(Boolean).join("\n"));
      if (combined) {
        return combined;
      }
    } finally {
      await fs.unlink(downloadable.filePath).catch(() => undefined);
    }
  }

  const fallback = await extractWebText(url);
  const combined = cleanText([fallback, ...feedTextParts].filter(Boolean).join("\n"));
  if (!combined) {
    throw new Error("Podcast extraction failed");
  }
  return combined;
}

async function tryDownloadAudio(url: string) {
  if (!url) {
    return null;
  }
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
  });
  if (!response.ok || !response.body) {
    return null;
  }
  const contentType = response.headers.get("content-type") ?? "";
  const pathname = (() => {
    try {
      return new URL(response.url).pathname;
    } catch {
      return "";
    }
  })();
  const ext = path.extname(pathname).toLowerCase();
  const looksAudio =
    contentType.startsWith("audio/") ||
    [".mp3", ".m4a", ".aac", ".wav", ".ogg", ".flac"].includes(ext);
  if (!looksAudio) {
    return null;
  }
  const fileName = path.basename(pathname) || `podcast-${Date.now()}.mp3`;
  const filePath = path.join("/tmp", `knowlens-podcast-${Date.now()}-${fileName}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_MEDIA_TRANSCRIBE_BYTES) {
    return null;
  }
  await fs.writeFile(filePath, bytes);
  return {
    filePath,
    fileName,
    mimeType: ensureAudioMime(contentType, fileName),
  };
}

async function extractImageText(filePath: string, fileName: string, mimeType: string) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return `Image uploaded: ${fileName}. OCR requires configured model access in this environment.`;
  }
  const bytes = await fs.readFile(filePath);
  const dataUrl = `data:${mimeType || "image/png"};base64,${bytes.toString("base64")}`;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini",
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract all readable text from this image. Keep structure concise." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Image OCR failed: ${message.slice(0, 200)}`);
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("Image OCR returned empty text");
  }
  return cleanText(text);
}

async function extractMediaText(filePath: string, fileName: string, mimeType: string) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return `Media uploaded: ${fileName}. Transcription requires configured model access in this environment.`;
  }

  let transcribePath = filePath;
  let transcribeName = fileName;
  let transcribeMime = mimeType;
  let temporaryExtractedAudioPath: string | null = null;

  if (mimeType.startsWith("video/")) {
    temporaryExtractedAudioPath = path.join("/tmp", `knowlens-audio-${Date.now()}.wav`);
    await extractAudioFromVideo(filePath, temporaryExtractedAudioPath);
    transcribePath = temporaryExtractedAudioPath;
    transcribeName = `${path.basename(fileName, path.extname(fileName))}.wav`;
    transcribeMime = "audio/wav";
  }

  try {
    const bytes = await fs.readFile(transcribePath);
    if (bytes.length > MAX_MEDIA_TRANSCRIBE_BYTES) {
      throw new Error("Media is too large for transcription");
    }
    const formData = new FormData();
    formData.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe");
    formData.append("language", "auto");
    formData.append(
      "file",
      new File([bytes], transcribeName, {
        type: ensureAudioMime(transcribeMime, transcribeName),
      }),
    );

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Transcription failed: ${message.slice(0, 200)}`);
    }
    const payload = (await response.json()) as { text?: string };
    if (!payload.text?.trim()) {
      throw new Error("Transcription returned empty text");
    }
    return cleanText(payload.text);
  } finally {
    if (temporaryExtractedAudioPath) {
      await fs.unlink(temporaryExtractedAudioPath).catch(() => undefined);
    }
  }
}

async function extractAudioFromVideo(videoPath: string, audioPath: string) {
  if (!ffmpegStatic) {
    throw new Error("Video transcription requires ffmpeg runtime");
  }
  await execFileAsync(ffmpegStatic, [
    "-y",
    "-i",
    videoPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-f",
    "wav",
    audioPath,
  ]);
}
