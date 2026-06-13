import { createAdminConsoleMockData, type AdminConsoleData } from "@/lib/admin/adminConsoleMock";
import { getDb } from "@/lib/server/db";
import { hasManagedDatabase, pgAll } from "@/lib/server/postgres";

type Row = Record<string, unknown>;

function text(value: unknown, fallback = "") {
  const normalized = value == null ? "" : String(value);
  return normalized.trim() || fallback;
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function iso(value: unknown, fallback = new Date().toISOString()) {
  const raw = text(value);
  const time = Date.parse(raw);
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
}

function normalizeEmail(value: unknown) {
  return text(value).toLowerCase();
}

function parseDetailsJson(value: unknown) {
  const raw = text(value);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function extractOriginalInputFromDetails(details: Record<string, unknown> | null) {
  if (!details) {
    return "";
  }
  const candidates = [
    details.originalInput,
    details.rawInput,
    details.prompt,
    details.input,
  ];
  for (const candidate of candidates) {
    const value = text(candidate);
    if (value) {
      return value;
    }
  }
  return "";
}

function normalizeOutputType(value: unknown): "poster" | "ppt" | "video" {
  const normalized = text(value).toLowerCase();
  if (normalized === "ppt" || normalized === "presentation" || normalized === "slides") {
    return "ppt";
  }
  if (normalized === "video") {
    return "video";
  }
  return "poster";
}

function normalizeProjectStatus(value: unknown): "draft" | "generating" | "completed" | "failed" {
  const normalized = text(value).toLowerCase();
  if (normalized.includes("fail") || normalized.includes("失败")) {
    return "failed";
  }
  if (
    normalized.includes("complete") ||
    normalized.includes("done") ||
    normalized.includes("success") ||
    normalized.includes("已完成")
  ) {
    return "completed";
  }
  if (
    normalized.includes("generat") ||
    normalized.includes("process") ||
    normalized.includes("queue") ||
    normalized.includes("progress") ||
    normalized.includes("进行")
  ) {
    return "generating";
  }
  return "draft";
}

function normalizeSubscriptionStatus(value: unknown): "free" | "trial" | "active" | "past_due" | "expired" {
  const normalized = text(value).toLowerCase();
  if (normalized === "active" || normalized === "canceling") {
    return "active";
  }
  if (normalized === "trial") {
    return "trial";
  }
  if (normalized === "past_due") {
    return "past_due";
  }
  if (normalized === "inactive" || normalized === "canceled" || normalized === "cancelled" || normalized === "expired") {
    return "expired";
  }
  return "free";
}

function normalizeTicketStatus(value: unknown): "pending" | "in_progress" | "resolved" | "closed" | "no_action" {
  const normalized = text(value).toLowerCase();
  if (normalized === "replied" || normalized === "resolved") {
    return "resolved";
  }
  if (normalized === "closed") {
    return "closed";
  }
  if (normalized === "in_progress" || normalized === "processing") {
    return "in_progress";
  }
  if (normalized === "no_action") {
    return "no_action";
  }
  return "pending";
}

function normalizeTicketType(value: unknown): "bug" | "billing" | "feature" | "quality" | "other" {
  const normalized = text(value).toLowerCase();
  if (normalized.includes("bug") || normalized.includes("错误") || normalized.includes("问题")) {
    return "bug";
  }
  if (normalized.includes("bill") || normalized.includes("pay") || normalized.includes("credit") || normalized.includes("积分")) {
    return "billing";
  }
  if (normalized.includes("feature") || normalized.includes("需求") || normalized.includes("建议")) {
    return "feature";
  }
  if (normalized.includes("quality") || normalized.includes("质量") || normalized.includes("效果")) {
    return "quality";
  }
  return "other";
}

function latestBy<T>(rows: T[], getKey: (row: T) => string, getTime: (row: T) => string) {
  const map = new Map<string, T>();
  rows.forEach((row) => {
    const key = getKey(row);
    if (!key) {
      return;
    }
    const previous = map.get(key);
    if (!previous || getTime(row).localeCompare(getTime(previous)) > 0) {
      map.set(key, row);
    }
  });
  return map;
}

function normalizeImageModelName(value: unknown) {
  const raw = text(value);
  if (!raw) {
    return "";
  }
  const first = raw
    .split(/\s*(?:,|>|\\|\/{2}|\|)\s*/)
    .map((item) => item.trim())
    .find(Boolean);
  return first || raw;
}

async function readAdminRows() {
  if (hasManagedDatabase()) {
    const [users, projects, credits, subscriptions, fulfillments, feedback, opsEvents, imageJobs, imageTasks] = await Promise.all([
      pgAll("SELECT * FROM users ORDER BY created_at DESC LIMIT 500") as Promise<Row[]>,
      pgAll(
        `SELECT p.*, u.email AS user_email
         FROM projects p
         LEFT JOIN users u ON u.id = p.user_id
         ORDER BY p.updated_at DESC
         LIMIT 1000`,
      ) as Promise<Row[]>,
      pgAll("SELECT * FROM credit_records ORDER BY created_at DESC, id DESC LIMIT 1000") as Promise<Row[]>,
      pgAll(
        `SELECT s.*, u.email AS user_email
         FROM subscriptions s
         LEFT JOIN users u ON u.id = s.user_id
         ORDER BY s.updated_at DESC, s.created_at DESC
         LIMIT 500`,
      ) as Promise<Row[]>,
      pgAll("SELECT * FROM billing_fulfillments ORDER BY created_at DESC LIMIT 500") as Promise<Row[]>,
      pgAll("SELECT * FROM feedback_tickets ORDER BY created_at DESC, id DESC LIMIT 500") as Promise<Row[]>,
      pgAll("SELECT * FROM ops_events ORDER BY created_at DESC LIMIT 1000") as Promise<Row[]>,
      pgAll("SELECT * FROM image_generation_jobs ORDER BY updated_at DESC, created_at DESC LIMIT 4000") as Promise<Row[]>,
      pgAll("SELECT * FROM image_generation_tasks ORDER BY updated_at DESC, created_at DESC LIMIT 8000") as Promise<Row[]>,
    ]);
    return { users, projects, credits, subscriptions, fulfillments, feedback, opsEvents, imageJobs, imageTasks };
  }

  const { db } = getDb();
  return {
    users: db.prepare("SELECT * FROM users ORDER BY created_at DESC LIMIT 500").all() as Row[],
    projects: db
      .prepare(
        `SELECT p.*, u.email AS user_email
         FROM projects p
         LEFT JOIN users u ON u.id = p.user_id
         ORDER BY p.updated_at DESC
         LIMIT 1000`,
      )
      .all() as Row[],
    credits: db
      .prepare("SELECT * FROM credit_records ORDER BY created_at DESC, id DESC LIMIT 1000")
      .all() as Row[],
    subscriptions: db
      .prepare(
        `SELECT s.*, u.email AS user_email
         FROM subscriptions s
         LEFT JOIN users u ON u.id = s.user_id
         ORDER BY s.updated_at DESC, s.created_at DESC
         LIMIT 500`,
      )
      .all() as Row[],
    fulfillments: db.prepare("SELECT * FROM billing_fulfillments ORDER BY created_at DESC LIMIT 500").all() as Row[],
    feedback: db.prepare("SELECT * FROM feedback_tickets ORDER BY created_at DESC, id DESC LIMIT 500").all() as Row[],
    opsEvents: db.prepare("SELECT * FROM ops_events ORDER BY created_at DESC LIMIT 1000").all() as Row[],
    imageJobs: db
      .prepare("SELECT * FROM image_generation_jobs ORDER BY updated_at DESC, created_at DESC LIMIT 4000")
      .all() as Row[],
    imageTasks: db
      .prepare("SELECT * FROM image_generation_tasks ORDER BY updated_at DESC, created_at DESC LIMIT 8000")
      .all() as Row[],
  };
}

export async function getAdminConsoleData(): Promise<AdminConsoleData> {
  const defaults = createAdminConsoleMockData();
  const rows = await readAdminRows();
  const usersByEmail = new Map(rows.users.map((user) => [normalizeEmail(user.email), user]));
  const latestCreditsByEmail = latestBy(rows.credits, (row) => normalizeEmail(row.user_email), (row) => iso(row.created_at));
  const latestSubscriptionsByUserId = latestBy(rows.subscriptions, (row) => text(row.user_id), (row) =>
    iso(row.updated_at ?? row.created_at),
  );
  const latestImageJobByProjectId = latestBy(
    rows.imageJobs.filter((row) => text(row.project_id)),
    (row) => text(row.project_id),
    (row) => iso(row.updated_at ?? row.created_at),
  );
  const latestImageTaskByJobId = latestBy(
    rows.imageTasks.filter((row) => text(row.job_id)),
    (row) => text(row.job_id),
    (row) => iso(row.updated_at ?? row.created_at),
  );
  const projectStartedEventsByProjectId = latestBy(
    rows.opsEvents.filter(
      (event) =>
        text(event.category).toLowerCase() === "project" &&
        text(event.action).toLowerCase() === "workspace_project_started",
    ),
    (event) => text(event.project_id),
    (event) => iso(event.created_at),
  );

  const users: AdminConsoleData["users"] = rows.users.map((user) => {
    const userId = text(user.id);
    const email = normalizeEmail(user.email);
    const projects = rows.projects.filter((project) => text(project.user_id) === userId);
    const credits = rows.credits.filter((credit) => normalizeEmail(credit.user_email) === email || text(credit.user_id) === userId);
    const subscription = latestSubscriptionsByUserId.get(userId);
    const latestCredit = latestCreditsByEmail.get(email);
    const latestProjectAt = projects.reduce((latest, project) => {
      const updatedAt = iso(project.updated_at ?? project.created_at, "");
      return updatedAt > latest ? updatedAt : latest;
    }, "");
    const latestCreditAt = credits.reduce((latest, credit) => {
      const createdAt = iso(credit.created_at, "");
      return createdAt > latest ? createdAt : latest;
    }, "");
    return {
      id: userId,
      name: text(user.name, email.split("@")[0] || "User"),
      email,
      registeredAt: iso(user.created_at ?? user.updated_at),
      subscriptionStatus: normalizeSubscriptionStatus(subscription?.status),
      status: "active",
      creditBalance: numberValue(latestCredit?.balance, 50),
      creditConsumed: credits
        .filter((credit) => numberValue(credit.delta) < 0)
        .reduce((sum, credit) => sum + Math.abs(numberValue(credit.delta)), 0),
      projectCount: projects.length,
      failedProjectCount: projects.filter((project) => normalizeProjectStatus(project.status) === "failed").length,
      recentActiveAt: latestProjectAt || latestCreditAt || iso(user.updated_at ?? user.created_at),
    };
  });

  const projects: AdminConsoleData["projects"] = rows.projects.map((project) => {
    const projectId = text(project.id);
    const latestImageJob = latestImageJobByProjectId.get(projectId);
    const latestImageTask = latestImageTaskByJobId.get(text(latestImageJob?.id));
    const realImageModel =
      normalizeImageModelName(latestImageTask?.provider_used) ||
      normalizeImageModelName(latestImageTask?.providerUsed) ||
      normalizeImageModelName(latestImageTask?.provider_order) ||
      normalizeImageModelName(latestImageTask?.providerOrder) ||
      normalizeImageModelName(latestImageJob?.image_model_policy) ||
      normalizeImageModelName(latestImageJob?.imageModelPolicy) ||
      "unknown";
    return {
      id: text(project.id),
      userId: text(project.user_id),
      type: normalizeOutputType(project.format),
      topic: text(project.title, "Untitled project"),
      originalInput: extractOriginalInputFromDetails(
        parseDetailsJson(projectStartedEventsByProjectId.get(text(project.id))?.details_json),
      ) || undefined,
      status: normalizeProjectStatus(project.status),
      stage: normalizeProjectStatus(project.status) === "completed" ? "done" : "image_generation",
      textModel: "Gemini 2.5",
      imageModel: realImageModel,
      consumedCredits: rows.credits
        .filter((credit) => text(credit.project_id) === text(project.id) && numberValue(credit.delta) < 0)
        .reduce((sum, credit) => sum + Math.abs(numberValue(credit.delta)), 0),
      createdAt: iso(project.created_at ?? project.updated_at),
      updatedAt: iso(project.updated_at ?? project.created_at),
      requestId: text(project.id),
    };
  });

  const creditRecords: AdminConsoleData["creditRecords"] = rows.credits.map((credit) => {
    const email = normalizeEmail(credit.user_email);
    const user = email ? usersByEmail.get(email) : null;
    return {
      id: text(credit.id),
      userId: text(credit.user_id, text(user?.id)),
      orderId: undefined,
      projectId: text(credit.project_id) || undefined,
      type: text(credit.type) === "topup" || text(credit.type) === "refund" ? (text(credit.type) as "topup" | "refund") : "consume",
      delta: numberValue(credit.delta),
      balanceAfter: numberValue(credit.balance),
      reason: text(credit.description),
      createdAt: iso(credit.created_at),
    };
  });

  const subscriptions: AdminConsoleData["subscriptions"] = rows.subscriptions.map((subscription) => ({
    id: text(subscription.id),
    userId: text(subscription.user_id),
    plan: text(subscription.plan_name, text(subscription.plan_id, "Free")),
    status:
      text(subscription.status) === "active"
        ? "active"
        : text(subscription.status) === "canceling"
          ? "canceling"
          : text(subscription.status) === "past_due"
            ? "past_due"
            : "expired",
    startedAt: iso(subscription.started_at ?? subscription.created_at),
    renewAt: iso(subscription.renew_at ?? subscription.updated_at ?? subscription.created_at),
  }));

  const orders: AdminConsoleData["orders"] = rows.fulfillments.map((fulfillment) => ({
    id: text(fulfillment.session_id),
    userId: text(usersByEmail.get(normalizeEmail(fulfillment.user_email))?.id, normalizeEmail(fulfillment.user_email)),
    amount: 0,
    currency: "USD",
    status: text(fulfillment.checkout_status).includes("fail") ? "failed" : "paid",
    plan: text(fulfillment.plan_id, "unknown"),
    createdAt: iso(fulfillment.created_at),
    stripeEventId: text(fulfillment.session_id),
  }));

  const logs: AdminConsoleData["logs"] = rows.opsEvents.map((event) => {
    const details = text(event.details_json);
    const email = normalizeEmail(event.user_email);
    const user = email ? usersByEmail.get(email) : null;
    const status = text(event.status) === "error" ? "failed" : text(event.status) === "ok" ? "ok" : "processing";
    return {
      id: text(event.id),
      requestId: text(event.project_id, text(event.id)),
      errorId: status === "failed" ? text(event.id) : undefined,
      projectId: text(event.project_id) || undefined,
      userId: text(user?.id, email),
      type: text(event.category, "System") as AdminConsoleData["logs"][number]["type"],
      action: text(event.action),
      status,
      durationMs: 0,
      creditDelta: 0,
      errorSummary: status === "failed" ? text(event.message, text(event.code, "Unknown error")) : undefined,
      errorCode: text(event.code) || undefined,
      createdAt: iso(event.created_at),
      configSnapshot: details,
      pipelineState: details,
      handled: status !== "failed",
    };
  });

  const tickets: AdminConsoleData["tickets"] = rows.feedback.map((ticket) => {
    const email = normalizeEmail(ticket.submitter_email);
    const user = email ? usersByEmail.get(email) : null;
    return {
      id: text(ticket.id),
      userId: text(user?.id, email),
      projectId: undefined,
      title: text(ticket.type, "Feedback"),
      content: text(ticket.detail),
      status: normalizeTicketStatus(ticket.status),
      priority: "P2",
      type: normalizeTicketType(ticket.type),
      assignee: text(ticket.replied_by, "未分配"),
      internalNotes: text(ticket.admin_reply) ? [text(ticket.admin_reply)] : [],
      createdAt: iso(ticket.created_at),
      updatedAt: iso(ticket.replied_at ?? ticket.created_at),
    };
  });

  const billingAnomalies: AdminConsoleData["billingAnomalies"] = rows.opsEvents
    .filter((event) => text(event.status) === "error" && text(event.category).toLowerCase() === "billing")
    .map((event) => {
      const email = normalizeEmail(event.user_email);
      const user = email ? usersByEmail.get(email) : null;
      return {
        id: `anomaly-${text(event.id)}`,
        type: text(event.action).includes("refund") ? "project_failed_no_refund" : "webhook_failed",
        userId: text(user?.id, email) || undefined,
        projectId: text(event.project_id) || undefined,
        status: "open",
        summary: text(event.message, text(event.code, "Billing anomaly")),
        createdAt: iso(event.created_at),
      };
    });

  const webhookLogs: AdminConsoleData["webhookLogs"] = rows.opsEvents
    .filter((event) => text(event.action).toLowerCase().includes("webhook"))
    .map((event) => ({
      id: text(event.id),
      eventType: text(event.action),
      status: text(event.status) === "error" ? "failed" : "ok",
      errorMessage: text(event.message) || undefined,
      createdAt: iso(event.created_at),
    }));

  return {
    users,
    projects,
    logs,
    orders,
    subscriptions,
    creditRecords,
    webhookLogs,
    billingAnomalies,
    tickets,
    cases: [],
    settings: defaults.settings,
  };
}
