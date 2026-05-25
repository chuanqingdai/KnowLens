import type { Metadata } from "next";
import "./globals.css";
import { AuthSessionProvider } from "@/components/auth/AuthSessionProvider";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://knowlens.ai";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "KnowLens.ai · 知识可视化创作",
    template: "%s · KnowLens.ai",
  },
  description: "将网页、视频和播客等内容，一键转化为可视化长图、PPT 或视频。",
  keywords: [
    "知识可视化",
    "AI 海报生成",
    "PPT 自动生成",
    "科普内容创作",
    "分镜视频生成",
    "信息图生成",
    "KnowLens.ai",
  ],
  applicationName: "KnowLens.ai",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: siteUrl,
    siteName: "KnowLens.ai",
    title: "KnowLens.ai · 知识可视化创作",
    description: "将网页、视频和播客等内容，一键转化为可视化长图、PPT 或视频。",
    images: [
      {
        url: "/logo.png",
        width: 376,
        height: 376,
        alt: "KnowLens.ai Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KnowLens.ai · 知识可视化创作",
    description: "将网页、视频和播客等内容，一键转化为可视化长图、PPT 或视频。",
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
