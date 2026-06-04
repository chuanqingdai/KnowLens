import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { requireAdminEmail } from "@/lib/server/admin-auth";
import { hasManagedDatabase, pgAll, pgGet } from "@/lib/server/postgres";
import { parseOpsEventDetailsJson, readOpsLogFileByUserEmail } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
  createdAt: string;
  updatedAt: string;
};

type ProjectRow = {
  id: string;
  title: string;
  status: string | null;
  format: string | null;
  duration: string | null;
  updatedAt: string;
};

type CreditRow = {
  id: string;
  type: string;
  description: string;
  delta: number;
  balance: number;
  projectId: string | null;
  projectTitle: string | null;
  createdAt: string;
};

type SubscriptionRow = {
  id: string;
  planId: string | null;
  planName: string | null;
  cycle: string | null;
  status: string | null;
  renewAt: string | null;
  startedAt: string | null;
  updatedAt: string | null;
};

type PaymentRow = {
  sessionId: string;
  planId: string | null;
  cycle: string | null;
  checkoutSource: string | null;
  checkoutStatus: string | null;
  createdAt: string;
};

type TicketRow = {
  id: string;
  type: string;
  detail: string;
  status: string | null;
  createdAt: string;
};

type UsageLogRow = {
  id: string;
  category: string;
  action: string;
  status: "ok" | "error" | "info";
  source: string | null;
  code: string | null;
  message: string | null;
  userEmail: string | null;
  projectId: string | null;
  detailsJson: string | null;
  createdAt: string;
  runId: string | null;
  jobId: string | null;
  taskId: string | null;
  durationMs: number | null;
};

function parseIntInRange(raw: string | null, fallback: number, min: number, max: number) {
  const value = Number.parseInt((raw ?? "").trim(), 10);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

async function queryAll(sqlText: string, params: unknown[] = []) {
  if (hasManagedDatabase()) {
    return (await pgAll(sqlText, params)) as Array<Record<string, unknown>>;
  }
  const { db } = getDb();
  return db.prepare(sqlText).all(...params) as Array<Record<string, unknown>>;
}

async function queryOne(sqlText: string, params: unknown[] = []) {
  if (hasManagedDatabase()) {
    return ((await pgGet(sqlText, params)) || null) as Record<string, unknown> | null;
  }
  const { db } = getDb();
  return (db.prepare(sqlText).get(...params) || null) as Record<string, unknown> | null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : Number(value ?? 0) || 0;
}

function normalizeLogStatus(value: unknown): "ok" | "error" | "info" {
  const normalized = asString(value).trim().toLowerCase();
  return normalized === "ok" || normalized === "error" ? normalized : "info";
}

function formatLogTimestamp(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return input;
  }
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function parseFileLogLine(line: string): UsageLogRow | null {
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    const id = asString(parsed.id).trim();
    const category = asString(parsed.category).trim();
    const action = asString(parsed.action).trim();
    const createdAt = asString(parsed.ts).trim();
    const details =
      parsed.details && typeof parsed.details === "object" ? (parsed.details as Record<string, unknown>) : null;
    if (!id || !category || !action || !createdAt) {
      return null;
    }
    return {
      id,
      category,
      action,
      status: normalizeLogStatus(parsed.status),
      source: asNullableString(parsed.source),
      code: asNullableString(parsed.code),
      message: asNullableString(parsed.message),
      userEmail: asNullableString(parsed.userEmail)?.toLowerCase() ?? null,
      projectId: asNullableString(parsed.projectId),
      detailsJson: details ? JSON.stringify(details) : null,
      createdAt,
      runId: asNullableString(details?.runId),
      jobId: asNullableString(details?.jobId),
      taskId: asNullableString(details?.taskId),
      durationMs:
        typeof details?.durationMs === "number" && Number.isFinite(details.durationMs) ? details.durationMs : null,
    };
  } catch {
    return null;
  }
}

function normalizeDbLogRow(row: Record<string, unknown>): UsageLogRow {
  const details = parseOpsEventDetailsJson(asNullableString(row.detailsJson));
  const durationFromDetails = typeof details?.durationMs === "number" ? details.durationMs : null;
  return {
    id: asString(row.id),
    category: asString(row.category),
    action: asString(row.action),
    status: normalizeLogStatus(row.status),
    source: asNullableString(row.source),
    code: asNullableString(row.code),
    message: asNullableString(row.message),
    userEmail: asNullableString(row.userEmail)?.toLowerCase() ?? null,
    projectId: asNullableString(row.projectId),
    detailsJson: asNullableString(row.detailsJson),
    createdAt: asString(row.createdAt),
    runId: asNullableString(details?.runId),
    jobId: asNullableString(details?.jobId),
    taskId: asNullableString(details?.taskId),
    durationMs: durationFromDetails,
  };
}

function buildLogTimelineText(logs: UsageLogRow[]) {
  if (!logs.length) {
    return "暂无日志记录。";
  }
  return logs
    .map((item) => {
      const headline = [
        `[${formatLogTimestamp(item.createdAt)}]`,
        item.status.toUpperCase(),
        `${item.category}/${item.action}`,
      ].join(" ");
      const meta = [
        item.projectId ? `projectId: ${item.projectId}` : null,
        item.runId ? `runId: ${item.runId}` : null,
        item.jobId ? `jobId: ${item.jobId}` : null,
        item.taskId ? `taskId: ${item.taskId}` : null,
        item.code ? `errorCode: ${item.code}` : null,
        typeof item.durationMs === "number" ? `duration: ${item.durationMs}ms` : null,
      ].filter(Boolean);
      const extra = [
        item.source ? `source: ${item.source}` : null,
        item.message ? `message: ${item.message}` : null,
      ].filter(Boolean);
      return [headline, meta.length ? `  ${meta.join(" | ")}` : null, ...extra.map((line) => `  ${line}`)]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

async function getUserLogs(userEmail: string, limit: number) {
  const normalizedUserEmail = userEmail.trim().toLowerCase();
  const rows = (await queryAll(
    `SELECT
       id,
       category,
       action,
       status,
       source,
       code,
       message,
       user_email as "userEmail",
       project_id as "projectId",
       details_json as "detailsJson",
       created_at as "createdAt"
     FROM ops_events
     WHERE LOWER(COALESCE(user_email, '')) = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [normalizedUserEmail, limit],
  )) as Array<Record<string, unknown>>;

  const merged = new Map<string, UsageLogRow>();
  rows.map(normalizeDbLogRow).forEach((item) => merged.set(item.id, item));

  const fileResult = readOpsLogFileByUserEmail(normalizedUserEmail, limit);
  for (const line of fileResult.lines) {
    const parsed = parseFileLogLine(line);
    if (!parsed || parsed.userEmail !== normalizedUserEmail || merged.has(parsed.id)) {
      continue;
    }
    merged.set(parsed.id, parsed);
  }

  return Array.from(merged.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function buildRecentActiveAt(input: {
  user: UserRow;
  projects: ProjectRow[];
  credits: CreditRow[];
  subscription: SubscriptionRow | null;
  payments: PaymentRow[];
  tickets: TicketRow[];
  logs: UsageLogRow[];
}) {
  return [
    input.user.updatedAt,
    input.projects[0]?.updatedAt ?? null,
    input.credits[0]?.createdAt ?? null,
    input.subscription?.updatedAt ?? null,
    input.payments[0]?.createdAt ?? null,
    input.tickets[0]?.createdAt ?? null,
    input.logs[0]?.createdAt ?? null,
  ]
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a))[0] ?? input.user.createdAt;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const adminEmail = await requireAdminEmail();
  if (!adminEmail) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const resolvedParams = await context.params;
  const userLookup = decodeURIComponent(resolvedParams?.userId ?? "").trim();
  const view = (request.nextUrl.searchParams.get("view") ?? "summary").trim().toLowerCase();
  const logLimit = parseIntInRange(request.nextUrl.searchParams.get("logLimit"), 5000, 50, 5000);

  if (!userLookup) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  const lookupIsEmail = userLookup.includes("@");
  const userRow = await queryOne(
    `SELECT
       id,
       email,
       name,
       role,
       created_at as "createdAt",
       updated_at as "updatedAt"
     FROM users
     WHERE ${lookupIsEmail ? "LOWER(email) = ?" : "id = ?"}
     LIMIT 1`,
    [lookupIsEmail ? userLookup.toLowerCase() : userLookup],
  );

  if (!userRow) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const user: UserRow = {
    id: asString(userRow.id),
    email: asString(userRow.email).trim().toLowerCase(),
    name: asNullableString(userRow.name),
    role: asNullableString(userRow.role),
    createdAt: asString(userRow.createdAt),
    updatedAt: asString(userRow.updatedAt),
  };

  const [projectsRaw, creditsRaw, subscriptionRaw, paymentsRaw, ticketsRaw, logs] = await Promise.all([
    queryAll(
      `SELECT
         id,
         title,
         status,
         format,
         duration,
         updated_at as "updatedAt"
       FROM projects
       WHERE user_id = ?
       ORDER BY updated_at DESC
       LIMIT 50`,
      [user.id],
    ),
    queryAll(
      `SELECT
         id,
         type,
         description,
         delta,
         balance,
         project_id as "projectId",
         project_title as "projectTitle",
         created_at as "createdAt"
       FROM credit_records
       WHERE LOWER(COALESCE(user_email, '')) = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 50`,
      [user.email],
    ),
    queryOne(
      `SELECT
         id,
         plan_id as "planId",
         plan_name as "planName",
         cycle,
         status,
         renew_at as "renewAt",
         started_at as "startedAt",
         updated_at as "updatedAt"
       FROM subscriptions
       WHERE user_id = ?
       ORDER BY
         CASE WHEN status IN ('active', 'canceling') THEN 0 ELSE 1 END ASC,
         updated_at DESC,
         created_at DESC
       LIMIT 1`,
      [user.id],
    ),
    queryAll(
      `SELECT
         session_id as "sessionId",
         plan_id as "planId",
         cycle,
         checkout_source as "checkoutSource",
         checkout_status as "checkoutStatus",
         created_at as "createdAt"
       FROM billing_fulfillments
       WHERE LOWER(COALESCE(user_email, '')) = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [user.email],
    ),
    queryAll(
      `SELECT
         id,
         type,
         detail,
         status,
         created_at as "createdAt"
       FROM feedback_tickets
       WHERE LOWER(COALESCE(submitter_email, '')) = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [user.email],
    ),
    getUserLogs(user.email, logLimit),
  ]);

  const projects: ProjectRow[] = projectsRaw.map((row) => ({
    id: asString(row.id),
    title: asString(row.title),
    status: asNullableString(row.status),
    format: asNullableString(row.format),
    duration: asNullableString(row.duration),
    updatedAt: asString(row.updatedAt),
  }));

  const credits: CreditRow[] = creditsRaw.map((row) => ({
    id: asString(row.id),
    type: asString(row.type),
    description: asString(row.description),
    delta: asNumber(row.delta),
    balance: asNumber(row.balance),
    projectId: asNullableString(row.projectId),
    projectTitle: asNullableString(row.projectTitle),
    createdAt: asString(row.createdAt),
  }));

  const subscription: SubscriptionRow | null = subscriptionRaw
    ? {
        id: asString(subscriptionRaw.id),
        planId: asNullableString(subscriptionRaw.planId),
        planName: asNullableString(subscriptionRaw.planName),
        cycle: asNullableString(subscriptionRaw.cycle),
        status: asNullableString(subscriptionRaw.status),
        renewAt: asNullableString(subscriptionRaw.renewAt),
        startedAt: asNullableString(subscriptionRaw.startedAt),
        updatedAt: asNullableString(subscriptionRaw.updatedAt),
      }
    : null;

  const payments: PaymentRow[] = paymentsRaw.map((row) => ({
    sessionId: asString(row.sessionId),
    planId: asNullableString(row.planId),
    cycle: asNullableString(row.cycle),
    checkoutSource: asNullableString(row.checkoutSource),
    checkoutStatus: asNullableString(row.checkoutStatus),
    createdAt: asString(row.createdAt),
  }));

  const tickets: TicketRow[] = ticketsRaw.map((row) => ({
    id: asString(row.id),
    type: asString(row.type),
    detail: asString(row.detail),
    status: asNullableString(row.status),
    createdAt: asString(row.createdAt),
  }));

  const recentActiveAt = buildRecentActiveAt({
    user,
    projects,
    credits,
    subscription,
    payments,
    tickets,
    logs,
  });

  const payload = {
    user: {
      ...user,
      recentActiveAt,
    },
    subscription,
    payments,
    credits: {
      currentBalance: credits[0]?.balance ?? 0,
      records: credits,
    },
    projects,
    tickets,
    logSummary: {
      totalCount: logs.length,
      errorCount: logs.filter((item) => item.status === "error").length,
      latestAt: logs[0]?.createdAt ?? null,
    },
  };

  const headers = {
    "Cache-Control": "no-store, max-age=0, must-revalidate",
  };

  if (view === "logs") {
    return NextResponse.json(
      {
        ...payload,
        logs,
        logText: buildLogTimelineText(logs),
      },
      { headers },
    );
  }

  return NextResponse.json(payload, { headers });
}
