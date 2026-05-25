"use client";

import { CaseDetailRoute } from "@/components/featured/CaseDetailRoute";

type VideoDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function VideoDetailPage({ params }: VideoDetailPageProps) {
  const resolved = await params;
  return <CaseDetailRoute slug={resolved.id} kind="video" />;
}
