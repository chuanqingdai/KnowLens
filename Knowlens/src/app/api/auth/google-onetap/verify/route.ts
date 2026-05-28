import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { rateLimitOrThrow } from "@/lib/server/rate-limit";
import { RATE_LIMIT_CONFIG } from "@/lib/server/rate-limit-config";
import { logOpsEvent } from "@/lib/server/store";

export const runtime = "nodejs";

let client: OAuth2Client | null = null;

function getClient() {
  if (client) {
    return client;
  }
  client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID ?? "");
  return client;
}

export async function POST(request: NextRequest) {
  try {
    rateLimitOrThrow({
      scopeKey: `onetap:${request.headers.get("x-forwarded-for") ?? "unknown"}`,
      endpoint: "auth-google-onetap-verify",
      limit: RATE_LIMIT_CONFIG.authGoogleOneTapVerify.limit,
      windowMs: RATE_LIMIT_CONFIG.authGoogleOneTapVerify.windowMs,
    });

    const body = (await request.json()) as { credential?: string };
    const credential = (body.credential ?? "").trim();
    const audience = (process.env.GOOGLE_CLIENT_ID ?? "").trim();
    if (!credential || !audience) {
      logOpsEvent({
        category: "auth",
        action: "signin_failed",
        status: "error",
        source: "google_onetap",
        code: "ONETAP_MISSING_INPUT",
        message: "Missing credential or GOOGLE_CLIENT_ID.",
      });
      return NextResponse.json({ ok: false, error: "Missing credential or GOOGLE_CLIENT_ID." }, { status: 400 });
    }
    const ticket = await getClient().verifyIdToken({
      idToken: credential,
      audience,
    });
    const payload = ticket.getPayload();
    if (!payload?.email || payload.email_verified !== true) {
      logOpsEvent({
        category: "auth",
        action: "signin_failed",
        status: "error",
        source: "google_onetap",
        code: "ONETAP_EMAIL_NOT_VERIFIED",
        message: "Email is not verified.",
      });
      return NextResponse.json({ ok: false, error: "Email is not verified." }, { status: 401 });
    }
    logOpsEvent({
      category: "auth",
      action: "signin_success",
      status: "ok",
      source: "google_onetap",
      userEmail: payload.email,
    });
    return NextResponse.json({
      ok: true,
      email: payload.email,
      name: payload.name || null,
      sub: payload.sub,
    });
  } catch (error) {
    const retryAfter = (error as Error & { retryAfterSeconds?: number }).retryAfterSeconds;
    if (retryAfter) {
      logOpsEvent({
        category: "auth",
        action: "signin_failed",
        status: "error",
        source: "google_onetap",
        code: "ONETAP_RATE_LIMIT",
        message: "Too many verification attempts.",
      });
      return NextResponse.json(
        { ok: false, error: "Too many verification attempts. Please retry later." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
    const message = error instanceof Error ? error.message : "Invalid Google credential.";
    logOpsEvent({
      category: "auth",
      action: "signin_failed",
      status: "error",
      source: "google_onetap",
      code: "ONETAP_VERIFY_FAILED",
      message,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }
}
