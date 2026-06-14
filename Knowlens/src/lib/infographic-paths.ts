function cleanSegment(value: string | null | undefined) {
  return String(value || "").trim();
}

export function normalizeInfographicCategorySlug(category?: string | null) {
  const raw = cleanSegment(category).toLowerCase();

  if (!raw) return null;
  if (raw.includes("history")) return "history";
  if (raw.includes("biology")) return "biology";
  if (raw.includes("earth") || raw.includes("geography")) return "earth-science";
  if (
    raw.includes("financial-report") ||
    raw.includes("financial report") ||
    raw.includes("market report") ||
    raw.includes("earnings") ||
    raw.includes("economics")
  ) {
    return "financial-report";
  }
  if (raw.includes("process") || raw.includes("workflow")) return "process";
  if (raw.includes("recipe") || raw.includes("food") || raw.includes("cook")) return "recipe";
  if (raw.includes("comparison") || raw.includes("versus") || raw.includes("vs")) return "comparison";
  if (raw.includes("roadmap")) return "roadmap";
  if (raw.includes("astronomy")) return "astronomy";
  if (raw.includes("insurance")) return "insurance";
  if (raw.includes("industry-report") || raw.includes("industry report")) return "industry-report";
  if (raw.includes("sex-education") || raw.includes("sex education")) return "sex-education";

  return null;
}

export function getInfographicDetailPath(input: {
  category?: string | null;
  slug?: string | null;
  asset?: string | null;
}) {
  const categorySlug = normalizeInfographicCategorySlug(input.category);
  const slug = cleanSegment(input.slug);

  if (!categorySlug || !slug) {
    return null;
  }

  const basePath = `/infographic/${encodeURIComponent(categorySlug)}/${encodeURIComponent(slug)}/`;
  const asset = cleanSegment(input.asset);

  if (!asset) {
    return basePath;
  }

  return `${basePath}?asset=${encodeURIComponent(asset)}`;
}
