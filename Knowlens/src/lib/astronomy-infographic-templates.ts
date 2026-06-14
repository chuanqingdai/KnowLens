import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const siteUrl = "https://knowlens.ai";
const categorySlug = "astronomy";
const categoryName = "Astronomy";
const categoryKeyword = "Astronomy Infographic Templates";
const batchId = "astronomy-infographic-tuzi-50";
const batchTopic = "Astronomy Infographic";
const generatorKeywords = [
  "Astronomy Infographic Generator",
  "Science Infographic Generator",
  "Educational Infographic Maker",
  "AI Infographic Generator",
  "Knowledge Infographic Generator",
  "Text to Infographic Generator",
];

const topicTitles = [
  "Solar System Structure Infographic",
  "Inner Planets vs Outer Planets Infographic",
  "Mercury Planet Guide Infographic",
  "Venus Planet Guide Infographic",
  "Earth in Space Infographic",
  "Mars Planet Guide Infographic",
  "Jupiter System Infographic",
  "Saturn Rings Infographic",
  "Uranus and Neptune Ice Giants Infographic",
  "Dwarf Planets Infographic",
  "Moon Phases Infographic",
  "Solar Eclipse Infographic",
  "Lunar Eclipse Infographic",
  "Tides and the Moon Infographic",
  "Seasons and Earth Tilt Infographic",
  "Day and Night Cycle Infographic",
  "Asteroids Comets and Meteoroids Infographic",
  "Meteor Showers Infographic",
  "Kuiper Belt Infographic",
  "Oort Cloud Infographic",
  "Star Life Cycle Infographic",
  "Main Sequence Stars Infographic",
  "Red Giants Infographic",
  "White Dwarfs Infographic",
  "Supernova Explosion Infographic",
  "Neutron Stars Infographic",
  "Pulsars Infographic",
  "Black Holes Infographic",
  "Accretion Disk Infographic",
  "Gravitational Lensing Infographic",
  "Nebula Types Infographic",
  "Star Formation in Nebulae Infographic",
  "Milky Way Galaxy Infographic",
  "Galaxy Types Infographic",
  "Spiral Galaxies Infographic",
  "Dark Matter Basics Infographic",
  "Cosmic Microwave Background Infographic",
  "Expanding Universe Infographic",
  "Big Bang Timeline Infographic",
  "Observable Universe Infographic",
  "Exoplanets Infographic",
  "Habitable Zone Infographic",
  "Transit Method for Exoplanets Infographic",
  "Radial Velocity Method Infographic",
  "Exoplanet Atmospheres Infographic",
  "James Webb Space Telescope Infographic",
  "Hubble Space Telescope Infographic",
  "Radio Telescopes Infographic",
  "Light-Year and Cosmic Distance Infographic",
  "Electromagnetic Spectrum in Astronomy Infographic"
] as const;

const stylePrompts: Record<string, string> = {
  "Dark Premium Cosmos Style": "Dark Premium Cosmos Style: Use a dark premium astronomy infographic style. The image should feel cinematic, high-end, precise, mysterious, and suitable for space science, galaxies, black holes, exoplanets, cosmic scale, and advanced astronomy topics. Use a dark navy, black, or deep purple background with a central polished cosmic visual and clear information areas. Use a modern clean sans-serif font with bright readable titles, high-contrast English labels, and clear explanatory text. Use controlled cyan, blue, violet, gold, and white accents. Keep the visual premium, dramatic, scientifically serious, data-rich, readable, and not visually chaotic.",
  "Clean Astronomy Education Style": "Clean Astronomy Education Style: Use a modern, clean, professional educational astronomy infographic style. The image should feel bright, trustworthy, polished, and suitable for science learning, classroom use, and beginner-friendly astronomy explanation. Use a clear layout with a large readable title, one strong astronomy visual focus, and supporting information areas. Use a clean sans-serif font with large title text, readable section headings, and clear English labels. Use a light background with deep blue, soft cyan, warm yellow, slate, and white accents. Keep the visual beautiful, organized, mobile-readable, accurate, and easy to scan.",
  "Hand-drawn Star Journal Style": "Hand-drawn Star Journal Style: Use a warm hand-drawn astronomy notebook infographic style. The image should feel friendly, curious, charming, educational, and suitable for students, teachers, beginner astronomy, planets, moon phases, star life cycles, and classroom science content. Use a notebook-like layout with neat hand-drawn celestial illustrations, small note areas, and simple information blocks. Use neat handwritten-style English text with a large readable title, short labels, and clear explanations. Use a warm paper background, pencil-gray outlines, muted navy, soft yellow, blue, violet, and cream accents. Keep the visual soft, clean, inviting, accurate, and highly shareable.",
  "Blueprint Space Diagram Style": "Blueprint Space Diagram Style: Use a precise technical astronomy diagram style. The image should feel analytical, structured, scientific, and suitable for orbital mechanics, eclipses, telescope systems, exoplanet detection methods, light-year measurement, spectrum explanation, and space system diagrams. Use a grid-based blueprint layout with a central schematic astronomy visual and organized explanation areas. Use a technical sans-serif font with crisp English labels and readable explanatory notes. Use a dark navy or blueprint-blue background with white and cyan linework, plus controlled gold or violet accents. Keep the visual clean, accurate, premium, symmetrical, and not cluttered.",
  "Premium Editorial Space Style": "Premium Editorial Space Style: Use a premium magazine-style astronomy infographic design. The image should feel elegant, polished, visually rich, and suitable for solar system overviews, planet profiles, cosmic history, telescope stories, exoplanets, galaxies, and shareable educational space content. Use a strong hero cosmic visual, a large headline, a concise subtitle, and supporting information blocks. Use refined editorial spacing, balanced composition, clean hierarchy, and beautiful visual rhythm. Use an elegant editorial title font with clean readable English body text. Use deep blue, cream, muted gold, cosmic purple, slate, and black accents. Keep the image premium, modern, inspiring, scientifically respectful, and visually beautiful.",
  "Data Observatory Style": "Data Observatory Style: Use a refined astronomy data and observatory infographic style. The image should feel precise, research-oriented, structured, and suitable for telescope observations, exoplanet detection, spectra, galaxy classification, cosmic distance, and astronomy measurement topics. Use a clean data-oriented layout with a strong astronomy visual focus, clear metric or concept areas, and explanatory text. Use a professional sans-serif font with strong hierarchy, clear labels, and readable English notes. Use a white, dark navy, slate, cyan, violet, and muted gold palette. Keep the visual polished, data-rich, credible, educational, and easy to scan."
};

const qualityPrompt = "Create a high-quality professional astronomy knowledge infographic with a clear information hierarchy, accurate English labels, scientifically correct space and astronomy visualization, precise diagrams and visual structures, no spelling or grammar mistakes, no incorrect or distorted astronomical drawings, no invented facts, and a polished editorial infographic layout with balanced spacing, readable typography, strong visual hierarchy, data-rich sections, clear concept explanations, and easy-to-scan astronomy information. Optimize the design for mobile viewing, keep the title and section headings large, reduce small text, avoid tiny labels, and keep the astronomy explanation readable on a phone screen.";

export type AstronomyInfographicTemplate = ReturnType<typeof buildTemplate>;

type GeneratedAstronomyImage = {
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

type GeneratedAstronomyManifest = { templates?: Record<string, GeneratedAstronomyImage> };

function readGeneratedTemplateManifest() {
  const manifestPath = path.join(process.cwd(), "src/lib/astronomy-infographic-generated-images.json");
  if (!existsSync(manifestPath)) return {} as Record<string, GeneratedAstronomyImage>;
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as GeneratedAstronomyManifest;
    return parsed.templates || {};
  } catch {
    return {} as Record<string, GeneratedAstronomyImage>;
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

function astronomyDomain(topic: string) {
  if (/solar system|planet|mercury|venus|earth in space|mars|jupiter|saturn|uranus|neptune|dwarf/i.test(topic)) return "solar-system";
  if (/moon|eclipse|tide|season|day and night|tilt/i.test(topic)) return "moon-orbit";
  if (/asteroid|comet|meteoroid|meteor|kuiper|oort/i.test(topic)) return "small-bodies";
  if (/star|red giant|white dwarf|supernova|neutron|pulsar|nebula/i.test(topic)) return "stars";
  if (/black hole|accretion|gravitational lensing/i.test(topic)) return "black-holes";
  if (/milky way|galaxy|galaxies|dark matter|cosmic microwave|expanding universe|big bang|observable universe/i.test(topic)) return "cosmology";
  if (/exoplanet|habitable zone|transit method|radial velocity|atmosphere/i.test(topic)) return "exoplanets";
  if (/telescope|observator|james webb|hubble|radio/i.test(topic)) return "telescopes";
  if (/light-year|cosmic distance|electromagnetic spectrum/i.test(topic)) return "measurement";
  return "astronomy";
}

function structureType(topic: string) {
  const domain = astronomyDomain(topic);
  if (/vs/i.test(topic)) return "comparison explanation";
  if (domain === "solar-system") return /Guide|Earth in Space|Jupiter|Saturn|Ice Giants|Dwarf/i.test(topic) ? "celestial object profile" : "spatial structure overview";
  if (domain === "moon-orbit") return "cause-and-effect astronomy explanation";
  if (domain === "small-bodies") return /Meteor Showers/i.test(topic) ? "cause-and-effect astronomy explanation" : "system anatomy explanation";
  if (domain === "stars") return /Life Cycle|Formation|Supernova/i.test(topic) ? "lifecycle explanation" : "celestial object profile";
  if (domain === "black-holes") return /Lensing/i.test(topic) ? "observation method explanation" : "system anatomy explanation";
  if (domain === "cosmology") return /Timeline|Expanding|Observable|Microwave/i.test(topic) ? "cosmic scale explanation" : "spatial structure overview";
  if (domain === "exoplanets") return /Method/i.test(topic) ? "observation method explanation" : "celestial object profile";
  if (domain === "telescopes") return "telescope / instrument explanation";
  if (domain === "measurement") return "astronomy measurement explanation";
  return "astronomy knowledge explanation";
}

function styleName(topic: string, index: number) {
  const domain = astronomyDomain(topic);
  if (domain === "solar-system") return index % 2 === 0 ? "Clean Astronomy Education Style" : "Premium Editorial Space Style";
  if (domain === "moon-orbit") return index % 2 === 0 ? "Blueprint Space Diagram Style" : "Hand-drawn Star Journal Style";
  if (domain === "small-bodies") return index % 2 === 0 ? "Hand-drawn Star Journal Style" : "Clean Astronomy Education Style";
  if (domain === "stars") return index % 2 === 0 ? "Premium Editorial Space Style" : "Hand-drawn Star Journal Style";
  if (domain === "black-holes") return index % 2 === 0 ? "Dark Premium Cosmos Style" : "Data Observatory Style";
  if (domain === "cosmology") return index % 2 === 0 ? "Dark Premium Cosmos Style" : "Premium Editorial Space Style";
  if (domain === "exoplanets") return index % 2 === 0 ? "Data Observatory Style" : "Dark Premium Cosmos Style";
  if (domain === "telescopes") return index % 2 === 0 ? "Data Observatory Style" : "Blueprint Space Diagram Style";
  if (domain === "measurement") return index % 2 === 0 ? "Blueprint Space Diagram Style" : "Data Observatory Style";
  return index % 2 === 0 ? "Clean Astronomy Education Style" : "Dark Premium Cosmos Style";
}

function knowledgePoints(topic: string) {
  const domain = astronomyDomain(topic);
  const structure = structureType(topic);
  if (domain === "solar-system") return [
    "Identify the main celestial bodies or regions connected to " + topic,
    "Show relative position, composition categories, or defining traits without inventing exact data",
    "Explain how the object or system fits into solar system structure",
    "Use comparison, orbit, layer, or profile sections matched to the topic",
  ];
  if (domain === "moon-orbit") return [
    "Explain the geometry between the Sun, Earth, Moon, and observer",
    "Show the visible effect or cycle step-by-step with clear arrows and labels",
    "Separate cause, alignment, shadow, tilt, or orbital motion from the observed result",
    "Avoid astrology and keep the explanation scientific and classroom-friendly",
  ];
  if (domain === "small-bodies") return [
    "Define the small-body population and where it belongs in the solar system",
    "Compare composition, orbit, origin, or visible behavior when relevant",
    "Show how observation from Earth differs from the object's physical nature",
    "Keep uncertain distant-region concepts educational and scientifically cautious",
  ];
  if (domain === "stars") return [
    "Explain the stellar structure, stage, or transformation represented by " + topic,
    "Show key physical ideas such as gravity, fusion, pressure balance, or material flow at a high level",
    "Organize the visual as a " + structure + " rather than a generic fact sheet",
    "Use concise labels and avoid unsupported numeric claims",
  ];
  if (domain === "black-holes") return [
    "Show the main visible or conceptual parts connected to " + topic,
    "Explain gravity, light behavior, material motion, or observation effects in neutral scientific language",
    "Separate what astronomers can observe from simplified conceptual diagrams",
    "Avoid sensational or fictional claims while keeping the visual dramatic and readable",
  ];
  if (domain === "cosmology") return [
    "Frame the topic as a large-scale universe concept with careful scientific wording",
    "Show relationships among galaxies, expansion, radiation, time, or observable limits as relevant",
    "Use scale, timeline, map, or evidence-based sections matched to the concept",
    "Avoid presenting open research questions as settled facts",
  ];
  if (domain === "exoplanets") return [
    "Explain how astronomers infer or classify planets around other stars",
    "Show the key observational signal, system geometry, or atmosphere concept when relevant",
    "Use clear sections for method, evidence, limitations, and why the topic matters",
    "Avoid claiming habitability or life without evidence",
  ];
  if (domain === "telescopes") return [
    "Explain the telescope, observatory, or instrument role in astronomy",
    "Show how light, mirrors, detectors, wavelengths, or observation data are used",
    "Connect the instrument to the kinds of space objects or signals it studies",
    "Avoid unsupported mission results and keep the focus on scientific capability",
  ];
  return [
    "Define the astronomy measurement concept and why it helps compare space phenomena",
    "Show the key scale, signal, wavelength, or distance relationship visually",
    "Use examples as categories rather than invented exact values",
    "Make abstract astronomy information readable through diagrams and hierarchy",
  ];
}

function topicPrompt(topic: string) {
  const domain = astronomyDomain(topic);
  const structure = structureType(topic);
  if (domain === "solar-system") return "Explain " + topic + " as a " + structure + " for astronomy learners, focusing on object categories, orbital context, and how the system is organized.";
  if (domain === "moon-orbit") return "Explain " + topic + " through orbital geometry, alignment, light, shadow, tilt, and observable sky effects in a clear astronomy learning format.";
  if (domain === "small-bodies") return "Explain " + topic + " by organizing small solar system bodies, their regions, motion, appearance, and scientific meaning without unsupported certainty.";
  if (domain === "stars") return "Explain " + topic + " as a stellar astronomy visual about structure, lifecycle stage, energy, material, and observable meaning.";
  if (domain === "black-holes") return "Explain " + topic + " with a serious astronomy diagram showing gravity, light behavior, visible evidence, and conceptual structure.";
  if (domain === "cosmology") return "Explain " + topic + " as a large-scale universe concept using careful scientific language, visual scale, evidence, and structured sections.";
  if (domain === "exoplanets") return "Explain " + topic + " as an exoplanet science visual about detection, classification, system geometry, or atmosphere interpretation.";
  if (domain === "telescopes") return "Explain " + topic + " as a telescope or observatory infographic showing instrument role, light collection, wavelengths, and astronomy use cases.";
  return "Explain " + topic + " as an astronomy measurement visual that makes abstract scale, distance, light, or spectrum information easy to understand.";
}

function useCases(domain: string) {
  if (domain === "telescopes") return ["astronomy instrument lessons", "space science explainers", "STEM classroom visuals", "observatory education content"];
  if (domain === "cosmology") return ["cosmology lessons", "science communication", "classroom posters", "astronomy study guides"];
  if (domain === "exoplanets") return ["exoplanet lessons", "space science articles", "teacher handouts", "astronomy content creation"];
  return ["astronomy learning", "visual study guides", "classroom science visuals", "space education content"];
}

function targetAudience(domain: string) {
  if (domain === "cosmology" || domain === "black-holes") return ["students", "teachers", "science creators", "astronomy content creators"];
  return ["students", "teachers", "science creators", "education content teams"];
}

function visibleDescription(topic: string, primaryKeyword: string) {
  const domain = astronomyDomain(topic);
  const generator = "Astronomy Infographic Generator";
  if (domain === "solar-system") return "This " + primaryKeyword + " helps astronomy learners see how " + topic.toLowerCase() + " fits into the wider Solar System. The visual can organize planet categories, orbital context, object traits, and key comparison points into a structured layout that is easier to scan than plain notes. Teachers, students, and space content creators can use the example as a reference for turning astronomy topics into readable sections with clear labels, meaningful diagrams, and a strong visual hierarchy. It also shows how an " + generator + " can support classroom-friendly explanations without inventing unsupported numbers or claims.";
  if (domain === "moon-orbit") return "This " + primaryKeyword + " explains " + topic.toLowerCase() + " through the geometry of light, shadow, motion, and viewpoint. Instead of treating the topic as a list of facts, the infographic can show relationships between celestial bodies and the visible effect an observer notices from Earth. It is useful for lessons, study guides, and science explainers that need clear sequencing, readable labels, and cause-and-effect structure. Built as an " + generator + " example, it keeps the astronomy concept visual, accurate, and easy to discuss.";
  if (domain === "small-bodies") return "This " + primaryKeyword + " turns " + topic.toLowerCase() + " into a structured astronomy visual that separates object type, location, motion, and observation. Small-body topics are easy to confuse, so the infographic can use comparison panels, orbit sketches, and concise notes to make the differences clear. It works well for students, teachers, and science creators who need a clean visual guide rather than dense text. As an " + generator + " example, it emphasizes accurate labels, cautious wording, and organized space science explanation.";
  if (domain === "stars") return "This " + primaryKeyword + " helps explain " + topic.toLowerCase() + " with a visual structure built around stellar stages, energy, material, and observable meaning. Star topics often involve invisible physical processes, so the infographic can use lifecycle flow, layered diagrams, or labeled concept areas to make the science easier to follow. It is designed for astronomy lessons, science study guides, and educational content teams that need professional visual learning material. The example shows how an " + generator + " can turn complex star science into a readable visual format.";
  if (domain === "black-holes") return "This " + primaryKeyword + " presents " + topic.toLowerCase() + " with a serious astronomy layout that separates visual evidence, conceptual structure, and physical explanation. Black hole topics can become sensationalized, so the infographic keeps the tone educational and scientifically careful while still using a strong cosmic visual. It can help students, teachers, and science creators explain gravity, light behavior, material motion, or observation effects with clear hierarchy. The page also works as an " + generator + " example for creating accurate space science visuals.";
  if (domain === "cosmology") return "This " + primaryKeyword + " makes " + topic.toLowerCase() + " easier to understand by using scale, sequence, evidence, or universe-structure sections. Cosmology topics can be abstract, so the infographic can organize careful explanations into a visual path that avoids unsupported certainty. It is useful for classroom discussion, science communication, astronomy articles, and visual study materials. As an " + generator + " example, it shows how large-scale universe concepts can be explained with readable typography, balanced spacing, and scientifically respectful wording.";
  if (domain === "exoplanets") return "This " + primaryKeyword + " explains " + topic.toLowerCase() + " with a visual focus on observation, inference, system geometry, or atmosphere interpretation. Exoplanet science depends on careful signals rather than direct assumptions, so the infographic can separate evidence, method, limitations, and learning takeaways. It is suitable for students, teachers, space writers, and astronomy content creators who need a polished visual explanation. The example demonstrates how an " + generator + " can make modern astronomy topics easier to scan without implying unsupported claims about life or habitability.";
  if (domain === "telescopes") return "This " + primaryKeyword + " shows " + topic.toLowerCase() + " as an instrument-focused astronomy visual, explaining how observations are collected and why different wavelengths or telescope designs matter. The infographic can break the topic into optical path, detector, mission role, observation target, and learning takeaway sections. It is useful for STEM lessons, observatory education, and space science content creation. As an " + generator + " example, it keeps technical information organized, readable, and grounded in supported astronomy concepts.";
  return "This " + primaryKeyword + " explains " + topic.toLowerCase() + " as a clear astronomy measurement visual. Concepts such as distance, light, and spectrum can feel abstract, so the infographic can use scale markers, signal diagrams, and concise examples to make the relationship easier to understand. It is designed for students, teachers, and science creators who need a professional visual guide for space learning. The example shows how an " + generator + " can turn astronomy measurement notes into a structured, readable infographic.";
}

function imageDescription(topic: string) {
  const domain = astronomyDomain(topic);
  if (domain === "solar-system") return "A structured astronomy visual showing " + topic.toLowerCase() + " through object categories, orbital context, and concise labels for classroom-friendly space learning.";
  if (domain === "moon-orbit") return "A cause-and-effect astronomy diagram explaining " + topic.toLowerCase() + " with clear relationships among light, shadow, motion, tilt, or observer viewpoint.";
  if (domain === "small-bodies") return "A small-body astronomy infographic organizing " + topic.toLowerCase() + " by object type, region, motion, appearance, and observation context.";
  if (domain === "stars") return "A stellar science infographic explaining " + topic.toLowerCase() + " with visual sections for structure, lifecycle stage, energy, material, and observable meaning.";
  if (domain === "black-holes") return "A serious astronomy infographic describing " + topic.toLowerCase() + " through gravity, light behavior, material motion, and observation-focused explanation.";
  if (domain === "cosmology") return "A large-scale universe infographic presenting " + topic.toLowerCase() + " with careful scientific wording, visual hierarchy, and concept-based sections.";
  if (domain === "exoplanets") return "An exoplanet science infographic explaining " + topic.toLowerCase() + " through system geometry, observational signals, evidence, and careful interpretation.";
  if (domain === "telescopes") return "An astronomy instrument infographic showing " + topic.toLowerCase() + " with clear sections for light collection, detection, wavelength, and scientific use.";
  return "An astronomy measurement infographic explaining " + topic.toLowerCase() + " with visual scale, signal relationships, and readable concept sections.";
}

function buildTemplate(title: string, index: number) {
  const topic = topicName(title);
  const slug = slugify(title);
  const aspectRatio = index < 5 ? "16:9" : "9:16";
  const domain = astronomyDomain(topic);
  const structure = structureType(topic);
  const style = styleName(topic, index);
  const stylePrompt = stylePrompts[style];
  const points = knowledgePoints(topic);
  const primaryKeyword = title;
  const detailPath = "/infographic/astronomy/" + slug + "/";
  const canonicalUrl = siteUrl + detailPath;
  const imageFilename = "astronomy-" + slug + ".webp";
  const aspectRatioPrompt = "Aspect ratio: " + aspectRatio;
  const topicPromptText = topicPrompt(topic);
  const visibleDescriptionText = visibleDescription(topic, primaryKeyword);
  const imageDescriptionText = imageDescription(topic);
  const contentPrompt = "Create an astronomy knowledge infographic about " + topic + ". Use a " + structure + " structure, not a generic fact sheet. " + topicPromptText + " Knowledge points: " + points.join("; ") + ". Image description: " + imageDescriptionText + " Visible page description to align with: " + visibleDescriptionText + " Use accurate English labels, clear section hierarchy, readable explanatory text, and astronomy diagrams or visuals that match the topic. Do not include astrology, mystical interpretation, unsupported exact values, invented discoveries, or unsupported life/habitability claims.";
  const finalPrompt = [stylePrompt, contentPrompt, aspectRatioPrompt, qualityPrompt].join("\n\n");
  const generated = readGeneratedTemplateManifest()[slug];
  const updatedAt = generated?.updatedAt || "2026-06-13T00:00:00.000Z";

  return {
    id: "astronomy-template-" + String(index + 1).padStart(3, "0"),
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
    shortDescription: "A ready-to-use " + topic.toLowerCase() + " infographic template for astronomy learning and visual science education.",
    visibleDescription: visibleDescriptionText,
    seoTitle: topic + " Infographic Template - KnowLens AI",
    metaDescription: "Explore this " + topic.toLowerCase() + " infographic template for astronomy learning and visual science education. Create a similar visual with KnowLens AI.",
    h1: topic + " Infographic Template",
    primaryKeyword,
    secondaryKeywords: [topic.toLowerCase() + " visual guide", topic.toLowerCase() + " astronomy infographic", "astronomy infographic template", "space science visual"],
    generatorKeywords: generatorKeywords.slice(0, 4),
    previewImagePath: generated?.previewImagePath || (generated?.previewImageUrl ? new URL(generated.previewImageUrl).pathname : "/picture/science-infographic.jpg"),
    previewImageUrl: generated?.previewImageUrl || siteUrl + "/picture/science-infographic.jpg",
    storageKey: generated?.storageKey || "infographic/astronomy/" + imageFilename,
    imageFilename: generated?.imageFilename || imageFilename,
    imageFormat: generated?.imageFormat || ("webp" as const),
    imageMimeType: generated?.imageMimeType || "image/webp",
    imageWidth: generated?.imageWidth || (aspectRatio === "16:9" ? 1792 : 1024),
    imageHeight: generated?.imageHeight || (aspectRatio === "16:9" ? 1024 : 1792),
    imageSizeBytes: generated?.imageSizeBytes,
    aspectRatio,
    imageAlt: topic + " infographic",
    imageTitle: topic + " Infographic Template",
    imageCaption: topic + " Infographic - an astronomy infographic example created with KnowLens AI.",
    imageDescription: imageDescriptionText,
    styleName: style,
    stylePrompt,
    contentPrompt,
    aspectRatioPrompt,
    qualityPrompt,
    finalPrompt,
    createSimilarPrompt: "Create an educational astronomy infographic about " + topic + ". Use " + style + ". " + aspectRatioPrompt + ". Focus on the key astronomy knowledge points, scientific concept explanation, and clear visual learning structure. Keep the design accurate, polished, readable, and professional.",
    topicPrompt: topicPromptText,
    knowledgePoints: points,
    useCases: useCases(domain),
    targetAudience: targetAudience(domain),
    tags: Array.from(new Set(["astronomy", "infographic", domain, ...slug.split("-").filter((part) => !["astronomy", "infographic"].includes(part)).slice(0, 6)])),
    relatedTemplateIds: [] as string[],
    relatedCategorySlugs: ["astronomy", "science", "education", "infographic-examples"],
    relatedToolSlugs: ["science-infographic-generator", "educational-infographic-maker", "ai-infographic-generator"],
    allowPublicDownload: false as const,
    createdAt: "2026-06-13T00:00:00.000Z",
    updatedAt,
  };
}

export function getAstronomyInfographicTemplates() {
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

export const astronomyInfographicTemplates = getAstronomyInfographicTemplates();

export function getAstronomyInfographicTemplate(slug: string) {
  return getAstronomyInfographicTemplates().find((template) => template.slug === slug);
}

export function getAstronomyInfographicBatchJob() {
  const manifestPath = path.join(process.cwd(), "src/lib/astronomy-infographic-generated-images.json");
  if (!existsSync(manifestPath)) return null;
  try {
    return JSON.parse(readFileSync(manifestPath, "utf8")).job || null;
  } catch {
    return null;
  }
}
