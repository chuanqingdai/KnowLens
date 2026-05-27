import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
