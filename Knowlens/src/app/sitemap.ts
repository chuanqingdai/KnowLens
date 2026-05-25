import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://knowlens.ai";

const publicRoutes = [
  "",
  "/landing",
  "/membership",
  "/about",
  "/privacy",
  "/terms",
  "/contact",
  "/feedback",
  "/projects",
  "/profile",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return publicRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" || route === "/landing" ? "daily" : "weekly",
    priority: route === "" || route === "/landing" ? 1 : 0.7,
  }));
}
