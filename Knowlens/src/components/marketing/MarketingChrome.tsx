"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { LocaleSwitch } from "@/components/i18n/LocaleSwitch";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { usePathname, useRouter } from "next/navigation";

type MarketingChromeProps = {
  children: React.ReactNode;
  showLocaleSwitch?: boolean;
};

const focusedLandingLinks = [
  {
    href: "/aI-explainer-videos",
    label: "AI Explainer Videos",
  },
  {
    href: "/ai-information-generator",
    label: "AI Information Generator",
  },
];

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (input: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            context?: "signin" | "signup" | "use";
          }) => void;
          prompt: (
            listener?: (notification: {
              isNotDisplayed: () => boolean;
              isSkippedMoment: () => boolean;
              isDismissedMoment: () => boolean;
              getNotDisplayedReason?: () => string;
              getSkippedReason?: () => string;
              getDismissedReason?: () => string;
            }) => void,
          ) => void;
          renderButton?: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              width?: string | number;
              locale?: string;
            },
          ) => void;
          cancel: () => void;
        };
      };
    };
  }
}

function canUseOneTapNow() {
  if (typeof window === "undefined") {
    return false;
  }

  const ua = navigator.userAgent;
  const vendor = navigator.vendor || "";
  const isIOS = /iP(ad|hone|od)/i.test(ua);
  const isSafariLike = /Safari/i.test(ua) && /Apple/i.test(vendor) && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR/i.test(ua);

  try {
    const key = "__knowlens_onetap_storage_check__";
    window.localStorage.setItem(key, "1");
    window.localStorage.removeItem(key);
  } catch {
    return false;
  }

  return !isIOS && !isSafariLike && navigator.cookieEnabled;
}

export function MarketingChrome({ children, showLocaleSwitch = false }: MarketingChromeProps) {
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useSession();
  const [oneTapReady, setOneTapReady] = useState(false);
  const [oneTapTriggered, setOneTapTriggered] = useState(false);
  const [useGoogleFallback, setUseGoogleFallback] = useState(false);
  const isLanding = useMemo(() => pathname === "/" || pathname === "/landing", [pathname]);
  const oneTapClientId = process.env.NEXT_PUBLIC_GOOGLE_ONE_TAP_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  useEffect(() => {
    if (typeof window === "undefined" || !isLanding || !oneTapClientId) {
      return;
    }
    if (!canUseOneTapNow()) {
      queueMicrotask(() => setUseGoogleFallback(true));
      return;
    }
    if (window.google?.accounts?.id) {
      queueMicrotask(() => setOneTapReady(true));
      return;
    }
    const scriptId = "knowlens-google-onetap";
    if (document.getElementById(scriptId)) {
      return;
    }
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setOneTapReady(true);
    document.head.appendChild(script);
  }, [isLanding, oneTapClientId]);

  useEffect(() => {
    if (
      !isLanding ||
      status !== "unauthenticated" ||
      !oneTapReady ||
      !oneTapClientId ||
      oneTapTriggered ||
      useGoogleFallback
    ) {
      return;
    }

    try {
      if (window.sessionStorage.getItem("knowlens-google-prompt-dismissed") === "1") {
        return;
      }
    } catch {
      // ignore storage access issues
    }

    const onScroll = () => {
      const triggerHeight = Math.max(window.innerHeight * 0.9, 520);
      if (window.scrollY >= triggerHeight) {
        setOneTapTriggered(true);
        window.google?.accounts?.id?.initialize({
          client_id: oneTapClientId,
          context: "signin",
          auto_select: true,
          cancel_on_tap_outside: true,
          callback: async (response) => {
            const credential = response?.credential?.trim();
            if (!credential) {
              return;
            }
            await signIn("google-onetap", {
              credential,
              callbackUrl: "/app",
            });
          },
        });
        window.google?.accounts?.id?.prompt((notification) => {
          if (!notification) {
            return;
          }
          if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.() || notification.isDismissedMoment?.()) {
            const reason =
              notification.getNotDisplayedReason?.() ||
              notification.getSkippedReason?.() ||
              notification.getDismissedReason?.() ||
              "";
            const unsupported =
              /browser_not_supported|invalid_client|opt_out_or_no_session|suppressed_by_user|secure_http_required/i.test(
                reason,
              );
            if (unsupported) {
              setUseGoogleFallback(true);
            }
          }
        });
        window.removeEventListener("scroll", onScroll);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [isLanding, oneTapClientId, oneTapReady, oneTapTriggered, status, useGoogleFallback]);

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f7f9] text-zinc-900">
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
            <div className="group relative hidden sm:block">
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                aria-haspopup="menu"
              >
                Features
                <ChevronDown size={13} className="text-zinc-500 transition group-hover:rotate-180" aria-hidden="true" />
              </button>
              <div className="invisible absolute right-0 top-10 z-50 w-56 rounded-xl border border-zinc-200 bg-white p-1.5 opacity-0 shadow-[0_18px_35px_rgba(15,23,42,0.14)] transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                {focusedLandingLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block rounded-lg px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
                    role="menuitem"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <Link
              href="/membership"
              className="inline-flex h-9 items-center rounded-lg border border-zinc-300 bg-white px-3 text-xs text-zinc-700 hover:bg-zinc-100"
            >
              Pricing
            </Link>
            <button
              type="button"
              onClick={() => {
                router.push("/app");
              }}
              className="inline-flex h-9 items-center gap-1 rounded-lg bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-700"
            >
              Generate Free
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1">{children}</main>

      <footer className="relative z-10 border-t border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-9 sm:px-6 md:grid-cols-[1.3fr_1fr_1fr]">
          <div>
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
            <p className="mt-3 max-w-sm text-xs leading-5 text-zinc-500">
              Turn scripts, ideas, and notes into short visual explainer videos.
            </p>
            <p className="mt-5 text-xs text-zinc-500">© 2026 KnowLens.ai · All rights reserved</p>
          </div>
          <nav>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Features</p>
            <div className="mt-3 flex flex-col gap-2 text-sm text-zinc-600">
              {focusedLandingLinks.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-zinc-950">
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
          <nav>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Company & Legal</p>
            <div className="mt-3 flex flex-col gap-2 text-sm text-zinc-600">
              <Link href="/about" className="hover:text-zinc-950">
                {t("About", "About")}
              </Link>
              <Link href="/privacy" className="hover:text-zinc-950">
                {t("Privacy", "Privacy")}
              </Link>
              <Link href="/terms" className="hover:text-zinc-950">
                {t("Terms", "Terms")}
              </Link>
              <Link href="/payment-terms" className="hover:text-zinc-950">
                {t("Payment Terms", "Payment Terms")}
              </Link>
              <Link href="/contact" className="hover:text-zinc-950">
                {t("Contact", "Contact")}
              </Link>
            </div>
          </nav>
        </div>
      </footer>
    </div>
  );
}
