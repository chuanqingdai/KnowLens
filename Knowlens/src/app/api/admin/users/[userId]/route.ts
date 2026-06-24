import { NextRequest, NextResponse } from "next/server";
import {
  findBillingPlan,
  getBillingPlanDefaultCycle,
  isBillingPlanCycleSupported,
  type BillingCycle,
  type BillingPlanId,
} from "@/lib/billing-plans";
import { getDb } from "@/lib/server/db";
import { requireAdminEmail } from "@/lib/server/admin-auth";
import { hasManagedDatabase, pgAll, pgGet } from "@/lib/server/postgres";
import {
  applyBillingFulfillmentAtomic,
  applyCreditRecordAtomic,
  logOpsEvent,
  parseOpsEventDetailsJson,
  readOpsLogFileByUserEmail,
} from "@/lib/server/store";

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

type UserActivitySummary = {
  latestAt: string | null;
  totalCount: number;
  errorCount: number;
};

function addMonths(base: Date, count: number) {
  const next = new Date(base);
  next.setMonth(next.getMonth() + count);
  return next;
}

function parseIntInRange(raw: string | null, fallback: number, min: number, max: number) {
  const value = Number.parseInt((raw ?? "").trim(), 10);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function resolveDateRange(request: NextRequest) {
  const from = (request.nextUrl.searchParams.get("from") || "").trim();
  const to = (request.nextUrl.searchParams.get("to") || "").trim();
  if (from || to) {
    const maxFrom =
      Date.now() - 7 * 24 * 60 * 60 * 1000;
    return {
      from: from || new Date(maxFrom).toISOString(),
      to: to || new Date().toISOString(),
    };
  }
  return {
    from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    to: new Date().toISOString(),
  };
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

function buildUserLookupClause(userLookup: string) {
  if (!userLookup.includes("@")) {
    return { where: "id = ?", params: [userLookup] };
  }

  const email = userLookup.toLowerCase();
  const passwordEmail = email.startsWith("password:") ? email : `password:${email}`;
  return {
    where: "(LOWER(email) = ? OR LOWER(email) = ?)",
    params: [email, passwordEmail],
  };
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

async function getUserLogSummary(userEmail: string): Promise<UserActivitySummary> {
  const normalizedUserEmail = userEmail.trim().toLowerCase();
  const from24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [latestRow, countRow] = await Promise.all([
    queryOne(
      `SELECT created_at as "createdAt"
       FROM ops_events
       WHERE user_email = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [normalizedUserEmail],
    ).catch(() => null),
    queryOne(
      `SELECT
         COUNT(*) as "totalCount",
         SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as "errorCount"
       FROM ops_events
       WHERE user_email = ? AND created_at >= ?`,
      [normalizedUserEmail, from24h],
    ).catch(() => null),
  ]);
  return {
    latestAt: asNullableString(latestRow?.createdAt),
    totalCount: asNumber(countRow?.totalCount),
    errorCount: asNumber(countRow?.errorCount),
  };
}

function buildRecentActiveAt(input: {
  user: UserRow;
  latestProjectAt?: string | null;
  latestCreditAt?: string | null;
  subscription: SubscriptionRow | null;
  latestPaymentAt?: string | null;
  latestTicketAt?: string | null;
  latestLogAt?: string | null;
}) {
  return [
    input.user.updatedAt,
    input.latestProjectAt ?? null,
    input.latestCreditAt ?? null,
    input.subscription?.updatedAt ?? null,
    input.latestPaymentAt ?? null,
    input.latestTicketAt ?? null,
    input.latestLogAt ?? null,
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
  const limit = parseIntInRange(request.nextUrl.searchParams.get("limit") ?? request.nextUrl.searchParams.get("logLimit"), 50, 1, 200);
  const page = parseIntInRange(request.nextUrl.searchParams.get("page"), 1, 1, 9999);
  const offset = (page - 1) * limit;
  const range = resolveDateRange(request);

  if (!userLookup) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  const userLookupClause = buildUserLookupClause(userLookup);
  const userRow = await queryOne(
    `SELECT
       id,
       email,
       name,
       role,
       created_at as "createdAt",
       updated_at as "updatedAt"
     FROM users
     WHERE ${userLookupClause.where}
     LIMIT 1`,
    userLookupClause.params,
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

  if (view === "credits") {
    const creditsRaw = await queryAll(
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
         WHERE user_email = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?
         OFFSET ?`,
      [user.email, limit, offset],
    );
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
    return NextResponse.json(
      {
        ok: true,
        records: credits,
        page,
        limit,
        hasMore: credits.length === limit,
      },
      { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
    );
  }

  if (view === "projects") {
    const projectsRaw = await queryAll(
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
         LIMIT ?
         OFFSET ?`,
      [user.id, limit, offset],
    );
    const projects: ProjectRow[] = projectsRaw.map((row) => ({
      id: asString(row.id),
      title: asString(row.title),
      status: asNullableString(row.status),
      format: asNullableString(row.format),
      duration: asNullableString(row.duration),
      updatedAt: asString(row.updatedAt),
    }));
    return NextResponse.json(
      {
        ok: true,
        projects,
        page,
        limit,
        hasMore: projects.length === limit,
      },
      { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
    );
  }

  if (view === "logs") {
    const logs = await getUserLogs(user.email, limit);
    const pageLogs = logs.filter((item) => item.createdAt >= range.from && item.createdAt <= range.to);
    return NextResponse.json(
      {
        ok: true,
        logs: pageLogs,
        logText: buildLogTimelineText(pageLogs),
        logSummary: {
          totalCount: pageLogs.length,
          errorCount: pageLogs.filter((item) => item.status === "error").length,
          latestAt: pageLogs[0]?.createdAt ?? null,
        },
        page,
        limit,
        hasMore: pageLogs.length === limit,
      },
      { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
    );
  }

  const [subscriptionRaw, latestCreditRaw, latestProjectRaw, latestPaymentRaw, latestTicketRaw, logSummary] = await Promise.all([
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
    queryOne(
      `SELECT
         balance,
         created_at as "createdAt"
       FROM credit_records
       WHERE user_email = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [user.email],
    ),
    queryOne(
      `SELECT updated_at as "updatedAt"
       FROM projects
       WHERE user_id = ?
       ORDER BY updated_at DESC
       LIMIT 1`,
      [user.id],
    ),
    queryOne(
      `SELECT created_at as "createdAt"
       FROM billing_fulfillments
       WHERE user_email = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.email],
    ),
    queryOne(
      `SELECT created_at as "createdAt"
       FROM feedback_tickets
       WHERE submitter_email = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.email],
    ),
    getUserLogSummary(user.email),
  ]);

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

  const recentActiveAt = buildRecentActiveAt({
    user,
    latestProjectAt: asNullableString(latestProjectRaw?.updatedAt),
    latestCreditAt: asNullableString(latestCreditRaw?.createdAt),
    subscription,
    latestPaymentAt: asNullableString(latestPaymentRaw?.createdAt),
    latestTicketAt: asNullableString(latestTicketRaw?.createdAt),
    latestLogAt: logSummary.latestAt,
  });

  const payload = {
    user: {
      ...user,
      recentActiveAt,
    },
    subscription,
    payments: [],
    credits: {
      currentBalance: asNumber(latestCreditRaw?.balance),
      records: [],
    },
    projects: [],
    tickets: [],
    logSummary: {
      totalCount: logSummary.totalCount,
      errorCount: logSummary.errorCount,
      latestAt: logSummary.latestAt,
    },
  };

  const headers = {
    "Cache-Control": "no-store, max-age=0, must-revalidate",
  };

  return NextResponse.json(payload, { headers });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const adminEmail = await requireAdminEmail();
  if (!adminEmail) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const resolvedParams = await context.params;
  const userLookup = decodeURIComponent(resolvedParams?.userId ?? "").trim();
  if (!userLookup) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    amount?: number | string;
    planId?: BillingPlanId | string;
    cycle?: BillingCycle | string;
    reason?: string;
  };
  if (body.action !== "gift_credits" && body.action !== "gift_membership") {
    return NextResponse.json({ error: "Unsupported admin user action." }, { status: 400 });
  }
  const reason = (body.reason || "").trim().slice(0, 280);

  const userLookupClause = buildUserLookupClause(userLookup);
  const userRow = await queryOne(
    `SELECT
       id,
       email
     FROM users
     WHERE ${userLookupClause.where}
     LIMIT 1`,
    userLookupClause.params,
  );

  if (!userRow) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const user = {
    id: asString(userRow.id),
    email: asString(userRow.email).trim().toLowerCase(),
  };
  if (!user.id || !user.email) {
    return NextResponse.json({ error: "User record is missing id or email." }, { status: 400 });
  }

  if (body.action === "gift_membership") {
    const planId = String(body.planId || "").trim() as BillingPlanId;
    const requestedCycle: BillingCycle = body.cycle === "yearly" ? "yearly" : "monthly";
    const plan = findBillingPlan(planId);

    if (!plan) {
      return NextResponse.json({ error: "Unsupported membership plan." }, { status: 400 });
    }

    const cycle = isBillingPlanCycleSupported(plan.id, requestedCycle)
      ? requestedCycle
      : getBillingPlanDefaultCycle(plan.id);

    const startedAt = new Date();
    const renewAt = addMonths(startedAt, cycle === "yearly" ? 12 : 1);
    const result = await applyBillingFulfillmentAtomic({
      sessionId: `admin-gift-membership-${user.id}-${Date.now()}`,
      userEmail: user.email,
      planId: plan.id,
      planName: plan.name,
      cycle,
      monthlyCredits: plan.monthlyCredits,
      startedAt: startedAt.toISOString(),
      renewAt: renewAt.toISOString(),
      checkoutSource: "admin_membership_gift",
    });

    if (!result.applied) {
      return NextResponse.json({ error: "Gift membership was not applied." }, { status: 500 });
    }

    const latestCreditRaw = await queryOne(
      `SELECT balance
       FROM credit_records
       WHERE user_email = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [user.email],
    );

    logOpsEvent({
      category: "admin",
      action: "user.membership.gift",
      status: "ok",
      source: "admin_user_detail",
      userEmail: adminEmail,
      message: `Admin gifted ${plan.name} ${cycle} membership to ${user.email}.`,
      details: {
        targetUserId: user.id,
        targetUserEmail: user.email,
        planId: plan.id,
        planName: plan.name,
        cycle,
        monthlyCredits: plan.monthlyCredits,
        reason,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        subscription: {
          id: null,
          planId: plan.id,
          planName: plan.name,
          cycle,
          status: "active",
          startedAt: startedAt.toISOString(),
          renewAt: renewAt.toISOString(),
          updatedAt: startedAt.toISOString(),
        },
        currentBalance: asNumber(latestCreditRaw?.balance),
      },
      { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
    );
  }

  const amount = Math.round(Number(body.amount));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000) {
    return NextResponse.json({ error: "Gift amount must be between 1 and 100000 credits." }, { status: 400 });
  }

  const description = reason
    ? `Admin gift credits: ${reason}`
    : `Admin gift credits by ${adminEmail}`;
  const result = await applyCreditRecordAtomic({
    userEmail: user.email,
    userId: user.id,
    type: "topup",
    description,
    delta: amount,
  });

  if (!result.applied) {
    return NextResponse.json({ error: "Gift credits were not applied." }, { status: 500 });
  }

  logOpsEvent({
    category: "admin",
    action: "user.credits.gift",
    status: "ok",
    source: "admin_user_detail",
    userEmail: adminEmail,
    message: `Admin gifted ${amount} credits to ${user.email}.`,
    details: {
      targetUserId: user.id,
      targetUserEmail: user.email,
      amount,
      balance: result.balance,
      creditRecordId: result.id,
      reason,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      record: {
        id: result.id,
        type: "topup",
        description,
        delta: amount,
        balance: result.balance,
        projectId: null,
        projectTitle: null,
        createdAt: new Date().toISOString(),
      },
      currentBalance: result.balance,
    },
    { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
  );
}
