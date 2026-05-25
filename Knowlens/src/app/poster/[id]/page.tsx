"use client";

import { CaseDetailRoute } from "@/components/featured/CaseDetailRoute";

type PosterDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PosterDetailPage({ params }: PosterDetailPageProps) {
  const resolved = await params;
  return <CaseDetailRoute slug={resolved.id} kind="poster" />;
}
