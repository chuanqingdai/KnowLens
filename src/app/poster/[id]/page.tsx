import { CaseDetailRoute } from "@/components/featured/CaseDetailRoute";
import { getPublishedCaseByDisplaySlug } from "@/lib/server/published-cases";
import { redirect } from "next/navigation";

type PosterDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PosterDetailPage({ params }: PosterDetailPageProps) {
  const resolved = await params;
  const publicCase = await getPublishedCaseByDisplaySlug(resolved.id, "poster");
  if (publicCase) {
    redirect(`/cases/${encodeURIComponent(publicCase.slug)}`);
  }
  return <CaseDetailRoute slug={resolved.id} kind="poster" />;
}
