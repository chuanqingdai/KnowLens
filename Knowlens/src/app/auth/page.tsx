"use client";

import { useState } from "react";
import { Loader2, LogIn, ShieldCheck } from "lucide-react";
import { signIn } from "next-auth/react";
import { useLocale } from "@/components/i18n/LocaleProvider";

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
        <p className="text-sm text-zinc-500">{t("KnowLens.ai Sign in", "KnowLens.ai 登录")}</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">
          {t("Continue to your workspace", "继续使用你的工作台")}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          {t(
            "Sign in with Google to access your projects and workspace. You'll be brought back to the page you were just viewing.",
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
          className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-500"
        >
          {isGoogleLoading ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />}
          {isGoogleLoading ? t("Connecting to Google...", "正在连接 Google...") : t("Continue with Google", "使用 Google 一键登录")}
        </button>

        {authError ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
            {t(
              `Sign-in failed (${authError}). This is usually a network timeout or Google OAuth configuration issue. Please try again; if it keeps failing, check the callback URL and your network.`,
              `登录未完成（${authError}）。通常是网络超时或 Google OAuth 配置问题，请重试；若连续失败请检查回调地址与网络。`,
            )}
          </div>
        ) : null}

        <div className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-600">
          <ShieldCheck size={13} />
          {t("You'll return to the page you were viewing.", "登录后自动回到你刚才访问的页面")}
        </div>
      </section>
    </main>
  );
}
