import type { NextConfig } from "next";

function readEnv(name: string) {
  return (process.env[name] || "").trim();
}

function isLocalHost(hostname: string) {
  if (!hostname) {
    return true;
  }
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower === "127.0.0.1" || lower === "::1") {
    return true;
  }
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(lower)) {
    return true;
  }
  return false;
}

function resolveCanonicalHost() {
  const raw = readEnv("NEXT_PUBLIC_SITE_URL") || readEnv("NEXTAUTH_URL");
  if (!raw) {
    return "";
  }
  try {
    const parsed = new URL(raw);
    if (isLocalHost(parsed.hostname)) {
      return "";
    }
    return parsed.host.toLowerCase();
  } catch {
    return "";
  }
}

const canonicalHost = resolveCanonicalHost();
const wwwHost = canonicalHost && !canonicalHost.startsWith("www.") ? `www.${canonicalHost}` : "";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ffmpeg-static"],
  staticPageGenerationTimeout: 180,
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.1.5"],
  async redirects() {
    const redirects = [];
    if (canonicalHost && wwwHost) {
      redirects.push({
        source: "/:path*",
        has: [{ type: "host" as const, value: wwwHost }],
        destination: `https://${canonicalHost}/:path*`,
        permanent: true,
      });
    }
    redirects.push({
      source: "/insurance",
      destination: "/baox",
      permanent: true,
    });
    return redirects;
  },
  async rewrites() {
    return [
      {
        source: "/baox",
        destination: "/insurance",
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.sydney-ai.com",
      },
      {
        protocol: "https",
        hostname: "api.tu-zi.com",
      },
    ],
  },
  outputFileTracingIncludes: {
    "/api/export/video": ["./node_modules/ffmpeg-static/ffmpeg"],
    "/api/export/video/jobs": ["./node_modules/ffmpeg-static/ffmpeg"],
  },
  outputFileTracingExcludes: {
    "/insurance": ["./public/**"],
  },
};

export default nextConfig;
