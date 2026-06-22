"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { CreditCard, LogIn, LogOut, UserCircle2 } from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";

function getAvatarFallback(nameOrEmail: string) {
  const value = nameOrEmail.trim();
  if (!value) {
    return "U";
  }
  return value.slice(0, 1).toUpperCase();
}

function getDisplayEmail(email?: string | null) {
  return (email || "").replace(/^password:/, "");
}

type UserMenuProps = {
  buttonClassName?: string;
  signOutCallbackUrl?: string | false;
};

export function UserMenu({ buttonClassName, signOutCallbackUrl = "/auth" }: UserMenuProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const displayEmail = getDisplayEmail(session?.user?.email);
  const displayName = session?.user?.name?.trim() || displayEmail || "User";

  const fallbackInitial = useMemo(() => getAvatarFallback(displayName), [displayName]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current) {
        return;
      }
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (status !== "authenticated") {
    return (
      <button
        type="button"
        disabled={status === "loading"}
        onClick={() => {
          const loginCallbackUrl =
            typeof window !== "undefined"
              ? `${window.location.pathname || "/app"}${window.location.search || ""}`
              : "/app";
          router.push(`/auth?callbackUrl=${encodeURIComponent(loginCallbackUrl || "/app")}`);
        }}
        className={
          buttonClassName ??
          "inline-flex h-10 items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-70"
        }
      >
        <LogIn size={15} />
        {status === "loading" ? t("Checking...", "检查中...") : t("Sign in", "登录")}
      </button>
    );
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={t("User menu", "用户中心")}
        title={t("User menu", "用户中心")}
        className={
          buttonClassName ??
          "flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-800 shadow-sm transition hover:bg-zinc-100"
        }
      >
        {displayName ? (
          <span className="text-xs font-semibold">{fallbackInitial}</span>
        ) : (
          <UserCircle2 size={19} />
        )}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-[90] w-56 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_18px_35px_rgba(15,23,42,0.18)]">
          <div className="border-b border-zinc-100 px-3 py-2.5">
            <p className="truncate text-sm font-medium text-zinc-900">{displayName}</p>
            {displayEmail ? (
              <p className="mt-0.5 truncate text-xs text-zinc-500">{displayEmail}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push("/profile");
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-100"
          >
            <UserCircle2 size={14} />
            {t("Profile", "个人主页")}
          </button>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push("/membership");
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-100"
          >
            <CreditCard size={14} />
            {t("Membership", "会员中心")}
          </button>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              if (signOutCallbackUrl === false) {
                void signOut({ redirect: false }).then(() => router.refresh());
                return;
              }
              void signOut({ callbackUrl: signOutCallbackUrl });
            }}
            className="flex w-full items-center gap-2 rounded-xl border-t border-zinc-100 px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
          >
            <LogOut size={14} />
            {t("Sign out", "退出登录")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
