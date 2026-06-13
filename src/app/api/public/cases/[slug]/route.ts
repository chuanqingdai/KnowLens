import { NextResponse } from "next/server";
import { getPublishedCaseBySlug } from "@/lib/server/published-cases";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const item = await getPublishedCaseBySlug(slug, false, { includeLatestVideoExportAsset: true });
  if (!item) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }

  return NextResponse.json(
    { case: item },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
