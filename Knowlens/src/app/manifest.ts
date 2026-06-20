import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KnowLens.ai",
    short_name: "KnowLens",
    description:
      "KnowLens.ai turns articles, documents, videos, and podcasts into clear visual posters, slides, and video drafts.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f4f5",
    theme_color: "#111827",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/maskable-icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/maskable-icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
