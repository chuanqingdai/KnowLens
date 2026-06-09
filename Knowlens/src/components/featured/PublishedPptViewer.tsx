"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useMemo, useState } from "react";

type PublishedPptAsset = {
  id: string;
  slug: string;
  title: string;
  fileUrl: string;
  thumbnailUrl: string;
};

type PublishedPptViewerProps = {
  assets: PublishedPptAsset[];
  initialIndex: number;
  title: string;
  itemLabel?: string;
};

function clampIndex(index: number, total: number) {
  if (total <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(total - 1, index));
}

function updateAssetQuery(asset: PublishedPptAsset) {
  if (typeof window === "undefined") {
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set("asset", asset.slug || asset.id);
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

export function PublishedPptViewer({
  assets,
  initialIndex,
  title,
  itemLabel = "Slide",
}: PublishedPptViewerProps) {
  const [selectedIndex, setSelectedIndex] = useState(() => clampIndex(initialIndex, assets.length));
  const selectedAsset = assets[selectedIndex] || null;
  const canGoPrevious = selectedIndex > 0;
  const canGoNext = selectedIndex < assets.length - 1;

  const selectIndex = useCallback(
    (nextIndex: number) => {
      const clampedIndex = clampIndex(nextIndex, assets.length);
      const nextAsset = assets[clampedIndex];
      setSelectedIndex(clampedIndex);
      if (nextAsset) {
        updateAssetQuery(nextAsset);
      }
    },
    [assets],
  );

  const slideLabel = useMemo(() => {
    if (!selectedAsset) {
      return "";
    }
    return `${itemLabel} ${selectedIndex + 1} / ${assets.length}`;
  }, [assets.length, itemLabel, selectedAsset, selectedIndex]);

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-zinc-900">{selectedAsset?.title || title}</p>
            {slideLabel ? <p className="mt-0.5 text-xs text-zinc-500">{slideLabel}</p> : null}
          </div>
        </div>
        <div className="bg-zinc-950/95 p-2 sm:p-4">
          {selectedAsset ? (
            <div className="relative mx-auto w-full max-w-[min(1200px,100%)]">
              <img
                src={selectedAsset.fileUrl}
                alt={selectedAsset.title || title}
                className="mx-auto max-h-[86vh] w-auto max-w-full object-contain"
              />
              {assets.length > 1 ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
                  <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-2 py-2 text-xs text-white shadow-2xl backdrop-blur-md">
                    <button
                      type="button"
                      onClick={() => selectIndex(selectedIndex - 1)}
                      disabled={!canGoPrevious}
                      className="rounded-full px-3 py-1.5 font-medium transition enabled:hover:bg-white/15 disabled:cursor-not-allowed disabled:text-white/35"
                    >
                      Previous
                    </button>
                    <span className="min-w-16 text-center font-medium text-white/85">
                      {selectedIndex + 1} / {assets.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => selectIndex(selectedIndex + 1)}
                      disabled={!canGoNext}
                      className="rounded-full px-3 py-1.5 font-medium transition enabled:hover:bg-white/15 disabled:cursor-not-allowed disabled:text-white/35"
                    >
                      Next
                    </button>
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

      {assets.length > 1 ? (
        <section className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
          <div className="flex gap-3 overflow-x-auto pb-1">
                {assets.map((asset, index) => {
              const active = selectedIndex === index;
              return (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => selectIndex(index)}
                  className={`w-24 shrink-0 overflow-hidden rounded-xl border text-left transition sm:w-28 ${
                    active ? "border-zinc-900 shadow-sm" : "border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  <div className="aspect-video bg-zinc-100">
                    <img
                      src={asset.thumbnailUrl || asset.fileUrl}
                      alt={asset.title || title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="px-2 py-1.5">
                    <p className="truncate text-xs font-medium text-zinc-900">
                      {itemLabel} {index + 1}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
    </>
  );
}
