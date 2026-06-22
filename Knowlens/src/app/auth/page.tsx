"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/i18n/LocaleProvider";

function isLocalNetworkHost() {
  if (typeof window === "undefined") {
    return false;
  }
  const host = window.location.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return true;
  }
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) {
    return true;
  }
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
    return true;
  }
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)) {
    return true;
  }
  return false;
}

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
  const router = useRouter();
  const { status: sessionStatus } = useSession();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isLocalLoginLoading, setIsLocalLoginLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [localErrorCode, setLocalErrorCode] = useState<string | null>(null);
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
  const { authError, callbackUrl } = mounted
    ? getAuthParams()
    : { authError: null as string | null, callbackUrl: "/app" };
  const showLocalBypass =
    mounted &&
    isLocalNetworkHost() &&
    (process.env.NEXT_PUBLIC_ALLOW_DEV_LOGIN === "true" || process.env.NODE_ENV !== "production");
  const canSubmitPassword = email.trim().includes("@") && password.length >= 6;

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!mounted || sessionStatus !== "authenticated") {
      return;
    }
    router.replace(callbackUrl);
  }, [callbackUrl, mounted, router, sessionStatus]);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    if (authError) {
      queueMicrotask(() => {
        setIsGoogleLoading(false);
        setIsLocalLoginLoading(false);
      });
    }
    if (authError) {
      queueMicrotask(() => setLocalErrorCode(null));
    }
  }, [authError, mounted]);

  const activeError = authError || localErrorCode;
  const authErrorNotice = (() => {
    if (!activeError) {
      return null;
    }
    if (activeError === "OAuthSignin" || activeError === "AUTH-GOOGLE-LOCAL-001") {
      return t(
        "Google login couldn't start because the current network could not reach Google in time. Please try another network or turn off VPN/proxy.",
        "Google 登录无法启动，因为当前网络无法及时连接 Google。请切换网络或关闭 VPN/代理后重试。",
      );
    }
    if (activeError === "OAuthCallback") {
      return t(
        "Google login failed during the final callback step. Please check the redirect URL and try again.",
        "Google 登录在最后回调步骤失败。请检查回调地址后再试。",
      );
    }
    if (activeError === "OAuthAccountNotLinked") {
      return t(
        "This Google account is not linked to the current sign-in method. Please use another Google account or the password sign-in below.",
        "这个 Google 账号没有绑定当前登录方式。请换一个 Google 账号，或使用下方账号密码登录。",
      );
    }
    if (activeError === "AccessDenied") {
      return t(
        "Google authorization was cancelled or denied. Please try again.",
        "Google 授权已取消或被拒绝，请重试。",
      );
    }
    if (activeError === "Configuration") {
      return t(
        "Google login is not fully configured on the server. Please check the production OAuth settings.",
        "服务器上的 Google 登录配置不完整，请检查线上 OAuth 配置。",
      );
    }
    if (activeError === "CredentialsSignin") {
      return t(
        "The email or password is incorrect. Please check it and try again.",
        "邮箱或密码不正确，请检查后重试。",
      );
    }
    if (activeError === "AUTH-PASSWORD-VALIDATION") {
      return t(
        "Please enter a valid email and a password with at least 6 characters.",
        "请输入有效邮箱和至少 6 位密码。",
      );
    }
    return t(
      "Sign-in failed. Please try again.",
      "登录失败，请重试。",
    );
  })();

  const authErrorCode = (() => {
    if (!activeError) {
      return null;
    }
    if (activeError === "OAuthSignin" || activeError === "AUTH-GOOGLE-LOCAL-001") {
      return "AUTH-GOOGLE-001";
    }
    if (activeError === "OAuthCallback") {
      return "AUTH-GOOGLE-002";
    }
    if (activeError === "OAuthAccountNotLinked") {
      return "AUTH-GOOGLE-003";
    }
    if (activeError === "AccessDenied") {
      return "AUTH-GOOGLE-004";
    }
    if (activeError === "Configuration") {
      return "AUTH-GOOGLE-005";
    }
    if (activeError === "CredentialsSignin") {
      return "AUTH-PASSWORD-001";
    }
    if (activeError === "AUTH-PASSWORD-VALIDATION") {
      return "AUTH-PASSWORD-002";
    }
    return `AUTH-GENERIC-${String(activeError).slice(0, 12).toUpperCase()}`;
  })();
  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPasswordLoading || isGoogleLoading) {
      return;
    }
    setLocalErrorCode(null);
    if (!canSubmitPassword) {
      setLocalErrorCode("AUTH-PASSWORD-VALIDATION");
      return;
    }
    setIsPasswordLoading(true);
    try {
      const result = await signIn("password-login", {
        redirect: false,
        email: email.trim(),
        password,
        callbackUrl,
      });
      if (result?.ok) {
        router.replace(callbackUrl);
        return;
      }
    } catch {
      // Fall through to the same user-facing retry state as an auth failure.
    }
    setPassword("");
    setIsPasswordLoading(false);
    setLocalErrorCode("CredentialsSignin");
  };

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-x-hidden bg-[#f6f7f9] px-4 py-8 sm:py-10">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundColor: "#f6f7f9",
          backgroundImage:
            "linear-gradient(rgba(24,24,27,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(24,24,27,0.035) 1px, transparent 1px), linear-gradient(rgba(24,24,27,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(24,24,27,0.05) 1px, transparent 1px), radial-gradient(circle at 16% 18%, rgba(59,130,246,0.035), transparent 40%), radial-gradient(circle at 84% 26%, rgba(20,184,166,0.03), transparent 36%), radial-gradient(circle at 60% 74%, rgba(236,72,153,0.025), transparent 34%)",
          backgroundSize: "24px 24px, 24px 24px, 120px 120px, 120px 120px, auto, auto, auto",
          backgroundPosition: "0 0, 0 0, -1px -1px, -1px -1px, 0 0, 0 0, 0 0",
        }}
      />
      <section className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
          {t("KnowLens.ai", "KnowLens.ai")}
        </p>
        <h1 className="mt-2 text-[34px] font-semibold leading-[1.12] tracking-tight text-zinc-900">
          {t("Welcome back to KnowLens", "欢迎回到 KnowLens")}
        </h1>

        <form className="mt-6 space-y-3" onSubmit={handlePasswordSubmit}>
          <label className="block text-sm font-medium text-zinc-700">
            {t("Email", "邮箱")}
            <span className="mt-1.5 flex h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 transition focus-within:border-zinc-400">
              <Mail size={16} className="text-zinc-400" />
              <input
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setLocalErrorCode(null);
                }}
                className="min-w-0 flex-1 bg-transparent text-sm font-normal text-zinc-900 outline-none placeholder:text-zinc-400"
                placeholder="name@example.com"
                autoComplete="email"
                inputMode="email"
              />
            </span>
          </label>
          <label className="block text-sm font-medium text-zinc-700">
            {t("Password", "密码")}
            <span className="mt-1.5 flex h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 transition focus-within:border-zinc-400">
              <Lock size={16} className="text-zinc-400" />
              <input
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setLocalErrorCode(null);
                }}
                className="min-w-0 flex-1 bg-transparent text-sm font-normal text-zinc-900 outline-none placeholder:text-zinc-400"
                placeholder={t("At least 6 characters", "至少 6 位字符")}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                aria-label={showPassword ? t("Hide password", "隐藏密码") : t("Show password", "显示密码")}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </label>
          <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
            <span>
              {t(
                "Use email and password to sign in. On your first sign-in, we will create a new account for you.",
                "使用邮箱和密码登录，首次登录时，会为你直接注册新的账号。",
              )}
            </span>
          </div>
          <button
            type="submit"
            disabled={!canSubmitPassword || isPasswordLoading || isGoogleLoading}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white shadow-[0_8px_20px_rgba(15,23,42,0.18)] transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPasswordLoading ? <Loader2 size={15} className="animate-spin text-white/90" /> : null}
            <span>
              {isPasswordLoading
                ? t("Signing in...", "正在登录...")
                : t("Sign in", "登录")}
            </span>
          </button>
        </form>

        {authErrorNotice && authErrorCode ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
            <p className="text-xs leading-5 text-red-700">{authErrorNotice}</p>
            <p className="mt-1 text-[11px] leading-5 text-zinc-500">
              {t(`Error code: ${authErrorCode}`, `错误码：${authErrorCode}`)}
            </p>
          </div>
        ) : null}

        <div className="my-5 flex items-center gap-3 text-xs text-zinc-400">
          <span className="h-px flex-1 bg-zinc-200" />
          <span>{t("or", "或")}</span>
          <span className="h-px flex-1 bg-zinc-200" />
        </div>

        <button
          type="button"
          onClick={() => {
            if (isPasswordLoading) {
              return;
            }
            setIsGoogleLoading(true);
            void signIn("google", { callbackUrl }).catch(() => {
              setIsGoogleLoading(false);
            });
          }}
          disabled={isGoogleLoading || isPasswordLoading}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isGoogleLoading ? (
            <Loader2 size={15} className="animate-spin text-zinc-500" />
          ) : (
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white">
              <GoogleMark />
            </span>
          )}
          <span>
            {isGoogleLoading
              ? t("Connecting...", "正在连接 Google...")
              : t("Sign in with Google", "使用 Google 登录")}
          </span>
        </button>

        {showLocalBypass ? (
          <button
            type="button"
            onClick={() => {
              setIsLocalLoginLoading(true);
              void signIn("dev-login", {
                email: "local@knowlens.ai",
                name: "Local Tester",
                callbackUrl,
              }).catch(() => {
                setIsLocalLoginLoading(false);
              });
            }}
            disabled={isLocalLoginLoading}
            className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLocalLoginLoading ? (
              <Loader2 size={15} className="animate-spin text-zinc-500" />
            ) : (
              <ShieldCheck size={15} className="text-zinc-500" />
            )}
            <span>
              {isLocalLoginLoading
                ? t("Connecting...", "正在连接...")
                : t("Skip sign-in for local testing", "本地测试跳过登录")}
            </span>
          </button>
        ) : null}

      </section>
    </main>
  );
}
