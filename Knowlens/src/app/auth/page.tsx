"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
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
  const [mounted, setMounted] = useState(false);
  const [gisReady, setGisReady] = useState(false);
  const [gisRendered, setGisRendered] = useState(false);
  const [localErrorCode, setLocalErrorCode] = useState<string | null>(null);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const { t } = useLocale();
  const oneTapClientId =
    process.env.NEXT_PUBLIC_GOOGLE_ONE_TAP_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
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
  const canRenderGoogleButton = Boolean(oneTapClientId);
  const showLocalBypass =
    mounted &&
    isLocalNetworkHost() &&
    (process.env.NEXT_PUBLIC_ALLOW_DEV_LOGIN === "true" || process.env.NODE_ENV !== "production");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || sessionStatus !== "authenticated") {
      return;
    }
    router.replace(callbackUrl);
  }, [callbackUrl, mounted, router, sessionStatus]);

  useEffect(() => {
    if (!mounted || !oneTapClientId) {
      return;
    }
    if (window.google?.accounts?.id) {
      setGisReady(true);
      return;
    }
    const scriptId = "knowlens-google-gsi-auth";
    if (document.getElementById(scriptId)) {
      return;
    }
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setGisReady(true);
    document.head.appendChild(script);
  }, [mounted, oneTapClientId]);

  useEffect(() => {
    if (!mounted || !gisReady || !oneTapClientId || gisRendered || !googleButtonRef.current) {
      return;
    }
    const id = window.google?.accounts?.id;
    if (!id) {
      return;
    }
    id.initialize({
      client_id: oneTapClientId,
      context: "signin",
      auto_select: false,
      cancel_on_tap_outside: true,
      callback: async (response) => {
        const credential = response?.credential?.trim();
        if (!credential) {
          return;
        }
        setIsGoogleLoading(true);
        try {
          await signIn("google-onetap", {
            credential,
            callbackUrl,
          });
        } finally {
          setIsGoogleLoading(false);
        }
      },
    });
    id.renderButton?.(googleButtonRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      width: 360,
      locale: "en",
    });
    setGisRendered(true);
  }, [callbackUrl, gisReady, gisRendered, mounted, oneTapClientId]);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    if (authError) {
      setIsGoogleLoading(false);
      setIsLocalLoginLoading(false);
    }
    if (authError || localErrorCode) {
      setLocalErrorCode(null);
    }
  }, [authError, localErrorCode, mounted]);

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
    return t(
      "Google login failed. Please try again.",
      "Google 登录失败，请重试。",
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
    return `AUTH-GENERIC-${String(activeError).slice(0, 12).toUpperCase()}`;
  })();

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#f6f7f9] px-4">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundColor: "#f6f7f9",
          backgroundImage:
            "linear-gradient(rgba(24,24,27,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(24,24,27,0.035) 1px, transparent 1px), linear-gradient(rgba(24,24,27,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(24,24,27,0.055) 1px, transparent 1px), radial-gradient(circle at 16% 18%, rgba(59,130,246,0.08), transparent 42%), radial-gradient(circle at 84% 26%, rgba(20,184,166,0.07), transparent 38%), radial-gradient(circle at 60% 74%, rgba(236,72,153,0.05), transparent 36%)",
          backgroundSize: "24px 24px, 24px 24px, 120px 120px, 120px 120px, auto, auto, auto",
          backgroundPosition: "0 0, 0 0, -1px -1px, -1px -1px, 0 0, 0 0, 0 0",
        }}
      />
      <section className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
          {t("KnowLens.ai", "KnowLens.ai")}
        </p>
        <h1 className="mt-2 text-[34px] font-semibold leading-[1.12] tracking-tight text-zinc-900">
          {t("Sign in to KnowLens", "登录 KnowLens")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          {t(
            "Sign in to get 50 free credits and start creating infographics, slides, and explainer videos.",
            "登录即可获得 50 积分，开始生成信息图、演示文稿和讲解视频。",
          )}
        </p>

        <div
          ref={googleButtonRef}
          className={`mt-5 flex min-h-11 w-full items-center justify-center rounded-xl border border-zinc-200 bg-white ${
            gisRendered ? "p-1.5" : "p-0"
          }`}
        >
          {!gisRendered && canRenderGoogleButton ? (
            <span className="text-xs text-zinc-500">
              {t("Loading Google sign-in...", "正在加载 Google 登录组件...")}
            </span>
          ) : null}
          {!gisRendered && !canRenderGoogleButton ? (
            <button
              type="button"
              onClick={() => {
                setIsGoogleLoading(true);
                void signIn("google", { callbackUrl }).catch(() => {
                  setIsGoogleLoading(false);
                });
              }}
              disabled={isGoogleLoading}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-transparent bg-[linear-gradient(135deg,#6D5DF6_0%,#8B5CF6_100%)] px-4 text-sm font-medium text-white shadow-[0_8px_20px_rgba(109,93,246,0.24)] transition hover:bg-[linear-gradient(135deg,#5B4BEA_0%,#7C3AED_100%)] hover:shadow-[0_10px_24px_rgba(109,93,246,0.32)] active:translate-y-px active:shadow-[0_6px_16px_rgba(109,93,246,0.22)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isGoogleLoading ? (
                <Loader2 size={15} className="animate-spin text-white/90" />
              ) : (
                <span className="drop-shadow-[0_0.5px_2px_rgba(255,255,255,0.95)]">
                  <GoogleMark />
                </span>
              )}
              <span>
                {isGoogleLoading
                  ? t("Connecting...", "正在连接 Google...")
                  : t("Sign in with Google", "使用 Google 登录")}
              </span>
            </button>
          ) : null}
        </div>

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

        {authErrorNotice && authErrorCode ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
            <p className="text-xs leading-5 text-red-700">{authErrorNotice}</p>
            <p className="mt-1 text-[11px] leading-5 text-zinc-500">
              {t(`Error code: ${authErrorCode}`, `错误码：${authErrorCode}`)}
            </p>
          </div>
        ) : null}

      </section>
    </main>
  );
}
