/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import {
  getFinanceInfographicTemplate,
  getFinanceInfographicTemplates,
} from "@/lib/finance-infographic-templates";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getFinanceInfographicTemplates()
    .filter((template) => template.generationStatus === "success")
    .map((template) => ({ slug: template.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const template = getFinanceInfographicTemplate(slug);
  if (!template || template.generationStatus !== "success") return {};
  return {
    title: template.seoTitle,
    description: template.metaDescription,
    alternates: { canonical: template.canonicalUrl },
    keywords: [
      template.primaryKeyword,
      template.categoryKeyword,
      ...template.secondaryKeywords,
      ...template.generatorKeywords,
    ],
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large" },
    },
    openGraph: {
      type: "article",
      url: template.canonicalUrl,
      siteName: "KnowLens.ai",
      title: template.seoTitle,
      description: template.metaDescription,
      images: [
        {
          url: template.previewImageUrl,
          width: template.imageWidth,
          height: template.imageHeight,
          alt: template.imageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: template.seoTitle,
      description: template.metaDescription,
      images: [template.previewImageUrl],
    },
  };
}

export default async function FinanceInfographicTemplatePage({ params }: PageProps) {
  const { slug } = await params;
  const template = getFinanceInfographicTemplate(slug);
  if (!template || template.generationStatus !== "success") notFound();

  const allTemplates = getFinanceInfographicTemplates();
  const related = template.relatedTemplateIds
    .map((id) => allTemplates.find((item) => item.id === id && item.generationStatus === "success"))
    .filter(Boolean)
    .slice(0, 6);
  const createSimilarHref = `/app?prompt=${encodeURIComponent(template.createSimilarPrompt)}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: template.h1,
        url: template.canonicalUrl,
        description: template.metaDescription,
        primaryImageOfPage: {
          "@type": "ImageObject",
          name: template.imageTitle,
          description: template.imageDescription,
          contentUrl: template.previewImageUrl,
          thumbnailUrl: template.previewImageUrl,
          width: template.imageWidth,
          height: template.imageHeight,
          caption: template.imageCaption,
          creator: { "@type": "Organization", name: "KnowLens AI" },
          creditText: "Created with KnowLens AI",
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://knowlens.ai/" },
          { "@type": "ListItem", position: 2, name: "Infographic", item: "https://knowlens.ai/infographic-examples" },
          { "@type": "ListItem", position: 3, name: "Financial Report", item: "https://knowlens.ai/infographic/financial-report" },
          { "@type": "ListItem", position: 4, name: template.h1, item: template.canonicalUrl },
        ],
      },
    ],
  };

  return (
    <MarketingChrome>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="bg-[#f7f9fb] px-4 py-6 text-zinc-950 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <nav className="mb-4 flex flex-wrap gap-2 text-sm text-zinc-500">
            <Link href="/infographic-examples" className="hover:text-zinc-900">Infographic Examples</Link>
            <span>/</span>
            <Link href="/infographic/financial-report" className="hover:text-zinc-900">Financial Report</Link>
            <span>/</span>
            <span>{template.topicName}</span>
          </nav>

          <section className="rounded-[28px] border border-zinc-200 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.10)] sm:p-5">
            <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
              <p className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Financial Report Infographic Template
              </p>
              <h1 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl lg:text-5xl">
                {template.h1}
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-600">
                {template.shortDescription}
              </p>
              <div className="mt-6 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
                <Link href={createSimilarHref} className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white hover:bg-zinc-800">
                  Create similar infographic
                </Link>
                <Link href="/infographic/financial-report" className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50">
                  Financial Report examples
                </Link>
              </div>
            </div>

            <figure className="mt-5 overflow-hidden rounded-3xl bg-white">
              <div className="flex w-full items-start justify-center rounded-2xl bg-white">
                <img
                  src={template.previewImagePath}
                  alt={template.imageAlt}
                  width={template.imageWidth}
                  height={template.imageHeight}
                  draggable={false}
                  className="h-auto w-full rounded-2xl object-contain"
                />
              </div>
              <figcaption className="sr-only">{template.imageCaption}</figcaption>
            </figure>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-zinc-600">
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1">Aspect {template.aspectRatio}</span>
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1">{template.styleName}</span>
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1">Download disabled</span>
            </div>
          </section>

          <section className="mt-8 grid gap-x-10 gap-y-10 lg:grid-cols-2">
            <article className="border-t border-zinc-200 pt-5">
              <h2 className="text-2xl font-semibold tracking-tight">About this finance infographic</h2>
              <p className="mt-4 text-sm leading-7 text-zinc-700">{template.visibleDescription}</p>
            </article>

            <article className="border-t border-zinc-200 pt-5">
              <h2 className="text-lg font-semibold tracking-tight">Template details</h2>
              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                {[
                  ["Topic", template.topicName],
                  ["Aspect ratio", template.aspectRatio],
                  ["Structure", template.structureType],
                  ["Style", template.styleName],
                  ["Category", template.categoryName],
                  ["Download", "Disabled"],
                ].map(([label, value]) => (
                  <div key={label} className="border-b border-zinc-200 pb-3">
                    <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</dt>
                    <dd className="mt-1 text-zinc-800">{value}</dd>
                  </div>
                ))}
              </dl>
            </article>

            <article className="border-t border-zinc-200 pt-5">
              <h2 className="text-lg font-semibold tracking-tight">Key learning points</h2>
              <ul className="mt-4 space-y-3 text-sm text-zinc-700">
                {template.knowledgePoints.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="border-t border-zinc-200 pt-5">
              <h2 className="text-lg font-semibold tracking-tight">Source and data points</h2>
              <p className="mt-4 text-sm leading-7 text-zinc-700">{template.sourceSummary}</p>
              <Link href={template.sourceUrl} className="mt-3 inline-flex text-sm font-semibold text-emerald-700 hover:text-emerald-800">
                Source: {template.sourcePublisher}
              </Link>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                {template.sourceDataPoints.map((point) => (
                  <div key={point.label} className="rounded-2xl border border-zinc-200 bg-white p-3">
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">{point.label}</dt>
                    <dd className="mt-2 text-lg font-semibold text-zinc-950">
                      {point.value}{point.unit ? ` ${point.unit}` : ""}
                    </dd>
                    <dd className="mt-1 text-xs text-zinc-500">{point.period}</dd>
                  </div>
                ))}
              </dl>
            </article>
          </section>

          <section className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-950 p-6 text-white shadow-sm">
            <h2 className="text-xl font-semibold tracking-tight">Create a similar finance infographic</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300">
              Use this prepared prompt to create a similar source-backed financial report visual with KnowLens AI. The prompt keeps the source, aspect ratio, style direction, and verified metric structure aligned with this example.
            </p>
            <Link href={createSimilarHref} className="mt-5 inline-flex h-11 items-center rounded-full bg-white px-5 text-sm font-semibold text-zinc-950 hover:bg-zinc-100">
              Create similar infographic
            </Link>
          </section>

          {related.length > 0 ? (
            <section className="mt-8">
              <h2 className="text-2xl font-semibold tracking-tight">Related finance infographic templates</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((item) => item ? (
                  <Link key={item.id} href={item.detailPath} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="aspect-[4/3] overflow-hidden rounded-xl bg-zinc-100">
                      <img src={item.previewImagePath} alt={item.imageAlt} className="h-full w-full object-cover" />
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-zinc-950">{item.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-zinc-600">{item.shortDescription}</p>
                  </Link>
                ) : null)}
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </MarketingChrome>
  );
}
