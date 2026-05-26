import { NextRequest, NextResponse } from "next/server";
import { insertFeedbackDb, listFeedbackDb, normalizeScope } from "@/lib/server/store";
import { rateLimitOrThrow } from "@/lib/server/rate-limit";
import { RATE_LIMIT_CONFIG } from "@/lib/server/rate-limit-config";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const scope = normalizeScope(request.nextUrl.searchParams.get("email"));
  const items = listFeedbackDb();
  const filtered = scope === "guest" ? items : items;
  return NextResponse.json({ records: filtered });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      type?: string;
      detail?: string;
      contact?: string;
      attachments?: string[];
      submitterEmail?: string;
      submitterName?: string;
    };
    const email = (body.submitterEmail ?? "").trim().toLowerCase();
    rateLimitOrThrow({
      scopeKey: email ? `user:${email}` : `ip:${request.headers.get("x-forwarded-for") ?? "unknown"}`,
      endpoint: "feedback-create",
      limit: RATE_LIMIT_CONFIG.feedbackCreate.limit,
      windowMs: RATE_LIMIT_CONFIG.feedbackCreate.windowMs,
    });

    const detail = (body.detail ?? "").trim();
    const contact = (body.contact ?? "").trim();
    const type = (body.type ?? "").trim();
    if (!detail || !contact || !type) {
      return NextResponse.json({ error: "Missing required feedback fields" }, { status: 400 });
    }

    const id = insertFeedbackDb({
      type,
      detail,
      contact,
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
      submitterEmail: email || undefined,
      submitterName: body.submitterName?.trim() || undefined,
    });
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    const retryAfter = (error as Error & { retryAfterSeconds?: number }).retryAfterSeconds;
    if (retryAfter) {
      return NextResponse.json(
        { error: "Too many feedback requests. Please retry later." },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        },
      );
    }
    const message = error instanceof Error ? error.message : "Feedback submit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
