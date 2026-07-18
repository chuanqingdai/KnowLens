import { NextResponse } from "next/server";
import { insuranceShowcaseTemplates } from "@/app/insurance/page";

export const runtime = "nodejs";
const TEMPLATE_BATCH_SIZE = 8;

function normalizeTemplateQueryNumber(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function templateMatchesCategory(template: { primaryCategory?: string; category?: string }, activeCategory: string) {
  if (!activeCategory || activeCategory === "全部") {
    return true;
  }
  return (template.primaryCategory || template.category) === activeCategory;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const offset = normalizeTemplateQueryNumber(url.searchParams.get("offset"), 0);
  const requestedLimit = normalizeTemplateQueryNumber(url.searchParams.get("limit"), TEMPLATE_BATCH_SIZE);
  const limit = Math.max(0, Math.min(requestedLimit, TEMPLATE_BATCH_SIZE));
  const category = url.searchParams.get("category")?.trim() || "全部";
  const matchedTemplates = insuranceShowcaseTemplates.filter((template) => templateMatchesCategory(template, category));
  const batchTemplates = matchedTemplates.slice(offset, offset + limit);

  return NextResponse.json(
    {
      templates: batchTemplates,
      total: matchedTemplates.length,
      offset,
      limit,
      hasMore: offset + batchTemplates.length < matchedTemplates.length,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=1800",
      },
    },
  );
}
