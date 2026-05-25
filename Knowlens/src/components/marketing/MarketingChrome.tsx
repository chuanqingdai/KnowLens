"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LocaleSwitch } from "@/components/i18n/LocaleSwitch";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { usePathname, useRouter } from "next/navigation";

type MarketingChromeProps = {
  children: React.ReactNode;
  showLocaleSwitch?: boolean;
};

export function MarketingChrome({ children, showLocaleSwitch = false }: MarketingChromeProps) {
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function openMembershipModal() {
    const currentPath =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : pathname || "/";
    try {
      window.sessionStorage.setItem("membership:return-path", currentPath);
    } catch {
      // ignore storage errors
    }
    router.push("/membership");
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-zinc-900">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundColor: "#f6f7f9",
          backgroundImage:
            "linear-gradient(rgba(24,24,27,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(24,24,27,0.035) 1px, transparent 1px), linear-gradient(rgba(24,24,27,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(24,24,27,0.055) 1px, transparent 1px), radial-gradient(circle at 16% 18%, rgba(59,130,246,0.08), transparent 42%), radial-gradient(circle at 84% 26%, rgba(20,184,166,0.07), transparent 38%), radial-gradient(circle at 60% 74%, rgba(236,72,153,0.05), transparent 36%)",
          backgroundSize: "24px 24px, 24px 24px, 120px 120px, 120px 120px, auto, auto, auto",
          backgroundPosition: "0 0, 0 0, -1px -1px, -1px -1px, 0 0, 0 0, 0 0",
        }}
      />

      <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2" aria-label="Go to KnowLens.ai landing page">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white shadow-sm">
              <img
                src="/logo.png?v=202605241930"
                alt="KnowLens.ai"
                width={30}
                height={30}
                className="h-[30px] w-[30px] object-contain"
              />
            </span>
            <span className="text-sm font-semibold tracking-tight">KnowLens.ai</span>
          </Link>
          <div className="flex items-center gap-2">
            {showLocaleSwitch ? <LocaleSwitch /> : null}
            <button
              type="button"
              onClick={openMembershipModal}
              className="inline-flex h-9 items-center rounded-lg border border-zinc-300 bg-white px-3 text-xs text-zinc-700 hover:bg-zinc-100"
            >
              {t("Plans", "会员方案")}
            </button>
            <Link
              href="/auth?callbackUrl=%2Fapp"
              className="inline-flex h-9 items-center gap-1 rounded-lg bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-700"
            >
              {t("Start now", "开始使用")}
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">{children}</main>

      <footer className="relative z-10 border-t border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs text-zinc-500">© 2026 KnowLens.ai · All rights reserved</p>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-600">
            <Link href="/about" className="hover:text-zinc-900">
              {t("About", "关于")}
            </Link>
            <Link href="/privacy" className="hover:text-zinc-900">
              {t("Privacy", "隐私政策")}
            </Link>
            <Link href="/terms" className="hover:text-zinc-900">
              {t("Terms", "使用条款")}
            </Link>
            <Link href="/contact" className="hover:text-zinc-900">
              {t("Contact", "联系我们")}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
