import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import { listCreditRecords } from "@/lib/server/store";

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

  const rawRecords = listCreditRecords(email) as DbCreditRecord[];
  const records = rawRecords.map(normalizeRecord);
  return NextResponse.json({
    ok: true,
    email,
    records,
    balance: records[0]?.balance ?? 50,
  });
}
