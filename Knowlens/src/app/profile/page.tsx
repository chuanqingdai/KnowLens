"use client";

import { BadgeCheck, FolderOpen, Home as HomeIcon, ReceiptText, UserCircle2, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { SidebarNav } from "@/components/app-shell/SidebarNav";

const navItems = [
  { label: "Home", icon: HomeIcon, href: "/app" },
  { label: "Projects", icon: FolderOpen, href: "/projects" },
  { label: "Profile", icon: UserCircle2, href: "/profile" },
];

const quickStats = [
  { label: "Projects this month", value: "18" },
  { label: "Exports completed", value: "42" },
  { label: "Account credits", value: "80" },
];

export default function ProfilePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#f7f7f8] text-zinc-900">
      <SidebarNav items={navItems} />
      <main className="px-4 pb-10 pt-6 sm:px-6 md:pl-[6.5rem] lg:px-12 lg:pl-[7.5rem]">
        <div className="mx-auto max-w-5xl">
          <header className="mb-5">
            <div>
              <p className="text-sm text-zinc-500">KnowLens.ai</p>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Profile</h1>
            </div>
          </header>

          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
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

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
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
