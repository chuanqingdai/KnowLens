import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const siteUrl = "https://knowlens.ai";
const categorySlug = "earth-science";
const categoryName = "Earth Science";
const categoryKeyword = "Earth Science Infographic Templates";
const batchId = "earth-science-infographic-tuzi-100";
const batchTopic = "Earth Science Infographic";
const generatorKeywords = [
  "Earth Science Infographic Generator",
  "Science Infographic Generator",
  "Educational Infographic Maker",
  "AI Infographic Generator",
  "Text to Infographic Generator",
  "Knowledge Infographic Generator",
];

const topicTitles = [
  "Earth Layers Infographic",
  "Plate Tectonics Infographic",
  "Continental Drift Infographic",
  "Rock Cycle Infographic",
  "Types of Rocks Infographic",
  "Igneous Rock Formation Infographic",
  "Sedimentary Rock Formation Infographic",
  "Metamorphic Rock Formation Infographic",
  "Mineral Identification Infographic",
  "Soil Layers Infographic",
  "Volcano Formation Infographic",
  "Types of Volcanoes Infographic",
  "Volcanic Eruption Process Infographic",
  "Lava vs Magma Infographic",
  "Earthquake Basics Infographic",
  "Seismic Waves Infographic",
  "Fault Types Infographic",
  "Richter Scale Infographic",
  "Tsunami Formation Infographic",
  "Mountain Formation Infographic",
  "Weathering and Erosion Infographic",
  "Deposition Process Infographic",
  "River Erosion Infographic",
  "Coastal Erosion Infographic",
  "Glacier Formation Infographic",
  "Glacier Movement Infographic",
  "Landforms Infographic",
  "Caves and Karst Formation Infographic",
  "Fossil Formation Infographic",
  "Geologic Time Scale Infographic",
  "Water Cycle Infographic",
  "Groundwater Cycle Infographic",
  "Aquifers Infographic",
  "Watershed Infographic",
  "River System Infographic",
  "Ocean Currents Infographic",
  "Tides Infographic",
  "Waves and Shorelines Infographic",
  "Estuary Ecosystem Infographic",
  "Coral Reef Formation Infographic",
  "Atmosphere Layers Infographic",
  "Air Pressure Infographic",
  "Wind Formation Infographic",
  "Cloud Formation Infographic",
  "Types of Clouds Infographic",
  "Weather vs Climate Infographic",
  "Weather Fronts Infographic",
  "Thunderstorm Formation Infographic",
  "Tornado Formation Infographic",
  "Hurricane Formation Infographic",
  "Severe Weather Infographic",
  "Monsoon Process Infographic",
  "Rain Shadow Effect Infographic",
  "El Nino and La Nina Infographic",
  "Jet Stream Infographic",
  "Global Wind Patterns Infographic",
  "Humidity Infographic",
  "Precipitation Types Infographic",
  "Lightning Formation Infographic",
  "Weather Forecasting Infographic",
  "Greenhouse Effect Infographic",
  "Carbon Cycle Infographic",
  "Nitrogen Cycle Infographic",
  "Climate Change Basics Infographic",
  "Global Warming Infographic",
  "Ocean Acidification Infographic",
  "Sea Level Rise Infographic",
  "Ice Core Climate Records Infographic",
  "Climate Zones Infographic",
  "Earth Energy Balance Infographic",
  "Seasons and Earth Tilt Infographic",
  "Day and Night Cycle Infographic",
  "Earth Rotation and Revolution Infographic",
  "Moon Phases Infographic",
  "Solar Eclipse Infographic",
  "Lunar Eclipse Infographic",
  "Earth Moon Sun System Infographic",
  "Time Zones Infographic",
  "Latitude and Longitude Infographic",
  "Map Projections Infographic",
  "Renewable Energy Sources Infographic",
  "Solar Energy Process Infographic",
  "Wind Energy Process Infographic",
  "Geothermal Energy Infographic",
  "Hydropower Process Infographic",
  "Fossil Fuels Formation Infographic",
  "Natural Gas Formation Infographic",
  "Coal Formation Infographic",
  "Oil Formation Infographic",
  "Energy Resources Infographic",
  "Natural Disasters Infographic",
  "Flood Formation Infographic",
  "Drought Process Infographic",
  "Landslide Formation Infographic",
  "Wildfire Spread Infographic",
  "Desertification Infographic",
  "Soil Conservation Infographic",
  "Water Conservation Infographic",
  "Environmental Monitoring Infographic",
  "Earth Systems Interaction Infographic"
] as const;

const stylePrompts: Record<string, string> = {
  "Clean Educational Style": "Clean Educational Style: Use a modern, clean, professional educational infographic style. The image should feel bright, trustworthy, polished, and suitable for earth science learning, geography education, and classroom use. Use a clear layout with a large readable title, one central earth science visual focus, and 3-6 supporting information areas. Use a clean sans-serif font with large title text, readable section headings, and short English labels. Use a light background with high contrast and soft blue, green, orange, and earth-tone accents. Use 2-4 harmonious colors. Keep the visual beautiful, organized, mobile-readable, and not overcrowded.",
  "Hand-drawn Explainer Style": "Hand-drawn Explainer Style: Use a warm hand-drawn educational explainer style. The image should feel friendly, approachable, charming, and suitable for beginner-friendly earth science topics, natural processes, landforms, weather, and classroom explanations. Use a notebook-like layout with neat hand-drawn earth, weather, rock, water, or landform illustrations, small note areas, and simple section blocks. Keep the composition organized and balanced. Use neat handwritten-style English text with a large readable title, short labels, and simple notes. Use a warm paper background, pencil-gray lines, and muted blue, green, yellow, and brown accents. Keep the visual soft, clean, educational, and visually appealing.",
  "Blueprint Technical Style": "Blueprint Technical Style: Use a precise technical diagram style. The image should feel scientific, analytical, structured, and suitable for geology, plate tectonics, seismic waves, weather systems, mapping, earth layers, energy systems, and technical earth science topics. Use a grid-based blueprint layout with a central schematic visual and organized explanation areas. Use a technical sans-serif font with crisp English labels and readable callouts. Use a dark navy or blueprint-blue background with white and cyan linework, plus one or two controlled accent colors. Keep the visual clean, accurate, premium, symmetrical, and not cluttered.",
  "Medical Science Style": "Medical Science Style: Use a clean science-education infographic style adapted for environmental health, climate impact, water safety, and ecosystem-related earth science topics. The image should feel accurate, calm, trustworthy, polished, and educational. Use a simplified natural system or environmental science main visual with clear short explanations around it. Keep the content educational and avoid health claims or alarmist messaging. Use a clean sans-serif font with a large readable title, clear English labels, and short explanatory text. Use a white or soft light background with calm blue, teal, muted green, and natural earth-tone accents. Keep the visual clean, balanced, and beautiful.",
  "Premium Editorial Style": "Premium Editorial Style: Use a premium magazine-style earth science infographic design. The image should feel elegant, polished, visually rich, and suitable for climate, oceans, geology, natural disasters, environmental science, and high-level earth science overview topics. Use a strong hero visual, a large headline, a concise subtitle, and supporting information blocks. Use refined editorial spacing, balanced composition, clean hierarchy, and beautiful visual rhythm. Use an elegant editorial title font with clean readable body text, all in English and mobile-readable. Use a sophisticated palette such as deep blue, cream, muted green, stone gray, warm brown, gold, or topic-matching earth-tone accents. Keep the image premium, modern, shareable, and visually beautiful.",
  "Dark Premium Tech Style": "Dark Premium Tech Style: Use a dark futuristic earth-science and data-visualization infographic style. The image should feel high-end, cinematic, precise, dramatic, and suitable for climate systems, satellite monitoring, ocean currents, severe weather, mapping, geospatial science, and advanced environmental topics. Use a dark background with a central polished earth science visual and clean information areas. Use a modern clean sans-serif font with a bright readable title, high-contrast English labels, and concise body text. Use a dark navy, black, or deep blue base with controlled cyan, blue, green, amber, or violet accents. Keep the visual premium, polished, readable, and not overloaded with sci-fi clutter.",
};

const qualityPrompt = "Create a high-quality professional knowledge infographic with a clear information hierarchy, accurate and concise English labels, scientifically correct knowledge visualization, precise diagrams and visual structures, no spelling or grammar mistakes, no incorrect or distorted drawings, no invented facts, and a polished editorial infographic layout with balanced spacing, readable typography, and easy-to-scan sections. Optimize the design for mobile viewing, keep the title and section headings large, reduce small text, avoid tiny labels, and keep the main science explanation readable on a phone screen.";
const continuationWideSlugs = new Set([
  "watershed-infographic",
  "global-wind-patterns-infographic",
  "humidity-infographic",
  "precipitation-types-infographic",
  "lightning-formation-infographic",
]);

export type EarthScienceInfographicTemplate = ReturnType<typeof buildTemplate>;

type GeneratedEarthScienceImage = {
  generationProvider: "tuzi" | string;
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
  sourceType?: "tuzi_generated";
  cacheBypassed?: true;
  isFreshGeneration?: true;
  generationStartedAt?: string;
  generationCompletedAt?: string;
  updatedAt: string;
};

type GeneratedEarthScienceManifest = { templates?: Record<string, GeneratedEarthScienceImage> };

function readGeneratedTemplateManifest() {
  const manifestPath = path.join(process.cwd(), "src/lib/earth-science-infographic-generated-images.json");
  if (!existsSync(manifestPath)) return {} as Record<string, GeneratedEarthScienceImage>;
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as GeneratedEarthScienceManifest;
    return parsed.templates || {};
  } catch {
    return {} as Record<string, GeneratedEarthScienceImage>;
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

function earthScienceDomain(topic: string) {
  if (/layer|tectonic|continental|rock|igneous|sedimentary|metamorphic|mineral|soil|volcano|lava|magma|earthquake|seismic|fault|richter|mountain|weathering|erosion|deposition|glacier|landform|karst|fossil|geologic/i.test(topic)) return "geology";
  if (/water cycle|groundwater|aquifer|watershed|river|ocean|tide|wave|shoreline|estuary|coral/i.test(topic)) return "water-ocean";
  if (/atmosphere|pressure|wind|cloud|weather|front|thunderstorm|tornado|hurricane|monsoon|rain shadow|jet stream|humidity|precipitation|lightning|forecast/i.test(topic)) return "weather";
  if (/greenhouse|carbon|nitrogen|climate|warming|acidification|sea level|ice core|energy balance|climate zone/i.test(topic)) return "climate";
  if (/season|tilt|day and night|rotation|revolution|moon|eclipse|sun system|time zone|latitude|longitude|map projection/i.test(topic)) return "earth-space-mapping";
  if (/renewable|solar energy|wind energy|geothermal|hydropower|fossil fuel|natural gas|coal|oil|energy resource/i.test(topic)) return "energy";
  if (/disaster|flood|drought|landslide|wildfire|desertification|conservation|monitoring|earth systems/i.test(topic)) return "environment";
  return "earth-science";
}

function styleName(topic: string, index: number) {
  const domain = earthScienceDomain(topic);
  if (domain === "geology") return index % 2 === 0 ? "Blueprint Technical Style" : "Clean Educational Style";
  if (domain === "weather") return index % 2 === 0 ? "Hand-drawn Explainer Style" : "Clean Educational Style";
  if (domain === "climate") return index % 2 === 0 ? "Premium Editorial Style" : "Clean Educational Style";
  if (domain === "water-ocean") return index % 2 === 0 ? "Premium Editorial Style" : "Hand-drawn Explainer Style";
  if (domain === "earth-space-mapping") return /season|moon|eclipse|sun|rotation|revolution/i.test(topic) ? (index % 2 === 0 ? "Dark Premium Tech Style" : "Premium Editorial Style") : (index % 2 === 0 ? "Blueprint Technical Style" : "Clean Educational Style");
  if (domain === "energy") return index % 2 === 0 ? "Dark Premium Tech Style" : "Premium Editorial Style";
  if (domain === "environment") return /monitoring|systems/i.test(topic) ? "Dark Premium Tech Style" : (index % 2 === 0 ? "Hand-drawn Explainer Style" : "Clean Educational Style");
  return index % 2 === 0 ? "Clean Educational Style" : "Premium Editorial Style";
}

function knowledgePoints(topic: string) {
  const domain = earthScienceDomain(topic);
  const base = [
    "Define the earth science concept of " + topic,
    "Show the main structures, forces, materials, or system parts involved",
    "Organize the process or relationship into clear visual sections",
    "Explain why the concept matters for earth science learning",
  ];
  if (domain === "geology") return [...base, "Include layers, materials, landforms, time, movement, or geologic processes as relevant"];
  if (domain === "water-ocean") return [...base, "Include water movement, ocean or freshwater connections, flow direction, and ecosystem context"];
  if (domain === "weather") return [...base, "Include atmosphere conditions, formation steps, movement patterns, and observable weather effects"];
  if (domain === "climate") return [...base, "Include climate system relationships, feedbacks, cycles, and long-term environmental context without alarmist claims"];
  if (domain === "earth-space-mapping") return [...base, "Include spatial relationships, motion, orientation, cycles, coordinates, or map-reading concepts"];
  if (domain === "energy") return [...base, "Include energy source, formation or conversion process, resource flow, and practical earth science context"];
  return [...base, "Include conservation, monitoring, hazards, system interactions, and responsible environmental context"];
}

function useCases(domain: string) {
  if (domain === "geology") return ["earth science lessons", "geology study guides", "classroom diagrams", "science education content"];
  if (domain === "weather") return ["weather lessons", "science study guides", "classroom posters", "educational explainers"];
  if (domain === "climate") return ["climate literacy lessons", "environmental science visuals", "teacher handouts", "science communication"];
  if (domain === "water-ocean") return ["ocean science lessons", "water cycle study guides", "ecosystem explainers", "geography education"];
  return ["earth science learning", "visual study guides", "classroom visuals", "science content creation"];
}

function targetAudience(domain: string) {
  if (domain === "climate" || domain === "environment") return ["students", "teachers", "science creators", "environmental education teams"];
  return ["students", "teachers", "science creators", "geography and science education teams"];
}

function buildTemplate(title: string, index: number) {
  const topic = topicName(title);
  const slug = slugify(title);
  const aspectRatio = index < 5 || continuationWideSlugs.has(slug) ? "16:9" : "9:16";
  const domain = earthScienceDomain(topic);
  const style = styleName(topic, index);
  const stylePrompt = stylePrompts[style];
  const points = knowledgePoints(topic);
  const detailPath = "/infographic/earth-science/" + slug + "/";
  const canonicalUrl = siteUrl + detailPath;
  const imageFilename = "earth-science-" + slug + ".webp";
  const aspectRatioPrompt = "Aspect ratio: " + aspectRatio;
  const topicPrompt = "Explain " + topic + " as an accurate educational earth science infographic for visual learning.";
  const visibleDescription = "This " + topic.toLowerCase() + " infographic template explains the earth science concept in a clear visual format for students, teachers, science creators, and education teams. It organizes key structures, processes, relationships, labels, and learning takeaways into concise English sections for easy visual understanding.";
  const imageDescription = "This " + topic.toLowerCase() + " infographic explains the earth science concept in a clear visual format for students, teachers, science creators, and educators.";
  const contentPrompt = "Create an earth science infographic about " + topic + ". Use a large readable title, one central earth science visual focus, and 3-6 concise information areas. Keep the content scientifically accurate, educational, clear, and not alarmist. Content focus: " + topicPrompt + " Knowledge points: " + points.join("; ") + ". Image description: " + imageDescription + " Visible description: " + visibleDescription;
  const finalPrompt = [stylePrompt, contentPrompt, aspectRatioPrompt, qualityPrompt].join("\n\n");
  const generated = readGeneratedTemplateManifest()[slug];
  const updatedAt = generated?.updatedAt || "2026-06-13T00:00:00.000Z";

  return {
    id: "earth-science-template-" + String(index + 1).padStart(3, "0"),
    batchId,
    batchTopic,
    generationProvider: generated?.generationProvider || "pending",
    generationStatus: generated?.generationStatus || "skipped",
    tuziRequestId: generated?.tuziRequestId,
    sourceType: generated?.sourceType || ("tuzi_generated" as const),
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
    title: topic + " Infographic Template",
    topicName: topic,
    shortDescription: "A ready-to-use " + topic.toLowerCase() + " infographic template for earth science learning and visual explanation.",
    visibleDescription,
    seoTitle: topic + " Infographic Template - KnowLens AI",
    metaDescription: "Explore this " + topic.toLowerCase() + " infographic template for earth science learning and visual explanation. Create a similar visual with KnowLens AI.",
    h1: topic + " Infographic Template",
    primaryKeyword: title,
    secondaryKeywords: [topic.toLowerCase() + " visual guide", topic.toLowerCase() + " earth science infographic", "earth science infographic template", "educational science visual"],
    generatorKeywords: generatorKeywords.slice(0, 4),
    previewImagePath: generated?.previewImagePath || (generated?.previewImageUrl ? new URL(generated.previewImageUrl).pathname : "/picture/earth-science-infographic-generator.jpg"),
    previewImageUrl: generated?.previewImageUrl || siteUrl + "/picture/earth-science-infographic-generator.jpg",
    storageKey: generated?.storageKey || "infographic/earth-science/" + imageFilename,
    imageFilename: generated?.imageFilename || imageFilename,
    imageFormat: generated?.imageFormat || ("webp" as const),
    imageMimeType: generated?.imageMimeType || "image/webp",
    imageWidth: generated?.imageWidth || (aspectRatio === "16:9" ? 1792 : 1024),
    imageHeight: generated?.imageHeight || (aspectRatio === "16:9" ? 1024 : 1792),
    imageSizeBytes: generated?.imageSizeBytes,
    aspectRatio,
    imageAlt: topic + " infographic",
    imageTitle: topic + " Infographic Template",
    imageCaption: topic + " Infographic - an earth science infographic example created with KnowLens AI.",
    imageDescription,
    styleName: style,
    stylePrompt,
    contentPrompt,
    aspectRatioPrompt,
    qualityPrompt,
    finalPrompt,
    createSimilarPrompt: "Create an educational earth science infographic about " + topic + ". Use " + style + ". " + aspectRatioPrompt + ". Focus on the key earth science details and knowledge points. Keep the design clear, polished, accurate, and professional.",
    topicPrompt,
    knowledgePoints: points,
    useCases: useCases(domain),
    targetAudience: targetAudience(domain),
    tags: Array.from(new Set(["earth science", "infographic", domain, ...slug.split("-").filter((part) => !["earth", "science", "infographic"].includes(part)).slice(0, 6)])),
    relatedTemplateIds: [] as string[],
    relatedCategorySlugs: ["earth-science", "science", "education", "infographic-examples"],
    relatedToolSlugs: ["earth-science-infographic-generator", "science-infographic-generator", "educational-infographic-maker", "ai-infographic-generator"],
    allowPublicDownload: false as const,
    createdAt: "2026-06-13T00:00:00.000Z",
    updatedAt,
  };
}

export function getEarthScienceInfographicTemplates() {
  return topicTitles.map(buildTemplate).map((template, index, source) => ({
    ...template,
    relatedTemplateIds: source
      .filter((item) => item.id !== template.id && item.categorySlug === template.categorySlug && item.generationStatus === "success")
      .slice(Math.max(0, index - 2), index + 8)
      .filter((item) => item.id !== template.id)
      .slice(0, 6)
      .map((item) => item.id),
  }));
}

export const earthScienceInfographicTemplates = getEarthScienceInfographicTemplates();

export function getEarthScienceInfographicTemplate(slug: string) {
  return getEarthScienceInfographicTemplates().find((template) => template.slug === slug);
}

export function getEarthScienceInfographicBatchJob() {
  const manifestPath = path.join(process.cwd(), "src/lib/earth-science-infographic-generated-images.json");
  if (!existsSync(manifestPath)) return null;
  try { return JSON.parse(readFileSync(manifestPath, "utf8")).job || null; } catch { return null; }
}
