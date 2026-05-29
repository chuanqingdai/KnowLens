import { NextRequest, NextResponse } from "next/server";
import { requireAdminEmail } from "@/lib/server/admin-auth";
import { listOpsEvents, readOpsLogFileByUserEmail } from "@/lib/server/store";

export const runtime = "nodejs";

function parseIntInRange(raw: string | null, fallback: number, min: number, max: number) {
  const value = Number.parseInt((raw ?? "").trim(), 10);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
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
    const detailsJson =
      parsed.details && typeof parsed.details === "object" ? JSON.stringify(parsed.details).slice(0, 4000) : null;
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
    matchLike(item.category, input.category) &&
    matchLike(item.action, input.action) &&
    matchLike(item.source, input.source) &&
    matchLike(item.code, input.code) &&
    (normalizedStatus ? safeLower(item.status) === normalizedStatus : true)
  );
}

export async function GET(request: NextRequest) {
  const adminEmail = await requireAdminEmail();
  if (!adminEmail) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const userEmail = request.nextUrl.searchParams.get("userEmail") ?? "";
  const projectId = request.nextUrl.searchParams.get("projectId") ?? "";
  const category = request.nextUrl.searchParams.get("category") ?? "";
  const action = request.nextUrl.searchParams.get("action") ?? "";
  const status = request.nextUrl.searchParams.get("status") ?? "";
  const source = request.nextUrl.searchParams.get("source") ?? "";
  const code = request.nextUrl.searchParams.get("code") ?? "";
  const limit = parseIntInRange(request.nextUrl.searchParams.get("limit"), 120, 1, 500);

  const dbLogs = listOpsEvents({
    userEmail,
    projectId,
    category,
    action,
    status,
    source,
    code,
    limit,
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

  const logs = Array.from(mergedById.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((item) => ({
      ...item,
      stage: resolveFailureStage(item),
    }));

  return NextResponse.json({
    ok: true,
    logs,
    generatedAt: new Date().toISOString(),
  });
}
