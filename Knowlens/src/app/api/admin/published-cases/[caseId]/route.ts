import { NextResponse } from "next/server";
import { requireAdminEmail } from "@/lib/server/admin-auth";
import { updatePublishedCaseStatus } from "@/lib/server/published-cases";

export const runtime = "nodejs";

type UpdateCaseBody = {
  status?: string;
  featured?: boolean;
  sortOrder?: number;
};

export async function PATCH(request: Request, context: { params: Promise<{ caseId: string }> }) {
  const adminEmail = await requireAdminEmail();
  if (!adminEmail) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { caseId } = await context.params;
  const body = (await request.json()) as UpdateCaseBody;
  try {
    const item = await updatePublishedCaseStatus({
      id: caseId,
      status: body.status,
      featured: body.featured,
      sortOrder: body.sortOrder,
    });
    return NextResponse.json({ case: item });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update case." },
      { status: 400 },
    );
  }
}
