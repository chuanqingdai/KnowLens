import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getInfographicDirectoryPageData,
  InfographicDirectoryPage,
} from "@/components/infographic/InfographicDirectoryPage";

export function generateMetadata(): Metadata {
  return getInfographicDirectoryPageData("history")?.metadata || {};
}

export default function HistoryInfographicDirectoryPage() {
  const data = getInfographicDirectoryPageData("history");
  if (!data) {
    notFound();
  }
  return <InfographicDirectoryPage slug="history" />;
}
