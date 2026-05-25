"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { signIn } from "next-auth/react";
import { useLocale } from "@/components/i18n/LocaleProvider";

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="h-4 w-4 shrink-0" fill="none">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.643 32.657 29.257 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.042l5.657-5.657C34.041 6.053 29.297 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.042l5.657-5.657C34.041 6.053 29.297 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
      <path fill="#4CAF50" d="M24 44c5.192 0 9.839-1.991 13.36-5.228l-6.165-5.193C29.235 35.091 26.76 36 24 36c-5.236 0-9.608-3.315-11.3-7.946l-6.52 5.021C9.487 39.556 16.119 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-1.134 3.221-3.331 5.676-6.108 7.579l.002-.001 6.165 5.193C34.924 39.252 44 33 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
  );
}

export default function AuthPage() {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { t } = useLocale();
  const getAuthParams = () => {
    if (typeof window === "undefined") {
      return { authError: null as string | null, callbackUrl: "/app" };
    }
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("callbackUrl");
    if (raw && raw.startsWith("/") && !raw.startsWith("//")) {
      return { authError: params.get("error"), callbackUrl: raw };
    }
    return { authError: params.get("error"), callbackUrl: "/app" };
  };
  const { authError, callbackUrl } = getAuthParams();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7f8] px-4">
      <section className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-500">{t("Sign in to KnowLens.ai", "KnowLens.ai 登录")}</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">
          {t("Sign in with Google", "使用 Google 登录")}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          {t(
            "Use your Google account to continue. You will return to the page you were viewing.",
            "使用 Google 登录后即可继续访问项目与工作台内容，登录后会自动回到你刚刚访问的页面。",
          )}
        </p>

        <button
          type="button"
          onClick={() => {
            setIsGoogleLoading(true);
            void signIn("google", { callbackUrl });
          }}
          disabled={isGoogleLoading}
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isGoogleLoading ? <Loader2 size={15} className="animate-spin text-zinc-500" /> : <GoogleMark />}
          <span>
            {isGoogleLoading
              ? t("Connecting...", "正在连接 Google...")
              : t("Continue with Google", "使用 Google 一键登录")}
          </span>
        </button>

        {authError ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
            {t(
              `Sign-in failed (${authError}). Please try again. If the issue continues, check Google login settings and callback URL.`,
              `登录未完成（${authError}）。通常是网络超时或 Google OAuth 配置问题，请重试；若连续失败请检查回调地址与网络。`,
            )}
          </div>
        ) : null}

        <div className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-600">
          <ShieldCheck size={13} />
          {t("After sign-in, you will return to your previous page.", "登录后自动回到你刚才访问的页面")}
        </div>
      </section>
    </main>
  );
}
