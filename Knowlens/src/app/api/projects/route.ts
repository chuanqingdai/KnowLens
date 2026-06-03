import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import { listProjectSummaries } from "@/lib/server/project-details";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(nextAuthOptions);
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json(
      {
        ok: false,
        code: "PROJECTS_AUTH_REQUIRED",
        error: "Please sign in first.",
      },
      { status: 401 },
    );
  }

  const projects = await listProjectSummaries(email);
  return NextResponse.json({
    ok: true,
    projects,
  });
}
