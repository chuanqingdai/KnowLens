import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import { logOpsEvent } from "@/lib/server/store";

export const runtime = "nodejs";

type ClientLogBody = {
  category?: string;
  action?: string;
  status?: "ok" | "error" | "info";
  source?: string;
  code?: string;
  message?: string;
  projectId?: string;
  details?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as ClientLogBody;
    if (!body.category || !body.action) {
      return NextResponse.json({ error: "category and action are required." }, { status: 400 });
    }
    const session = await getServerSession(nextAuthOptions);
    const email = session?.user?.email?.trim().toLowerCase() || undefined;
    logOpsEvent({
      category: body.category,
      action: body.action,
      status: body.status ?? "info",
      source: body.source,
      code: body.code,
      message: body.message,
      projectId: body.projectId,
      details: body.details,
      userEmail: email,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "client log write failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return new NextResponse(null, { status: 204 });
}
