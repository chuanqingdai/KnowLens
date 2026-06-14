import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import {
  getInfographicDirectoryConfig,
  getInfographicDirectoryItems,
  getInfographicDirectoryPath,
  getInfographicDirectoryUrl,
  type InfographicDirectoryItem,
  type InfographicDirectorySlug,
} from "@/lib/infographic-directories";

type DirectoryPageData = {
  slug: InfographicDirectorySlug;
  metadata: Metadata;
  jsonLd: {
    "@context": "https://schema.org";
    "@graph": Array<Record<string, unknown>>;
  };
  items: InfographicDirectoryItem[];
  config: NonNullable<ReturnType<typeof getInfographicDirectoryConfig>>;
};

function displayImageSrc(item: InfographicDirectoryItem) {
  return item.previewImagePath || item.previewImageUrl;
}

export function getInfographicDirectoryPageData(slug: string): DirectoryPageData | null {
  const config = getInfographicDirectoryConfig(slug);
  if (!config) {
    return null;
  }

  const items = getInfographicDirectoryItems(config.slug);
  const pageUrl = getInfographicDirectoryUrl(config.slug);
  const leadImage = items[0];
  const metadata: Metadata = {
    title: config.title,
    description: config.metaDescription,
    keywords: config.keywords,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: "website",
      url: pageUrl,
      siteName: "KnowLens.ai",
      title: config.title,
      description: config.metaDescription,
      images: leadImage
        ? [
            {
              url: leadImage.previewImageUrl,
              width: leadImage.imageWidth,
              height: leadImage.imageHeight,
              alt: leadImage.imageAlt,
            },
          ]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title: config.title,
      description: config.metaDescription,
      images: leadImage ? [leadImage.previewImageUrl] : [],
    },
  };

  const jsonLd = {
    "@context": "https://schema.org" as const,
    "@graph": [
      {
        "@type": "WebPage",
        name: config.h1,
        url: pageUrl,
        description: config.metaDescription,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://knowlens.ai/" },
          { "@type": "ListItem", position: 2, name: "Infographic Examples", item: "https://knowlens.ai/infographic-examples" },
          { "@type": "ListItem", position: 3, name: config.h1, item: pageUrl },
        ],
      },
      ...items.slice(0, 8).map((item, index) => ({
        "@type": "CreativeWork",
        position: index + 1,
        name: item.title,
        url: item.canonicalUrl,
        description: item.shortDescription,
        image: {
          "@type": "ImageObject",
          contentUrl: item.previewImageUrl,
          url: item.previewImageUrl,
          width: item.imageWidth,
          height: item.imageHeight,
          caption: item.imageAlt,
        },
      })),
    ],
  };

  return {
    slug: config.slug,
    config,
    items,
    metadata,
    jsonLd,
  };
}

export function InfographicDirectoryPage({ slug }: { slug: string }) {
  const data = getInfographicDirectoryPageData(slug);
  if (!data) {
    return null;
  }

  const { config, items, jsonLd } = data;

  return (
    <MarketingChrome>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="bg-[#f7f9fb] px-4 py-8 text-zinc-950 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <nav className="mb-4 flex flex-wrap gap-2 text-sm text-zinc-500">
            <Link href="/infographic-examples" className="hover:text-zinc-900">
              Infographic Examples
            </Link>
            <span>/</span>
            <span>{config.h1}</span>
          </nav>

          <section className="rounded-[28px] border border-zinc-200 bg-white p-6 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-8">
            <p className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              {config.badge}
            </p>
            <h1 className="mx-auto mt-4 max-w-4xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              {config.h1}
            </h1>
            <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-zinc-600">{config.intro}</p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={config.ctaHref}
                className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                {config.ctaLabel}
              </Link>
              <Link
                href="/infographic-examples"
                className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                Browse all examples
              </Link>
            </div>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-zinc-500">{config.summary}</p>
          </section>

          <section className="mt-8 columns-1 gap-5 sm:columns-2 xl:columns-3">
            {items.map((item) => (
              <Link
                key={item.id}
                href={item.detailPath}
                className="group mb-5 inline-block w-full break-inside-avoid overflow-hidden rounded-3xl border border-zinc-200 bg-white align-top shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="bg-zinc-50 p-3">
                  <div className="overflow-hidden rounded-2xl bg-white">
                    <img
                      src={displayImageSrc(item)}
                      alt={item.imageAlt}
                      width={item.imageWidth}
                      height={item.imageHeight}
                      className="h-auto w-full object-contain"
                    />
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-600">
                      {item.aspectRatio}
                    </span>
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-600">
                      {item.categoryName}
                    </span>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold tracking-tight text-zinc-950">{item.topicName}</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{item.shortDescription}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-zinc-900">
                    Open detail page
                    <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            ))}
          </section>

          <section className="mt-8 rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">
                  Why this category works for search and discovery
                </h2>
                <p className="mt-4 text-sm leading-7 text-zinc-600">
                  These public example pages are built to do more than show an image. Each linked detail page adds a
                  unique title, descriptive copy, image alt text, knowledge points, a create-similar action, and
                  internal links back into the KnowLens example library. That gives both users and search engines a
                  clearer understanding of what each visual covers.
                </p>
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Related pages</h2>
                <ul className="mt-4 space-y-3 text-sm text-zinc-600">
                  {config.relatedLinks.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="inline-flex items-center gap-2 font-medium text-zinc-900 hover:text-zinc-700">
                        {link.label}
                        <ArrowRight size={14} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>
      </main>
    </MarketingChrome>
  );
}

