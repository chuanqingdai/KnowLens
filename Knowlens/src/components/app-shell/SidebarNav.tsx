"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { MessageSquare, Shield, Sparkles, type LucideIcon } from "lucide-react";
import { useSession } from "next-auth/react";
import { resolveRoleByEmail } from "@/lib/auth";
import { useLocale } from "@/components/i18n/LocaleProvider";

type NavItem = {
  label: string;
  icon: LucideIcon;
  href: string;
};

type SidebarNavProps = {
  items: NavItem[];
};

export function SidebarNav({ items }: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocale();
  const { data: session } = useSession();
  const isAdmin = useMemo(() => {
    const email = session?.user?.email ?? "";
    return resolveRoleByEmail(email) === "admin";
  }, [session?.user?.email]);

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[84px] border-r border-zinc-200/85 bg-white/94 md:flex md:flex-col md:items-center md:py-5">
      <button
        type="button"
        aria-label="KnowLens.ai"
        title="KnowLens.ai"
        onClick={() => router.push("/")}
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
            aria-label={t("Admin", "管理后台")}
            title={t("Admin", "管理后台")}
            className={`flex h-11 w-11 items-center justify-center rounded-xl transition ${
              pathname.startsWith("/admin")
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            <Shield size={17} />
          </button>
          <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 rounded-md bg-zinc-900 px-2 py-1 text-[11px] text-white opacity-0 shadow-md transition group-hover:opacity-100">
            {t("Admin", "管理后台")}
          </span>
        </div>
      ) : null}

      <div className="mt-auto flex flex-col items-center gap-2">
        <div className="group relative">
          <button
            type="button"
            aria-label={t("Feedback", "用户反馈")}
            title={t("Feedback", "用户反馈")}
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
            {t("Feedback", "用户反馈")}
          </span>
        </div>
        <div className="group relative">
          <button
            type="button"
            aria-label={t("Updates", "功能升级")}
            title={t("Updates", "功能升级")}
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
            {t("Updates", "功能升级")}
          </span>
        </div>
      </div>
    </aside>
  );
}
