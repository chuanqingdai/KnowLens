import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedCaseBySlug } from "@/lib/server/published-cases";

type CasePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ asset?: string }>;
};

function formatType(value: string) {
  if (value === "ppt") return "Presentation Slides";
  if (value === "video") return "Explainer Video";
  return "Infographic Poster";
}

export default async function PublishedCasePage({ params, searchParams }: CasePageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const item = getPublishedCaseBySlug(slug);
  if (!item) {
    notFound();
  }

  const assets = item.assets || [];
  const selectedAsset =
    assets.find((asset) => asset.slug === query.asset || asset.id === query.asset) ||
    assets.find((asset) => asset.isPrimary) ||
    assets[0] ||
    null;

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-900">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
              KnowLens.ai · {formatType(item.outputType)}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{item.title}</h1>
            {item.description ? (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">{item.description}</p>
            ) : null}
          </div>
          <Link
            href="/app"
            className="inline-flex h-10 items-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Create your own
          </Link>
        </div>

        {selectedAsset ? (
          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 text-sm text-zinc-600">
              <span>{selectedAsset.title || item.title}</span>
              <a
                href={selectedAsset.downloadUrl || selectedAsset.fileUrl}
                download
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100"
              >
                Download
              </a>
            </div>
            <div className="bg-zinc-950/95 p-3 sm:p-6">
              <img
                src={selectedAsset.fileUrl}
                alt={selectedAsset.title || item.title}
                className="mx-auto max-h-[82vh] w-auto max-w-full object-contain"
              />
            </div>
          </section>
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-16 text-center text-sm text-zinc-500">
            This case has no public files yet.
          </div>
        )}

        {assets.length > 1 ? (
          <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {assets.map((asset) => {
              const active = selectedAsset?.id === asset.id;
              return (
                <Link
                  key={asset.id}
                  href={`/cases/${encodeURIComponent(item.slug)}?asset=${encodeURIComponent(asset.slug)}`}
                  className={`overflow-hidden rounded-xl border bg-white transition ${
                    active ? "border-zinc-900 shadow-sm" : "border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  <div className="aspect-video bg-zinc-100">
                    <img
                      src={asset.thumbnailUrl || asset.fileUrl}
                      alt={asset.title || item.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {asset.title || `File ${asset.pageIndex}`}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">Independent file URL</p>
                  </div>
                </Link>
              );
            })}
          </section>
        ) : null}
      </div>
    </main>
  );
}
