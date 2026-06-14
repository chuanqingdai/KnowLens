import type { MetadataRoute } from "next";

const siteUrl = "https://knowlens.ai";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/app",
          "/auth",
          "/workspace",
          "/projects",
          "/profile",
          "/home-original",
          "/landing",
        ],
      },
    ],
    sitemap: ["https://knowlens.ai/sitemap.xml"],
    host: siteUrl,
  };
}
