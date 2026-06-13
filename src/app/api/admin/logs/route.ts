import { NextRequest, NextResponse } from "next/server";
import { requireAdminEmail } from "@/lib/server/admin-auth";
import {
  getLatestSubscriptionDb,
  listOpsEvents,
  listCreditRecords,
  parseOpsEventDetailsJson,
  readOpsLogFileByUserEmail,
  type GenerationTaskStatusSummary,
} from "@/lib/server/store";

export const runtime = "nodejs";

function parseIntInRange(raw: string | null, fallback: number, min: number, max: number) {
  const value = Number.parseInt((raw ?? "").trim(), 10);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function resolveLogsRange(input: { from: string; to: string }) {
  if (input.from || input.to) {
    return {
      from: input.from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      to: input.to || new Date().toISOString(),
    };
  }
  return {
    from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    to: new Date().toISOString(),
  };
}

function resolveFailureStage(input: { category?: string | null; code?: string | null }) {
  const code = (input.code || "").trim().toUpperCase();
  if (code.startsWith("DRAFT_INVALID_JSON")) return "draft_response_parsing";
  if (code.startsWith("FREE_MODEL_REQUEST_FAILED")) return "draft_model_request_free";
  if (code.startsWith("PAID_MODEL_REQUEST_FAILED")) return "draft_model_request_paid";
  if (code.startsWith("DUOMI_")) return "image_fallback_duomi";
  if (code.startsWith("GPTSAPI_")) return "image_fallback_gptsapi";
  if (code.startsWith("IMAGE2_")) return "image_primary_tuzi";
  if (input.category === "image") return "image_pipeline";
  if (input.category === "llm") return "draft_pipeline";
  return null;
}

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
  details?: Record<string, unknown> | null;
  runId?: string | null;
  jobId?: string | null;
  taskId?: string | null;
  durationMs?: number | null;
  taskStatusSummary?: GenerationTaskStatusSummary | null;
};

type TraceSummaryRow = {
  traceId: string;
  createdAt: string;
  lastEventAt: string;
  userEmail: string | null;
  runId: string | null;
  jobId: string | null;
  projectId: string | null;
  entrySource: string | null;
  generationDirection: string | null;
  outputType: string | null;
  styleName: string | null;
  requestedCount: number | null;
  taskCount: number | null;
  finalJobStatus: string | null;
  successCount: number;
  failedCount: number;
  timedOutCount: number;
  creditsConsumed: boolean;
  creditsRefunded: boolean;
  totalDurationMs: number | null;
  failedStep: string | null;
  errorCode: string | null;
};

function safeLower(input: string | null | undefined) {
  return (input || "").trim().toLowerCase();
}

function parseFileLogLine(line: string): UsageLogRow | null {
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    const id = typeof parsed.id === "string" ? parsed.id.trim() : "";
    const category = typeof parsed.category === "string" ? parsed.category.trim() : "";
    const action = typeof parsed.action === "string" ? parsed.action.trim() : "";
    const statusRaw = typeof parsed.status === "string" ? parsed.status.trim().toLowerCase() : "info";
    const status = statusRaw === "ok" || statusRaw === "error" ? statusRaw : "info";
    const source = typeof parsed.source === "string" ? parsed.source.trim() : null;
    const code = typeof parsed.code === "string" ? parsed.code.trim() : null;
    const message = typeof parsed.message === "string" ? parsed.message.trim() : null;
    const userEmail = typeof parsed.userEmail === "string" ? parsed.userEmail.trim().toLowerCase() : null;
    const projectId = typeof parsed.projectId === "string" ? parsed.projectId.trim() : null;
    const createdAt = typeof parsed.ts === "string" ? parsed.ts.trim() : "";
    const details =
      parsed.details && typeof parsed.details === "object" ? (parsed.details as Record<string, unknown>) : null;
    const detailsJson = details ? JSON.stringify(details).slice(0, 4000) : null;
    if (!id || !category || !action || !createdAt) {
      return null;
    }
    return {
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
      details,
      runId: typeof details?.runId === "string" ? details.runId : null,
      jobId: typeof details?.jobId === "string" ? details.jobId : null,
      taskId: typeof details?.taskId === "string" ? details.taskId : null,
      durationMs: typeof details?.durationMs === "number" ? details.durationMs : null,
      taskStatusSummary:
        details?.taskStatusSummary && typeof details.taskStatusSummary === "object"
          ? (details.taskStatusSummary as GenerationTaskStatusSummary)
          : null,
    };
  } catch {
    return null;
  }
}

function matchLike(target: string | null | undefined, keyword: string) {
  if (!keyword) {
    return true;
  }
  return safeLower(target).includes(keyword);
}

function filterUsageRow(
  item: UsageLogRow,
  input: {
    userEmail: string;
    projectId: string;
    runId: string;
    jobId: string;
    taskId: string;
    category: string;
    action: string;
    status: string;
    source: string;
    code: string;
  },
) {
  const normalizedStatus = safeLower(input.status);
  return (
    matchLike(item.userEmail, input.userEmail) &&
    matchLike(item.projectId, input.projectId) &&
    matchLike(item.runId, input.runId) &&
    matchLike(item.jobId, input.jobId) &&
    matchLike(item.taskId, input.taskId) &&
    matchLike(item.category, input.category) &&
    matchLike(item.action, input.action) &&
    matchLike(item.source, input.source) &&
    matchLike(item.code, input.code) &&
    (normalizedStatus ? safeLower(item.status) === normalizedStatus : true)
  );
}

function numericOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isCriticalOpsEvent(item: UsageLogRow & { details?: Record<string, unknown> | null }) {
  if (item.status !== "error") {
    return false;
  }
  const category = safeLower(item.category);
  const action = safeLower(item.action);
  const source = safeLower(item.source);
  const code = (item.code || "").trim().toUpperCase();
  if (action.includes("restore") || action.includes("poll") || action.includes("trace.summary")) {
    return false;
  }
  if (
    code === "IMAGE_JOB_ABANDONED_TIMEOUT" ||
    source.includes("project_detail_restore") ||
    source.includes("image_job_status") ||
    source.includes("billing_credits_sync")
  ) {
    return false;
  }
  return category === "billing" || category === "llm" || category === "image";
}

function buildTraceSummaries(logs: Array<UsageLogRow & { details?: Record<string, unknown> | null }>) {
  const groups = new Map<string, {
    createdAt: string;
    lastEventAt: string;
    userEmail: string | null;
    runId: string | null;
    jobId: string | null;
    projectId: string | null;
    entrySource: string | null;
    generationDirection: string | null;
    outputType: string | null;
    styleName: string | null;
    requestedCount: number | null;
    taskCount: number | null;
    finalJobStatus: string | null;
    successCount: number;
    failedCount: number;
    timedOutCount: number;
    creditsConsumed: boolean;
    creditsRefunded: boolean;
    totalDurationMs: number | null;
    failedStep: string | null;
    errorCode: string | null;
  }>();

  const resolveGroupKey = (item: UsageLogRow & { details?: Record<string, unknown> | null }) => {
    return item.runId || item.jobId || item.projectId || item.id;
  };

  const taskSummaryCount = (summary: GenerationTaskStatusSummary | null | undefined, keys: string[]) =>
    keys.reduce((sum, key) => sum + Number(summary?.[key] ?? 0), 0);

  for (const item of logs) {
    const details = item.details || null;
    const groupKey = resolveGroupKey(item);
    const current = groups.get(groupKey) ?? {
      createdAt: item.createdAt,
      lastEventAt: item.createdAt,
      userEmail: item.userEmail ?? null,
      runId: item.runId ?? null,
      jobId: item.jobId ?? null,
      projectId: item.projectId ?? null,
      entrySource: typeof details?.entrySource === "string" ? details.entrySource : null,
      generationDirection: typeof details?.generationDirection === "string" ? details.generationDirection : null,
      outputType: typeof details?.outputType === "string" ? details.outputType : null,
      styleName: typeof details?.styleName === "string" ? details.styleName : null,
      requestedCount: numericOrNull(details?.requestedCount),
      taskCount: numericOrNull(details?.taskCount),
      finalJobStatus: typeof details?.finalJobStatus === "string" ? details.finalJobStatus : null,
      successCount: 0,
      failedCount: 0,
      timedOutCount: 0,
      creditsConsumed: false,
      creditsRefunded: false,
      totalDurationMs: null,
      failedStep: null,
      errorCode: item.code || null,
    };

    if (item.createdAt < current.createdAt) {
      current.createdAt = item.createdAt;
    }
    if (item.createdAt > current.lastEventAt) {
      current.lastEventAt = item.createdAt;
    }
    current.userEmail ||= item.userEmail ?? null;
    current.runId ||= item.runId ?? null;
    current.jobId ||= item.jobId ?? null;
    current.projectId ||= item.projectId ?? null;
    current.entrySource ||= typeof details?.entrySource === "string" ? details.entrySource : null;
    current.generationDirection ||= typeof details?.generationDirection === "string" ? details.generationDirection : null;
    current.outputType ||= typeof details?.outputType === "string" ? details.outputType : null;
    current.styleName ||= typeof details?.styleName === "string" ? details.styleName : null;
    current.requestedCount ??= numericOrNull(details?.requestedCount);
    current.taskCount ??= numericOrNull(details?.taskCount);

    const summary = item.taskStatusSummary;
    if (summary) {
      current.successCount = Math.max(
        current.successCount,
        taskSummaryCount(summary, ["asset_ready", "completed", "success", "succeeded"]),
      );
      current.failedCount = Math.max(
        current.failedCount,
        taskSummaryCount(summary, ["failed", "billing_failed", "completed_with_errors"]) +
          taskSummaryCount(summary, ["timed_out"]),
      );
      current.timedOutCount = Math.max(current.timedOutCount, taskSummaryCount(summary, ["timed_out"]));
    }

    if (item.action === "generation.trace.summary" || item.action === "generation.project.restore") {
      current.finalJobStatus =
        (typeof details?.finalJobStatus === "string" ? details.finalJobStatus : null) ||
        (typeof details?.jobStatus === "string" ? details.jobStatus : null) ||
        current.finalJobStatus;
      current.totalDurationMs = Math.max(current.totalDurationMs ?? 0, item.durationMs ?? 0) || current.totalDurationMs;
      current.errorCode = item.code || current.errorCode;
    }

    if (item.action === "generation.credits.consume.success" || item.action === "ui.step5.consume.success") {
      current.creditsConsumed = true;
    }
    if (item.action === "generation.refund.success") {
      current.creditsRefunded = true;
    }
    if (!current.failedStep && item.status === "error") {
      if (item.action.includes("provider")) current.failedStep = "provider";
      else if (item.action.includes("asset.persist")) current.failedStep = "storage";
      else if (item.action.includes("credits.consume")) current.failedStep = "credits";
      else if (item.action.includes("activate")) current.failedStep = "activate";
      else if (item.action.includes("restore")) current.failedStep = "restore";
      else current.failedStep = "unknown";
    }
    if (item.status === "error" && item.code) {
      current.errorCode = item.code;
    }

    groups.set(groupKey, current);
  }

  return Array.from(groups.entries())
    .map(([traceId, value]) => ({
      traceId,
      ...value,
    }))
    .filter(
      (item) =>
        Boolean(
          item.runId ||
            item.jobId ||
            item.projectId ||
            item.userEmail ||
            item.errorCode ||
            item.finalJobStatus,
        ),
    )
    .sort((a, b) => b.lastEventAt.localeCompare(a.lastEventAt)) satisfies TraceSummaryRow[];
}

export async function GET(request: NextRequest) {
  const adminEmail = await requireAdminEmail();
  if (!adminEmail) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const userEmail = request.nextUrl.searchParams.get("userEmail") ?? "";
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const projectId = request.nextUrl.searchParams.get("projectId") ?? "";
  const runId = request.nextUrl.searchParams.get("runId") ?? "";
  const jobId = request.nextUrl.searchParams.get("jobId") ?? "";
  const taskId = request.nextUrl.searchParams.get("taskId") ?? "";
  const category = request.nextUrl.searchParams.get("category") ?? "";
  const action = request.nextUrl.searchParams.get("action") ?? "";
  const status = request.nextUrl.searchParams.get("status") ?? "";
  const source = request.nextUrl.searchParams.get("source") ?? "";
  const code = request.nextUrl.searchParams.get("code") ?? "";
  const from = request.nextUrl.searchParams.get("from") ?? "";
  const to = request.nextUrl.searchParams.get("to") ?? "";
  const includeDetails = request.nextUrl.searchParams.get("includeDetails") === "1";
  const onlyErrors = request.nextUrl.searchParams.get("onlyErrors") === "1";
  const onlySlow = request.nextUrl.searchParams.get("onlySlow") === "1";
  const criticalOnly = request.nextUrl.searchParams.get("criticalOnly") === "1";
  const limit = parseIntInRange(request.nextUrl.searchParams.get("limit"), 50, 1, 200);
  const page = parseIntInRange(request.nextUrl.searchParams.get("page"), 1, 1, 9999);
  const offset = (page - 1) * limit;
  const effectiveStatus = onlyErrors && !status.trim() ? "error" : status;
  const range = resolveLogsRange({ from, to });
  const requiresPostFilterPagination = onlySlow || criticalOnly;
  const dbLimit = requiresPostFilterPagination
    ? Math.min(500, Math.max(limit * Math.max(page, 1) * 3, limit * 3))
    : limit;
  const dbOffset = requiresPostFilterPagination ? 0 : offset;

  const dbLogs = await listOpsEvents({
    id,
    userEmail,
    projectId,
    runId,
    jobId,
    taskId,
    category,
    action,
    status: effectiveStatus,
    source,
    code,
    limit: dbLimit,
    offset: dbOffset,
    from: range.from,
    to: range.to,
  }) as UsageLogRow[];

  const mergedById = new Map<string, UsageLogRow>();
  dbLogs.forEach((item) => {
    mergedById.set(item.id, item);
  });

  const normalizedUserEmail = safeLower(userEmail);
  if (normalizedUserEmail) {
    const fileResult = readOpsLogFileByUserEmail(normalizedUserEmail, Math.min(5000, limit * 6));
    for (const line of fileResult.lines) {
      const parsed = parseFileLogLine(line);
      if (!parsed) {
        continue;
      }
      if (
        !filterUsageRow(parsed, {
          userEmail: safeLower(userEmail),
          projectId: safeLower(projectId),
          runId: safeLower(runId),
          jobId: safeLower(jobId),
          taskId: safeLower(taskId),
          category: safeLower(category),
          action: safeLower(action),
          status: safeLower(status),
          source: safeLower(source),
          code: safeLower(code),
        })
      ) {
        continue;
      }
      if (!mergedById.has(parsed.id)) {
        mergedById.set(parsed.id, parsed);
      }
    }
  }

  const normalizedLogs = Array.from(mergedById.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((item) => {
      const details = item.details ?? parseOpsEventDetailsJson(item.detailsJson);
      return {
        ...item,
        runId: item.runId ?? ((details?.runId as string | undefined) ?? null),
        jobId: item.jobId ?? ((details?.jobId as string | undefined) ?? null),
        taskId: item.taskId ?? ((details?.taskId as string | undefined) ?? null),
        durationMs: item.durationMs ?? ((details?.durationMs as number | undefined) ?? null),
        taskStatusSummary:
          item.taskStatusSummary ?? ((details?.taskStatusSummary as GenerationTaskStatusSummary | undefined) ?? null),
        stage: resolveFailureStage(item),
        detailsJson: includeDetails ? item.detailsJson : null,
        details: includeDetails ? details : null,
      };
    })
    .filter((item) => (criticalOnly ? isCriticalOpsEvent(item) : true))
    .filter((item) => {
      if (!onlySlow) {
        return true;
      }
      return typeof item.durationMs === "number" && item.durationMs >= 30_000;
    });
  const logs = requiresPostFilterPagination
    ? normalizedLogs.slice(offset, offset + limit)
    : normalizedLogs.slice(0, limit);

  let summary: Record<string, unknown> | null = null;
  if (normalizedUserEmail) {
    const subscription = await getLatestSubscriptionDb(normalizedUserEmail).catch(() => null);
    const creditRecords = await listCreditRecords(normalizedUserEmail, { limit: 1 }).catch(() => []);
    const last24hCutoff = Date.now() - 24 * 60 * 60 * 1000;
    const recentLogs = normalizedLogs.filter((item) => {
      const ts = Date.parse(item.createdAt);
      return Number.isFinite(ts) && ts >= last24hCutoff;
    });
    const latestError = normalizedLogs.find((item) => item.status === "error") || null;
    const latestCreditRecord = Array.isArray(creditRecords) && creditRecords.length ? (creditRecords[0] as Record<string, unknown>) : null;
    summary = {
      email: normalizedUserEmail,
      userId:
        (typeof latestCreditRecord?.user_id === "string" ? latestCreditRecord.user_id : null) ||
        (typeof latestCreditRecord?.userId === "string" ? latestCreditRecord.userId : null),
      isMember: subscription ? ["active", "canceling"].includes(String((subscription as Record<string, unknown>).status ?? "")) : false,
      planType: (subscription as Record<string, unknown> | null)?.cycle ?? null,
      planName: (subscription as Record<string, unknown> | null)?.plan_name ?? (subscription as Record<string, unknown> | null)?.planName ?? null,
      currentCredits:
        (typeof latestCreditRecord?.balance === "number" ? latestCreditRecord.balance : null) ??
        (typeof latestCreditRecord?.balance === "string" ? Number(latestCreditRecord.balance) : null),
      generationCount24h: recentLogs.filter((item) => item.action === "generation.trace.summary").length,
      failureCount24h: recentLogs.filter((item) => item.status === "error").length,
      refundCount24h: recentLogs.filter((item) => item.action === "generation.refund.success").length,
      latestError: latestError
        ? {
            createdAt: latestError.createdAt,
            action: latestError.action,
            code: latestError.code,
            message: latestError.message,
          }
        : null,
    };
  }

  const traces = buildTraceSummaries(normalizedLogs);

  return NextResponse.json({
    ok: true,
    logs,
    traces,
    summary,
    page,
    limit,
    hasMore: requiresPostFilterPagination ? normalizedLogs.length > offset + limit : normalizedLogs.length === limit,
    generatedAt: new Date().toISOString(),
  });
}
