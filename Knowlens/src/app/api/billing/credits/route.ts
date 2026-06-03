import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import {
  applyCreditRecordAtomic,
  getLatestSubscriptionDb,
  listCreditRecords,
} from "@/lib/server/store";

export const runtime = "nodejs";

type DbCreditRecord = {
  id?: string;
  created_at?: string;
  createdAt?: string;
  type?: "consume" | "topup" | "refund" | string;
  description?: string;
  delta?: number;
  balance?: number;
  user_id?: string | null;
  userId?: string | null;
  user_email?: string | null;
  userEmail?: string | null;
  project_id?: string | null;
  projectId?: string | null;
  project_title?: string | null;
  projectTitle?: string | null;
};

function normalizeRecord(input: DbCreditRecord) {
  return {
    id: String(input.id ?? ""),
    createdAt: String(input.created_at ?? input.createdAt ?? new Date().toISOString()),
    type: (input.type === "topup" || input.type === "refund" ? input.type : "consume") as
      | "consume"
      | "topup"
      | "refund",
    description: String(input.description ?? ""),
    delta: Number(input.delta ?? 0),
    balance: Number(input.balance ?? 0),
    userId: input.user_id ?? input.userId ?? undefined,
    userEmail: input.user_email ?? input.userEmail ?? undefined,
    projectId: input.project_id ?? input.projectId ?? undefined,
    projectTitle: input.project_title ?? input.projectTitle ?? undefined,
  };
}

function normalizeSubscription(input: unknown) {
  if (!input || typeof input !== "object") {
    return null;
  }
  const row = input as {
    plan_id?: string;
    plan_name?: string;
    cycle?: "monthly" | "yearly" | string;
    status?: string;
    started_at?: string;
    renew_at?: string;
    canceled_at?: string | null;
  };
  const planId = String(row.plan_id ?? "").trim();
  const planName = String(row.plan_name ?? "").trim();
  const status = String(row.status ?? "").trim();
  if (!planId || !planName || !status) {
    return null;
  }
  return {
    planId,
    planName,
    cycle: row.cycle === "monthly" ? "monthly" : "yearly",
    status:
      status === "active" || status === "canceling" || status === "canceled"
        ? status
        : "inactive",
    startedAt: String(row.started_at ?? ""),
    renewAt: String(row.renew_at ?? ""),
    canceledAt: row.canceled_at ?? undefined,
  };
}

export async function GET() {
  const session = await getServerSession(nextAuthOptions);
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json(
      {
        ok: false,
        code: "BILLING_CREDITS_AUTH_REQUIRED",
        error: "Please sign in first.",
      },
      { status: 401 },
    );
  }

  const rawRecords = (await listCreditRecords(email)) as DbCreditRecord[];
  const records = rawRecords.map(normalizeRecord);
  const subscription = normalizeSubscription(await getLatestSubscriptionDb(email));
  return NextResponse.json({
    ok: true,
    email,
    records,
    balance: records[0]?.balance ?? 50,
    subscription,
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(nextAuthOptions);
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json(
      {
        ok: false,
        code: "BILLING_CREDITS_AUTH_REQUIRED",
        error: "Please sign in first.",
      },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    type?: "consume" | "topup" | "refund";
    description?: string;
    delta?: number;
    projectId?: string;
    projectTitle?: string;
    userId?: string;
  };
  const type = body.type === "topup" || body.type === "refund" ? body.type : "consume";
  const delta = Number(body.delta ?? 0);
  const description = String(body.description ?? "").trim().slice(0, 500);
  if (!Number.isFinite(delta) || delta === 0 || !description) {
    return NextResponse.json(
      {
        ok: false,
        code: "BILLING_CREDITS_INVALID_INPUT",
        error: "Invalid credit record input.",
      },
      { status: 400 },
    );
  }
  if (type === "consume" && delta > 0) {
    return NextResponse.json(
      {
        ok: false,
        code: "BILLING_CREDITS_INVALID_CONSUME_DELTA",
        error: "Consume records must use a negative delta.",
      },
      { status: 400 },
    );
  }
  if ((type === "topup" || type === "refund") && delta < 0) {
    return NextResponse.json(
      {
        ok: false,
        code: "BILLING_CREDITS_INVALID_CREDIT_DELTA",
        error: "Topup and refund records must use a positive delta.",
      },
      { status: 400 },
    );
  }

  const result = await applyCreditRecordAtomic({
    userEmail: email,
    userId: body.userId,
    projectId: body.projectId?.trim() || undefined,
    projectTitle: body.projectTitle?.trim().slice(0, 240) || undefined,
    type,
    description,
    delta: Math.round(delta),
    rejectNegativeBalance: type === "consume",
  });
  if (!result.applied) {
    return NextResponse.json(
      {
        ok: false,
        code: result.code,
        balance: result.balance,
        error: "Not enough credits.",
      },
      { status: 402 },
    );
  }

  const records = ((await listCreditRecords(email)) as DbCreditRecord[]).map(normalizeRecord);
  return NextResponse.json({
    ok: true,
    email,
    records,
    balance: records[0]?.balance ?? result.balance,
  });
}
