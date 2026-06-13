import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const siteUrl = "https://knowlens.ai";
const categorySlug = "insurance";
const categoryName = "Insurance";
const categoryKeyword = "Insurance Infographic Templates";
const batchId = "insurance-knowledge-tuzi-30";
const batchTopic = "Insurance Knowledge Infographic";

const generatorKeywords = [
  "Insurance Infographic Generator",
  "Insurance Knowledge Infographic Maker",
  "Financial Education Infographic Generator",
  "AI Infographic Generator",
  "Knowledge Infographic Generator",
  "Educational Infographic Maker",
];

const topicTitles = [
  "Insurance Basics and How Insurance Works Infographic",
  "Premium vs Deductible vs Copay vs Coinsurance Infographic",
  "Health Insurance Plan Types HMO PPO EPO POS Infographic",
  "Out-of-Pocket Maximum Explained Infographic",
  "Preventive Care vs Emergency Care Coverage Infographic",
  "Life Insurance Term vs Whole Life Infographic",
  "Life Insurance Beneficiary Basics Infographic",
  "Insurance Riders Explained Infographic",
  "Disability Insurance Short-Term vs Long-Term Infographic",
  "Critical Illness Insurance Basics Infographic",
  "Auto Insurance Liability Collision Comprehensive Infographic",
  "Uninsured and Underinsured Motorist Coverage Infographic",
  "How an Auto Insurance Claim Works Infographic",
  "Homeowners Insurance Coverage Structure Infographic",
  "Renters Insurance Basics Infographic",
  "Flood Insurance vs Home Insurance Infographic",
  "Earthquake Insurance Basics Infographic",
  "Travel Insurance Coverage Map Infographic",
  "Trip Cancellation vs Trip Interruption Insurance Infographic",
  "Pet Insurance Basics Infographic",
  "Dental Insurance Basics Infographic",
  "Vision Insurance Basics Infographic",
  "Long-Term Care Insurance Basics Infographic",
  "Umbrella Insurance Explained Infographic",
  "Business Liability Insurance Basics Infographic",
  "Professional Liability vs General Liability Infographic",
  "Workers Compensation Insurance Basics Infographic",
  "Cyber Insurance Basics Infographic",
  "Common Insurance Exclusions and Waiting Periods Infographic",
  "Insurance Underwriting and Risk Assessment Infographic",
] as const;

const stylePrompts: Record<string, string> = {
  "Clean Insurance Guide Style":
    "Clean Insurance Guide Style: Use a modern, clean, professional insurance education infographic style. The image should feel trustworthy, clear, practical, and suitable for policy explanation, coverage basics, claims education, and consumer-friendly insurance knowledge. Use a clear layout with a large readable title, one central explanatory visual focus, and organized information areas. Use a clean sans-serif font with strong hierarchy, readable English labels, and clear explanatory text. Use a light background with navy, teal, blue, soft green, and warm gray accents. Keep the visual polished, easy to scan, educational, and not visually chaotic.",
  "Financial Protection Style":
    "Financial Protection Style: Use a polished financial protection infographic style. The image should feel credible, structured, and suitable for life insurance, disability insurance, umbrella insurance, business insurance, and risk protection education. Use a structured editorial layout with strong section hierarchy, concise financial-protection labels, and clear explanation blocks. Use a professional sans-serif font with readable English text and strong visual hierarchy. Use a light or neutral background with slate, navy, green, muted gold, and gray accents. Keep the visual professional, balanced, and easy to understand.",
  "Friendly Family Coverage Style":
    "Friendly Family Coverage Style: Use a friendly family-focused insurance infographic style. The image should feel approachable, supportive, practical, and suitable for health insurance, renters insurance, travel insurance, dental insurance, and everyday insurance topics. Use soft icon-based visuals, simple conceptual illustrations, and organized explanation blocks. Use a rounded readable sans-serif font with clear English labels and supportive explanatory notes. Use a light cream or white background with soft blue, green, peach, and muted teal accents. Keep the visual welcoming, non-intimidating, clear, and educational.",
  "Risk Dashboard Style":
    "Risk Dashboard Style: Use a structured risk dashboard infographic style. The image should feel analytical, precise, and suitable for claim workflows, policy comparisons, underwriting, exclusions, and insurance terminology breakdowns. Use a dashboard-like layout with section blocks, comparison tables, process steps, and explanatory notes. Use a clean professional sans-serif font with strong hierarchy, readable labels, and concise English text. Use a white or light gray background with navy, cyan, green, amber, and muted red accents. Keep the visual data-rich, organized, and easy to scan.",
  "Blueprint Coverage Map Style":
    "Blueprint Coverage Map Style: Use a precise technical explainer infographic style. The image should feel structured, logical, and suitable for showing how coverage layers work, how policies are structured, how claims flow, and how exclusions or riders fit into a plan. Use a diagram-oriented layout with a central coverage map or process schematic and organized explanation areas. Use a technical sans-serif font with crisp English labels and readable notes. Use a light or dark blueprint-inspired background with navy, white, cyan, and controlled gold accents. Keep the visual accurate, premium, and not cluttered.",
  "Premium Editorial Insurance Style":
    "Premium Editorial Insurance Style: Use a premium magazine-style insurance knowledge infographic design. The image should feel elegant, polished, modern, and suitable for high-quality explainers, consumer education, comparison pages, and protection planning topics. Use a large headline, supporting section headings, clear explanatory text, and refined visual hierarchy. Use an elegant editorial title font with clean readable English body text. Use a sophisticated palette such as deep blue, cream, muted green, slate, and subtle gold accents. Keep the image premium, trustworthy, professional, and visually beautiful.",
};

const qualityPrompt =
  "Create a high-quality professional insurance knowledge infographic with a clear information hierarchy, accurate English labels, reliable and educational insurance concept visualization, precise diagrams and visual structures, no spelling or grammar mistakes, no invented policy rules, no misleading claims, and a polished editorial infographic layout with balanced spacing, readable typography, strong visual hierarchy, clear concept explanations, and easy-to-scan insurance information.";

export type InsuranceInfographicTemplate = ReturnType<typeof buildTemplate>;

type GeneratedInsuranceImage = {
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

type GeneratedInsuranceManifest = { templates?: Record<string, GeneratedInsuranceImage> };

function readGeneratedTemplateManifest() {
  const manifestPath = path.join(process.cwd(), "src/lib/insurance-infographic-generated-images.json");
  if (!existsSync(manifestPath)) return {} as Record<string, GeneratedInsuranceImage>;
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as GeneratedInsuranceManifest;
    return parsed.templates || {};
  } catch {
    return {} as Record<string, GeneratedInsuranceImage>;
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

function insuranceDomain(topic: string) {
  if (/premium|deductible|copay|coinsurance|out-of-pocket|plan types|preventive|health|dental|vision/i.test(topic)) return "health";
  if (/life|beneficiary|riders|disability|critical illness|long-term care|umbrella/i.test(topic)) return "protection";
  if (/auto|motorist|claim/i.test(topic)) return /claim/i.test(topic) ? "claims" : "auto";
  if (/homeowners|renters|flood|earthquake/i.test(topic)) return "property";
  if (/travel|trip|pet/i.test(topic)) return "everyday";
  if (/business|professional liability|general liability|workers compensation|cyber/i.test(topic)) return "business";
  if (/exclusions|waiting|underwriting|risk assessment/i.test(topic)) return "risk";
  return "overview";
}

function structureType(topic: string) {
  if (/ vs | versus |HMO|PPO|EPO|POS|types/i.test(topic)) return "comparison chart";
  if (/claim works|claim/i.test(topic)) return "claim workflow";
  if (/coverage structure|coverage map/i.test(topic)) return "coverage map";
  if (/riders|exclusions|waiting|underwriting|risk assessment/i.test(topic)) return "terminology breakdown";
  if (/beneficiary|out-of-pocket|umbrella|basics|explained/i.test(topic)) return "concept explainer";
  if (/business|cyber|workers/i.test(topic)) return "risk scenario explainer";
  return "policy anatomy";
}

function styleName(topic: string, index: number) {
  const domain = insuranceDomain(topic);
  if (domain === "health") return index % 2 === 0 ? "Friendly Family Coverage Style" : "Clean Insurance Guide Style";
  if (domain === "protection") return index % 2 === 0 ? "Financial Protection Style" : "Premium Editorial Insurance Style";
  if (domain === "auto" || domain === "property" || domain === "everyday") return index % 2 === 0 ? "Clean Insurance Guide Style" : "Friendly Family Coverage Style";
  if (domain === "claims" || domain === "risk") return index % 2 === 0 ? "Risk Dashboard Style" : "Blueprint Coverage Map Style";
  if (domain === "business") return index % 2 === 0 ? "Risk Dashboard Style" : "Financial Protection Style";
  return index % 2 === 0 ? "Premium Editorial Insurance Style" : "Clean Insurance Guide Style";
}

function knowledgePoints(topic: string) {
  if (/premium|deductible|copay|coinsurance/i.test(topic)) return [
    "Define each cost-sharing term in plain English without using fixed dollar examples",
    "Show how premiums, deductibles, copays, and coinsurance affect different moments of care",
    "Clarify that actual costs depend on the plan, provider network, location, and policy terms",
    "Use a comparison layout so readers can see where each term fits in the payment flow",
  ];
  if (/HMO|PPO|EPO|POS/i.test(topic)) return [
    "Compare common health plan structures by network flexibility and referral patterns",
    "Explain that plan rules vary by insurer, region, employer, and policy documents",
    "Use a neutral comparison grid rather than recommending one plan type",
    "Highlight vocabulary that helps readers ask better questions about coverage",
  ];
  if (/claim/i.test(topic)) return [
    "Show a general claim workflow from incident, documentation, review, decision, and payment or denial notice",
    "Explain that claim outcomes depend on policy terms, evidence, exclusions, and applicable rules",
    "Separate consumer actions from insurer review steps in a clear timeline",
    "Avoid promising approval, payout timing, or a specific settlement result",
  ];
  if (/life/i.test(topic)) return [
    "Explain the protection purpose of life insurance without promising investment returns",
    "Separate term coverage, whole life concepts, beneficiaries, and policy ownership where relevant",
    "Clarify that premiums, eligibility, cash value, and benefits depend on the contract",
    "Use a calm protection-planning layout rather than personal recommendation language",
  ];
  if (/auto/i.test(topic)) return [
    "Explain liability, collision, comprehensive, and motorist coverage as broad insurance concepts",
    "Clarify that required coverage and claim handling vary by jurisdiction and policy",
    "Use vehicle, damage, third-party, and protection layer icons to show coverage logic",
    "Avoid recommending specific limits, products, companies, or coverage decisions",
  ];
  if (/home|renters|flood|earthquake/i.test(topic)) return [
    "Show how property coverage can be divided into dwelling, belongings, liability, loss of use, or add-on categories",
    "Explain that flood, earthquake, and other hazards may require separate coverage depending on policy terms",
    "Use a house or apartment coverage map to separate what may be covered from what needs review",
    "Avoid presenting exclusions, deductibles, or hazard rules as universal facts",
  ];
  if (/business|professional|general liability|workers|cyber/i.test(topic)) return [
    "Explain the business risk category and the general role of the insurance type",
    "Separate liability, operations, employee injury, professional services, or cyber incident concepts as appropriate",
    "Clarify that coverage depends on business activities, policy wording, jurisdiction, and insurer review",
    "Use a dashboard or risk-map structure without recommending a policy or carrier",
  ];
  if (/exclusions|waiting|underwriting|risk assessment/i.test(topic)) return [
    "Define the insurance process or limitation in general education language",
    "Explain why insurers review risk, waiting periods, exclusions, documents, or policy conditions",
    "Clarify that rules vary by country, region, insurer, product, and contract wording",
    "Use a structured map that helps readers know what to check in a policy document",
  ];
  return [
    "Explain the insurance concept as general education, not individualized financial or legal advice",
    "Show coverage logic, shared vocabulary, policy structure, or risk transfer in visual sections",
    "Clarify that policy terms vary by country, region, insurer, product, and contract",
    "Avoid specific price, benefit, payout, underwriting, or claim approval claims",
  ];
}

function topicPrompt(topic: string) {
  const structure = structureType(topic);
  return "Explain " + topic + " as a neutral insurance knowledge infographic using a " + structure + " structure. Focus on general insurance education, policy vocabulary, coverage logic, and practical concept clarity without recommending products, companies, limits, or personal decisions.";
}

function visibleDescription(topic: string, primaryKeyword: string) {
  const generator = "Insurance Infographic Generator";
  const domain = insuranceDomain(topic);
  const context =
    domain === "health"
      ? "health coverage vocabulary, plan structure, network questions, and cost-sharing concepts"
      : domain === "protection"
        ? "risk protection, beneficiaries, income disruption, long-term care, or layered coverage concepts"
        : domain === "business"
          ? "business risk categories, liability concepts, cyber incidents, employee injury, and policy review questions"
          : domain === "risk"
            ? "underwriting, exclusions, waiting periods, risk review, and policy condition language"
            : "coverage structure, claim steps, property risks, travel scenarios, or everyday insurance vocabulary";
  return "This " + primaryKeyword + " helps readers understand " + context + " through a clear visual layout. The infographic is built for general insurance education, so it explains concepts and terms without recommending a specific insurer, product, coverage amount, or personal decision. It can help consumers, families, founders, educators, and content teams see how the topic fits into policy documents, claims, coverage layers, or risk transfer. As an " + generator + " example, it keeps the wording neutral and reminds readers that insurance terms vary by country, region, company, and policy.";
}

function imageDescription(topic: string) {
  return "This " + topic.toLowerCase() + " infographic explains insurance concepts in a clear visual format for consumers, families, founders, educators, and content creators.";
}

function shortDescription(topic: string) {
  return "A ready-to-use " + topic.toLowerCase() + " infographic template for insurance education and visual learning.";
}

function useCases(domain: string) {
  if (domain === "business") return ["business insurance education", "founder learning content", "risk awareness explainers", "training visuals"];
  if (domain === "health") return ["consumer health coverage education", "benefits literacy", "family insurance learning", "content explainers"];
  if (domain === "claims") return ["claims education", "consumer support content", "workflow explainers", "policy literacy"];
  return ["insurance education", "consumer learning", "financial literacy content", "visual knowledge guides"];
}

function buildTemplate(title: string, index: number) {
  const topic = topicName(title);
  const slug = slugify(title);
  const aspectRatio = index < 5 ? "16:9" : "9:16";
  const domain = insuranceDomain(topic);
  const structure = structureType(topic);
  const style = styleName(topic, index);
  const stylePrompt = stylePrompts[style];
  const points = knowledgePoints(topic);
  const primaryKeyword = title;
  const detailPath = "/infographic/insurance/" + slug + "/";
  const canonicalUrl = siteUrl + detailPath;
  const imageFilename = "insurance-" + slug + ".webp";
  const aspectRatioPrompt = "Aspect ratio: " + aspectRatio;
  const topicPromptText = topicPrompt(topic);
  const visibleDescriptionText = visibleDescription(topic, primaryKeyword);
  const imageDescriptionText = imageDescription(topic);
  const contentPrompt =
    "Create an insurance knowledge infographic about " + topic + ". Use a " + structure + " structure with a clear title, readable English labels, practical section headings, and organized explanatory text. " +
    topicPromptText + " Knowledge points: " + points.join("; ") + ". Image description: " + imageDescriptionText + " Visible page description to align with: " + visibleDescriptionText +
    " Include a clear note that policy terms, exclusions, waiting periods, premiums, eligibility, and claim outcomes can vary by country, region, insurer, product, and policy document. Do not provide personalized insurance advice, specific product recommendations, specific coverage amounts, real-time quotes, legal guarantees, payout promises, or invented policy rules.";
  const finalPrompt = [stylePrompt, contentPrompt, aspectRatioPrompt, qualityPrompt].join("\n\n");
  const generated = readGeneratedTemplateManifest()[slug];
  const updatedAt = generated?.updatedAt || "2026-06-13T00:00:00.000Z";

  return {
    id: "insurance-template-" + String(index + 1).padStart(3, "0"),
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
    shortDescription: shortDescription(topic),
    visibleDescription: visibleDescriptionText,
    seoTitle: topic + " Infographic Template - KnowLens AI",
    metaDescription: "Explore this " + topic.toLowerCase() + " infographic template for insurance education and visual learning. Create a similar visual with KnowLens AI.",
    h1: topic + " Infographic Template",
    primaryKeyword,
    secondaryKeywords: [topic.toLowerCase() + " visual guide", topic.toLowerCase() + " insurance infographic", "insurance education infographic", "insurance infographic template"],
    generatorKeywords: generatorKeywords.slice(index % 3, index % 3 + 4),
    previewImagePath: generated?.previewImagePath || (generated?.previewImageUrl ? new URL(generated.previewImageUrl).pathname : "/picture/science-infographic.jpg"),
    previewImageUrl: generated?.previewImageUrl || siteUrl + "/picture/science-infographic.jpg",
    storageKey: generated?.storageKey || "infographic/insurance/" + imageFilename,
    imageFilename: generated?.imageFilename || imageFilename,
    imageFormat: generated?.imageFormat || ("webp" as const),
    imageMimeType: generated?.imageMimeType || "image/webp",
    imageWidth: generated?.imageWidth || (aspectRatio === "16:9" ? 1792 : 1024),
    imageHeight: generated?.imageHeight || (aspectRatio === "16:9" ? 1024 : 1792),
    imageSizeBytes: generated?.imageSizeBytes,
    aspectRatio,
    imageAlt: topic + " infographic",
    imageTitle: topic + " Infographic Template",
    imageCaption: topic + " Infographic - an insurance knowledge infographic example created with KnowLens AI.",
    imageDescription: imageDescriptionText,
    styleName: style,
    stylePrompt,
    contentPrompt,
    aspectRatioPrompt,
    qualityPrompt,
    finalPrompt,
    createSimilarPrompt: "Create an educational insurance infographic about " + topic + ". Use " + style + ". " + aspectRatioPrompt + ". Focus on clear insurance concept explanation, coverage logic, policy structure, or claim workflow as appropriate. Keep the design accurate, polished, practical, and professional. Do not provide personalized insurance advice.",
    topicPrompt: topicPromptText,
    knowledgePoints: points,
    useCases: useCases(domain),
    targetAudience: ["consumers", "families", "founders", "educators", "content creators"],
    tags: Array.from(new Set(["insurance", "insurance knowledge", "infographic", domain, ...slug.split("-").filter((part) => !["insurance", "infographic"].includes(part)).slice(0, 6)])),
    relatedTemplateIds: [] as string[],
    relatedCategorySlugs: ["insurance", "financial-education", "education", "infographic-examples"],
    relatedToolSlugs: ["ai-infographic-generator", "educational-infographic-maker", "infographic-maker"],
    allowPublicDownload: false as const,
    createdAt: "2026-06-13T00:00:00.000Z",
    updatedAt,
  };
}

export function getInsuranceInfographicTemplates() {
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

export const insuranceInfographicTemplates = getInsuranceInfographicTemplates();

export function getInsuranceInfographicTemplate(slug: string) {
  return getInsuranceInfographicTemplates().find((template) => template.slug === slug);
}

export function getInsuranceInfographicBatchJob() {
  const manifestPath = path.join(process.cwd(), "src/lib/insurance-infographic-generated-images.json");
  if (!existsSync(manifestPath)) return null;
  try {
    return JSON.parse(readFileSync(manifestPath, "utf8")).job || null;
  } catch {
    return null;
  }
}
