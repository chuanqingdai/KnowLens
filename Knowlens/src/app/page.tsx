import type { Metadata } from "next";
import LandingPage from "./landing/page";

const siteUrl = "https://knowlens.ai";

export const metadata: Metadata = {
  title: "KnowLens.ai | AI Infographic Generator for Posters, Slides & Videos",
  description:
    "Turn text, documents, videos, and podcasts into infographic posters, slides, and explainer videos — making knowledge easier to understand and share.",
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "KnowLens.ai",
    title: "KnowLens.ai | AI Infographic Generator for Posters, Slides & Videos",
    description:
      "Turn text, documents, videos, and podcasts into infographic posters, slides, and explainer videos — making knowledge easier to understand and share.",
    images: [
      {
        url: `${siteUrl}/picture/knowlens-hero.png`,
        width: 1600,
        height: 900,
        alt: "KnowLens.ai hero preview",
      },
    ],
  },
};

export default LandingPage;
