import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export type DbHandle = {
  db: DatabaseSync;
};

let singleton: DbHandle | null = null;

function getDefaultLocalSharedDbPath() {
  return path.join(os.homedir(), ".knowlens", "shared", "knowlens.sqlite");
}

function getDbFilePath() {
  if (process.env.KNOWLENS_DB_PATH?.trim()) {
    return process.env.KNOWLENS_DB_PATH.trim();
  }
  if (process.env.VERCEL === "1") {
    return path.join("/tmp", "knowlens.sqlite");
  }
  return getDefaultLocalSharedDbPath();
}

function ensureParentDir(filePath: string) {
  if (!filePath || filePath === ":memory:") {
    return;
  }
  const normalizedPath = filePath.startsWith("file:") ? filePath.replace(/^file:/, "") : filePath;
  const directory = path.dirname(normalizedPath);
  if (directory && directory !== ".") {
    mkdirSync(directory, { recursive: true });
  }
}

function createTables(db: DatabaseSync) {
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      format TEXT,
      duration TEXT,
      updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      plan_name TEXT NOT NULL,
      cycle TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      renew_at TEXT NOT NULL,
      canceled_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

    CREATE TABLE IF NOT EXISTS credit_records (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_email TEXT,
      project_id TEXT,
      project_title TEXT,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      delta INTEGER NOT NULL,
      balance INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_credit_records_user_email ON credit_records(user_email);
    CREATE INDEX IF NOT EXISTS idx_credit_records_user_id ON credit_records(user_id);

    CREATE TABLE IF NOT EXISTS feedback_tickets (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      detail TEXT NOT NULL,
      contact TEXT NOT NULL,
      attachments_json TEXT NOT NULL DEFAULT '[]',
      submitter_email TEXT,
      submitter_name TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      admin_reply TEXT,
      replied_at TEXT,
      replied_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS featured_case_metrics (
      case_id TEXT NOT NULL,
      user_scope TEXT NOT NULL,
      views_delta INTEGER NOT NULL DEFAULT 0,
      likes_delta INTEGER NOT NULL DEFAULT 0,
      liked INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (case_id, user_scope)
    );

    CREATE INDEX IF NOT EXISTS idx_featured_case_metrics_case_id ON featured_case_metrics(case_id);

    CREATE TABLE IF NOT EXISTS upload_jobs (
      id TEXT PRIMARY KEY,
      user_scope TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      source_kind TEXT NOT NULL,
      status TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      error_message TEXT,
      storage_key TEXT,
      public_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_upload_jobs_scope ON upload_jobs(user_scope);
    CREATE INDEX IF NOT EXISTS idx_upload_jobs_status ON upload_jobs(status);

    CREATE TABLE IF NOT EXISTS api_rate_limits (
      scope_key TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      window_start INTEGER NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (scope_key, endpoint, window_start)
    );

    CREATE TABLE IF NOT EXISTS usage_counters (
      scope_key TEXT NOT NULL,
      metric_key TEXT NOT NULL,
      bucket TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (scope_key, metric_key, bucket)
    );

    CREATE INDEX IF NOT EXISTS idx_usage_counters_scope_bucket
      ON usage_counters(scope_key, bucket);

    CREATE TABLE IF NOT EXISTS billing_fulfillments (
      session_id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      cycle TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ops_events (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      source TEXT,
      code TEXT,
      message TEXT,
      user_email TEXT,
      project_id TEXT,
      details_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_ops_events_created_at ON ops_events(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ops_events_category_status ON ops_events(category, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ops_events_source ON ops_events(source, created_at DESC);
  `);

  const uploadJobColumns = [
    "source_url TEXT",
    "input_path TEXT",
    "source_text TEXT",
    "source_title TEXT",
    "result_excerpt TEXT",
    "result_text TEXT",
    "result_kind TEXT",
    "error_code TEXT",
  ];

  for (const columnDef of uploadJobColumns) {
    try {
      db.exec(`ALTER TABLE upload_jobs ADD COLUMN ${columnDef}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/duplicate column name/i.test(message)) {
        throw error;
      }
    }
  }

  const billingFulfillmentColumns = [
    "checkout_source TEXT",
    "checkout_status TEXT",
  ];

  for (const columnDef of billingFulfillmentColumns) {
    try {
      db.exec(`ALTER TABLE billing_fulfillments ADD COLUMN ${columnDef}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/duplicate column name/i.test(message)) {
        throw error;
      }
    }
  }
}

export function getDb() {
  if (singleton) {
    return singleton;
  }
  const filePath = getDbFilePath();
  ensureParentDir(filePath);
  const db = new DatabaseSync(filePath);
  createTables(db);
  singleton = { db };
  return singleton;
}
