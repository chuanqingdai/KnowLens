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
    date: "June 6, 2026",
    title: "Video Motion and Style Layouts",
    cadence: "Live",
    desc: "Video creation and visual style generation were refined for smoother outputs and more consistent multi-image layouts.",
    items: [
      "Videos now support scene transition motion effects for a more polished viewing experience.",
      "Optimized the layouts across 12 visual styles so multi-image results feel more unified.",
    ],
  },
  {
    date: "June 5, 2026",
    title: "Official Launch",
    cadence: "Live",
    desc: "KnowLens.ai is now officially live. It helps users turn ideas, notes, and source materials into visual outputs for learning, teaching, and communication.",
    items: [
      "Create infographic posters, slide decks, and storyboard-style video breakdowns from a single topic or prompt.",
      "Generate structured drafts, visual plans, and image outputs with multi-model support across language and image workflows.",
      "Work from text, uploaded materials, or links, then manage projects, credits, exports, and history in one workspace.",
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
            <p className="mt-1 text-sm text-zinc-600">Launch Notes</p>
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
