import type { Metadata } from "next";
import LandingPage from "./landing/page";

const siteUrl = "https://knowlens.ai";

export const metadata: Metadata = {
  title: "KnowLens | AI Explainer Video, Infographic & Slide Generator",
  description:
    "KnowLens is an AI explainer video generator that turns text, scripts, articles, and ideas into visual learning videos, infographics, and slides in minutes.",
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "KnowLens.ai",
    title: "KnowLens | AI Explainer Video, Infographic & Slide Generator",
    description:
      "Turn text into visual explainer videos, infographics, and slides with KnowLens. Paste your content, choose a format, and create visual learning content in minutes.",
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
