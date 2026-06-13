"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, FolderOpen, Home as HomeIcon, Menu, ReceiptText, UserCircle2, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { SidebarNav } from "@/components/app-shell/SidebarNav";

const navItems = [
  { label: "Home", icon: HomeIcon, href: "/app" },
  { label: "Projects", icon: FolderOpen, href: "/projects" },
  { label: "Profile", icon: UserCircle2, href: "/profile" },
];

type ProjectsResponse = {
  projects?: Array<{ id?: string }>;
};

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [projectCount, setProjectCount] = useState<number | null>(null);
  const currentEmail = session?.user?.email?.trim().toLowerCase() ?? "";

  useEffect(() => {
    let cancelled = false;

    async function loadProjectCount() {
      if (sessionStatus === "loading") {
        return;
      }
      if (!currentEmail) {
        setProjectCount(0);
        return;
      }
      try {
        const response = await fetch("/api/projects", { cache: "no-store" });
        const payload = (await response.json()) as ProjectsResponse;
        if (!cancelled) {
          setProjectCount(Array.isArray(payload.projects) ? payload.projects.length : 0);
        }
      } catch {
        if (!cancelled) {
          setProjectCount(0);
        }
      }
    }

    void loadProjectCount();
    return () => {
      cancelled = true;
    };
  }, [currentEmail, sessionStatus]);

  const quickStats = useMemo(
    () => [
      { label: "Projects", value: projectCount === null ? "—" : String(projectCount) },
      { label: "Exports completed", value: "42" },
      { label: "Account credits", value: "80" },
    ],
    [projectCount],
  );

  return (
    <div className="min-h-screen bg-[#f7f7f8] text-zinc-900">
      <SidebarNav
        items={navItems}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      <main className="px-3 pb-10 pt-4 sm:px-6 sm:pt-6 md:pl-[6.5rem] lg:px-12 lg:pl-[7.5rem]">
        <div className="mx-auto max-w-5xl">
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
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Profile</h1>
            </div>
          </header>

          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2d8cff] text-white">
                  <UserCircle2 size={22} />
                </div>
                <div>
                  <p className="text-base font-semibold text-zinc-900">daichuanqing</p>
                  <p className="text-sm text-zinc-500">Science content creator</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push("/membership")}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-zinc-900 px-3.5 text-sm font-medium text-white hover:bg-zinc-700"
              >
                <ReceiptText size={15} />
                Billing Center
              </button>
            </div>

            <div className="mt-4 grid gap-2 grid-cols-1 sm:grid-cols-3">
              {quickStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3"
                >
                  <p className="text-xs text-zinc-500">{stat.label}</p>
                  <p className="mt-1 text-lg font-semibold text-zinc-900">{stat.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => router.push("/membership/subscription")}
              className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-left shadow-sm hover:bg-zinc-50"
            >
              <span className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900">
                <BadgeCheck size={15} />
                Subscription Status
              </span>
              <span className="text-xs text-zinc-500">View</span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/membership/credits")}
              className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-left shadow-sm hover:bg-zinc-50"
            >
              <span className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900">
                <Zap size={15} />
                Credit History
              </span>
              <span className="text-xs text-zinc-500">Manage</span>
            </button>
          </section>
        </div>
      </main>
    </div>
  );
}
