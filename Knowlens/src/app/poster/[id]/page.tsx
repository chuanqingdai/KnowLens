import { CaseDetailRoute } from "@/components/featured/CaseDetailRoute";
import { getInfographicDetailPath } from "@/lib/infographic-paths";
import { getPublishedCaseByDisplaySlug } from "@/lib/server/published-cases";
import { permanentRedirect } from "next/navigation";

type PosterDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PosterDetailPage({ params }: PosterDetailPageProps) {
  const resolved = await params;
  const publicCase = await getPublishedCaseByDisplaySlug(resolved.id, "poster");
  if (publicCase) {
    permanentRedirect(
      getInfographicDetailPath({
        category: publicCase.category,
        slug: publicCase.slug,
      }) || `/cases/${encodeURIComponent(publicCase.slug)}`,
    );
  }
  return <CaseDetailRoute slug={resolved.id} kind="poster" />;
}
