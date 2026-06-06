/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { notFound } from "next/navigation";
import { PublishedPptViewer } from "@/components/featured/PublishedPptViewer";
import { PublishedVideoPlayer } from "@/components/featured/PublishedVideoPlayer";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import { getPublishedCaseBySlug, type PublishedCaseAssetRow, type PublishedCaseOutputType } from "@/lib/server/published-cases";

type CasePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ asset?: string }>;
};

function formatType(value: string) {
  if (value === "ppt") return "Presentation Slides";
  if (value === "video") return "Explainer Video";
  return "Infographic Poster";
}

function isVideoAsset(asset: PublishedCaseAssetRow) {
  const mimeType = asset.mimeType.toLowerCase();
  return mimeType.startsWith("video/") || /\.mp4(?:$|\?)/i.test(asset.fileUrl) || /\.mp4(?:$|\?)/i.test(asset.downloadUrl);
}

function isPptFileAsset(asset: PublishedCaseAssetRow) {
  const mimeType = asset.mimeType.toLowerCase();
  return (
    mimeType.includes("presentation") ||
    mimeType.includes("powerpoint") ||
    /\.pptx?(?:$|\?)/i.test(asset.fileUrl) ||
    /\.pptx?(?:$|\?)/i.test(asset.downloadUrl)
  );
}

function isImageAsset(asset: PublishedCaseAssetRow) {
  return !isVideoAsset(asset) && !isPptFileAsset(asset);
}

function caseAssetHref(caseSlug: string, asset: PublishedCaseAssetRow) {
  return `/cases/${encodeURIComponent(caseSlug)}?asset=${encodeURIComponent(asset.slug)}`;
}

function getPrimaryImageAsset(assets: PublishedCaseAssetRow[], queryAsset?: string) {
  return (
    assets.find((asset) => asset.slug === queryAsset || asset.id === queryAsset) ||
    assets.find((asset) => asset.isPrimary) ||
    assets[0] ||
    null
  );
}

function formatScriptLabel(input: {
  outputType: PublishedCaseOutputType;
  asset: PublishedCaseAssetRow;
  index: number;
}) {
  if (input.outputType === "video") {
    return input.asset.pageIndex <= 1 && input.index === 0 ? "Cover Frame" : `Frame ${input.index + 1}`;
  }
  if (input.outputType === "ppt") {
    return input.asset.pageIndex <= 1 && input.index === 0 ? "Cover Page" : `Slide ${input.index + 1}`;
  }
  return input.asset.pageIndex > 1 ? `Poster ${input.asset.pageIndex}` : "Poster";
}

export default async function PublishedCasePage({ params, searchParams }: CasePageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const item = await getPublishedCaseBySlug(slug, false, { includeLatestVideoExportAsset: true });
  if (!item) {
    notFound();
  }

  const assets = item.assets || [];
  const imageAssets = assets.filter(isImageAsset);
  const videoAsset = assets.find(isVideoAsset) || null;
  const selectedImage = getPrimaryImageAsset(imageAssets, query.asset);
  const selectedImageIndex = selectedImage ? Math.max(0, imageAssets.findIndex((asset) => asset.id === selectedImage.id)) : -1;
  const isPpt = item.outputType === "ppt";
  const isVideo = item.outputType === "video";
  const hasPublishedVideo = Boolean(videoAsset);
  const scriptAssets = imageAssets.filter((asset) => asset.title.trim() || asset.description.trim());
  const mediaTitle = hasPublishedVideo
    ? item.title
    : isVideo
      ? videoAsset
        ? item.title
        : "Video file is not available yet"
      : selectedImage?.title || item.title;

  return (
    <MarketingChrome>
      <main className="px-4 py-8 text-zinc-900 sm:px-6 lg:px-12">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                KnowLens.ai · {formatType(hasPublishedVideo ? "video" : item.outputType)}
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{item.title}</h1>
              {item.description ? (
                <p className="mt-2 text-sm leading-6 text-zinc-600">{item.description}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1">{item.category}</span>
                <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1">@{item.authorLabel}</span>
                {isPpt && !hasPublishedVideo && imageAssets.length ? (
                  <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1">
                    {imageAssets.length} slides
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {isPpt && !hasPublishedVideo ? (
            <PublishedPptViewer assets={imageAssets} initialIndex={selectedImageIndex} title={item.title} />
          ) : (
            <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-zinc-900">{mediaTitle}</p>
                </div>
              </div>
              <div className="bg-zinc-950/95 p-3 sm:p-6">
                {hasPublishedVideo ? (
                  <PublishedVideoPlayer
                    src={videoAsset?.fileUrl || ""}
                    poster={item.coverUrl || selectedImage?.fileUrl || videoAsset?.thumbnailUrl || undefined}
                    title={item.title}
                    className="mx-auto aspect-video max-h-[78vh] w-full max-w-5xl rounded-xl bg-black"
                  />
                ) : isVideo ? (
                  videoAsset ? (
                    <PublishedVideoPlayer
                      src={videoAsset.fileUrl}
                      poster={item.coverUrl || selectedImage?.fileUrl || videoAsset.thumbnailUrl || undefined}
                      title={item.title}
                      className="mx-auto aspect-video max-h-[78vh] w-full max-w-5xl rounded-xl bg-black"
                    />
                  ) : (
                    <div className="mx-auto flex min-h-[420px] max-w-5xl items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black text-center">
                      {selectedImage ? (
                        <div className="relative h-full w-full">
                          <img
                            src={selectedImage.fileUrl}
                            alt={selectedImage.title || item.title}
                            className="mx-auto max-h-[78vh] w-auto max-w-full opacity-60"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/35 px-6">
                            <div className="max-w-md rounded-2xl border border-white/15 bg-black/75 p-5 text-white shadow-xl">
                              <p className="text-sm font-semibold">Playable MP4 is not published yet</p>
                              <p className="mt-2 text-sm leading-6 text-white/70">
                                This public case currently contains storyboard frames only. Publish a video file to show a playable preview here.
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="px-6 text-sm text-white/70">This video case has no public media yet.</p>
                      )}
                    </div>
                  )
                ) : selectedImage ? (
                  <div className="relative mx-auto w-fit max-w-full">
                    <img
                      src={selectedImage.fileUrl}
                      alt={selectedImage.title || item.title}
                      className="mx-auto max-h-[82vh] w-auto max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-white/20 px-4 py-16 text-center text-sm text-white/70">
                    This case has no public files yet.
                  </div>
                )}
              </div>
            </section>
          )}

          {!isPpt && !isVideo && imageAssets.length > 1 ? (
            <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {imageAssets.map((asset) => {
                const active = selectedImage?.id === asset.id;
                return (
                  <Link
                    key={asset.id}
                    href={caseAssetHref(item.slug, asset)}
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

          {isVideo && imageAssets.length > 1 && !videoAsset ? (
            <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-zinc-900">Storyboard frames</p>
              <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                {imageAssets.map((asset, index) => (
                  <div key={asset.id} className="w-36 shrink-0 overflow-hidden rounded-xl border border-zinc-200">
                    <div className="aspect-video bg-zinc-100">
                      <img
                        src={asset.thumbnailUrl || asset.fileUrl}
                        alt={asset.title || item.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <p className="truncate px-2 py-1.5 text-xs text-zinc-600">Frame {index + 1}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {scriptAssets.length ? (
            <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  KnowLens.ai · Draft Content
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900">
                  {isVideo ? "Storyboard Script" : isPpt ? "Presentation Script" : "Poster Copy"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  The text below is the draft content used to generate this public case.
                </p>
              </div>
              <div className="mt-5 divide-y divide-zinc-200">
                {scriptAssets.map((asset, index) => (
                  <article
                    key={`script-${asset.id}`}
                    className="py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full px-2.5 py-1 text-xs font-medium text-zinc-500 ring-1 ring-zinc-200">
                        {formatScriptLabel({ outputType: item.outputType, asset, index })}
                      </span>
                      <h3 className="text-sm font-semibold text-zinc-900">{asset.title || item.title}</h3>
                    </div>
                    {asset.description ? (
                      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-zinc-700">{asset.description}</p>
                    ) : (
                      <p className="mt-2 text-sm leading-6 text-zinc-500">No additional body copy was saved for this item.</p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </MarketingChrome>
  );
}
