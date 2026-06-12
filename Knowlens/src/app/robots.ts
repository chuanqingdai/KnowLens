import type { MetadataRoute } from "next";

const siteUrl = "https://knowlens.ai";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: ["https://knowlens.ai/sitemap.xml", "https://knowlens.ai/infographic-sitemap.xml"],
    host: siteUrl,
  };
}
