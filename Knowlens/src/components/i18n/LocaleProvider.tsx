"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "en" | "zh";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (en: string, zh: string) => string;
};

const STORAGE_KEY = "scilens-locale";

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") {
      return "en";
    }
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "zh") {
        return saved;
      }
    } catch {
      return "en";
    }
    return "en";
  });

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale: (next: Locale) => {
        setLocaleState(next);
        try {
          window.localStorage.setItem(STORAGE_KEY, next);
        } catch {
          // ignore storage errors
        }
      },
      t: (en: string, zh: string) => (locale === "zh" ? zh : en),
    }),
    [locale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used inside LocaleProvider");
  }
  return context;
}
