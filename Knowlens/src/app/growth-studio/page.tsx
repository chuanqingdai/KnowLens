"use client";

import { useState } from "react";
import { ArrowRight, FolderOpen, Home as HomeIcon, Menu, TrendingUp, UserCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { SidebarNav } from "@/components/app-shell/SidebarNav";

const navItems = [
  { label: "Home", icon: HomeIcon, href: "/app" },
  { label: "Projects", icon: FolderOpen, href: "/projects" },
  { label: "Growth Studio", icon: TrendingUp, href: "/growth-studio" },
  { label: "Profile", icon: UserCircle2, href: "/profile" },
];

const valueProps = [
  {
    title: "Publish more from one idea",
    description:
      "Turn one Workflow into posters, short videos, captions, and descriptions for YouTube, TikTok, Instagram, and LinkedIn.",
  },
  {
    title: "Save planning time every week",
    description:
      "Keep a steady content rhythm around a long-term direction instead of rebuilding your plan from scratch.",
  },
  {
    title: "Grow a reusable content library",
    description:
      "Keep generated assets connected to KnowLens Projects, so strong content stays organized and easy to repurpose.",
  },
];

export default function GrowthStudioPage() {
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
            <div>
              <p className="text-sm text-zinc-500">KnowLens.ai</p>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Growth Studio</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600">
                Create repeatable workflows that turn ideas, content, and Projects into publish-ready assets.
              </p>
            </div>
          </header>

          <section className="rounded-2xl border border-zinc-200 bg-white px-5 py-12 shadow-[0_10px_25px_rgba(15,23,42,0.04)] sm:px-8 sm:py-14 lg:px-10">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 ring-1 ring-violet-200">
                <TrendingUp size={20} />
              </div>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
                Build a repeatable content engine from one idea
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-zinc-600">
                Create one Workflow to produce more publish-ready content, save planning time, and keep every asset connected to your KnowLens Projects.
              </p>
              <div className="mt-12">
                <button
                  type="button"
                  onClick={() => router.push("/growth-studio/create")}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-zinc-950 px-6 text-sm font-medium text-white shadow-[0_12px_24px_rgba(15,23,42,0.16)] transition hover:bg-zinc-800 active:translate-y-px"
                >
                  Create workflow
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>

            <div className="mt-12 grid gap-7 border-t border-zinc-200 pt-9 md:grid-cols-3">
              {valueProps.map((item, index) => {
                return (
                  <div key={item.title}>
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white">
                      {index + 1}
                    </div>
                    <h3 className="mt-3 text-sm font-semibold leading-5 text-zinc-950">{item.title}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-zinc-600">{item.description}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
