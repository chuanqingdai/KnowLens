"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, FileText, FolderOpen, Home as HomeIcon, Layers3, Menu, Send, TrendingUp, UserCircle2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { SidebarNav } from "@/components/app-shell/SidebarNav";

type GrowthWorkflow = {
  id: string;
  name: string;
  createdAt: string;
  contentDirection: string;
  contentThemes: string[];
  selectedChannels: string[];
  assetTypes: string[];
  contentSourceStrategy: {
    type: "theme" | "topics" | "text" | "trends";
    summary: string;
    userTopics: string[];
    existingText: string;
  };
  topicQueue: Array<{ id: string; topic: string; status: "Draft" | "Queued" | "Used" | "Skipped" | "Archived" }>;
  workflowRun: {
    id: string;
    status: "Draft created";
    contentBrief: {
      topic: string;
      angle: string;
      hook: string;
      audience: string;
      keyPoints: string[];
      suggestedAssetType: string;
      suggestedPlatform: string;
      sourceNotes: string;
      riskNotes: string;
    };
    contentDraftPack: {
      headline: string;
      hook: string;
      shortExplanation: string;
      posterOutline: string[];
      videoScript: string;
      sceneOutline: string[];
      socialPostDrafts: string[];
      seoTitle: string;
      seoDescription: string;
      hashtags: string[];
      cta: string;
    };
    projectAssets: Array<{ type: string; title: string; source: "Content draft pack" }>;
    publicationDrafts: Array<{ channel: string; title: string; source: "Content draft pack" }>;
  };
};

const navItems = [
  { label: "Home", icon: HomeIcon, href: "/app" },
  { label: "Projects", icon: FolderOpen, href: "/projects" },
  { label: "Growth Studio", icon: TrendingUp, href: "/growth-studio" },
  { label: "Profile", icon: UserCircle2, href: "/profile" },
];

const storageKey = "knowlens_growth_workflows_v1";

export default function WorkflowDetailPage() {
  const params = useParams<{ workflowId: string }>();
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [workflow, setWorkflow] = useState<GrowthWorkflow | null>(null);

  useEffect(() => {
    try {
      const rows = JSON.parse(window.localStorage.getItem(storageKey) || "[]") as GrowthWorkflow[];
      setWorkflow(rows.find((item) => item.id === params.workflowId) ?? null);
    } catch {
      setWorkflow(null);
    }
  }, [params.workflowId]);

  return (
    <div className="min-h-screen bg-[#f7f7f8] text-zinc-900">
      <SidebarNav
        items={navItems}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      <main className="px-3 pb-10 pt-4 sm:px-6 sm:pt-6 md:pl-[6.5rem] lg:px-12 lg:pl-[7.5rem]">
        <div className="mx-auto max-w-6xl">
          <div className="mb-3 md:hidden">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-300 bg-white text-zinc-700 transition hover:bg-zinc-100"
              aria-label="Open navigation"
              title="Open navigation"
            >
              <Menu size={15} />
            </button>
          </div>

          <header className="mb-5">
            <button
              type="button"
              onClick={() => router.push("/growth-studio")}
              className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-950"
            >
              <ArrowLeft size={15} />
              Growth Studio
            </button>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              {workflow?.name || "Workflow detail"}
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600">
              Content source, Topic queue, Content brief, draft pack, Project assets, and Publication drafts.
            </p>
          </header>

          {!workflow ? (
            <section className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
              Workflow not found. Create a new Workflow to preview the second-stage structure.
            </section>
          ) : (
            <div className="grid gap-4">
              <section className="grid gap-3 md:grid-cols-3">
                <InfoCard title="Content source" value={workflow.contentSourceStrategy.summary} icon={TrendingUp} />
                <InfoCard title="Content direction" value={workflow.contentDirection || "Not set"} icon={FileText} />
                <InfoCard title="Selected channels" value={workflow.selectedChannels.join(", ") || "None"} icon={Send} />
              </section>

              <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-zinc-950">Topic queue</h2>
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {workflow.topicQueue.map((topic) => (
                    <div key={topic.id} className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-2 ring-1 ring-zinc-200">
                      <span className="text-sm font-medium text-zinc-800">{topic.topic}</span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs text-zinc-600 ring-1 ring-zinc-200">
                        {topic.status}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid gap-4 lg:grid-cols-2">
                <Panel title="Content brief">
                  <SummaryRow label="Topic" value={workflow.workflowRun.contentBrief.topic} />
                  <SummaryRow label="Angle" value={workflow.workflowRun.contentBrief.angle} />
                  <SummaryRow label="Hook" value={workflow.workflowRun.contentBrief.hook} />
                  <SummaryRow label="Suggested asset" value={workflow.workflowRun.contentBrief.suggestedAssetType} />
                  <SummaryRow label="Suggested platform" value={workflow.workflowRun.contentBrief.suggestedPlatform} />
                  <SummaryRow label="Risk notes" value={workflow.workflowRun.contentBrief.riskNotes} />
                </Panel>

                <Panel title="Content draft pack">
                  <SummaryRow label="Headline" value={workflow.workflowRun.contentDraftPack.headline} />
                  <SummaryRow label="Short explanation" value={workflow.workflowRun.contentDraftPack.shortExplanation} />
                  <SummaryRow label="SEO title" value={workflow.workflowRun.contentDraftPack.seoTitle} />
                  <SummaryRow label="SEO description" value={workflow.workflowRun.contentDraftPack.seoDescription} />
                  <SummaryRow label="CTA" value={workflow.workflowRun.contentDraftPack.cta} />
                </Panel>
              </section>

              <section className="grid gap-4 lg:grid-cols-2">
                <Panel title="Project assets">
                  {workflow.workflowRun.projectAssets.map((asset) => (
                    <SummaryRow key={`${asset.type}-${asset.title}`} label={asset.type} value={`${asset.title} · from ${asset.source}`} />
                  ))}
                </Panel>

                <Panel title="Publication drafts">
                  {workflow.workflowRun.publicationDrafts.map((draft) => (
                    <SummaryRow key={`${draft.channel}-${draft.title}`} label={draft.channel} value={`${draft.title} · from ${draft.source}`} />
                  ))}
                </Panel>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function InfoCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: typeof TrendingUp;
}) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-800">
        <Icon size={17} />
      </div>
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</p>
      <p className="mt-1 text-sm leading-6 text-zinc-800">{value}</p>
    </article>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-zinc-950">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-sm leading-6 text-zinc-800">{value}</p>
    </div>
  );
}
