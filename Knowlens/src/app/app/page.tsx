import type { Metadata } from "next";
import AppPageClient from "./AppPageClient";

const siteUrl = "https://knowlens.ai";

export const metadata: Metadata = {
  title: "KnowLens Workspace | Generate Posters, Slides & Storyboards",
  description:
    "Create infographic posters, PPT slides, and storyboard visuals from text, documents, webpages, videos, and podcasts in one workflow.",
  alternates: {
    canonical: `${siteUrl}/app`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/app`,
    siteName: "KnowLens.ai",
    title: "KnowLens Workspace | Generate Posters, Slides & Storyboards",
    description:
      "Create infographic posters, PPT slides, and storyboard visuals from text, documents, webpages, videos, and podcasts in one workflow.",
    images: [
      {
        url: `${siteUrl}/picture/knowlens-hero.png`,
        width: 1600,
        height: 900,
        alt: "KnowLens workspace preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KnowLens Workspace | Generate Posters, Slides & Storyboards",
    description:
      "Create infographic posters, PPT slides, and storyboard visuals from text, documents, webpages, videos, and podcasts in one workflow.",
    images: [`${siteUrl}/picture/knowlens-hero.png`],
  },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function AppPage() {
  return <AppPageClient />;
}
