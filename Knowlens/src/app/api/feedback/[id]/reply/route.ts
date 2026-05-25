import { NextRequest, NextResponse } from "next/server";
import { replyFeedbackDb } from "@/lib/server/store";
import { rateLimitOrThrow } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const params = await context.params;
    const body = (await request.json()) as { reply?: string; repliedBy?: string };
    const recordId = (params.id ?? "").trim();
    if (!recordId) {
      return NextResponse.json({ error: "record id is required" }, { status: 400 });
    }
    rateLimitOrThrow({
      scopeKey: `reply:${request.headers.get("x-forwarded-for") ?? "unknown"}`,
      endpoint: "feedback-reply",
      limit: 20,
      windowMs: 10 * 60_000,
    });
    const reply = (body.reply ?? "").trim();
    if (!reply) {
      return NextResponse.json({ error: "reply is required" }, { status: 400 });
    }
    replyFeedbackDb({
      recordId,
      reply,
      repliedBy: (body.repliedBy ?? "Admin").trim() || "Admin",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const retryAfter = (error as Error & { retryAfterSeconds?: number }).retryAfterSeconds;
    if (retryAfter) {
      return NextResponse.json(
        { error: "Too many reply requests. Please retry later." },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        },
      );
    }
    const message = error instanceof Error ? error.message : "Reply failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

