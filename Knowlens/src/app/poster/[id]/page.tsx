"use client";

import { CaseDetailRoute } from "@/components/featured/CaseDetailRoute";

type PosterDetailPageProps = {
  params: {
    id: string;
  };
};

export default function PosterDetailPage({ params }: PosterDetailPageProps) {
  return <CaseDetailRoute slug={params.id} kind="poster" />;
}
