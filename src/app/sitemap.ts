import type { MetadataRoute } from "next";

const siteUrl = "https://knowlens.ai";

const publicRoutes = [
  "/",
  "/membership",
  "/app",
  "/blog",
  "/privacy",
  "/terms",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return publicRoutes.map((route) => ({
    url: `${siteUrl}${route === "/" ? "" : route}`,
    lastModified: now,
    changeFrequency: route === "/" || route === "/app" ? "daily" : "weekly",
    priority: route === "/" || route === "/app" ? 1 : 0.8,
  }));
}
