function readEnv(name: string) {
  return (process.env[name] || "").trim();
}

function normalizeUrl(input: string) {
  const raw = input.trim();
  if (!raw) {
    return "";
  }
  try {
    const parsed = new URL(raw);
    const normalizedPath = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "");
    return `${parsed.protocol}//${parsed.host}${normalizedPath}`;
  } catch {
    return "";
  }
}

function isLikelyPlaceholder(input: string) {
  const normalized = input.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return (
    normalized.includes("replace-with") ||
    normalized.includes("your_") ||
    normalized.includes("your-") ||
    normalized.includes("example") ||
    normalized.includes("todo")
  );
}

function isIpHost(hostname: string) {
  return (
    /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) ||
    hostname === "::1" ||
    /^[0-9a-f:]+$/i.test(hostname)
  );
}

export type AuthEnvSnapshot = {
  nextAuthUrl: string;
  nextPublicSiteUrl: string;
  authSecret: string;
  cookieDomain: string;
  shareAcrossSubdomains: boolean;
  useSecureCookies: boolean;
};

export function getAuthEnvSnapshot(): AuthEnvSnapshot {
  const nextAuthUrl = normalizeUrl(readEnv("NEXTAUTH_URL"));
  const nextPublicSiteUrl = normalizeUrl(readEnv("NEXT_PUBLIC_SITE_URL"));
  const authSecret = readEnv("NEXTAUTH_SECRET") || readEnv("AUTH_SECRET");
  const cookieDomain = readEnv("NEXTAUTH_COOKIE_DOMAIN");
  const shareAcrossSubdomains = readEnv("NEXTAUTH_SHARE_COOKIE_ACROSS_SUBDOMAINS") === "true";
  const useSecureCookies =
    nextAuthUrl.startsWith("https://") ||
    nextPublicSiteUrl.startsWith("https://") ||
    process.env.NODE_ENV === "production";

  return {
    nextAuthUrl,
    nextPublicSiteUrl,
    authSecret,
    cookieDomain,
    shareAcrossSubdomains,
    useSecureCookies,
  };
}

export function resolveAuthCookieDomain(snapshot: AuthEnvSnapshot) {
  if (snapshot.cookieDomain) {
    return snapshot.cookieDomain.startsWith(".")
      ? snapshot.cookieDomain
      : `.${snapshot.cookieDomain}`;
  }
  if (!snapshot.shareAcrossSubdomains) {
    return "";
  }
  const baseUrl = snapshot.nextAuthUrl || snapshot.nextPublicSiteUrl;
  if (!baseUrl) {
    return "";
  }
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    if (!hostname || hostname === "localhost" || isIpHost(hostname)) {
      return "";
    }
    return hostname.startsWith(".") ? hostname : `.${hostname}`;
  } catch {
    return "";
  }
}

export function assertProductionAuthConfigLock(snapshot: AuthEnvSnapshot) {
  if (process.env.NODE_ENV !== "production") {
    return;
  }
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }

  const issues: string[] = [];
  if (!snapshot.nextAuthUrl) {
    issues.push("NEXTAUTH_URL is required in production.");
  } else if (!snapshot.nextAuthUrl.startsWith("https://")) {
    issues.push("NEXTAUTH_URL must use https in production.");
  }

  if (!snapshot.nextPublicSiteUrl) {
    issues.push("NEXT_PUBLIC_SITE_URL is required in production.");
  } else if (!snapshot.nextPublicSiteUrl.startsWith("https://")) {
    issues.push("NEXT_PUBLIC_SITE_URL must use https in production.");
  }

  if (
    snapshot.nextAuthUrl &&
    snapshot.nextPublicSiteUrl &&
    snapshot.nextAuthUrl !== snapshot.nextPublicSiteUrl
  ) {
    issues.push("NEXTAUTH_URL and NEXT_PUBLIC_SITE_URL must match exactly in production.");
  }

  if (!snapshot.authSecret) {
    issues.push("NEXTAUTH_SECRET (or AUTH_SECRET) is required in production.");
  } else if (snapshot.authSecret.length < 32 || isLikelyPlaceholder(snapshot.authSecret)) {
    issues.push("NEXTAUTH_SECRET (or AUTH_SECRET) must be a real 32+ character secret in production.");
  }

  const targetDomain = "https://knowlens.ai";
  if (snapshot.nextAuthUrl === targetDomain || snapshot.nextPublicSiteUrl === targetDomain) {
    if (snapshot.cookieDomain !== ".knowlens.ai") {
      issues.push("NEXTAUTH_COOKIE_DOMAIN must be exactly .knowlens.ai for knowlens.ai production.");
    }
    if (!snapshot.shareAcrossSubdomains) {
      issues.push(
        "NEXTAUTH_SHARE_COOKIE_ACROSS_SUBDOMAINS must be true for knowlens.ai production.",
      );
    }
  }

  if (issues.length > 0) {
    throw new Error(`Auth production config lock failed: ${issues.join(" ")}`);
  }
}
