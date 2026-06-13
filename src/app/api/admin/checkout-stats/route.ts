import { NextRequest, NextResponse } from "next/server";
import { requireAdminEmail } from "@/lib/server/admin-auth";
import { getCheckoutSourceDailyStats } from "@/lib/server/store";

export const runtime = "nodejs";

function parseDays(raw: string | null) {
  const value = Number.parseInt((raw ?? "").trim(), 10);
  if (!Number.isFinite(value)) {
    return 14;
  }
  return Math.min(90, Math.max(1, value));
}

export async function GET(request: NextRequest) {
  const adminEmail = await requireAdminEmail();
  if (!adminEmail) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const days = parseDays(request.nextUrl.searchParams.get("days"));
  const stats = getCheckoutSourceDailyStats({ days });
  return NextResponse.json({
    ok: true,
    days,
    generatedAt: new Date().toISOString(),
    stats: stats.map((row) => ({
      ...row,
      orderCount: row.attempts,
      successCount: row.successes,
    })),
  });
}
