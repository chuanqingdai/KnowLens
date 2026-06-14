import { getAstronomyInfographicTemplates } from "@/lib/astronomy-infographic-templates";
import { getBiologyInfographicTemplates } from "@/lib/biology-infographic-templates";
import { getComparisonInfographicTemplates } from "@/lib/comparison-infographic-templates";
import { getEarthScienceInfographicTemplates } from "@/lib/earth-science-infographic-templates";
import { getFinanceInfographicTemplates } from "@/lib/finance-infographic-templates";
import { getHistoryInfographicTemplates } from "@/lib/history-infographic-templates";
import { getIndustryReportTemplates } from "@/lib/industry-report-templates";
import { getInsuranceInfographicTemplates } from "@/lib/insurance-infographic-templates";
import { getProcessInfographicTemplates } from "@/lib/process-infographic-templates";
import { getRecipeInfographicTemplates } from "@/lib/recipe-infographic-templates";
import { getRoadmapInfographicTemplates } from "@/lib/roadmap-infographic-templates";
import { getSexEducationInfographicTemplates } from "@/lib/sex-education-infographic-templates";

const siteUrl = "https://knowlens.ai";

export type InfographicDirectorySlug =
  | "science"
  | "biology"
  | "earth-science"
  | "process"
  | "recipe"
  | "history"
  | "business"
  | "education"
  | "comparison"
  | "financial-report"
  | "astronomy"
  | "insurance"
  | "industry-report"
  | "roadmap"
  | "sex-education";

export type InfographicDirectoryItem = {
  id: string;
  slug: string;
  title: string;
  topicName: string;
  shortDescription: string;
  detailPath: string;
  canonicalUrl: string;
  previewImageUrl: string;
  previewImagePath?: string;
  imageAlt: string;
  imageWidth: number;
  imageHeight: number;
  aspectRatio: string;
  styleName: string;
  updatedAt: string;
  categoryName: string;
  generationStatus?: string;
};

type InfographicDirectoryConfig = {
  slug: InfographicDirectorySlug;
  title: string;
  metaDescription: string;
  h1: string;
  intro: string;
  summary: string;
  badge: string;
  ctaHref: string;
  ctaLabel: string;
  keywords: string[];
  relatedLinks: Array<{ label: string; href: string }>;
};

function filterSuccessful<T extends { generationStatus?: string }>(items: T[]) {
  return items.filter((item) => !item.generationStatus || item.generationStatus === "success");
}

function toItems(items: Array<InfographicDirectoryItem>) {
  return filterSuccessful(items)
    .slice()
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

const templateCollections: Record<InfographicDirectorySlug, () => InfographicDirectoryItem[]> = {
  science: () =>
    toItems([
      ...getBiologyInfographicTemplates(),
      ...getEarthScienceInfographicTemplates(),
      ...getAstronomyInfographicTemplates(),
    ]),
  biology: () => toItems(getBiologyInfographicTemplates()),
  "earth-science": () => toItems(getEarthScienceInfographicTemplates()),
  process: () => toItems(getProcessInfographicTemplates()),
  recipe: () => toItems(getRecipeInfographicTemplates()),
  history: () => toItems(getHistoryInfographicTemplates()),
  business: () =>
    toItems([
      ...getFinanceInfographicTemplates(),
      ...getInsuranceInfographicTemplates(),
      ...getIndustryReportTemplates(),
      ...getRoadmapInfographicTemplates(),
    ]),
  education: () =>
    toItems([
      ...getBiologyInfographicTemplates(),
      ...getHistoryInfographicTemplates(),
      ...getEarthScienceInfographicTemplates(),
      ...getProcessInfographicTemplates(),
      ...getRecipeInfographicTemplates(),
    ]),
  comparison: () => toItems(getComparisonInfographicTemplates()),
  "financial-report": () => toItems(getFinanceInfographicTemplates()),
  astronomy: () => toItems(getAstronomyInfographicTemplates()),
  insurance: () => toItems(getInsuranceInfographicTemplates()),
  "industry-report": () => toItems(getIndustryReportTemplates()),
  roadmap: () => toItems(getRoadmapInfographicTemplates()),
  "sex-education": () => toItems(getSexEducationInfographicTemplates()),
};

const directoryConfigs: Record<InfographicDirectorySlug, InfographicDirectoryConfig> = {
  science: {
    slug: "science",
    title: "Science Infographic Examples | Visual Science Templates | KnowLens.ai",
    metaDescription:
      "Browse science infographic examples for biology, astronomy, and earth science topics. Explore readable templates, structured sections, and create-similar prompts on KnowLens.ai.",
    h1: "Science Infographic Examples",
    intro:
      "Explore science infographic examples built for visual learning, classroom study, and clear scientific explanation. These pages highlight readable labels, focused diagrams, and structured knowledge layouts that work well for both desktop and mobile viewing.",
    summary:
      "Browse biology, astronomy, and earth science templates with strong visual hierarchy, subject-focused diagrams, and create-similar prompts.",
    badge: "SCIENCE VISUAL LIBRARY",
    ctaHref: "/science-infographic-generator",
    ctaLabel: "Create a science infographic",
    keywords: [
      "science infographic examples",
      "science infographic templates",
      "science infographic generator",
      "visual science examples",
      "classroom science infographic",
    ],
    relatedLinks: [
      { label: "Biology Infographic Generator", href: "/biology-infographic-generator" },
      { label: "Earth Science Infographic Generator", href: "/earth-science-infographic-generator" },
      { label: "Infographic Examples", href: "/infographic-examples" },
    ],
  },
  biology: {
    slug: "biology",
    title: "Biology Infographic Examples | Biology Templates | KnowLens.ai",
    metaDescription:
      "Browse biology infographic examples covering cells, body systems, DNA, ecosystems, and classroom biology visuals. Open full detail pages and create similar visuals with KnowLens.ai.",
    h1: "Biology Infographic Examples",
    intro:
      "This biology infographic directory brings together published templates for cell structure, human anatomy, genetics, ecosystems, and other life science topics. Each example pairs a large image preview with readable descriptions, knowledge points, and a create-similar path.",
    summary:
      "Open biology templates for anatomy, genetics, ecosystems, and classroom-ready life science visuals.",
    badge: "LIFE SCIENCE EXAMPLES",
    ctaHref: "/biology-infographic-generator",
    ctaLabel: "Create a biology infographic",
    keywords: [
      "biology infographic examples",
      "biology infographic templates",
      "biology infographic generator",
      "life science infographic",
      "classroom biology visual",
    ],
    relatedLinks: [
      { label: "Science Infographic Examples", href: "/infographic/science" },
      { label: "Biology Infographic Generator", href: "/biology-infographic-generator" },
      { label: "Infographic Examples", href: "/infographic-examples" },
    ],
  },
  "earth-science": {
    slug: "earth-science",
    title: "Earth Science Infographic Examples | Earth System Templates | KnowLens.ai",
    metaDescription:
      "Browse earth science infographic examples about geology, weather, climate, and Earth systems. Open full detail pages and create similar templates with KnowLens.ai.",
    h1: "Earth Science Infographic Examples",
    intro:
      "These earth science infographic examples cover Earth layers, tectonics, atmosphere, weather patterns, and natural systems in a clear editorial format. The examples are structured for visual learning, teaching, and science communication without relying on dense text blocks.",
    summary:
      "Browse geology, climate, weather, and Earth system examples with strong structure and mobile-readable layouts.",
    badge: "EARTH SYSTEM LIBRARY",
    ctaHref: "/earth-science-infographic-generator",
    ctaLabel: "Create an earth science infographic",
    keywords: [
      "earth science infographic examples",
      "earth science templates",
      "earth system infographic",
      "geology infographic examples",
      "weather infographic templates",
    ],
    relatedLinks: [
      { label: "Earth Science Infographic Generator", href: "/earth-science-infographic-generator" },
      { label: "Science Infographic Examples", href: "/infographic/science" },
      { label: "Infographic Examples", href: "/infographic-examples" },
    ],
  },
  process: {
    slug: "process",
    title: "Process Infographic Examples | Step-by-Step Templates | KnowLens.ai",
    metaDescription:
      "Browse process infographic examples for workflows, manufacturing, decision flows, and step-by-step explanations. Explore full detail pages and create similar visuals with KnowLens.ai.",
    h1: "Process Infographic Examples",
    intro:
      "Process infographic examples help explain how something moves from one step to the next. This directory focuses on workflow visuals, manufacturing diagrams, training guides, and operational sequences built with clear stage labels, strong order, and readable spacing.",
    summary:
      "Browse process templates for workflows, production steps, tutorials, and operational guides.",
    badge: "STEP-BY-STEP EXAMPLES",
    ctaHref: "/process-infographic-generator",
    ctaLabel: "Create a process infographic",
    keywords: [
      "process infographic examples",
      "process infographic templates",
      "workflow infographic examples",
      "step by step infographic",
      "process infographic generator",
    ],
    relatedLinks: [
      { label: "Process Infographic Generator", href: "/process-infographic-generator" },
      { label: "Recipe Infographic Examples", href: "/infographic/recipe" },
      { label: "Infographic Examples", href: "/infographic-examples" },
    ],
  },
  recipe: {
    slug: "recipe",
    title: "Recipe Infographic Examples | Visual Recipe Cards | KnowLens.ai",
    metaDescription:
      "Browse recipe infographic examples with ingredients, prep steps, cooking order, and serving notes. Open full detail pages and create similar recipe cards with KnowLens.ai.",
    h1: "Recipe Infographic Examples",
    intro:
      "Recipe infographic examples turn ingredients and cooking steps into a readable visual card. These pages are useful for food creators, home cooks, classroom food content, and social-ready cooking summaries that need a clearer structure than a plain paragraph recipe.",
    summary:
      "Open visual recipe cards with ingredients, prep steps, cooking flow, and serving notes.",
    badge: "VISUAL RECIPE LIBRARY",
    ctaHref: "/recipe-infographic-maker",
    ctaLabel: "Create a recipe infographic",
    keywords: [
      "recipe infographic examples",
      "recipe infographic maker",
      "visual recipe card examples",
      "cooking infographic templates",
      "recipe process infographic",
    ],
    relatedLinks: [
      { label: "Recipe Infographic Maker", href: "/recipe-infographic-maker" },
      { label: "Process Infographic Examples", href: "/infographic/process" },
      { label: "Infographic Examples", href: "/infographic-examples" },
    ],
  },
  history: {
    slug: "history",
    title: "History Infographic Examples | Historical Timeline Templates | KnowLens.ai",
    metaDescription:
      "Browse history infographic examples covering civilizations, empires, revolutions, trade routes, and historical turning points. Open full detail pages and create similar visuals with KnowLens.ai.",
    h1: "History Infographic Examples",
    intro:
      "History infographic examples work best when they simplify chronology, causation, people, places, and long-term significance. This directory brings together published history pages designed for visual learning, online history explainers, and mobile-friendly summaries.",
    summary:
      "Browse published history templates for civilizations, revolutions, timelines, and major turning points.",
    badge: "HISTORY VISUAL LIBRARY",
    ctaHref: "/educational-infographic-maker",
    ctaLabel: "Create a history infographic",
    keywords: [
      "history infographic examples",
      "history infographic templates",
      "historical timeline infographic",
      "online history infographic",
      "history visual learning",
    ],
    relatedLinks: [
      { label: "Educational Infographic Maker", href: "/educational-infographic-maker" },
      { label: "Infographic Examples", href: "/infographic-examples" },
      { label: "Science Infographic Examples", href: "/infographic/science" },
    ],
  },
  business: {
    slug: "business",
    title: "Business Infographic Examples | Market and Report Templates | KnowLens.ai",
    metaDescription:
      "Browse business infographic examples for financial reports, insurance education, market insights, roadmaps, and industry explainers. Open detail pages and create similar visuals with KnowLens.ai.",
    h1: "Business Infographic Examples",
    intro:
      "Business infographic examples help turn dense information into readable report-style visuals. This directory groups together financial report infographics, insurance explainers, industry insight pages, and roadmap visuals with a stronger emphasis on structured sections and presentation-ready hierarchy.",
    summary:
      "Explore financial, insurance, industry, and roadmap templates designed for business communication.",
    badge: "BUSINESS VISUAL LIBRARY",
    ctaHref: "/infographic-maker",
    ctaLabel: "Create a business infographic",
    keywords: [
      "business infographic examples",
      "financial report infographic templates",
      "industry report infographic",
      "insurance infographic examples",
      "roadmap infographic examples",
    ],
    relatedLinks: [
      { label: "Infographic Maker", href: "/infographic-maker" },
      { label: "Financial Report Examples", href: "/infographic/financial-report" },
      { label: "Infographic Examples", href: "/infographic-examples" },
    ],
  },
  education: {
    slug: "education",
    title: "Education Infographic Examples | Classroom Visual Templates | KnowLens.ai",
    metaDescription:
      "Browse education infographic examples for classroom posters, study guides, lesson visuals, and structured knowledge summaries. Open full detail pages and create similar visuals with KnowLens.ai.",
    h1: "Education Infographic Examples",
    intro:
      "Education infographic examples are designed to support teaching, study, and structured visual explanation. This category combines science, history, process, and recipe learning formats that show how KnowLens examples can be used in classrooms, study guides, and training materials.",
    summary:
      "Browse classroom visuals, study guides, lesson explainers, and structured learning templates.",
    badge: "CLASSROOM VISUAL LIBRARY",
    ctaHref: "/educational-infographic-maker",
    ctaLabel: "Create an educational infographic",
    keywords: [
      "education infographic examples",
      "classroom infographic templates",
      "educational infographic maker",
      "study guide infographic",
      "lesson visual examples",
    ],
    relatedLinks: [
      { label: "Educational Infographic Maker", href: "/educational-infographic-maker" },
      { label: "Science Infographic Examples", href: "/infographic/science" },
      { label: "History Infographic Examples", href: "/infographic/history" },
    ],
  },
  comparison: {
    slug: "comparison",
    title: "Comparison Infographic Examples | Side-by-Side Templates | KnowLens.ai",
    metaDescription:
      "Browse comparison infographic examples for side-by-side visuals, pros and cons, and structured differences. Open detail pages and create similar comparison layouts with KnowLens.ai.",
    h1: "Comparison Infographic Examples",
    intro:
      "Comparison infographic examples are useful when one topic is easier to understand through similarities, differences, advantages, tradeoffs, or alternatives. These templates focus on side-by-side clarity instead of dense narrative copy.",
    summary: "Open side-by-side templates for choices, tradeoffs, alternatives, and visual comparisons.",
    badge: "SIDE-BY-SIDE EXAMPLES",
    ctaHref: "/infographic-maker",
    ctaLabel: "Create a comparison infographic",
    keywords: [
      "comparison infographic examples",
      "comparison infographic templates",
      "side by side infographic",
      "versus infographic examples",
    ],
    relatedLinks: [
      { label: "Infographic Maker", href: "/infographic-maker" },
      { label: "Infographic Examples", href: "/infographic-examples" },
      { label: "Business Infographic Examples", href: "/infographic/business" },
    ],
  },
  "financial-report": {
    slug: "financial-report",
    title: "Financial Report Infographic Examples | Earnings Visuals | KnowLens.ai",
    metaDescription:
      "Browse financial report infographic examples for earnings insights, market summaries, and mobile-friendly investor visuals. Open detail pages and create similar visuals with KnowLens.ai.",
    h1: "Financial Report Infographic Examples",
    intro:
      "Financial report infographic examples help compress earnings metrics, market context, key drivers, and summary takeaways into a cleaner structure. These pages focus on business readability and mobile-friendly report visuals.",
    summary: "Open investor-facing visuals for earnings, market drivers, and financial insight summaries.",
    badge: "REPORT INSIGHT LIBRARY",
    ctaHref: "/infographic-maker",
    ctaLabel: "Create a financial infographic",
    keywords: [
      "financial report infographic examples",
      "earnings infographic",
      "market report infographic",
      "investor infographic examples",
    ],
    relatedLinks: [
      { label: "Business Infographic Examples", href: "/infographic/business" },
      { label: "Infographic Maker", href: "/infographic-maker" },
      { label: "Infographic Examples", href: "/infographic-examples" },
    ],
  },
  astronomy: {
    slug: "astronomy",
    title: "Astronomy Infographic Examples | Space Science Templates | KnowLens.ai",
    metaDescription:
      "Browse astronomy infographic examples about planets, stars, solar storms, and space systems. Open full detail pages and create similar science visuals with KnowLens.ai.",
    h1: "Astronomy Infographic Examples",
    intro:
      "Astronomy infographic examples translate large space concepts into easier visual summaries. These templates show how astronomical systems, solar activity, planets, and observation topics can be organized into readable science posters and mobile-friendly explainers.",
    summary: "Browse space science visuals for planets, stars, solar activity, and astronomy education.",
    badge: "SPACE SCIENCE LIBRARY",
    ctaHref: "/science-infographic-generator",
    ctaLabel: "Create an astronomy infographic",
    keywords: [
      "astronomy infographic examples",
      "space science infographic templates",
      "astronomy visual learning",
      "planet infographic examples",
    ],
    relatedLinks: [
      { label: "Science Infographic Examples", href: "/infographic/science" },
      { label: "Science Infographic Generator", href: "/science-infographic-generator" },
      { label: "Infographic Examples", href: "/infographic-examples" },
    ],
  },
  insurance: {
    slug: "insurance",
    title: "Insurance Infographic Examples | Insurance Knowledge Templates | KnowLens.ai",
    metaDescription:
      "Browse insurance infographic examples about policy basics, claims, liability, workers compensation, and health coverage. Open full detail pages and create similar visuals with KnowLens.ai.",
    h1: "Insurance Infographic Examples",
    intro:
      "Insurance infographic examples work best when they clarify definitions, coverage logic, claims flow, and practical examples. These templates are built for customer education, internal training, and business communication with less jargon-heavy density.",
    summary: "Browse insurance knowledge visuals for policies, claims, coverage, and practical education.",
    badge: "INSURANCE VISUAL LIBRARY",
    ctaHref: "/infographic-maker",
    ctaLabel: "Create an insurance infographic",
    keywords: [
      "insurance infographic examples",
      "insurance knowledge infographic",
      "insurance education templates",
      "policy infographic examples",
    ],
    relatedLinks: [
      { label: "Business Infographic Examples", href: "/infographic/business" },
      { label: "Infographic Maker", href: "/infographic-maker" },
      { label: "Infographic Examples", href: "/infographic-examples" },
    ],
  },
  "industry-report": {
    slug: "industry-report",
    title: "Industry Report Infographic Examples | Market Insight Templates | KnowLens.ai",
    metaDescription:
      "Browse industry report infographic examples for professional market insights, sector summaries, and business report visuals. Open detail pages and create similar pages with KnowLens.ai.",
    h1: "Industry Report Infographic Examples",
    intro:
      "Industry report infographic examples help summarize sector shifts, drivers, constraints, and outlook in a visual format that is easier to scan than a text-heavy report. These pages support market insight storytelling with concise narrative structure.",
    summary: "Explore sector report visuals with market context, drivers, summaries, and outlook sections.",
    badge: "INDUSTRY INSIGHT LIBRARY",
    ctaHref: "/infographic-maker",
    ctaLabel: "Create an industry report infographic",
    keywords: [
      "industry report infographic examples",
      "market insight infographic",
      "sector report visual",
      "professional report infographic",
    ],
    relatedLinks: [
      { label: "Business Infographic Examples", href: "/infographic/business" },
      { label: "Infographic Maker", href: "/infographic-maker" },
      { label: "Infographic Examples", href: "/infographic-examples" },
    ],
  },
  roadmap: {
    slug: "roadmap",
    title: "Roadmap Infographic Examples | Timeline and Milestone Templates | KnowLens.ai",
    metaDescription:
      "Browse roadmap infographic examples for milestones, plans, phases, and strategic sequences. Open full detail pages and create similar roadmap visuals with KnowLens.ai.",
    h1: "Roadmap Infographic Examples",
    intro:
      "Roadmap infographic examples make multi-stage plans easier to follow with clear phases, milestones, and sequential structure. These templates are useful for product planning, project communication, launch planning, and strategy summaries.",
    summary: "Browse phase-based visuals for milestones, planning, strategic roadmaps, and timelines.",
    badge: "ROADMAP VISUAL LIBRARY",
    ctaHref: "/infographic-maker",
    ctaLabel: "Create a roadmap infographic",
    keywords: [
      "roadmap infographic examples",
      "milestone infographic templates",
      "timeline roadmap visual",
      "strategy roadmap infographic",
    ],
    relatedLinks: [
      { label: "Business Infographic Examples", href: "/infographic/business" },
      { label: "Infographic Maker", href: "/infographic-maker" },
      { label: "Infographic Examples", href: "/infographic-examples" },
    ],
  },
  "sex-education": {
    slug: "sex-education",
    title: "Sex Education Infographic Examples | Health Education Visuals | KnowLens.ai",
    metaDescription:
      "Browse sex education infographic examples with healthy, science-based visual explanations. Open public detail pages and create similar educational visuals with KnowLens.ai.",
    h1: "Sex Education Infographic Examples",
    intro:
      "These sex education infographic examples are designed for science-based, health-focused learning rather than sensationalism. The goal is to make anatomy, body changes, safety, and reproductive knowledge easier to understand through clear structure and readable visual explanation.",
    summary: "Open health-focused sex education visuals built for structured, respectful, science-based learning.",
    badge: "HEALTH EDUCATION LIBRARY",
    ctaHref: "/educational-infographic-maker",
    ctaLabel: "Create a health education infographic",
    keywords: [
      "sex education infographic examples",
      "health education infographic",
      "science based sex education visuals",
      "body education infographic",
    ],
    relatedLinks: [
      { label: "Educational Infographic Maker", href: "/educational-infographic-maker" },
      { label: "Science Infographic Examples", href: "/infographic/science" },
      { label: "Infographic Examples", href: "/infographic-examples" },
    ],
  },
};

export function getInfographicDirectorySlugs() {
  return Object.keys(directoryConfigs) as InfographicDirectorySlug[];
}

export function getInfographicDirectoryConfig(slug: string) {
  return directoryConfigs[slug as InfographicDirectorySlug] || null;
}

export function getInfographicDirectoryItems(slug: string) {
  const key = slug as InfographicDirectorySlug;
  const reader = templateCollections[key];
  if (!reader) {
    return [];
  }
  return reader();
}

export function getInfographicDirectoryPath(slug: InfographicDirectorySlug) {
  return `/infographic/${slug}`;
}

export function getInfographicDirectoryUrl(slug: InfographicDirectorySlug) {
  return `${siteUrl}${getInfographicDirectoryPath(slug)}`;
}

