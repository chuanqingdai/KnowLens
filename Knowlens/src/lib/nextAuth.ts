import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { resolveRoleByEmail } from "@/lib/auth";

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
