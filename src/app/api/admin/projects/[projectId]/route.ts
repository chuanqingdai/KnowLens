import { NextRequest, NextResponse } from "next/server";
import { requireAdminEmail } from "@/lib/server/admin-auth";
import { getAdminConsoleData } from "@/lib/server/admin-console-data";
import { resolveProjectDetail } from "@/lib/server/project-details";

export const runtime = "nodejs";

function normalizeProjectId(value: string) {
  return value.trim().slice(0, 120);
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const adminEmail = await requireAdminEmail();
  if (!adminEmail) {
    return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
  }

  const { projectId } = await context.params;
  const normalizedProjectId = normalizeProjectId(projectId);
  if (!normalizedProjectId) {
    return NextResponse.json({ ok: false, error: "Project id is required." }, { status: 400 });
  }

  const consoleData = await getAdminConsoleData();
  const project = consoleData.projects.find((item) => item.id === normalizedProjectId) || null;
  if (!project) {
    return NextResponse.json({ ok: false, error: "Project not found." }, { status: 404 });
  }

  const owner = consoleData.users.find((item) => item.id === project.userId) || null;
  const ownerEmail = owner?.email?.trim().toLowerCase() || "";
  if (!ownerEmail) {
    return NextResponse.json({ ok: false, error: "Project owner not found." }, { status: 404 });
  }

  const detail = await resolveProjectDetail({
    userEmail: ownerEmail,
    projectId: normalizedProjectId,
  });
  if (!detail) {
    return NextResponse.json({ ok: false, error: "Project detail not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    owner: {
      id: owner?.id || project.userId,
      email: ownerEmail,
    },
    detail,
  });
}
