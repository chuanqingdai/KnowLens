"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CircleHelp, Shield, type LucideIcon } from "lucide-react";
import { getStoredAuthUser } from "@/lib/auth";

type NavItem = {
  label: string;
  icon: LucideIcon;
  href: string;
};

type SidebarNavProps = {
  items: NavItem[];
};

function ScilensMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.1" />
      <circle cx="8.2" cy="8.2" r="2.3" fill="currentColor" />
      <circle cx="15.8" cy="15.8" r="2.3" fill="currentColor" />
      <path
        d="M9.9 9.9L14.1 14.1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SidebarNav({ items }: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const [authUser] = useState(() => getStoredAuthUser());
  const isAdmin = authUser?.role === "admin";

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[84px] border-r border-zinc-200/85 bg-white/94 md:flex md:flex-col md:items-center md:py-5">
      <button
        type="button"
        aria-label="Scilens"
        title="Scilens"
        onClick={() => router.push("/")}
        className="mb-6 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white transition hover:bg-zinc-800"
      >
        <ScilensMark size={16} />
      </button>

      <nav className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => router.push(item.href)}
              aria-label={item.label}
              title={item.label}
              className={`flex h-11 w-11 items-center justify-center rounded-xl transition ${
                isActive ? "bg-zinc-100 text-zinc-900" : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              <Icon size={17} />
            </button>
          );
        })}
      </nav>

      {isAdmin ? (
        <button
          type="button"
          onClick={() => router.push("/admin")}
          aria-label="管理后台"
          title="管理后台"
          className={`mt-2 flex h-11 w-11 items-center justify-center rounded-xl transition ${
            pathname.startsWith("/admin")
              ? "bg-zinc-900 text-white"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          <Shield size={17} />
        </button>
      ) : null}

      <div className="relative mt-auto">
        {helpOpen ? (
          <div className="absolute bottom-0 left-full z-50 ml-2 w-40 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-[0_18px_35px_rgba(15,23,42,0.18)]">
            <button
              type="button"
              onClick={() => {
                router.push("/feedback");
                setHelpOpen(false);
              }}
              className="w-full rounded-lg px-2 py-2 text-left text-xs text-zinc-700 transition hover:bg-zinc-100"
            >
              用户反馈
            </button>
            <button
              type="button"
              onClick={() => {
                router.push("/upgrades");
                setHelpOpen(false);
              }}
              className="w-full rounded-lg px-2 py-2 text-left text-xs text-zinc-700 transition hover:bg-zinc-100"
            >
              功能升级
            </button>
          </div>
        ) : null}
        <button
          type="button"
          aria-label="帮助"
          title="帮助"
          onClick={() => setHelpOpen((prev) => !prev)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-600 transition hover:bg-zinc-100"
        >
          <CircleHelp size={16} />
        </button>
      </div>
    </aside>
  );
}
