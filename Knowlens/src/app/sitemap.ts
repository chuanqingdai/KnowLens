import type { MetadataRoute } from "next";
import { getAstronomyInfographicTemplates } from "@/lib/astronomy-infographic-templates";
import { getBiologyInfographicTemplates } from "@/lib/biology-infographic-templates";
import { getEarthScienceInfographicTemplates } from "@/lib/earth-science-infographic-templates";
import { getHistoryInfographicTemplates } from "@/lib/history-infographic-templates";
import { buildPublishedCaseImageSeo } from "@/lib/infographic-seo-backfill";
import { getInsuranceInfographicTemplates } from "@/lib/insurance-infographic-templates";
import { getProcessInfographicTemplates } from "@/lib/process-infographic-templates";
import { getRecipeInfographicTemplates } from "@/lib/recipe-infographic-templates";
import { getSexEducationInfographicTemplates } from "@/lib/sex-education-infographic-templates";
import { listPublishedCases } from "@/lib/server/published-cases";

const siteUrl = "https://knowlens.ai";

const publicRoutes = [
  "/",
  "/membership",
  "/app",
  "/blog",
  "/privacy",
  "/terms",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = publicRoutes.map((route) => ({
    url: `${siteUrl}${route === "/" ? "" : route}`,
    lastModified: now,
    changeFrequency: route === "/" || route === "/app" ? "daily" : "weekly",
    priority: route === "/" || route === "/app" ? 1 : 0.8,
  }));

  try {
    const cases = await listPublishedCases({ limit: 200, includeAssets: true, includeLatestVideoExportAssets: false });
    const biologyEntries: MetadataRoute.Sitemap = getBiologyInfographicTemplates().map((template) => ({
      url: template.canonicalUrl,
      lastModified: new Date(template.updatedAt),
      changeFrequency: "monthly",
      priority: 0.7,
      images: [template.previewImageUrl],
    }));
    const processEntries: MetadataRoute.Sitemap = getProcessInfographicTemplates()
      .filter((template) => template.generationStatus === "success")
      .map((template) => ({
        url: template.canonicalUrl,
        lastModified: new Date(template.updatedAt),
        changeFrequency: "monthly",
        priority: 0.7,
        images: [template.previewImageUrl],
      }));
    const recipeEntries: MetadataRoute.Sitemap = getRecipeInfographicTemplates()
      .filter((template) => template.generationStatus === "success")
      .map((template) => ({
        url: template.canonicalUrl,
        lastModified: new Date(template.updatedAt),
        changeFrequency: "monthly",
        priority: 0.7,
        images: [template.previewImageUrl],
      }));
    const historyEntries: MetadataRoute.Sitemap = getHistoryInfographicTemplates()
      .filter((template) => template.generationStatus === "success")
      .map((template) => ({
        url: template.canonicalUrl,
        lastModified: new Date(template.updatedAt),
        changeFrequency: "monthly",
        priority: 0.7,
        images: [template.previewImageUrl],
      }));
    const earthScienceEntries: MetadataRoute.Sitemap = getEarthScienceInfographicTemplates()
      .filter((template) => template.generationStatus === "success")
      .map((template) => ({
        url: template.canonicalUrl,
        lastModified: new Date(template.updatedAt),
        changeFrequency: "monthly",
        priority: 0.7,
        images: [template.previewImageUrl],
      }));
    const astronomyEntries: MetadataRoute.Sitemap = getAstronomyInfographicTemplates()
      .filter((template) => template.generationStatus === "success")
      .map((template) => ({
        url: template.canonicalUrl,
        lastModified: new Date(template.updatedAt),
        changeFrequency: "monthly",
        priority: 0.7,
        images: [template.previewImageUrl],
      }));
    const sexEducationEntries: MetadataRoute.Sitemap = getSexEducationInfographicTemplates()
      .filter((template) => template.generationStatus === "success")
      .map((template) => ({
        url: template.canonicalUrl,
        lastModified: new Date(template.updatedAt),
        changeFrequency: "monthly",
        priority: 0.7,
        images: [template.previewImageUrl],
      }));
    const insuranceEntries: MetadataRoute.Sitemap = getInsuranceInfographicTemplates()
      .filter((template) => template.generationStatus === "success")
      .map((template) => ({
        url: template.canonicalUrl,
        lastModified: new Date(template.updatedAt),
        changeFrequency: "monthly",
        priority: 0.7,
        images: [template.previewImageUrl],
      }));
    const caseEntries = cases
      .filter((item) => item.outputType !== "video")
      .map((item) => {
        const seo = buildPublishedCaseImageSeo(item);
        return {
          url: seo.canonicalUrl,
          lastModified: item.updatedAt ? new Date(item.updatedAt) : now,
          changeFrequency: "weekly" as const,
          priority: item.featured ? 0.8 : 0.7,
          images: seo.previewImageUrl && !seo.needsAssetTransfer ? [seo.previewImageUrl] : undefined,
        };
      });
    return [
      ...staticEntries,
      ...biologyEntries,
      ...processEntries,
      ...recipeEntries,
      ...historyEntries,
      ...earthScienceEntries,
      ...astronomyEntries,
      ...sexEducationEntries,
      ...insuranceEntries,
      ...caseEntries,
    ];
  } catch {
    return [
      ...staticEntries,
      ...getBiologyInfographicTemplates().map((template) => ({
        url: template.canonicalUrl,
        lastModified: new Date(template.updatedAt),
        changeFrequency: "monthly" as const,
        priority: 0.7,
        images: [template.previewImageUrl],
      })),
      ...getProcessInfographicTemplates()
        .filter((template) => template.generationStatus === "success")
        .map((template) => ({
          url: template.canonicalUrl,
          lastModified: new Date(template.updatedAt),
          changeFrequency: "monthly" as const,
          priority: 0.7,
          images: [template.previewImageUrl],
        })),
      ...getRecipeInfographicTemplates()
        .filter((template) => template.generationStatus === "success")
        .map((template) => ({
          url: template.canonicalUrl,
          lastModified: new Date(template.updatedAt),
          changeFrequency: "monthly" as const,
          priority: 0.7,
          images: [template.previewImageUrl],
        })),
      ...getHistoryInfographicTemplates()
        .filter((template) => template.generationStatus === "success")
        .map((template) => ({
          url: template.canonicalUrl,
          lastModified: new Date(template.updatedAt),
          changeFrequency: "monthly" as const,
          priority: 0.7,
          images: [template.previewImageUrl],
        })),
      ...getEarthScienceInfographicTemplates()
        .filter((template) => template.generationStatus === "success")
        .map((template) => ({
          url: template.canonicalUrl,
          lastModified: new Date(template.updatedAt),
          changeFrequency: "monthly" as const,
          priority: 0.7,
          images: [template.previewImageUrl],
        })),
      ...getAstronomyInfographicTemplates()
        .filter((template) => template.generationStatus === "success")
        .map((template) => ({
          url: template.canonicalUrl,
          lastModified: new Date(template.updatedAt),
          changeFrequency: "monthly" as const,
          priority: 0.7,
          images: [template.previewImageUrl],
        })),
      ...getSexEducationInfographicTemplates()
        .filter((template) => template.generationStatus === "success")
        .map((template) => ({
          url: template.canonicalUrl,
          lastModified: new Date(template.updatedAt),
          changeFrequency: "monthly" as const,
          priority: 0.7,
          images: [template.previewImageUrl],
        })),
      ...getInsuranceInfographicTemplates()
        .filter((template) => template.generationStatus === "success")
        .map((template) => ({
          url: template.canonicalUrl,
          lastModified: new Date(template.updatedAt),
          changeFrequency: "monthly" as const,
          priority: 0.7,
          images: [template.previewImageUrl],
        })),
    ];
  }
}
