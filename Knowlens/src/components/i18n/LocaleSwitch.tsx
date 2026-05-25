"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Languages } from "lucide-react";
import { useLocale } from "./LocaleProvider";

type LocaleSwitchProps = {
  className?: string;
};

export function LocaleSwitch({ className }: LocaleSwitchProps) {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={
        className ?? "relative inline-flex"
      }
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 text-xs text-zinc-700 hover:bg-zinc-100"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Languages size={14} className="text-zinc-500" />
        <span className="font-medium">{locale === "en" ? "EN" : "中文"}</span>
        <ChevronDown size={13} className={`text-zinc-500 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-50 w-28 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-[0_12px_24px_rgba(15,23,42,0.12)]">
          <button
            type="button"
            onClick={() => {
              setLocale("en");
              setOpen(false);
            }}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-100"
            role="menuitem"
          >
            <span>EN</span>
            {locale === "en" ? <Check size={13} className="text-zinc-900" /> : null}
          </button>
          <button
            type="button"
            onClick={() => {
              setLocale("zh");
              setOpen(false);
            }}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-100"
            role="menuitem"
          >
            <span>中文</span>
            {locale === "zh" ? <Check size={13} className="text-zinc-900" /> : null}
          </button>
        </div>
      ) : null}
    </div>
  );
}
