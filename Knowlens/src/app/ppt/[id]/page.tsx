"use client";

import { CaseDetailRoute } from "@/components/featured/CaseDetailRoute";

type PptDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PptDetailPage({ params }: PptDetailPageProps) {
  const resolved = await params;
  return <CaseDetailRoute slug={resolved.id} kind="ppt" />;
}
