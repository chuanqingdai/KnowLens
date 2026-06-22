import postgres from "postgres";
import { runManagedSchemaMigration } from "./managed-schema.mjs";

let sqlClient: postgres.Sql | null = null;
let schemaReadyPromise: Promise<void> | null = null;
let userPasswordSchemaReadyPromise: Promise<void> | null = null;

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
    onnotice: () => undefined,
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
  unsafe: (
    query: string,
    parameters?: postgres.ParameterOrJSON<never>[],
  ) => Promise<Array<Record<string, unknown>>>;
};

function normalizeParams(params: unknown[]): postgres.ParameterOrJSON<never>[] {
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0] as postgres.ParameterOrJSON<never>[];
  }
  return params as postgres.ParameterOrJSON<never>[];
}

export async function pgAll(sqlText: string, ...params: unknown[]) {
  await ensureManagedSchemaForRuntime();
  return pgAllUnsafe(sqlText, ...params);
}

export async function pgGet(sqlText: string, ...params: unknown[]) {
  const rows = await pgAll(sqlText, ...params);
  return rows[0] as Record<string, unknown> | undefined;
}

export async function pgRun(sqlText: string, ...params: unknown[]) {
  await ensureManagedSchemaForRuntime();
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
  await ensureManagedSchemaForRuntime();
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

function shouldAutoMigrateManagedSchema() {
  if (!hasManagedDatabase()) {
    return false;
  }
  if (process.env.KNOWLENS_MANAGED_SCHEMA_AUTO_MIGRATE === "true") {
    return true;
  }
  return process.env.NODE_ENV !== "production";
}

async function ensureManagedSchemaForRuntime() {
  if (!shouldAutoMigrateManagedSchema()) {
    return;
  }
  await ensureManagedSchema();
}

export async function ensureManagedSchema() {
  if (!hasManagedDatabase()) {
    return;
  }
  if (schemaReadyPromise) {
    return schemaReadyPromise;
  }
  schemaReadyPromise = runManagedSchemaMigration(getSql()).catch((error) => {
    schemaReadyPromise = null;
    throw error;
  });
  return schemaReadyPromise;
}

function isDuplicateColumnError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? "").toLowerCase();
  return message.includes("column") && message.includes("already exists");
}

async function addColumnIfMissing(sql: postgres.Sql, tableName: string, columnDefinition: string) {
  try {
    await sql.unsafe(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition};`);
  } catch (error) {
    if (isDuplicateColumnError(error)) {
      return;
    }
    throw error;
  }
}

export async function ensureManagedUserPasswordSchema() {
  if (!hasManagedDatabase()) {
    return;
  }
  if (userPasswordSchemaReadyPromise) {
    return userPasswordSchemaReadyPromise;
  }
  userPasswordSchemaReadyPromise = (async () => {
    const sql = getSql();
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password_hash TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        status TEXT NOT NULL DEFAULT 'active',
        last_login_at TEXT,
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      );
    `);
    await addColumnIfMissing(sql, "users", "password_hash TEXT");
    await addColumnIfMissing(sql, "users", "status TEXT NOT NULL DEFAULT 'active'");
    await addColumnIfMissing(sql, "users", "last_login_at TEXT");
  })().catch((error) => {
    userPasswordSchemaReadyPromise = null;
    throw error;
  });
  return userPasswordSchemaReadyPromise;
}
