import { NextResponse } from "next/server";
import { requireAdminEmail } from "@/lib/server/admin-auth";
import { getAdminConsoleData } from "@/lib/server/admin-console-data";

export const runtime = "nodejs";

export async function GET() {
  const adminEmail = await requireAdminEmail();
  if (!adminEmail) {
    return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
  }

  const data = await getAdminConsoleData();
  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    data,
  });
}
