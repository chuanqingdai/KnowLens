import type { Metadata } from "next";
import MembershipPageClient from "./MembershipPageClient";

const siteUrl = "https://knowlens.ai";

export const metadata: Metadata = {
  title: "Pricing | KnowLens.ai Membership Plans",
  description:
    "Compare KnowLens.ai plans and choose credits for infographic posters, slides, and storyboard generation.",
  alternates: {
    canonical: `${siteUrl}/membership`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/membership`,
    siteName: "KnowLens.ai",
    title: "Pricing | KnowLens.ai Membership Plans",
    description:
      "Compare KnowLens.ai plans and choose credits for infographic posters, slides, and storyboard generation.",
    images: [
      {
        url: `${siteUrl}/picture/knowlens-hero.png`,
        width: 1600,
        height: 900,
        alt: "KnowLens pricing plans",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing | KnowLens.ai Membership Plans",
    description:
      "Compare KnowLens.ai plans and choose credits for infographic posters, slides, and storyboard generation.",
    images: [`${siteUrl}/picture/knowlens-hero.png`],
  },
};

export default function MembershipPage() {
  return <MembershipPageClient />;
}
