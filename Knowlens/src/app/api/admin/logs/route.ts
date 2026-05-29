import { NextRequest, NextResponse } from "next/server";
import { requireAdminEmail } from "@/lib/server/admin-auth";
import { listOpsEvents } from "@/lib/server/store";

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

  const logs = listOpsEvents({
    userEmail,
    projectId,
    category,
    action,
    status,
    source,
    code,
    limit,
  }).map((item) => ({
    ...item,
    stage: resolveFailureStage(item),
  }));

  return NextResponse.json({
    ok: true,
    logs,
    generatedAt: new Date().toISOString(),
  });
}
