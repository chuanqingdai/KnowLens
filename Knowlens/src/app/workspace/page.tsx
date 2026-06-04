import WorkspacePageClient from "./WorkspacePageClient";

type WorkspacePageProps = {
  searchParams?: Promise<{
    projectId?: string | string[];
  }>;
};

function pickProjectId(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() || "";
  }
  return value?.trim() || "";
}

export default async function WorkspacePage({ searchParams }: WorkspacePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const projectId = pickProjectId(resolvedSearchParams?.projectId) || "__workspace__";
  return <WorkspacePageClient key={projectId} />;
}
