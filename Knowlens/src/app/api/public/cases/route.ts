import { NextResponse } from "next/server";
import { listPublishedCases } from "@/lib/server/published-cases";

export const runtime = "nodejs";

export async function GET() {
  const cases = (await listPublishedCases({ limit: 24, includeAssets: false })).map((item) => ({
    id: item.id,
    slug: item.slug,
    title: item.title,
    description: item.description,
    category: item.category,
    outputType: item.outputType,
    authorLabel: item.authorLabel,
    coverUrl: item.coverUrl,
    featured: item.featured,
    sortOrder: item.sortOrder,
    publishedAt: item.publishedAt,
    assets: [],
  }));

  return NextResponse.json(
    { cases },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
