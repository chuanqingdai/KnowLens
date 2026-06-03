import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get as getBlob, put as putBlob } from "@vercel/blob";
import { getDb } from "@/lib/server/db";

export type ImageGenerationJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "completed_with_errors"
  | "failed";

export type ImageGenerationTaskStatus =
  | "queued"
  | "generating"
  | "asset_downloading"
  | "asset_ready"
  | "failed";

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

function nowIso() {
  return new Date().toISOString();
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

async function readBlobJson<T>(pathname: string): Promise<T | null> {
  const blob = await getBlob(pathname, {
    access: "private",
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
    access: "private",
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
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
  tasks: ImageGenerationTaskPayload[];
}): Promise<{
  jobId: string;
  tasks: ImageGenerationTaskRow[];
}> {
  const jobId = `imgjob-${randomUUID()}`;
  const createdAt = nowIso();
  const userEmail = input.userEmail.trim().toLowerCase();
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
      status: "queued",
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
      status: "queued",
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

  const { db } = getDb();
  db.prepare(
    `INSERT INTO image_generation_jobs (
      id, user_email, project_id, intent, ratio, image_model_policy, idempotency_key, run_id, status,
      error_code, error_message, request_json, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', null, null, ?, ?, ?)`,
  ).run(
    jobId,
    userEmail,
    normalizeOptionalText(input.projectId, 120),
    normalizeOptionalText(input.intent, 48),
    normalizeOptionalText(input.ratio, 64),
    normalizeOptionalText(input.imageModelPolicy, 120),
    normalizeOptionalText(input.idempotencyKey, 220),
    normalizeOptionalText(input.runId, 120),
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
    VALUES (?, ?, ?, ?, ?, ?, ?, null, 'queued', 0, null, null, null, null, null, null, null, null, ?, ?)`,
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
  const hasRunning = tasks.some((task) => task.status === "queued" || task.status === "generating" || task.status === "asset_downloading");
  if (hasRunning) {
    await updateImageGenerationJobStatus({
      jobId,
      status: "running",
    });
    return getImageGenerationJobById(jobId);
  }
  const successCount = tasks.filter((task) => task.status === "asset_ready").length;
  const failedCount = tasks.filter((task) => task.status === "failed").length;
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
    await updateImageGenerationJobStatus({
      jobId,
      status: "failed",
      errorCode: "IMAGE_ALL_FAILED",
      errorMessage: "All image generation tasks failed.",
    });
  }
  return getImageGenerationJobById(jobId);
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
