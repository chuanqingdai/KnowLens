"use client";

import { SessionProvider } from "next-auth/react";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";

type AuthSessionProviderProps = {
  children: React.ReactNode;
};

export function AuthSessionProvider({ children }: AuthSessionProviderProps) {
  return (
    <SessionProvider>
      <LocaleProvider>{children}</LocaleProvider>
    </SessionProvider>
  );
}
