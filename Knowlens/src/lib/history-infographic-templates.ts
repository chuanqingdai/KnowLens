import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const siteUrl = "https://knowlens.ai";
const categorySlug = "history";
const categoryName = "History";
const categoryKeyword = "History Infographic Templates";
const batchId = "history-infographic-duomi-100";
const batchTopic = "History Infographic";
const generatorKeywords = [
  "History Infographic Maker",
  "Educational Infographic Maker",
  "AI Infographic Generator",
  "Text to Infographic Generator",
  "Knowledge Infographic Generator",
];

const topicTitles = [
  "Ancient Egypt Civilization Infographic",
  "Ancient Mesopotamia Civilization Infographic",
  "Ancient Greece Infographic",
  "Ancient Rome Infographic",
  "Indus Valley Civilization Infographic",
  "Ancient China Civilization Infographic",
  "Mayan Civilization Infographic",
  "Aztec Empire Infographic",
  "Inca Empire Infographic",
  "Persian Empire Infographic",
  "Roman Republic vs Roman Empire Infographic",
  "Roman Empire Timeline Infographic",
  "Fall of the Roman Empire Infographic",
  "Byzantine Empire Infographic",
  "Silk Road Trade Routes Infographic",
  "Han Dynasty Infographic",
  "Tang Dynasty Infographic",
  "Song Dynasty Infographic",
  "Mongol Empire Infographic",
  "Ottoman Empire Infographic",
  "Medieval Europe Infographic",
  "Feudalism System Infographic",
  "Medieval Castle Structure Infographic",
  "Knight Training Process Infographic",
  "Crusades Overview Infographic",
  "Black Death Infographic",
  "Magna Carta Infographic",
  "Hundred Years War Infographic",
  "Viking Exploration Infographic",
  "Medieval Trade Guilds Infographic",
  "Renaissance Timeline Infographic",
  "Renaissance Art and Science Infographic",
  "Leonardo da Vinci Infographic",
  "Printing Press Revolution Infographic",
  "Age of Exploration Infographic",
  "Christopher Columbus Voyage Infographic",
  "Vasco da Gama Route Infographic",
  "Magellan Expedition Infographic",
  "Columbian Exchange Infographic",
  "Reformation Infographic",
  "Scientific Revolution Infographic",
  "Galileo and Astronomy Infographic",
  "Isaac Newton Discoveries Infographic",
  "Enlightenment Ideas Infographic",
  "American Revolution Timeline Infographic",
  "Declaration of Independence Infographic",
  "French Revolution Timeline Infographic",
  "Napoleon Bonaparte Infographic",
  "Haitian Revolution Infographic",
  "Latin American Independence Movements Infographic",
  "Industrial Revolution Infographic",
  "Steam Engine Impact Infographic",
  "Factory System Infographic",
  "Urbanization in the Industrial Age Infographic",
  "Child Labor in the Industrial Revolution Infographic",
  "Railway Expansion Infographic",
  "Telegraph Communication Infographic",
  "Second Industrial Revolution Infographic",
  "Invention Timeline Infographic",
  "Labor Movement Infographic",
  "American Civil War Infographic",
  "Causes of the American Civil War Infographic",
  "Emancipation Proclamation Infographic",
  "Reconstruction Era Infographic",
  "Westward Expansion Infographic",
  "Transcontinental Railroad Infographic",
  "Gilded Age Infographic",
  "Progressive Era Infographic",
  "Women Suffrage Movement Infographic",
  "Civil Rights Movement Infographic",
  "World War I Causes Infographic",
  "World War I Timeline Infographic",
  "Trench Warfare Infographic",
  "Treaty of Versailles Infographic",
  "Interwar Period Infographic",
  "Great Depression Infographic",
  "World War II Causes Infographic",
  "World War II Timeline Infographic",
  "D-Day Normandy Landings Infographic",
  "United Nations Formation Infographic",
  "Cold War Timeline Infographic",
  "Berlin Wall Infographic",
  "Space Race Infographic",
  "Cuban Missile Crisis Infographic",
  "Decolonization After World War II Infographic",
  "Indian Independence Movement Infographic",
  "Apartheid in South Africa Infographic",
  "Fall of the Soviet Union Infographic",
  "European Union Formation Infographic",
  "Globalization History Infographic",
  "History of Writing Systems Infographic",
  "History of Money Infographic",
  "History of Democracy Infographic",
  "History of Education Infographic",
  "History of Medicine Infographic",
  "History of Maps Infographic",
  "History of Architecture Infographic",
  "History of Transportation Infographic",
  "History of Communication Infographic",
  "History of the Internet Infographic",
] as const;

const stylePrompts: Record<string, string> = {
  "Clean Educational Style": "Clean Educational Style: Use a modern, clean, professional educational infographic style. The image should feel bright, trustworthy, polished, and suitable for history learning, classroom use, and educational content. Use a clear layout with a large readable title, one central historical visual focus, and 3-6 supporting information areas. Use a clean sans-serif font with large title text, readable section headings, and short English labels. Use a light background with high contrast and soft blue, beige, muted red, and gold accents. Use 2-4 harmonious colors. Keep the visual beautiful, organized, mobile-readable, and not overcrowded.",
  "Hand-drawn Explainer Style": "Hand-drawn Explainer Style: Use a warm hand-drawn educational explainer style. The image should feel friendly, approachable, charming, and suitable for beginner-friendly history topics, classroom explanations, ancient civilizations, timelines, and cultural history. Use a notebook-like layout with neat hand-drawn historical illustrations, small note areas, and simple section blocks. Keep the composition organized and balanced. Use neat handwritten-style English text with a large readable title, short labels, and simple notes. Use a warm paper background, pencil-gray lines, and muted brown, blue, red, and yellow accents. Keep the visual soft, clean, educational, and visually appealing.",
  "Blueprint Technical Style": "Blueprint Technical Style: Use a precise technical diagram style adapted for historical systems, trade routes, inventions, architecture, transportation, communication networks, and military logistics explained in a neutral educational way. The image should feel analytical, structured, and organized. Use a grid-based blueprint layout with a central historical system or object visual and organized explanation areas. Use a technical sans-serif font with crisp English labels and readable callouts. Use a dark navy or blueprint-blue background with white and cyan linework, plus one or two controlled accent colors. Keep the visual clean, accurate, premium, symmetrical, and not cluttered.",
  "Museum Archive Style": "Museum Archive Style: Use a refined museum archive infographic style. The image should feel historical, credible, calm, elegant, and suitable for ancient civilizations, artifacts, documents, historical figures, dynasties, and cultural history. Use a parchment or archive-inspired visual layout with a strong central historical subject, short explanatory text areas, and a polished exhibition-board feeling. Use a classic readable serif-style title with clean readable body text in English. Use warm beige, parchment, sepia, muted brown, dark ink, and subtle gold accents. Keep the visual scholarly, tasteful, clean, and historically respectful.",
  "Premium Editorial Style": "Premium Editorial Style: Use a premium magazine-style history infographic design. The image should feel elegant, polished, visually rich, and suitable for historical timelines, revolutions, empires, social movements, world history overviews, and shareable educational content. Use a strong hero visual, a large headline, a concise subtitle, and supporting information blocks. Use refined editorial spacing, balanced composition, clean hierarchy, and beautiful visual rhythm. Use an elegant editorial title font with clean readable body text, all in English and mobile-readable. Use a sophisticated palette such as deep blue, cream, muted red, warm brown, gold, or topic-matching historical accents. Keep the image premium, modern, educational, and visually beautiful.",
  "Dark Premium History Style": "Dark Premium History Style: Use a dark premium historical infographic style. The image should feel cinematic, serious, refined, and suitable for major wars, geopolitical timelines, empires, revolutions, cold war topics, space race, and modern history explained in a neutral educational way. Use a dark background with a central polished historical visual and clean information areas. Use a modern clean sans-serif font with a bright readable title, high-contrast English labels, and concise body text. Use a dark navy, charcoal, black, deep red, bronze, or muted gold palette. Keep the visual premium, dramatic, readable, historically respectful, and not sensationalized.",
};

const qualityPrompt = "Create a high-quality professional knowledge infographic with a clear information hierarchy, accurate and concise English labels, historically correct knowledge visualization, precise diagrams and visual structures, no spelling or grammar mistakes, no incorrect or distorted drawings, no invented facts, and a polished editorial infographic layout with balanced spacing, readable typography, and easy-to-scan sections. Optimize the design for mobile viewing, keep the title and section headings large, reduce small text, avoid tiny labels, and keep every key section readable on a phone screen.";

export type HistoryInfographicTemplate = ReturnType<typeof buildTemplate>;

type GeneratedHistoryImage = {
  generationProvider: string;
  generationStatus: "success" | "failed" | "skipped";
  previewImagePath?: string;
  previewImageUrl: string;
  storageKey: string;
  imageFilename: string;
  imageFormat: "webp" | "png" | "jpg";
  imageMimeType: string;
  imageWidth: number;
  imageHeight: number;
  imageSizeBytes?: number;
  tuziRequestId?: string;
  sourceType?: "tuzi_generated" | "duomi_generated";
  cacheBypassed?: true;
  isFreshGeneration?: true;
  generationStartedAt?: string;
  generationCompletedAt?: string;
  updatedAt: string;
};

type GeneratedHistoryManifest = {
  templates?: Record<string, GeneratedHistoryImage>;
};

function readGeneratedTemplateManifest() {
  const manifestPath = path.join(process.cwd(), "src/lib/history-infographic-generated-images.json");
  if (!existsSync(manifestPath)) return {} as Record<string, GeneratedHistoryImage>;
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as GeneratedHistoryManifest;
    return parsed.templates || {};
  } catch {
    return {} as Record<string, GeneratedHistoryImage>;
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function topicName(title: string) {
  return title.replace(/\s+Infographic$/i, "").trim();
}

function historyDomain(topic: string) {
  if (/ancient|civilization|egypt|mesopotamia|greece|rome|indus|china|mayan|aztec|inca|persian|dynasty|empire|byzantine|ottoman|artifact/i.test(topic)) return "ancient";
  if (/silk road|trade|guild|castle|architecture|transportation|communication|maps|money|writing|internet|telegraph|railway|steam|factory|invention/i.test(topic)) return "systems";
  if (/medieval|feudalism|knight|crusades|black death|magna carta|hundred years|viking/i.test(topic)) return "medieval";
  if (/renaissance|da vinci|printing press|exploration|columbus|gama|magellan|columbian exchange|reformation|scientific|galileo|newton|enlightenment/i.test(topic)) return "renaissance";
  if (/revolution|independence|declaration|napoleon|labor|suffrage|civil rights|progressive|emancipation|reconstruction/i.test(topic)) return "movements";
  if (/war|d-day|treaty|interwar|cold war|berlin wall|cuban missile|soviet|apartheid|decolonization/i.test(topic)) return "geopolitical";
  if (/industrial|urbanization|gilded|great depression|globalization|union formation|education|medicine|democracy/i.test(topic)) return "modern";
  return "history";
}

function styleName(topic: string, index: number) {
  const domain = historyDomain(topic);
  if (domain === "ancient") return index % 2 === 0 ? "Museum Archive Style" : "Hand-drawn Explainer Style";
  if (domain === "systems") return index % 2 === 0 ? "Blueprint Technical Style" : "Clean Educational Style";
  if (domain === "medieval") return index % 2 === 0 ? "Museum Archive Style" : "Hand-drawn Explainer Style";
  if (domain === "renaissance") return index % 2 === 0 ? "Premium Editorial Style" : "Clean Educational Style";
  if (domain === "movements") return index % 2 === 0 ? "Premium Editorial Style" : "Clean Educational Style";
  if (domain === "geopolitical") return index % 2 === 0 ? "Dark Premium History Style" : "Premium Editorial Style";
  if (domain === "modern") return index % 2 === 0 ? "Premium Editorial Style" : "Clean Educational Style";
  return index % 2 === 0 ? "Clean Educational Style" : "Museum Archive Style";
}

function knowledgePoints(topic: string) {
  const domain = historyDomain(topic);
  const base = [
    `Define the historical context of ${topic}`,
    "Show the main people, places, ideas, or systems involved",
    "Organize the key developments in a clear learning sequence",
    "Explain the broader historical significance in neutral language",
  ];
  if (domain === "ancient") return [...base, "Include culture, geography, governance, achievements, and legacy"];
  if (domain === "systems") return [...base, "Include routes, mechanisms, networks, tools, or structural relationships"];
  if (domain === "medieval") return [...base, "Include society, power structures, daily life, conflict, and change over time"];
  if (domain === "renaissance") return [...base, "Include ideas, discoveries, art, science, exchange, and long-term influence"];
  if (domain === "movements") return [...base, "Include causes, turning points, participants, outcomes, and civic impact"];
  if (domain === "geopolitical") return [...base, "Keep war and conflict content neutral, educational, non-sensationalized, and focused on causes and consequences"];
  return [...base, "Include timelines, social change, technology, institutions, and global connections"];
}

function useCases(domain: string) {
  if (domain === "ancient") return ["classroom history lessons", "civilization study guides", "museum-style explainers", "education content"];
  if (domain === "systems") return ["timeline visuals", "system explainers", "history of technology lessons", "educational diagrams"];
  if (domain === "geopolitical") return ["neutral history lessons", "exam review", "timeline summaries", "teacher handouts"];
  return ["history learning", "study guides", "visual summaries", "education content"];
}

function targetAudience(domain: string) {
  if (domain === "geopolitical") return ["students", "teachers", "history educators", "curriculum teams"];
  if (domain === "systems") return ["students", "teachers", "history creators", "education content teams"];
  return ["students", "teachers", "history content creators", "education teams"];
}

function buildTemplate(title: string, index: number) {
  const topic = topicName(title);
  const slug = slugify(title);
  const aspectRatio = index < 5 ? "16:9" : "9:16";
  const domain = historyDomain(topic);
  const style = styleName(topic, index);
  const stylePrompt = stylePrompts[style];
  const points = knowledgePoints(topic);
  const detailPath = `/infographic/history/${slug}/`;
  const canonicalUrl = `${siteUrl}${detailPath}`;
  const imageFilename = `history-${slug}.webp`;
  const aspectRatioPrompt = `Aspect ratio: ${aspectRatio}`;
  const topicPrompt = `Explain ${topic} as a neutral educational history infographic for visual learning.`;
  const visibleDescription = `This ${topic.toLowerCase()} infographic template explains the historical topic in a clear visual format for students, teachers, history creators, and education teams. It organizes context, key developments, people, places, systems, turning points, and significance into concise English sections for easy visual learning.`;
  const imageDescription = `This ${topic.toLowerCase()} infographic explains the historical concept in a clear visual format for students, teachers, history creators, and educators.`;
  const contentPrompt = `Create a history infographic about ${topic}. Use a large readable title, one central historically appropriate visual focus, and 3-6 concise information areas. Keep the tone neutral, respectful, educational, and non-propagandistic. Content focus: ${topicPrompt} Knowledge points: ${points.join("; ")}. Image description: ${imageDescription} Visible description: ${visibleDescription}`;
  const finalPrompt = [stylePrompt, contentPrompt, aspectRatioPrompt, qualityPrompt].join("\n\n");
  const generated = readGeneratedTemplateManifest()[slug];
  const updatedAt = generated?.updatedAt || "2026-06-13T00:00:00.000Z";

  return {
    id: `history-template-${String(index + 1).padStart(3, "0")}`,
    batchId,
    batchTopic,
    generationProvider: generated?.generationProvider || "pending",
    generationStatus: generated?.generationStatus || "skipped",
    tuziRequestId: generated?.tuziRequestId,
    sourceType: generated?.sourceType || ("duomi_generated" as const),
    cacheBypassed: generated?.cacheBypassed || true,
    isFreshGeneration: generated?.isFreshGeneration || true,
    generationStartedAt: generated?.generationStartedAt || updatedAt,
    generationCompletedAt: generated?.generationCompletedAt || updatedAt,
    categorySlug,
    categoryName,
    categoryKeyword,
    slug,
    detailPath,
    canonicalUrl,
    title: `${topic} Infographic Template`,
    topicName: topic,
    shortDescription: `A ready-to-use ${topic.toLowerCase()} infographic template for history learning and visual explanation.`,
    visibleDescription,
    seoTitle: `${topic} Infographic Template - KnowLens AI`,
    metaDescription: `Explore this ${topic.toLowerCase()} infographic template for history learning and visual explanation. Create a similar visual with KnowLens AI.`,
    h1: `${topic} Infographic Template`,
    primaryKeyword: title,
    secondaryKeywords: [`${topic.toLowerCase()} visual summary`, `${topic.toLowerCase()} history infographic`, "history infographic template", "educational history visual"],
    generatorKeywords: generatorKeywords.slice(0, 4),
    previewImagePath: generated?.previewImagePath || (generated?.previewImageUrl ? new URL(generated.previewImageUrl).pathname : "/picture/science-infographic.jpg"),
    previewImageUrl: generated?.previewImageUrl || `${siteUrl}/picture/science-infographic.jpg`,
    storageKey: generated?.storageKey || `infographic/history/${imageFilename}`,
    imageFilename: generated?.imageFilename || imageFilename,
    imageFormat: generated?.imageFormat || ("webp" as const),
    imageMimeType: generated?.imageMimeType || "image/webp",
    imageWidth: generated?.imageWidth || (aspectRatio === "16:9" ? 1792 : 1024),
    imageHeight: generated?.imageHeight || (aspectRatio === "16:9" ? 1024 : 1792),
    imageSizeBytes: generated?.imageSizeBytes,
    aspectRatio,
    imageAlt: `${topic} infographic`,
    imageTitle: `${topic} Infographic Template`,
    imageCaption: `${topic} Infographic - a history infographic example created with KnowLens AI.`,
    imageDescription,
    styleName: style,
    stylePrompt,
    contentPrompt,
    aspectRatioPrompt,
    qualityPrompt,
    finalPrompt,
    createSimilarPrompt: `Create an educational history infographic about ${topic}. Use ${style}. ${aspectRatioPrompt}. Focus on the key historical details and knowledge points. Keep the design clear, polished, neutral, respectful, and professional.`,
    topicPrompt,
    knowledgePoints: points,
    useCases: useCases(domain),
    targetAudience: targetAudience(domain),
    tags: Array.from(new Set(["history", "infographic", domain, ...slug.split("-").filter((part) => !["history", "infographic"].includes(part)).slice(0, 6)])),
    relatedTemplateIds: [] as string[],
    relatedCategorySlugs: ["history", "education", "infographic-examples"],
    relatedToolSlugs: ["educational-infographic-maker", "ai-infographic-generator", "text-to-infographic", "infographic-maker"],
    allowPublicDownload: false as const,
    createdAt: "2026-06-13T00:00:00.000Z",
    updatedAt,
  };
}

export function getHistoryInfographicTemplates() {
  return topicTitles.map(buildTemplate).map((template, index, source) => ({
    ...template,
    relatedTemplateIds: source
      .filter((item) => item.id !== template.id && item.categorySlug === template.categorySlug)
      .slice(Math.max(0, index - 2), index + 5)
      .filter((item) => item.id !== template.id)
      .slice(0, 6)
      .map((item) => item.id),
  }));
}

export const historyInfographicTemplates = getHistoryInfographicTemplates();

function normalizeLegacyHistorySlug(slug: string) {
  const value = slug.trim().toLowerCase();
  if (!value) {
    return value;
  }
  if (value.endsWith("-online-history-infographic")) {
    return value.replace(/-online-history-infographic$/i, "-infographic");
  }
  return value;
}

export function getHistoryInfographicTemplate(slug: string) {
  const normalizedSlug = normalizeLegacyHistorySlug(slug);
  return getHistoryInfographicTemplates().find(
    (template) => template.slug === slug || template.slug === normalizedSlug,
  );
}

export function getHistoryInfographicBatchJob() {
  const manifestPath = path.join(process.cwd(), "src/lib/history-infographic-generated-images.json");
  if (!existsSync(manifestPath)) return null;
  try {
    return JSON.parse(readFileSync(manifestPath, "utf8")).job || null;
  } catch {
    return null;
  }
}
