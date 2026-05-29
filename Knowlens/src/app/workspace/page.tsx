"use client";

import dynamic from "next/dynamic";

const WorkspacePageClient = dynamic(() => import("./WorkspacePageClient"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 overflow-hidden bg-[#f7f7f8] text-zinc-800" />,
});

export default function WorkspacePage() {
  return <WorkspacePageClient />;
}
