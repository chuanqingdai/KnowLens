import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import { logOpsEvent } from "@/lib/server/store";

export const runtime = "nodejs";

type TelemetryEventBody = {
  category?: string;
  action?: string;
  status?: "ok" | "error" | "info";
  source?: string;
  code?: string;
  message?: string;
  details?: unknown;
  projectId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TelemetryEventBody;
    const session = await getServerSession(nextAuthOptions);
    const email = session?.user?.email?.trim().toLowerCase() || undefined;
    if (!body.category || !body.action) {
      return NextResponse.json({ error: "category and action are required." }, { status: 400 });
    }
    logOpsEvent({
      category: body.category,
      action: body.action,
      status: body.status ?? "info",
      source: body.source,
      code: body.code,
      message: body.message,
      details: body.details,
      projectId: body.projectId,
      userEmail: email,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "telemetry write failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

