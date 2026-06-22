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
    const configuredPath = process.env.KNOWLENS_DB_PATH.trim();
    if (
      process.env.NODE_ENV === "production" &&
      configuredPath.startsWith("/tmp") &&
      process.env.KNOWLENS_ALLOW_EPHEMERAL_SQLITE !== "1"
    ) {
      throw new Error(
        "Persistent database is required in production. KNOWLENS_DB_PATH must not point to /tmp unless KNOWLENS_ALLOW_EPHEMERAL_SQLITE=1 is explicitly set.",
      );
    }
    return configuredPath;
  }
  if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
    if (process.env.KNOWLENS_ALLOW_EPHEMERAL_SQLITE === "1") {
      return path.join("/tmp", "knowlens.sqlite");
    }
    throw new Error(
      "Persistent database is required in production. Set KNOWLENS_DB_PATH to a durable database file path or configure a managed database adapter.",
    );
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
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      last_login_at TEXT,
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
      stripe_subscription_id TEXT,
      status TEXT NOT NULL,
      monthly_credit_amount INTEGER,
      started_at TEXT NOT NULL,
      renew_at TEXT NOT NULL,
      credit_period_started_at TEXT,
      credit_period_ends_at TEXT,
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
    CREATE INDEX IF NOT EXISTS idx_ops_events_user_email ON ops_events(user_email, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ops_events_project_id ON ops_events(project_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS image_generation_jobs (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      project_id TEXT,
      intent TEXT,
      ratio TEXT,
      image_model_policy TEXT,
      idempotency_key TEXT,
      run_id TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      error_code TEXT,
      error_message TEXT,
      request_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_image_generation_jobs_user_email
      ON image_generation_jobs(user_email, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_image_generation_jobs_project_id
      ON image_generation_jobs(project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_image_generation_jobs_idempotency
      ON image_generation_jobs(user_email, idempotency_key, created_at DESC);
    CREATE TABLE IF NOT EXISTS image_generation_tasks (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      task_index INTEGER NOT NULL,
      output_type TEXT,
      aspect_ratio TEXT,
      prompt_text TEXT,
      provider_order TEXT,
      provider_used TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      attempts INTEGER NOT NULL DEFAULT 0,
      error_code TEXT,
      error_message TEXT,
      raw_image_url TEXT,
      render_url TEXT,
      asset_path TEXT,
      mime_type TEXT,
      width INTEGER,
      height INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(job_id) REFERENCES image_generation_jobs(id)
    );

    CREATE INDEX IF NOT EXISTS idx_image_generation_tasks_job_id
      ON image_generation_tasks(job_id, task_index ASC);
    CREATE INDEX IF NOT EXISTS idx_image_generation_tasks_status
      ON image_generation_tasks(status, updated_at DESC);

    CREATE TABLE IF NOT EXISTS image_generation_refunds (
      id TEXT PRIMARY KEY,
      refund_key TEXT NOT NULL UNIQUE,
      job_id TEXT NOT NULL,
      task_id TEXT,
      task_index INTEGER,
      user_email TEXT NOT NULL,
      project_id TEXT,
      amount INTEGER NOT NULL,
      reason TEXT,
      credit_record_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_image_generation_refunds_job_id
      ON image_generation_refunds(job_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_image_generation_refunds_user_email
      ON image_generation_refunds(user_email, created_at DESC);

    CREATE TABLE IF NOT EXISTS workspace_project_pages (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      page_index INTEGER NOT NULL,
      output_type TEXT NOT NULL,
      page_role TEXT,
      title TEXT,
      subtitle TEXT,
      body TEXT,
      visual TEXT,
      image_prompt_draft TEXT,
      image_task_id TEXT,
      image_url TEXT,
      raw_image_url TEXT,
      asset_path TEXT,
      status TEXT,
      error_code TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, user_email, output_type, page_index)
    );

    CREATE INDEX IF NOT EXISTS idx_workspace_project_pages_project
      ON workspace_project_pages(user_email, project_id, output_type, page_index ASC);
    CREATE INDEX IF NOT EXISTS idx_workspace_project_pages_task
      ON workspace_project_pages(image_task_id);

    CREATE TABLE IF NOT EXISTS published_cases (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      output_type TEXT NOT NULL,
      author_label TEXT,
      source_project_id TEXT,
      source_user_email TEXT,
      cover_asset_id TEXT,
      cover_url TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      featured INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      published_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_published_cases_status
      ON published_cases(status, featured, sort_order ASC, published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_published_cases_source_project
      ON published_cases(source_project_id, source_user_email);

    CREATE TABLE IF NOT EXISTS published_case_assets (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      slug TEXT NOT NULL,
      asset_type TEXT NOT NULL,
      title TEXT,
      description TEXT,
      page_index INTEGER NOT NULL DEFAULT 1,
      file_url TEXT NOT NULL,
      viewer_url TEXT NOT NULL,
      thumbnail_url TEXT,
      download_url TEXT,
      storage_key TEXT,
      mime_type TEXT,
      file_size INTEGER,
      width INTEGER,
      height INTEGER,
      duration_seconds INTEGER,
      is_primary INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(case_id) REFERENCES published_cases(id) ON DELETE CASCADE,
      UNIQUE(case_id, slug)
    );

    CREATE INDEX IF NOT EXISTS idx_published_case_assets_case
      ON published_case_assets(case_id, sort_order ASC, page_index ASC);
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

  const userColumns = [
    "password_hash TEXT",
    "status TEXT NOT NULL DEFAULT 'active'",
    "last_login_at TEXT",
  ];

  for (const columnDef of userColumns) {
    try {
      db.exec(`ALTER TABLE users ADD COLUMN ${columnDef}`);
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

  const imageGenerationJobColumns = [
    "run_id TEXT",
  ];

  for (const columnDef of imageGenerationJobColumns) {
    try {
      db.exec(`ALTER TABLE image_generation_jobs ADD COLUMN ${columnDef}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/duplicate column name/i.test(message)) {
        throw error;
      }
    }
  }

  try {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_image_generation_jobs_run_id
        ON image_generation_jobs(user_email, run_id, created_at DESC);
    `);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/no such column/i.test(message)) {
      throw error;
    }
  }

  const subscriptionColumns = [
    "stripe_subscription_id TEXT",
    "monthly_credit_amount INTEGER",
    "credit_period_started_at TEXT",
    "credit_period_ends_at TEXT",
  ];

  for (const columnDef of subscriptionColumns) {
    try {
      db.exec(`ALTER TABLE subscriptions ADD COLUMN ${columnDef}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/duplicate column name/i.test(message)) {
        throw error;
      }
    }
  }

  try {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id
        ON subscriptions(stripe_subscription_id);
    `);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/no such column/i.test(message)) {
      throw error;
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
