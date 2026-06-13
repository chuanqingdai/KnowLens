import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const siteUrl = "https://knowlens.ai";
const categorySlug = "sex-education";
const categoryName = "Sex Education";
const categoryKeyword = "Sex Education Infographic Templates";
const batchId = "sex-education-infographic-tuzi-20";
const batchTopic = "Sex Education Infographic";
const generatorKeywords = [
  "Sex Education Infographic Generator",
  "Sexual Health Infographic Maker",
  "Health Education Infographic Generator",
  "AI Infographic Generator",
  "Knowledge Infographic Generator",
  "Educational Infographic Maker",
];

const topicTitles = [
  "Consent and Boundaries Infographic",
  "Healthy Relationship Communication Infographic",
  "Reproductive Anatomy Basics Infographic",
  "Menstrual Cycle and Fertility Window Infographic",
  "Contraception Methods Overview Infographic",
  "Condom Use and Barrier Protection Infographic",
  "STI Transmission and Prevention Infographic",
  "STI Testing Workflow Infographic",
  "HPV and Cervical Cancer Prevention Infographic",
  "HIV Prevention Basics Infographic",
  "PrEP and PEP Basics Infographic",
  "Emergency Contraception Basics Infographic",
  "Pregnancy Test Timing Infographic",
  "Birth Control Effectiveness Comparison Infographic",
  "Myths About Pull-Out Method Infographic",
  "Sexual Health Checkup Guide Infographic",
  "Vaginal pH and Hygiene Basics Infographic",
  "Lubrication and Comfort Education Infographic",
  "Sexual Response Cycle Science Infographic",
  "Common Sexual Health Myths Infographic"
] as const;

const stylePrompts: Record<string, string> = {
  "Clean Health Education Style": "Clean Health Education Style: Use a modern, clean, professional health education infographic style. The image should feel trustworthy, calm, respectful, non-judgmental, and suitable for public health education, sexual health learning, contraception education, STI prevention, and relationship communication topics. Use a clear layout with a large readable title, neutral educational visuals, and organized information areas. Use a clean sans-serif font with strong hierarchy, readable English labels, and clear explanatory text. Use a light background with soft blue, teal, lavender, cream, and muted green accents. Keep the visual polished, safe, educational, data-rich, readable, and not visually chaotic.",
  "Medical Explainer Style": "Medical Explainer Style: Use a clean medical education infographic style. The image should feel accurate, clinical, calm, and suitable for reproductive anatomy basics, menstrual cycle education, STI testing, HPV prevention, HIV prevention, and general sexual health topics. Use simplified medical diagrams, abstract body-system visuals, icon-based explanations, and clear text sections. Avoid explicit nudity, sexualized imagery, or detailed genital close-ups. Use a clean medical sans-serif font with clear English labels and readable notes. Use a white or soft light background with teal, blue, soft red, lavender, and gray accents. Keep the visual clinical, respectful, educational, and easy to scan.",
  "Friendly Wellness Guide Style": "Friendly Wellness Guide Style: Use a friendly wellness education infographic style. The image should feel approachable, warm, inclusive, and suitable for consent, boundaries, communication, myths, comfort, hygiene, and healthy relationship topics. Use simple non-sexual character-neutral icons, soft abstract shapes, care symbols, and organized explanation blocks. Use a rounded readable sans-serif font with large title text, clear English labels, and supportive educational notes. Use a warm cream background with soft teal, peach, lavender, blue, and muted green accents. Keep the visual gentle, respectful, non-judgmental, safe, and highly readable.",
  "Public Health Dashboard Style": "Public Health Dashboard Style: Use a structured public health infographic style. The image should feel credible, organized, evidence-oriented, and suitable for STI prevention, testing workflows, contraception comparison, HIV prevention basics, and safety checklists. Use a clean dashboard-like layout with sections, comparison tables, timeline blocks, checklist areas, and simple icons. Use a professional sans-serif font with strong hierarchy, readable English labels, and clear explanatory text. Use a white or light gray background with blue, teal, green, amber, and muted red accents. Keep the visual professional, data-rich, balanced, and easy to scan.",
  "Hand-drawn Health Notebook Style": "Hand-drawn Health Notebook Style: Use a warm hand-drawn health education notebook infographic style. The image should feel friendly, human, approachable, and suitable for beginner-friendly sex education, body literacy, relationship communication, myths, and wellness basics. Use a notebook-like layout with neat hand-drawn non-explicit illustrations, simple icons, small note areas, and organized educational sections. Use neat handwritten-style English text with a large readable title, short labels, and clear notes. Use a warm paper background, pencil-gray outlines, muted teal, blue, lavender, peach, and green accents. Keep the visual soft, respectful, educational, safe, and highly shareable.",
  "Premium Editorial Health Style": "Premium Editorial Health Style: Use a premium editorial health education infographic style. The image should feel polished, modern, serious, respectful, and suitable for high-quality sexual health explainers, myth-vs-fact pages, prevention guides, and adult health education content. Use refined editorial spacing, a large headline, concise section headings, clear explanatory text, and neutral educational visuals. Use an elegant editorial title font with clean readable English body text. Use a sophisticated palette such as deep teal, cream, muted blue, lavender, warm gray, and subtle coral accents. Keep the image premium, trustworthy, non-sensational, educational, and visually beautiful."
};

const qualityPrompt = "Create a high-quality professional sex education infographic with a clear information hierarchy, accurate English labels, scientifically responsible sexual health education, non-explicit and non-sexualized visual presentation, precise educational diagrams and visual structures, no nudity, no erotic imagery, no spelling or grammar mistakes, no invented medical facts, no diagnosis or treatment claims, and a polished editorial infographic layout with balanced spacing, readable typography, strong visual hierarchy, data-rich educational sections, clear concept explanations, and easy-to-scan sexual health information.";

export type SexEducationInfographicTemplate = ReturnType<typeof buildTemplate>;

type GeneratedSexEducationImage = {
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

type GeneratedSexEducationManifest = { templates?: Record<string, GeneratedSexEducationImage> };

function readGeneratedTemplateManifest() {
  const manifestPath = path.join(process.cwd(), "src/lib/sex-education-infographic-generated-images.json");
  if (!existsSync(manifestPath)) return {} as Record<string, GeneratedSexEducationImage>;
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as GeneratedSexEducationManifest;
    return parsed.templates || {};
  } catch {
    return {} as Record<string, GeneratedSexEducationImage>;
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

function sexEducationDomain(topic: string) {
  if (/consent|boundaries|relationship|communication/i.test(topic)) return "communication";
  if (/anatomy|menstrual|fertility|vaginal ph|hygiene|sexual response/i.test(topic)) return "body-literacy";
  if (/contraception|condom|barrier|birth control|pull-out|emergency contraception|pregnancy test/i.test(topic)) return "contraception";
  if (/sti|hpv|hiv|prep|pep|testing/i.test(topic)) return "sti-prevention";
  if (/checkup|comfort|lubrication/i.test(topic)) return "care-and-comfort";
  if (/myth/i.test(topic)) return "myths";
  return "sexual-health";
}

function structureType(topic: string) {
  const domain = sexEducationDomain(topic);
  if (/myth|pull-out/i.test(topic)) return "myth vs fact";
  if (/testing|checkup/i.test(topic)) return "testing workflow";
  if (/effectiveness|overview|methods|comparison/i.test(topic)) return "comparison matrix";
  if (/consent|communication|boundaries/i.test(topic)) return "communication guide";
  if (/transmission|prevention|hiv|hpv|prep|pep/i.test(topic)) return "risk reduction map";
  if (/cycle|fertility|timing/i.test(topic)) return "timeline explanation";
  if (domain === "body-literacy") return "body system overview";
  if (domain === "care-and-comfort") return "safety and care checklist";
  return "common questions explainer";
}

function styleName(topic: string, index: number) {
  const domain = sexEducationDomain(topic);
  if (domain === "communication") return index % 2 === 0 ? "Friendly Wellness Guide Style" : "Hand-drawn Health Notebook Style";
  if (domain === "body-literacy") return index % 2 === 0 ? "Medical Explainer Style" : "Clean Health Education Style";
  if (domain === "contraception") return index % 2 === 0 ? "Public Health Dashboard Style" : "Clean Health Education Style";
  if (domain === "sti-prevention") return index % 2 === 0 ? "Medical Explainer Style" : "Public Health Dashboard Style";
  if (domain === "care-and-comfort") return index % 2 === 0 ? "Friendly Wellness Guide Style" : "Clean Health Education Style";
  if (domain === "myths") return index % 2 === 0 ? "Premium Editorial Health Style" : "Hand-drawn Health Notebook Style";
  return index % 2 === 0 ? "Clean Health Education Style" : "Premium Editorial Health Style";
}

function knowledgePoints(topic: string) {
  const domain = sexEducationDomain(topic);
  if (domain === "communication") return [
    "Explain consent as clear, voluntary, specific, and reversible communication",
    "Show how boundaries can be discussed with respectful language and active listening",
    "Separate healthy communication signals from pressure, coercion, or disrespect",
    "Use neutral icons and non-sexual character-free visuals for a safe education tone",
  ];
  if (domain === "body-literacy") return [
    "Explain the body literacy concept with simplified medical or abstract diagrams only",
    "Organize key terms, cycle stages, or body-system relationships in readable sections",
    "Avoid explicit nudity, detailed genital close-ups, or sexualized presentation",
    "Encourage professional medical consultation for personal symptoms or concerns",
  ];
  if (domain === "contraception") return [
    "Compare general prevention concepts without inventing exact effectiveness numbers",
    "Explain that method choice depends on personal health needs and professional guidance",
    "Show barrier protection, timing, or method categories with neutral public health icons",
    "Avoid sexual technique instruction and keep the focus on health education and risk reduction",
  ];
  if (domain === "sti-prevention") return [
    "Explain transmission, prevention, testing, or medical consultation as public health education",
    "Use a non-stigmatizing tone and avoid shame, fear, or moral judgment",
    "Show prevention and testing steps without diagnosis, treatment, or medication dosing claims",
    "Encourage users to consult qualified healthcare professionals for personal guidance",
  ];
  if (domain === "care-and-comfort") return [
    "Explain hygiene, checkup, or comfort concepts with respectful wellness language",
    "Separate normal education from symptoms that may require professional medical advice",
    "Use neutral icons, care checklists, and non-explicit diagrams rather than body exposure",
    "Avoid claims about diagnosis, treatment, sexual performance, or sexual stimulation",
  ];
  return [
    "Identify common myths and replace them with careful public health education wording",
    "Clarify what the infographic can explain versus what requires professional medical advice",
    "Use neutral visual sections that avoid sensational, sexualized, or fear-based framing",
    "Keep the tone respectful, inclusive, non-shaming, and scientifically responsible",
  ];
}

function topicPrompt(topic: string) {
  const structure = structureType(topic);
  const domain = sexEducationDomain(topic);
  if (domain === "communication") return "Explain " + topic + " as a respectful sexual health education " + structure + " about consent, boundaries, communication, and safety without depicting sexual situations.";
  if (domain === "body-literacy") return "Explain " + topic + " as a public health education " + structure + " using simplified medical icons, abstract diagrams, and non-explicit labels.";
  if (domain === "contraception") return "Explain " + topic + " as a sexual health education " + structure + " about prevention categories, general use concepts, and healthcare guidance without sexual technique instruction.";
  if (domain === "sti-prevention") return "Explain " + topic + " as a public health " + structure + " about prevention, testing, consultation, and non-stigmatizing sexual health learning.";
  if (domain === "care-and-comfort") return "Explain " + topic + " as a respectful wellness education " + structure + " with safety, care, and healthcare-consultation sections.";
  return "Explain " + topic + " as a myth-aware sexual health education " + structure + " that uses neutral, non-explicit, medically responsible public health language.";
}

function visibleDescription(topic: string, primaryKeyword: string) {
  const domain = sexEducationDomain(topic);
  const generator = "Sex Education Infographic Generator";
  if (domain === "communication") return "This " + primaryKeyword + " helps learners understand respectful communication, consent, and boundaries through a calm visual structure. Instead of using awkward or sensational examples, the infographic can organize key ideas such as clear language, listening, pressure, comfort, and personal limits into safe education sections. It is useful for health educators, public health communicators, adult education teams, and content creators who need non-explicit visual learning material. Built as a " + generator + " example, it keeps the message practical, respectful, and focused on healthy relationship education.";
  if (domain === "body-literacy") return "This " + primaryKeyword + " turns body literacy and reproductive health education into a readable visual guide. The infographic can use simplified medical diagrams, abstract icons, cycle timelines, and neutral labels to explain the topic without nudity or explicit imagery. It is designed for health education, public health communication, and adult learning contexts where clarity and respect matter. As a " + generator + " example, it shows how sensitive health topics can be presented with professional visual hierarchy, careful wording, and reminders to seek qualified medical guidance for personal concerns.";
  if (domain === "contraception") return "This " + primaryKeyword + " explains contraception or pregnancy-prevention concepts as public health education rather than personal medical advice. The visual can organize method categories, barrier protection, timing, comparison points, and consultation reminders in a clear, non-judgmental layout. It helps health educators, public health teams, and content creators make complex choices easier to understand without inventing effectiveness data or teaching sexual techniques. Created as a " + generator + " example, it keeps the focus on safe, respectful, non-explicit learning.";
  if (domain === "sti-prevention") return "This " + primaryKeyword + " presents STI, HIV, HPV, testing, or prevention information in a calm public health format. The infographic can separate transmission basics, prevention steps, testing workflow, healthcare consultation, and myth correction into readable sections without stigma or fear-based language. It is useful for sexual health education, clinic communication, adult learning, and public health content. As a " + generator + " example, it demonstrates how sensitive prevention topics can be visual, accurate, non-explicit, and medically responsible without offering diagnosis or treatment instructions.";
  if (domain === "care-and-comfort") return "This " + primaryKeyword + " explains sexual health care, hygiene, checkups, or comfort education with respectful wellness language. The infographic can use safe checklists, common questions, neutral icons, and professional consultation reminders to help users understand the topic without shame or explicit imagery. It is designed for health educators, wellness communicators, and adult learning materials that need a supportive tone. Built as a " + generator + " example, it keeps the content practical, non-sexualized, and focused on public health learning rather than personal medical advice.";
  return "This " + primaryKeyword + " helps correct common sexual health misconceptions with a respectful myth-vs-fact structure. The infographic can organize careful explanations, uncertainty, consultation reminders, and public health context into a clear visual guide. It is useful for educators, content creators, and communication teams that need non-shaming sexual health education material. As a " + generator + " example, it avoids sensational claims, explicit imagery, and individual medical advice while helping readers understand the topic through structured visual learning.";
}

function imageDescription(topic: string) {
  const domain = sexEducationDomain(topic);
  if (domain === "communication") return "A respectful sexual health education visual explaining " + topic.toLowerCase() + " with consent, boundary, communication, and safety sections using neutral non-sexual icons.";
  if (domain === "body-literacy") return "A non-explicit medical education infographic explaining " + topic.toLowerCase() + " with simplified diagrams, neutral labels, and public health context.";
  if (domain === "contraception") return "A public health infographic explaining " + topic.toLowerCase() + " through method categories, risk-reduction concepts, consultation reminders, and clear comparison sections.";
  if (domain === "sti-prevention") return "A non-stigmatizing sexual health infographic explaining " + topic.toLowerCase() + " with prevention, testing, consultation, and public health education sections.";
  if (domain === "care-and-comfort") return "A respectful wellness education infographic explaining " + topic.toLowerCase() + " with care checklists, neutral icons, and professional guidance reminders.";
  return "A myth-aware sexual health education infographic explaining " + topic.toLowerCase() + " with careful public health wording, neutral visuals, and readable sections.";
}

function useCases(domain: string) {
  if (domain === "sti-prevention") return ["public health education", "clinic communication", "sexual health lessons", "health content creation"];
  if (domain === "communication") return ["relationship education", "consent education", "adult health learning", "wellness communication"];
  if (domain === "contraception") return ["contraception education", "public health explainers", "health class visuals", "adult learning materials"];
  return ["sexual health education", "public health communication", "wellness learning", "health education content"];
}

function buildTemplate(title: string, index: number) {
  const topic = topicName(title);
  const slug = slugify(title);
  const aspectRatio = index < 5 ? "16:9" : "9:16";
  const domain = sexEducationDomain(topic);
  const structure = structureType(topic);
  const style = styleName(topic, index);
  const stylePrompt = stylePrompts[style];
  const points = knowledgePoints(topic);
  const primaryKeyword = title;
  const detailPath = "/infographic/sex-education/" + slug + "/";
  const canonicalUrl = siteUrl + detailPath;
  const imageFilename = "sex-education-" + slug + ".webp";
  const aspectRatioPrompt = "Aspect ratio: " + aspectRatio;
  const topicPromptText = topicPrompt(topic);
  const visibleDescriptionText = visibleDescription(topic, primaryKeyword);
  const imageDescriptionText = imageDescription(topic);
  const contentPrompt = "Create a sex education infographic about " + topic + " for public health and sexual health education. Use a " + structure + " structure. " + topicPromptText + " Knowledge points: " + points.join("; ") + ". Image description: " + imageDescriptionText + " Visible page description to align with: " + visibleDescriptionText + " Use neutral icons, abstract diagrams, calm health education visuals, readable English labels, and organized sections. No nudity, no explicit anatomy close-ups, no sexual acts, no erotic imagery, no minors, no dating or school scenario, no sexual technique instruction, no stimulation or performance advice, no diagnosis, no treatment plan, no medication dosage, and no stigmatizing language.";
  const finalPrompt = [stylePrompt, contentPrompt, aspectRatioPrompt, qualityPrompt].join("\n\n");
  const generated = readGeneratedTemplateManifest()[slug];
  const updatedAt = generated?.updatedAt || "2026-06-13T00:00:00.000Z";

  return {
    id: "sex-education-template-" + String(index + 1).padStart(3, "0"),
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
    shortDescription: "A respectful " + topic.toLowerCase() + " infographic template for sexual health education and visual learning.",
    visibleDescription: visibleDescriptionText,
    seoTitle: topic + " Infographic Template - KnowLens AI",
    metaDescription: "Explore this " + topic.toLowerCase() + " infographic template for sexual health education and visual learning. Create a similar visual with KnowLens AI.",
    h1: topic + " Infographic Template",
    primaryKeyword,
    secondaryKeywords: [topic.toLowerCase() + " visual guide", topic.toLowerCase() + " sexual health infographic", "sex education infographic template", "public health education visual"],
    generatorKeywords: generatorKeywords.slice(0, 4),
    previewImagePath: generated?.previewImagePath || (generated?.previewImageUrl ? new URL(generated.previewImageUrl).pathname : "/picture/science-infographic.jpg"),
    previewImageUrl: generated?.previewImageUrl || siteUrl + "/picture/science-infographic.jpg",
    storageKey: generated?.storageKey || "infographic/sex-education/" + imageFilename,
    imageFilename: generated?.imageFilename || imageFilename,
    imageFormat: generated?.imageFormat || ("webp" as const),
    imageMimeType: generated?.imageMimeType || "image/webp",
    imageWidth: generated?.imageWidth || (aspectRatio === "16:9" ? 1792 : 1024),
    imageHeight: generated?.imageHeight || (aspectRatio === "16:9" ? 1024 : 1792),
    imageSizeBytes: generated?.imageSizeBytes,
    aspectRatio,
    imageAlt: topic + " infographic",
    imageTitle: topic + " Infographic Template",
    imageCaption: topic + " Infographic - a sexual health education infographic example created with KnowLens AI.",
    imageDescription: imageDescriptionText,
    styleName: style,
    stylePrompt,
    contentPrompt,
    aspectRatioPrompt,
    qualityPrompt,
    finalPrompt,
    createSimilarPrompt: "Create an educational sexual health infographic about " + topic + ". Use " + style + ". " + aspectRatioPrompt + ". Focus on accurate, non-explicit sexual health knowledge, safe public health education, clear concept explanation, and readable visual learning structure. Keep the design respectful, medically responsible, polished, and professional.",
    topicPrompt: topicPromptText,
    knowledgePoints: points,
    useCases: useCases(domain),
    targetAudience: ["health educators", "public health communicators", "students", "adult education content teams"],
    tags: Array.from(new Set(["sex education", "sexual health", "infographic", domain, ...slug.split("-").filter((part) => !["sex", "education", "infographic"].includes(part)).slice(0, 6)])),
    relatedTemplateIds: [] as string[],
    relatedCategorySlugs: ["sex-education", "health", "education", "infographic-examples"],
    relatedToolSlugs: ["educational-infographic-maker", "science-infographic-generator", "ai-infographic-generator"],
    allowPublicDownload: false as const,
    createdAt: "2026-06-13T00:00:00.000Z",
    updatedAt,
  };
}

export function getSexEducationInfographicTemplates() {
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

export const sexEducationInfographicTemplates = getSexEducationInfographicTemplates();

export function getSexEducationInfographicTemplate(slug: string) {
  return getSexEducationInfographicTemplates().find((template) => template.slug === slug);
}

export function getSexEducationInfographicBatchJob() {
  const manifestPath = path.join(process.cwd(), "src/lib/sex-education-infographic-generated-images.json");
  if (!existsSync(manifestPath)) return null;
  try {
    return JSON.parse(readFileSync(manifestPath, "utf8")).job || null;
  } catch {
    return null;
  }
}
