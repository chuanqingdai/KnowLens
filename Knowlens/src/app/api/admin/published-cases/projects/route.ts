import { NextRequest, NextResponse } from "next/server";
import { requireAdminEmail } from "@/lib/server/admin-auth";
import { listPublishedCases } from "@/lib/server/published-cases";
import { searchWorkspaceProjectSummaries } from "@/lib/server/workspace-project-pages";

export const runtime = "nodejs";

function normalizeParam(value: string | null, max = 240) {
  return (value || "").trim().slice(0, max);
}

export async function GET(request: NextRequest) {
  const adminEmail = await requireAdminEmail();
  if (!adminEmail) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const projectId = normalizeParam(request.nextUrl.searchParams.get("projectId"), 140);
  const userEmail = normalizeParam(request.nextUrl.searchParams.get("userEmail"), 240).toLowerCase();
  const outputType = normalizeParam(request.nextUrl.searchParams.get("outputType"), 40);
  const limit = Number(request.nextUrl.searchParams.get("limit") || "24");

  if (!projectId && !userEmail) {
    return NextResponse.json({ projects: [] });
  }

  const [projects, publishedCases] = await Promise.all([
    searchWorkspaceProjectSummaries({
      projectId,
      userEmail,
      outputType,
      limit,
    }),
    listPublishedCases({ includeDrafts: true, includeAssets: false, limit: 200 }),
  ]);
  const publishedBySource = new Map(
    publishedCases
      .filter((item) => item.sourceProjectId && item.sourceUserEmail)
      .map((item) => [`${item.sourceProjectId}|${item.sourceUserEmail}|${item.outputType}`, item]),
  );

  return NextResponse.json({
    projects: projects.map((project) => {
      const publishedCase = publishedBySource.get(`${project.projectId}|${project.userEmail}|${project.outputType}`);
      return {
        ...project,
        alreadyPublished: Boolean(publishedCase),
        publishedCaseId: publishedCase?.id || null,
        publishedStatus: publishedCase?.status || null,
        publishedSlug: publishedCase?.slug || null,
      };
    }),
  });
}
