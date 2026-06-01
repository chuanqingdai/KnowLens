import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { getDb } from "./db";

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
  remaining: number;
};

type UploadJobInput = {
  userScope: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  sourceKind: "file" | "web" | "youtube" | "podcast";
  sourceUrl?: string;
  inputPath?: string;
  sourceText?: string;
};

type OpsEventStatus = "ok" | "error" | "info";

type OpsEventInput = {
  category: string;
  action: string;
  status: OpsEventStatus;
  source?: string;
  code?: string;
  message?: string;
  userEmail?: string;
  projectId?: string;
  details?: unknown;
};

export type OpsEventRow = {
  id: string;
  category: string;
  action: string;
  status: OpsEventStatus;
  source: string | null;
  code: string | null;
  message: string | null;
  userEmail: string | null;
  projectId: string | null;
  detailsJson: string | null;
  createdAt: string;
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeScope(email?: string | null) {
  const value = (email ?? "").trim().toLowerCase();
  return value || "guest";
}

export { normalizeScope };

export function enforceRateLimit(input: {
  scopeKey: string;
  endpoint: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const { db } = getDb();
  const now = Date.now();
  const windowStart = Math.floor(now / input.windowMs) * input.windowMs;
  const row = db
    .prepare(
      "SELECT count FROM api_rate_limits WHERE scope_key = ? AND endpoint = ? AND window_start = ?",
    )
    .get(input.scopeKey, input.endpoint, windowStart) as { count?: number } | undefined;
  const count = row?.count ?? 0;
  if (count >= input.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((windowStart + input.windowMs - now) / 1000)),
      remaining: 0,
    };
  }

  db.prepare(
    `INSERT INTO api_rate_limits (scope_key, endpoint, window_start, count)
     VALUES (?, ?, ?, 1)
     ON CONFLICT(scope_key, endpoint, window_start)
     DO UPDATE SET count = count + 1`,
  ).run(input.scopeKey, input.endpoint, windowStart);

  return {
    allowed: true,
    remaining: input.limit - count - 1,
  };
}

export function upsertUser(input: {
  email: string;
  name: string;
  role: "user" | "admin";
}) {
  const { db } = getDb();
  const email = input.email.trim().toLowerCase();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id?: string } | undefined;
  const id = existing?.id ?? `u-${randomUUID()}`;
  db.prepare(
    `INSERT INTO users (id, email, name, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       name = excluded.name,
       role = excluded.role,
       updated_at = excluded.updated_at`,
  ).run(id, email, input.name, input.role, nowIso(), nowIso());
  return id;
}

export function listProjectsByUser(email: string) {
  const { db } = getDb();
  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email.trim().toLowerCase()) as
    | { id?: string }
    | undefined;
  if (!user?.id) {
    return [] as Array<Record<string, unknown>>;
  }
  return db
    .prepare("SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC")
    .all(user.id) as Array<Record<string, unknown>>;
}

export function saveProject(input: {
  id?: string;
  userEmail: string;
  title: string;
  status: string;
  format?: string;
  duration?: string;
  updatedAt?: string;
}) {
  const { db } = getDb();
  const userId = upsertUser({
    email: input.userEmail,
    name: input.userEmail.split("@")[0] || input.userEmail,
    role: "user",
  });
  const id = input.id ?? `p-${randomUUID()}`;
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  db.prepare(
    `INSERT INTO projects (id, user_id, title, status, format, duration, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       status = excluded.status,
       format = excluded.format,
       duration = excluded.duration,
       updated_at = excluded.updated_at`,
  ).run(id, userId, input.title, input.status, input.format ?? null, input.duration ?? null, updatedAt);
  return id;
}

export function appendCreditRecordDb(input: {
  userEmail?: string;
  userId?: string;
  projectId?: string;
  projectTitle?: string;
  type: "consume" | "topup" | "refund";
  description: string;
  delta: number;
}) {
  const { db } = getDb();
  const scopeEmail = normalizeScope(input.userEmail);
  const rows = db
    .prepare("SELECT balance FROM credit_records WHERE user_email = ? ORDER BY created_at DESC, id DESC LIMIT 1")
    .all(scopeEmail) as Array<{ balance?: number }>;
  const latestBalance = rows[0]?.balance ?? 50;
  const balance = latestBalance + input.delta;
  const id = `record-${randomUUID()}`;
  db.prepare(
    `INSERT INTO credit_records (id, created_at, type, description, delta, balance, user_id, user_email, project_id, project_title)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    nowIso(),
    input.type,
    input.description,
    input.delta,
    balance,
    input.userId ?? null,
    input.userEmail ?? null,
    input.projectId ?? null,
    input.projectTitle ?? null,
  );
  return { id, balance };
}

export function listCreditRecords(email?: string | null) {
  const { db } = getDb();
  const scopeEmail = normalizeScope(email);
  return db
    .prepare("SELECT * FROM credit_records WHERE user_email = ? ORDER BY created_at DESC, id DESC")
    .all(scopeEmail);
}

export function saveSubscriptionDb(input: {
  userEmail: string;
  planId: string;
  planName: string;
  cycle: "monthly" | "yearly";
  status: "inactive" | "active" | "canceling" | "canceled";
  startedAt: string;
  renewAt: string;
  canceledAt?: string;
}) {
  const { db } = getDb();
  const userId = upsertUser({
    email: input.userEmail,
    name: input.userEmail.split("@")[0] || input.userEmail,
    role: "user",
  });
  const id = `sub-${randomUUID()}`;
  db.prepare(
    `INSERT INTO subscriptions (id, user_id, plan_id, plan_name, cycle, status, started_at, renew_at, canceled_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    userId,
    input.planId,
    input.planName,
    input.cycle,
    input.status,
    input.startedAt,
    input.renewAt,
    input.canceledAt ?? null,
    nowIso(),
    nowIso(),
  );
  return id;
}

export function getLatestSubscriptionDb(email: string) {
  const { db } = getDb();
  const row = db
    .prepare(
      `SELECT s.* FROM subscriptions s
       INNER JOIN users u ON u.id = s.user_id
       WHERE u.email = ?
       ORDER BY s.updated_at DESC, s.created_at DESC
       LIMIT 1`,
    )
    .get(email.trim().toLowerCase());
  return row ?? null;
}

export function replyFeedbackDb(input: {
  recordId: string;
  reply: string;
  repliedBy: string;
}) {
  const { db } = getDb();
  db.prepare(
    `UPDATE feedback_tickets
     SET admin_reply = ?, replied_at = ?, replied_by = ?, status = 'replied', updated_at = ?
     WHERE id = ?`,
  ).run(input.reply.trim(), nowIso(), input.repliedBy, nowIso(), input.recordId);
}

export function listFeedbackDb() {
  const { db } = getDb();
  return db
    .prepare("SELECT * FROM feedback_tickets ORDER BY created_at DESC, id DESC")
    .all();
}

export function insertFeedbackDb(input: {
  type: string;
  detail: string;
  contact: string;
  attachments: string[];
  submitterEmail?: string;
  submitterName?: string;
}) {
  const { db } = getDb();
  const id = `fb-${randomUUID()}`;
  db.prepare(
    `INSERT INTO feedback_tickets (id, type, detail, contact, attachments_json, submitter_email, submitter_name, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
  ).run(
    id,
    input.type,
    input.detail,
    input.contact,
    JSON.stringify(input.attachments),
    input.submitterEmail ?? null,
    input.submitterName ?? null,
    nowIso(),
  );
  return id;
}

export function createUploadJob(input: UploadJobInput) {
  const { db } = getDb();
  const id = `upload-${randomUUID()}`;
  db.prepare(
    `INSERT INTO upload_jobs (id, user_scope, file_name, mime_type, file_size, source_kind, source_url, input_path, source_text, status, progress, attempts, max_attempts, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', 0, 0, 3, ?, ?)`,
  ).run(
    id,
    input.userScope,
    input.fileName,
    input.mimeType,
    input.fileSize,
    input.sourceKind,
    input.sourceUrl ?? null,
    input.inputPath ?? null,
    input.sourceText ?? null,
    nowIso(),
    nowIso(),
  );
  return id;
}

export function listUploadJobs(userScope?: string) {
  const { db } = getDb();
  if (!userScope) {
    return db.prepare("SELECT * FROM upload_jobs ORDER BY created_at DESC").all();
  }
  return db
    .prepare("SELECT * FROM upload_jobs WHERE user_scope = ? ORDER BY created_at DESC")
    .all(normalizeScope(userScope));
}

export function getCaseMetricDelta(caseId: string, userScope: string) {
  const { db } = getDb();
  return (
    db
      .prepare(
        "SELECT views_delta as viewsDelta, likes_delta as likesDelta, liked FROM featured_case_metrics WHERE case_id = ? AND user_scope = ?",
      )
      .get(caseId, normalizeScope(userScope)) ?? null
  ) as
    | { viewsDelta?: number; likesDelta?: number; liked?: number }
    | null;
}

export function toggleCaseLikeDb(caseId: string, userScope: string) {
  const { db } = getDb();
  const scope = normalizeScope(userScope);
  const existing = db
    .prepare("SELECT likes_delta as likesDelta, liked FROM featured_case_metrics WHERE case_id = ? AND user_scope = ?")
    .get(caseId, scope) as { likesDelta?: number; liked?: number } | undefined;
  const nextLiked = existing?.liked ? 0 : 1;
  const likesDelta = (existing?.likesDelta ?? 0) + (nextLiked ? 1 : -1);
  db.prepare(
    `INSERT INTO featured_case_metrics (case_id, user_scope, views_delta, likes_delta, liked, updated_at)
     VALUES (?, ?, 0, ?, ?, datetime('now'))
     ON CONFLICT(case_id, user_scope)
     DO UPDATE SET likes_delta = ?, liked = ?, updated_at = datetime('now')`,
  ).run(caseId, scope, likesDelta, nextLiked, likesDelta, nextLiked);
  return { liked: Boolean(nextLiked), likesDelta };
}

export function updateUploadJob(
  jobId: string,
  patch: Partial<{
    status: string;
    progress: number;
    attempts: number;
    errorMessage: string | null;
    errorCode: string | null;
    storageKey: string | null;
    publicUrl: string | null;
    resultExcerpt: string | null;
    resultText: string | null;
    resultKind: string | null;
    sourceUrl: string | null;
  }>,
) {
  const { db } = getDb();
  const current = db.prepare("SELECT * FROM upload_jobs WHERE id = ?").get(jobId) as Record<string, unknown> | undefined;
  if (!current) {
    return null;
  }
  const readValue = <T>(snakeKey: string, camelKey: string) =>
    (current[snakeKey] as T | undefined) ?? (current[camelKey] as T | undefined);
  const next = {
    status: patch.status ?? (current.status as string),
    progress: patch.progress ?? (current.progress as number),
    attempts: patch.attempts ?? (current.attempts as number),
    errorMessage: patch.errorMessage ?? readValue<string>("error_message", "errorMessage") ?? null,
    errorCode: patch.errorCode ?? readValue<string>("error_code", "errorCode") ?? null,
    storageKey: patch.storageKey ?? readValue<string>("storage_key", "storageKey") ?? null,
    publicUrl: patch.publicUrl ?? readValue<string>("public_url", "publicUrl") ?? null,
    resultExcerpt: patch.resultExcerpt ?? readValue<string>("result_excerpt", "resultExcerpt") ?? null,
    resultText: patch.resultText ?? readValue<string>("result_text", "resultText") ?? null,
    resultKind: patch.resultKind ?? readValue<string>("result_kind", "resultKind") ?? null,
    sourceUrl: patch.sourceUrl ?? readValue<string>("source_url", "sourceUrl") ?? null,
  };
  db.prepare(
    `UPDATE upload_jobs
     SET status = ?, progress = ?, attempts = ?, error_message = ?, error_code = ?, storage_key = ?, public_url = ?, result_excerpt = ?, result_text = ?, result_kind = ?, source_url = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    next.status,
    next.progress,
    next.attempts,
    next.errorMessage,
    next.errorCode,
    next.storageKey,
    next.publicUrl,
    next.resultExcerpt,
    next.resultText,
    next.resultKind,
    next.sourceUrl,
    nowIso(),
    jobId,
  );
  return next;
}

export function hasBillingFulfillment(sessionId: string) {
  const { db } = getDb();
  const row = db
    .prepare("SELECT session_id as sessionId FROM billing_fulfillments WHERE session_id = ? LIMIT 1")
    .get(sessionId) as { sessionId?: string } | undefined;
  return Boolean(row?.sessionId);
}

export function recordBillingFulfillment(input: {
  sessionId: string;
  userEmail: string;
  planId: string;
  cycle: "monthly" | "yearly";
  checkoutSource?: string;
  checkoutStatus?: string;
}) {
  const { db } = getDb();
  db.prepare(
    `INSERT INTO billing_fulfillments (session_id, user_email, plan_id, cycle, checkout_source, checkout_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.sessionId,
    normalizeScope(input.userEmail),
    input.planId,
    input.cycle,
    input.checkoutSource?.trim().slice(0, 64) || null,
    input.checkoutStatus?.trim().slice(0, 32) || "fulfilled",
    nowIso(),
  );
}

export function applyBillingFulfillmentAtomic(input: {
  sessionId: string;
  userEmail: string;
  planId: string;
  planName: string;
  cycle: "monthly" | "yearly";
  monthlyCredits: number;
  startedAt: string;
  renewAt: string;
  checkoutSource?: string;
}) {
  const { db } = getDb();
  const normalizedEmail = normalizeScope(input.userEmail);

  db.exec("BEGIN IMMEDIATE");
  try {
    const existing = db
      .prepare("SELECT session_id as sessionId FROM billing_fulfillments WHERE session_id = ? LIMIT 1")
      .get(input.sessionId) as { sessionId?: string } | undefined;
    if (existing?.sessionId) {
      db.exec("COMMIT");
      return { applied: false as const };
    }

    const userExisting = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail) as
      | { id?: string }
      | undefined;
    const userId = userExisting?.id ?? `u-${randomUUID()}`;
    db.prepare(
      `INSERT INTO users (id, email, name, role, created_at, updated_at)
       VALUES (?, ?, ?, 'user', ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         updated_at = excluded.updated_at`,
    ).run(
      userId,
      normalizedEmail,
      normalizedEmail.split("@")[0] || "User",
      nowIso(),
      nowIso(),
    );

    const subscriptionId = `sub-${randomUUID()}`;
    db.prepare(
      `INSERT INTO subscriptions (id, user_id, plan_id, plan_name, cycle, status, started_at, renew_at, canceled_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?, null, ?, ?)`,
    ).run(
      subscriptionId,
      userId,
      input.planId,
      input.planName,
      input.cycle,
      input.startedAt,
      input.renewAt,
      nowIso(),
      nowIso(),
    );

    const balanceRows = db
      .prepare("SELECT balance FROM credit_records WHERE user_email = ? ORDER BY created_at DESC, id DESC LIMIT 1")
      .all(normalizedEmail) as Array<{ balance?: number }>;
    const previousBalance = balanceRows[0]?.balance ?? 50;
    const nextBalance = previousBalance + input.monthlyCredits;
    const creditRecordId = `record-${randomUUID()}`;
    db.prepare(
      `INSERT INTO credit_records (id, created_at, type, description, delta, balance, user_id, user_email, project_id, project_title)
       VALUES (?, ?, 'topup', ?, ?, ?, ?, ?, null, null)`,
    ).run(
      creditRecordId,
      nowIso(),
      `${input.planName} ${input.cycle} purchase credited${input.checkoutSource ? ` [source:${input.checkoutSource}]` : ""}`,
      input.monthlyCredits,
      nextBalance,
      userId,
      normalizedEmail,
    );

    db.prepare(
      `INSERT INTO billing_fulfillments (session_id, user_email, plan_id, cycle, checkout_source, checkout_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      input.sessionId,
      normalizedEmail,
      input.planId,
      input.cycle,
      input.checkoutSource?.trim().slice(0, 64) || null,
      "fulfilled",
      nowIso(),
    );

    db.exec("COMMIT");
    return { applied: true as const };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function clampText(input: string | undefined, max: number) {
  if (!input) {
    return "";
  }
  return input.trim().slice(0, max);
}

function stringifyDetails(details: unknown) {
  if (details === undefined) {
    return null;
  }
  try {
    return JSON.stringify(details).slice(0, 4000);
  } catch {
    return null;
  }
}

function getOpsLogDir() {
  const configured = (process.env.OPS_LOG_DIR || "").trim();
  if (configured) {
    return configured;
  }
  if (process.env.NODE_ENV === "production") {
    return "/tmp/knowlens-ops-logs";
  }
  return path.join(process.cwd(), "runtime-logs", "ops-events");
}

function sanitizeFilePart(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._-]+/g, "_")
    .slice(0, 180);
}

function buildUserLogFilePath(userEmail?: string | null) {
  const safeEmail = sanitizeFilePart(userEmail || "anonymous");
  return path.join(getOpsLogDir(), "users", `${safeEmail}.jsonl`);
}

function shouldWriteOpsEventFile() {
  const override = (process.env.KNOWLENS_FILE_OPS_LOG || "").trim();
  if (override === "1") {
    return true;
  }
  if (override === "0") {
    return false;
  }
  return process.env.NODE_ENV === "production";
}

function appendOpsEventFileRow(input: {
  id: string;
  category: string;
  action: string;
  status: OpsEventStatus;
  source: string | null;
  code: string | null;
  message: string | null;
  userEmail: string | null;
  projectId: string | null;
  details: unknown;
  createdAt: string;
}) {
  if (!shouldWriteOpsEventFile()) {
    return;
  }
  try {
    const row = {
      id: input.id,
      ts: input.createdAt,
      category: input.category,
      action: input.action,
      status: input.status,
      source: input.source,
      code: input.code,
      message: input.message,
      userEmail: input.userEmail,
      projectId: input.projectId,
      details: input.details,
    };
    const text = `${JSON.stringify(row)}\n`;
    const allFile = path.join(getOpsLogDir(), "all-events.jsonl");
    const userFile = buildUserLogFilePath(input.userEmail);
    mkdirSync(path.dirname(allFile), { recursive: true });
    mkdirSync(path.dirname(userFile), { recursive: true });
    appendFileSync(allFile, text, "utf8");
    appendFileSync(userFile, text, "utf8");
  } catch {
    // keep telemetry best-effort only
  }
}

export function readOpsLogFileByUserEmail(userEmail: string, limit = 2000) {
  const targetEmail = userEmail.trim().toLowerCase();
  if (!targetEmail) {
    return { path: "", lines: [] as string[] };
  }
  const safeLimit = Math.max(1, Math.min(5000, Math.round(limit)));
  const filePath = buildUserLogFilePath(targetEmail);
  if (existsSync(filePath)) {
    const raw = readFileSync(filePath, "utf8");
    const rows = raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (rows.length > 0) {
      return {
        path: filePath,
        lines: rows.slice(-safeLimit),
      };
    }
  }

  const safeEmailPart = sanitizeFilePart(targetEmail);
  const fallbackDirs = Array.from(
    new Set([
      getOpsLogDir(),
      path.join(process.cwd(), "runtime-logs", "ops-events"),
      "/tmp/knowlens-ops-logs",
    ]),
  );
  const fallbackFiles = fallbackDirs.flatMap((dir) => [
    path.join(dir, "users", `${safeEmailPart}.jsonl`),
    path.join(dir, "all-events.jsonl"),
  ]);
  for (const candidateFile of fallbackFiles) {
    if (!existsSync(candidateFile)) {
      continue;
    }
    const raw = readFileSync(candidateFile, "utf8");
    const rows = raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!rows.length) {
      continue;
    }
    const filtered = rows.filter((line) => {
      try {
        const parsed = JSON.parse(line) as { userEmail?: unknown };
        return (
          typeof parsed.userEmail === "string" &&
          parsed.userEmail.trim().toLowerCase() === targetEmail
        );
      } catch {
        return false;
      }
    });
    if (filtered.length > 0) {
      return {
        path: candidateFile,
        lines: filtered.slice(-safeLimit),
      };
    }
  }

  return {
    path: filePath,
    lines: [] as string[],
  };
}

export function logOpsEvent(input: OpsEventInput) {
  try {
    const { db } = getDb();
    const id = `evt-${randomUUID()}`;
    const category = clampText(input.category, 48) || "unknown";
    const action = clampText(input.action, 64) || "unknown";
    const status = (clampText(input.status, 16) || "info") as OpsEventStatus;
    const source = clampText(input.source, 64) || null;
    const code = clampText(input.code, 64) || null;
    const message = clampText(input.message, 500) || null;
    const userEmail = clampText(input.userEmail, 160).toLowerCase() || null;
    const projectId = clampText(input.projectId, 120) || null;
    const detailsJson = stringifyDetails(input.details);
    const createdAt = nowIso();
    db.prepare(
      `INSERT INTO ops_events (id, category, action, status, source, code, message, user_email, project_id, details_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      category,
      action,
      status,
      source,
      code,
      message,
      userEmail,
      projectId,
      detailsJson,
      createdAt,
    );
    appendOpsEventFileRow({
      id,
      category,
      action,
      status,
      source,
      code,
      message,
      userEmail,
      projectId,
      details: input.details,
      createdAt,
    });
    return id;
  } catch {
    return null;
  }
}

export function getCheckoutSourceDailyStats(input?: { days?: number }) {
  const { db } = getDb();
  const days = Math.min(90, Math.max(1, Math.round(input?.days ?? 14)));
  const rows = db
    .prepare(
      `WITH base AS (
         SELECT
           substr(created_at, 1, 10) AS day,
           COALESCE(NULLIF(trim(source), ''), 'unknown') AS source,
           action,
           status
         FROM ops_events
         WHERE category = 'billing'
           AND action IN ('checkout_attempt', 'checkout_finalize_success')
           AND created_at >= datetime('now', ?)
       )
       SELECT
         day,
         source,
         SUM(CASE WHEN action = 'checkout_attempt' THEN 1 ELSE 0 END) AS attempts,
         SUM(CASE WHEN action = 'checkout_finalize_success' THEN 1 ELSE 0 END) AS successes
       FROM base
       GROUP BY day, source
       ORDER BY day DESC, source ASC`,
    )
    .all(`-${days} day`) as Array<{
    day?: string;
    source?: string;
    attempts?: number;
    successes?: number;
  }>;

  return rows.map((row) => {
    const attempts = Number(row.attempts ?? 0);
    const successes = Number(row.successes ?? 0);
    const successRate = attempts > 0 ? Number(((successes / attempts) * 100).toFixed(2)) : 0;
    return {
      day: row.day ?? "",
      source: row.source ?? "unknown",
      attempts,
      successes,
      successRate,
    };
  });
}

export function getAdminOpsSummary(input?: { errorLimit?: number; checkoutDays?: number }) {
  const { db } = getDb();
  const errorLimit = Math.min(200, Math.max(10, Math.round(input?.errorLimit ?? 80)));
  const projectTotalRow = db.prepare("SELECT COUNT(*) as count FROM projects").get() as { count?: number } | undefined;
  const activeProjectRow = db
    .prepare(
      `SELECT COUNT(*) as count
       FROM projects
       WHERE LOWER(COALESCE(status, '')) IN ('进行中', 'in progress', 'in_progress', 'processing', 'queued')`,
    )
    .get() as { count?: number } | undefined;
  const totalProjectCount = Number(projectTotalRow?.count ?? 0);
  const activeProjectCount = Number(activeProjectRow?.count ?? 0);
  const checkoutStats = getCheckoutSourceDailyStats({ days: input?.checkoutDays ?? 14 });

  const errorRows = db
    .prepare(
      `SELECT
         id,
         category,
         action,
         status,
         source,
         code,
         message,
         user_email as userEmail,
         project_id as projectId,
         details_json as detailsJson,
         created_at as createdAt
       FROM ops_events
       WHERE status = 'error'
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(errorLimit) as Array<Record<string, unknown>>;

  const errorByCategory = db
    .prepare(
      `SELECT category, COUNT(*) as count
       FROM ops_events
       WHERE status = 'error'
       GROUP BY category
       ORDER BY count DESC`,
    )
    .all() as Array<{ category?: string; count?: number }>;

  const totalErrorCount = errorByCategory.reduce((sum, row) => sum + Number(row.count ?? 0), 0);

  return {
    projects: {
      total: totalProjectCount,
      active: activeProjectCount,
    },
    errors: {
      total: totalErrorCount,
      byCategory: errorByCategory.map((row) => ({
        category: row.category ?? "unknown",
        count: Number(row.count ?? 0),
      })),
      recent: errorRows.map((row) => ({
        id: String(row.id ?? ""),
        category: String(row.category ?? ""),
        action: String(row.action ?? ""),
        source: row.source ? String(row.source) : "unknown",
        code: row.code ? String(row.code) : null,
        message: row.message ? String(row.message) : "",
        userEmail: row.userEmail ? String(row.userEmail) : null,
        projectId: row.projectId ? String(row.projectId) : null,
        detailsJson: row.detailsJson ? String(row.detailsJson) : null,
        createdAt: String(row.createdAt ?? ""),
      })),
    },
    checkout: checkoutStats,
  };
}

export function listOpsEvents(input?: {
  userEmail?: string;
  projectId?: string;
  category?: string;
  action?: string;
  status?: string;
  source?: string;
  code?: string;
  limit?: number;
}) {
  const { db } = getDb();
  const filters: string[] = [];
  const params: Array<string | number> = [];

  const pushFilter = (column: string, value?: string) => {
    const normalized = clampText(value, 160);
    if (!normalized) {
      return;
    }
    filters.push(`${column} LIKE ?`);
    params.push(`%${normalized.toLowerCase()}%`);
  };

  pushFilter("LOWER(COALESCE(user_email, ''))", input?.userEmail);
  pushFilter("LOWER(COALESCE(project_id, ''))", input?.projectId);
  pushFilter("LOWER(COALESCE(category, ''))", input?.category);
  pushFilter("LOWER(COALESCE(action, ''))", input?.action);
  pushFilter("LOWER(COALESCE(status, ''))", input?.status);
  pushFilter("LOWER(COALESCE(source, ''))", input?.source);
  pushFilter("LOWER(COALESCE(code, ''))", input?.code);

  const limit = Math.min(500, Math.max(1, Math.round(input?.limit ?? 120)));
  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `SELECT
         id,
         category,
         action,
         status,
         source,
         code,
         message,
         user_email as userEmail,
         project_id as projectId,
         details_json as detailsJson,
         created_at as createdAt
       FROM ops_events
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(...params, limit) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: String(row.id ?? ""),
    category: String(row.category ?? ""),
    action: String(row.action ?? ""),
    status: (String(row.status ?? "info") || "info") as OpsEventStatus,
    source: row.source ? String(row.source) : null,
    code: row.code ? String(row.code) : null,
    message: row.message ? String(row.message) : null,
    userEmail: row.userEmail ? String(row.userEmail) : null,
    projectId: row.projectId ? String(row.projectId) : null,
    detailsJson: row.detailsJson ? String(row.detailsJson) : null,
    createdAt: String(row.createdAt ?? ""),
  })) satisfies OpsEventRow[];
}
