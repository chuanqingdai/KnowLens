import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { resolveRoleByEmail } from "@/lib/auth";
import { upsertUser } from "@/lib/server/store";
import { OAuth2Client } from "google-auth-library";

let oneTapClient: OAuth2Client | null = null;

function getOneTapClient() {
  if (oneTapClient) {
    return oneTapClient;
  }
  oneTapClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID ?? "");
  return oneTapClient;
}

export const nextAuthOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      httpOptions: {
        timeout: 15000,
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
        } catch {
          return null;
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
  },
  pages: {
    signIn: "/auth",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.email) {
        token.role = resolveRoleByEmail(user.email);
      } else if (token.email) {
        token.role = resolveRoleByEmail(token.email);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.role) {
        session.user.role = token.role;
      }
      return session;
    },
    async signIn({ user }) {
      if (user?.email) {
        upsertUser({
          email: user.email,
          name: user.name || user.email.split("@")[0] || "User",
          role: resolveRoleByEmail(user.email),
        });
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
