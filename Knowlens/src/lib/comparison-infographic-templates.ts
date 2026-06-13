import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const siteUrl = "https://knowlens.ai";
const categorySlug = "comparison";
const categoryName = "Comparison";
const categoryKeyword = "Comparison Infographic Templates";
const batchId = "comparison-infographic-tuzi-50";
const batchTopic = "Comparison Infographic";
const aspectRatio = "9:16";
const aspectRatioPrompt = "Aspect ratio: 9:16";

const generatorKeywords = [
  "Comparison Infographic Generator",
  "Decision Matrix Infographic Maker",
  "Visual Comparison Chart Maker",
  "AI Infographic Generator",
  "Text to Infographic Generator",
];

const qualityPrompt =
  "Create a high-quality professional comparison infographic with a clear information hierarchy, accurate and concise English labels, precise and fair side-by-side reasoning, no spelling or grammar mistakes, no incorrect or distorted visuals, no invented benchmarks, no fake prices, and a polished editorial infographic layout with balanced spacing, strong contrast, and easy-to-scan sections. Optimize the design for mobile-first readability, keep the title and section headings large, reduce small text, avoid tiny labels, keep comparison cards legible on a phone screen, and favor concise bullets over dense paragraphs.";

const stylePrompts = {
  "Visual Decision Matrix Style":
    "Visual Decision Matrix Style: Use a clean, high-clarity decision matrix infographic style. The image should feel analytical, modern, and easy to scan on mobile. Use strong visual separation between options, clear column headers, icon-supported comparison points, and concise explanation cards. Use a light background with teal, slate, blue, and soft amber accents. Keep the design structured, practical, and comparison-first.",
  "Dark Premium Tech Comparison Style":
    "Dark Premium Tech Comparison Style: Use a premium dark technology comparison infographic style. The image should feel advanced, polished, and credible for AI, software, cloud, and engineering topics. Use a dark navy or charcoal background with bright readable headings, structured comparison panels, controlled cyan and green accents, and high-contrast labels. Keep the composition premium, clean, and very legible on mobile.",
  "Editorial Comparison Brief Style":
    "Editorial Comparison Brief Style: Use a premium editorial briefing infographic style. The image should feel polished, strategic, and suitable for business, marketing, and management topics. Use a strong title, short subtitle, balanced comparison blocks, supporting notes, and decision takeaways. Use a white or cream background with navy, forest green, muted red, and warm gray accents. Keep the layout elegant, readable, and not crowded.",
  "Financial Choice Guide Style":
    "Financial Choice Guide Style: Use a clean financial choice-guide infographic style. The image should feel calm, trustworthy, and suitable for finance, insurance, real-estate, and payment topics. Use clear option cards, trade-off rows, risk notes, and practical scenario blocks. Use a light background with dark blue, teal, green, and muted gold accents. Keep the layout educational, non-advisory, and easy to compare at a glance.",
  "Classroom Comparison Chart Style":
    "Classroom Comparison Chart Style: Use a clean classroom comparison chart style. The image should feel educational, approachable, and effective for learning topics, work styles, career comparisons, and beginner-friendly explainers. Use a large title, readable labels, icon-supported category rows, and short takeaway notes. Use a bright light background with blue, green, and orange accents. Keep the design mobile-readable and teaching-friendly.",
  "Product Strategy Comparison Style":
    "Product Strategy Comparison Style: Use a structured product strategy comparison infographic style. The image should feel practical, product-minded, and useful for SaaS, growth, research, and workflow trade-off topics. Use clear headers, fit-by-scenario sections, trade-off callouts, and selection logic cards. Use a neutral light background with blue, emerald, graphite, and muted coral accents. Keep the design crisp, modern, and decision-oriented.",
} as const;

type StyleName = keyof typeof stylePrompts;
type Domain =
  | "ai"
  | "business"
  | "marketing"
  | "finance"
  | "insurance"
  | "real-estate"
  | "software"
  | "energy"
  | "work"
  | "learning"
  | "research";

type TopicDefinition = {
  title: string;
  structureType: string;
};

const topicDefinitions: TopicDefinition[] = [
  { title: "AI Agent vs AI Assistant Comparison Infographic", structureType: "capability comparison" },
  { title: "MCP vs API Comparison Infographic", structureType: "workflow comparison" },
  { title: "RAG vs Fine-Tuning Comparison Infographic", structureType: "decision tree comparison" },
  { title: "Vector Database vs Traditional Database Comparison Infographic", structureType: "feature-by-feature comparison" },
  { title: "Prompt Engineering vs Context Engineering Comparison Infographic", structureType: "maturity comparison" },
  { title: "Cloud AI vs On-Device AI Comparison Infographic", structureType: "use-case fit comparison" },
  { title: "Open-Source LLM vs Closed-Source LLM Comparison Infographic", structureType: "risk comparison" },
  { title: "AI Coding Agent vs Code Assistant Comparison Infographic", structureType: "capability comparison" },
  { title: "Human-in-the-Loop AI vs Fully Automated AI Comparison Infographic", structureType: "decision scorecard" },
  { title: "Multimodal AI vs Text-Only AI Comparison Infographic", structureType: "feature-by-feature comparison" },
  { title: "SaaS vs Marketplace Business Model Comparison Infographic", structureType: "comparison matrix" },
  { title: "B2B vs B2C Business Model Comparison Infographic", structureType: "comparison matrix" },
  { title: "Subscription Revenue vs Transaction Revenue Comparison Infographic", structureType: "cost vs value comparison" },
  { title: "Product-Led Growth vs Sales-Led Growth Comparison Infographic", structureType: "workflow comparison" },
  { title: "SEO vs GEO Comparison Infographic", structureType: "use-case fit comparison" },
  { title: "Answer Engine Optimization vs Traditional SEO Comparison Infographic", structureType: "feature-by-feature comparison" },
  { title: "Landing Page vs Product Page Comparison Infographic", structureType: "decision tree comparison" },
  { title: "Freemium vs Free Trial Comparison Infographic", structureType: "pros and cons comparison" },
  { title: "Brand Marketing vs Performance Marketing Comparison Infographic", structureType: "before-and-after comparison" },
  { title: "Content Marketing vs Paid Ads Comparison Infographic", structureType: "cost vs value comparison" },
  { title: "ETF vs Mutual Fund Comparison Infographic", structureType: "comparison matrix" },
  { title: "Stocks vs Bonds Comparison Infographic", structureType: "risk comparison" },
  { title: "Growth Stocks vs Value Stocks Comparison Infographic", structureType: "maturity comparison" },
  { title: "Active Investing vs Passive Investing Comparison Infographic", structureType: "use-case fit comparison" },
  { title: "Term Life vs Whole Life Insurance Comparison Infographic", structureType: "cost vs value comparison" },
  { title: "HMO vs PPO Health Insurance Comparison Infographic", structureType: "feature-by-feature comparison" },
  { title: "Deductible vs Copay vs Coinsurance Comparison Infographic", structureType: "comparison matrix" },
  { title: "Rent vs Buy Home Comparison Infographic", structureType: "decision scorecard" },
  { title: "Fixed-Rate vs Adjustable-Rate Mortgage Comparison Infographic", structureType: "risk comparison" },
  { title: "Credit Card vs Debit Card Comparison Infographic", structureType: "use-case fit comparison" },
  { title: "iOS vs Android App Development Comparison Infographic", structureType: "feature-by-feature comparison" },
  { title: "Native App vs Web App Comparison Infographic", structureType: "cost vs value comparison" },
  { title: "React vs Vue Comparison Infographic", structureType: "beginner vs advanced comparison" },
  { title: "SQL vs NoSQL Comparison Infographic", structureType: "comparison matrix" },
  { title: "Monolith vs Microservices Comparison Infographic", structureType: "stack comparison" },
  { title: "Serverless vs Containers Comparison Infographic", structureType: "workflow comparison" },
  { title: "Agile vs Waterfall Comparison Infographic", structureType: "maturity comparison" },
  { title: "CI/CD vs Manual Deployment Comparison Infographic", structureType: "before-and-after comparison" },
  { title: "Cybersecurity Prevention vs Detection Comparison Infographic", structureType: "risk comparison" },
  { title: "Passwords vs Passkeys Comparison Infographic", structureType: "capability comparison" },
  { title: "Electric Vehicles vs Gas Cars Comparison Infographic", structureType: "cost vs value comparison" },
  { title: "Solar Energy vs Wind Energy Comparison Infographic", structureType: "use-case fit comparison" },
  { title: "Lithium-Ion vs Solid-State Batteries Comparison Infographic", structureType: "maturity comparison" },
  { title: "Public Cloud vs Private Cloud Comparison Infographic", structureType: "stack comparison" },
  { title: "Renewable Energy vs Fossil Fuels Comparison Infographic", structureType: "risk comparison" },
  { title: "Remote Work vs Hybrid Work Comparison Infographic", structureType: "workflow comparison" },
  { title: "Online Learning vs Classroom Learning Comparison Infographic", structureType: "beginner vs advanced comparison" },
  { title: "UX Research vs Market Research Comparison Infographic", structureType: "feature-by-feature comparison" },
  { title: "Data Analyst vs Data Scientist Comparison Infographic", structureType: "capability comparison" },
  { title: "Product Manager vs Project Manager Comparison Infographic", structureType: "decision scorecard" },
] as const;

type GeneratedComparisonImage = {
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

type GeneratedComparisonManifest = {
  templates?: Record<string, GeneratedComparisonImage>;
};

function readGeneratedTemplateManifest() {
  const manifestPath = path.join(process.cwd(), "src/lib/comparison-infographic-generated-images.json");
  if (!existsSync(manifestPath)) return {} as Record<string, GeneratedComparisonImage>;
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as GeneratedComparisonManifest;
    return parsed.templates || {};
  } catch {
    return {} as Record<string, GeneratedComparisonImage>;
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function topicName(title: string) {
  return title.replace(/\s+Comparison Infographic$/i, "").trim();
}

function comparisonItems(topic: string) {
  return topic.split(/\s+vs\s+/i).map((item) => item.trim()).filter(Boolean);
}

function naturalJoin(values: string[]) {
  if (values.length <= 1) return values[0] || "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function comparisonDomain(topic: string): Domain {
  if (/AI|LLM|RAG|Prompt Engineering|Context Engineering|Cloud AI|Coding Agent|Passkeys|Passwords|MCP|API|Vector Database|Multimodal/i.test(topic)) return "ai";
  if (/SaaS|B2B|B2C|Subscription Revenue|Transaction Revenue|Freemium|Free Trial|Landing Page|Product Page/i.test(topic)) return "business";
  if (/SEO|GEO|Answer Engine Optimization|Brand Marketing|Performance Marketing|Content Marketing|Paid Ads/i.test(topic)) return "marketing";
  if (/ETF|Mutual Fund|Stocks|Bonds|Investing|Credit Card|Debit Card/i.test(topic)) return "finance";
  if (/Insurance|HMO|PPO|Deductible|Copay|Coinsurance/i.test(topic)) return "insurance";
  if (/Rent vs Buy Home|Mortgage/i.test(topic)) return "real-estate";
  if (/App Development|Web App|React|Vue|SQL|NoSQL|Monolith|Microservices|Serverless|Containers|Agile|Waterfall|CI\/CD|Cybersecurity|Public Cloud/i.test(topic)) return "software";
  if (/Electric Vehicles|Gas Cars|Solar Energy|Wind Energy|Batteries|Renewable Energy|Fossil Fuels/i.test(topic)) return "energy";
  if (/Remote Work|Hybrid Work|Product Manager|Project Manager/i.test(topic)) return "work";
  if (/Online Learning|Classroom Learning/i.test(topic)) return "learning";
  return "research";
}

function styleName(domain: Domain, index: number): StyleName {
  if (domain === "ai" || domain === "software") return index % 2 === 0 ? "Dark Premium Tech Comparison Style" : "Visual Decision Matrix Style";
  if (domain === "finance" || domain === "insurance" || domain === "real-estate") return "Financial Choice Guide Style";
  if (domain === "business" || domain === "marketing" || domain === "research") return index % 2 === 0 ? "Editorial Comparison Brief Style" : "Product Strategy Comparison Style";
  if (domain === "energy") return index % 2 === 0 ? "Visual Decision Matrix Style" : "Editorial Comparison Brief Style";
  return "Classroom Comparison Chart Style";
}

function comparisonDimensions(topic: string, domain: Domain) {
  if (/RAG vs Fine-Tuning/i.test(topic)) return ["knowledge freshness", "setup cost", "model behavior", "maintenance load", "where each approach fits"];
  if (/MCP vs API/i.test(topic)) return ["integration model", "tool access pattern", "developer control", "maintenance scope", "when each interface is useful"];
  if (/Vector Database vs Traditional Database/i.test(topic)) return ["query model", "data shape", "retrieval strength", "operational complexity", "best-fit workloads"];
  if (/Open-Source LLM vs Closed-Source LLM/i.test(topic)) return ["control", "deployment responsibility", "cost visibility", "compliance fit", "speed to adoption"];
  if (/Deductible vs Copay vs Coinsurance/i.test(topic)) return ["when you pay", "how the amount is calculated", "predictability", "impact on total care cost", "how they work together"];
  if (/Rent vs Buy Home/i.test(topic)) return ["upfront cash", "monthly flexibility", "long-term responsibility", "equity and risk", "life-stage fit"];
  if (/Fixed-Rate vs Adjustable-Rate Mortgage/i.test(topic)) return ["payment stability", "rate reset risk", "planning horizon", "budget sensitivity", "borrower fit"];
  if (/Credit Card vs Debit Card/i.test(topic)) return ["payment source", "fraud protection", "spending control", "rewards and fees", "where each fits best"];
  if (/React vs Vue/i.test(topic)) return ["learning curve", "ecosystem", "team conventions", "flexibility", "project fit"];
  if (/SQL vs NoSQL/i.test(topic)) return ["data model", "consistency style", "query needs", "scaling pattern", "product fit"];
  if (/Monolith vs Microservices/i.test(topic)) return ["team coordination", "release model", "operational complexity", "scaling strategy", "architecture fit"];
  if (/Serverless vs Containers/i.test(topic)) return ["runtime control", "cost behavior", "deployment model", "operations burden", "workload fit"];
  if (/Passwords vs Passkeys/i.test(topic)) return ["sign-in flow", "security model", "user friction", "recovery behavior", "adoption limits"];
  if (/Electric Vehicles vs Gas Cars/i.test(topic)) return ["fuel model", "ownership cost", "infrastructure needs", "maintenance pattern", "driving scenario fit"];
  if (/Solar Energy vs Wind Energy/i.test(topic)) return ["resource profile", "installation pattern", "grid role", "land and scale needs", "where each source works best"];
  if (/Lithium-Ion vs Solid-State Batteries/i.test(topic)) return ["technology maturity", "energy density", "safety profile", "manufacturing readiness", "likely near-term use"];
  if (/Public Cloud vs Private Cloud/i.test(topic)) return ["control", "scaling speed", "cost predictability", "compliance fit", "operations ownership"];
  if (/Remote Work vs Hybrid Work/i.test(topic)) return ["collaboration rhythm", "location flexibility", "team visibility", "culture impact", "role fit"];
  if (/Online Learning vs Classroom Learning/i.test(topic)) return ["learning format", "feedback speed", "social interaction", "schedule flexibility", "which learners benefit most"];
  if (/UX Research vs Market Research/i.test(topic)) return ["research question", "sample focus", "methods", "decision scope", "when teams should use each"];
  if (/Data Analyst vs Data Scientist/i.test(topic)) return ["core responsibilities", "tool depth", "modeling expectation", "business output", "career fit"];
  if (/Product Manager vs Project Manager/i.test(topic)) return ["primary mission", "success metrics", "planning horizon", "stakeholder focus", "how the roles work together"];

  if (domain === "ai") return ["definition", "control and setup", "cost and maintenance", "best-fit workflow", "limits and trade-offs"];
  if (domain === "business") return ["business logic", "customer motion", "cost structure", "growth pattern", "where each model fits"];
  if (domain === "marketing") return ["channel logic", "measurement style", "time horizon", "resource trade-offs", "best-fit goals"];
  if (domain === "finance") return ["risk profile", "cost structure", "liquidity or flexibility", "time horizon", "decision fit"];
  if (domain === "insurance") return ["what it covers", "how costs appear", "restriction level", "planning trade-offs", "best-fit situation"];
  if (domain === "real-estate") return ["cash needs", "commitment level", "cost certainty", "lifestyle fit", "risk and flexibility"];
  if (domain === "software") return ["technical model", "speed vs control", "maintenance load", "team complexity", "best-fit build context"];
  if (domain === "energy") return ["energy source", "infrastructure profile", "cost behavior", "environmental trade-offs", "deployment fit"];
  if (domain === "work") return ["workflow pattern", "collaboration style", "ownership boundaries", "trade-offs", "team fit"];
  if (domain === "learning") return ["learning environment", "feedback style", "schedule flexibility", "engagement pattern", "who each format helps most"];
  return ["research goal", "evidence type", "scope", "decision output", "when each method fits"];
}

function audience(domain: Domain) {
  if (domain === "ai" || domain === "software") return ["product managers", "developers", "technical founders", "educators"];
  if (domain === "business" || domain === "marketing") return ["founders", "growth teams", "content creators", "students"];
  if (domain === "finance") return ["students", "finance creators", "beginner investors", "educators"];
  if (domain === "insurance" || domain === "real-estate") return ["consumers", "students", "content teams", "educators"];
  if (domain === "energy") return ["students", "policy readers", "creators", "educators"];
  if (domain === "work") return ["team leads", "operators", "career switchers", "educators"];
  if (domain === "learning") return ["students", "parents", "teachers", "education creators"];
  return ["product teams", "researchers", "students", "educators"];
}

function useCases(domain: Domain) {
  if (domain === "ai" || domain === "software") return ["technical education", "team onboarding", "product explainers", "visual decision support"];
  if (domain === "business" || domain === "marketing") return ["strategy explainers", "team discussions", "social sharing", "business education"];
  if (domain === "finance") return ["financial literacy", "classroom visuals", "beginner education", "social explainers"];
  if (domain === "insurance" || domain === "real-estate") return ["consumer education", "classroom content", "advisory support visuals", "decision explainers"];
  if (domain === "energy") return ["science education", "policy explainers", "classroom visuals", "sustainability content"];
  if (domain === "work") return ["career education", "team alignment", "workflow training", "management explainers"];
  if (domain === "learning") return ["education explainers", "parent guides", "student support", "classroom discussion"];
  return ["research communication", "team alignment", "stakeholder education", "visual summaries"];
}

function misconception(topic: string, items: string[]) {
  if (/Freemium vs Free Trial/i.test(topic)) return "freemium and free trial are interchangeable user-acquisition offers";
  if (/SEO vs GEO/i.test(topic)) return "GEO simply replaces SEO instead of changing the answer-delivery layer";
  if (/Answer Engine Optimization vs Traditional SEO/i.test(topic)) return "answer engines reward the exact same content patterns as traditional search pages";
  if (/RAG vs Fine-Tuning/i.test(topic)) return "both approaches solve knowledge freshness and behavior control in the same way";
  if (/Credit Card vs Debit Card/i.test(topic)) return "they only differ at checkout rather than in protections, fees, and cash-flow behavior";
  if (/Passwords vs Passkeys/i.test(topic)) return "passkeys are just a renamed password manager feature";
  if (/Product Manager vs Project Manager/i.test(topic)) return "the roles are identical because both coordinate work across teams";
  if (/Data Analyst vs Data Scientist/i.test(topic)) return "one role is simply a more advanced title for the other";
  return `${naturalJoin(items)} are interchangeable once the headline sounds similar`;
}

function caution(topic: string, domain: Domain) {
  if (domain === "finance") return "keep the comparison educational and avoid investment recommendations, return promises, or personalized allocation advice";
  if (domain === "insurance") return "keep the comparison educational and avoid plan recommendations, underwriting claims, or personalized coverage advice";
  if (domain === "real-estate") return "keep the comparison educational and avoid mortgage, tax, or personal housing advice";
  if (domain === "software" || domain === "ai") return "avoid invented benchmark numbers, fake pricing, and unsupported capability claims";
  return `keep the comparison educational, specific, and balanced without turning it into generic advice about ${topic.toLowerCase()}`;
}

function bestFor(topic: string, items: string[]) {
  if (items.length === 3) {
    return `help readers separate how ${items[0]}, ${items[1]}, and ${items[2]} affect the same decision from different angles`;
  }
  return `help readers decide when ${items[0]} is a better fit than ${items[1]}, and when the reverse is true`;
}

function secondaryKeywords(topicNameValue: string, structureType: string) {
  return [
    `${topicNameValue} visual guide`,
    `${topicNameValue} decision chart`,
    `${topicNameValue} mobile infographic`,
    `${structureType} infographic`,
  ];
}

function buildAboutDescription(
  topicNameValue: string,
  primaryKeyword: string,
  structureType: string,
  dimensions: string[],
  audienceList: string[],
  decisionProblem: string,
  topicMisconception: string,
  domainUseCases: string[],
  index: number,
) {
  const audienceText = naturalJoin(audienceList);
  const dimensionText = naturalJoin(dimensions.slice(0, 5));
  const useCaseText = naturalJoin(domainUseCases.slice(0, 3));
  const variant = index % 4;

  if (variant === 0) {
    return `This ${primaryKeyword} helps readers compare ${topicNameValue.toLowerCase()} through a visual framework built for fast understanding on desktop and mobile. Instead of acting like a generic poster, it uses a ${structureType} structure so the viewer can see what each option means, where the biggest trade-offs appear, and how the choice changes across practical scenarios. The infographic compares ${dimensionText}, then turns those differences into a clear selection logic that is easier to scan than a long article or dense table.\n\nIt is useful for ${audienceText} who need a crisp explanation before writing, teaching, presenting, or choosing between similar options. The image is designed to solve one common understanding problem: ${decisionProblem}. It also addresses a frequent misconception, namely that ${topicMisconception}. That makes the visual especially helpful for SEO discovery, image search, social sharing, and reusable comparison content. Because the topic naturally involves contrast, fit, and limitations, it works especially well as a visual format rather than a plain block of text. This page also supports use cases such as ${useCaseText} without turning the explanation into personal advice.`;
  }
  if (variant === 1) {
    return `${primaryKeyword} is designed for readers who need to understand alternatives quickly without losing nuance. The visual organizes ${topicNameValue.toLowerCase()} with a ${structureType} layout, making it easier to compare the strongest differences first and then move into practical details. Rather than only naming pros and cons, it compares ${dimensionText}, shows fit-by-scenario logic, and explains where each option becomes weaker, slower, more expensive, or harder to manage.\n\nThis makes the infographic useful for ${audienceText}, especially when they are building educational content, evaluating a workflow, or trying to explain the topic to someone else. The image answers a concrete question: ${decisionProblem}. It also helps correct the common misconception that ${topicMisconception}. A comparison infographic is the right format here because the reader can spot contrast, overlap, and caution points at a glance, which is much harder to do in a linear paragraph. The result supports ${useCaseText} while staying structured, readable, and appropriate for mobile viewing.`;
  }
  if (variant === 2) {
    return `This ${primaryKeyword} turns a familiar comparison topic into a clearer visual decision aid. It is built for ${audienceText} who need a practical explanation that shows not only what each option is, but also how the trade-offs shift by context. The infographic uses a ${structureType} structure and compares ${dimensionText}, giving the reader a faster way to understand strengths, limitations, and best-fit scenarios than a plain note or short social post.\n\nThe visual is especially useful when the audience needs to solve a comparison problem such as ${decisionProblem}. It also addresses a recurring misconception: ${topicMisconception}. That correction matters because readers often recognize the labels but still misunderstand the real choice logic behind them. A visual format works well for this subject because contrast, hierarchy, and fit are easier to communicate through grouped panels, decision notes, and side-by-side evidence. The page is therefore well suited for ${useCaseText}, while keeping the explanation educational, balanced, and mobile-friendly.`;
  }
  return `This ${primaryKeyword} provides a structured visual explanation of ${topicNameValue.toLowerCase()} for ${audienceText}. The goal is not just to define each option, but to help the reader understand the logic behind the comparison. Using a ${structureType} format, the infographic compares ${dimensionText}, surfaces practical scenario differences, and highlights what people tend to miss when they only look at a headline summary.\n\nThe infographic is useful when someone needs to decide, teach, write, or communicate around a topic where two or three options sound similar but behave differently in practice. It addresses the question of how to ${decisionProblem}, while also correcting the misconception that ${topicMisconception}. This subject fits a visual comparison format because the strongest insight comes from contrast: viewers need to see where each option wins, where it becomes limited, and what trade-offs appear under different conditions. That makes the page valuable for ${useCaseText}, especially when mobile readability and quick scanning matter.`;
}

function buildTemplate(definition: TopicDefinition, index: number) {
  const topic = topicName(definition.title);
  const slug = slugify(definition.title);
  const items = comparisonItems(topic);
  const domain = comparisonDomain(topic);
  const style = styleName(domain, index);
  const stylePrompt = stylePrompts[style];
  const dimensions = comparisonDimensions(topic, domain);
  const audienceList = audience(domain);
  const useCaseList = useCases(domain);
  const decisionProblem = bestFor(topic, items);
  const misconceptionText = misconception(topic, items);
  const cautionText = caution(topic, domain);
  const detailPath = `/infographic/comparison/${slug}/`;
  const canonicalUrl = `${siteUrl}${detailPath}`;
  const imageFilename = `comparison-${slug}.webp`;
  const primaryKeyword = definition.title;
  const topicPrompt = `Create a true comparison infographic about ${topic}. This must compare ${naturalJoin(items)} clearly instead of acting like a generic knowledge poster.`;
  const shortDescription = `A mobile-friendly ${topic.toLowerCase()} comparison infographic template with clear trade-offs, use cases, and decision logic.`;
  const visibleDescription = `This ${primaryKeyword} helps readers compare ${naturalJoin(items)} through ${definition.structureType}, clear trade-off sections, strengths, limitations, and best-fit scenarios. It is built for fast scanning on a phone screen and makes the choice logic easier to understand without turning the topic into generic advice.`;
  const aboutDescription = buildAboutDescription(
    topic,
    primaryKeyword,
    definition.structureType,
    dimensions,
    audienceList,
    decisionProblem,
    misconceptionText,
    useCaseList,
    index,
  );
  const imageDescription = `This mobile-friendly ${topic.toLowerCase()} comparison infographic uses ${definition.structureType}, large headings, concise labels, and clear scenario-based trade-offs to help readers compare ${naturalJoin(items)} quickly.`;
  const imageAlt = `${topic} comparison infographic with readable mobile-friendly comparison cards`;
  const visualPrompt =
    `Create a high-quality comparison infographic about ${topic}. This must be a true comparison infographic, not a generic poster. Compare ${naturalJoin(items)} using a ${definition.structureType} layout with large readable title text, strong visual separation between options, and mobile-first readability. Include concise sections for what each option is, the core differences, strengths, limitations, best-fit scenarios, and simple selection logic. Compare these dimensions: ${naturalJoin(dimensions)}. Add one caution or misconception note: ${misconceptionText}. Keep the explanation educational and balanced. ${cautionText}. Use short labels, concise bullets, and avoid dense paragraphs or tiny text.`;
  const finalPrompt = [stylePrompt, visualPrompt, aspectRatioPrompt, qualityPrompt].join("\n\n");
  const generated = readGeneratedTemplateManifest()[slug];
  const updatedAt = generated?.updatedAt || "2026-06-14T00:00:00.000Z";

  return {
    id: `comparison-template-${String(index + 1).padStart(3, "0")}`,
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
    title: `${topic} Comparison Infographic Template`,
    topicName: topic,
    slug,
    detailPath,
    canonicalUrl,
    previewImagePath: generated?.previewImagePath || (generated?.previewImageUrl ? new URL(generated.previewImageUrl).pathname : "/picture/science-infographic.jpg"),
    previewImageUrl: generated?.previewImageUrl || `${siteUrl}/picture/science-infographic.jpg`,
    storageKey: generated?.storageKey || `infographic/comparison/${imageFilename}`,
    imageFilename: generated?.imageFilename || imageFilename,
    imageFormat: generated?.imageFormat || ("webp" as const),
    imageMimeType: generated?.imageMimeType || "image/webp",
    imageWidth: generated?.imageWidth || 1024,
    imageHeight: generated?.imageHeight || 1792,
    imageSizeBytes: generated?.imageSizeBytes,
    aspectRatio,
    seoTitle: `${topic} Comparison Infographic Template - KnowLens AI`,
    metaDescription: `Explore this ${topic.toLowerCase()} comparison infographic template with mobile-friendly trade-off sections, use cases, and decision logic. Create a similar visual with KnowLens AI.`,
    h1: `${topic} Comparison Infographic Template`,
    primaryKeyword,
    secondaryKeywords: secondaryKeywords(topic, definition.structureType),
    generatorKeywords,
    imageAlt,
    imageTitle: `${topic} Comparison Infographic Template`,
    imageCaption: `${topic} comparison infographic template created with KnowLens AI.`,
    imageDescription,
    styleName: style,
    stylePrompt,
    topicPrompt,
    visualPrompt,
    contentPrompt: visualPrompt,
    finalPrompt,
    createSimilarPrompt: `Create a mobile-friendly comparison infographic about ${topic}. Use ${definition.structureType}. Compare ${naturalJoin(items)} with concise labels, clear trade-offs, best-fit scenarios, limitations, and easy decision logic. Keep the design readable on a phone screen and reduce small text.`,
    shortDescription,
    visibleDescription,
    aboutDescription,
    knowledgePoints: [
      `Define ${naturalJoin(items)} in plain English before comparing trade-offs.`,
      `Compare ${dimensions[0]}, ${dimensions[1]}, and ${dimensions[2]} with short, high-contrast labels.`,
      `Show where each option fits best instead of presenting one winner for every scenario.`,
      `Highlight real limitations, edge cases, and caution points without exaggeration.`,
      `Correct the misconception that ${misconceptionText}.`,
    ],
    useCases: useCaseList,
    targetAudience: audienceList,
    tags: Array.from(
      new Set([
        "comparison",
        "infographic",
        domain,
        definition.structureType,
        ...items.map((item) => item.toLowerCase()),
      ]),
    ),
    structureType: definition.structureType,
    relatedTemplateIds: [] as string[],
    relatedCategorySlugs: ["comparison", "infographic-examples", domain === "software" || domain === "ai" ? "technology" : "education"],
    relatedToolSlugs: ["ai-infographic-generator", "infographic-maker", "text-to-infographic"],
    allowPublicDownload: false as const,
    createdAt: "2026-06-14T00:00:00.000Z",
    updatedAt,
  };
}

export type ComparisonInfographicTemplate = ReturnType<typeof buildTemplate>;

export function getComparisonInfographicTemplates() {
  return topicDefinitions.map(buildTemplate).map((template, index, source) => ({
    ...template,
    relatedTemplateIds: source
      .filter((item) => item.id !== template.id)
      .slice(Math.max(0, index - 3), index + 6)
      .filter((item) => item.id !== template.id)
      .slice(0, 6)
      .map((item) => item.id),
  }));
}

export const comparisonInfographicTemplates = getComparisonInfographicTemplates();

export function getComparisonInfographicTemplate(slug: string) {
  return getComparisonInfographicTemplates().find((template) => template.slug === slug);
}
