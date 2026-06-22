import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { resolveRoleByEmail } from "@/lib/auth";
import { authenticateOrCreatePasswordUser, logOpsEvent, upsertUser } from "@/lib/server/store";
import {
  assertProductionAuthConfigLock,
  getAuthEnvSnapshot,
  resolveAuthCookieDomain,
} from "@/lib/authEnv";
import { OAuth2Client } from "google-auth-library";
import https from "node:https";
import crypto from "node:crypto";

let oneTapClient: OAuth2Client | null = null;
const googleHttpsAgent = new https.Agent({
  keepAlive: true,
  family: 4,
});

const AUTH_ENV = getAuthEnvSnapshot();
assertProductionAuthConfigLock(AUTH_ENV);
const AUTH_SECRET = AUTH_ENV.authSecret;
const AUTH_COOKIE_DOMAIN = resolveAuthCookieDomain(AUTH_ENV);
const AUTH_USE_SECURE_COOKIES = AUTH_ENV.useSecureCookies;
const SIGNIN_DB_TIMEOUT_MS = 8_000;

const AUTH_COOKIES = AUTH_COOKIE_DOMAIN
  ? {
      sessionToken: {
        name: `${AUTH_USE_SECURE_COOKIES ? "__Secure-" : ""}next-auth.session-token`,
        options: {
          httpOnly: true,
          sameSite: "lax" as const,
          path: "/",
          secure: AUTH_USE_SECURE_COOKIES,
          domain: AUTH_COOKIE_DOMAIN,
        },
      },
      callbackUrl: {
        name: `${AUTH_USE_SECURE_COOKIES ? "__Secure-" : ""}next-auth.callback-url`,
        options: {
          sameSite: "lax" as const,
          path: "/",
          secure: AUTH_USE_SECURE_COOKIES,
          domain: AUTH_COOKIE_DOMAIN,
        },
      },
      csrfToken: {
        name: `${AUTH_USE_SECURE_COOKIES ? "__Secure-" : ""}next-auth.csrf-token`,
        options: {
          httpOnly: true,
          sameSite: "lax" as const,
          path: "/",
          secure: AUTH_USE_SECURE_COOKIES,
          domain: AUTH_COOKIE_DOMAIN,
        },
      },
    }
  : undefined;

function getOneTapClient() {
  if (oneTapClient) {
    return oneTapClient;
  }
  oneTapClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID ?? "");
  return oneTapClient;
}

function decodeJwtPayload(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  try {
    const payloadRaw = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payloadRaw.padEnd(payloadRaw.length + ((4 - (payloadRaw.length % 4)) % 4), "=");
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(decoded) as {
      sub?: string;
      email?: string;
      name?: string;
      picture?: string;
      aud?: string;
      exp?: number;
      email_verified?: boolean | string;
    };
  } catch {
    return null;
  }
}

function stringifyLoggerDetails(parts: unknown[]) {
  try {
    return parts
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        return JSON.stringify(part);
      })
      .join(" | ")
      .slice(0, 500);
  } catch {
    return "";
  }
}

function safeLogAuthEvent(input: Parameters<typeof logOpsEvent>[0]) {
  try {
    void logOpsEvent(input);
  } catch {
    // Never break auth flow because of telemetry write failures.
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export const nextAuthOptions: NextAuthOptions = {
  secret: AUTH_SECRET || undefined,
  debug: process.env.NODE_ENV !== "production",
  logger: {
    error(code, ...message) {
      console.error("[next-auth][logger][error]", code, ...message);
      safeLogAuthEvent({
        category: "auth",
        action: "signin_failed",
        status: "error",
        source: "nextauth",
        code,
        message: stringifyLoggerDetails(message) || "NextAuth logger error",
      });
    },
    warn(code, ...message) {
      console.warn("[next-auth][logger][warn]", code, ...message);
      if (String(code).toLowerCase().includes("oauth")) {
        safeLogAuthEvent({
          category: "auth",
          action: "signin_warning",
          status: "error",
          source: "nextauth",
          code,
          message: stringifyLoggerDetails(message) || "NextAuth OAuth warning",
        });
      }
    },
    debug(code, ...message) {
      if (process.env.NODE_ENV !== "production") {
        console.info("[next-auth][logger][debug]", code, ...message);
      }
    },
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          scope: "openid email profile",
        },
      },
      checks: process.env.NEXTAUTH_RELAX_OAUTH_CHECKS_LOCAL === "true" ? ["none"] : ["pkce", "state"],
      httpOptions: {
        timeout: 30000,
        // Prefer IPv4 for flaky local DNS/network paths to Google OAuth endpoints.
        agent: googleHttpsAgent,
      },
    }),
    CredentialsProvider({
      id: "password-login",
      name: "账号密码登录",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email ?? "").trim().toLowerCase();
        const password = credentials?.password ?? "";
        if (!email || password.length < 6) {
          return null;
        }
        try {
          return await withTimeout(
            authenticateOrCreatePasswordUser({
              email,
              password,
              role: resolveRoleByEmail(email),
            }),
            SIGNIN_DB_TIMEOUT_MS,
            `Password account sign-in timed out after ${SIGNIN_DB_TIMEOUT_MS}ms.`,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error ?? "Unknown password sign-in error.");
          console.error("[next-auth][password-login][failed]", message);
          safeLogAuthEvent({
            category: "auth",
            action: "password_signin_failed",
            status: "error",
            source: "password-login",
            code: "AUTH_PASSWORD_SERVICE_UNAVAILABLE",
            message,
            userEmail: email,
          });
          throw new Error("AUTH_PASSWORD_SERVICE_UNAVAILABLE");
        }
      },
    }),
    CredentialsProvider({
      id: "google-onetap",
      name: "Google One Tap",
      credentials: {
        credential: { label: "Credential", type: "text" },
      },
      async authorize(credentials) {
        const idToken = (credentials?.credential ?? "").trim();
        if (!idToken) {
          return null;
        }
        const audience = process.env.GOOGLE_CLIENT_ID ?? "";
        if (!audience) {
          return null;
        }
        const allowUnsafeLocalFallback =
          process.env.NEXTAUTH_ONE_TAP_UNSAFE_LOCAL_FALLBACK === "true" &&
          process.env.NODE_ENV !== "production";
        try {
          const ticket = await getOneTapClient().verifyIdToken({
            idToken,
            audience,
          });
          const payload = ticket.getPayload();
          const email = payload?.email?.trim().toLowerCase();
          if (!email || payload?.email_verified !== true) {
            return null;
          }
          return {
            id: payload?.sub ?? email,
            email,
            name: payload?.name?.trim() || email.split("@")[0] || "User",
            image: payload?.picture,
          };
        } catch (error) {
          if (!allowUnsafeLocalFallback) {
            return null;
          }
          const payload = decodeJwtPayload(idToken);
          if (!payload?.email || !payload?.aud || payload.aud !== audience) {
            return null;
          }
          const now = Math.floor(Date.now() / 1000);
          if (!payload.exp || payload.exp <= now) {
            return null;
          }
          const emailVerified =
            payload.email_verified === true || payload.email_verified === "true";
          if (!emailVerified) {
            return null;
          }
          console.warn("[next-auth][one-tap][unsafe-local-fallback] token accepted without remote signature check", {
            reason: error instanceof Error ? error.message : "unknown",
            tokenHash: crypto.createHash("sha256").update(idToken).digest("hex").slice(0, 12),
          });
          return {
            id: payload.sub ?? payload.email,
            email: payload.email.trim().toLowerCase(),
            name: payload.name?.trim() || payload.email.split("@")[0] || "User",
            image: payload.picture,
          };
        }
      },
    }),
    CredentialsProvider({
      id: "dev-login",
      name: "开发环境快速登录",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        name: { label: "Name", type: "text", placeholder: "Your Name" },
      },
      async authorize(credentials) {
        if (process.env.NEXTAUTH_ALLOW_DEV_LOGIN !== "true") {
          return null;
        }
        const email = (credentials?.email ?? "").trim().toLowerCase();
        if (!email) {
          return null;
        }
        return {
          id: email,
          email,
          name: (credentials?.name ?? "").trim() || email.split("@")[0] || "User",
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 90 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  ...(AUTH_COOKIES ? { cookies: AUTH_COOKIES } : {}),
  pages: {
    signIn: "/auth",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      if (user?.email) {
        token.role = resolveRoleByEmail(user.email);
      } else if (token.email) {
        token.role = resolveRoleByEmail(token.email);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id;
      }
      if (session.user && token.role) {
        session.user.role = token.role;
      }
      return session;
    },
    async signIn({ user }) {
      if (user?.email) {
        const role = resolveRoleByEmail(user.email);
        try {
          await withTimeout(
            upsertUser({
              email: user.email,
              name: user.name || user.email.split("@")[0] || "User",
              role,
            }),
            SIGNIN_DB_TIMEOUT_MS,
            `Auth user upsert timed out after ${SIGNIN_DB_TIMEOUT_MS}ms.`,
          );
          safeLogAuthEvent({
            category: "auth",
            action: "signin_success",
            status: "ok",
            source: "nextauth",
            userEmail: user.email,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error ?? "Unknown auth user upsert error.");
          console.error("[next-auth][signin][user-upsert-degraded]", message);
          safeLogAuthEvent({
            category: "auth",
            action: "signin_user_upsert_degraded",
            status: "error",
            source: "nextauth",
            code: "AUTH_USER_UPSERT_DEGRADED",
            message,
            userEmail: user.email,
          });
        }
      }
      return true;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }
      if (url.startsWith(baseUrl)) {
        return url;
      }
      return baseUrl;
    },
  },
};
