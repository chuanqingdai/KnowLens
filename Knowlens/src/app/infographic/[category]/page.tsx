import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getInfographicDirectoryPageData,
  InfographicDirectoryPage,
} from "@/components/infographic/InfographicDirectoryPage";
import { getInfographicDirectorySlugs } from "@/lib/infographic-directories";

type PageProps = {
  params: Promise<{ category: string }>;
};

export function generateStaticParams() {
  return getInfographicDirectorySlugs()
    .filter((slug) => slug !== "history")
    .map((category) => ({ category }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  return getInfographicDirectoryPageData(category)?.metadata || {};
}

export default async function InfographicCategoryDirectoryPage({ params }: PageProps) {
  const { category } = await params;
  const data = getInfographicDirectoryPageData(category);
  if (!data || category === "history") {
    notFound();
  }
  return <InfographicDirectoryPage slug={category} />;
}

