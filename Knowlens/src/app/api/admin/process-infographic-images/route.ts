import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import {
  getProcessInfographicTemplates,
  type ProcessInfographicTemplate,
} from "@/lib/process-infographic-templates";
import {
  buildImage2ProviderConfig,
  requestImage2Generation,
  resolveImage2Size,
} from "@/lib/server/image2";

export const runtime = "nodejs";
export const maxDuration = 360;

const batchId = "process-infographic-tuzi-100";
const batchTopic = "Process Infographic";
const batchSize = 20;
const providerTimeoutMs = 360_000;
const publicDir = path.join(process.cwd(), "public/images/infographic/process");
const manifestPath = path.join(process.cwd(), "src/lib/process-infographic-generated-images.json");

type ManifestRecord = Record<string, unknown> & {
  slug: string;
  generationStatus: "success" | "failed" | "skipped";
};

type BatchGenerationJob = {
  id: string;
  topicInput: string;
  categorySlug: "process";
  categoryName: "Process";
  totalRequested: 100;
  aspectRatioPlan: { "16:9": 5; "9:16": 95 };
  provider: "tuzi";
  batchSize: 20;
  forceFreshGeneration: true;
  disableImageCache: true;
  status: "pending" | "generating_topics" | "generating_images" | "saving_images" | "creating_records" | "updating_sitemap" | "completed" | "partial_completed" | "failed";
  requestedCount: number;
  successCount: number;
  failedCount: number;
  createdPageCount: number;
  errors: Array<{ itemIndex: number; topicName?: string; reason: string }>;
  createdTemplateIds: string[];
  createdAt: string;
  updatedAt: string;
};

type Manifest = {
  id: string;
  batchId: string;
  batchTopic: string;
  generationProvider: "tuzi";
  updatedAt: string;
  job: BatchGenerationJob;
  templates: Record<string, ManifestRecord>;
  errors: Array<{ slug: string; title: string; itemIndex: number; reason: string; updatedAt: string }>;
  sourceUrls: Record<string, string[]>;
};

function isLocalOnly(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return false;
  const host = req.headers.get("host") || "";
  return host.startsWith("127.0.0.1") || host.startsWith("localhost");
}

function createJob(now: string): BatchGenerationJob {
  return {
    id: batchId,
    topicInput: "Process",
    categorySlug: "process",
    categoryName: "Process",
    totalRequested: 100,
    aspectRatioPlan: { "16:9": 5, "9:16": 95 },
    provider: "tuzi",
    batchSize,
    forceFreshGeneration: true,
    disableImageCache: true,
    status: "pending",
    requestedCount: 100,
    successCount: 0,
    failedCount: 0,
    createdPageCount: 0,
    errors: [],
    createdTemplateIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

async function readManifest(): Promise<Manifest> {
  const now = new Date().toISOString();
  try {
    const parsed = JSON.parse(await readFile(manifestPath, "utf8")) as Partial<Manifest>;
    return {
      id: parsed.id || batchId,
      batchId: parsed.batchId || batchId,
      batchTopic: parsed.batchTopic || batchTopic,
      generationProvider: "tuzi",
      updatedAt: parsed.updatedAt || now,
      job: { ...createJob(now), ...(parsed.job || {}), batchSize },
      templates: parsed.templates || {},
      errors: Array.isArray(parsed.errors) ? parsed.errors : [],
      sourceUrls: parsed.sourceUrls || {},
    };
  } catch {
    return {
      id: batchId,
      batchId,
      batchTopic,
      generationProvider: "tuzi",
      updatedAt: now,
      job: createJob(now),
      templates: {},
      errors: [],
      sourceUrls: {},
    };
  }
}

async function writeManifest(manifest: Manifest) {
  const templates = getProcessInfographicTemplates();
  const successRecords = Object.values(manifest.templates).filter((item) => item.generationStatus === "success");
  manifest.updatedAt = new Date().toISOString();
  manifest.job.successCount = successRecords.length;
  manifest.job.failedCount = manifest.errors.length;
  manifest.job.createdPageCount = successRecords.length;
  manifest.job.createdTemplateIds = successRecords.map((record) => String(record.id || "")).filter(Boolean);
  manifest.job.errors = manifest.errors.map((error) => ({
    itemIndex: error.itemIndex,
    topicName: error.title,
    reason: error.reason,
  }));
  manifest.job.status =
    manifest.job.successCount >= templates.length
      ? "completed"
      : manifest.job.successCount > 0 || manifest.job.failedCount > 0
        ? "partial_completed"
        : manifest.job.status;
  manifest.job.updatedAt = manifest.updatedAt;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function requestMeta(slug: string) {
  const timestamp = new Date().toISOString();
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const requestId = `${batchId}-${slug}-${nonce}`;
  return {
    requestId,
    timestamp,
    nonce,
    extraBody: {
      requestId,
      request_id: requestId,
      nonce,
      timestamp,
      no_cache: true,
      force_generate: true,
      bypass_cache: true,
      disable_cache: true,
    },
  };
}

async function downloadImageBytes(sourceUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(sourceUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { Accept: "image/*,*/*;q=0.8" },
    });
    if (!response.ok) throw new Error(`download failed ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length) throw new Error("download returned empty bytes");
    return bytes;
  } finally {
    clearTimeout(timeout);
  }
}

function buildRecord(template: ProcessInfographicTemplate, image: {
  imageFilename: string;
  previewImagePath: string;
  previewImageUrl: string;
  storageKey: string;
  imageWidth: number;
  imageHeight: number;
  imageSizeBytes: number;
  tuziRequestId: string;
  generationStartedAt: string;
  generationCompletedAt: string;
}): ManifestRecord {
  return {
    ...template,
    batchId,
    batchTopic,
    generationProvider: "tuzi",
    generationStatus: "success",
    tuziRequestId: image.tuziRequestId,
    sourceType: "tuzi_generated",
    cacheBypassed: true,
    isFreshGeneration: true,
    generationStartedAt: image.generationStartedAt,
    generationCompletedAt: image.generationCompletedAt,
    previewImagePath: image.previewImagePath,
    previewImageUrl: image.previewImageUrl,
    storageKey: image.storageKey,
    imageFilename: image.imageFilename,
    imageFormat: "webp",
    imageMimeType: "image/webp",
    imageWidth: image.imageWidth,
    imageHeight: image.imageHeight,
    imageSizeBytes: image.imageSizeBytes,
    updatedAt: image.generationCompletedAt,
    allowPublicDownload: false,
  };
}

export async function GET(req: NextRequest) {
  if (!isLocalOnly(req)) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  const manifest = await readManifest();
  const templates = getProcessInfographicTemplates();
  const generated = Object.values(manifest.templates).filter((item) => item.generationStatus === "success").length;
  return NextResponse.json({
    ok: true,
    batchId,
    total: templates.length,
    generated,
    failed: manifest.errors.length,
    missing: templates.filter((item) => manifest.templates[item.slug]?.generationStatus !== "success").length,
    job: manifest.job,
  });
}

export async function POST(req: NextRequest) {
  if (!isLocalOnly(req)) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as { offset?: number; limit?: number; force?: boolean };
  const offset = Math.max(0, Math.round(Number(body.offset || 0)));
  const limit = Math.max(1, Math.min(batchSize, Math.round(Number(body.limit || batchSize))));
  const force = Boolean(body.force);
  const config = buildImage2ProviderConfig("tuzi");
  if (!config) {
    return NextResponse.json({ ok: false, error: "Missing tuzi image provider config in the running Next server environment." }, { status: 500 });
  }

  await mkdir(publicDir, { recursive: true });
  const manifest = await readManifest();
  manifest.job.status = "generating_images";
  const templates = getProcessInfographicTemplates().slice(offset, offset + limit);
  const updatedRecords: ManifestRecord[] = [];
  const errors: Array<{ slug: string; title: string; itemIndex: number; reason: string }> = [];

  await Promise.all(templates.map(async (template) => {
    if (!force && manifest.templates[template.slug]?.generationStatus === "success") {
      updatedRecords.push(manifest.templates[template.slug]);
      return;
    }

    let attempt = 0;
    let completed = false;
    const maxAttempts = 1;
    while (attempt < maxAttempts && !completed) {
      attempt += 1;
      const startedAt = new Date().toISOString();
      const meta = requestMeta(template.slug);
      try {
        const result = await requestImage2Generation(config, {
          prompt: template.finalPrompt,
          aspectRatio: template.aspectRatio,
          size: resolveImage2Size(template.aspectRatio),
          extraBody: meta.extraBody,
          timeoutMs: providerTimeoutMs,
        });
        if (!result.ok) {
          throw new Error(`${result.errorCode}: ${result.errorMessage}${result.detail ? ` (${result.detail})` : ""}`);
        }
        const priorUrls = manifest.sourceUrls[template.slug] || [];
        if (priorUrls.includes(result.imageUrl) && attempt < maxAttempts) {
          continue;
        }
        if (priorUrls.includes(result.imageUrl)) {
          throw new Error("suspected provider cache hit: repeated temporary image URL");
        }
        manifest.sourceUrls[template.slug] = [...priorUrls, result.imageUrl].slice(-5);
        const sourceBytes = await downloadImageBytes(result.imageUrl);
        const converted = await sharp(sourceBytes).rotate().webp({ quality: 92 }).toBuffer();
        const metadata = await sharp(converted).metadata();
        const imageFilename = `process-${template.slug}.webp`;
        const storageKey = `infographic/process/${imageFilename}`;
        await writeFile(path.join(publicDir, imageFilename), converted);
        const completedAt = new Date().toISOString();
        const record = buildRecord(template, {
          imageFilename,
          previewImagePath: `/images/infographic/process/${imageFilename}`,
          previewImageUrl: `https://knowlens.ai/images/infographic/process/${imageFilename}`,
          storageKey,
          imageWidth: metadata.width || template.imageWidth,
          imageHeight: metadata.height || template.imageHeight,
          imageSizeBytes: converted.length,
          tuziRequestId: meta.requestId,
          generationStartedAt: startedAt,
          generationCompletedAt: completedAt,
        });
        manifest.templates[template.slug] = record;
        updatedRecords.push(record);
        completed = true;
      } catch (error) {
        if (attempt < maxAttempts) continue;
        const reason = error instanceof Error ? error.message : String(error);
        const itemIndex = getProcessInfographicTemplates().findIndex((item) => item.slug === template.slug) + 1;
        errors.push({ slug: template.slug, title: template.title, itemIndex, reason });
        manifest.errors.push({ slug: template.slug, title: template.title, itemIndex, reason, updatedAt: new Date().toISOString() });
      }
    }
  }));
  await writeManifest(manifest);

  return NextResponse.json({
    ok: errors.length === 0,
    batchId,
    offset,
    limit,
    updatedRecords,
    errors,
    generated: Object.values(manifest.templates).filter((item) => item.generationStatus === "success").length,
    total: getProcessInfographicTemplates().length,
    job: manifest.job,
  }, { status: errors.length ? 207 : 200 });
}
