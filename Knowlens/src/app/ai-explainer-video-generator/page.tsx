import type { Metadata } from "next";
import { FocusedLandingPage } from "@/components/marketing/FocusedLandingPage";

const siteUrl = "https://knowlens.ai";
const pageUrl = `${siteUrl}/ai-explainer-video-generator`;

export const metadata: Metadata = {
  title: "AI Explainer Videos for YouTube & TikTok Creators | KnowLens",
  description:
    "Create AI explainer videos from scripts, articles, and ideas for YouTube Shorts, TikTok, Reels, and educational content.",
  keywords: [
    "AI explainer videos",
    "AI explainer video generator",
    "YouTube Shorts video generator",
    "TikTok explainer videos",
    "educational video maker",
    "script to video AI",
    "visual explainer video",
  ],
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    type: "website",
    url: pageUrl,
    siteName: "KnowLens.ai",
    title: "AI Explainer Videos for YouTube & TikTok Creators",
    description:
      "Turn scripts, topics, and articles into visual explainer videos for YouTube Shorts, TikTok, and learning content.",
    images: [
      {
        url: `${siteUrl}/picture/explainer-videos-hero.jpg`,
        width: 1003,
        height: 565,
        alt: "KnowLens.ai explainer video generator preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Explainer Videos for YouTube & TikTok Creators",
    description:
      "Create visual explainer videos from scripts and ideas for YouTube Shorts, TikTok, and educational content.",
    images: [`${siteUrl}/picture/explainer-videos-hero.jpg`],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "KnowLens AI Explainer Video Generator",
  url: pageUrl,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web",
  description:
    "Create AI explainer videos from scripts, articles, and ideas for YouTube Shorts, TikTok, Reels, and educational content.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  audience: {
    "@type": "Audience",
    audienceType: "YouTube creators, TikTok creators, educators, and knowledge creators",
  },
};

export default function AiExplainerVideoGeneratorPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <FocusedLandingPage />
    </>
  );
}
