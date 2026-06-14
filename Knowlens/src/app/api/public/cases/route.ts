import { NextResponse } from "next/server";
import { astronomyInfographicTemplates } from "@/lib/astronomy-infographic-templates";
import { biologyInfographicTemplates } from "@/lib/biology-infographic-templates";
import { comparisonInfographicTemplates } from "@/lib/comparison-infographic-templates";
import { earthScienceInfographicTemplates } from "@/lib/earth-science-infographic-templates";
import { financeInfographicTemplates } from "@/lib/finance-infographic-templates";
import { normalizeInfographicCategorySlug } from "@/lib/infographic-paths";
import { processInfographicTemplates } from "@/lib/process-infographic-templates";
import { recipeInfographicTemplates } from "@/lib/recipe-infographic-templates";
import { roadmapInfographicTemplates } from "@/lib/roadmap-infographic-templates";
import { listPublishedCases } from "@/lib/server/published-cases";

export const runtime = "nodejs";

type PublicCaseAsset = {
  id: string;
  slug: string;
  title?: string;
  description?: string;
  pageIndex?: number;
  fileUrl: string;
  viewerUrl: string;
  downloadUrl?: string;
  thumbnailUrl?: string;
  mimeType?: string;
  width?: number | null;
  height?: number | null;
};

type PublicCaseItem = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  category?: string;
  outputType?: string;
  authorLabel?: string;
  coverUrl?: string;
  featured?: boolean;
  sortOrder?: number;
  publishedAt?: string | null;
  updatedAt?: string;
  assets?: PublicCaseAsset[];
};

type TemplateCaseLike = {
  id: string;
  slug: string;
  title: string;
  visibleDescription?: string;
  shortDescription?: string;
  categoryName?: string;
  categorySlug?: string;
  detailPath: string;
  previewImagePath?: string;
  previewImageUrl?: string;
  imageMimeType?: string;
  imageWidth?: number | null;
  imageHeight?: number | null;
  createdAt?: string;
  updatedAt?: string;
  generationStatus?: string;
};

const templateCategoryFallbacks = [
  { category: "Process", templates: processInfographicTemplates },
  { category: "Recipe", templates: recipeInfographicTemplates },
  { category: "Biology", templates: biologyInfographicTemplates },
  { category: "Earth Science", templates: earthScienceInfographicTemplates },
  { category: "Financial Report", templates: financeInfographicTemplates },
  { category: "Astronomy", templates: astronomyInfographicTemplates },
  { category: "Comparison", templates: comparisonInfographicTemplates },
  { category: "Roadmap", templates: roadmapInfographicTemplates },
] as const;

function toLocalImageUrl(input?: string) {
  const value = (input || "").trim();
  if (!value) {
    return "";
  }
  if (value.startsWith("/")) {
    return value;
  }
  try {
    return new URL(value).pathname || value;
  } catch {
    return value;
  }
}

function mapTemplateToPublicCase(template: TemplateCaseLike, index: number): PublicCaseItem | null {
  if (template.generationStatus && template.generationStatus !== "success") {
    return null;
  }
  const coverUrl = toLocalImageUrl(template.previewImagePath || template.previewImageUrl);
  if (!coverUrl) {
    return null;
  }
  return {
    id: template.id,
    slug: template.slug,
    title: template.title,
    description: template.visibleDescription || template.shortDescription || "",
    category: template.categoryName || template.categorySlug || "All",
    outputType: "poster",
    authorLabel: "KnowLens",
    coverUrl,
    featured: true,
    sortOrder: 10_000 + index,
    publishedAt: template.createdAt || template.updatedAt || null,
    updatedAt: template.updatedAt || template.createdAt,
    assets: [
      {
        id: `${template.id}-cover`,
        slug: "cover-1",
        title: template.title,
        description: template.visibleDescription || template.shortDescription || "",
        pageIndex: 1,
        fileUrl: coverUrl,
        viewerUrl: template.detailPath,
        downloadUrl: coverUrl,
        thumbnailUrl: coverUrl,
        mimeType: template.imageMimeType || "image/webp",
        width: template.imageWidth || null,
        height: template.imageHeight || null,
      },
    ],
  };
}

export async function GET() {
  const publishedCases = (
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

  const presentCategories = new Set(
    publishedCases
      .map((item) => normalizeInfographicCategorySlug(item.category))
      .filter(
        (value): value is NonNullable<ReturnType<typeof normalizeInfographicCategorySlug>> => value !== null,
      ),
  );

  const fallbackCases = templateCategoryFallbacks.flatMap(({ category, templates }) => {
    const categorySlug = normalizeInfographicCategorySlug(category);
    if (categorySlug && presentCategories.has(categorySlug)) {
      return [];
    }
    return templates
      .slice(0, 8)
      .map((template, index) => mapTemplateToPublicCase(template as TemplateCaseLike, index))
      .filter((item): item is PublicCaseItem => Boolean(item));
  });

  const cases = [...publishedCases, ...fallbackCases]
    .slice()
    .sort((left, right) => {
      const leftTime = Date.parse(left.publishedAt || left.updatedAt || "") || 0;
      const rightTime = Date.parse(right.publishedAt || right.updatedAt || "") || 0;
      return rightTime - leftTime;
    })
    .slice(0, 120);

  return NextResponse.json(
    { cases },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
