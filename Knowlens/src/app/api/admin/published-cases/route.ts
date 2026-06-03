import { NextRequest, NextResponse } from "next/server";
import { requireAdminEmail } from "@/lib/server/admin-auth";
import {
  listPublishedCases,
  publishProjectAsCase,
} from "@/lib/server/published-cases";
import { logOpsEvent } from "@/lib/server/store";

export const runtime = "nodejs";

type PublishCaseBody = {
  projectId?: string;
  userEmail?: string;
  outputType?: string;
  title?: string;
  description?: string;
  category?: string;
  authorLabel?: string;
  slug?: string;
  featured?: boolean;
  sortOrder?: number;
};

function requestOrigin(request: NextRequest) {
  return request.nextUrl.origin;
}

export async function GET() {
  const adminEmail = await requireAdminEmail();
  if (!adminEmail) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  return NextResponse.json({
    cases: listPublishedCases({ includeDrafts: true, limit: 200 }),
  });
}

export async function POST(request: NextRequest) {
  const adminEmail = await requireAdminEmail();
  if (!adminEmail) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as PublishCaseBody;
    const item = await publishProjectAsCase({
      projectId: body.projectId || "",
      userEmail: body.userEmail || "",
      outputType: body.outputType || "poster",
      title: body.title,
      description: body.description,
      category: body.category,
      authorLabel: body.authorLabel,
      slug: body.slug,
      featured: body.featured,
      sortOrder: body.sortOrder,
      origin: requestOrigin(request),
    });

    logOpsEvent({
      category: "admin",
      action: "published_case_created",
      status: "ok",
      source: "admin_cases",
      userEmail: adminEmail,
      projectId: body.projectId || undefined,
      message: "Admin published a project as a public case.",
      details: {
        caseId: item.id,
        slug: item.slug,
        outputType: item.outputType,
        assetCount: item.assets?.length || 0,
      },
    });

    return NextResponse.json({ case: item }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to publish case.";
    logOpsEvent({
      category: "admin",
      action: "published_case_failed",
      status: "error",
      source: "admin_cases",
      userEmail: adminEmail,
      code: "PUBLISHED_CASE_CREATE_FAILED",
      message,
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
