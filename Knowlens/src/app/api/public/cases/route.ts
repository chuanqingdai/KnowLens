import { NextResponse } from "next/server";
import { listPublishedCases } from "@/lib/server/published-cases";

export const runtime = "nodejs";

export async function GET() {
  const cases = listPublishedCases({ limit: 120 }).map((item) => ({
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
    assets: (item.assets || []).map((asset) => ({
      id: asset.id,
      slug: asset.slug,
      assetType: asset.assetType,
      title: asset.title,
      description: asset.description,
      pageIndex: asset.pageIndex,
      fileUrl: asset.fileUrl,
      viewerUrl: asset.viewerUrl,
      thumbnailUrl: asset.thumbnailUrl,
      downloadUrl: asset.downloadUrl,
      mimeType: asset.mimeType,
      isPrimary: asset.isPrimary,
      sortOrder: asset.sortOrder,
    })),
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
