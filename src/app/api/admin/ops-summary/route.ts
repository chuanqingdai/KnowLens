import { NextRequest, NextResponse } from "next/server";
import { requireAdminEmail } from "@/lib/server/admin-auth";
import { getAdminOpsSummary } from "@/lib/server/store";

export const runtime = "nodejs";

function parseIntInRange(raw: string | null, fallback: number, min: number, max: number) {
  const value = Number.parseInt((raw ?? "").trim(), 10);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

export async function GET(request: NextRequest) {
  const adminEmail = await requireAdminEmail();
  if (!adminEmail) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const checkoutDays = parseIntInRange(request.nextUrl.searchParams.get("checkoutDays"), 14, 1, 90);
  const errorLimit = parseIntInRange(request.nextUrl.searchParams.get("errorLimit"), 80, 10, 200);
  const summary = getAdminOpsSummary({
    checkoutDays,
    errorLimit,
  });
  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    checkoutDays,
    errorLimit,
    summary,
  });
}

