/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
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

const SITE_URL = "https://knowlens.ai";

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

function getPrimaryImageAsset(assets: PublishedCaseAssetRow[], queryAsset?: string) {
  return (
    assets.find((asset) => asset.slug === queryAsset || asset.id === queryAsset) ||
    assets.find((asset) => asset.isPrimary) ||
    assets[0] ||
    null
  );
}

function getVideoAssetDimensions(asset: PublishedCaseAssetRow | null) {
  const width = Number(asset?.width || 0);
  const height = Number(asset?.height || 0);
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return { width, height, isPortrait: height > width };
  }
  return { width: 16, height: 9, isPortrait: false };
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

function absoluteUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function getTopicName(title: string) {
  return title.replace(/\s+Case$/i, "").replace(/\s+Template$/i, "").trim();
}

function getInfographicTitle(title: string) {
  const topic = getTopicName(title);
  return /infographic/i.test(topic) ? `${topic} Template` : `${topic} Infographic Template`;
}

function getAspectRatio(asset: PublishedCaseAssetRow | null) {
  const width = Number(asset?.width || 0);
  const height = Number(asset?.height || 0);
  if (!width || !height) return "Preview";
  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.08) return "16:9";
  if (Math.abs(ratio - 9 / 16) < 0.08) return "9:16";
  if (Math.abs(ratio - 1) < 0.08) return "1:1";
  if (Math.abs(ratio - 4 / 5) < 0.08) return "4:5";
  return width > height ? "Landscape" : "Portrait";
}

function getShortDescription(item: { title: string; description: string; category: string }) {
  return (
    item.description ||
    `Explore this ${getTopicName(item.title).toLowerCase()} infographic template for ${item.category.toLowerCase()} learning, readable labels, and structured visual explanation.`
  );
}

function getTemplatePrompt(item: { title: string; category: string }, asset: PublishedCaseAssetRow | null) {
  const topic = getTopicName(asset?.title || item.title);
  return (
    `Create an educational infographic about ${topic} in a clean visual style. ` +
    `Use clear sections, concise labels, structured hierarchy, and readable callouts. ` +
    `Make it useful for ${item.category.toLowerCase()} learning and visual explanation.`
  );
}

function getImageAlt(item: { title: string }, asset: PublishedCaseAssetRow | null) {
  const topic = getTopicName(asset?.title || item.title);
  const detail = asset?.description ? asset.description.replace(/\s+/g, " ").slice(0, 140) : "key sections, labels, and visual learning points";
  return `${topic} infographic showing ${detail}`;
}

export async function generateMetadata({ params }: Pick<CasePageProps, "params">): Promise<Metadata> {
  const { slug } = await params;
  const item = await getPublishedCaseBySlug(slug, false, { includeLatestVideoExportAsset: true });
  if (!item) {
    return {};
  }
  const assets = item.assets || [];
  const imageAssets = assets.filter(isImageAsset);
  const selectedImage = getPrimaryImageAsset(imageAssets);
  const title = item.outputType === "poster" ? getInfographicTitle(item.title) : item.title;
  const description = getShortDescription(item);
  const canonical = `${SITE_URL}/cases/${encodeURIComponent(item.slug)}`;
  const imageUrl = absoluteUrl(item.coverUrl || selectedImage?.fileUrl || "/picture/knowlens-hero.png");

  return {
    title: `${title} - KnowLens AI`,
    description,
    alternates: { canonical },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
      },
    },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: "KnowLens.ai",
      title: `${title} - KnowLens AI`,
      description,
      images: [
        {
          url: imageUrl,
          width: selectedImage?.width || 1200,
          height: selectedImage?.height || 900,
          alt: getImageAlt(item, selectedImage),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} - KnowLens AI`,
      description,
      images: [imageUrl],
    },
  };
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
  const videoDimensions = getVideoAssetDimensions(videoAsset);
  const videoPlayerClassName = videoDimensions.isPortrait
    ? "mx-auto h-[min(78vh,760px)] w-auto max-w-full rounded-xl bg-black"
    : "mx-auto max-h-[78vh] w-full max-w-5xl rounded-xl bg-black";
  const videoPlayerStyle = {
    aspectRatio: `${videoDimensions.width} / ${videoDimensions.height}`,
  };
  const scriptAssets = imageAssets.filter((asset) => asset.title.trim() || asset.description.trim());
  const mediaTitle = hasPublishedVideo
    ? item.title
    : isVideo
      ? videoAsset
        ? item.title
        : "Video file is not available yet"
      : selectedImage?.title || item.title;
  const isImageDetail = !hasPublishedVideo && !isVideo;
  const templateTitle = isImageDetail ? getInfographicTitle(item.title) : item.title;
  const topicName = getTopicName(selectedImage?.title || item.title);
  const shortDescription = getShortDescription(item);
  const canonicalUrl = `${SITE_URL}/cases/${encodeURIComponent(item.slug)}`;
  const templatePrompt = getTemplatePrompt(item, selectedImage);
  const imageAlt = getImageAlt(item, selectedImage);
  const previewImageUrl = absoluteUrl(item.coverUrl || selectedImage?.fileUrl || "/picture/knowlens-hero.png");
  const faqItems = [
    {
      question: `What is included in this ${topicName} infographic template?`,
      answer:
        "The page includes a protected preview image, a concise description, template details, and a prompt for creating a similar visual with KnowLens AI.",
    },
    {
      question: "Can I download this infographic from the detail page?",
      answer:
        "No. Direct browser download is disabled on public image detail pages. You can share the page URL or create a similar infographic from the prompt.",
    },
    {
      question: "Can I create a similar infographic?",
      answer:
        "Yes. Use the Create similar infographic button to open KnowLens with a prepared prompt that you can adjust before generating a new visual.",
    },
  ];
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: templateTitle,
        url: canonicalUrl,
        description: shortDescription,
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: previewImageUrl,
          width: selectedImage?.width || 1200,
          height: selectedImage?.height || 900,
          caption: `${templateTitle} created with KnowLens AI.`,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Infographic", item: `${SITE_URL}/infographic-examples` },
          { "@type": "ListItem", position: 3, name: item.category || "Template", item: canonicalUrl },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: faqItems.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
    ],
  };

  return (
    <MarketingChrome>
      <main className="px-4 py-8 text-zinc-900 sm:px-6 lg:px-12">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <div className="mx-auto w-full max-w-6xl">
          <nav className="mb-4 flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-500">
            <Link href="/" className="hover:text-zinc-900">Home</Link>
            <span>/</span>
            <Link href="/infographic-examples" className="hover:text-zinc-900">Infographic</Link>
            <span>/</span>
            <span className="text-zinc-700">{item.category}</span>
          </nav>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                KnowLens.ai · {formatType(hasPublishedVideo ? "video" : item.outputType)}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{templateTitle}</h1>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{shortDescription}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1">{item.category}</span>
                {selectedImage ? (
                  <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1">
                    {getAspectRatio(selectedImage)}
                  </span>
                ) : null}
                {isImageDetail ? (
                  <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1">
                    Clean Educational Style
                  </span>
                ) : null}
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
            <PublishedPptViewer
              assets={imageAssets}
              initialIndex={selectedImageIndex}
              title={item.title}
              itemLabel="Slide"
              description={shortDescription}
              canonicalUrl={canonicalUrl}
              templatePrompt={templatePrompt}
              imageAlt={imageAlt}
            />
          ) : !isVideo && imageAssets.length ? (
            <PublishedPptViewer
              assets={imageAssets}
              initialIndex={selectedImageIndex}
              title={templateTitle}
              itemLabel="Poster"
              description={shortDescription}
              canonicalUrl={canonicalUrl}
              templatePrompt={templatePrompt}
              imageAlt={imageAlt}
            />
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
                    className={videoPlayerClassName}
                    style={videoPlayerStyle}
                  />
                ) : isVideo ? (
                  videoAsset ? (
                    <PublishedVideoPlayer
                      src={videoAsset.fileUrl}
                      poster={item.coverUrl || selectedImage?.fileUrl || videoAsset.thumbnailUrl || undefined}
                      title={item.title}
                      className={videoPlayerClassName}
                      style={videoPlayerStyle}
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
                ) : (
                  <div className="rounded-xl border border-dashed border-white/20 px-4 py-16 text-center text-sm text-white/70">
                    This case has no public files yet.
                  </div>
                )}
              </div>
            </section>
          )}

          {isImageDetail ? (
            <>
              <section className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Template Details</h2>
                  <dl className="mt-4 space-y-3 text-sm">
                    {[
                      ["Category", item.category],
                      ["Topic", topicName],
                      ["Aspect Ratio", getAspectRatio(selectedImage)],
                      ["Style", "Clean Educational"],
                      ["Best for", "lessons, presentations, social posts, product explainers, and visual learning materials"],
                      ["Template Type", "Infographic"],
                    ].map(([label, value]) => (
                      <div key={label} className="grid gap-1 border-b border-zinc-100 pb-3 last:border-0 last:pb-0">
                        <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</dt>
                        <dd className="leading-6 text-zinc-800">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold tracking-tight text-zinc-950">About this infographic</h2>
                  <div className="mt-3 space-y-4 text-sm leading-7 text-zinc-700">
                    <p>
                      This {topicName.toLowerCase()} infographic template helps explain a focused topic in a clear
                      visual format. It is designed for learners, educators, creators, and teams who need to turn
                      complex information into an easy-to-understand visual.
                    </p>
                    <p>
                      The layout uses readable labels, structured sections, and visual hierarchy to support lessons,
                      presentations, social media posts, product explainers, and visual learning materials. You can use
                      the prompt from this template to create a similar infographic with KnowLens AI. For users starting
                      from their own notes, KnowLens works as an AI Infographic Generator for structured visual content.
                    </p>
                  </div>
                </div>
              </section>

              <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold tracking-tight text-zinc-950">
                  What this {topicName.toLowerCase()} infographic explains
                </h2>
                <ul className="mt-4 grid gap-3 text-sm leading-6 text-zinc-700 sm:grid-cols-2">
                  {[
                    selectedImage?.title || `The main idea behind ${topicName}`,
                    selectedImage?.description || "How the topic can be organized into clear visual sections",
                    "Where labels, callouts, and hierarchy guide readers through the explanation",
                    "How the same prompt can be adapted for a related visual learning topic",
                  ].map((point) => (
                    <li key={point} className="flex gap-3 rounded-xl bg-zinc-50 p-3">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-950 p-5 text-white shadow-sm sm:p-6">
                <h2 className="text-xl font-semibold tracking-tight">Create a similar infographic with AI</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300">
                  Use the prompt behind this infographic to create a similar visual in KnowLens AI. The prompt will be
                  added to the input box automatically, so you can adjust the topic, style, or structure before
                  generating a new design.
                </p>
                <Link
                  href={`/app?prompt=${encodeURIComponent(templatePrompt)}`}
                  className="mt-5 inline-flex h-11 items-center rounded-xl bg-white px-4 text-sm font-semibold text-zinc-950 hover:bg-zinc-100"
                >
                  Create similar infographic
                </Link>
              </section>

              <section className="mt-6 grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Explore related infographic categories</h2>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      ["Educational Infographic Templates", "/educational-infographic-maker"],
                      ["Process Infographic Templates", "/process-infographic-generator"],
                      ["Recipe Infographic Templates", "/recipe-infographic-maker"],
                      ["Infographic Examples", "/infographic-examples"],
                    ].map(([label, href]) => (
                      <Link
                        key={href}
                        href={href}
                        className="rounded-full border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Related AI infographic tools</h2>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      ["AI Infographic Generator", "/app"],
                      ["Educational Infographic Maker", "/educational-infographic-maker"],
                      ["Process Infographic Generator", "/process-infographic-generator"],
                      ["Recipe Infographic Maker", "/recipe-infographic-maker"],
                    ].map(([label, href]) => (
                      <Link
                        key={href}
                        href={href}
                        className="rounded-full border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>
              </section>

              <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold tracking-tight text-zinc-950">FAQ</h2>
                <div className="mt-4 divide-y divide-zinc-100">
                  {faqItems.map((faq) => (
                    <div key={faq.question} className="py-4 first:pt-0 last:pb-0">
                      <h3 className="text-sm font-semibold text-zinc-950">{faq.question}</h3>
                      <p className="mt-2 text-sm leading-6 text-zinc-600">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </section>
            </>
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
