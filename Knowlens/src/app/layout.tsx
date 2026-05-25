import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { AuthSessionProvider } from "@/components/auth/AuthSessionProvider";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://knowlens.ai";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "KnowLens.ai | AI Knowledge Visual Studio",
    template: "%s · KnowLens.ai",
  },
  description:
    "KnowLens.ai turns articles, documents, videos, and podcasts into clear visual posters, slides, and video drafts.",
  keywords: [
    "KnowLens.ai",
    "AI knowledge visual studio",
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
    title: "KnowLens.ai | AI Knowledge Visual Studio",
    description:
      "KnowLens.ai turns articles, documents, videos, and podcasts into clear visual posters, slides, and video drafts.",
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
    title: "KnowLens.ai | AI Knowledge Visual Studio",
    description:
      "KnowLens.ai turns articles, documents, videos, and podcasts into clear visual posters, slides, and video drafts.",
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
