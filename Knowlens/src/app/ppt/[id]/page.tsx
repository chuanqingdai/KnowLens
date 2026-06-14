import { CaseDetailRoute } from "@/components/featured/CaseDetailRoute";
import { getInfographicDetailPath } from "@/lib/infographic-paths";
import { getPublishedCaseByDisplaySlug } from "@/lib/server/published-cases";
import { permanentRedirect } from "next/navigation";

type PptDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PptDetailPage({ params }: PptDetailPageProps) {
  const resolved = await params;
  const publicCase = await getPublishedCaseByDisplaySlug(resolved.id, "ppt");
  if (publicCase) {
    permanentRedirect(
      getInfographicDetailPath({
        category: publicCase.category,
        slug: publicCase.slug,
      }) || `/cases/${encodeURIComponent(publicCase.slug)}`,
    );
  }
  return <CaseDetailRoute slug={resolved.id} kind="ppt" />;
}
