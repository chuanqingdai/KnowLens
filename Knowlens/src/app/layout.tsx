import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { AuthSessionProvider } from "@/components/auth/AuthSessionProvider";

const siteUrl = "https://knowlens.ai";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "KnowLens.ai | AI Infographic Generator for Posters, Slides & Videos",
    template: "%s · KnowLens.ai",
  },
  description:
    "Turn text, documents, videos, and podcasts into infographic posters, slides, and explainer videos — making knowledge easier to understand and share.",
  keywords: [
    "KnowLens.ai",
    "AI infographic generator",
    "visual poster generator",
    "presentation generator",
    "storyboard video generator",
    "infographic AI",
    "content-to-visual AI",
    "knowledge visualization",
    "KnowLens.ai",
  ],
  applicationName: "KnowLens.ai",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "KnowLens.ai",
    title: "KnowLens.ai | AI Infographic Generator for Posters, Slides & Videos",
    description:
      "Turn text, documents, videos, and podcasts into infographic posters, slides, and explainer videos — making knowledge easier to understand and share.",
    images: [
      {
        url: "/picture/knowlens-hero.png",
        width: 1600,
        height: 900,
        alt: "KnowLens.ai Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KnowLens.ai | AI Infographic Generator for Posters, Slides & Videos",
    description:
      "Turn text, documents, videos, and podcasts into infographic posters, slides, and explainer videos — making knowledge easier to understand and share.",
    images: ["/picture/knowlens-hero.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-HZDH17R044"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-HZDH17R044');
          `}
        </Script>
      </head>
      <body className="min-h-full flex flex-col">
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
