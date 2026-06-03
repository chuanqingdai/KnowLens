import postgres from "postgres";

let sqlClient: postgres.Sql | null = null;
let schemaReadyPromise: Promise<void> | null = null;

function getDatabaseUrl() {
  return (process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();
}

export function hasManagedDatabase() {
  return Boolean(getDatabaseUrl());
}

function getSql() {
  if (sqlClient) {
    return sqlClient;
  }
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for the managed database adapter.");
  }
  sqlClient = postgres(databaseUrl, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
  });
  return sqlClient;
}

export function getManagedSql() {
  return getSql();
}

function normalizeSql(sqlText: string) {
  return sqlText
    .replace(/datetime\('now'\)/gi, "CURRENT_TIMESTAMP")
    .replace(/\bINTEGER\s+NOT\s+NULL\s+DEFAULT\s+0\b/gi, "INTEGER NOT NULL DEFAULT 0")
    .replace(/\bTEXT\s+NOT\s+NULL\s+DEFAULT\s+\(CURRENT_TIMESTAMP\)/gi, "TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)")
    .replace(/\bcreated_at\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+\(CURRENT_TIMESTAMP\)/gi, "created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)")
    .replace(/\bupdated_at\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+\(CURRENT_TIMESTAMP\)/gi, "updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)");
}

function convertQuestionParams(sqlText: string) {
  let index = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let output = "";

  for (let i = 0; i < sqlText.length; i += 1) {
    const char = sqlText[i];
    const prev = sqlText[i - 1];

    if (char === "'" && !inDoubleQuote && prev !== "\\") {
      inSingleQuote = !inSingleQuote;
      output += char;
      continue;
    }
    if (char === '"' && !inSingleQuote && prev !== "\\") {
      inDoubleQuote = !inDoubleQuote;
      output += char;
      continue;
    }
    if (char === "?" && !inSingleQuote && !inDoubleQuote) {
      index += 1;
      output += `$${index}`;
      continue;
    }
    output += char;
  }

  return normalizeSql(output);
}

type PgTransaction = {
  unsafe: (query: string, parameters?: any[]) => Promise<Array<Record<string, unknown>>>;
};

function normalizeParams(params: unknown[]): any[] {
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0] as any[];
  }
  return params as any[];
}

export async function pgAll(sqlText: string, ...params: unknown[]) {
  await ensureManagedSchema();
  return pgAllUnsafe(sqlText, ...params);
}

export async function pgGet(sqlText: string, ...params: unknown[]) {
  const rows = await pgAll(sqlText, ...params);
  return rows[0] as Record<string, unknown> | undefined;
}

export async function pgRun(sqlText: string, ...params: unknown[]) {
  await ensureManagedSchema();
  await pgRunUnsafe(sqlText, ...params);
}

export async function pgAllUnsafe(sqlText: string, ...params: unknown[]) {
  return getSql().unsafe(convertQuestionParams(sqlText), normalizeParams(params)) as Promise<Array<Record<string, unknown>>>;
}

export async function pgGetUnsafe(sqlText: string, ...params: unknown[]) {
  const rows = await pgAllUnsafe(sqlText, ...params);
  return rows[0] as Record<string, unknown> | undefined;
}

export async function pgRunUnsafe(sqlText: string, ...params: unknown[]) {
  await getSql().unsafe(convertQuestionParams(sqlText), normalizeParams(params));
}

export async function pgTransaction<T>(callback: (tx: PgTransaction) => Promise<T>) {
  await ensureManagedSchema();
  return getSql().begin(async (tx) => callback(tx));
}

export async function pgTxAll(tx: PgTransaction, sqlText: string, ...params: unknown[]) {
  return tx.unsafe(convertQuestionParams(sqlText), normalizeParams(params)) as Promise<Array<Record<string, unknown>>>;
}

export async function pgTxGet(tx: PgTransaction, sqlText: string, ...params: unknown[]) {
  const rows = await pgTxAll(tx, sqlText, ...params);
  return rows[0] as Record<string, unknown> | undefined;
}

export async function pgTxRun(tx: PgTransaction, sqlText: string, ...params: unknown[]) {
  await tx.unsafe(convertQuestionParams(sqlText), normalizeParams(params));
}

export async function ensureManagedSchema() {
  if (!hasManagedDatabase()) {
    return;
  }
  if (schemaReadyPromise) {
    return schemaReadyPromise;
  }
  schemaReadyPromise = (async () => {
    const sql = getSql();
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        format TEXT,
        duration TEXT,
        updated_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      );
      CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        plan_id TEXT NOT NULL,
        plan_name TEXT NOT NULL,
        cycle TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        renew_at TEXT NOT NULL,
        canceled_at TEXT,
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
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

      CREATE TABLE IF NOT EXISTS billing_fulfillments (
        session_id TEXT PRIMARY KEY,
        user_email TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        cycle TEXT NOT NULL,
        checkout_source TEXT,
        checkout_status TEXT,
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      );

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

      CREATE TABLE IF NOT EXISTS upload_jobs (
        id TEXT PRIMARY KEY,
        user_scope TEXT NOT NULL,
        file_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size INTEGER NOT NULL DEFAULT 0,
        source_kind TEXT NOT NULL,
        source_url TEXT,
        input_path TEXT,
        source_text TEXT,
        status TEXT NOT NULL DEFAULT 'queued',
        progress INTEGER NOT NULL DEFAULT 0,
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        error_message TEXT,
        error_code TEXT,
        storage_key TEXT,
        public_url TEXT,
        result_excerpt TEXT,
        result_text TEXT,
        result_kind TEXT,
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      );
      CREATE INDEX IF NOT EXISTS idx_upload_jobs_user_scope_created
        ON upload_jobs(user_scope, created_at DESC);

      CREATE TABLE IF NOT EXISTS featured_case_metrics (
        case_id TEXT NOT NULL,
        user_scope TEXT NOT NULL,
        views_delta INTEGER NOT NULL DEFAULT 0,
        likes_delta INTEGER NOT NULL DEFAULT 0,
        liked INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        PRIMARY KEY (case_id, user_scope)
      );
      CREATE INDEX IF NOT EXISTS idx_featured_case_metrics_case_id ON featured_case_metrics(case_id);

      CREATE TABLE IF NOT EXISTS api_rate_limits (
        scope_key TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        window_start BIGINT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (scope_key, endpoint, window_start)
      );

      CREATE TABLE IF NOT EXISTS usage_counters (
        scope_key TEXT NOT NULL,
        metric_key TEXT NOT NULL,
        bucket TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        PRIMARY KEY (scope_key, metric_key, bucket)
      );
      CREATE INDEX IF NOT EXISTS idx_usage_counters_scope_bucket ON usage_counters(scope_key, bucket);

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
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      );
      CREATE INDEX IF NOT EXISTS idx_ops_events_created_at ON ops_events(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ops_events_category_status ON ops_events(category, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ops_events_source ON ops_events(source, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ops_events_user_email ON ops_events(user_email, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ops_events_project_id ON ops_events(project_id, created_at DESC);

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
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        UNIQUE(project_id, user_email, output_type, page_index)
      );
      CREATE INDEX IF NOT EXISTS idx_workspace_project_pages_project
        ON workspace_project_pages(user_email, project_id, output_type, page_index ASC);
      CREATE INDEX IF NOT EXISTS idx_workspace_project_pages_task ON workspace_project_pages(image_task_id);

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
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      );
      CREATE INDEX IF NOT EXISTS idx_image_generation_jobs_user_email
        ON image_generation_jobs(user_email, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_image_generation_jobs_project_id
        ON image_generation_jobs(project_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_image_generation_jobs_idempotency
        ON image_generation_jobs(user_email, idempotency_key, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_image_generation_jobs_run_id
        ON image_generation_jobs(user_email, run_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS image_generation_tasks (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL REFERENCES image_generation_jobs(id),
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
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      );
      CREATE INDEX IF NOT EXISTS idx_image_generation_tasks_job_id
        ON image_generation_tasks(job_id, task_index ASC);
      CREATE INDEX IF NOT EXISTS idx_image_generation_tasks_status
        ON image_generation_tasks(status, updated_at DESC);

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
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      );
      CREATE INDEX IF NOT EXISTS idx_published_cases_status
        ON published_cases(status, featured, sort_order ASC, published_at DESC);
      CREATE INDEX IF NOT EXISTS idx_published_cases_source_project
        ON published_cases(source_project_id, source_user_email);

      CREATE TABLE IF NOT EXISTS published_case_assets (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL REFERENCES published_cases(id) ON DELETE CASCADE,
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
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        UNIQUE(case_id, slug)
      );
      CREATE INDEX IF NOT EXISTS idx_published_case_assets_case
        ON published_case_assets(case_id, sort_order ASC, page_index ASC);
    `);
  })();
  return schemaReadyPromise;
}
