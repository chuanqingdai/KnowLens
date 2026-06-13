import { NextResponse } from "next/server";
import { getAstronomyInfographicTemplates } from "@/lib/astronomy-infographic-templates";
import { getBiologyInfographicTemplates } from "@/lib/biology-infographic-templates";
import { getComparisonInfographicTemplates } from "@/lib/comparison-infographic-templates";
import { getEarthScienceInfographicTemplates } from "@/lib/earth-science-infographic-templates";
import { getFinanceInfographicTemplates } from "@/lib/finance-infographic-templates";
import { getHistoryInfographicTemplates } from "@/lib/history-infographic-templates";
import { getIndustryReportTemplates } from "@/lib/industry-report-templates";
import { getInsuranceInfographicTemplates } from "@/lib/insurance-infographic-templates";
import { getProcessInfographicTemplates } from "@/lib/process-infographic-templates";
import { getRecipeInfographicTemplates } from "@/lib/recipe-infographic-templates";
import { getSexEducationInfographicTemplates } from "@/lib/sex-education-infographic-templates";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function GET() {
  const templates = [
    ...getBiologyInfographicTemplates(),
    ...getProcessInfographicTemplates().filter(
      (template) => template.generationStatus === "success",
    ),
    ...getRecipeInfographicTemplates().filter(
      (template) => template.generationStatus === "success",
    ),
    ...getHistoryInfographicTemplates().filter(
      (template) => template.generationStatus === "success",
    ),
    ...getEarthScienceInfographicTemplates().filter(
      (template) => template.generationStatus === "success",
    ),
    ...getAstronomyInfographicTemplates().filter(
      (template) => template.generationStatus === "success",
    ),
    ...getSexEducationInfographicTemplates().filter(
      (template) => template.generationStatus === "success",
    ),
    ...getInsuranceInfographicTemplates().filter(
      (template) => template.generationStatus === "success",
    ),
    ...getFinanceInfographicTemplates().filter(
      (template) => template.generationStatus === "success",
    ),
    ...getComparisonInfographicTemplates().filter(
      (template) => template.generationStatus === "success",
    ),
    ...getIndustryReportTemplates().filter(
      (template) => template.generationStatus === "success",
    ),
  ];
  const urls = templates
    .map((template) => {
      return [
        "  <url>",
        `    <loc>${escapeXml(template.canonicalUrl)}</loc>`,
        `    <lastmod>${escapeXml(template.updatedAt)}</lastmod>`,
        "    <image:image>",
        `      <image:loc>${escapeXml(template.previewImageUrl)}</image:loc>`,
        `      <image:title>${escapeXml(template.imageTitle)}</image:title>`,
        `      <image:caption>${escapeXml(template.imageDescription || template.imageCaption)}</image:caption>`,
        "    </image:image>",
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    urls,
    "</urlset>",
  ].join("\n");

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
