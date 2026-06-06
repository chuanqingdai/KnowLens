import { randomUUID } from "node:crypto";
import { get as getBlob, put as putBlob } from "@vercel/blob";
import type { OutputLanguage } from "@/lib/language";
import { logOpsEvent } from "@/lib/server/store";
import { hasManagedDatabase, pgGet, pgRun } from "@/lib/server/postgres";

const DRAFT_JOB_PREFIX = "content-draft/jobs";
const DRAFT_BATCH_SIZE = 8;
const memoryDraftJobs = new Map<string, ContentDraftJob>();
let draftJobSchemaReady: Promise<void> | null = null;

export type ContentDraftJobStatus = "queued" | "running" | "success" | "error";
export type ContentDraftJobDirection = "poster" | "ppt" | "video";

export type ContentDraftJobRequest = {
  projectId?: string | null;
  topic?: string;
  prompt?: string;
  textModel?: string;
  posterCount?: number;
  posterSizeLabel?: string;
  direction?: ContentDraftJobDirection;
  normalizedDirection?: ContentDraftJobDirection;
  normalizedCount?: number;
  normalizedRatio?: string;
  draftMode?: "mock" | "auto";
  outputLanguage?: OutputLanguage;
};

type ContentDraftBatch = {
  index: number;
  startIndex: number;
  count: number;
  includeCover: boolean;
  status: "queued" | "running" | "success" | "error";
  error: string | null;
};

export type ContentDraftJob = {
  id: string;
  userEmail: string | null;
  projectId: string | null;
  status: ContentDraftJobStatus;
  progress: number;
  message: string;
  currentBatch: number;
  totalBatches: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  request: ContentDraftJobRequest;
  batches: ContentDraftBatch[];
  result: Record<string, unknown> | null;
};

type DraftRuntimeContext = {
  origin: string;
  cookie?: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function getJobPath(jobId: string) {
  return `${DRAFT_JOB_PREFIX}/${jobId}.json`;
}

function getBlobAccess(): "public" | "private" {
  return process.env.CONTENT_DRAFT_JOB_BLOB_ACCESS === "private" ? "private" : "public";
}

function hasBlobDraftJobStore() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      (process.env.VERCEL_OIDC_TOKEN && (process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN)),
  );
}

function getDraftJobStoreKind(): "database" | "blob" | "memory" | "missing" {
  const preferredStore = (process.env.CONTENT_DRAFT_JOB_STORE || "").trim().toLowerCase();
  if (preferredStore === "database" && hasManagedDatabase()) {
    return "database";
  }
  if (preferredStore === "blob" && hasBlobDraftJobStore()) {
    return "blob";
  }
  if (hasBlobDraftJobStore()) {
    return "blob";
  }
  if (hasManagedDatabase()) {
    return "database";
  }
  if (process.env.NODE_ENV !== "production") {
    return "memory";
  }
  return "missing";
}

async function ensureDraftJobSchema() {
  if (!hasManagedDatabase()) {
    return;
  }
  if (!draftJobSchemaReady) {
    draftJobSchemaReady = pgRun(`
      CREATE TABLE IF NOT EXISTS content_draft_jobs (
        id TEXT PRIMARY KEY,
        user_email TEXT,
        project_id TEXT,
        status TEXT NOT NULL,
        job_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      );
      CREATE INDEX IF NOT EXISTS idx_content_draft_jobs_user_email
        ON content_draft_jobs(user_email, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_content_draft_jobs_project_id
        ON content_draft_jobs(project_id, updated_at DESC);
    `).catch((error) => {
      draftJobSchemaReady = null;
      throw error;
    });
  }
  await draftJobSchemaReady;
}

function createMissingDraftJobStoreError() {
  return new Error(
    "Draft job storage is not configured. Set DATABASE_URL/POSTGRES_URL or BLOB_READ_WRITE_TOKEN locally so Step 3 uses the same durable job flow as production.",
  );
}

function normalizeDirection(value: unknown): ContentDraftJobDirection {
  return value === "ppt" || value === "video" || value === "poster" ? value : "poster";
}

function normalizeCount(value: unknown, direction: ContentDraftJobDirection) {
  const fallback = direction === "poster" ? 1 : 6;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.max(1, Math.min(direction === "poster" ? 10 : 24, Math.round(parsed)));
}

function buildBatches(direction: ContentDraftJobDirection, totalCount: number): ContentDraftBatch[] {
  const batches: ContentDraftBatch[] = [];
  let startIndex = 1;
  let remaining = totalCount;
  while (remaining > 0) {
    const count = Math.min(DRAFT_BATCH_SIZE, remaining);
    batches.push({
      index: batches.length,
      startIndex,
      count,
      includeCover: direction !== "poster" && startIndex === 1,
      status: "queued",
      error: null,
    });
    startIndex += count;
    remaining -= count;
  }
  return batches;
}

async function writeBlobJson(pathname: string, value: unknown) {
  await putBlob(pathname, JSON.stringify(value), {
    access: getBlobAccess(),
    contentType: "application/json; charset=utf-8",
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 0,
  });
}

async function readBlobJson<T>(pathname: string): Promise<T | null> {
  try {
    const blob = await getBlob(pathname, { access: getBlobAccess() });
    if (!blob || blob.statusCode !== 200 || !blob.stream) {
      return null;
    }
    const text = await new Response(blob.stream).text();
    if (!text.trim()) {
      return null;
    }
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function writeJobJson(job: ContentDraftJob) {
  const storeKind = getDraftJobStoreKind();
  if (storeKind === "database") {
    await ensureDraftJobSchema();
    await pgRun(
      `INSERT INTO content_draft_jobs (id, user_email, project_id, status, job_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         user_email = EXCLUDED.user_email,
         project_id = EXCLUDED.project_id,
         status = EXCLUDED.status,
         job_json = EXCLUDED.job_json,
         updated_at = EXCLUDED.updated_at`,
      job.id,
      job.userEmail,
      job.projectId,
      job.status,
      JSON.stringify(job),
      job.createdAt,
      job.updatedAt,
    );
    return;
  }
  if (storeKind === "blob") {
    await writeBlobJson(getJobPath(job.id), job);
    return;
  }
  if (storeKind === "memory") {
    memoryDraftJobs.set(job.id, job);
    return;
  }
  throw createMissingDraftJobStoreError();
}

async function readJobJson(jobId: string) {
  const storeKind = getDraftJobStoreKind();
  if (storeKind === "database") {
    await ensureDraftJobSchema();
    const row = await pgGet(
      "SELECT job_json FROM content_draft_jobs WHERE id = ? LIMIT 1",
      jobId,
    );
    const raw = typeof row?.job_json === "string" ? row.job_json : "";
    return raw ? (JSON.parse(raw) as ContentDraftJob) : null;
  }
  if (storeKind === "blob") {
    return readBlobJson<ContentDraftJob>(getJobPath(jobId));
  }
  if (storeKind === "memory") {
    return memoryDraftJobs.get(jobId) ?? null;
  }
  throw createMissingDraftJobStoreError();
}

export async function createContentDraftJob(input: {
  userEmail?: string | null;
  projectId?: string | null;
  request: ContentDraftJobRequest;
}) {
  const direction = normalizeDirection(input.request.normalizedDirection || input.request.direction);
  const totalCount = normalizeCount(input.request.normalizedCount ?? input.request.posterCount, direction);
  const now = nowIso();
  const request: ContentDraftJobRequest = {
    ...input.request,
    direction,
    normalizedDirection: direction,
    posterCount: totalCount,
    normalizedCount: totalCount,
  };
  const batches = buildBatches(direction, totalCount);
  const job: ContentDraftJob = {
    id: randomUUID(),
    userEmail: input.userEmail?.trim().toLowerCase() || null,
    projectId: input.projectId?.trim() || input.request.projectId?.trim() || null,
    status: "queued",
    progress: 0,
    message: "Queued",
    currentBatch: 0,
    totalBatches: batches.length,
    error: null,
    createdAt: now,
    updatedAt: now,
    request,
    batches,
    result: null,
  };
  await writeJobJson(job);
  logOpsEvent({
    category: "llm",
    action: "draft_job_created",
    status: "ok",
    source: direction,
    userEmail: job.userEmail || undefined,
    details: {
      jobId: job.id,
      projectId: job.projectId,
      totalCount,
      totalBatches: batches.length,
      batchSize: DRAFT_BATCH_SIZE,
    },
  });
  return job;
}

export async function getContentDraftJob(jobId: string) {
  const normalized = jobId.trim();
  if (!normalized || !/^[a-z0-9-]{20,80}$/i.test(normalized)) {
    return null;
  }
  return readJobJson(normalized);
}

function mergeBatchResult(job: ContentDraftJob, batch: ContentDraftBatch, data: Record<string, unknown>) {
  const direction = normalizeDirection(job.request.normalizedDirection || job.request.direction);
  const previous = job.result || {};
  if (direction === "ppt") {
    const previousOutline = Array.isArray(previous.outlineItems) ? previous.outlineItems : [];
    const previousSlides = Array.isArray(previous.slideDrafts) ? previous.slideDrafts : [];
    const nextOutline = Array.isArray(data.outlineItems) ? data.outlineItems : [];
    const nextSlides = Array.isArray(data.slideDrafts) ? data.slideDrafts : [];
    return {
      ...data,
      outlineItems: [...previousOutline, ...nextOutline],
      slideDrafts: [
        ...previousSlides,
        ...nextSlides.map((item, idx) => ({
          ...(item && typeof item === "object" ? item : {}),
          page: batch.startIndex + idx,
          isCover: batch.includeCover && idx === 0,
        })),
      ],
    };
  }
  if (direction === "video") {
    const previousOutline = Array.isArray(previous.outlineItems) ? previous.outlineItems : [];
    const previousFrames = Array.isArray(previous.storyboardDrafts) ? previous.storyboardDrafts : [];
    const nextOutline = Array.isArray(data.outlineItems) ? data.outlineItems : [];
    const nextFrames = Array.isArray(data.storyboardDrafts) ? data.storyboardDrafts : [];
    return {
      ...data,
      outlineItems: [...previousOutline, ...nextOutline],
      storyboardDrafts: [
        ...previousFrames,
        ...nextFrames.map((item, idx) => ({
          ...(item && typeof item === "object" ? item : {}),
          index: batch.startIndex + idx,
          isCover: batch.includeCover && idx === 0,
        })),
      ],
    };
  }
  const previousPlan = Array.isArray(previous.planList) ? previous.planList : [];
  const nextPlan = Array.isArray(data.planList) ? data.planList : [];
  return {
    ...data,
    posterDraft: previous.posterDraft || data.posterDraft,
    planList: [
      ...previousPlan,
      ...nextPlan.map((item, idx) => ({
        ...(item && typeof item === "object" ? item : {}),
        index: batch.startIndex + idx,
      })),
    ],
  };
}

async function callDraftBatch(job: ContentDraftJob, batch: ContentDraftBatch, runtime: DraftRuntimeContext) {
  const url = `${runtime.origin.replace(/\/+$/, "")}/api/content/poster-draft`;
  const body = {
    ...job.request,
    posterCount: batch.count,
    normalizedCount: batch.count,
    draftBatch: {
      enabled: true,
      startIndex: batch.startIndex,
      totalCount: job.request.normalizedCount ?? job.request.posterCount ?? batch.count,
      includeCover: batch.includeCover,
    },
  };
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (runtime.cookie) {
    headers.cookie = runtime.cookie;
  }
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || `Draft batch request failed: ${response.status}`);
  }
  return data;
}

export async function runContentDraftJob(jobId: string, runtime: DraftRuntimeContext) {
  let job = await getContentDraftJob(jobId);
  if (!job || job.status === "success" || job.status === "error") {
    return job;
  }
  const direction = normalizeDirection(job.request.normalizedDirection || job.request.direction);
  try {
    job = {
      ...job,
      status: "running",
      message: "Generating draft...",
      updatedAt: nowIso(),
    };
    await writeJobJson(job);

    for (let index = job.currentBatch; index < job.batches.length; index += 1) {
      const batch = job.batches[index];
      job.batches[index] = { ...batch, status: "running", error: null };
      job.currentBatch = index;
      job.progress = Math.max(1, Math.round((index / job.totalBatches) * 95));
      job.message = `Generating batch ${index + 1}/${job.totalBatches}`;
      job.updatedAt = nowIso();
      await writeJobJson(job);

      const data = await callDraftBatch(job, batch, runtime);
      job.result = mergeBatchResult(job, batch, data);
      job.batches[index] = { ...batch, status: "success", error: null };
      job.currentBatch = index + 1;
      job.progress = Math.round(((index + 1) / job.totalBatches) * 95);
      job.updatedAt = nowIso();
      await writeJobJson(job);
    }

    job.status = "success";
    job.progress = 100;
    job.message = "Draft ready";
    job.updatedAt = nowIso();
    await writeJobJson(job);
    logOpsEvent({
      category: "llm",
      action: "draft_job_success",
      status: "ok",
      source: direction,
      userEmail: job.userEmail || undefined,
      details: { jobId: job.id, totalBatches: job.totalBatches },
    });
    return job;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Draft job failed.";
    const failedBatch = job.batches[job.currentBatch];
    if (failedBatch) {
      job.batches[job.currentBatch] = { ...failedBatch, status: "error", error: message };
    }
    job.status = "error";
    job.error = message;
    job.message = message;
    job.updatedAt = nowIso();
    await writeJobJson(job);
    logOpsEvent({
      category: "llm",
      action: "draft_job_failed",
      status: "error",
      source: direction,
      userEmail: job.userEmail || undefined,
      message,
      details: { jobId: job.id, currentBatch: job.currentBatch + 1, totalBatches: job.totalBatches },
    });
    return job;
  }
}

export function shouldResumeContentDraftJob(job: ContentDraftJob) {
  if (job.status !== "queued" && job.status !== "running") {
    return false;
  }
  const updatedAt = Date.parse(job.updatedAt);
  if (!Number.isFinite(updatedAt)) {
    return true;
  }
  return Date.now() - updatedAt > 30_000;
}
