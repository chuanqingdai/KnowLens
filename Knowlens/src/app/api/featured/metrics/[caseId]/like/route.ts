import { NextRequest, NextResponse } from "next/server";
import { normalizeScope, toggleCaseLikeDb } from "@/lib/server/store";
import { rateLimitOrThrow } from "@/lib/server/rate-limit";
import { RATE_LIMIT_CONFIG } from "@/lib/server/rate-limit-config";

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
      endpoint: "featured-like",
      limit: RATE_LIMIT_CONFIG.featuredLike.limit,
      windowMs: RATE_LIMIT_CONFIG.featuredLike.windowMs,
    });
    const next = toggleCaseLikeDb(caseId, userScope);
    return NextResponse.json({ ok: true, liked: next.liked, likesDelta: next.likesDelta });
  } catch (error) {
    const retryAfter = (error as Error & { retryAfterSeconds?: number }).retryAfterSeconds;
    if (retryAfter) {
      return NextResponse.json(
        { error: "Too many like requests. Please retry later." },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        },
      );
    }
    const message = error instanceof Error ? error.message : "Like update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
