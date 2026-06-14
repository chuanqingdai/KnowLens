import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const siteUrl = "https://knowlens.ai";
const categorySlug = "process";
const categoryName = "Process";
const categoryKeyword = "Process Infographic Templates";
const batchId = "process-infographic-tuzi-100";
const batchTopic = "Process Infographic";
const generatorKeywords = [
  "Process Infographic Generator",
  "Flowchart Infographic Maker",
  "AI Infographic Generator",
  "Text to Infographic Generator",
  "Knowledge Infographic Generator",
];

const topicTitles = [
  "Customer Onboarding Process Infographic",
  "Employee Onboarding Process Infographic",
  "Product Launch Process Infographic",
  "Sales Funnel Process Infographic",
  "Lead Generation Process Infographic",
  "Content Marketing Process Infographic",
  "Social Media Campaign Process Infographic",
  "Brand Strategy Process Infographic",
  "Market Research Process Infographic",
  "Customer Feedback Process Infographic",
  "Design Thinking Process Infographic",
  "UX Research Process Infographic",
  "User Journey Mapping Process Infographic",
  "Wireframing Process Infographic",
  "Product Design Process Infographic",
  "App Development Process Infographic",
  "Software Development Lifecycle Infographic",
  "Agile Sprint Process Infographic",
  "Bug Fixing Process Infographic",
  "Code Review Process Infographic",
  "AI Model Training Process Infographic",
  "Data Cleaning Process Infographic",
  "Data Analysis Process Infographic",
  "Machine Learning Workflow Infographic",
  "Cybersecurity Incident Response Process Infographic",
  "Cloud Migration Process Infographic",
  "API Integration Process Infographic",
  "Website Launch Process Infographic",
  "SEO Optimization Process Infographic",
  "A/B Testing Process Infographic",
  "Scientific Method Process Infographic",
  "Research Paper Writing Process Infographic",
  "Peer Review Process Infographic",
  "Lab Experiment Process Infographic",
  "Hypothesis Testing Process Infographic",
  "Data Collection Process Infographic",
  "Literature Review Process Infographic",
  "Classroom Lesson Planning Process Infographic",
  "Online Course Creation Process Infographic",
  "Student Study Process Infographic",
  "Photosynthesis Process Infographic",
  "Water Cycle Process Infographic",
  "Rock Cycle Process Infographic",
  "Carbon Cycle Process Infographic",
  "Nitrogen Cycle Process Infographic",
  "Food Chain Energy Transfer Process Infographic",
  "Plant Growth Process Infographic",
  "Butterfly Life Cycle Process Infographic",
  "Frog Life Cycle Process Infographic",
  "Seed Germination Process Infographic",
  "Recycling Process Infographic",
  "Composting Process Infographic",
  "Wastewater Treatment Process Infographic",
  "Solar Energy Generation Process Infographic",
  "Wind Energy Generation Process Infographic",
  "Hydropower Generation Process Infographic",
  "Battery Recycling Process Infographic",
  "Plastic Recycling Process Infographic",
  "Sustainable Packaging Process Infographic",
  "Carbon Footprint Reduction Process Infographic",
  "Order Fulfillment Process Infographic",
  "Supply Chain Process Infographic",
  "Inventory Management Process Infographic",
  "Warehouse Picking Process Infographic",
  "Last Mile Delivery Process Infographic",
  "Manufacturing Process Infographic",
  "Quality Control Process Infographic",
  "Product Packaging Process Infographic",
  "Procurement Process Infographic",
  "Returns Management Process Infographic",
  "Recipe Preparation Process Infographic",
  "Meal Planning Process Infographic",
  "Coffee Brewing Process Infographic",
  "Bread Making Process Infographic",
  "Fermentation Process Infographic",
  "Food Preservation Process Infographic",
  "Farm to Table Process Infographic",
  "Urban Gardening Process Infographic",
  "Home Cleaning Process Infographic",
  "Emergency Preparedness Process Infographic",
  "Fire Evacuation Process Infographic",
  "First Aid Response Process Infographic",
  "Workplace Safety Process Infographic",
  "Risk Assessment Process Infographic",
  "Disaster Response Process Infographic",
  "Medical Appointment Process Infographic",
  "Patient Intake Process Infographic",
  "Health Screening Process Infographic",
  "Fitness Training Process Infographic",
  "Sleep Cycle Process Infographic",
  "Personal Budgeting Process Infographic",
  "Goal Setting Process Infographic",
  "Decision Making Process Infographic",
  "Problem Solving Process Infographic",
  "Project Planning Process Infographic",
  "Event Planning Process Infographic",
  "Travel Planning Process Infographic",
  "Hiring Process Infographic",
  "Performance Review Process Infographic",
  "Conflict Resolution Process Infographic",
] as const;

const stylePrompts: Record<string, string> = {
  "Clean Educational Style": "Clean Educational Style: Use a modern, clean, professional educational infographic style. The image should feel bright, trustworthy, polished, and suitable for science learning, business education, and classroom use. Use a clear layout with a large readable title, one central visual focus, and 3-6 supporting cards. Use a clean sans-serif font with large title text, readable section headings, and short English labels. Use a light background with high contrast and soft blue, green, and orange accents. Use 2-4 harmonious colors. Keep the visual beautiful, organized, mobile-readable, and not overcrowded.",
  "Hand-drawn Explainer Style": "Hand-drawn Explainer Style: Use a warm hand-drawn educational explainer style. The image should feel friendly, approachable, charming, and suitable for beginner-friendly process topics, learning content, and practical how-to explanations. Use a notebook-like layout with neat hand-drawn diagrams, small note areas, and simple section blocks. Keep the composition organized and balanced. Use neat handwritten-style English text with a large readable title, short labels, and simple notes. Use a warm paper background, pencil-gray lines, and muted green, blue, and yellow accents. Keep the visual soft, clean, educational, and visually appealing.",
  "Blueprint Technical Style": "Blueprint Technical Style: Use a precise technical diagram style. The image should feel scientific, analytical, structured, and suitable for technical workflows, software processes, engineering, operations, systems, circuits, machines, and logistics topics. Use a grid-based blueprint layout with a central schematic visual and organized explanation areas. Use a technical sans-serif font with crisp English labels and readable callouts. Use a dark navy or blueprint-blue background with white and cyan linework, plus one or two controlled accent colors. Keep the visual clean, accurate, premium, symmetrical, and not cluttered.",
  "Medical Science Style": "Medical Science Style: Use a clean medical and life-science infographic style. The image should feel accurate, calm, trustworthy, polished, and suitable for health education, safety, biology, human body systems, wellness processes, and patient-friendly educational topics. Use a simplified biological or health-related main visual with clear short explanations around it. Keep the content educational, non-scary, and non-diagnostic. Use a clean medical sans-serif font with a large readable title, clear English labels, and short explanatory text. Use a white or soft light background with calm blue, teal, soft red, and muted biological accents. Keep the visual clinical, clean, and beautiful.",
  "Premium Editorial Style": "Premium Editorial Style: Use a premium magazine-style infographic design. The image should feel elegant, polished, visually rich, and suitable for business, environment, productivity, strategy, marketing, leadership, lifestyle, and high-level process overview topics. Use a strong hero visual, a large headline, a concise subtitle, and supporting information blocks. Use refined editorial spacing, balanced composition, clean hierarchy, and beautiful visual rhythm. Use an elegant editorial title font with clean readable body text, all in English and mobile-readable. Use a sophisticated palette such as deep blue, cream, muted green, gold, or topic-matching accents. Keep the image premium, modern, shareable, and visually beautiful.",
  "Dark Premium Tech Style": "Dark Premium Tech Style: Use a dark futuristic science-tech infographic style. The image should feel high-end, cinematic, precise, dramatic, and suitable for AI workflows, cybersecurity, cloud systems, software engineering, data workflows, advanced technology, and digital process topics. Use a dark background with a central glowing technical visual and clean information areas. Use a modern clean sans-serif font with a bright readable title, high-contrast English labels, and concise body text. Use a dark navy, black, or deep purple base with controlled cyan, blue, violet, or green neon accents. Keep the visual premium, polished, readable, and not overloaded with sci-fi clutter.",
};

const qualityPrompt = "Create a high-quality professional knowledge infographic with a clear information hierarchy, accurate and concise English labels, scientifically correct knowledge visualization, precise diagrams and visual structures, no spelling or grammar mistakes, no incorrect or distorted drawings, no invented facts, and a polished editorial infographic layout with balanced spacing, readable typography, and easy-to-scan sections. Optimize the design for mobile viewing, keep the title and section headings large, reduce small text, avoid tiny labels, and keep each stage easy to read on a phone screen.";

export type ProcessInfographicTemplate = ReturnType<typeof buildTemplate>;

type GeneratedProcessImage = {
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
  sourceType?: "tuzi_generated";
  cacheBypassed?: true;
  isFreshGeneration?: true;
  generationStartedAt?: string;
  generationCompletedAt?: string;
  updatedAt: string;
};

type GeneratedProcessManifest = {
  templates?: Record<string, GeneratedProcessImage>;
};

function readGeneratedTemplateManifest() {
  const manifestPath = path.join(process.cwd(), "src/lib/process-infographic-generated-images.json");
  if (!existsSync(manifestPath)) return {} as Record<string, GeneratedProcessImage>;
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as GeneratedProcessManifest;
    return parsed.templates || {};
  } catch {
    return {} as Record<string, GeneratedProcessImage>;
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

function processDomain(topic: string) {
  if (/software|app development|code|api|website|seo|testing|ai|data|machine learning|cybersecurity|cloud/i.test(topic)) return "technology";
  if (/scientific|research|peer review|lab|hypothesis|collection|literature|classroom|course|student/i.test(topic)) return "education";
  if (/photosynthesis|water cycle|rock cycle|carbon cycle|nitrogen|food chain|plant|butterfly|frog|seed|recycling|composting|wastewater|solar|wind|hydropower|battery|plastic|sustainable|footprint/i.test(topic)) return "environment";
  if (/order|supply chain|inventory|warehouse|delivery|manufacturing|quality|packaging|procurement|returns/i.test(topic)) return "operations";
  if (/recipe|meal|coffee|bread|fermentation|food preservation|farm|gardening|cleaning/i.test(topic)) return "lifestyle";
  if (/emergency|fire|first aid|safety|risk|disaster|medical|patient|health|fitness|sleep/i.test(topic)) return "health";
  if (/budgeting|goal|decision|problem|project|event|travel|hiring|performance|conflict/i.test(topic)) return "productivity";
  if (/design|ux|journey|wireframing|product design/i.test(topic)) return "design";
  return "business";
}

function styleName(topic: string, index: number) {
  const domain = processDomain(topic);
  if (domain === "technology") return index % 2 === 0 ? "Dark Premium Tech Style" : "Blueprint Technical Style";
  if (domain === "education") return index % 2 === 0 ? "Clean Educational Style" : "Hand-drawn Explainer Style";
  if (domain === "environment") return index % 2 === 0 ? "Hand-drawn Explainer Style" : "Clean Educational Style";
  if (domain === "operations") return index % 2 === 0 ? "Blueprint Technical Style" : "Clean Educational Style";
  if (domain === "health") return index % 2 === 0 ? "Medical Science Style" : "Clean Educational Style";
  if (domain === "lifestyle") return index % 2 === 0 ? "Hand-drawn Explainer Style" : "Premium Editorial Style";
  if (domain === "design") return index % 2 === 0 ? "Clean Educational Style" : "Premium Editorial Style";
  return index % 2 === 0 ? "Premium Editorial Style" : "Clean Educational Style";
}

function knowledgePoints(topic: string) {
  const domain = processDomain(topic);
  const base = [
    `Define the goal of the ${topic.toLowerCase()}`,
    "Show the main stages in clear order",
    "Highlight handoffs, decisions, or checkpoints",
    "Clarify the final output or result",
  ];
  if (domain === "technology") return [...base, "Include tools, data flow, validation, and deployment-style checkpoints"];
  if (domain === "education") return [...base, "Include preparation, evidence, practice, review, and learning outcomes"];
  if (domain === "environment") return [...base, "Include natural inputs, transformations, cycles, and responsible outcomes"];
  if (domain === "operations") return [...base, "Include intake, processing, quality checks, delivery, and feedback loops"];
  if (domain === "health") return [...base, "Keep the content educational, non-diagnostic, and focused on safe general guidance"];
  if (domain === "lifestyle") return [...base, "Include materials, preparation, sequence, timing, and practical completion cues"];
  return [...base, "Include stakeholders, actions, metrics, decisions, and next steps"];
}

function useCases(domain: string) {
  if (domain === "technology") return ["technical documentation", "team onboarding", "workflow explanation", "product education"];
  if (domain === "education") return ["classroom materials", "study guides", "research communication", "lesson visuals"];
  if (domain === "environment") return ["science education", "sustainability content", "public awareness", "visual learning"];
  if (domain === "operations") return ["operations training", "process documentation", "team alignment", "workflow review"];
  if (domain === "health") return ["health education", "safety training", "wellness communication", "patient-friendly visuals"];
  if (domain === "lifestyle") return ["how-to guides", "lifestyle content", "home education", "social visuals"];
  return ["business education", "team training", "process documentation", "marketing content"];
}

function targetAudience(domain: string) {
  if (domain === "technology") return ["product teams", "engineers", "technical writers", "students"];
  if (domain === "education") return ["students", "teachers", "researchers", "education creators"];
  if (domain === "environment") return ["students", "teachers", "science creators", "sustainability teams"];
  if (domain === "operations") return ["operations teams", "managers", "trainers", "logistics teams"];
  if (domain === "health") return ["students", "educators", "wellness creators", "safety teams"];
  return ["students", "teachers", "content teams", "business teams"];
}

function buildTemplate(title: string, index: number) {
  const topic = topicName(title);
  const slug = slugify(title);
  const aspectRatio = index < 5 ? "16:9" : "9:16";
  const domain = processDomain(topic);
  const style = styleName(topic, index);
  const stylePrompt = stylePrompts[style];
  const points = knowledgePoints(topic);
  const detailPath = `/infographic/process/${slug}/`;
  const canonicalUrl = `${siteUrl}${detailPath}`;
  const imageFilename = `process-${slug}.webp`;
  const aspectRatioPrompt = `Aspect ratio: ${aspectRatio}`;
  const topicPrompt = `Explain the ${topic} as a clear step-by-step process infographic.`;
  const visibleDescription = `This ${topic.toLowerCase()} infographic template explains the process in a clear visual format for students, teams, creators, and educators. It organizes the topic into ordered stages, concise English labels, decision points, checkpoints, and a clear final outcome so viewers can understand the workflow at a glance.`;
  const imageDescription = `This ${topic.toLowerCase()} infographic explains the process in a clear visual format for students, teams, creators, and educators.`;
  const visualPrompt = `Create a process infographic about ${topic}. Use a large readable title, a clear start-to-finish flow, and 3-6 easy-to-scan sections or cards. Show the main stages with arrows, icons, checkpoints, and a final outcome. Content focus: ${topicPrompt} Knowledge points: ${points.join("; ")}. Image description: ${imageDescription} Visible description: ${visibleDescription}`;
  const finalPrompt = [stylePrompt, visualPrompt, aspectRatioPrompt, qualityPrompt].join("\n\n");
  const generated = readGeneratedTemplateManifest()[slug];
  const updatedAt = generated?.updatedAt || "2026-06-13T00:00:00.000Z";

  return {
    id: `process-template-${String(index + 1).padStart(3, "0")}`,
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
    title: `${topic} Infographic Template`,
    topicName: topic,
    shortDescription: `A ready-to-use ${topic.toLowerCase()} infographic template for visual process explanation.`,
    visibleDescription,
    seoTitle: `${topic} Infographic Template - KnowLens AI`,
    metaDescription: `Explore this ${topic.toLowerCase()} infographic template for process learning and visual explanation. Create a similar visual with KnowLens AI.`,
    h1: `${topic} Infographic Template`,
    primaryKeyword: title,
    secondaryKeywords: [`${topic.toLowerCase()} flowchart`, `${topic.toLowerCase()} workflow`, "process infographic template", "step-by-step process visual"],
    generatorKeywords: generatorKeywords.slice(0, 4),
    previewImagePath: generated?.previewImagePath || (generated?.previewImageUrl ? new URL(generated.previewImageUrl).pathname : "/picture/process-infographic-generator.jpg"),
    previewImageUrl: generated?.previewImageUrl || `${siteUrl}/picture/process-infographic-generator.jpg`,
    storageKey: generated?.storageKey || `infographic/process/${imageFilename}`,
    imageFilename: generated?.imageFilename || imageFilename,
    imageFormat: generated?.imageFormat || ("webp" as const),
    imageMimeType: generated?.imageMimeType || "image/webp",
    imageWidth: generated?.imageWidth || (aspectRatio === "16:9" ? 1792 : 1024),
    imageHeight: generated?.imageHeight || (aspectRatio === "16:9" ? 1024 : 1792),
    imageSizeBytes: generated?.imageSizeBytes,
    aspectRatio,
    imageAlt: `${topic} infographic`,
    imageTitle: `${topic} Infographic Template`,
    imageCaption: `${topic} Infographic - a process infographic example created with KnowLens AI.`,
    imageDescription,
    styleName: style,
    stylePrompt,
    contentPrompt: visualPrompt,
    visualPrompt,
    aspectRatioPrompt,
    qualityPrompt,
    finalPrompt,
    createSimilarPrompt: `Create an educational process infographic about ${topic}. Use ${style}. ${aspectRatioPrompt}. Focus on the key process details and knowledge points. Keep the design clear, polished, and professional.`,
    topicPrompt,
    knowledgePoints: points,
    useCases: useCases(domain),
    targetAudience: targetAudience(domain),
    tags: Array.from(new Set(["process", "infographic", domain, "workflow", ...slug.split("-").filter((part) => !["process", "infographic"].includes(part)).slice(0, 5)])),
    relatedTemplateIds: [] as string[],
    relatedCategorySlugs: ["process", "education", "business", "technology"],
    relatedToolSlugs: ["process-infographic-generator", "ai-infographic-generator", "text-to-infographic", "infographic-maker"],
    allowPublicDownload: false as const,
    createdAt: "2026-06-13T00:00:00.000Z",
    updatedAt,
  };
}

export function getProcessInfographicTemplates() {
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

export const processInfographicTemplates = getProcessInfographicTemplates();

export function getProcessInfographicTemplate(slug: string) {
  return getProcessInfographicTemplates().find((template) => template.slug === slug);
}

export function getProcessInfographicBatchJob() {
  const manifestPath = path.join(process.cwd(), "src/lib/process-infographic-generated-images.json");
  if (!existsSync(manifestPath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(manifestPath, "utf8")).job || null;
  } catch {
    return null;
  }
}
