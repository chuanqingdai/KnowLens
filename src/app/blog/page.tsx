import type { Metadata } from "next";
import Link from "next/link";

const siteUrl = "https://knowlens.ai";

export const metadata: Metadata = {
  title: "Blog | KnowLens.ai Product & Learning Updates",
  description:
    "Read KnowLens.ai product updates, workflow tips, and best practices for turning knowledge into visual content.",
  alternates: {
    canonical: `${siteUrl}/blog`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/blog`,
    siteName: "KnowLens.ai",
    title: "Blog | KnowLens.ai Product & Learning Updates",
    description:
      "Read KnowLens.ai product updates, workflow tips, and best practices for turning knowledge into visual content.",
    images: [
      {
        url: `${siteUrl}/picture/knowlens-hero.png`,
        width: 1600,
        height: 900,
        alt: "KnowLens blog",
      },
    ],
  },
};

const blogItems = [
  {
    slug: "launch-checklist",
    title: "Launch Checklist: From Draft to Download",
    excerpt:
      "A practical checklist to ship poster, PPT, and video storyboard generation with stable billing and export flows.",
  },
  {
    slug: "prompt-structure-guide",
    title: "Prompt Structure Guide for Better Visual Output",
    excerpt:
      "How to structure topic, audience, and style intent so language and image models produce consistent visual assets.",
  },
  {
    slug: "file-link-ingestion",
    title: "File & URL Ingestion: What Works Best",
    excerpt:
      "Supported source types, extraction behavior, and tips to improve parsing quality for docs, web pages, and media links.",
  },
];

export default function BlogPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-14 text-slate-900">
      <h1 className="text-3xl font-semibold tracking-tight">KnowLens.ai Blog</h1>
      <p className="mt-3 text-base text-slate-600">
        Product updates, workflow notes, and practical guidance for visual knowledge creation.
      </p>
      <section className="mt-8 grid gap-4">
        {blogItems.map((item) => (
          <article
            key={item.slug}
            className="rounded-lg border border-slate-200 bg-white px-5 py-4"
          >
            <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.excerpt}</p>
            <Link
              href="/app"
              className="mt-3 inline-flex items-center text-sm font-medium text-orange-600 hover:text-orange-700"
            >
              Open Workspace
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
