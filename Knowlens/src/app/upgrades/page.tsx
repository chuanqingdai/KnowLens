"use client";

import { useState } from "react";
import { FolderOpen, Home as HomeIcon, Menu, Sparkles, UserCircle2 } from "lucide-react";
import { SidebarNav } from "@/components/app-shell/SidebarNav";

const navItems = [
  { label: "Home", icon: HomeIcon, href: "/app" },
  { label: "My Projects", icon: FolderOpen, href: "/projects" },
  { label: "Profile", icon: UserCircle2, href: "/profile" },
];

const releaseTimeline = [
  {
    date: "May 24, 2026",
    title: "Feedback Workflow Upgrade",
    cadence: "Shipped",
    desc: "Submission history is now visible in-page, and admin-only replies are supported with clearer status tags.",
    items: [
      "Feedback records now persist with submitter alias and timeline order.",
      "Admin can reply directly from each feedback card.",
      "Reply status now appears as Open / Replied.",
    ],
  },
  {
    date: "May 22, 2026",
    title: "Homepage Model Picker Refresh",
    cadence: "Shipped",
    desc: "Language model options are now cleaner, membership-gated models are clearer, and mobile dropdown overflow is fixed.",
    items: [
      "Free defaults are locale-aware.",
      "Premium models show crown + PRO badges.",
      "Model dropdown now adapts to viewport space and scrolls on small screens.",
    ],
  },
  {
    date: "May 20, 2026",
    title: "Workspace and Canvas Interaction Polish",
    cadence: "Shipped",
    desc: "Core workspace flow and canvas ergonomics were refined for better readability, faster actions, and cleaner controls.",
    items: [
      "Improved poster/ppt preview focus and layout spacing.",
      "Action controls were simplified and grouped by intent.",
      "Multiple mobile interaction and overflow issues were resolved.",
    ],
  },
  {
    date: "Next 3-5 days",
    title: "Near-term Release Plan",
    cadence: "Planned",
    desc: "KnowLens.ai currently ships updates every few days. The next bundle focuses on reliability and export quality.",
    items: [
      "Stronger retry and fallback path for export failures.",
      "More transparent generation progress details during long jobs.",
      "Improved consistency across membership modal entry points.",
    ],
  },
];

export default function UpgradesPage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f7f7f8] text-zinc-900">
      <SidebarNav
        items={navItems}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      <main className="px-4 pb-10 pt-6 sm:px-6 md:pl-[6.5rem] lg:px-12 lg:pl-[7.5rem]">
        <div className="mx-auto max-w-4xl">
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
            <p className="text-sm text-zinc-500">KnowLens.ai</p>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Product Updates</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Timeline of recent releases and what is coming next. Updates are shipped every few days.
            </p>
          </header>

          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="relative space-y-4 pl-6">
              <div className="absolute bottom-2 left-[11px] top-2 w-px bg-zinc-200" />
              {releaseTimeline.map((item) => (
                <article key={`${item.date}-${item.title}`} className="relative py-1.5">
                  <span className="absolute -left-[18px] top-4 inline-flex h-4 w-4 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500">
                    <Sparkles size={10} />
                  </span>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{item.date}</p>
                  <h2 className="mt-1 text-sm font-semibold text-zinc-900">{item.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-zinc-600">{item.desc}</p>
                  <ul className="mt-2 space-y-1">
                    {item.items.map((entry) => (
                      <li key={entry} className="text-xs leading-5 text-zinc-600">
                        • {entry}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
