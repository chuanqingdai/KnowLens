import { NextResponse } from "next/server";
import { listPublishedCases } from "@/lib/server/published-cases";

export const runtime = "nodejs";

export async function GET() {
  const cases = (
    await listPublishedCases({ limit: 120, includeAssets: true, includeLatestVideoExportAssets: true })
  )
    .slice()
    .sort((left, right) => {
      const leftTime = Date.parse(left.publishedAt || left.updatedAt || "") || 0;
      const rightTime = Date.parse(right.publishedAt || right.updatedAt || "") || 0;
      return rightTime - leftTime;
    })
    .map((item) => ({
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
      updatedAt: item.updatedAt,
      assets: (item.assets || []).map((asset) => ({
        id: asset.id,
        slug: asset.slug,
        title: asset.title,
        description: asset.description,
        pageIndex: asset.pageIndex,
        fileUrl: asset.fileUrl,
        viewerUrl: asset.viewerUrl,
        downloadUrl: asset.downloadUrl,
        thumbnailUrl: asset.thumbnailUrl,
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
      })),
    }));

  return NextResponse.json(
    { cases },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
