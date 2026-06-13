import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import { buildImageRenderUrl, getLatestImageGenerationJobByProject } from "@/lib/server/image-generation-jobs";
import { listProjectSummaries } from "@/lib/server/project-details";
import { listProjectsByUser } from "@/lib/server/store";
import { getWorkspaceProjectCover } from "@/lib/server/workspace-project-pages";

export const runtime = "nodejs";

function normalizeProjectOutputType(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "ppt" || normalized === "presentation" || normalized === "slides") {
    return "ppt";
  }
  if (normalized === "video") {
    return "video";
  }
  return "poster";
}

function parseProjectsLimit(value: string | null, fallback: number) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

async function resolveLightweightProjectCover(input: {
  userEmail: string;
  projectId: string;
  outputType: string;
}) {
  const coverFromPages = await getWorkspaceProjectCover({
    userEmail: input.userEmail,
    projectId: input.projectId,
    outputType: input.outputType,
  });
  if (coverFromPages) {
    return coverFromPages;
  }

  const latestJob = await getLatestImageGenerationJobByProject({
    userEmail: input.userEmail,
    projectId: input.projectId,
    intent: input.outputType,
  });
  const firstReadyTask = (latestJob?.tasks || []).find((task) => task.status === "asset_ready");
  if (!firstReadyTask) {
    return "";
  }
  return firstReadyTask.renderUrl || buildImageRenderUrl(firstReadyTask.id, firstReadyTask.updatedAt);
}

export async function GET(request: NextRequest) {
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

  const lightweight = request.nextUrl.searchParams.get("summary") === "1";
  const requestedLimit = parseProjectsLimit(request.nextUrl.searchParams.get("limit"), lightweight ? 4 : 0);
  const limit = lightweight ? Math.max(1, Math.min(8, requestedLimit)) : Math.min(100, requestedLimit);
  if (lightweight) {
    const rows = (await listProjectsByUser(email)).slice(0, limit);
    const projects = await Promise.all(
      rows.map(async (row) => {
        const projectId = String(row.id || "");
        const outputType = normalizeProjectOutputType(row.format);
        const cover = projectId
          ? await resolveLightweightProjectCover({
              userEmail: email,
              projectId,
              outputType,
            })
          : "";
        return {
          id: projectId,
          title: String(row.title || "Untitled project"),
          status: String(row.status || "in_progress"),
          storedStatus: String(row.status || ""),
          format: outputType,
          duration: row.duration ? String(row.duration) : undefined,
          createdAt: null,
          updatedAt: String(row.updated_at || row.updatedAt || new Date().toISOString()),
          cover,
          coverImageUrl: cover,
        };
      }),
    );
    return NextResponse.json({
      ok: true,
      projects,
      lightweight: true,
    });
  }

  const projects = await listProjectSummaries(email);
  return NextResponse.json({
    ok: true,
    projects: limit > 0 ? projects.slice(0, limit) : projects,
  });
}
