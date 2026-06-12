import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "AI Infographic and AI Video Generator | KnowLens.ai",
  description:
    "Turn topics, notes, and plain text into infographics, visual summaries, posters, carousel-style visuals, and short explainer videos with KnowLens.ai.",
  alternates: {
    canonical: "https://knowlens.ai/",
  },
  openGraph: {
    title: "AI Infographic and AI Video Generator | KnowLens.ai",
    description:
      "Turn topics, notes, and plain text into infographics, visual summaries, posters, carousel-style visuals, and short explainer videos with KnowLens.ai.",
    url: "https://knowlens.ai/",
    siteName: "KnowLens.ai",
    type: "website",
  },
};

export default function HomePage() {
  redirect("/ai-infographic-generator");
}
