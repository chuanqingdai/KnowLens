"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { MessageSquare, Shield, Sparkles, X, type LucideIcon } from "lucide-react";
import { useSession } from "next-auth/react";
import { resolveRoleByEmail } from "@/lib/auth";

type NavItem = {
  label: string;
  icon: LucideIcon;
  href: string;
};

type SidebarNavProps = {
  items: NavItem[];
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export function SidebarNav({ items, mobileOpen = false, onMobileClose }: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = useMemo(() => {
    const email = session?.user?.email ?? "";
    return resolveRoleByEmail(email) === "admin";
  }, [session?.user?.email]);

  return (
    <>
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[84px] border-r border-zinc-200/85 bg-white/94 md:flex md:flex-col md:items-center md:py-5">
        <button
          type="button"
          aria-label="KnowLens.ai"
          title="KnowLens.ai"
          onClick={() => router.push("/app")}
          className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:bg-zinc-100"
        >
          <Image
            src="/logo.png?v=20260524"
            alt="KnowLens.ai"
            width={28}
            height={28}
            unoptimized
            className="h-7 w-7 object-contain"
          />
        </button>

        <nav className="space-y-2">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <div key={item.label} className="group relative">
                <button
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
                <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 rounded-md bg-zinc-900 px-2 py-1 text-[11px] text-white opacity-0 shadow-md transition group-hover:opacity-100">
                  {item.label}
                </span>
              </div>
            );
          })}
        </nav>

        {isAdmin ? (
          <div className="group relative mt-2">
            <button
              type="button"
              onClick={() => router.push("/admin")}
              aria-label="Admin"
              title="Admin"
              className={`flex h-11 w-11 items-center justify-center rounded-xl transition ${
                pathname.startsWith("/admin")
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              <Shield size={17} />
            </button>
            <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 rounded-md bg-zinc-900 px-2 py-1 text-[11px] text-white opacity-0 shadow-md transition group-hover:opacity-100">
              Admin
            </span>
          </div>
        ) : null}

        <div className="mt-auto flex flex-col items-center gap-2">
          <div className="group relative">
            <button
              type="button"
              aria-label="Feedback"
              title="Feedback"
              onClick={() => router.push("/feedback")}
              className={`flex h-11 w-11 items-center justify-center rounded-xl transition ${
                pathname.startsWith("/feedback")
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              <MessageSquare size={17} />
            </button>
            <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 rounded-md bg-zinc-900 px-2 py-1 text-[11px] text-white opacity-0 shadow-md transition group-hover:opacity-100">
              Feedback
            </span>
          </div>
          <div className="group relative">
            <button
              type="button"
              aria-label="Updates"
              title="Updates"
              onClick={() => router.push("/upgrades")}
              className={`flex h-11 w-11 items-center justify-center rounded-xl transition ${
                pathname.startsWith("/upgrades")
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              <Sparkles size={17} />
            </button>
            <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 rounded-md bg-zinc-900 px-2 py-1 text-[11px] text-white opacity-0 shadow-md transition group-hover:opacity-100">
              Updates
            </span>
          </div>
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-zinc-900/40"
            onClick={onMobileClose}
          />
          <aside className="absolute left-0 top-0 flex h-full w-[82vw] max-w-[300px] flex-col border-r border-zinc-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-4">
              <button
                type="button"
                aria-label="KnowLens.ai"
                title="KnowLens.ai"
                onClick={() => {
                  onMobileClose?.();
                  router.push("/app");
                }}
                className="flex items-center gap-3"
              >
                <Image
                  src="/logo.png?v=20260524"
                  alt="KnowLens.ai"
                  width={30}
                  height={30}
                  unoptimized
                  className="h-8 w-8 object-contain"
                />
                <span className="text-sm font-semibold text-zinc-900">KnowLens.ai</span>
              </button>
              <button
                type="button"
                onClick={onMobileClose}
                aria-label="Close navigation"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700"
              >
                <X size={16} />
              </button>
            </div>

            <nav className="flex-1 px-3 py-3">
              <div className="space-y-1.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        onMobileClose?.();
                        router.push(item.href);
                      }}
                      className={`flex h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${
                        isActive
                          ? "bg-zinc-900 text-white"
                          : "text-zinc-700 hover:bg-zinc-100"
                      }`}
                    >
                      <Icon size={17} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </nav>

            <div className="border-t border-zinc-200 px-3 py-3">
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => {
                    onMobileClose?.();
                    router.push("/admin");
                  }}
                  className={`flex h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${
                    pathname.startsWith("/admin")
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  <Shield size={17} />
                  <span>Admin</span>
                </button>
              ) : null}
            </div>

            <div className="border-t border-zinc-200 px-3 py-3">
              <button
                type="button"
                onClick={() => {
                  onMobileClose?.();
                  router.push("/feedback");
                }}
                className={`flex h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${
                  pathname.startsWith("/feedback")
                    ? "bg-zinc-100 text-zinc-900"
                    : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                <MessageSquare size={17} />
                <span>Feedback</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onMobileClose?.();
                  router.push("/upgrades");
                }}
                className={`mt-1 flex h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${
                  pathname.startsWith("/upgrades")
                    ? "bg-zinc-100 text-zinc-900"
                    : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                <Sparkles size={17} />
                <span>Updates</span>
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
