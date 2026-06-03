import { getDb } from "./db";
import { hasManagedDatabase, pgGet, pgRun } from "./postgres";

type UsageDecision = {
  ok: boolean;
  current: number;
  limit: number;
};

function nowIso() {
  return new Date().toISOString();
}

function toUtcDateBucket(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export async function incrementUsageCounter(input: {
  scopeKey: string;
  metricKey: string;
  bucket?: string;
}) {
  const bucket = input.bucket ?? toUtcDateBucket();
  if (hasManagedDatabase()) {
    await pgRun(
      `INSERT INTO usage_counters (scope_key, metric_key, bucket, count, updated_at)
       VALUES (?, ?, ?, 1, ?)
       ON CONFLICT(scope_key, metric_key, bucket)
       DO UPDATE SET count = usage_counters.count + 1, updated_at = excluded.updated_at`,
      [input.scopeKey, input.metricKey, bucket, nowIso()],
    );
    const row = (await pgGet("SELECT count FROM usage_counters WHERE scope_key = ? AND metric_key = ? AND bucket = ?", [
      input.scopeKey,
      input.metricKey,
      bucket,
    ])) as { count?: number } | undefined;
    return Number(row?.count ?? 0);
  }
  const { db } = getDb();
  db.prepare(
    `INSERT INTO usage_counters (scope_key, metric_key, bucket, count, updated_at)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(scope_key, metric_key, bucket)
     DO UPDATE SET count = count + 1, updated_at = excluded.updated_at`,
  ).run(input.scopeKey, input.metricKey, bucket, nowIso());

  const row = db
    .prepare("SELECT count FROM usage_counters WHERE scope_key = ? AND metric_key = ? AND bucket = ?")
    .get(input.scopeKey, input.metricKey, bucket) as { count?: number } | undefined;

  return row?.count ?? 0;
}

export async function getUsageCounter(input: {
  scopeKey: string;
  metricKey: string;
  bucket?: string;
}) {
  const bucket = input.bucket ?? toUtcDateBucket();
  if (hasManagedDatabase()) {
    const row = (await pgGet("SELECT count FROM usage_counters WHERE scope_key = ? AND metric_key = ? AND bucket = ?", [
      input.scopeKey,
      input.metricKey,
      bucket,
    ])) as { count?: number } | undefined;
    return Number(row?.count ?? 0);
  }
  const { db } = getDb();
  const row = db
    .prepare("SELECT count FROM usage_counters WHERE scope_key = ? AND metric_key = ? AND bucket = ?")
    .get(input.scopeKey, input.metricKey, bucket) as { count?: number } | undefined;
  return row?.count ?? 0;
}

export async function incrementAndCheckUsageLimit(input: {
  scopeKey: string;
  metricKey: string;
  limit: number;
  bucket?: string;
}): Promise<UsageDecision> {
  const current = await incrementUsageCounter(input);
  return {
    ok: current <= input.limit,
    current,
    limit: input.limit,
  };
}
