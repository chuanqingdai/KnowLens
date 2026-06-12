import type { PublishedCaseAssetRow, PublishedCaseRow } from "@/lib/server/published-cases";

const SITE_URL = "https://knowlens.ai";

const generatorKeywordMap: Record<string, string[]> = {
  biology: ["Biology Infographic Generator", "Science Infographic Generator", "Educational Infographic Maker", "AI Infographic Generator"],
  process: ["Process Infographic Generator", "Flowchart Infographic Maker", "AI Infographic Generator"],
  education: ["Educational Infographic Maker", "Text to Infographic Generator", "AI Infographic Generator"],
  recipe: ["Recipe Infographic Maker", "AI Infographic Generator"],
  technology: ["AI Infographic Generator", "Technology Infographic Generator", "AI Poster Generator"],
  default: ["AI Infographic Generator", "Text to Infographic Generator", "Knowledge Infographic Generator"],
};

const categoryUseCases: Record<string, string[]> = {
  biology: ["classroom materials", "study guides", "science presentations", "visual learning posts"],
  process: ["workflow documentation", "training guides", "operations playbooks", "process presentations"],
  education: ["lesson materials", "student handouts", "classroom posters", "learning summaries"],
  recipe: ["recipe cards", "cooking guides", "menu content", "food social posts"],
  default: ["learning materials", "presentations", "social media posts", "knowledge summaries"],
};

const categoryAudience: Record<string, string[]> = {
  biology: ["students", "teachers", "science creators", "biology learners"],
  process: ["teams", "operators", "trainers", "product managers"],
  education: ["students", "teachers", "course creators", "parents"],
  recipe: ["home cooks", "food creators", "recipe writers", "culinary students"],
  default: ["students", "teachers", "creators", "teams"],
};

export type EnrichedImageSeo = {
  categorySlug: string;
  categoryName: string;
  categoryKeyword: string;
  topicName: string;
  slug: string;
  detailPath: string;
  canonicalUrl: string;
  previewImageUrl: string;
  imageFilename: string;
  imageFormat: string;
  imageMimeType: string;
  imageWidth: number | null;
  imageHeight: number | null;
  aspectRatio: string;
  imageAlt: string;
  imageTitle: string;
  imageCaption: string;
  imageDescription: string;
  seoTitle: string;
  metaDescription: string;
  h1: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  generatorKeywords: string[];
  visibleDescription: string;
  shortDescription: string;
  knowledgePoints: string[];
  useCases: string[];
  targetAudience: string[];
  tags: string[];
  styleName: string;
  stylePrompt: string;
  topicPrompt: string;
  visualPrompt: string;
  finalPrompt: string;
  createSimilarPrompt: string;
  allowPublicDownload: false;
  needsImageUrl: boolean;
  needsAssetTransfer: boolean;
  needsAssetRename: boolean;
};

function clean(value: unknown, max = 500) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function stripInfographicWords(value: string) {
  return clean(value)
    .replace(/\b(infographic|poster|template|case|visual|image)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCategorySlug(input: string) {
  const raw = clean(input || "general", 80).toLowerCase();
  if (raw.includes("bio")) return "biology";
  if (raw.includes("process") || raw.includes("workflow")) return "process";
  if (raw.includes("educat") || raw.includes("class")) return "education";
  if (raw.includes("recipe") || raw.includes("cook") || raw.includes("food")) return "recipe";
  if (raw.includes("tech")) return "technology";
  if (raw.includes("earth") || raw.includes("geography")) return "earth-science";
  return raw.replace(/&/g, " and ").replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "general";
}

export function toTitleCaseFromSlug(slug: string) {
  return normalizeCategorySlug(slug).split("-").map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(" ");
}

export function buildTemplateSlug(title: string) {
  return clean(title, 140).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "infographic";
}

export function ensureInfographicSuffix(slug: string) {
  return /(^|-)infographic($|-)/.test(slug) ? slug : `${slug}-infographic`;
}

function absoluteUrl(path: string) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function extensionFromUrl(url: string, mimeType?: string) {
  const pathPart = url.split("?")[0] || "";
  const ext = pathPart.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (ext) return ext === "jpeg" ? "jpg" : ext;
  if (mimeType?.includes("webp")) return "webp";
  if (mimeType?.includes("jpeg") || mimeType?.includes("jpg")) return "jpg";
  return "png";
}

function aspectFromDimensions(width?: number | null, height?: number | null) {
  const w = Number(width || 0);
  const h = Number(height || 0);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return "unknown";
  const ratio = w / h;
  if (Math.abs(ratio - 16 / 9) < 0.08) return "16:9";
  if (Math.abs(ratio - 9 / 16) < 0.08) return "9:16";
  if (Math.abs(ratio - 1) < 0.08) return "1:1";
  if (Math.abs(ratio - 4 / 5) < 0.08) return "4:5";
  return w > h ? "landscape" : "portrait";
}

export function isFieldMissing(value: unknown) {
  if (value == null) return true;
  const text = clean(value, 120).toLowerCase();
  return !text || ["image", "poster", "untitled", "generated image"].includes(text);
}

export function isProviderTemporaryUrl(url: string) {
  const value = clean(url, 4000).toLowerCase();
  return /(oaidalle|replicate\.delivery|fal\.media|filesystem\.site|x-amz-|expires=|signature=|token=)/i.test(value);
}

function isImageAsset(asset: PublishedCaseAssetRow) {
  const mimeType = asset.mimeType.toLowerCase();
  return !mimeType.startsWith("video/") && !/\.mp4(?:$|\?)/i.test(asset.fileUrl) && !/\.pptx?(?:$|\?)/i.test(asset.fileUrl);
}

function getPrimaryAsset(item: PublishedCaseRow, preferredAsset?: string) {
  const assets = (item.assets || []).filter(isImageAsset);
  return assets.find((asset) => asset.slug === preferredAsset || asset.id === preferredAsset) || assets.find((asset) => asset.isPrimary) || assets[0] || null;
}

function inferTopicName(item: PublishedCaseRow, asset: PublishedCaseAssetRow | null) {
  const fromAsset = stripInfographicWords(asset?.title || "");
  const fromCase = stripInfographicWords(item.title || "");
  const fallback = `${toTitleCaseFromSlug(normalizeCategorySlug(item.category))} Infographic`;
  return fromAsset || fromCase || fallback;
}

function generateKnowledgePoints(topicName: string, categorySlug: string) {
  if (categorySlug === "process") return ["starting inputs", "ordered steps", "decision points", "handoffs", "final outcome"];
  if (categorySlug === "biology") return ["main structures", "core functions", "relationships", "labels", "learning summary"];
  if (categorySlug === "recipe") return ["ingredients", "prep steps", "cooking sequence", "serving notes", "visual timing"];
  if (categorySlug === "education") return ["core concept", "key facts", "examples", "summary", "review points"];
  return [`${topicName} overview`, "key sections", "readable labels", "visual hierarchy", "main takeaway"];
}

function generateTags(topicName: string, categorySlug: string) {
  const topicTags = buildTemplateSlug(topicName).split("-").filter((part) => part.length > 2);
  return Array.from(new Set([categorySlug, "infographic", "template", "visual-learning", ...topicTags])).slice(0, 10);
}

function selectStyleName(categorySlug: string) {
  if (categorySlug === "biology" || categorySlug === "earth-science") return "Clean Scientific Diagram";
  if (categorySlug === "process") return "Modern Process Flow";
  if (categorySlug === "recipe") return "Editorial Recipe Card";
  return "Clean Educational Infographic";
}

function getStylePrompt(styleName: string) {
  return `${styleName} style with readable English labels, structured sections, balanced spacing, and clear visual hierarchy.`;
}

export function buildPublishedCaseImageSeo(item: PublishedCaseRow, preferredAsset?: string): EnrichedImageSeo {
  const asset = getPrimaryAsset(item, preferredAsset);
  const categorySlug = normalizeCategorySlug(item.category);
  const categoryName = toTitleCaseFromSlug(categorySlug);
  const topicName = inferTopicName(item, asset);
  const slug = ensureInfographicSuffix(buildTemplateSlug(item.slug || topicName));
  const detailPath = `/cases/${encodeURIComponent(item.slug || slug)}`;
  const canonicalUrl = absoluteUrl(detailPath);
  const previewImageUrl = absoluteUrl(asset?.thumbnailUrl || asset?.fileUrl || item.coverUrl || "");
  const imageFormat = extensionFromUrl(previewImageUrl, asset?.mimeType);
  const imageFilename = `${categorySlug}-${slug}.${imageFormat}`;
  const imageWidth = asset?.width || null;
  const imageHeight = asset?.height || null;
  const aspectRatio = aspectFromDimensions(imageWidth, imageHeight);
  const knowledgePoints = generateKnowledgePoints(topicName, categorySlug);
  const useCases = categoryUseCases[categorySlug] || categoryUseCases.default;
  const targetAudience = categoryAudience[categorySlug] || categoryAudience.default;
  const generatorKeywords = generatorKeywordMap[categorySlug] || generatorKeywordMap.default;
  const primaryKeyword = /infographic/i.test(topicName) ? topicName : `${topicName} Infographic`;
  const imageTitle = `${primaryKeyword} Template`;
  const imageDescription = `This ${primaryKeyword.toLowerCase()} explains ${knowledgePoints.slice(0, 3).join(", ")} with a clear visual structure for ${targetAudience.slice(0, 3).join(", ")}.`;
  const metaDescription = item.description && item.description.length >= 40
    ? item.description
    : `Explore this ${primaryKeyword.toLowerCase()} template for ${categoryName.toLowerCase()} learning. Create a similar visual with KnowLens AI.`;
  const styleName = selectStyleName(categorySlug);
  const stylePrompt = getStylePrompt(styleName);
  const topicPrompt = `Create an educational infographic about ${topicName}. Cover ${knowledgePoints.join(", ")}.`;
  const visualPrompt = `Show ${topicName} as a structured infographic with a strong main visual, concise labels, section blocks, arrows or connectors where useful, and a clear reading order.`;
  const finalPrompt = `${stylePrompt} ${topicPrompt} ${visualPrompt} Aspect ratio: ${aspectRatio}. Avoid clutter, unreadable text, watermarks, download UI, and provider metadata.`;
  const createSimilarPrompt = `Create an educational infographic about ${topicName}. Explain ${knowledgePoints[0]} with clear sections, concise English labels, and a structured visual layout. Use ${styleName}. Aspect ratio: ${aspectRatio}. Include the key points: ${knowledgePoints.slice(0, 4).join(", ")}. Main visual idea: ${visualPrompt}`;
  return {
    categorySlug,
    categoryName,
    categoryKeyword: `${categoryName} Infographic Templates`,
    topicName,
    slug,
    detailPath,
    canonicalUrl,
    previewImageUrl,
    imageFilename,
    imageFormat,
    imageMimeType: asset?.mimeType || "image/png",
    imageWidth,
    imageHeight,
    aspectRatio,
    imageAlt: `${primaryKeyword} showing ${knowledgePoints.slice(0, 3).join(", ")}`,
    imageTitle,
    imageCaption: `${primaryKeyword} - a ${categoryName.toLowerCase()} infographic example created with KnowLens AI.`,
    imageDescription,
    seoTitle: `${imageTitle} - KnowLens AI`,
    metaDescription,
    h1: imageTitle,
    primaryKeyword,
    secondaryKeywords: [`${topicName} visual guide`, `${categoryName} infographic example`, `${topicName} learning visual`],
    generatorKeywords,
    visibleDescription: metaDescription,
    shortDescription: metaDescription,
    knowledgePoints,
    useCases,
    targetAudience,
    tags: generateTags(topicName, categorySlug),
    styleName,
    stylePrompt,
    topicPrompt,
    visualPrompt,
    finalPrompt,
    createSimilarPrompt,
    allowPublicDownload: false,
    needsImageUrl: !previewImageUrl,
    needsAssetTransfer: isProviderTemporaryUrl(previewImageUrl),
    needsAssetRename: Boolean(asset?.fileUrl) && !asset.fileUrl.toLowerCase().includes(imageFilename.toLowerCase()),
  };
}

export function buildPublishedCaseJsonLd(seo: EnrichedImageSeo) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: seo.h1,
        url: seo.canonicalUrl,
        description: seo.metaDescription,
        primaryImageOfPage: {
          "@type": "ImageObject",
          name: seo.imageTitle,
          description: seo.imageDescription,
          contentUrl: seo.previewImageUrl,
          thumbnailUrl: seo.previewImageUrl,
          width: seo.imageWidth || undefined,
          height: seo.imageHeight || undefined,
          caption: seo.imageCaption,
          creator: { "@type": "Organization", name: "KnowLens AI" },
          creditText: "Created with KnowLens AI",
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: seo.categoryName, item: `${SITE_URL}/infographic-examples` },
          { "@type": "ListItem", position: 3, name: seo.h1, item: seo.canonicalUrl },
        ],
      },
    ],
  };
}
