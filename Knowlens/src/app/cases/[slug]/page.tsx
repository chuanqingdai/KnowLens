/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { notFound } from "next/navigation";
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

function formatSlideLabel(index: number, total: number) {
  return `Slide ${index + 1} / ${total}`;
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
  const item = await getPublishedCaseBySlug(slug);
  if (!item) {
    notFound();
  }

  const assets = item.assets || [];
  const imageAssets = assets.filter(isImageAsset);
  const videoAsset = assets.find(isVideoAsset) || null;
  const selectedImage = getPrimaryImageAsset(imageAssets, query.asset);
  const selectedImageIndex = selectedImage ? Math.max(0, imageAssets.findIndex((asset) => asset.id === selectedImage.id)) : -1;
  const previousImage = selectedImageIndex > 0 ? imageAssets[selectedImageIndex - 1] : null;
  const nextImage = selectedImageIndex >= 0 && selectedImageIndex < imageAssets.length - 1 ? imageAssets[selectedImageIndex + 1] : null;
  const isPpt = item.outputType === "ppt";
  const isVideo = item.outputType === "video";
  const scriptAssets = imageAssets.filter((asset) => asset.title.trim() || asset.description.trim());
  const mediaTitle = isVideo
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
                KnowLens.ai · {formatType(item.outputType)}
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{item.title}</h1>
              {item.description ? (
                <p className="mt-2 text-sm leading-6 text-zinc-600">{item.description}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1">{item.category}</span>
                <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1">@{item.authorLabel}</span>
                {isPpt && imageAssets.length ? (
                  <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1">
                    {imageAssets.length} slides
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-zinc-900">{mediaTitle}</p>
                {isPpt && selectedImageIndex >= 0 ? (
                  <p className="mt-0.5 text-xs text-zinc-500">{formatSlideLabel(selectedImageIndex, imageAssets.length)}</p>
                ) : null}
              </div>
            </div>
            <div className="bg-zinc-950/95 p-3 sm:p-6">
              {isVideo ? (
                videoAsset ? (
                  <video
                    src={videoAsset.fileUrl}
                    poster={item.coverUrl || selectedImage?.fileUrl || videoAsset.thumbnailUrl || undefined}
                    controls
                    playsInline
                    preload="metadata"
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
                  {isPpt && imageAssets.length > 1 ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
                      <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-2 py-2 text-xs text-white shadow-2xl backdrop-blur-md">
                        {previousImage ? (
                          <Link
                            href={caseAssetHref(item.slug, previousImage)}
                            className="rounded-full px-3 py-1.5 font-medium transition hover:bg-white/15"
                          >
                            Previous
                          </Link>
                        ) : (
                          <span className="cursor-not-allowed rounded-full px-3 py-1.5 font-medium text-white/35">
                            Previous
                          </span>
                        )}
                        <span className="min-w-16 text-center font-medium text-white/85">
                          {selectedImageIndex + 1} / {imageAssets.length}
                        </span>
                        {nextImage ? (
                          <Link
                            href={caseAssetHref(item.slug, nextImage)}
                            className="rounded-full px-3 py-1.5 font-medium transition hover:bg-white/15"
                          >
                            Next
                          </Link>
                        ) : (
                          <span className="cursor-not-allowed rounded-full px-3 py-1.5 font-medium text-white/35">
                            Next
                          </span>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/20 px-4 py-16 text-center text-sm text-white/70">
                  This case has no public files yet.
                </div>
              )}
            </div>
          </section>

          {isPpt && imageAssets.length > 1 ? (
            <section className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
              <div className="flex gap-3 overflow-x-auto pb-1">
                {imageAssets.map((asset, index) => {
                  const active = selectedImage?.id === asset.id;
                  return (
                    <Link
                      key={asset.id}
                      href={caseAssetHref(item.slug, asset)}
                      className={`w-32 shrink-0 overflow-hidden rounded-xl border transition ${
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
                      <div className="px-2 py-1.5">
                        <p className="truncate text-xs font-medium text-zinc-900">Slide {index + 1}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

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
              <div className="mt-5 grid gap-3">
                {scriptAssets.map((asset, index) => (
                  <article
                    key={`script-${asset.id}`}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-zinc-500 ring-1 ring-zinc-200">
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
