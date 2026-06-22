"use client";

import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { useSession } from "next-auth/react";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { resolveRoleByEmail } from "@/lib/auth";
import { upsertAdminUserFromAuth } from "@/lib/admin";

type AuthSessionProviderProps = {
  children: React.ReactNode;
};

function SessionDataSync({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  useEffect(() => {
    const email = (session?.user?.email ?? "").trim().toLowerCase();
    if (!email) {
      return;
    }
    upsertAdminUserFromAuth({
      email,
      name: session?.user?.name?.trim() || email.split("@")[0] || "User",
      role: resolveRoleByEmail(email),
      provider: email.startsWith("password:") ? "password" : "google",
    });
  }, [session?.user?.email, session?.user?.name]);

  return <>{children}</>;
}

export function AuthSessionProvider({ children }: AuthSessionProviderProps) {
  return (
    <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
      <LocaleProvider>
        <SessionDataSync>{children}</SessionDataSync>
      </LocaleProvider>
    </SessionProvider>
  );
}
