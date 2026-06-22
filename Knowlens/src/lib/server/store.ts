import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { findBillingPlan } from "@/lib/billing-plans";
import { DEFAULT_FREE_CREDIT_BALANCE } from "@/lib/credit-pricing";
import { getDb } from "./db";
import { ensureManagedUserPasswordSchema, hasManagedDatabase, pgAll, pgGet, pgRun, pgTransaction, pgTxGet, pgTxRun } from "./postgres";

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

const PASSWORD_HASH_PREFIX = "scrypt:v1";
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_ACCOUNT_EMAIL_PREFIX = "password:";

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString("hex");
  return `${PASSWORD_HASH_PREFIX}:${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash?: string | null) {
  if (!storedHash?.startsWith(`${PASSWORD_HASH_PREFIX}:`)) {
    return false;
  }
  try {
    const [, , salt, hashHex] = storedHash.split(":");
    if (!salt || !hashHex) {
      return false;
    }
    const expected = Buffer.from(hashHex, "hex");
    if (expected.length !== PASSWORD_KEY_LENGTH) {
      return false;
    }
    const actual = scryptSync(password, salt, expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function getPasswordAccountEmail(email: string) {
  return `${PASSWORD_ACCOUNT_EMAIL_PREFIX}${email.trim().toLowerCase()}`;
}

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

export type GenerationTaskStatusSummary = Record<string, number>;

export type GenerationOpsDetails = {
  runId?: string;
  jobId?: string;
  taskId?: string;
  taskIndex?: number;
  projectId?: string;
  idempotencyKeyHash?: string;
  refundKeyHash?: string;
  jobStatus?: string;
  taskStatus?: string;
  taskStatusSummary?: GenerationTaskStatusSummary;
  outputType?: string;
  aspectRatio?: string;
  ratio?: string;
  taskCount?: number;
  providerOrder?: string;
  providerUsed?: string;
  attempts?: number;
  promptHash?: string;
  promptLength?: number;
  creditsAmount?: number;
  creditRecordId?: string;
  renderUrlExists?: boolean;
  assetPathExists?: boolean;
  durationMs?: number;
  errorCode?: string;
  safeErrorMessage?: string;
};

type GenerationOpsEventInput = {
  action: string;
  status: OpsEventStatus;
  source?: string;
  code?: string;
  message?: string;
  userEmail?: string;
  projectId?: string;
  runId?: string;
  jobId?: string;
  taskId?: string;
  taskIndex?: number;
  idempotencyKey?: string;
  refundKey?: string;
  jobStatus?: string;
  taskStatus?: string;
  taskStatusSummary?: GenerationTaskStatusSummary;
  outputType?: string;
  aspectRatio?: string;
  ratio?: string;
  taskCount?: number;
  providerOrder?: string;
  providerUsed?: string;
  attempts?: number;
  promptText?: string;
  creditsAmount?: number;
  creditRecordId?: string;
  renderUrl?: string | null;
  assetPath?: string | null;
  durationMs?: number;
  errorCode?: string;
  safeErrorMessage?: string;
  extraDetails?: Record<string, unknown>;
};

const GENERATION_LOG_REPEAT_WINDOW_MS = 60_000;
const GENERATION_LOG_JOB_CAP = 300;
const GENERATION_LOG_RUN_CAP = 200;
const TERMINAL_GENERATION_JOB_STATUSES = new Set(["asset_ready", "completed", "success", "failed", "timed_out", "billing_failed", "completed_with_errors"]);
const generationOpsDedupCache = new Map<string, number>();
const generationOpsJobCounts = new Map<string, number>();
const generationOpsRunCounts = new Map<string, number>();
const generationOpsPollState = new Map<string, { count: number; signature: string }>();
const generationOpsTerminalSeen = new Set<string>();
const generationOpsRestoreSeen = new Set<string>();
const generationOpsTraceSummarySeen = new Set<string>();

function nowIso() {
  return new Date().toISOString();
}

function addMonths(baseIso: string, months: number) {
  const next = new Date(baseIso);
  next.setMonth(next.getMonth() + months);
  return next.toISOString();
}

function toIsoOrFallback(value: string | undefined | null, fallback: string) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function readCreatedAtValue(row: Record<string, unknown>) {
  const value = row.createdAt ?? row.createdat ?? row.created_at;
  return value ? String(value) : "";
}

function normalizeScope(email?: string | null) {
  const value = (email ?? "").trim().toLowerCase();
  return value || "guest";
}

export { normalizeScope };

export async function enforceRateLimit(input: {
  scopeKey: string;
  endpoint: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = Math.floor(now / input.windowMs) * input.windowMs;
  if (hasManagedDatabase()) {
    const row = (await pgGet(
      "SELECT count FROM api_rate_limits WHERE scope_key = ? AND endpoint = ? AND window_start = ?",
      [input.scopeKey, input.endpoint, windowStart],
    )) as { count?: number } | undefined;
    const count = Number(row?.count ?? 0);
    if (count >= input.limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((windowStart + input.windowMs - now) / 1000)),
        remaining: 0,
      };
    }
    await pgRun(
      `INSERT INTO api_rate_limits (scope_key, endpoint, window_start, count)
       VALUES (?, ?, ?, 1)
       ON CONFLICT(scope_key, endpoint, window_start)
       DO UPDATE SET count = api_rate_limits.count + 1`,
      [input.scopeKey, input.endpoint, windowStart],
    );
    return {
      allowed: true,
      remaining: input.limit - count - 1,
    };
  }
  const { db } = getDb();
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

export async function upsertUser(input: {
  email: string;
  name: string;
  role: "user" | "admin";
}) {
  const email = input.email.trim().toLowerCase();
  if (hasManagedDatabase()) {
    const existing = (await pgGet("SELECT id FROM users WHERE email = ?", [email])) as { id?: string } | undefined;
    const id = existing?.id ?? `u-${randomUUID()}`;
    await pgRun(
      `INSERT INTO users (id, email, name, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         name = excluded.name,
         role = excluded.role,
         updated_at = excluded.updated_at`,
      [id, email, input.name, input.role, nowIso(), nowIso()],
    );
    return id;
  }
  const { db } = getDb();
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

export async function authenticateOrCreatePasswordUser(input: {
  email: string;
  password: string;
  role: "user" | "admin";
}) {
  const rawEmail = input.email.trim().toLowerCase();
  const email = getPasswordAccountEmail(rawEmail);
  const name = rawEmail.split("@")[0] || "Password User";
  const passwordHash = hashPassword(input.password);
  const selectSql = "SELECT id, email, name, role, password_hash, status FROM users WHERE email = ?";
  if (hasManagedDatabase()) {
    await ensureManagedUserPasswordSchema();
    const existing = (await pgGet(selectSql, [email])) as
      | { id: string; email: string; name: string; role: "user" | "admin"; password_hash?: string | null; status?: string | null }
      | undefined;
    if (existing) {
      if (existing.status === "disabled") {
        return null;
      }
      if (!existing.password_hash) {
        const loggedInAt = nowIso();
        await pgRun("UPDATE users SET password_hash = ?, last_login_at = ?, updated_at = ? WHERE id = ?", [
          passwordHash,
          loggedInAt,
          loggedInAt,
          existing.id,
        ]);
        return { id: existing.id, email: existing.email, name: existing.name, role: existing.role };
      }
      if (!verifyPassword(input.password, existing.password_hash)) {
        return null;
      }
      const loggedInAt = nowIso();
      await pgRun("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?", [loggedInAt, loggedInAt, existing.id]);
      return { id: existing.id, email: existing.email, name: existing.name, role: existing.role };
    }
    const id = `u-${randomUUID()}`;
    const loggedInAt = nowIso();
    await pgRun(
      `INSERT INTO users (id, email, name, password_hash, role, status, last_login_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
      [id, email, name, passwordHash, input.role, loggedInAt, loggedInAt, loggedInAt],
    );
    return { id, email, name, role: input.role };
  }
  const { db } = getDb();
  const existing = db.prepare(selectSql).get(email) as
    | { id: string; email: string; name: string; role: "user" | "admin"; password_hash?: string | null; status?: string | null }
    | undefined;
  if (existing) {
    if (existing.status === "disabled") {
      return null;
    }
    if (!existing.password_hash) {
      const loggedInAt = nowIso();
      db.prepare("UPDATE users SET password_hash = ?, last_login_at = ?, updated_at = ? WHERE id = ?").run(
        passwordHash,
        loggedInAt,
        loggedInAt,
        existing.id,
      );
      return { id: existing.id, email: existing.email, name: existing.name, role: existing.role };
    }
    if (!verifyPassword(input.password, existing.password_hash)) {
      return null;
    }
    const loggedInAt = nowIso();
    db.prepare("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?").run(loggedInAt, loggedInAt, existing.id);
    return { id: existing.id, email: existing.email, name: existing.name, role: existing.role };
  }
  const id = `u-${randomUUID()}`;
  const loggedInAt = nowIso();
  db.prepare(
    `INSERT INTO users (id, email, name, password_hash, role, status, last_login_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
  ).run(id, email, name, passwordHash, input.role, loggedInAt, loggedInAt, loggedInAt);
  return { id, email, name, role: input.role };
}

export async function listProjectsByUser(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (hasManagedDatabase()) {
    const user = (await pgGet("SELECT id FROM users WHERE email = ?", [normalizedEmail])) as
      | { id?: string }
      | undefined;
    if (!user?.id) {
      return [] as Array<Record<string, unknown>>;
    }
    return pgAll("SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC", [user.id]);
  }
  const { db } = getDb();
  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail) as
    | { id?: string }
    | undefined;
  if (!user?.id) {
    return [] as Array<Record<string, unknown>>;
  }
  return db
    .prepare("SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC")
    .all(user.id) as Array<Record<string, unknown>>;
}

export async function getProjectByIdForUser(email: string, projectId: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedProjectId = projectId.trim();
  if (!normalizedEmail || !normalizedProjectId) {
    return null as Record<string, unknown> | null;
  }
  if (hasManagedDatabase()) {
    const user = (await pgGet("SELECT id FROM users WHERE email = ?", [normalizedEmail])) as
      | { id?: string }
      | undefined;
    if (!user?.id) {
      return null as Record<string, unknown> | null;
    }
    return ((await pgGet("SELECT * FROM projects WHERE id = ? AND user_id = ? LIMIT 1", [
      normalizedProjectId,
      user.id,
    ])) || null) as Record<string, unknown> | null;
  }
  const { db } = getDb();
  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail) as
    | { id?: string }
    | undefined;
  if (!user?.id) {
    return null as Record<string, unknown> | null;
  }
  return (db
    .prepare("SELECT * FROM projects WHERE id = ? AND user_id = ? LIMIT 1")
    .get(normalizedProjectId, user.id) || null) as Record<string, unknown> | null;
}

export async function saveProject(input: {
  id?: string;
  userEmail: string;
  title: string;
  status: string;
  format?: string;
  duration?: string;
  updatedAt?: string;
}) {
  const userId = await upsertUser({
    email: input.userEmail,
    name: input.userEmail.split("@")[0] || input.userEmail,
    role: "user",
  });
  const id = input.id ?? `p-${randomUUID()}`;
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  const sqlText =
    `INSERT INTO projects (id, user_id, title, status, format, duration, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       status = excluded.status,
       format = excluded.format,
       duration = excluded.duration,
       updated_at = excluded.updated_at`;
  const params = [id, userId, input.title, input.status, input.format ?? null, input.duration ?? null, updatedAt];
  if (hasManagedDatabase()) {
    await pgRun(sqlText, params);
    return id;
  }
  const { db } = getDb();
  db.prepare(sqlText).run(...params);
  return id;
}

export async function appendCreditRecordDb(input: {
  userEmail?: string;
  userId?: string;
  projectId?: string;
  projectTitle?: string;
  type: "consume" | "topup" | "refund";
  description: string;
  delta: number;
}) {
  const scopeEmail = normalizeScope(input.userEmail);
  const rows = hasManagedDatabase()
    ? ((await pgAll("SELECT balance FROM credit_records WHERE user_email = ? ORDER BY created_at DESC, id DESC LIMIT 1", [
        scopeEmail,
      ])) as Array<{ balance?: number }>)
    : (() => {
        const { db } = getDb();
        return db
          .prepare("SELECT balance FROM credit_records WHERE user_email = ? ORDER BY created_at DESC, id DESC LIMIT 1")
          .all(scopeEmail) as Array<{ balance?: number }>;
      })();
  const latestBalance = rows[0]?.balance ?? DEFAULT_FREE_CREDIT_BALANCE;
  const balance = latestBalance + input.delta;
  const id = `record-${randomUUID()}`;
  const sqlText =
    `INSERT INTO credit_records (id, created_at, type, description, delta, balance, user_id, user_email, project_id, project_title)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [
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
  ];
  if (hasManagedDatabase()) {
    await pgRun(sqlText, params);
  } else {
    const { db } = getDb();
    db.prepare(sqlText).run(...params);
  }
  return { id, balance };
}

export async function applyCreditRecordAtomic(input: {
  userEmail: string;
  userId?: string;
  projectId?: string;
  projectTitle?: string;
  type: "consume" | "topup" | "refund";
  description: string;
  delta: number;
  rejectNegativeBalance?: boolean;
}) {
  const scopeEmail = normalizeScope(input.userEmail);
  if (!scopeEmail || scopeEmail === "guest") {
    throw new Error("A signed-in user email is required for credit changes.");
  }

  if (hasManagedDatabase()) {
    return pgTransaction(async (tx) => {
      const existingUser = (await pgTxGet(tx, "SELECT id FROM users WHERE email = ?", [scopeEmail])) as
        | { id?: string }
        | undefined;
      const userId = input.userId || existingUser?.id || `u-${randomUUID()}`;
      await pgTxRun(
        tx,
        `INSERT INTO users (id, email, name, role, created_at, updated_at)
         VALUES (?, ?, ?, 'user', ?, ?)
         ON CONFLICT(email) DO UPDATE SET
           updated_at = excluded.updated_at`,
        [userId, scopeEmail, scopeEmail.split("@")[0] || "User", nowIso(), nowIso()],
      );

      const latest = (await pgTxGet(
        tx,
        "SELECT balance FROM credit_records WHERE user_email = ? ORDER BY created_at DESC, id DESC LIMIT 1",
        [scopeEmail],
      )) as { balance?: number } | undefined;
      const latestBalance = Number(latest?.balance ?? DEFAULT_FREE_CREDIT_BALANCE);
      const nextBalance = latestBalance + input.delta;
      if (input.rejectNegativeBalance && nextBalance < 0) {
        return {
          applied: false as const,
          code: "INSUFFICIENT_CREDITS",
          balance: latestBalance,
        };
      }

      const id = `record-${randomUUID()}`;
      await pgTxRun(
        tx,
        `INSERT INTO credit_records (id, created_at, type, description, delta, balance, user_id, user_email, project_id, project_title)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          nowIso(),
          input.type,
          input.description,
          input.delta,
          nextBalance,
          userId,
          scopeEmail,
          input.projectId ?? null,
          input.projectTitle ?? null,
        ],
      );
      return {
        applied: true as const,
        id,
        balance: nextBalance,
      };
    });
  }

  const { db } = getDb();

  db.exec("BEGIN IMMEDIATE");
  try {
    const existingUser = db.prepare("SELECT id FROM users WHERE email = ?").get(scopeEmail) as
      | { id?: string }
      | undefined;
    const userId = input.userId || existingUser?.id || `u-${randomUUID()}`;
    db.prepare(
      `INSERT INTO users (id, email, name, role, created_at, updated_at)
       VALUES (?, ?, ?, 'user', ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         updated_at = excluded.updated_at`,
    ).run(userId, scopeEmail, scopeEmail.split("@")[0] || "User", nowIso(), nowIso());

    const rows = db
      .prepare("SELECT balance FROM credit_records WHERE user_email = ? ORDER BY created_at DESC, id DESC LIMIT 1")
      .all(scopeEmail) as Array<{ balance?: number }>;
    const latestBalance = rows[0]?.balance ?? DEFAULT_FREE_CREDIT_BALANCE;
    const nextBalance = latestBalance + input.delta;
    if (input.rejectNegativeBalance && nextBalance < 0) {
      db.exec("ROLLBACK");
      return {
        applied: false as const,
        code: "INSUFFICIENT_CREDITS",
        balance: latestBalance,
      };
    }

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
      nextBalance,
      userId,
      scopeEmail,
      input.projectId ?? null,
      input.projectTitle ?? null,
    );
    db.exec("COMMIT");
    return {
      applied: true as const,
      id,
      balance: nextBalance,
    };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export async function applyImageGenerationRefundAtomic(input: {
  refundKey: string;
  jobId: string;
  taskId?: string;
  taskIndex?: number;
  userEmail: string;
  userId?: string;
  projectId?: string;
  projectTitle?: string;
  amount: number;
  reason?: string;
  description: string;
}) {
  const scopeEmail = normalizeScope(input.userEmail);
  const refundKey = input.refundKey.trim().slice(0, 240);
  const amount = Math.max(0, Math.round(input.amount));
  if (!scopeEmail || scopeEmail === "guest") {
    throw new Error("A signed-in user email is required for image generation refunds.");
  }
  if (!refundKey || !input.jobId.trim() || amount <= 0) {
    return {
      applied: false as const,
      balance: null,
      duplicate: false,
    };
  }

  if (hasManagedDatabase()) {
    return pgTransaction(async (tx) => {
      const existingRefund = (await pgTxGet(
        tx,
        "SELECT id FROM image_generation_refunds WHERE refund_key = ? LIMIT 1",
        [refundKey],
      )) as { id?: string } | undefined;
      if (existingRefund?.id) {
        const latest = (await pgTxGet(
          tx,
          "SELECT balance FROM credit_records WHERE user_email = ? ORDER BY created_at DESC, id DESC LIMIT 1",
          [scopeEmail],
        )) as { balance?: number } | undefined;
        return {
          applied: false as const,
          balance: Number(latest?.balance ?? DEFAULT_FREE_CREDIT_BALANCE),
          duplicate: true,
        };
      }

      const existingUser = (await pgTxGet(tx, "SELECT id FROM users WHERE email = ?", [scopeEmail])) as
        | { id?: string }
        | undefined;
      const userId = input.userId || existingUser?.id || `u-${randomUUID()}`;
      await pgTxRun(
        tx,
        `INSERT INTO users (id, email, name, role, created_at, updated_at)
         VALUES (?, ?, ?, 'user', ?, ?)
         ON CONFLICT(email) DO UPDATE SET
           updated_at = excluded.updated_at`,
        [userId, scopeEmail, scopeEmail.split("@")[0] || "User", nowIso(), nowIso()],
      );

      const latest = (await pgTxGet(
        tx,
        "SELECT balance FROM credit_records WHERE user_email = ? ORDER BY created_at DESC, id DESC LIMIT 1",
        [scopeEmail],
      )) as { balance?: number } | undefined;
      const latestBalance = Number(latest?.balance ?? DEFAULT_FREE_CREDIT_BALANCE);
      const nextBalance = latestBalance + amount;
      const creditRecordId = `record-${randomUUID()}`;
      await pgTxRun(
        tx,
        `INSERT INTO credit_records (id, created_at, type, description, delta, balance, user_id, user_email, project_id, project_title)
         VALUES (?, ?, 'refund', ?, ?, ?, ?, ?, ?, ?)`,
        [
          creditRecordId,
          nowIso(),
          input.description.trim().slice(0, 500),
          amount,
          nextBalance,
          userId,
          scopeEmail,
          input.projectId ?? null,
          input.projectTitle ?? null,
        ],
      );
      await pgTxRun(
        tx,
        `INSERT INTO image_generation_refunds (id, refund_key, job_id, task_id, task_index, user_email, project_id, amount, reason, credit_record_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `imgrefund-${randomUUID()}`,
          refundKey,
          input.jobId.trim(),
          input.taskId?.trim() || null,
          Number.isFinite(input.taskIndex) ? Math.max(1, Math.round(Number(input.taskIndex))) : null,
          scopeEmail,
          input.projectId?.trim() || null,
          amount,
          input.reason?.trim().slice(0, 240) || null,
          creditRecordId,
          nowIso(),
        ],
      );
      return {
        applied: true as const,
        balance: nextBalance,
        duplicate: false,
        creditRecordId,
      };
    });
  }

  const { db } = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const existingRefund = db
      .prepare("SELECT id FROM image_generation_refunds WHERE refund_key = ? LIMIT 1")
      .get(refundKey) as { id?: string } | undefined;
    if (existingRefund?.id) {
      const latest = db
        .prepare("SELECT balance FROM credit_records WHERE user_email = ? ORDER BY created_at DESC, id DESC LIMIT 1")
        .get(scopeEmail) as { balance?: number } | undefined;
      db.exec("COMMIT");
      return {
        applied: false as const,
        balance: Number(latest?.balance ?? DEFAULT_FREE_CREDIT_BALANCE),
        duplicate: true,
      };
    }

    const existingUser = db.prepare("SELECT id FROM users WHERE email = ?").get(scopeEmail) as
      | { id?: string }
      | undefined;
    const userId = input.userId || existingUser?.id || `u-${randomUUID()}`;
    db.prepare(
      `INSERT INTO users (id, email, name, role, created_at, updated_at)
       VALUES (?, ?, ?, 'user', ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         updated_at = excluded.updated_at`,
    ).run(userId, scopeEmail, scopeEmail.split("@")[0] || "User", nowIso(), nowIso());

    const latest = db
      .prepare("SELECT balance FROM credit_records WHERE user_email = ? ORDER BY created_at DESC, id DESC LIMIT 1")
      .get(scopeEmail) as { balance?: number } | undefined;
    const latestBalance = Number(latest?.balance ?? DEFAULT_FREE_CREDIT_BALANCE);
    const nextBalance = latestBalance + amount;
    const creditRecordId = `record-${randomUUID()}`;
    db.prepare(
      `INSERT INTO credit_records (id, created_at, type, description, delta, balance, user_id, user_email, project_id, project_title)
       VALUES (?, ?, 'refund', ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      creditRecordId,
      nowIso(),
      input.description.trim().slice(0, 500),
      amount,
      nextBalance,
      userId,
      scopeEmail,
      input.projectId ?? null,
      input.projectTitle ?? null,
    );
    db.prepare(
      `INSERT INTO image_generation_refunds (id, refund_key, job_id, task_id, task_index, user_email, project_id, amount, reason, credit_record_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      `imgrefund-${randomUUID()}`,
      refundKey,
      input.jobId.trim(),
      input.taskId?.trim() || null,
      Number.isFinite(input.taskIndex) ? Math.max(1, Math.round(Number(input.taskIndex))) : null,
      scopeEmail,
      input.projectId?.trim() || null,
      amount,
      input.reason?.trim().slice(0, 240) || null,
      creditRecordId,
      nowIso(),
    );
    db.exec("COMMIT");
    return {
      applied: true as const,
      balance: nextBalance,
      duplicate: false,
      creditRecordId,
    };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export async function listCreditRecords(email?: string | null, input?: { limit?: number }) {
  const scopeEmail = normalizeScope(email);
  const limit = Number.isFinite(input?.limit)
    ? Math.max(1, Math.min(500, Math.round(Number(input?.limit))))
    : 0;
  if (hasManagedDatabase()) {
    if (limit > 0) {
      return pgAll("SELECT * FROM credit_records WHERE user_email = ? ORDER BY created_at DESC, id DESC LIMIT ?", [scopeEmail, limit]);
    }
    return pgAll("SELECT * FROM credit_records WHERE user_email = ? ORDER BY created_at DESC, id DESC", [scopeEmail]);
  }
  const { db } = getDb();
  if (limit > 0) {
    return db
      .prepare("SELECT * FROM credit_records WHERE user_email = ? ORDER BY created_at DESC, id DESC LIMIT ?")
      .all(scopeEmail, limit);
  }
  return db
    .prepare("SELECT * FROM credit_records WHERE user_email = ? ORDER BY created_at DESC, id DESC")
    .all(scopeEmail);
}

export async function saveSubscriptionDb(input: {
  userEmail: string;
  planId: string;
  planName: string;
  cycle: "monthly" | "yearly";
  status: "inactive" | "active" | "canceling" | "canceled";
  stripeSubscriptionId?: string;
  monthlyCreditAmount?: number;
  startedAt: string;
  renewAt: string;
  creditPeriodStartedAt?: string;
  creditPeriodEndsAt?: string;
  canceledAt?: string;
}) {
  const userId = await upsertUser({
    email: input.userEmail,
    name: input.userEmail.split("@")[0] || input.userEmail,
    role: "user",
  });
  const id = `sub-${randomUUID()}`;
  const sqlText =
    `INSERT INTO subscriptions (
      id, user_id, plan_id, plan_name, cycle, stripe_subscription_id, status, monthly_credit_amount,
      started_at, renew_at, credit_period_started_at, credit_period_ends_at, canceled_at, created_at, updated_at
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const creditPeriodStartedAt = input.creditPeriodStartedAt || input.startedAt;
  const creditPeriodEndsAt = input.creditPeriodEndsAt || addMonths(creditPeriodStartedAt, 1);
  const params = [
    id,
    userId,
    input.planId,
    input.planName,
    input.cycle,
    input.stripeSubscriptionId?.trim() || null,
    input.status,
    Number.isFinite(input.monthlyCreditAmount) ? Math.max(0, Math.round(Number(input.monthlyCreditAmount))) : null,
    input.startedAt,
    input.renewAt,
    creditPeriodStartedAt,
    creditPeriodEndsAt,
    input.canceledAt ?? null,
    nowIso(),
    nowIso(),
  ];
  if (hasManagedDatabase()) {
    await pgRun(sqlText, params);
    return id;
  }
  const { db } = getDb();
  db.prepare(sqlText).run(...params);
  return id;
}

export async function getLatestSubscriptionDb(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const sqlText =
      `SELECT s.* FROM subscriptions s
       INNER JOIN users u ON u.id = s.user_id
       WHERE u.email = ?
       ORDER BY
         CASE WHEN s.status IN ('active', 'canceling') THEN 0 ELSE 1 END ASC,
         s.updated_at DESC,
         s.created_at DESC
       LIMIT 1`;
  if (hasManagedDatabase()) {
    return (await pgGet(sqlText, [normalizedEmail])) ?? null;
  }
  const { db } = getDb();
  const row = db.prepare(sqlText).get(normalizedEmail);
  return row ?? null;
}

export async function isFreeUserBySubscriptionSafe(input: {
  email: string;
  source: string;
  projectId?: string | null;
  details?: Record<string, unknown>;
}) {
  try {
    const row = (await getLatestSubscriptionDb(input.email)) as { status?: string } | null;
    if (!row) {
      return true;
    }
    const status = (row.status || "").trim().toLowerCase();
    return !(status === "active" || status === "canceling");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "Unknown subscription lookup error.");
    logOpsEvent({
      category: "billing",
      action: "subscription_status_degraded",
      status: "error",
      source: input.source,
      userEmail: input.email,
      projectId: input.projectId ?? undefined,
      code: "SUBSCRIPTION_STATUS_LOOKUP_FAILED",
      message,
      details: input.details,
    });
    return true;
  }
}

export async function getSubscriptionDbByStripeSubscriptionId(stripeSubscriptionId: string) {
  const normalizedId = stripeSubscriptionId.trim();
  if (!normalizedId) {
    return null;
  }
  const sqlText =
    `SELECT *
     FROM subscriptions
     WHERE stripe_subscription_id = ?
     ORDER BY
       CASE WHEN status IN ('active', 'canceling') THEN 0 ELSE 1 END ASC,
       updated_at DESC,
       created_at DESC
     LIMIT 1`;
  if (hasManagedDatabase()) {
    return (await pgGet(sqlText, [normalizedId])) ?? null;
  }
  const { db } = getDb();
  return db.prepare(sqlText).get(normalizedId) ?? null;
}

export async function syncStripeSubscriptionState(input: {
  stripeSubscriptionId: string;
  renewAt: string;
  status: "inactive" | "active" | "canceling" | "canceled";
  canceledAt?: string | null;
}) {
  const stripeSubscriptionId = input.stripeSubscriptionId.trim();
  if (!stripeSubscriptionId) {
    return false;
  }
  const nextRenewAt = toIsoOrFallback(input.renewAt, nowIso());
  const canceledAt = input.canceledAt ? toIsoOrFallback(input.canceledAt, nextRenewAt) : null;
  if (hasManagedDatabase()) {
    await pgRun(
      `UPDATE subscriptions
       SET renew_at = ?, status = ?, canceled_at = ?, updated_at = ?
       WHERE stripe_subscription_id = ?`,
      nextRenewAt,
      input.status,
      canceledAt,
      nowIso(),
      stripeSubscriptionId,
    );
    return true;
  }
  const { db } = getDb();
  db.prepare(
    `UPDATE subscriptions
     SET renew_at = ?, status = ?, canceled_at = ?, updated_at = ?
     WHERE stripe_subscription_id = ?`,
  ).run(nextRenewAt, input.status, canceledAt, nowIso(), stripeSubscriptionId);
  return true;
}

export async function ensureSubscriptionCreditsCurrent(email: string) {
  const normalizedEmail = normalizeScope(email);
  if (!normalizedEmail || normalizedEmail === "guest") {
    return null;
  }
  let latest = await getLatestSubscriptionDb(normalizedEmail);
  if (!latest || typeof latest !== "object") {
    return null;
  }

  const status = String((latest as { status?: string }).status || "").trim().toLowerCase();
  if (!(status === "active" || status === "canceling")) {
    return latest;
  }

  const planId = String((latest as { plan_id?: string }).plan_id || "").trim();
  const plan = findBillingPlan(planId);
  const monthlyCreditAmount = Math.max(
    0,
    Math.round(
      Number(
        (latest as { monthly_credit_amount?: number | null }).monthly_credit_amount ??
          plan?.monthlyCredits ??
          0,
      ),
    ),
  );
  if (!plan || monthlyCreditAmount <= 0) {
    return latest;
  }

  const accessEndsAt = toIsoOrFallback(
    (latest as { renew_at?: string | null }).renew_at ?? null,
    nowIso(),
  );
  let creditPeriodStartedAt = toIsoOrFallback(
    (latest as { credit_period_started_at?: string | null; started_at?: string | null }).credit_period_started_at ??
      (latest as { started_at?: string | null }).started_at ??
      null,
    nowIso(),
  );
  let creditPeriodEndsAt = toIsoOrFallback(
    (latest as { credit_period_ends_at?: string | null }).credit_period_ends_at ?? null,
    addMonths(creditPeriodStartedAt, 1),
  );

  while (Date.now() >= Date.parse(creditPeriodEndsAt) && Date.parse(creditPeriodEndsAt) < Date.parse(accessEndsAt)) {
    const expectedPeriodEnd = creditPeriodEndsAt;
    const nextPeriodStart = expectedPeriodEnd;
    const nextPeriodEnd = addMonths(nextPeriodStart, 1);
    const descriptionPrefix = `${plan.name} monthly credit cycle`;

    if (hasManagedDatabase()) {
      const cycleResult = await pgTransaction(async (tx) => {
        const current = (await pgTxGet(
          tx,
          "SELECT * FROM subscriptions WHERE id = ? LIMIT 1",
          [(latest as { id?: string }).id],
        )) as Record<string, unknown> | undefined;
        if (!current) {
          return { applied: false as const };
        }
        const currentPeriodEnd = toIsoOrFallback(
          (current.credit_period_ends_at as string | null | undefined) ?? null,
          expectedPeriodEnd,
        );
        if (currentPeriodEnd !== expectedPeriodEnd) {
          return { applied: false as const };
        }
        const latestBalanceRow = (await pgTxGet(
          tx,
          "SELECT balance FROM credit_records WHERE user_email = ? ORDER BY created_at DESC, id DESC LIMIT 1",
          [normalizedEmail],
        )) as { balance?: number } | undefined;
        const latestBalance = Math.max(0, Number(latestBalanceRow?.balance ?? DEFAULT_FREE_CREDIT_BALANCE));
        if (latestBalance > 0) {
          await pgTxRun(
            tx,
            `INSERT INTO credit_records (id, created_at, type, description, delta, balance, user_id, user_email, project_id, project_title)
             VALUES (?, ?, 'consume', ?, ?, ?, ?, ?, null, null)`,
            [
              `record-${randomUUID()}`,
              nowIso(),
              `${descriptionPrefix} expired unused credits`,
              -latestBalance,
              0,
              current.user_id ?? null,
              normalizedEmail,
            ],
          );
        }
        await pgTxRun(
          tx,
          `INSERT INTO credit_records (id, created_at, type, description, delta, balance, user_id, user_email, project_id, project_title)
           VALUES (?, ?, 'topup', ?, ?, ?, ?, ?, null, null)`,
          [
            `record-${randomUUID()}`,
            nowIso(),
            `${descriptionPrefix} granted`,
            monthlyCreditAmount,
            monthlyCreditAmount,
            current.user_id ?? null,
            normalizedEmail,
          ],
        );
        await pgTxRun(
          tx,
          `UPDATE subscriptions
           SET monthly_credit_amount = ?, credit_period_started_at = ?, credit_period_ends_at = ?, updated_at = ?
           WHERE id = ?`,
          [monthlyCreditAmount, nextPeriodStart, nextPeriodEnd, nowIso(), current.id],
        );
        return { applied: true as const };
      });
      if (!cycleResult.applied) {
        break;
      }
    } else {
      const { db } = getDb();
      db.exec("BEGIN IMMEDIATE");
      try {
        const current = db.prepare("SELECT * FROM subscriptions WHERE id = ? LIMIT 1").get((latest as { id?: string }).id) as
          | Record<string, unknown>
          | undefined;
        if (!current) {
          db.exec("ROLLBACK");
          break;
        }
        const currentPeriodEnd = toIsoOrFallback(
          (current.credit_period_ends_at as string | null | undefined) ?? null,
          expectedPeriodEnd,
        );
        if (currentPeriodEnd !== expectedPeriodEnd) {
          db.exec("ROLLBACK");
          break;
        }
        const latestBalanceRow = db
          .prepare("SELECT balance FROM credit_records WHERE user_email = ? ORDER BY created_at DESC, id DESC LIMIT 1")
          .get(normalizedEmail) as { balance?: number } | undefined;
        const latestBalance = Math.max(0, Number(latestBalanceRow?.balance ?? DEFAULT_FREE_CREDIT_BALANCE));
        if (latestBalance > 0) {
          db.prepare(
            `INSERT INTO credit_records (id, created_at, type, description, delta, balance, user_id, user_email, project_id, project_title)
             VALUES (?, ?, 'consume', ?, ?, ?, ?, ?, null, null)`,
          ).run(
            `record-${randomUUID()}`,
            nowIso(),
            `${descriptionPrefix} expired unused credits`,
            -latestBalance,
            0,
            current.user_id ?? null,
            normalizedEmail,
          );
        }
        db.prepare(
          `INSERT INTO credit_records (id, created_at, type, description, delta, balance, user_id, user_email, project_id, project_title)
           VALUES (?, ?, 'topup', ?, ?, ?, ?, ?, null, null)`,
        ).run(
          `record-${randomUUID()}`,
          nowIso(),
          `${descriptionPrefix} granted`,
          monthlyCreditAmount,
          monthlyCreditAmount,
          current.user_id ?? null,
          normalizedEmail,
        );
        db.prepare(
          `UPDATE subscriptions
           SET monthly_credit_amount = ?, credit_period_started_at = ?, credit_period_ends_at = ?, updated_at = ?
           WHERE id = ?`,
        ).run(monthlyCreditAmount, nextPeriodStart, nextPeriodEnd, nowIso(), current.id);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    }

    latest = await getLatestSubscriptionDb(normalizedEmail);
    if (!latest || typeof latest !== "object") {
      return null;
    }
    creditPeriodStartedAt = toIsoOrFallback(
      (latest as { credit_period_started_at?: string | null }).credit_period_started_at ?? null,
      nextPeriodStart,
    );
    creditPeriodEndsAt = toIsoOrFallback(
      (latest as { credit_period_ends_at?: string | null }).credit_period_ends_at ?? null,
      nextPeriodEnd,
    );
  }

  return latest;
}

export async function replyFeedbackDb(input: {
  recordId: string;
  reply: string;
  repliedBy: string;
}) {
  if (hasManagedDatabase()) {
    await pgRun(
      `UPDATE feedback_tickets
       SET admin_reply = ?, replied_at = ?, replied_by = ?, status = 'replied'
       WHERE id = ?`,
      input.reply.trim(),
      nowIso(),
      input.repliedBy,
      input.recordId,
    );
    return;
  }
  const { db } = getDb();
  db.prepare(
    `UPDATE feedback_tickets
     SET admin_reply = ?, replied_at = ?, replied_by = ?, status = 'replied'
     WHERE id = ?`,
  ).run(input.reply.trim(), nowIso(), input.repliedBy, input.recordId);
}

export async function listFeedbackDb() {
  if (hasManagedDatabase()) {
    return pgAll("SELECT * FROM feedback_tickets ORDER BY created_at DESC, id DESC");
  }
  const { db } = getDb();
  return db
    .prepare("SELECT * FROM feedback_tickets ORDER BY created_at DESC, id DESC")
    .all();
}

export async function insertFeedbackDb(input: {
  type: string;
  detail: string;
  contact: string;
  attachments: string[];
  submitterEmail?: string;
  submitterName?: string;
}) {
  if (hasManagedDatabase()) {
    const id = `fb-${randomUUID()}`;
    await pgRun(
      `INSERT INTO feedback_tickets (id, type, detail, contact, attachments_json, submitter_email, submitter_name, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
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

export async function getCaseMetricDelta(caseId: string, userScope: string) {
  if (hasManagedDatabase()) {
    return (
      (await pgGet(
        "SELECT views_delta as \"viewsDelta\", likes_delta as \"likesDelta\", liked FROM featured_case_metrics WHERE case_id = ? AND user_scope = ?",
        caseId,
        normalizeScope(userScope),
      )) ?? null
    ) as
      | { viewsDelta?: number; likesDelta?: number; liked?: number }
      | null;
  }
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

export async function toggleCaseLikeDb(caseId: string, userScope: string) {
  if (hasManagedDatabase()) {
    const scope = normalizeScope(userScope);
    const row = (await pgGet(
      `INSERT INTO featured_case_metrics (case_id, user_scope, views_delta, likes_delta, liked, updated_at)
       VALUES (?, ?, 0, 1, 1, CURRENT_TIMESTAMP)
       ON CONFLICT(case_id, user_scope)
       DO UPDATE SET
         likes_delta = featured_case_metrics.likes_delta + CASE WHEN featured_case_metrics.liked = 1 THEN -1 ELSE 1 END,
         liked = CASE WHEN featured_case_metrics.liked = 1 THEN 0 ELSE 1 END,
         updated_at = CURRENT_TIMESTAMP
       RETURNING likes_delta as "likesDelta", liked`,
      caseId,
      scope,
    )) as { likesDelta?: number; liked?: number } | undefined;
    return { liked: Boolean(row?.liked), likesDelta: Number(row?.likesDelta ?? 0) };
  }
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

export async function hasBillingFulfillment(sessionId: string) {
  const row = hasManagedDatabase()
    ? ((await pgGet("SELECT session_id as \"sessionId\" FROM billing_fulfillments WHERE session_id = ? LIMIT 1", [
        sessionId,
      ])) as { sessionId?: string } | undefined)
    : (() => {
        const { db } = getDb();
        return db
          .prepare("SELECT session_id as sessionId FROM billing_fulfillments WHERE session_id = ? LIMIT 1")
          .get(sessionId) as { sessionId?: string } | undefined;
      })();
  return Boolean(row?.sessionId);
}

export async function recordBillingFulfillment(input: {
  sessionId: string;
  userEmail: string;
  planId: string;
  cycle: "monthly" | "yearly" | "one_time";
  checkoutSource?: string;
  checkoutStatus?: string;
}) {
  const sqlText =
    `INSERT INTO billing_fulfillments (session_id, user_email, plan_id, cycle, checkout_source, checkout_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`;
  const params = [
    input.sessionId,
    normalizeScope(input.userEmail),
    input.planId,
    input.cycle,
    input.checkoutSource?.trim().slice(0, 64) || null,
    input.checkoutStatus?.trim().slice(0, 32) || "fulfilled",
    nowIso(),
  ];
  if (hasManagedDatabase()) {
    await pgRun(sqlText, params);
    return;
  }
  const { db } = getDb();
  db.prepare(sqlText).run(...params);
}

export async function applyCreditTopupFulfillmentAtomic(input: {
  sessionId: string;
  userEmail: string;
  packageId: string;
  packageName: string;
  credits: number;
  checkoutSource?: string;
}) {
  const normalizedEmail = normalizeScope(input.userEmail);
  const credits = Math.max(0, Math.round(input.credits));
  if (!normalizedEmail || normalizedEmail === "guest" || !input.sessionId.trim() || credits <= 0) {
    throw new Error("A valid signed-in user and credit package are required.");
  }

  if (hasManagedDatabase()) {
    return pgTransaction(async (tx) => {
      const existing = (await pgTxGet(
        tx,
        "SELECT session_id as \"sessionId\" FROM billing_fulfillments WHERE session_id = ? LIMIT 1",
        [input.sessionId],
      )) as { sessionId?: string } | undefined;
      if (existing?.sessionId) {
        return { applied: false as const };
      }

      const userExisting = (await pgTxGet(tx, "SELECT id FROM users WHERE email = ?", [normalizedEmail])) as
        | { id?: string }
        | undefined;
      const userId = userExisting?.id ?? `u-${randomUUID()}`;
      await pgTxRun(
        tx,
        `INSERT INTO users (id, email, name, role, created_at, updated_at)
         VALUES (?, ?, ?, 'user', ?, ?)
         ON CONFLICT(email) DO UPDATE SET
           updated_at = excluded.updated_at`,
        [userId, normalizedEmail, normalizedEmail.split("@")[0] || "User", nowIso(), nowIso()],
      );

      const previous = (await pgTxGet(
        tx,
        "SELECT balance FROM credit_records WHERE user_email = ? ORDER BY created_at DESC, id DESC LIMIT 1",
        [normalizedEmail],
      )) as { balance?: number } | undefined;
      const previousBalance = Number(previous?.balance ?? DEFAULT_FREE_CREDIT_BALANCE);
      const nextBalance = previousBalance + credits;
      await pgTxRun(
        tx,
        `INSERT INTO credit_records (id, created_at, type, description, delta, balance, user_id, user_email, project_id, project_title)
         VALUES (?, ?, 'topup', ?, ?, ?, ?, ?, null, null)`,
        [
          `record-${randomUUID()}`,
          nowIso(),
          `${input.packageName} credited${input.checkoutSource ? ` [source:${input.checkoutSource}]` : ""}`,
          credits,
          nextBalance,
          userId,
          normalizedEmail,
        ],
      );
      await pgTxRun(
        tx,
        `INSERT INTO billing_fulfillments (session_id, user_email, plan_id, cycle, checkout_source, checkout_status, created_at)
         VALUES (?, ?, ?, 'one_time', ?, 'fulfilled', ?)`,
        [
          input.sessionId,
          normalizedEmail,
          input.packageId.trim().slice(0, 80),
          input.checkoutSource?.trim().slice(0, 64) || null,
          nowIso(),
        ],
      );
      return { applied: true as const };
    });
  }

  const { db } = getDb();
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
    ).run(userId, normalizedEmail, normalizedEmail.split("@")[0] || "User", nowIso(), nowIso());

    const balanceRows = db
      .prepare("SELECT balance FROM credit_records WHERE user_email = ? ORDER BY created_at DESC, id DESC LIMIT 1")
      .all(normalizedEmail) as Array<{ balance?: number }>;
    const previousBalance = balanceRows[0]?.balance ?? DEFAULT_FREE_CREDIT_BALANCE;
    const nextBalance = previousBalance + credits;
    db.prepare(
      `INSERT INTO credit_records (id, created_at, type, description, delta, balance, user_id, user_email, project_id, project_title)
       VALUES (?, ?, 'topup', ?, ?, ?, ?, ?, null, null)`,
    ).run(
      `record-${randomUUID()}`,
      nowIso(),
      `${input.packageName} credited${input.checkoutSource ? ` [source:${input.checkoutSource}]` : ""}`,
      credits,
      nextBalance,
      userId,
      normalizedEmail,
    );
    db.prepare(
      `INSERT INTO billing_fulfillments (session_id, user_email, plan_id, cycle, checkout_source, checkout_status, created_at)
       VALUES (?, ?, ?, 'one_time', ?, 'fulfilled', ?)`,
    ).run(
      input.sessionId,
      normalizedEmail,
      input.packageId.trim().slice(0, 80),
      input.checkoutSource?.trim().slice(0, 64) || null,
      nowIso(),
    );
    db.exec("COMMIT");
    return { applied: true as const };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export async function applyBillingFulfillmentAtomic(input: {
  sessionId: string;
  userEmail: string;
  planId: string;
  planName: string;
  cycle: "monthly" | "yearly";
  stripeSubscriptionId?: string;
  monthlyCredits: number;
  startedAt: string;
  renewAt: string;
  checkoutSource?: string;
}) {
  const normalizedEmail = normalizeScope(input.userEmail);
  const creditPeriodStartedAt = input.startedAt;
  const creditPeriodEndsAt = addMonths(creditPeriodStartedAt, 1);

  if (hasManagedDatabase()) {
    return pgTransaction(async (tx) => {
      const existing = (await pgTxGet(
        tx,
        "SELECT session_id as \"sessionId\" FROM billing_fulfillments WHERE session_id = ? LIMIT 1",
        [input.sessionId],
      )) as { sessionId?: string } | undefined;
      if (existing?.sessionId) {
        return { applied: false as const };
      }

      const userExisting = (await pgTxGet(tx, "SELECT id FROM users WHERE email = ?", [normalizedEmail])) as
        | { id?: string }
        | undefined;
      const userId = userExisting?.id ?? `u-${randomUUID()}`;
      await pgTxRun(
        tx,
        `INSERT INTO users (id, email, name, role, created_at, updated_at)
         VALUES (?, ?, ?, 'user', ?, ?)
         ON CONFLICT(email) DO UPDATE SET
           updated_at = excluded.updated_at`,
        [userId, normalizedEmail, normalizedEmail.split("@")[0] || "User", nowIso(), nowIso()],
      );

      const subscriptionId = `sub-${randomUUID()}`;
      await pgTxRun(
        tx,
        `INSERT INTO subscriptions (
          id, user_id, plan_id, plan_name, cycle, stripe_subscription_id, status, monthly_credit_amount,
          started_at, renew_at, credit_period_started_at, credit_period_ends_at, canceled_at, created_at, updated_at
        )
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, null, ?, ?)`,
        [
          subscriptionId,
          userId,
          input.planId,
          input.planName,
          input.cycle,
          input.stripeSubscriptionId?.trim() || null,
          input.monthlyCredits,
          input.startedAt,
          input.renewAt,
          creditPeriodStartedAt,
          creditPeriodEndsAt,
          nowIso(),
          nowIso(),
        ],
      );

      const previous = (await pgTxGet(
        tx,
        "SELECT balance FROM credit_records WHERE user_email = ? ORDER BY created_at DESC, id DESC LIMIT 1",
        [normalizedEmail],
      )) as { balance?: number } | undefined;
      const previousBalance = Number(previous?.balance ?? DEFAULT_FREE_CREDIT_BALANCE);
      const nextBalance = previousBalance + input.monthlyCredits;
      await pgTxRun(
        tx,
        `INSERT INTO credit_records (id, created_at, type, description, delta, balance, user_id, user_email, project_id, project_title)
         VALUES (?, ?, 'topup', ?, ?, ?, ?, ?, null, null)`,
        [
          `record-${randomUUID()}`,
          nowIso(),
          `${input.planName} ${input.cycle} purchase credited${input.checkoutSource ? ` [source:${input.checkoutSource}]` : ""}`,
          input.monthlyCredits,
          nextBalance,
          userId,
          normalizedEmail,
        ],
      );
      await pgTxRun(
        tx,
        `INSERT INTO billing_fulfillments (session_id, user_email, plan_id, cycle, checkout_source, checkout_status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          input.sessionId,
          normalizedEmail,
          input.planId,
          input.cycle,
          input.checkoutSource?.trim().slice(0, 64) || null,
          "fulfilled",
          nowIso(),
        ],
      );
      return { applied: true as const };
    });
  }

  const { db } = getDb();

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
      `INSERT INTO subscriptions (
        id, user_id, plan_id, plan_name, cycle, stripe_subscription_id, status, monthly_credit_amount,
        started_at, renew_at, credit_period_started_at, credit_period_ends_at, canceled_at, created_at, updated_at
      )
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, null, ?, ?)`,
    ).run(
      subscriptionId,
      userId,
      input.planId,
      input.planName,
      input.cycle,
      input.stripeSubscriptionId?.trim() || null,
      input.monthlyCredits,
      input.startedAt,
      input.renewAt,
      creditPeriodStartedAt,
      creditPeriodEndsAt,
      nowIso(),
      nowIso(),
    );

    const balanceRows = db
      .prepare("SELECT balance FROM credit_records WHERE user_email = ? ORDER BY created_at DESC, id DESC LIMIT 1")
      .all(normalizedEmail) as Array<{ balance?: number }>;
    const previousBalance = balanceRows[0]?.balance ?? DEFAULT_FREE_CREDIT_BALANCE;
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
    return JSON.stringify(details).slice(0, 12000);
  } catch {
    return null;
  }
}

function hashTelemetryValue(input?: string | null) {
  const value = clampText(input ?? "", 2000);
  if (!value) {
    return "";
  }
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function sanitizeSafeErrorMessage(input?: string | null) {
  const value = clampText(input ?? "", 280);
  if (!value) {
    return "";
  }
  return value.replace(/https?:\/\/\S+/gi, "[url]");
}

function normalizeGenerationStatusSummary(input?: GenerationTaskStatusSummary) {
  if (!input) {
    return undefined;
  }
  const entries = Object.entries(input)
    .map(([status, count]) => [clampText(status, 64), Number(count ?? 0)] as const)
    .filter(([status, count]) => status && Number.isFinite(count) && count > 0);
  if (!entries.length) {
    return undefined;
  }
  return Object.fromEntries(entries);
}

function shouldDropTelemetryDetailKey(key: string) {
  return /(?:^|_)(?:token|secret|cookie|authorization|apikey|api_key|database_url)(?:$|_)/i.test(key) ||
    /^(?:prompt|rawImageUrl|imageUrl|renderUrl|assetPath|storageKey|providerPayload)$/i.test(key);
}

function sanitizeTelemetryDetailValue(value: unknown, depth = 0): unknown {
  if (value == null || depth > 3) {
    return value ?? null;
  }
  if (typeof value === "string") {
    return clampText(sanitizeSafeErrorMessage(value), 200);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 24).map((item) => sanitizeTelemetryDetailValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    const entries = Object.entries(objectValue)
      .filter(([key]) => !shouldDropTelemetryDetailKey(key))
      .slice(0, 40)
      .map(([key, item]) => [clampText(key, 64), sanitizeTelemetryDetailValue(item, depth + 1)] as const)
      .filter(([key, item]) => key && item !== undefined);
    return Object.fromEntries(entries);
  }
  return undefined;
}

function sanitizeTelemetryExtraDetails(details?: Record<string, unknown>) {
  if (!details) {
    return undefined;
  }
  const sanitized = sanitizeTelemetryDetailValue(details, 0);
  if (!sanitized || typeof sanitized !== "object" || Array.isArray(sanitized)) {
    return undefined;
  }
  const entries = Object.entries(sanitized).filter(([, value]) => value !== undefined);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function parseOpsEventDetailsJson(detailsJson?: string | null) {
  if (!detailsJson) {
    return null;
  }
  try {
    const parsed = JSON.parse(detailsJson) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function buildGenerationTaskStatusSummary(input?: Array<{ status?: string | null }> | null) {
  if (!input?.length) {
    return {} as GenerationTaskStatusSummary;
  }
  const summary: GenerationTaskStatusSummary = {};
  input.forEach((task) => {
    const status = clampText(task?.status ?? "", 64).toLowerCase() || "unknown";
    summary[status] = (summary[status] ?? 0) + 1;
  });
  return summary;
}

function buildGenerationOpsDetails(input: GenerationOpsEventInput): GenerationOpsDetails {
  const baseDetails = {
    runId: clampText(input.runId, 120) || undefined,
    jobId: clampText(input.jobId, 120) || undefined,
    taskId: clampText(input.taskId, 120) || undefined,
    taskIndex: Number.isFinite(input.taskIndex) ? Number(input.taskIndex) : undefined,
    projectId: clampText(input.projectId, 120) || undefined,
    idempotencyKeyHash: hashTelemetryValue(input.idempotencyKey) || undefined,
    refundKeyHash: hashTelemetryValue(input.refundKey) || undefined,
    jobStatus: clampText(input.jobStatus, 64) || undefined,
    taskStatus: clampText(input.taskStatus, 64) || undefined,
    taskStatusSummary: normalizeGenerationStatusSummary(input.taskStatusSummary),
    outputType: clampText(input.outputType, 32) || undefined,
    aspectRatio: clampText(input.aspectRatio, 32) || undefined,
    ratio: clampText(input.ratio, 32) || undefined,
    taskCount: Number.isFinite(input.taskCount) ? Number(input.taskCount) : undefined,
    providerOrder: clampText(input.providerOrder, 240) || undefined,
    providerUsed: clampText(input.providerUsed, 64) || undefined,
    attempts: Number.isFinite(input.attempts) ? Number(input.attempts) : undefined,
    promptHash: hashTelemetryValue(input.promptText) || undefined,
    promptLength: typeof input.promptText === "string" ? input.promptText.length : undefined,
    creditsAmount: Number.isFinite(input.creditsAmount) ? Number(input.creditsAmount) : undefined,
    creditRecordId: clampText(input.creditRecordId, 120) || undefined,
    renderUrlExists: Boolean(clampText(input.renderUrl ?? "", 500)),
    assetPathExists: Boolean(clampText(input.assetPath ?? "", 500)),
    durationMs: Number.isFinite(input.durationMs) ? Math.max(0, Math.round(Number(input.durationMs))) : undefined,
    errorCode: clampText(input.errorCode, 64) || undefined,
    safeErrorMessage: sanitizeSafeErrorMessage(input.safeErrorMessage) || undefined,
  };
  const extraDetails = sanitizeTelemetryExtraDetails(input.extraDetails);
  return extraDetails ? { ...baseDetails, ...extraDetails } : baseDetails;
}

function isTerminalGenerationStatus(status?: string | null) {
  return TERMINAL_GENERATION_JOB_STATUSES.has(clampText(status ?? "", 64).toLowerCase());
}

function summaryHasTerminalGenerationStatus(summary?: GenerationTaskStatusSummary | null) {
  if (!summary) {
    return false;
  }
  return Object.keys(summary).some((status) => isTerminalGenerationStatus(status));
}

function shouldLogGenerationPoll(input: {
  jobId?: string;
  jobStatus?: string;
  taskStatusSummary?: GenerationTaskStatusSummary;
  status: OpsEventStatus;
}) {
  const jobId = clampText(input.jobId, 120);
  if (!jobId) {
    return true;
  }
  const signature = JSON.stringify({
    jobStatus: clampText(input.jobStatus, 64).toLowerCase(),
    taskStatusSummary: normalizeGenerationStatusSummary(input.taskStatusSummary) ?? {},
  });
  const previous = generationOpsPollState.get(jobId);
  const nextCount = (previous?.count ?? 0) + 1;
  generationOpsPollState.set(jobId, { count: nextCount, signature });
  const terminal = isTerminalGenerationStatus(input.jobStatus);
  if (!previous) {
    return true;
  }
  if (previous.signature !== signature) {
    return true;
  }
  if (terminal) {
    return false;
  }
  if (input.status === "error") {
    return true;
  }
  return nextCount % 10 === 0;
}

function hasMeaningfulGenerationSummary(summary?: GenerationTaskStatusSummary | null) {
  if (!summary) {
    return false;
  }
  return Object.values(summary).some((value) => Number(value) > 0);
}

function shouldDropGenerationEvent(input: GenerationOpsEventInput) {
  const action = clampText(input.action, 64);
  const runId = clampText(input.runId, 120);
  const jobId = clampText(input.jobId, 120);
  const projectId = clampText(input.projectId, 120);
  const hasIdentifiers = Boolean(runId || jobId || projectId);
  const hasSummary = hasMeaningfulGenerationSummary(input.taskStatusSummary);
  if (action === "generation.project.restore") {
    if (input.status !== "error") {
      return true;
    }
    if (!jobId && !projectId) {
      return true;
    }
    const restoreCode = clampText(input.code || input.errorCode || input.jobStatus || "restore", 64);
    const restoreKey = [projectId || "-", jobId || "-", restoreCode || "-"].join(":");
    if (generationOpsRestoreSeen.has(restoreKey)) {
      return true;
    }
    generationOpsRestoreSeen.add(restoreKey);
  }
  if (action === "generation.trace.summary") {
    if (!hasIdentifiers && !hasSummary) {
      return true;
    }
    const summaryKey = [
      runId || "-",
      jobId || "-",
      clampText(input.taskId, 120) || "-",
      clampText(input.code || input.errorCode || input.jobStatus || "summary", 64) || "-",
    ].join(":");
    if (generationOpsTraceSummarySeen.has(summaryKey)) {
      return true;
    }
    generationOpsTraceSummarySeen.add(summaryKey);
  }
  if (
    (action === "generation.tasks.run.start" ||
      action === "generation.provider.poll.start" ||
      action === "generation.provider.poll.processing") &&
    clampText(input.taskStatus, 64).toLowerCase() === "generating"
  ) {
    return true;
  }
  return false;
}

export async function logGenerationOpsEvent(input: GenerationOpsEventInput) {
  if (shouldDropGenerationEvent(input)) {
    return null;
  }
  const runId = clampText(input.runId, 120);
  const jobId = clampText(input.jobId, 120);
  const taskId = clampText(input.taskId, 120);
  const action = clampText(input.action, 64) || "generation.unknown";
  const code = clampText(input.code, 64);
  const dedupeKey = [runId || "-", jobId || "-", taskId || "-", action, code || "-"].join(":");
  const now = Date.now();
  const status = input.status;
  if (status === "error") {
    const lastSeen = generationOpsDedupCache.get(dedupeKey) ?? 0;
    if (lastSeen && now - lastSeen < GENERATION_LOG_REPEAT_WINDOW_MS) {
      return null;
    }
    generationOpsDedupCache.set(dedupeKey, now);
  }
  if (action === "generation.job.poll" && !shouldLogGenerationPoll(input)) {
    return null;
  }
  const jobStatus = clampText(input.jobStatus, 64).toLowerCase();
  if (jobId && isTerminalGenerationStatus(jobStatus) && (action === "generation.job.poll" || action === "generation.project.restore")) {
    const terminalKey = `${jobId}:${action}:${jobStatus || "terminal"}`;
    if (generationOpsTerminalSeen.has(terminalKey)) {
      return null;
    }
    generationOpsTerminalSeen.add(terminalKey);
  }
  const jobCount = jobId ? (generationOpsJobCounts.get(jobId) ?? 0) : 0;
  const runCount = runId ? (generationOpsRunCounts.get(runId) ?? 0) : 0;
  const isSummaryEvent = action === "generation.trace.summary";
  const isTerminalEvent = isTerminalGenerationStatus(jobStatus) || summaryHasTerminalGenerationStatus(input.taskStatusSummary);
  if ((jobId && jobCount >= GENERATION_LOG_JOB_CAP) || (runId && runCount >= GENERATION_LOG_RUN_CAP)) {
    if (status !== "error" && !isSummaryEvent && !isTerminalEvent) {
      return null;
    }
  }
  const eventId = await logOpsEvent({
    category: "image",
    action,
    status,
    source: input.source,
    code: code || undefined,
    message: clampText(input.message, 500) || undefined,
    userEmail: input.userEmail,
    projectId: input.projectId,
    details: buildGenerationOpsDetails(input),
  });
  if (eventId) {
    if (jobId) {
      generationOpsJobCounts.set(jobId, jobCount + 1);
    }
    if (runId) {
      generationOpsRunCounts.set(runId, runCount + 1);
    }
  }
  return eventId;
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

export async function logOpsEvent(input: OpsEventInput) {
  try {
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
    const sqlText = `INSERT INTO ops_events (id, category, action, status, source, code, message, user_email, project_id, details_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
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
    ];
    if (hasManagedDatabase()) {
      await pgRun(sqlText, params);
    } else {
      const { db } = getDb();
      db.prepare(sqlText).run(...params);
    }
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
        createdAt: readCreatedAtValue(row),
      })),
    },
    checkout: checkoutStats,
  };
}

export async function listOpsEvents(input?: {
  id?: string;
  userEmail?: string;
  projectId?: string;
  category?: string;
  action?: string;
  status?: string;
  source?: string;
  code?: string;
  limit?: number;
  offset?: number;
  runId?: string;
  jobId?: string;
  taskId?: string;
  from?: string;
  to?: string;
}) {
  const filters: string[] = [];
  const params: Array<string | number> = [];

  const normalizedId = clampText(input?.id, 160);
  if (normalizedId) {
    filters.push("id = ?");
    params.push(normalizedId);
  }

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

  const pushDetailsFilter = (field: "runId" | "jobId" | "taskId", value?: string) => {
    const normalized = clampText(value, 160);
    if (!normalized) {
      return;
    }
    filters.push("LOWER(COALESCE(details_json, '')) LIKE ?");
    params.push(`%\"${field.toLowerCase()}\":\"${normalized.toLowerCase()}\"%`);
  };

  pushDetailsFilter("runId", input?.runId);
  pushDetailsFilter("jobId", input?.jobId);
  pushDetailsFilter("taskId", input?.taskId);

  const normalizedFrom = clampText(input?.from, 64);
  if (normalizedFrom) {
    filters.push("created_at >= ?");
    params.push(normalizedFrom);
  }
  const normalizedTo = clampText(input?.to, 64);
  if (normalizedTo) {
    filters.push("created_at <= ?");
    params.push(normalizedTo);
  }

  const limit = Math.min(500, Math.max(1, Math.round(input?.limit ?? 120)));
  const offset = Math.max(0, Math.round(input?.offset ?? 0));
  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const sqlText = `SELECT
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
     LIMIT ?
     OFFSET ?`;
  const rows = hasManagedDatabase()
    ? await pgAll(sqlText, ...params, limit, offset) as Array<Record<string, unknown>>
    : (() => {
        const { db } = getDb();
        return db.prepare(sqlText).all(...params, limit, offset) as Array<Record<string, unknown>>;
      })();

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
    createdAt: readCreatedAtValue(row),
  })) satisfies OpsEventRow[];
}
