import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get as getBlob, put as putBlob } from "@vercel/blob";
import { getDb } from "@/lib/server/db";
import { hasManagedDatabase, pgAll, pgGet, pgRun } from "@/lib/server/postgres";
import { applyImageGenerationRefundAtomic, logOpsEvent } from "@/lib/server/store";
import { updateWorkspaceProjectPageImage } from "@/lib/server/workspace-project-pages";

export type ImageGenerationJobStatus =
  | "billing_pending"
  | "billing_failed"
  | "queued"
  | "running"
  | "completed"
  | "completed_with_errors"
  | "failed"
  | "timed_out";

export type ImageGenerationTaskStatus =
  | "billing_pending"
  | "billing_failed"
  | "queued"
  | "generating"
  | "asset_downloading"
  | "asset_ready"
  | "failed"
  | "timed_out";

export type ImageGenerationTaskPayload = {
  index: number;
  outputType: string;
  aspectRatio: string;
  prompt: string;
  size?: string;
  provider?: string;
  model?: string;
  quality?: string;
  responseFormat?: string;
};

export type ImageGenerationTaskRow = {
  id: string;
  jobId: string;
  taskIndex: number;
  outputType: string;
  aspectRatio: string;
  promptText: string;
  providerOrder: string;
  providerUsed: string | null;
  status: ImageGenerationTaskStatus;
  attempts: number;
  errorCode: string | null;
  errorMessage: string | null;
  rawImageUrl: string | null;
  renderUrl: string | null;
  assetPath: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ImageGenerationJobRow = {
  id: string;
  userEmail: string;
  projectId: string | null;
  intent: string | null;
  ratio: string | null;
  imageModelPolicy: string | null;
  idempotencyKey: string | null;
  runId: string | null;
  status: ImageGenerationJobStatus;
  errorCode: string | null;
  errorMessage: string | null;
  requestJson: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ImageGenerationProjectActivityRow = {
  projectId: string;
  intent: string | null;
  updatedAt: string;
};

const ACTIVE_TASK_STATUSES: ImageGenerationTaskStatus[] = ["queued", "generating", "asset_downloading"];
const TERMINAL_JOB_STATUSES: ImageGenerationJobStatus[] = ["billing_failed", "completed", "completed_with_errors", "failed", "timed_out"];
const PREPARED_IMAGE_GENERATION_STATUSES = new Set<ImageGenerationJobStatus | ImageGenerationTaskStatus>(["billing_pending"]);
const ACTIVE_IMAGE_GENERATION_STATUSES = new Set<ImageGenerationJobStatus | ImageGenerationTaskStatus>([
  "queued",
  "running",
  "generating",
  "asset_downloading",
]);
const SUCCESS_IMAGE_GENERATION_STATUSES = new Set<ImageGenerationJobStatus | ImageGenerationTaskStatus>([
  "completed",
  "asset_ready",
]);
const FAILED_IMAGE_GENERATION_STATUSES = new Set<ImageGenerationJobStatus | ImageGenerationTaskStatus>([
  "billing_failed",
  "completed_with_errors",
  "failed",
  "timed_out",
]);
const RECENT_ABANDONED_LOG_TTL_MS = 60 * 60 * 1000;
const recentlyLoggedAbandonedJobs = new Map<string, number>();
const BILLING_PENDING_TIMEOUT_MS = 120_000;
const ABANDONED_JOB_TIMEOUT_MS = (() => {
  const parsed = Number.parseInt(process.env.IMAGE_GENERATION_ABANDONED_JOB_TIMEOUT_MS || "480000", 10);
  if (!Number.isFinite(parsed)) {
    return 480_000;
  }
  return Math.max(60_000, Math.min(86_400_000, parsed));
})();

function nowIso() {
  return new Date().toISOString();
}

export function isImageGenerationPreparedStatus(status?: string | null) {
  return PREPARED_IMAGE_GENERATION_STATUSES.has((status || "").trim() as ImageGenerationJobStatus);
}

export function isImageGenerationActiveStatus(status?: string | null) {
  return ACTIVE_IMAGE_GENERATION_STATUSES.has((status || "").trim() as ImageGenerationJobStatus);
}

export function isImageGenerationSuccessStatus(status?: string | null) {
  const normalized = (status || "").trim();
  return SUCCESS_IMAGE_GENERATION_STATUSES.has(normalized as ImageGenerationJobStatus) || normalized === "success";
}

export function isImageGenerationFailedStatus(status?: string | null) {
  return FAILED_IMAGE_GENERATION_STATUSES.has((status || "").trim() as ImageGenerationJobStatus);
}

function normalizeText(input: string | undefined, max = 1000) {
  return (input || "").trim().slice(0, max);
}

function normalizeOptionalText(input: string | undefined, max = 1000) {
  const normalized = normalizeText(input, max);
  return normalized || null;
}

function parseBooleanEnv(name: string, fallback = false) {
  const raw = (process.env[name] || "").trim().toLowerCase();
  if (!raw) {
    return fallback;
  }
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function shouldUseBlobImageGenerationStore() {
  return (
    parseBooleanEnv("IMAGE_GENERATION_USE_BLOB_STATE", process.env.NODE_ENV === "production") &&
    Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID)
  );
}

function getBlobStateAccessMode(): "public" | "private" {
  const raw = (process.env.IMAGE_GENERATION_BLOB_STATE_ACCESS || "").trim().toLowerCase();
  return raw === "private" ? "private" : "public";
}

function stableSha256(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

function getImageGenerationJobManifestPath(jobId: string) {
  return `knowlens/image-generation/jobs/${jobId}.json`;
}

function getImageGenerationJobIndexPath(userEmail: string, idempotencyKey: string) {
  const emailKey = stableSha256(userEmail.trim().toLowerCase()).slice(0, 16);
  const idempotencyKeyHash = stableSha256(idempotencyKey.trim()).slice(0, 24);
  return `knowlens/image-generation/index/${emailKey}/${idempotencyKeyHash}.json`;
}

function getImageGenerationProjectIndexPath(userEmail: string, projectId: string) {
  const emailKey = stableSha256(userEmail.trim().toLowerCase()).slice(0, 16);
  const projectKeyHash = stableSha256(projectId.trim()).slice(0, 24);
  return `knowlens/image-generation/project-index/${emailKey}/${projectKeyHash}.json`;
}

function getImageGenerationActiveJobsIndexPath(userEmail: string) {
  const emailKey = stableSha256(userEmail.trim().toLowerCase()).slice(0, 16);
  return `knowlens/image-generation/active-jobs/${emailKey}.json`;
}

function normalizeStorageProjectId(projectId: string | null | undefined) {
  const normalized = (projectId || "").trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  return normalized || "no-project";
}

export function buildImageAssetStorageKey(input: {
  projectId: string | null | undefined;
  taskId: string;
  mimeType: string;
}) {
  const extension = extensionFromMimeType(input.mimeType);
  return `workspace-images/${normalizeStorageProjectId(input.projectId)}/${input.taskId}${extension}`;
}

function getImageGenerationTaskIndexPath(taskId: string) {
  return `knowlens/image-generation/task-index/${taskId}.json`;
}

type StoredImageGenerationManifest = {
  job: ImageGenerationJobRow;
  tasks: ImageGenerationTaskRow[];
};

type StoredImageGenerationProjectIndex = {
  jobId?: string;
  jobIds?: string[];
};

type StoredImageGenerationActiveJobsIndex = {
  jobIds?: string[];
};

async function readBlobJson<T>(pathname: string): Promise<T | null> {
  const blob = await getBlob(pathname, {
    access: getBlobStateAccessMode(),
  });
  if (!blob) {
    return null;
  }
  if (blob.statusCode !== 200 || !blob.stream) {
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
    access: getBlobStateAccessMode(),
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

async function updateBlobActiveJobIndex(input: {
  userEmail: string;
  jobId: string;
  mode: "add" | "remove";
}) {
  const indexPath = getImageGenerationActiveJobsIndexPath(input.userEmail);
  const current = await readBlobJson<StoredImageGenerationActiveJobsIndex>(indexPath);
  const existingJobIds = Array.isArray(current?.jobIds) ? current.jobIds : [];
  const nextJobIds =
    input.mode === "add"
      ? Array.from(new Set([input.jobId, ...existingJobIds].filter(Boolean))).slice(0, 200)
      : existingJobIds.filter((jobId) => jobId !== input.jobId);
  await writeBlobJson(indexPath, { jobIds: nextJobIds });
}

function parseTimestampMs(value: string | null | undefined) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function isActiveTaskStatus(status: string | null | undefined) {
  return ACTIVE_TASK_STATUSES.includes(String(status || "").trim() as ImageGenerationTaskStatus);
}

function isTerminalJobStatus(status: string | null | undefined) {
  return TERMINAL_JOB_STATUSES.includes(String(status || "").trim() as ImageGenerationJobStatus);
}

function shouldLogAbandonedJob(jobId: string, timeoutCode: string) {
  const key = `${jobId}:${timeoutCode}`;
  const now = Date.now();
  const lastLoggedAt = recentlyLoggedAbandonedJobs.get(key) || 0;
  if (lastLoggedAt && now - lastLoggedAt < RECENT_ABANDONED_LOG_TTL_MS) {
    return false;
  }
  recentlyLoggedAbandonedJobs.set(key, now);
  for (const [cachedKey, loggedAt] of recentlyLoggedAbandonedJobs.entries()) {
    if (now - loggedAt >= RECENT_ABANDONED_LOG_TTL_MS) {
      recentlyLoggedAbandonedJobs.delete(cachedKey);
    }
  }
  return true;
}

async function readStoredManifest(jobId: string) {
  return readBlobJson<StoredImageGenerationManifest>(getImageGenerationJobManifestPath(jobId));
}

export function buildImageRenderUrl(taskId: string, version?: string | number | null) {
  const baseUrl = `/api/workspace/image/assets/${encodeURIComponent(taskId)}`;
  const rawVersion = version == null ? "" : String(version).trim();
  if (!rawVersion) {
    return baseUrl;
  }
  return `${baseUrl}?v=${encodeURIComponent(rawVersion)}`;
}

const MOCK_IMAGE_ASSET_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3Z6p8AAAAASUVORK5CYII=",
  "base64",
);

export function isMockImageGenerationTaskId(taskId: string) {
  return taskId.startsWith("mock-imgtask-");
}

export function getMockGeneratedImageAsset() {
  return {
    bytes: MOCK_IMAGE_ASSET_BYTES,
    mimeType: "image/png",
  };
}

function mapJobRow(row: Record<string, unknown>): ImageGenerationJobRow {
  return {
    id: String(row.id || ""),
    userEmail: String(row.user_email || ""),
    projectId: typeof row.project_id === "string" ? row.project_id : null,
    intent: typeof row.intent === "string" ? row.intent : null,
    ratio: typeof row.ratio === "string" ? row.ratio : null,
    imageModelPolicy: typeof row.image_model_policy === "string" ? row.image_model_policy : null,
    idempotencyKey: typeof row.idempotency_key === "string" ? row.idempotency_key : null,
    runId: typeof row.run_id === "string" ? row.run_id : null,
    status: String(row.status || "queued") as ImageGenerationJobStatus,
    errorCode: typeof row.error_code === "string" ? row.error_code : null,
    errorMessage: typeof row.error_message === "string" ? row.error_message : null,
    requestJson: typeof row.request_json === "string" ? row.request_json : null,
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

function mapTaskRow(row: Record<string, unknown>): ImageGenerationTaskRow {
  return {
    id: String(row.id || ""),
    jobId: String(row.job_id || ""),
    taskIndex: Number(row.task_index || 0),
    outputType: String(row.output_type || ""),
    aspectRatio: String(row.aspect_ratio || ""),
    promptText: String(row.prompt_text || ""),
    providerOrder: String(row.provider_order || ""),
    providerUsed: typeof row.provider_used === "string" ? row.provider_used : null,
    status: String(row.status || "queued") as ImageGenerationTaskStatus,
    attempts: Number(row.attempts || 0),
    errorCode: typeof row.error_code === "string" ? row.error_code : null,
    errorMessage: typeof row.error_message === "string" ? row.error_message : null,
    rawImageUrl: typeof row.raw_image_url === "string" ? row.raw_image_url : null,
    renderUrl: typeof row.render_url === "string" ? row.render_url : null,
    assetPath: typeof row.asset_path === "string" ? row.asset_path : null,
    mimeType: typeof row.mime_type === "string" ? row.mime_type : null,
    width: Number.isFinite(row.width) ? Number(row.width) : null,
    height: Number.isFinite(row.height) ? Number(row.height) : null,
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

function hasPersistedImageAsset(task: ImageGenerationTaskRow) {
  return Boolean(
    task.status === "asset_ready" &&
      task.renderUrl?.trim() &&
      task.assetPath?.trim(),
  );
}

function compareProjectRestoreTasks(a: ImageGenerationTaskRow, b: ImageGenerationTaskRow) {
  if (a.taskIndex !== b.taskIndex) {
    return a.taskIndex - b.taskIndex;
  }
  const aReady = hasPersistedImageAsset(a);
  const bReady = hasPersistedImageAsset(b);
  if (aReady !== bReady) {
    return aReady ? -1 : 1;
  }
  return Date.parse(b.updatedAt || b.createdAt || "") - Date.parse(a.updatedAt || a.createdAt || "");
}

export async function findImageGenerationJobByIdempotency(input: {
  userEmail: string;
  idempotencyKey: string;
  runId?: string;
}): Promise<ImageGenerationJobRow | null> {
  if (shouldUseBlobImageGenerationStore()) {
    const indexPath = getImageGenerationJobIndexPath(input.userEmail, input.idempotencyKey);
    const index = await readBlobJson<{ jobId?: string }>(indexPath);
    if (!index?.jobId) {
      return null;
    }
    const manifest = await readStoredManifest(index.jobId);
    if (!manifest?.job) {
      return null;
    }
    if (input.runId && manifest.job.runId !== input.runId) {
      return null;
    }
    return manifest.job;
  }
  if (hasManagedDatabase()) {
    const runId = normalizeOptionalText(input.runId, 120);
    const row = (runId
      ? await pgGet(
          `SELECT *
           FROM image_generation_jobs
           WHERE user_email = ? AND idempotency_key = ? AND run_id = ?
           ORDER BY created_at DESC
           LIMIT 1`,
          input.userEmail.trim().toLowerCase(),
          input.idempotencyKey.trim(),
          runId,
        )
      : await pgGet(
          `SELECT *
           FROM image_generation_jobs
           WHERE user_email = ? AND idempotency_key = ?
           ORDER BY created_at DESC
           LIMIT 1`,
          input.userEmail.trim().toLowerCase(),
          input.idempotencyKey.trim(),
        )) as Record<string, unknown> | undefined;
    return row ? mapJobRow(row) : null;
  }
  const runId = normalizeOptionalText(input.runId, 120);
  const { db } = getDb();
  const row = (runId
    ? db
        .prepare(
          `SELECT *
           FROM image_generation_jobs
           WHERE user_email = ? AND idempotency_key = ? AND run_id = ?
           ORDER BY created_at DESC
           LIMIT 1`,
        )
        .get(input.userEmail.trim().toLowerCase(), input.idempotencyKey.trim(), runId)
    : db
        .prepare(
          `SELECT *
           FROM image_generation_jobs
           WHERE user_email = ? AND idempotency_key = ?
           ORDER BY created_at DESC
           LIMIT 1`,
        )
        .get(input.userEmail.trim().toLowerCase(), input.idempotencyKey.trim())) as
    | Record<string, unknown>
    | undefined;
  if (!row) {
    return null;
  }
  return mapJobRow(row);
}

export async function createImageGenerationJob(input: {
  userEmail: string;
  projectId?: string;
  intent?: string;
  ratio?: string;
  imageModelPolicy?: string;
  idempotencyKey?: string;
  runId?: string;
  requestSnapshot?: unknown;
  initialJobStatus?: ImageGenerationJobStatus;
  initialTaskStatus?: ImageGenerationTaskStatus;
  tasks: ImageGenerationTaskPayload[];
}): Promise<{
  jobId: string;
  tasks: ImageGenerationTaskRow[];
}> {
  const jobId = `imgjob-${randomUUID()}`;
  const createdAt = nowIso();
  const userEmail = input.userEmail.trim().toLowerCase();
  const initialJobStatus = input.initialJobStatus || "queued";
  const initialTaskStatus = input.initialTaskStatus || "queued";
  const requestJson = (() => {
    try {
      return JSON.stringify(input.requestSnapshot ?? {}).slice(0, 32000);
    } catch {
      return null;
    }
  })();
  const taskRows: ImageGenerationTaskRow[] = [];
  for (const task of input.tasks) {
    const taskId = `imgtask-${randomUUID()}`;
    taskRows.push({
      id: taskId,
      jobId,
      taskIndex: Math.max(1, Math.round(task.index)),
      outputType: normalizeText(task.outputType, 32),
      aspectRatio: normalizeText(task.aspectRatio, 64),
      promptText: normalizeText(task.prompt, 8000),
      providerOrder: normalizeText(input.imageModelPolicy, 120),
      providerUsed: null,
      status: initialTaskStatus,
      attempts: 0,
      errorCode: null,
      errorMessage: null,
      rawImageUrl: null,
      renderUrl: null,
      assetPath: null,
      mimeType: null,
      width: null,
      height: null,
      createdAt,
      updatedAt: createdAt,
    });
  }

  if (shouldUseBlobImageGenerationStore()) {
    const normalizedProjectId = normalizeOptionalText(input.projectId, 120);
    const jobRow: ImageGenerationJobRow = {
      id: jobId,
      userEmail,
      projectId: normalizedProjectId,
      intent: normalizeOptionalText(input.intent, 48),
      ratio: normalizeOptionalText(input.ratio, 64),
      imageModelPolicy: normalizeOptionalText(input.imageModelPolicy, 120),
      idempotencyKey: normalizeOptionalText(input.idempotencyKey, 220),
	      runId: normalizeOptionalText(input.runId, 120),
	      status: initialJobStatus,
      errorCode: null,
      errorMessage: null,
      requestJson,
      createdAt,
      updatedAt: createdAt,
    };
    const manifest: StoredImageGenerationManifest = {
      job: jobRow,
      tasks: taskRows,
    };
    await writeBlobJson(getImageGenerationJobManifestPath(jobId), manifest);
    if (input.idempotencyKey) {
      await writeBlobJson(getImageGenerationJobIndexPath(userEmail, input.idempotencyKey), { jobId });
    }
    if (normalizedProjectId) {
      const projectIndexPath = getImageGenerationProjectIndexPath(userEmail, normalizedProjectId);
      const projectIndex = await readBlobJson<StoredImageGenerationProjectIndex>(projectIndexPath);
      const existingJobIds = Array.isArray(projectIndex?.jobIds) ? projectIndex.jobIds : [];
      const legacyJobId = typeof projectIndex?.jobId === "string" ? projectIndex.jobId : "";
      const jobIds = Array.from(new Set([jobId, legacyJobId, ...existingJobIds].filter(Boolean))).slice(
        0,
        100,
      );
      await writeBlobJson(projectIndexPath, { jobId, jobIds });
    }
    await updateBlobActiveJobIndex({
      userEmail,
      jobId,
      mode: "add",
    });
    await Promise.all(
      taskRows.map((task) =>
        writeBlobJson(getImageGenerationTaskIndexPath(task.id), {
          jobId,
          taskId: task.id,
        }),
      ),
    );
    return {
      jobId,
      tasks: taskRows,
    };
  }

  if (hasManagedDatabase()) {
    await pgRun(
      `INSERT INTO image_generation_jobs (
        id, user_email, project_id, intent, ratio, image_model_policy, idempotency_key, run_id, status,
        error_code, error_message, request_json, created_at, updated_at
      )
	      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, null, null, ?, ?, ?)`,
      jobId,
      userEmail,
      normalizeOptionalText(input.projectId, 120),
      normalizeOptionalText(input.intent, 48),
      normalizeOptionalText(input.ratio, 64),
      normalizeOptionalText(input.imageModelPolicy, 120),
      normalizeOptionalText(input.idempotencyKey, 220),
	      normalizeOptionalText(input.runId, 120),
	      initialJobStatus,
	      requestJson,
      createdAt,
      createdAt,
    );
    for (const task of taskRows) {
      await pgRun(
        `INSERT INTO image_generation_tasks (
          id, job_id, task_index, output_type, aspect_ratio, prompt_text, provider_order, provider_used,
          status, attempts, error_code, error_message, raw_image_url, render_url, asset_path, mime_type,
          width, height, created_at, updated_at
        )
	        VALUES (?, ?, ?, ?, ?, ?, ?, null, ?, 0, null, null, null, null, null, null, null, null, ?, ?)`,
        task.id,
        jobId,
        task.taskIndex,
        task.outputType,
        task.aspectRatio,
        task.promptText,
	        normalizeText(input.imageModelPolicy, 120),
	        initialTaskStatus,
	        createdAt,
        createdAt,
      );
    }
    return {
      jobId,
      tasks: taskRows,
    };
  }

  const { db } = getDb();
  db.prepare(
    `INSERT INTO image_generation_jobs (
      id, user_email, project_id, intent, ratio, image_model_policy, idempotency_key, run_id, status,
      error_code, error_message, request_json, created_at, updated_at
    )
	    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, null, null, ?, ?, ?)`,
  ).run(
    jobId,
    userEmail,
    normalizeOptionalText(input.projectId, 120),
    normalizeOptionalText(input.intent, 48),
    normalizeOptionalText(input.ratio, 64),
    normalizeOptionalText(input.imageModelPolicy, 120),
    normalizeOptionalText(input.idempotencyKey, 220),
	    normalizeOptionalText(input.runId, 120),
	    initialJobStatus,
	    requestJson,
    createdAt,
    createdAt,
  );

  const insertTask = db.prepare(
    `INSERT INTO image_generation_tasks (
      id, job_id, task_index, output_type, aspect_ratio, prompt_text, provider_order, provider_used,
      status, attempts, error_code, error_message, raw_image_url, render_url, asset_path, mime_type,
      width, height, created_at, updated_at
    )
	    VALUES (?, ?, ?, ?, ?, ?, ?, null, ?, 0, null, null, null, null, null, null, null, null, ?, ?)`,
  );

  for (const task of taskRows) {
    insertTask.run(
      task.id,
      jobId,
      task.taskIndex,
      task.outputType,
      task.aspectRatio,
      task.promptText,
      normalizeText(input.imageModelPolicy, 120),
      initialTaskStatus,
      createdAt,
      createdAt,
    );
  }

  return {
    jobId,
    tasks: taskRows,
  };
}

export async function getLatestImageGenerationJobByProject(input: {
  userEmail: string;
  projectId: string;
  intent?: string | null;
}): Promise<StoredImageGenerationManifest | null> {
  const userEmail = input.userEmail.trim().toLowerCase();
  const projectId = normalizeOptionalText(input.projectId, 120);
  const intent = normalizeOptionalText(input.intent || undefined, 48);
  if (!userEmail || !projectId) {
    return null;
  }

  if (shouldUseBlobImageGenerationStore()) {
    const indexPath = getImageGenerationProjectIndexPath(userEmail, projectId);
    const index = await readBlobJson<StoredImageGenerationProjectIndex>(indexPath);
    const jobIds = Array.from(
      new Set([
        ...(Array.isArray(index?.jobIds) ? index.jobIds : []),
        typeof index?.jobId === "string" ? index.jobId : "",
      ].filter(Boolean)),
    );
    if (jobIds.length === 0) {
      return null;
    }
    const manifests = (await Promise.all(jobIds.map((jobId) => readStoredManifest(jobId)))).filter(
      (manifest): manifest is StoredImageGenerationManifest => Boolean(manifest?.job),
    );
    const projectManifests = manifests.filter((manifest) => {
      if (manifest.job.userEmail.trim().toLowerCase() !== userEmail) {
        return false;
      }
      if (manifest.job.projectId !== projectId) {
        return false;
      }
      if (intent && manifest.job.intent !== intent) {
        return false;
      }
      return true;
    });
    if (projectManifests.length === 0) {
      return null;
    }
    const [latestManifest] = projectManifests.sort(
      (a, b) =>
        Date.parse(b.job.updatedAt || b.job.createdAt || "") -
        Date.parse(a.job.updatedAt || a.job.createdAt || ""),
    );
    const latestTaskByIndex = new Map<number, ImageGenerationTaskRow>();
    const tasks = projectManifests
      .flatMap((manifest) => manifest.tasks || [])
      .sort(compareProjectRestoreTasks);
    for (const task of tasks) {
      if (!task.taskIndex || latestTaskByIndex.has(task.taskIndex)) {
        continue;
      }
      latestTaskByIndex.set(task.taskIndex, task);
    }
    return {
      job: latestManifest.job,
      tasks: Array.from(latestTaskByIndex.values()).sort((a, b) => a.taskIndex - b.taskIndex),
    };
  }

  if (hasManagedDatabase()) {
    const row = (intent
      ? await pgGet(
          `SELECT *
           FROM image_generation_jobs
           WHERE user_email = ? AND project_id = ? AND intent = ?
           ORDER BY updated_at DESC, created_at DESC
           LIMIT 1`,
          userEmail,
          projectId,
          intent,
        )
      : await pgGet(
          `SELECT *
           FROM image_generation_jobs
           WHERE user_email = ? AND project_id = ?
           ORDER BY updated_at DESC, created_at DESC
           LIMIT 1`,
          userEmail,
          projectId,
        )) as Record<string, unknown> | undefined;
    const jobId = typeof row?.id === "string" ? row.id : "";
    if (!row || !jobId) {
      return null;
    }
    const latestJob = mapJobRow(row);
    const taskRows = (intent
      ? await pgAll(
          `SELECT t.*
             FROM image_generation_tasks t
            JOIN image_generation_jobs j ON j.id = t.job_id
            WHERE j.user_email = ? AND j.project_id = ? AND j.intent = ?
            ORDER BY
              t.task_index ASC,
              CASE
                WHEN t.status = 'asset_ready'
                 AND t.render_url IS NOT NULL
                 AND t.render_url != ''
                 AND t.asset_path IS NOT NULL
                 AND t.asset_path != ''
                THEN 0
                ELSE 1
              END ASC,
              t.updated_at DESC,
              t.created_at DESC`,
          userEmail,
          projectId,
          intent,
        )
      : await pgAll(
          `SELECT t.*
             FROM image_generation_tasks t
             JOIN image_generation_jobs j ON j.id = t.job_id
            WHERE j.user_email = ? AND j.project_id = ?
            ORDER BY
              t.task_index ASC,
              CASE
                WHEN t.status = 'asset_ready'
                 AND t.render_url IS NOT NULL
                 AND t.render_url != ''
                 AND t.asset_path IS NOT NULL
                 AND t.asset_path != ''
                THEN 0
                ELSE 1
              END ASC,
              t.updated_at DESC,
              t.created_at DESC`,
          userEmail,
          projectId,
        )) as Array<Record<string, unknown>>;
    const latestTaskByIndex = new Map<number, ImageGenerationTaskRow>();
    for (const taskRow of taskRows) {
      const task = mapTaskRow(taskRow);
      if (!task.taskIndex || latestTaskByIndex.has(task.taskIndex)) {
        continue;
      }
      latestTaskByIndex.set(task.taskIndex, task);
    }
    return {
      job: latestJob,
      tasks: Array.from(latestTaskByIndex.values()).sort((a, b) => a.taskIndex - b.taskIndex),
    };
  }

  const { db } = getDb();
  const row = (intent
    ? db
        .prepare(
          `SELECT *
           FROM image_generation_jobs
           WHERE user_email = ? AND project_id = ? AND intent = ?
           ORDER BY updated_at DESC, created_at DESC
           LIMIT 1`,
        )
        .get(userEmail, projectId, intent)
    : db
        .prepare(
          `SELECT *
           FROM image_generation_jobs
           WHERE user_email = ? AND project_id = ?
           ORDER BY updated_at DESC, created_at DESC
           LIMIT 1`,
        )
        .get(userEmail, projectId)) as Record<string, unknown> | undefined;
  const jobId = typeof row?.id === "string" ? row.id : "";
  if (!row || !jobId) {
    return null;
  }
  const latestJob = mapJobRow(row);
  const taskRows = (intent
    ? db
        .prepare(
          `SELECT t.*
             FROM image_generation_tasks t
            JOIN image_generation_jobs j ON j.id = t.job_id
            WHERE j.user_email = ? AND j.project_id = ? AND j.intent = ?
            ORDER BY
              t.task_index ASC,
              CASE
                WHEN t.status = 'asset_ready'
                 AND t.render_url IS NOT NULL
                 AND t.render_url != ''
                 AND t.asset_path IS NOT NULL
                 AND t.asset_path != ''
                THEN 0
                ELSE 1
              END ASC,
              t.updated_at DESC,
              t.created_at DESC`,
        )
        .all(userEmail, projectId, intent)
    : db
        .prepare(
          `SELECT t.*
             FROM image_generation_tasks t
             JOIN image_generation_jobs j ON j.id = t.job_id
            WHERE j.user_email = ? AND j.project_id = ?
            ORDER BY
              t.task_index ASC,
              CASE
                WHEN t.status = 'asset_ready'
                 AND t.render_url IS NOT NULL
                 AND t.render_url != ''
                 AND t.asset_path IS NOT NULL
                 AND t.asset_path != ''
                THEN 0
                ELSE 1
              END ASC,
              t.updated_at DESC,
              t.created_at DESC`,
        )
        .all(userEmail, projectId)) as Array<Record<string, unknown>>;
  const latestTaskByIndex = new Map<number, ImageGenerationTaskRow>();
  for (const taskRow of taskRows) {
    const task = mapTaskRow(taskRow);
    if (!task.taskIndex || latestTaskByIndex.has(task.taskIndex)) {
      continue;
    }
    latestTaskByIndex.set(task.taskIndex, task);
  }
  return {
    job: latestJob,
    tasks: Array.from(latestTaskByIndex.values()).sort((a, b) => a.taskIndex - b.taskIndex),
  };
}

export async function recoverImageGenerationJob(input: {
  userEmail: string;
  jobId?: string | null;
  idempotencyKey?: string | null;
  runId?: string | null;
  projectId?: string | null;
  intent?: string | null;
}): Promise<StoredImageGenerationManifest | null> {
  const userEmail = input.userEmail.trim().toLowerCase();
  if (!userEmail) {
    return null;
  }
  const jobId = normalizeOptionalText(input.jobId || undefined, 120);
  if (jobId) {
    const result = await getImageGenerationJobById(jobId);
    if (result?.job.userEmail.trim().toLowerCase() === userEmail) {
      return result;
    }
  }
  const idempotencyKey = normalizeOptionalText(input.idempotencyKey || undefined, 220);
  if (idempotencyKey) {
    const found = await findImageGenerationJobByIdempotency({
      userEmail,
      idempotencyKey,
      runId: normalizeOptionalText(input.runId || undefined, 120) || undefined,
    });
    if (found) {
      const result = await getImageGenerationJobById(found.id);
      if (result?.job.userEmail.trim().toLowerCase() === userEmail) {
        return result;
      }
    }
  }
  const projectId = normalizeOptionalText(input.projectId || undefined, 120);
  if (projectId) {
    return getLatestImageGenerationJobByProject({
      userEmail,
      projectId,
      intent: input.intent,
    });
  }
  return null;
}

export async function listImageGenerationTaskHistoryByProject(input: {
  userEmail: string;
  projectId: string;
  intent?: string | null;
  maxPerPage?: number;
}): Promise<ImageGenerationTaskRow[]> {
  const userEmail = input.userEmail.trim().toLowerCase();
  const projectId = normalizeOptionalText(input.projectId, 120);
  const intent = normalizeOptionalText(input.intent || undefined, 48);
  const maxPerPage = Math.max(1, Math.min(24, Math.round(input.maxPerPage || 12)));
  if (!userEmail || !projectId) {
    return [];
  }

  if (shouldUseBlobImageGenerationStore()) {
    const indexPath = getImageGenerationProjectIndexPath(userEmail, projectId);
    const index = await readBlobJson<StoredImageGenerationProjectIndex>(indexPath);
    const jobIds = Array.from(
      new Set([
        ...(Array.isArray(index?.jobIds) ? index.jobIds : []),
        typeof index?.jobId === "string" ? index.jobId : "",
      ].filter(Boolean)),
    );
    if (jobIds.length === 0) {
      return [];
    }
    const manifests = (await Promise.all(jobIds.map((jobId) => readStoredManifest(jobId)))).filter(
      (manifest): manifest is StoredImageGenerationManifest => Boolean(manifest?.job),
    );
    const tasks = manifests
      .filter((manifest) => {
        if (manifest.job.userEmail.trim().toLowerCase() !== userEmail) {
          return false;
        }
        if (manifest.job.projectId !== projectId) {
          return false;
        }
        if (intent && manifest.job.intent !== intent) {
          return false;
        }
        return true;
      })
      .flatMap((manifest) => manifest.tasks || [])
      .filter(hasPersistedImageAsset)
      .sort(compareProjectRestoreTasks);
    const historyByIndex = new Map<number, ImageGenerationTaskRow[]>();
    for (const task of tasks) {
      if (!task.taskIndex) {
        continue;
      }
      const history = historyByIndex.get(task.taskIndex) || [];
      if (history.length >= maxPerPage) {
        continue;
      }
      history.push(task);
      historyByIndex.set(task.taskIndex, history);
    }
    return Array.from(historyByIndex.values())
      .flat()
      .sort(compareProjectRestoreTasks);
  }

  if (hasManagedDatabase()) {
    const rows = (intent
      ? await pgAll(
          `SELECT t.*
             FROM image_generation_tasks t
             JOIN image_generation_jobs j ON j.id = t.job_id
            WHERE j.user_email = ?
              AND j.project_id = ?
              AND j.intent = ?
              AND t.status = 'asset_ready'
              AND t.render_url IS NOT NULL
              AND t.render_url != ''
              AND t.asset_path IS NOT NULL
              AND t.asset_path != ''
            ORDER BY t.task_index ASC, t.updated_at DESC, t.created_at DESC`,
          userEmail,
          projectId,
          intent,
        )
      : await pgAll(
          `SELECT t.*
             FROM image_generation_tasks t
             JOIN image_generation_jobs j ON j.id = t.job_id
            WHERE j.user_email = ?
              AND j.project_id = ?
              AND t.status = 'asset_ready'
              AND t.render_url IS NOT NULL
              AND t.render_url != ''
              AND t.asset_path IS NOT NULL
              AND t.asset_path != ''
            ORDER BY t.task_index ASC, t.updated_at DESC, t.created_at DESC`,
          userEmail,
          projectId,
        )) as Array<Record<string, unknown>>;
    const historyByIndex = new Map<number, ImageGenerationTaskRow[]>();
    for (const row of rows) {
      const task = mapTaskRow(row);
      if (!task.taskIndex) {
        continue;
      }
      const history = historyByIndex.get(task.taskIndex) || [];
      if (history.length >= maxPerPage) {
        continue;
      }
      history.push(task);
      historyByIndex.set(task.taskIndex, history);
    }
    return Array.from(historyByIndex.values())
      .flat()
      .sort(compareProjectRestoreTasks);
  }

  const { db } = getDb();
  const rows = (intent
    ? db
        .prepare(
          `SELECT t.*
             FROM image_generation_tasks t
             JOIN image_generation_jobs j ON j.id = t.job_id
            WHERE j.user_email = ?
              AND j.project_id = ?
              AND j.intent = ?
              AND t.status = 'asset_ready'
              AND t.render_url IS NOT NULL
              AND t.render_url != ''
              AND t.asset_path IS NOT NULL
              AND t.asset_path != ''
            ORDER BY t.task_index ASC, t.updated_at DESC, t.created_at DESC`,
        )
        .all(userEmail, projectId, intent)
    : db
        .prepare(
          `SELECT t.*
             FROM image_generation_tasks t
             JOIN image_generation_jobs j ON j.id = t.job_id
            WHERE j.user_email = ?
              AND j.project_id = ?
              AND t.status = 'asset_ready'
              AND t.render_url IS NOT NULL
              AND t.render_url != ''
              AND t.asset_path IS NOT NULL
              AND t.asset_path != ''
            ORDER BY t.task_index ASC, t.updated_at DESC, t.created_at DESC`,
        )
        .all(userEmail, projectId)) as Array<Record<string, unknown>>;
  const historyByIndex = new Map<number, ImageGenerationTaskRow[]>();
  for (const row of rows) {
    const task = mapTaskRow(row);
    if (!task.taskIndex) {
      continue;
    }
    const history = historyByIndex.get(task.taskIndex) || [];
    if (history.length >= maxPerPage) {
      continue;
    }
    history.push(task);
    historyByIndex.set(task.taskIndex, history);
  }
  return Array.from(historyByIndex.values())
    .flat()
    .sort(compareProjectRestoreTasks);
}

export async function listImageGenerationProjectActivityByUser(userEmailInput: string) {
  const userEmail = userEmailInput.trim().toLowerCase();
  if (!userEmail) {
    return [] as ImageGenerationProjectActivityRow[];
  }

  if (shouldUseBlobImageGenerationStore()) {
    return [] as ImageGenerationProjectActivityRow[];
  }

  const sqlText = `SELECT project_id, intent, updated_at, created_at
    FROM image_generation_jobs
    WHERE user_email = ? AND project_id IS NOT NULL AND project_id != ''
    ORDER BY updated_at DESC, created_at DESC`;

  const rows = hasManagedDatabase()
    ? await pgAll(sqlText, userEmail)
    : ((getDb().db.prepare(sqlText).all(userEmail) as Array<Record<string, unknown>>));

  const seenProjectIds = new Set<string>();
  const activities: ImageGenerationProjectActivityRow[] = [];
  for (const row of rows) {
    const projectId = String(row.project_id || "").trim();
    if (!projectId || seenProjectIds.has(projectId)) {
      continue;
    }
    seenProjectIds.add(projectId);
    activities.push({
      projectId,
      intent: typeof row.intent === "string" ? row.intent.trim() || null : null,
      updatedAt: String(row.updated_at || row.created_at || ""),
    });
  }

  return activities;
}

export async function updateImageGenerationJobStatus(input: {
  jobId: string;
  status: ImageGenerationJobStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
}): Promise<void> {
  if (shouldUseBlobImageGenerationStore()) {
    const manifest = await readStoredManifest(input.jobId);
    if (!manifest) {
      return;
    }
    manifest.job.status = input.status;
    manifest.job.errorCode = normalizeOptionalText(input.errorCode || undefined, 120);
    manifest.job.errorMessage = normalizeOptionalText(input.errorMessage || undefined, 500);
    manifest.job.updatedAt = nowIso();
    await writeBlobJson(getImageGenerationJobManifestPath(input.jobId), manifest);
    await updateBlobActiveJobIndex({
      userEmail: manifest.job.userEmail,
      jobId: input.jobId,
      mode: isTerminalJobStatus(input.status) ? "remove" : "add",
    });
    return;
  }
  if (hasManagedDatabase()) {
    await pgRun(
      `UPDATE image_generation_jobs
       SET status = ?, error_code = ?, error_message = ?, updated_at = ?
       WHERE id = ?`,
      input.status,
      normalizeOptionalText(input.errorCode || undefined, 120),
      normalizeOptionalText(input.errorMessage || undefined, 500),
      nowIso(),
      input.jobId,
    );
    return;
  }
  const { db } = getDb();
  db.prepare(
    `UPDATE image_generation_jobs
     SET status = ?, error_code = ?, error_message = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    input.status,
    normalizeOptionalText(input.errorCode || undefined, 120),
    normalizeOptionalText(input.errorMessage || undefined, 500),
    nowIso(),
    input.jobId,
  );
}

export async function updateImageGenerationTask(input: {
  taskId: string;
  status?: ImageGenerationTaskStatus;
  attempts?: number;
  providerUsed?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  rawImageUrl?: string | null;
  renderUrl?: string | null;
  assetPath?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
}): Promise<ImageGenerationTaskRow | null> {
  if (shouldUseBlobImageGenerationStore()) {
    const taskIndex = await readBlobJson<{ jobId?: string }>(getImageGenerationTaskIndexPath(input.taskId));
    if (!taskIndex?.jobId) {
      return null;
    }
    const manifest = await readStoredManifest(taskIndex.jobId);
    if (!manifest) {
      return null;
    }
    const taskIndexInList = manifest.tasks.findIndex((task) => task.id === input.taskId);
    if (taskIndexInList < 0) {
      return null;
    }
    const current = manifest.tasks[taskIndexInList];
    const next: ImageGenerationTaskRow = {
      ...current,
      status: input.status ?? current.status,
      attempts: Number.isFinite(input.attempts) ? Number(input.attempts) : current.attempts,
      providerUsed:
        input.providerUsed !== undefined
          ? normalizeOptionalText(input.providerUsed || undefined, 64)
          : current.providerUsed,
      errorCode:
        input.errorCode !== undefined
          ? normalizeOptionalText(input.errorCode || undefined, 120)
          : current.errorCode,
      errorMessage:
        input.errorMessage !== undefined
          ? normalizeOptionalText(input.errorMessage || undefined, 500)
          : current.errorMessage,
      rawImageUrl:
        input.rawImageUrl !== undefined
          ? normalizeOptionalText(input.rawImageUrl || undefined, 1200)
          : current.rawImageUrl,
      renderUrl:
        input.renderUrl !== undefined
          ? normalizeOptionalText(input.renderUrl || undefined, 400)
          : current.renderUrl,
      assetPath:
        input.assetPath !== undefined
          ? normalizeOptionalText(input.assetPath || undefined, 1200)
          : current.assetPath,
      mimeType:
        input.mimeType !== undefined
          ? normalizeOptionalText(input.mimeType || undefined, 120)
          : current.mimeType,
      width: input.width !== undefined ? (input.width == null ? null : Math.max(1, Math.round(input.width))) : current.width,
      height:
        input.height !== undefined ? (input.height == null ? null : Math.max(1, Math.round(input.height))) : current.height,
      updatedAt: nowIso(),
    };
    manifest.tasks[taskIndexInList] = next;
    await writeBlobJson(getImageGenerationJobManifestPath(next.jobId), manifest);
    return next;
  }
  if (hasManagedDatabase()) {
    const current = await pgGet("SELECT * FROM image_generation_tasks WHERE id = ? LIMIT 1", input.taskId) as
      | Record<string, unknown>
      | undefined;
    if (!current) {
      return null;
    }
    const next = {
      status: input.status ?? (String(current.status || "queued") as ImageGenerationTaskStatus),
      attempts: Number.isFinite(input.attempts) ? Number(input.attempts) : Number(current.attempts || 0),
      providerUsed:
        input.providerUsed !== undefined
          ? normalizeOptionalText(input.providerUsed || undefined, 64)
          : (typeof current.provider_used === "string" ? current.provider_used : null),
      errorCode:
        input.errorCode !== undefined
          ? normalizeOptionalText(input.errorCode || undefined, 120)
          : (typeof current.error_code === "string" ? current.error_code : null),
      errorMessage:
        input.errorMessage !== undefined
          ? normalizeOptionalText(input.errorMessage || undefined, 500)
          : (typeof current.error_message === "string" ? current.error_message : null),
      rawImageUrl:
        input.rawImageUrl !== undefined
          ? normalizeOptionalText(input.rawImageUrl || undefined, 1200)
          : (typeof current.raw_image_url === "string" ? current.raw_image_url : null),
      renderUrl:
        input.renderUrl !== undefined
          ? normalizeOptionalText(input.renderUrl || undefined, 400)
          : (typeof current.render_url === "string" ? current.render_url : null),
      assetPath:
        input.assetPath !== undefined
          ? normalizeOptionalText(input.assetPath || undefined, 1200)
          : (typeof current.asset_path === "string" ? current.asset_path : null),
      mimeType:
        input.mimeType !== undefined
          ? normalizeOptionalText(input.mimeType || undefined, 120)
          : (typeof current.mime_type === "string" ? current.mime_type : null),
      width:
        input.width !== undefined ? (input.width == null ? null : Math.max(1, Math.round(input.width))) : null,
      height:
        input.height !== undefined ? (input.height == null ? null : Math.max(1, Math.round(input.height))) : null,
    };

    await pgRun(
      `UPDATE image_generation_tasks
       SET status = ?, attempts = ?, provider_used = ?, error_code = ?, error_message = ?,
           raw_image_url = ?, render_url = ?, asset_path = ?, mime_type = ?, width = ?, height = ?, updated_at = ?
       WHERE id = ?`,
      next.status,
      next.attempts,
      next.providerUsed,
      next.errorCode,
      next.errorMessage,
      next.rawImageUrl,
      next.renderUrl,
      next.assetPath,
      next.mimeType,
      next.width,
      next.height,
      nowIso(),
      input.taskId,
    );
    return getImageGenerationTaskById(input.taskId);
  }
  const { db } = getDb();
  const current = db
    .prepare("SELECT * FROM image_generation_tasks WHERE id = ? LIMIT 1")
    .get(input.taskId) as Record<string, unknown> | undefined;
  if (!current) {
    return null;
  }
  const next = {
    status: input.status ?? (String(current.status || "queued") as ImageGenerationTaskStatus),
    attempts: Number.isFinite(input.attempts) ? Number(input.attempts) : Number(current.attempts || 0),
    providerUsed:
      input.providerUsed !== undefined
        ? normalizeOptionalText(input.providerUsed || undefined, 64)
        : (typeof current.provider_used === "string" ? current.provider_used : null),
    errorCode:
      input.errorCode !== undefined
        ? normalizeOptionalText(input.errorCode || undefined, 120)
        : (typeof current.error_code === "string" ? current.error_code : null),
    errorMessage:
      input.errorMessage !== undefined
        ? normalizeOptionalText(input.errorMessage || undefined, 500)
        : (typeof current.error_message === "string" ? current.error_message : null),
    rawImageUrl:
      input.rawImageUrl !== undefined
        ? normalizeOptionalText(input.rawImageUrl || undefined, 1200)
        : (typeof current.raw_image_url === "string" ? current.raw_image_url : null),
    renderUrl:
      input.renderUrl !== undefined
        ? normalizeOptionalText(input.renderUrl || undefined, 400)
        : (typeof current.render_url === "string" ? current.render_url : null),
    assetPath:
      input.assetPath !== undefined
        ? normalizeOptionalText(input.assetPath || undefined, 1200)
        : (typeof current.asset_path === "string" ? current.asset_path : null),
    mimeType:
      input.mimeType !== undefined
        ? normalizeOptionalText(input.mimeType || undefined, 120)
        : (typeof current.mime_type === "string" ? current.mime_type : null),
    width:
      input.width !== undefined ? (input.width == null ? null : Math.max(1, Math.round(input.width))) : null,
    height:
      input.height !== undefined ? (input.height == null ? null : Math.max(1, Math.round(input.height))) : null,
  };

  db.prepare(
    `UPDATE image_generation_tasks
     SET status = ?, attempts = ?, provider_used = ?, error_code = ?, error_message = ?,
         raw_image_url = ?, render_url = ?, asset_path = ?, mime_type = ?, width = ?, height = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    next.status,
    next.attempts,
    next.providerUsed,
    next.errorCode,
    next.errorMessage,
    next.rawImageUrl,
    next.renderUrl,
    next.assetPath,
    next.mimeType,
    next.width,
    next.height,
    nowIso(),
    input.taskId,
  );
  return getImageGenerationTaskById(input.taskId);
}

export async function activateImageGenerationJobAfterBilling(jobId: string) {
  const result = await getImageGenerationJobById(jobId);
  if (!result) {
    return result;
  }
  if (
    isImageGenerationActiveStatus(result.job.status) ||
    result.tasks.some((task) => isImageGenerationActiveStatus(task.status))
  ) {
    return syncImageGenerationJobFinalStatus(jobId);
  }
  if (
    isImageGenerationSuccessStatus(result.job.status) ||
    result.tasks.some((task) => isImageGenerationSuccessStatus(task.status))
  ) {
    return syncImageGenerationJobFinalStatus(jobId);
  }
  if (result.job.status === "billing_failed" || result.tasks.some((task) => task.status === "billing_failed")) {
    return result;
  }
  if (result.tasks.some((task) => task.status === "failed" || task.status === "timed_out")) {
    return syncImageGenerationJobFinalStatus(jobId);
  }
  const pendingTasks = result.tasks.filter((task) => task.status === "billing_pending");
  for (const task of pendingTasks) {
    await updateImageGenerationTask({ taskId: task.id, status: "queued", errorCode: null, errorMessage: null });
  }
  const activated = await getImageGenerationJobById(jobId);
  if (!activated) {
    return null;
  }
  const queuedTasks = activated.tasks.filter((task) => task.status === "queued");
  if (!queuedTasks.length) {
    return markImageGenerationJobFailedAfterCharge({
      jobId,
      errorCode: "IMAGE_JOB_NO_RUNNABLE_TASKS",
      errorMessage: "Image generation activation failed because no runnable tasks were found.",
    });
  }
  for (const task of queuedTasks) {
    if (!activated.job.projectId) {
      continue;
    }
    await updateWorkspaceProjectPageImage({
      userEmail: activated.job.userEmail,
      projectId: activated.job.projectId,
      outputType: task.outputType || activated.job.intent || "poster",
      pageIndex: task.taskIndex,
      taskId: task.id,
      status: "queued",
      errorCode: null,
    });
  }
  await updateImageGenerationJobStatus({ jobId, status: "running", errorCode: null, errorMessage: null });
  return getImageGenerationJobById(jobId);
}

export async function markImageGenerationJobBillingFailed(input: {
  jobId: string;
  errorCode?: string | null;
  errorMessage?: string | null;
}) {
  const result = await getImageGenerationJobById(input.jobId);
  if (!result) return null;
  const errorCode = normalizeOptionalText(input.errorCode || undefined, 120) || "IMAGE_BILLING_FAILED";
  const errorMessage =
    normalizeOptionalText(input.errorMessage || undefined, 500) ||
    "Image generation billing did not complete. Provider generation was not started.";
  for (const task of result.tasks) {
    if (task.status === "asset_ready" || task.status === "failed" || task.status === "timed_out") {
      continue;
    }
    await updateImageGenerationTask({ taskId: task.id, status: "billing_failed", errorCode, errorMessage });
  }
  await updateImageGenerationJobStatus({ jobId: input.jobId, status: "billing_failed", errorCode, errorMessage });
  return getImageGenerationJobById(input.jobId);
}

export async function markImageGenerationJobFailedAfterCharge(input: {
  jobId: string;
  errorCode?: string | null;
  errorMessage?: string | null;
}) {
  const result = await getImageGenerationJobById(input.jobId);
  if (!result) return null;
  const errorCode = normalizeOptionalText(input.errorCode || undefined, 120) || "IMAGE_JOB_ACTIVATION_FAILED";
  const errorMessage =
    normalizeOptionalText(input.errorMessage || undefined, 500) ||
    "Image generation failed after credits were consumed. Credits have been refunded for failed image tasks.";
  for (const task of result.tasks) {
    if (task.status === "asset_ready" || task.status === "failed" || task.status === "timed_out") continue;
    await updateImageGenerationTask({ taskId: task.id, status: "failed", errorCode, errorMessage });
  }
  await updateImageGenerationJobStatus({ jobId: input.jobId, status: "failed", errorCode, errorMessage });
  const finalState = await getImageGenerationJobById(input.jobId);
  if (finalState) {
    await applyRefundsForFailedImageGenerationTasks({
      job: finalState.job,
      tasks: finalState.tasks,
      source: "image_generation_activation_failed",
    });
  }
  return getImageGenerationJobById(input.jobId);
}

export async function getImageGenerationTaskById(taskId: string) {
  if (shouldUseBlobImageGenerationStore()) {
    const taskIndex = await readBlobJson<{ jobId?: string }>(getImageGenerationTaskIndexPath(taskId));
    if (!taskIndex?.jobId) {
      return null;
    }
    const manifest = await readStoredManifest(taskIndex.jobId);
    if (!manifest) {
      return null;
    }
    const task = manifest.tasks.find((item) => item.id === taskId);
    return task ?? null;
  }
  if (hasManagedDatabase()) {
    const row = await pgGet("SELECT * FROM image_generation_tasks WHERE id = ? LIMIT 1", taskId) as
      | Record<string, unknown>
      | undefined;
    return row ? mapTaskRow(row) : null;
  }
  const { db } = getDb();
  const row = db
    .prepare("SELECT * FROM image_generation_tasks WHERE id = ? LIMIT 1")
    .get(taskId) as Record<string, unknown> | undefined;
  if (!row) {
    return null;
  }
  return mapTaskRow(row);
}

export async function getImageGenerationTaskWithJob(taskId: string): Promise<{
  task: ImageGenerationTaskRow;
  job: ImageGenerationJobRow;
} | null> {
  if (shouldUseBlobImageGenerationStore()) {
    const taskIndex = await readBlobJson<{ jobId?: string }>(getImageGenerationTaskIndexPath(taskId));
    if (!taskIndex?.jobId) {
      return null;
    }
    const manifest = await readStoredManifest(taskIndex.jobId);
    if (!manifest) {
      return null;
    }
    const task = manifest.tasks.find((item) => item.id === taskId);
    if (!task) {
      return null;
    }
    return {
      task,
      job: manifest.job,
    };
  }
  if (hasManagedDatabase()) {
    const row = await pgGet(
      `SELECT t.*, j.user_email as job_user_email, j.project_id as job_project_id, j.id as job_id_ref,
              j.intent as job_intent, j.ratio as job_ratio, j.image_model_policy as job_image_model_policy,
              j.idempotency_key as job_idempotency_key, j.run_id as job_run_id, j.status as job_status, j.error_code as job_error_code,
              j.error_message as job_error_message, j.request_json as job_request_json,
              j.created_at as job_created_at, j.updated_at as job_updated_at
         FROM image_generation_tasks t
         JOIN image_generation_jobs j ON j.id = t.job_id
        WHERE t.id = ?
        LIMIT 1`,
      taskId,
    ) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }
    const task = mapTaskRow(row);
    const job: ImageGenerationJobRow = {
      id: String(row.job_id_ref || ""),
      userEmail: String(row.job_user_email || ""),
      projectId: typeof row.job_project_id === "string" ? row.job_project_id : null,
      intent: typeof row.job_intent === "string" ? row.job_intent : null,
      ratio: typeof row.job_ratio === "string" ? row.job_ratio : null,
      imageModelPolicy: typeof row.job_image_model_policy === "string" ? row.job_image_model_policy : null,
      idempotencyKey: typeof row.job_idempotency_key === "string" ? row.job_idempotency_key : null,
      runId: typeof row.job_run_id === "string" ? row.job_run_id : null,
      status: String(row.job_status || "queued") as ImageGenerationJobStatus,
      errorCode: typeof row.job_error_code === "string" ? row.job_error_code : null,
      errorMessage: typeof row.job_error_message === "string" ? row.job_error_message : null,
      requestJson: typeof row.job_request_json === "string" ? row.job_request_json : null,
      createdAt: String(row.job_created_at || ""),
      updatedAt: String(row.job_updated_at || ""),
    };
    return { task, job };
  }
  const { db } = getDb();
  const row = db
    .prepare(
      `SELECT t.*, j.user_email as job_user_email, j.project_id as job_project_id, j.id as job_id_ref,
              j.intent as job_intent, j.ratio as job_ratio, j.image_model_policy as job_image_model_policy,
              j.idempotency_key as job_idempotency_key, j.run_id as job_run_id, j.status as job_status, j.error_code as job_error_code,
              j.error_message as job_error_message, j.request_json as job_request_json,
              j.created_at as job_created_at, j.updated_at as job_updated_at
         FROM image_generation_tasks t
         JOIN image_generation_jobs j ON j.id = t.job_id
        WHERE t.id = ?
        LIMIT 1`,
    )
    .get(taskId) as Record<string, unknown> | undefined;
  if (!row) {
    return null;
  }
  const task = mapTaskRow(row);
  const job: ImageGenerationJobRow = {
    id: String(row.job_id_ref || ""),
    userEmail: String(row.job_user_email || ""),
    projectId: typeof row.job_project_id === "string" ? row.job_project_id : null,
    intent: typeof row.job_intent === "string" ? row.job_intent : null,
    ratio: typeof row.job_ratio === "string" ? row.job_ratio : null,
    imageModelPolicy: typeof row.job_image_model_policy === "string" ? row.job_image_model_policy : null,
    idempotencyKey: typeof row.job_idempotency_key === "string" ? row.job_idempotency_key : null,
    runId: typeof row.job_run_id === "string" ? row.job_run_id : null,
    status: String(row.job_status || "queued") as ImageGenerationJobStatus,
    errorCode: typeof row.job_error_code === "string" ? row.job_error_code : null,
    errorMessage: typeof row.job_error_message === "string" ? row.job_error_message : null,
    requestJson: typeof row.job_request_json === "string" ? row.job_request_json : null,
    createdAt: String(row.job_created_at || ""),
    updatedAt: String(row.job_updated_at || ""),
  };
  return {
    task,
    job,
  };
}

export async function getImageGenerationJobById(jobId: string) {
  if (shouldUseBlobImageGenerationStore()) {
    const manifest = await readStoredManifest(jobId);
    return manifest ?? null;
  }
  if (hasManagedDatabase()) {
    const jobRow = await pgGet("SELECT * FROM image_generation_jobs WHERE id = ? LIMIT 1", jobId) as
      | Record<string, unknown>
      | undefined;
    if (!jobRow) {
      return null;
    }
    const taskRows = await pgAll(
      "SELECT * FROM image_generation_tasks WHERE job_id = ? ORDER BY task_index ASC, created_at ASC",
      jobId,
    ) as Array<Record<string, unknown>>;
    return {
      job: mapJobRow(jobRow),
      tasks: taskRows.map((row) => mapTaskRow(row)),
    };
  }
  const { db } = getDb();
  const jobRow = db
    .prepare("SELECT * FROM image_generation_jobs WHERE id = ? LIMIT 1")
    .get(jobId) as Record<string, unknown> | undefined;
  if (!jobRow) {
    return null;
  }
  const taskRows = db
    .prepare("SELECT * FROM image_generation_tasks WHERE job_id = ? ORDER BY task_index ASC, created_at ASC")
    .all(jobId) as Array<Record<string, unknown>>;

  return {
    job: mapJobRow(jobRow),
    tasks: taskRows.map((row) => mapTaskRow(row)),
  };
}

export async function syncImageGenerationJobFinalStatus(jobId: string) {
  const result = await getImageGenerationJobById(jobId);
  if (!result) {
    return null;
  }
  const { tasks } = result;
  if (!tasks.length) {
    await updateImageGenerationJobStatus({
      jobId,
      status: "failed",
      errorCode: "IMAGE_TASKS_EMPTY",
      errorMessage: "No image generation tasks were found for this job.",
    });
    return getImageGenerationJobById(jobId);
  }
  if (result.job.status === "billing_failed") {
    return result;
  }
  if (tasks.some((task) => task.status === "billing_failed")) {
    await updateImageGenerationJobStatus({
      jobId,
      status: "billing_failed",
      errorCode: "IMAGE_BILLING_FAILED",
      errorMessage: "Image generation billing failed. Provider generation was not started.",
    });
    return getImageGenerationJobById(jobId);
  }
  if (result.job.status === "billing_pending" || tasks.some((task) => task.status === "billing_pending")) {
    await updateImageGenerationJobStatus({ jobId, status: "billing_pending" });
    return getImageGenerationJobById(jobId);
  }
  const hasRunning = tasks.some((task) => task.status === "queued" || task.status === "generating" || task.status === "asset_downloading");
  if (hasRunning) {
    await updateImageGenerationJobStatus({
      jobId,
      status: "running",
    });
    return getImageGenerationJobById(jobId);
  }
  const successCount = tasks.filter((task) => task.status === "asset_ready").length;
  const failedCount = tasks.filter((task) => task.status === "failed" || task.status === "timed_out").length;
  if (successCount > 0 && failedCount === 0) {
    await updateImageGenerationJobStatus({
      jobId,
      status: "completed",
    });
  } else if (successCount > 0 && failedCount > 0) {
    await updateImageGenerationJobStatus({
      jobId,
      status: "completed_with_errors",
      errorCode: "IMAGE_PARTIAL_FAILED",
      errorMessage: `${failedCount} task(s) failed.`,
    });
  } else {
    const allTimedOut = failedCount > 0 && failedCount === tasks.length && tasks.every((task) => task.status === "timed_out");
    const firstFailedTask = tasks.find((task) => task.status === "failed" || task.status === "timed_out");
    await updateImageGenerationJobStatus({
      jobId,
      status: allTimedOut ? "timed_out" : "failed",
      errorCode: firstFailedTask?.errorCode || (allTimedOut ? "IMAGE_ALL_TIMED_OUT" : "IMAGE_ALL_FAILED"),
      errorMessage:
        firstFailedTask?.errorMessage ||
        (allTimedOut ? "All image generation tasks timed out." : "All image generation tasks failed."),
    });
  }
  return getImageGenerationJobById(jobId);
}

function readJobBillingContext(job: ImageGenerationJobRow) {
  try {
    const snapshot = job.requestJson ? JSON.parse(job.requestJson) : null;
    const billing = snapshot?.billing ?? {};
    return {
      imageCreditsPerTask: Math.max(0, Math.round(Number(billing.imageCreditsPerTask ?? 0))),
      projectTitle:
        typeof billing.projectTitle === "string" && billing.projectTitle.trim()
          ? billing.projectTitle.trim().slice(0, 240)
          : null,
    };
  } catch {
    return {
      imageCreditsPerTask: 0,
      projectTitle: null,
    };
  }
}

export async function applyRefundsForFailedImageGenerationTasks(input: {
  job: ImageGenerationJobRow;
  tasks: ImageGenerationTaskRow[];
  source?: string;
}) {
  const billing = readJobBillingContext(input.job);
  if (billing.imageCreditsPerTask <= 0) {
    return { refundedCount: 0, refundedAmount: 0 };
  }
  let refundedCount = 0;
  let refundedAmount = 0;
  for (const task of input.tasks) {
    if (task.status !== "failed" && task.status !== "timed_out") {
      continue;
    }
    const refundResult = await applyImageGenerationRefundAtomic({
      refundKey: `${input.job.id}:${task.id}:image-task-failed:v1`,
      jobId: input.job.id,
      taskId: task.id,
      taskIndex: task.taskIndex,
      userEmail: input.job.userEmail,
      projectId: input.job.projectId ?? undefined,
      projectTitle:
        billing.projectTitle ||
        `${input.job.intent === "poster" ? "Poster" : "Storyboard"} Generation`,
      amount: billing.imageCreditsPerTask,
      reason: task.errorCode || task.status,
      description: `${
        billing.projectTitle || "Generation Project"
      } · Image task ${task.taskIndex} failed, credits refunded`,
    });
    if (!refundResult.applied) {
      continue;
    }
    refundedCount += 1;
    refundedAmount += billing.imageCreditsPerTask;
    logOpsEvent({
      category: "billing",
      action: "image_generation_refund_applied",
      status: "ok",
      source: input.source || "image_generation_jobs",
      userEmail: input.job.userEmail,
      projectId: input.job.projectId ?? undefined,
      message: `Refunded ${billing.imageCreditsPerTask} credits for a failed image task.`,
      details: {
        jobId: input.job.id,
        taskId: task.id,
        taskIndex: task.taskIndex,
        amount: billing.imageCreditsPerTask,
        reason: task.errorCode || task.status,
      },
    });
  }
  return { refundedCount, refundedAmount };
}

export async function expireAbandonedImageGenerationJob(input: {
  jobId: string;
  timeoutMs?: number;
  source?: string;
}) {
  const result = await getImageGenerationJobById(input.jobId);
  if (!result) {
    return null;
  }
  const billingPendingTasks = result.tasks.filter((task) => task.status === "billing_pending");
  if (result.job.status === "billing_pending" || billingPendingTasks.length) {
    const latestBillingProgressMs = Math.max(
      parseTimestampMs(result.job.updatedAt || result.job.createdAt),
      ...billingPendingTasks.map((task) => parseTimestampMs(task.updatedAt || task.createdAt)),
    );
    if (latestBillingProgressMs && Date.now() - latestBillingProgressMs >= BILLING_PENDING_TIMEOUT_MS) {
      const failedState = await markImageGenerationJobBillingFailed({
        jobId: result.job.id,
        errorCode: "IMAGE_BILLING_PENDING_ABANDONED",
        errorMessage: "Image generation billing was not completed in time. Provider generation was not started.",
      });
      return failedState;
    }
    return result;
  }
  const activeTasks = result.tasks.filter((task) => isActiveTaskStatus(task.status));
  if (!activeTasks.length) {
    return result;
  }
  const timeoutMs = Number.isFinite(input.timeoutMs)
    ? Math.max(300_000, Math.min(86_400_000, Number(input.timeoutMs)))
    : ABANDONED_JOB_TIMEOUT_MS;
  const latestActiveProgressMs = Math.max(
    parseTimestampMs(result.job.updatedAt || result.job.createdAt),
    ...activeTasks.map((task) => parseTimestampMs(task.updatedAt || task.createdAt)),
  );
  if (!latestActiveProgressMs || Date.now() - latestActiveProgressMs < timeoutMs) {
    return result;
  }

  const timeoutCode = "IMAGE_JOB_ABANDONED_TIMEOUT";
  const timeoutMessage =
    "Image generation stopped progressing for too long and was marked as failed. Credits have been refunded for unfinished image tasks.";
  for (const task of activeTasks) {
    await updateImageGenerationTask({
      taskId: task.id,
      status: "timed_out",
      errorCode: timeoutCode,
      errorMessage: timeoutMessage,
    });
    if (result.job.projectId) {
      await updateWorkspaceProjectPageImage({
        userEmail: result.job.userEmail,
        projectId: result.job.projectId,
        outputType: task.outputType || result.job.intent || "poster",
        pageIndex: task.taskIndex,
        taskId: task.id,
        status: "timed_out",
        errorCode: timeoutCode,
      });
    }
  }

  if (shouldLogAbandonedJob(result.job.id, timeoutCode)) {
    logOpsEvent({
      category: "image",
      action: "image_generation_job_abandoned",
      status: "error",
      source: input.source || "image_generation_jobs",
      userEmail: result.job.userEmail,
      projectId: result.job.projectId ?? undefined,
      code: timeoutCode,
      message: timeoutMessage,
      details: {
        jobId: result.job.id,
        runId: result.job.runId,
        taskIds: activeTasks.map((task) => task.id),
        taskIndexes: activeTasks.map((task) => task.taskIndex),
        taskStatuses: activeTasks.map((task) => task.status),
        providerUsed: activeTasks.map((task) => task.providerUsed).filter(Boolean),
        timeoutMs,
        lastProgressAt: new Date(latestActiveProgressMs).toISOString(),
      },
    });
  }

  const finalState = await syncImageGenerationJobFinalStatus(result.job.id);
  if (!finalState) {
    return null;
  }
  await applyRefundsForFailedImageGenerationTasks({
    job: finalState.job,
    tasks: finalState.tasks,
    source: input.source || "image_generation_jobs",
  });
  return finalState;
}

export async function sweepAbandonedImageGenerationJobsForUser(input: {
  userEmail: string;
  limit?: number;
  timeoutMs?: number;
  source?: string;
}) {
  const userEmail = input.userEmail.trim().toLowerCase();
  if (!userEmail) {
    return [] as Array<Awaited<ReturnType<typeof expireAbandonedImageGenerationJob>>>;
  }
  const limit = Math.max(1, Math.min(50, Math.round(Number(input.limit || 10))));
  let candidateJobIds: string[] = [];

  if (shouldUseBlobImageGenerationStore()) {
    const index = await readBlobJson<StoredImageGenerationActiveJobsIndex>(
      getImageGenerationActiveJobsIndexPath(userEmail),
    );
    candidateJobIds = (Array.isArray(index?.jobIds) ? index.jobIds : []).slice(0, limit);
  } else if (hasManagedDatabase()) {
    const rows = (await pgAll(
      `SELECT id
         FROM image_generation_jobs
        WHERE user_email = ? AND status IN ('queued', 'running')
        ORDER BY updated_at ASC, created_at ASC
        LIMIT ?`,
      userEmail,
      limit,
    )) as Array<{ id?: string }>;
    candidateJobIds = rows.map((row) => String(row.id || "")).filter(Boolean);
  } else {
    const { db } = getDb();
    const rows = db
      .prepare(
        `SELECT id
           FROM image_generation_jobs
          WHERE user_email = ? AND status IN ('queued', 'running')
          ORDER BY updated_at ASC, created_at ASC
          LIMIT ?`,
      )
      .all(userEmail, limit) as Array<{ id?: string }>;
    candidateJobIds = rows.map((row) => String(row.id || "")).filter(Boolean);
  }

  const results = [] as Array<Awaited<ReturnType<typeof expireAbandonedImageGenerationJob>>>;
  for (const jobId of candidateJobIds) {
    results.push(
      await expireAbandonedImageGenerationJob({
        jobId,
        timeoutMs: input.timeoutMs,
        source: input.source || "image_generation_jobs_sweeper",
      }),
    );
  }
  return results;
}

function getImageAssetDir() {
  const configured = (process.env.IMAGE_ASSET_DIR || "").trim();
  if (configured) {
    return configured;
  }
  if (process.env.NODE_ENV === "production") {
    return "/tmp/knowlens-image-assets";
  }
  return path.join(process.cwd(), "runtime-logs", "image-assets");
}

function shouldUseBlobAssetStore() {
  const enabled = parseBooleanEnv(
    "IMAGE_GENERATION_USE_BLOB_ASSET_STORE",
    process.env.NODE_ENV === "production",
  );
  return enabled && Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

function isBlobAssetPath(assetPath: string) {
  const normalized = assetPath.trim();
  return normalized.startsWith("workspace-images/");
}

function isLikelyAbsoluteLocalPath(assetPath: string) {
  const normalized = assetPath.trim();
  return normalized.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(normalized);
}

function extensionFromMimeType(mimeType: string) {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized === "image/png") return ".png";
  if (normalized === "image/jpeg" || normalized === "image/jpg") return ".jpg";
  if (normalized === "image/webp") return ".webp";
  if (normalized === "image/gif") return ".gif";
  return ".png";
}

export async function persistRemoteImageAsset(input: {
  taskId: string;
  projectId?: string | null;
  sourceUrl: string;
  timeoutMs?: number;
}) {
  const sourceUrl = normalizeText(input.sourceUrl, 2000);
  if (!sourceUrl) {
    throw new Error("IMAGE_DOWNLOAD_FAILED: empty image source URL.");
  }
  const timeoutMs = Number.isFinite(input.timeoutMs) ? Math.max(10_000, Number(input.timeoutMs)) : 90_000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(sourceUrl, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "image/*,*/*;q=0.8",
      },
    });
    if (!response.ok) {
      throw new Error(`IMAGE_DOWNLOAD_FAILED: asset download failed (${response.status}).`);
    }
    const mimeType = normalizeText(response.headers.get("content-type") || "image/png", 120).split(";")[0] || "image/png";
    const mimeTypeLower = mimeType.toLowerCase();
    if (
      mimeTypeLower !== "image/png" &&
      mimeTypeLower !== "image/jpeg" &&
      mimeTypeLower !== "image/jpg" &&
      mimeTypeLower !== "image/webp"
    ) {
      throw new Error(`IMAGE_DOWNLOAD_INVALID_CONTENT_TYPE: unsupported content-type ${mimeType}.`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length) {
      throw new Error("IMAGE_DOWNLOAD_FAILED: asset download returned empty bytes.");
    }
    const storageKey = buildImageAssetStorageKey({
      projectId: input.projectId ?? null,
      taskId: input.taskId,
      mimeType,
    });
    if (shouldUseBlobAssetStore()) {
      const blobResult = await putBlob(storageKey, bytes, {
        access: "public",
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType: mimeType,
        cacheControlMaxAge: 60 * 60 * 24 * 30,
      });
      return {
        assetPath: blobResult.pathname,
        storageKey: blobResult.pathname,
        renderUrl: null,
        mimeType,
        byteLength: bytes.length,
      };
    }
    if (process.env.NODE_ENV === "production") {
      throw new Error("IMAGE_STORAGE_NOT_CONFIGURED: production asset storage is not configured.");
    }
    const assetDir = getImageAssetDir();
    mkdirSync(assetDir, { recursive: true });
    const assetPath = path.join(assetDir, storageKey);
    mkdirSync(path.dirname(assetPath), { recursive: true });
    await writeFile(assetPath, bytes);
    return {
      assetPath,
      storageKey,
      renderUrl: null,
      mimeType,
      byteLength: bytes.length,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function readImageAsset(taskId: string) {
  const task = await getImageGenerationTaskById(taskId);
  if (!task) {
    return null;
  }
  if (!task.assetPath) {
    // Backward-compat for legacy rows that only store a remote URL.
    const remoteRenderUrl = typeof task.renderUrl === "string" ? task.renderUrl.trim() : "";
    if (remoteRenderUrl && /^https?:\/\//i.test(remoteRenderUrl)) {
      return {
        task,
        redirectUrl: remoteRenderUrl,
        bytes: null,
        mimeType: task.mimeType || "image/png",
      };
    }
    return null;
  }
  if (isBlobAssetPath(task.assetPath) && !isLikelyAbsoluteLocalPath(task.assetPath)) {
    if (process.env.NODE_ENV === "production" && !shouldUseBlobAssetStore()) {
      return null;
    }
    const blobResult = await getBlob(task.assetPath, {
      access: "public",
    });
    if (!blobResult || blobResult.statusCode !== 200 || !blobResult.stream) {
      return null;
    }
    const bytes = Buffer.from(await new Response(blobResult.stream).arrayBuffer());
    return {
      task,
      redirectUrl: null,
      bytes,
      mimeType: task.mimeType || blobResult.blob.contentType || "image/png",
    };
  }
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  const bytes = await readFile(task.assetPath);
  return {
    task,
    redirectUrl: null,
    bytes,
    mimeType: task.mimeType || "image/png",
  };
}
