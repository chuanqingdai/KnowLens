import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import { getHistoryInfographicTemplates } from "@/lib/history-infographic-templates";

const siteUrl = "https://knowlens.ai";
const pagePath = "/infographic/history";
const pageUrl = `${siteUrl}${pagePath}`;
const historyTemplates = getHistoryInfographicTemplates()
  .filter((template) => template.generationStatus === "success")
  .slice(0, 30);

export const metadata: Metadata = {
  title: "History Infographic Templates | 30 Visual History Examples | KnowLens.ai",
  description:
    "Browse 30 published history infographic templates covering civilizations, empires, revolutions, trade routes, and timelines. Open each visual as a full infographic detail page on KnowLens.ai.",
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    type: "website",
    url: pageUrl,
    siteName: "KnowLens.ai",
    title: "History Infographic Templates | KnowLens.ai",
    description:
      "Explore 30 published history infographic templates with full detail pages, large visuals, and create-similar prompts.",
    images: historyTemplates[0]
      ? [
          {
            url: historyTemplates[0].previewImageUrl,
            width: historyTemplates[0].imageWidth,
            height: historyTemplates[0].imageHeight,
            alt: historyTemplates[0].imageAlt,
          },
        ]
      : [],
  },
};

export default function HistoryInfographicDirectoryPage() {
  return (
    <MarketingChrome>
      <main className="bg-[#f7f9fb] px-4 py-8 text-zinc-950 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <section className="rounded-[28px] border border-zinc-200 bg-white p-6 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-8">
            <p className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              History Infographic Directory
            </p>
            <h1 className="mx-auto mt-4 max-w-4xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              30 Published History Infographic Templates
            </h1>
            <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-zinc-600">
              Browse published history infographic pages covering civilizations, empires, revolutions,
              timelines, trade routes, and major turning points. Each page opens as a full infographic
              detail page with a large visual preview and a create-similar prompt.
            </p>
          </section>

          <section className="mt-8 columns-1 gap-5 sm:columns-2 xl:columns-3">
            {historyTemplates.map((template) => (
              <Link
                key={template.id}
                href={template.detailPath}
                className="group mb-5 inline-block w-full break-inside-avoid overflow-hidden rounded-3xl border border-zinc-200 bg-white align-top shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="bg-zinc-50 p-3">
                  <div className="overflow-hidden rounded-2xl bg-white">
                    <img
                      src={template.previewImagePath}
                      alt={template.imageAlt}
                      width={template.imageWidth}
                      height={template.imageHeight}
                      className="h-auto w-full object-cover"
                    />
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-600">
                      {template.aspectRatio}
                    </span>
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-600">
                      {template.styleName}
                    </span>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold tracking-tight text-zinc-950">
                    {template.topicName}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{template.shortDescription}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-zinc-900">
                    Open detail page
                    <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            ))}
          </section>
        </div>
      </main>
    </MarketingChrome>
  );
}
