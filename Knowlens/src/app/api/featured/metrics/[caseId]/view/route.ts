import { NextRequest, NextResponse } from "next/server";
import { rateLimitOrThrow } from "@/lib/server/rate-limit";
import { normalizeScope } from "@/lib/server/store";
import { getDb } from "@/lib/server/db";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> },
) {
  try {
    const params = await context.params;
    const caseId = (params.caseId ?? "").trim();
    if (!caseId) {
      return NextResponse.json({ error: "caseId is required" }, { status: 400 });
    }
    const body = (await request.json().catch(() => ({}))) as { userEmail?: string };
    const userScope = normalizeScope(body.userEmail);
    rateLimitOrThrow({
      scopeKey: userScope === "guest" ? `ip:${request.headers.get("x-forwarded-for") ?? "unknown"}` : `user:${userScope}`,
      endpoint: "featured-view",
      limit: 120,
      windowMs: 60_000,
    });
    const { db } = getDb();
    db.prepare(
      `INSERT INTO featured_case_metrics (case_id, user_scope, views_delta, likes_delta, liked, updated_at)
       VALUES (?, ?, 1, 0, 0, datetime('now'))
       ON CONFLICT(case_id, user_scope)
       DO UPDATE SET views_delta = views_delta + 1, updated_at = datetime('now')`,
    ).run(caseId, userScope);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const retryAfter = (error as Error & { retryAfterSeconds?: number }).retryAfterSeconds;
    if (retryAfter) {
      return NextResponse.json(
        { error: "Too many view updates. Please retry later." },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        },
      );
    }
    const message = error instanceof Error ? error.message : "View update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
