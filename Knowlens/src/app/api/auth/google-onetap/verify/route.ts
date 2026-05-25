import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";

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
    const body = (await request.json()) as { credential?: string };
    const credential = (body.credential ?? "").trim();
    const audience = (process.env.GOOGLE_CLIENT_ID ?? "").trim();
    if (!credential || !audience) {
      return NextResponse.json({ ok: false, error: "Missing credential or GOOGLE_CLIENT_ID." }, { status: 400 });
    }
    const ticket = await getClient().verifyIdToken({
      idToken: credential,
      audience,
    });
    const payload = ticket.getPayload();
    if (!payload?.email || payload.email_verified !== true) {
      return NextResponse.json({ ok: false, error: "Email is not verified." }, { status: 401 });
    }
    return NextResponse.json({
      ok: true,
      email: payload.email,
      name: payload.name || null,
      sub: payload.sub,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Google credential.";
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }
}
