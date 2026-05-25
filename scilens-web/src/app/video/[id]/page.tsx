"use client";

import { CaseDetailRoute } from "@/components/featured/CaseDetailRoute";

type VideoDetailPageProps = {
  params: {
    id: string;
  };
};

export default function VideoDetailPage({ params }: VideoDetailPageProps) {
  return <CaseDetailRoute slug={params.id} kind="video" />;
}
