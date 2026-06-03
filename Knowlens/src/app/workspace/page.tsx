"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

const WorkspacePageClient = dynamic(() => import("./WorkspacePageClient"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 overflow-hidden bg-[#f7f7f8] text-zinc-800" />,
});

export default function WorkspacePage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId")?.trim() || "__workspace__";
  return <WorkspacePageClient key={projectId} />;
}
