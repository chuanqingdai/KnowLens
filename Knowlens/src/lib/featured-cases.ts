"use client";

export type FeaturedCaseFormat = "Poster" | "PPT" | "Video" | "海报" | "视频";

export type FeaturedCaseItem = {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  author: string;
  views: number;
  likes: number;
  cover: string;
  coverWidth: number;
  coverHeight: number;
  format: FeaturedCaseFormat;
  duration?: string;
  category: string;
  order: number;
  publicCaseSlug?: string;
  assets?: Array<{
    id: string;
    slug: string;
    title: string;
    description?: string;
    fileUrl: string;
    viewerUrl: string;
    downloadUrl: string;
    thumbnailUrl?: string;
    mimeType?: string;
    pageIndex?: number;
  }>;
};

export type FeaturedCaseKind = "poster" | "ppt" | "video";

export const featuredCategories = [
  "All",
  "Astronomy",
  "Economics",
  "History",
  "Biology",
  "Geography",
  "Medicine",
];

type EnPictureManifestItem = {
  cover: string;
  coverWidth: number;
  coverHeight: number;
};

const enPictureManifest: EnPictureManifestItem[] = [
  { cover: "/en-picture/09a696ff-eee9-42ec-87bf-050f39bb8161.png", coverWidth: 935, coverHeight: 1683 },
  { cover: "/en-picture/31655dbf-c0be-41cd-99e2-c5fda2d104c0.png", coverWidth: 941, coverHeight: 1672 },
  { cover: "/en-picture/c2b3c799-28c9-4267-a18e-fe3145449df7.png", coverWidth: 1672, coverHeight: 941 },
  { cover: "/en-picture/astronomy/1117c95b-ae2a-46e1-9e1a-d86cf24389ff.png", coverWidth: 941, coverHeight: 1672 },
  { cover: "/en-picture/astronomy/50e14521-ba97-4f9d-9522-16398a1002e4.png", coverWidth: 941, coverHeight: 1672 },
  { cover: "/en-picture/astronomy/63f2d8b5-da95-4f3c-9e02-46a61519071d.png", coverWidth: 941, coverHeight: 1672 },
  { cover: "/en-picture/astronomy/86c7f88d-8692-40f6-a32d-bcba57ff8b83.png", coverWidth: 941, coverHeight: 1672 },
  { cover: "/en-picture/astronomy/a2c915b3-9cfd-4c96-a208-395fa392f352.png", coverWidth: 1254, coverHeight: 1254 },
  { cover: "/en-picture/astronomy/b8004ab1-318e-4e4f-87b6-cc8774adcf70.png", coverWidth: 1122, coverHeight: 1402 },
  { cover: "/en-picture/astronomy/b819b5e4-3b32-4d82-ae43-05a645777580.png", coverWidth: 948, coverHeight: 1659 },
  { cover: "/en-picture/astronomy/cf744b5e-0612-447b-9aa6-fb1a91363bb1.png", coverWidth: 962, coverHeight: 1635 },
  { cover: "/en-picture/astronomy/f76a1c67-0406-42f7-b04a-6051d218a244.png", coverWidth: 941, coverHeight: 1672 },
  { cover: "/en-picture/astronomy/f811316c-2452-4a84-8785-c6de347998d4.png", coverWidth: 941, coverHeight: 1672 },
  { cover: "/en-picture/ce307920-892e-46eb-a193-fe228d4b9c31.png", coverWidth: 1672, coverHeight: 941 },
  { cover: "/en-picture/bb1c135b-48aa-4bb7-b007-de1e00164d1f.png", coverWidth: 1024, coverHeight: 1536 },
  { cover: "/en-picture/biology/09222a94-ab66-4ba1-8b95-f28ac121f083.png", coverWidth: 941, coverHeight: 1672 },
  { cover: "/en-picture/biology/3e6947fd-b03e-4dc7-8551-b22bfeefa148.png", coverWidth: 1086, coverHeight: 1448 },
  { cover: "/en-picture/biology/74380d3a-9a1b-44a2-998a-7c3482175ff4.png", coverWidth: 941, coverHeight: 1672 },
  { cover: "/en-picture/biology/7cab15b6-aadd-40d6-8713-0d503e6bddd8.png", coverWidth: 941, coverHeight: 1672 },
  { cover: "/en-picture/biology/c03468d1-6e9d-4808-9a69-2a3852412d0b.png", coverWidth: 941, coverHeight: 1672 },
  { cover: "/en-picture/biology/d64c1b7c-e35d-4ff9-8753-03a3df83eded.png", coverWidth: 941, coverHeight: 1672 },
  { cover: "/en-picture/biology/e89085e6-c6c5-44f3-a92b-08fd81742821.png", coverWidth: 1122, coverHeight: 1402 },
  { cover: "/en-picture/economics/3e26f31b-fb9c-4855-8a32-d14e060ea98c.png", coverWidth: 941, coverHeight: 1672 },
  { cover: "/en-picture/economics/54e27873-5d54-4ee0-a6f1-bc86e227e776.png", coverWidth: 1122, coverHeight: 1402 },
  { cover: "/en-picture/economics/7b57ec95-b403-4468-a6f8-f69e80aa9ab4.png", coverWidth: 1055, coverHeight: 1491 },
  { cover: "/en-picture/economics/ab1011e9-8b90-4242-89ef-32e3e55c181a.png", coverWidth: 1122, coverHeight: 1402 },
  { cover: "/en-picture/economics/d8f822d6-8d32-4f4a-8b43-7f7eb7559a41.png", coverWidth: 1122, coverHeight: 1402 },
  { cover: "/en-picture/geography/8f861cf8-f326-4dcd-9c54-e1673f2caf13.png", coverWidth: 941, coverHeight: 1672 },
  { cover: "/en-picture/geography/9196a45a-db9e-4a54-ba51-d8d47ae5ce22.png", coverWidth: 941, coverHeight: 1672 },
  { cover: "/en-picture/geography/94a41a11-5983-4b03-924c-e1e47aa8d945.png", coverWidth: 941, coverHeight: 1672 },
  { cover: "/en-picture/geography/cc6ab14a-746b-4bee-a524-8aabfea0d3e3.png", coverWidth: 1086, coverHeight: 1448 },
  { cover: "/en-picture/geography/e4dfba8b-93d9-4049-b771-cde0f4a7d171.png", coverWidth: 971, coverHeight: 1619 },
  { cover: "/en-picture/geography/edcc7487-a7a9-485f-9ae0-846012baabd5.png", coverWidth: 1055, coverHeight: 1491 },
  { cover: "/en-picture/17e1c7f5-b04e-4e54-88af-787c79d1e8e3.png", coverWidth: 1672, coverHeight: 941 },
  { cover: "/en-picture/history/6947dd95-5dae-4cc7-ba84-b44dc1834025.png", coverWidth: 1122, coverHeight: 1402 },
  { cover: "/en-picture/history/88e45522-e408-429c-b670-92c62faa47d9.png", coverWidth: 941, coverHeight: 1672 },
  { cover: "/en-picture/history/b09d63d7-b6d4-4ff7-87e4-aad50d709b9d.png", coverWidth: 1024, coverHeight: 1536 },
  { cover: "/en-picture/mdeicine/15454ff0-b0e6-46b9-bc2a-787cb8ff2080.png", coverWidth: 941, coverHeight: 1672 },
  { cover: "/en-picture/mdeicine/1c815b64-9ec1-4f82-8283-f36af3dd23a7.png", coverWidth: 948, coverHeight: 1659 },
  { cover: "/en-picture/mdeicine/85c2319e-5e8e-4ec4-b12e-bc8984b19be1.png", coverWidth: 1122, coverHeight: 1402 },
  { cover: "/en-picture/mdeicine/8bc4b336-ba9f-4216-9667-76a12634b0b9.png", coverWidth: 941, coverHeight: 1672 },
  { cover: "/en-picture/mdeicine/b330ca2f-9d08-4389-856b-573c607f4628.png", coverWidth: 941, coverHeight: 1672 },
];

const landscapeCategoryByCover: Record<string, string> = {
  "1117c95b-ae2a-46e1-9e1a-d86cf24389ff": "Astronomy",
  "154c78f5-0f9e-47d6-b295-94862ba4173d": "Economics",
  "31655dbf-c0be-41cd-99e2-c5fda2d104c0": "Medicine",
  "3e6947fd-b03e-4dc7-8551-b22bfeefa148": "Biology",
  "4f1b5084-73a3-4163-8ac7-439b8c842f2c": "History",
  "85c2319e-5e8e-4ec4-b12e-bc8984b19be1": "Medicine",
  "e06c70f4-5425-4c1d-a4aa-eb36bca3e504": "Geography",
};

function titleFromCoverPath(path: string) {
  const raw = path.split("/").pop()?.replace(".png", "") ?? "featured-case";
  return raw
    .split("-")
    .filter(Boolean)
    .slice(0, 4)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function categoryFromCoverPath(path: string) {
  if (path.includes("/landscape/")) {
    const raw = path.split("/").pop()?.replace(".png", "") ?? "";
    const key = raw.replace(/-16x9$/i, "");
    return landscapeCategoryByCover[key] ?? "All";
  }
  if (path.includes("/astronomy/")) {
    return "Astronomy";
  }
  if (path.includes("/economics/")) {
    return "Economics";
  }
  if (path.includes("/history/")) {
    return "History";
  }
  if (path.includes("/biology/")) {
    return "Biology";
  }
  if (path.includes("/geography/")) {
    return "Geography";
  }
  if (path.includes("/physics/")) {
    return "Physics";
  }
  if (path.includes("/mdeicine/")) {
    return "Medicine";
  }
  return "All";
}

const categoryAuthorMap: Record<string, string> = {
  Astronomy: "Dr. Ethan Cole",
  Economics: "Maya Brooks",
  History: "Olivia Carter",
  Biology: "Noah Bennett",
  Geography: "Liam Walker",
  Physics: "Ava Reed",
  Medicine: "Dr. Sophia Lin",
  All: "Jordan Hayes",
};

function authorFromCategory(category: string) {
  return categoryAuthorMap[category] ?? categoryAuthorMap.All;
}

const categoryAliasMap: Record<string, string> = {
  全部: "All",
  综合: "All",
  天文: "Astronomy",
  经济: "Economics",
  历史: "History",
  生物: "Biology",
  地理: "Geography",
  医学: "Medicine",
};

export function normalizeCategoryLabel(category: string) {
  return categoryAliasMap[category] ?? category;
}

export function normalizeFormatLabel(format: FeaturedCaseFormat | string) {
  if (format === "海报") {
    return "Poster";
  }
  if (format === "视频") {
    return "Video";
  }
  return format;
}

export function isVideoFormat(format: FeaturedCaseFormat | string) {
  return format === "Video" || format === "视频";
}

export function formatToKind(format: FeaturedCaseFormat | string): FeaturedCaseKind {
  const normalized = normalizeFormatLabel(format);
  if (normalized === "PPT") {
    return "ppt";
  }
  if (normalized === "Video") {
    return "video";
  }
  return "poster";
}

export function toSeoSlugFromTitle(title: string) {
  const normalized = title
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "featured-case";
}

export function getFeaturedSlug(item: FeaturedCaseItem) {
  const base = toSeoSlugFromTitle(item.title);
  const shortId = item.id.replace(/^featured-/, "").slice(-6).toLowerCase();
  return `${base}-${shortId}`;
}

export function getFeaturedDetailPath(item: FeaturedCaseItem) {
  return `/${formatToKind(item.format)}/${encodeURIComponent(getFeaturedSlug(item))}`;
}

export function getResolvedFeaturedCases() {
  const deduped = enPictureManifest.filter((item, index, source) => {
    const normalizedKey = item.cover
      .replace("/landscape/", "/")
      .replace(/-16x9(?=\.png$)/i, "");
    return source.findIndex((entry) => {
      const entryKey = entry.cover
        .replace("/landscape/", "/")
        .replace(/-16x9(?=\.png$)/i, "");
      return entryKey === normalizedKey;
    }) === index;
  });

  return deduped.map((item, index) => {
    const title = titleFromCoverPath(item.cover);
    const category = categoryFromCoverPath(item.cover);
    return {
      id: `en-${index + 1}`,
      projectId: `en-${index + 1}`,
      title,
      author: authorFromCategory(category),
      views: 1600 + ((index * 137) % 5200),
      likes: 120 + ((index * 29) % 420),
      cover: item.cover,
      coverWidth: item.coverWidth,
      coverHeight: item.coverHeight,
      format: "Poster" as const,
      category,
      order: index + 1,
    };
  });
}

export function getFeaturedCaseById(id: string) {
  return getResolvedFeaturedCases().find((item) => item.id === id) ?? null;
}

export function getFeaturedCaseBySlug(kind: FeaturedCaseKind, slug: string) {
  const target = decodeURIComponent(slug).toLowerCase();
  const candidates = getResolvedFeaturedCases().filter(
    (item) => formatToKind(item.format) === kind,
  );

  const exact = candidates.find((item) => getFeaturedSlug(item).toLowerCase() === target);
  if (exact) {
    return exact;
  }

  // Fallback for stale links where only the suffix segment changed.
  const targetBase = target.replace(/-[a-z0-9]+(?:-[a-z0-9]+)?$/, "");
  return (
    candidates.find((item) => {
      const base = toSeoSlugFromTitle(item.title).toLowerCase();
      return base === target || base === targetBase;
    }) ?? null
  );
}

type CaseMetric = {
  viewsDelta: number;
  likesDelta: number;
  liked: boolean;
};

const METRICS_KEY = "knowlens_featured_case_metrics_v1";

function normalizeScope(email?: string | null) {
  const value = (email ?? "").trim().toLowerCase();
  return value || "guest";
}

function scopedMetricKey(email?: string | null) {
  return `${METRICS_KEY}:${normalizeScope(email)}`;
}

function readMetrics(email?: string | null) {
  if (typeof window === "undefined") {
    return {} as Record<string, CaseMetric>;
  }
  try {
    const key = email ? scopedMetricKey(email) : METRICS_KEY;
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return {} as Record<string, CaseMetric>;
    }
    return JSON.parse(raw) as Record<string, CaseMetric>;
  } catch {
    return {} as Record<string, CaseMetric>;
  }
}

function writeMetrics(value: Record<string, CaseMetric>, email?: string | null) {
  if (typeof window === "undefined") {
    return;
  }
  const key = email ? scopedMetricKey(email) : METRICS_KEY;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getCaseMetrics(caseId: string, baseViews: number, baseLikes: number, email?: string | null) {
  const metric = readMetrics(email)[caseId];
  return {
    views: baseViews + (metric?.viewsDelta ?? 0),
    likes: baseLikes + (metric?.likesDelta ?? 0),
    liked: Boolean(metric?.liked),
  };
}

export function incrementCaseView(caseId: string, email?: string | null) {
  const current = readMetrics(email);
  const existing = current[caseId] ?? { viewsDelta: 0, likesDelta: 0, liked: false };
  current[caseId] = {
    ...existing,
    viewsDelta: existing.viewsDelta + 1,
  };
  writeMetrics(current, email);
}

export function toggleCaseLike(caseId: string, email?: string | null) {
  const current = readMetrics(email);
  const existing = current[caseId] ?? { viewsDelta: 0, likesDelta: 0, liked: false };
  const nextLiked = !existing.liked;
  current[caseId] = {
    ...existing,
    liked: nextLiked,
    likesDelta: existing.likesDelta + (nextLiked ? 1 : -1),
  };
  writeMetrics(current, email);
  return current[caseId];
}
