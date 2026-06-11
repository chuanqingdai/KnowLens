import type { Metadata } from "next";
import LandingPage from "../landing/page";

const siteUrl = "https://knowlens.ai";

export const metadata: Metadata = {
  title: "KnowLens Original Homepage",
  description:
    "Original KnowLens homepage preserved for rollback, comparison screenshots, and future landing page testing.",
  alternates: {
    canonical: `${siteUrl}/home-original`,
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default LandingPage;
