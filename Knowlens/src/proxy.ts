import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";
import {
  assertProductionAuthConfigLock,
  getAuthEnvSnapshot,
} from "@/lib/authEnv";

function resolveCanonicalSiteUrl() {
  const env = getAuthEnvSnapshot();
  const raw = env.nextPublicSiteUrl || env.nextAuthUrl;
  if (!raw) {
    return null;
  }
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

const AUTH_ENV = getAuthEnvSnapshot();
assertProductionAuthConfigLock(AUTH_ENV);
const AUTH_SECRET = AUTH_ENV.authSecret;
const CANONICAL_SITE_URL = resolveCanonicalSiteUrl();

export default withAuth(
  function proxy(request) {
    if (process.env.NODE_ENV === "production" && CANONICAL_SITE_URL) {
      const currentHost = request.nextUrl.host.toLowerCase();
      const canonicalHost = CANONICAL_SITE_URL.host.toLowerCase();
      const currentProtocol = request.nextUrl.protocol;
      const canonicalProtocol = CANONICAL_SITE_URL.protocol;
      if (currentHost !== canonicalHost || currentProtocol !== canonicalProtocol) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.protocol = canonicalProtocol;
        redirectUrl.host = canonicalHost;
        return NextResponse.redirect(redirectUrl, 308);
      }
    }
    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/auth",
    },
    secret: AUTH_SECRET || undefined,
  },
);

export const config = {
  matcher: [
    "/workspace/:path*",
    "/projects/:path*",
    "/profile/:path*",
    "/admin/:path*",
  ],
};
