"use client";

import { CaseDetailRoute } from "@/components/featured/CaseDetailRoute";

type PptDetailPageProps = {
  params: {
    id: string;
  };
};

export default function PptDetailPage({ params }: PptDetailPageProps) {
  return <CaseDetailRoute slug={params.id} kind="ppt" />;
}
