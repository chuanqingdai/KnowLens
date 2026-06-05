#!/usr/bin/env node
import postgres from "postgres";
import { runManagedSchemaMigration } from "../src/lib/server/managed-schema.mjs";

function getDatabaseUrl() {
  return (process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();
}

const databaseUrl = getDatabaseUrl();

if (!databaseUrl) {
  console.error("DATABASE_URL or POSTGRES_URL is required to run the managed schema migration.");
  process.exit(1);
}

const sql = postgres(databaseUrl, {
  max: 1,
  idle_timeout: 5,
  connect_timeout: 15,
  prepare: false,
  onnotice: () => undefined,
});

try {
  const startedAt = Date.now();
  console.info("Running managed database schema migration...");
  await runManagedSchemaMigration(sql);
  console.info(`Managed database schema migration completed in ${Date.now() - startedAt}ms.`);
} finally {
  await sql.end({ timeout: 5 });
}
