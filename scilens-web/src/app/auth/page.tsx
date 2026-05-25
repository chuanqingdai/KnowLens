"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, LogIn, ShieldCheck } from "lucide-react";
import { signIn } from "next-auth/react";

export default function AuthPage() {
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isDevLoading, setIsDevLoading] = useState(false);
  const [devEmail, setDevEmail] = useState("chuanqingdai@gmail.com");
  const [devName, setDevName] = useState("Chuanqing Dai");
  const allowDevLogin = process.env.NEXT_PUBLIC_ALLOW_DEV_LOGIN === "true";
  const callbackUrl = useMemo(() => {
    const raw = searchParams.get("callbackUrl");
    if (!raw) {
      return "/";
    }
    if (raw.startsWith("/") && !raw.startsWith("//")) {
      return raw;
    }
    return "/";
  }, [searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7f8] px-4">
      <section className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-500">KnowLens.ai 登录</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">继续使用你的工作台</h1>
        <p className="mt-2 text-sm text-zinc-600">
          使用 Google 登录后即可继续访问项目、工作台和管理后台。邮箱
          <span className="mx-1 font-medium text-zinc-900">chuanqingdai@gmail.com</span>
          将自动授予管理员权限。
        </p>

        <button
          type="button"
          onClick={() => {
            setIsGoogleLoading(true);
            void signIn("google", { callbackUrl });
          }}
          disabled={isGoogleLoading || isDevLoading}
          className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-500"
        >
          {isGoogleLoading ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />}
          {isGoogleLoading ? "正在连接 Google..." : "使用 Google 一键登录"}
        </button>

        {authError ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
            登录未完成（{authError}）。通常是网络超时或 Google OAuth 配置问题，请重试；若连续失败请检查回调地址与网络。
          </div>
        ) : null}

        {allowDevLogin ? (
          <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs font-medium text-zinc-800">开发环境快速登录（仅本地）</p>
            <div className="mt-2 grid gap-2">
              <input
                value={devEmail}
                onChange={(event) => setDevEmail(event.target.value)}
                type="email"
                className="h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs text-zinc-800 outline-none ring-zinc-200 focus:ring-2"
                placeholder="邮箱"
              />
              <input
                value={devName}
                onChange={(event) => setDevName(event.target.value)}
                type="text"
                className="h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs text-zinc-800 outline-none ring-zinc-200 focus:ring-2"
                placeholder="昵称"
              />
              <button
                type="button"
                onClick={() => {
                  if (!devEmail.trim()) {
                    return;
                  }
                  setIsDevLoading(true);
                  void signIn("dev-login", {
                    email: devEmail.trim(),
                    name: devName.trim(),
                    callbackUrl,
                  });
                }}
                disabled={isGoogleLoading || isDevLoading || !devEmail.trim()}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDevLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                {isDevLoading ? "登录中..." : "快速进入（开发）"}
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-600">
          <ShieldCheck size={13} />
          登录后自动回到你刚才访问的页面
        </div>
      </section>
    </main>
  );
}
