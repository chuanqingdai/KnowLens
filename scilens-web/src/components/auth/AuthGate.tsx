"use client";

import { useMemo, useState } from "react";
import { LogIn, ShieldCheck } from "lucide-react";
import {
  getStoredAuthUser,
  resolveRoleByEmail,
  setStoredAuthUser,
  type AuthUser,
} from "@/lib/auth";
import { upsertAdminUserFromAuth } from "@/lib/admin";

type AuthGateProps = {
  children: React.ReactNode;
};

export function AuthGate({ children }: AuthGateProps) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredAuthUser());
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const isReady = useMemo(() => Boolean(user), [user]);

  function handleGoogleLogin() {
    const finalEmail = email.trim().toLowerCase();
    if (!finalEmail || !finalEmail.includes("@")) {
      setError("请输入有效邮箱以完成 Google 登录");
      return;
    }
    const finalName = name.trim() || finalEmail.split("@")[0];
    const authUser: AuthUser = {
      email: finalEmail,
      name: finalName,
      role: resolveRoleByEmail(finalEmail),
      provider: "google",
    };
    setStoredAuthUser(authUser);
    upsertAdminUserFromAuth(authUser);
    setUser(authUser);
    setError("");
  }

  if (isReady) {
    return <>{children}</>;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7f8] px-4">
      <section className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-500">Scilens 登录</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">继续使用你的工作台</h1>
        <p className="mt-2 text-sm text-zinc-600">
          当前演示版为 Google 登录形态。若邮箱为
          <span className="mx-1 font-medium text-zinc-900">chuanqingdai@gmail.com</span>
          会自动授予管理员权限。
        </p>

        <div className="mt-4 space-y-3">
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (error) {
                setError("");
              }
            }}
            placeholder="姓名（可选）"
            className="h-10 w-full rounded-xl border border-zinc-300 px-3 text-sm text-zinc-800 outline-none ring-zinc-300 placeholder:text-zinc-400 focus:ring-2"
          />
          <input
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (error) {
                setError("");
              }
            }}
            placeholder="Google 邮箱"
            className="h-10 w-full rounded-xl border border-zinc-300 px-3 text-sm text-zinc-800 outline-none ring-zinc-300 placeholder:text-zinc-400 focus:ring-2"
          />
        </div>

        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
        >
          <LogIn size={15} />
          使用 Google 登录
        </button>

        <div className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-600">
          <ShieldCheck size={13} />
          管理员邮箱将显示侧边栏「管理后台」入口
        </div>
      </section>
    </main>
  );
}
