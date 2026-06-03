"use client";

import { useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useSearchParams } from "next/navigation";

const GA_MEASUREMENT_ID = "G-HZDH17R044";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function isSafeUserId(value: string) {
  return /^u-[a-z0-9-]{12,}$/i.test(value) || /^gauser_[a-f0-9]{16,64}$/i.test(value);
}

async function sha256Hex(input: string) {
  if (!globalThis.crypto?.subtle) {
    return "";
  }
  const bytes = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function GoogleAnalyticsBridge() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawUserId = (session?.user?.id || "").trim();
  const email = (session?.user?.email || "").trim().toLowerCase();
  const pagePath = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.gtag !== "function") {
      return;
    }
    if (status === "loading") {
      return;
    }

    let cancelled = false;
    async function configureIdentity() {
      let userId = isSafeUserId(rawUserId) ? rawUserId : "";
      if (!userId && email) {
        const hashed = await sha256Hex(`knowlens:${email}`);
        userId = hashed ? `gauser_${hashed.slice(0, 32)}` : "";
      }
      if (cancelled || typeof window.gtag !== "function") {
        return;
      }
      window.gtag("config", GA_MEASUREMENT_ID, {
        user_id: userId || null,
        send_page_view: false,
      });
      window.gtag("event", "page_view", {
        page_path: pagePath,
        page_location: window.location.href,
        page_title: document.title,
        user_id: userId || undefined,
      });
    }

    void configureIdentity();
    return () => {
      cancelled = true;
    };
  }, [email, pagePath, rawUserId, status]);

  return null;
}
