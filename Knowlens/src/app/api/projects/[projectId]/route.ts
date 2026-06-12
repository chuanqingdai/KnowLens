import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import { resolveProjectDetail } from "@/lib/server/project-details";

export const runtime = "nodejs";

function ensureSafeOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) {
    return true;
  }
  return origin === req.nextUrl.origin;
}

function normalizeProjectId(value: string) {
  return value.trim().slice(0, 120);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  if (!ensureSafeOrigin(request)) {
    return NextResponse.json({ ok: false, error: "Forbidden request origin." }, { status: 403 });
  }

  const session = await getServerSession(nextAuthOptions);
  const email = session?.user?.email?.trim().toLowerCase() || "";
  if (!email) {
    return NextResponse.json(
      {
        ok: false,
        code: "PROJECT_AUTH_REQUIRED",
        error: "Please sign in first.",
      },
      { status: 401 },
    );
  }

  const { projectId } = await context.params;
  const detail = await resolveProjectDetail({
    userEmail: email,
    projectId: normalizeProjectId(projectId),
    includeOriginalInput: true,
  });
  if (!detail) {
    return NextResponse.json(
      {
        ok: false,
        code: "PROJECT_NOT_FOUND",
        error: "Project not found.",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    ...detail,
  });
}
