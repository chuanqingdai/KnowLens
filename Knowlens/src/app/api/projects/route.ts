import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import { listProjectsByUser } from "@/lib/server/store";
import { getWorkspaceProjectCover } from "@/lib/server/workspace-project-pages";

export const runtime = "nodejs";

type DbProject = {
  id?: string;
  title?: string;
  status?: string;
  format?: string | null;
  duration?: string | null;
  updated_at?: string;
  updatedAt?: string;
};

function normalizeProject(row: DbProject, userEmail: string) {
  const id = String(row.id ?? "");
  return {
    id,
    title: String(row.title ?? "Untitled project"),
    status: String(row.status ?? "进行中"),
    format: row.format ? String(row.format) : "",
    duration: row.duration ? String(row.duration) : undefined,
    updatedAt: String(row.updated_at ?? row.updatedAt ?? new Date().toISOString()),
    cover: id ? getWorkspaceProjectCover({ projectId: id, userEmail }) : "",
  };
}

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

  const projects = (listProjectsByUser(email) as DbProject[]).map((project) => normalizeProject(project, email));
  return NextResponse.json({
    ok: true,
    projects,
  });
}
