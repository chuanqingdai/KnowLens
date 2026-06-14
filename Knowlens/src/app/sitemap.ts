import type { MetadataRoute } from "next";
import { getAstronomyInfographicTemplates } from "@/lib/astronomy-infographic-templates";
import { getBiologyInfographicTemplates } from "@/lib/biology-infographic-templates";
import { getComparisonInfographicTemplates } from "@/lib/comparison-infographic-templates";
import { getEarthScienceInfographicTemplates } from "@/lib/earth-science-infographic-templates";
import { getFinanceInfographicTemplates } from "@/lib/finance-infographic-templates";
import { getHistoryInfographicTemplates } from "@/lib/history-infographic-templates";
import { buildPublishedCaseImageSeo } from "@/lib/infographic-seo-backfill";
import { getIndustryReportTemplates } from "@/lib/industry-report-templates";
import { getInsuranceInfographicTemplates } from "@/lib/insurance-infographic-templates";
import { getProcessInfographicTemplates } from "@/lib/process-infographic-templates";
import { getRecipeInfographicTemplates } from "@/lib/recipe-infographic-templates";
import { getRoadmapInfographicTemplates } from "@/lib/roadmap-infographic-templates";
import { getSexEducationInfographicTemplates } from "@/lib/sex-education-infographic-templates";
import { getInfographicDirectorySlugs, getInfographicDirectoryUrl } from "@/lib/infographic-directories";
import { listPublishedCases } from "@/lib/server/published-cases";

const siteUrl = "https://knowlens.ai";

const publicRoutes = [
  "/",
  "/membership",
  "/blog",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
  "/ai-infographic-generator",
  "/text-to-infographic",
  "/infographic-maker",
  "/science-infographic-generator",
  "/biology-infographic-generator",
  "/earth-science-infographic-generator",
  "/educational-infographic-maker",
  "/process-infographic-generator",
  "/recipe-infographic-maker",
  "/infographic-examples",
  "/ai-poster-generator",
  "/ai-carousel-generator",
  "/ai-explainer-videos",
  "/ai-video-generator",
  "/text-to-video-ai",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = publicRoutes.map((route) => ({
    url: `${siteUrl}${route === "/" ? "" : route}`,
    lastModified: now,
    changeFrequency: route === "/" ? "daily" : "weekly",
    priority: route === "/" ? 1 : 0.8,
  }));
  const directoryEntries: MetadataRoute.Sitemap = getInfographicDirectorySlugs().map((slug) => ({
    url: getInfographicDirectoryUrl(slug),
    lastModified: now,
    changeFrequency: "weekly",
    priority: slug === "history" || slug === "science" || slug === "biology" ? 0.8 : 0.7,
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
    const financeEntries: MetadataRoute.Sitemap = getFinanceInfographicTemplates()
      .filter((template) => template.generationStatus === "success")
      .map((template) => ({
        url: template.canonicalUrl,
        lastModified: new Date(template.updatedAt),
        changeFrequency: "monthly",
        priority: 0.7,
        images: [template.previewImageUrl],
      }));
    const comparisonEntries: MetadataRoute.Sitemap = getComparisonInfographicTemplates()
      .filter((template) => template.generationStatus === "success")
      .map((template) => ({
        url: template.canonicalUrl,
        lastModified: new Date(template.updatedAt),
        changeFrequency: "monthly",
        priority: 0.7,
        images: [template.previewImageUrl],
      }));
    const industryReportEntries: MetadataRoute.Sitemap = getIndustryReportTemplates()
      .filter((template) => template.generationStatus === "success")
      .map((template) => ({
        url: template.canonicalUrl,
        lastModified: new Date(template.updatedAt),
        changeFrequency: "monthly",
        priority: 0.7,
        images: [template.previewImageUrl],
      }));
    const roadmapEntries: MetadataRoute.Sitemap = getRoadmapInfographicTemplates()
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
      ...directoryEntries,
      ...biologyEntries,
      ...processEntries,
      ...recipeEntries,
      ...historyEntries,
      ...earthScienceEntries,
      ...astronomyEntries,
      ...sexEducationEntries,
      ...insuranceEntries,
      ...financeEntries,
      ...comparisonEntries,
      ...industryReportEntries,
      ...roadmapEntries,
      ...caseEntries,
    ];
  } catch {
    return [
      ...staticEntries,
      ...directoryEntries,
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
      ...getFinanceInfographicTemplates()
        .filter((template) => template.generationStatus === "success")
        .map((template) => ({
          url: template.canonicalUrl,
          lastModified: new Date(template.updatedAt),
          changeFrequency: "monthly" as const,
          priority: 0.7,
          images: [template.previewImageUrl],
        })),
      ...getComparisonInfographicTemplates()
        .filter((template) => template.generationStatus === "success")
        .map((template) => ({
          url: template.canonicalUrl,
          lastModified: new Date(template.updatedAt),
          changeFrequency: "monthly" as const,
          priority: 0.7,
          images: [template.previewImageUrl],
        })),
      ...getIndustryReportTemplates()
        .filter((template) => template.generationStatus === "success")
        .map((template) => ({
          url: template.canonicalUrl,
          lastModified: new Date(template.updatedAt),
          changeFrequency: "monthly" as const,
          priority: 0.7,
          images: [template.previewImageUrl],
        })),
      ...getRoadmapInfographicTemplates()
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
