import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const siteUrl = "https://knowlens.ai";
const categorySlug = "roadmap";
const categoryName = "Roadmap";
const categoryKeyword = "Roadmap Infographic Templates";
const batchId = "roadmap-infographic-tuzi-50";
const batchTopic = "Roadmap Infographic";

const generatorKeywords = [
  "Roadmap Infographic Generator",
  "Timeline Infographic Maker",
  "Milestone Infographic Generator",
  "Strategic Roadmap Maker",
  "AI Infographic Generator",
];

const qualityPrompt =
  "Create a professional knowledge roadmap infographic with clear information hierarchy, minimal and accurate English text, accurate visual structure, strong milestone clarity, no spelling mistakes, no distorted or misleading illustrations, and a clean editorial infographic layout that makes the roadmap easy to understand at a glance. Optimize the design for mobile viewing, keep the title and phase headings large, reduce small text, avoid tiny labels, keep milestone notes concise, and make every stage readable on a phone screen.";

const stylePrompts = {
  "Executive Strategy Roadmap Style":
    "Executive Strategy Roadmap Style: Use a polished executive roadmap infographic style with clear phases, milestone callouts, priority markers, and concise action notes. Use a clean light background with navy, teal, slate, and soft amber accents. Keep the design structured, strategic, and easy to scan on mobile.",
  "Product Milestone Timeline Style":
    "Product Milestone Timeline Style: Use a modern product roadmap timeline style with a strong horizontal or vertical sequence, milestone markers, ownership hints, and clear outcome blocks. Use a crisp light background with blue, emerald, graphite, and muted coral accents. Keep the layout sharp, product-minded, and legible on small screens.",
  "Career Learning Path Style":
    "Career Learning Path Style: Use a structured learning path roadmap style with staged skill progression, module clusters, milestone checkpoints, and confidence-building next steps. Use a bright light background with blue, green, orange, and soft gray accents. Keep the design approachable, educational, and mobile-readable.",
  "Transformation Program Roadmap Style":
    "Transformation Program Roadmap Style: Use a premium transformation roadmap style with phase gates, capability blocks, dependencies, and clear business outcomes. Use a neutral background with deep blue, forest green, charcoal, and muted gold accents. Keep the visual serious, strategic, and not cluttered.",
  "Quarterly Planning Roadmap Style":
    "Quarterly Planning Roadmap Style: Use a clean quarterly roadmap infographic style with quarter-based sections, milestone checkpoints, initiative cards, and measurable outputs. Use a white background with blue, teal, plum, and warm gray accents. Keep the structure crisp, operational, and easy to follow on mobile.",
  "Journey Milestone Roadmap Style":
    "Journey Milestone Roadmap Style: Use a visually clear journey roadmap style with step-by-step movement, milestone stops, habit or progress markers, and simple explanatory notes. Use a soft light background with green, aqua, blue, and muted orange accents. Keep the design supportive, clear, and ideal for phone viewing.",
} as const;

type StyleName = keyof typeof stylePrompts;
type Domain =
  | "ai"
  | "technology"
  | "business"
  | "marketing"
  | "career"
  | "learning"
  | "health"
  | "finance"
  | "sustainability"
  | "enterprise";

type TopicDefinition = {
  topicName: string;
  structureType:
    | "phased roadmap"
    | "milestone timeline"
    | "learning path roadmap"
    | "maturity roadmap"
    | "implementation roadmap"
    | "transformation roadmap"
    | "launch roadmap"
    | "quarterly roadmap"
    | "journey roadmap"
    | "capability roadmap"
    | "strategic roadmap"
    | "step-by-step roadmap"
    | "ladder roadmap"
    | "sprint roadmap"
    | "lifecycle roadmap";
  domain: Domain;
  styleName: StyleName;
  coreFocus: string;
  milestoneTheme: string;
  audience: string[];
  useCases: string[];
};

const topicDefinitions: TopicDefinition[] = [
  { topicName: "AI Product Roadmap Infographic", structureType: "phased roadmap", domain: "ai", styleName: "Executive Strategy Roadmap Style", coreFocus: "model strategy, feature sequencing, trust controls, launch readiness, and adoption outcomes", milestoneTheme: "problem framing, MVP, iteration, and scale-up", audience: ["product teams", "AI founders", "operators", "educators"], useCases: ["product planning", "AI strategy decks", "team alignment", "launch communication"] },
  { topicName: "Startup Launch Roadmap Infographic", structureType: "launch roadmap", domain: "business", styleName: "Quarterly Planning Roadmap Style", coreFocus: "validation, brand setup, launch assets, customer acquisition, and early traction loops", milestoneTheme: "idea validation, launch prep, release, and feedback", audience: ["founders", "startup teams", "accelerator mentors", "students"], useCases: ["startup planning", "launch workshops", "founder education", "go-to-market explainers"] },
  { topicName: "SaaS Growth Roadmap Infographic", structureType: "strategic roadmap", domain: "business", styleName: "Executive Strategy Roadmap Style", coreFocus: "retention, activation, monetization, expansion, and operational scale", milestoneTheme: "acquisition, activation, retention, and expansion", audience: ["growth teams", "founders", "product leads", "consultants"], useCases: ["growth planning", "board-ready summaries", "operator playbooks", "strategy communication"] },
  { topicName: "Mobile App Development Roadmap Infographic", structureType: "implementation roadmap", domain: "technology", styleName: "Product Milestone Timeline Style", coreFocus: "discovery, UX, engineering, testing, launch, and post-release iteration", milestoneTheme: "planning, design, build, QA, and release", audience: ["product managers", "developers", "designers", "students"], useCases: ["app planning", "team onboarding", "technical education", "project kickoffs"] },
  { topicName: "Website Redesign Roadmap Infographic", structureType: "transformation roadmap", domain: "marketing", styleName: "Transformation Program Roadmap Style", coreFocus: "audit, messaging refresh, UX changes, content migration, SEO recovery, and launch governance", milestoneTheme: "audit, redesign, migration, and optimization", audience: ["marketing teams", "design leads", "website owners", "agencies"], useCases: ["website planning", "client presentations", "design operations", "SEO coordination"] },
  { topicName: "AI Agent Implementation Roadmap Infographic", structureType: "implementation roadmap", domain: "ai", styleName: "Transformation Program Roadmap Style", coreFocus: "use-case selection, workflow mapping, tool integration, evaluation, and governance setup", milestoneTheme: "pilot, integration, evaluation, and rollout", audience: ["AI teams", "operations leads", "CTOs", "consultants"], useCases: ["AI implementation", "ops planning", "enterprise demos", "internal enablement"] },
  { topicName: "Generative AI Adoption Roadmap Infographic", structureType: "maturity roadmap", domain: "ai", styleName: "Executive Strategy Roadmap Style", coreFocus: "experimentation, enablement, governance, workflow adoption, and measurable value capture", milestoneTheme: "awareness, trial, adoption, and scale", audience: ["executives", "innovation teams", "PMs", "educators"], useCases: ["AI adoption planning", "change management", "strategy workshops", "executive explainers"] },
  { topicName: "RAG System Roadmap Infographic", structureType: "capability roadmap", domain: "ai", styleName: "Product Milestone Timeline Style", coreFocus: "data preparation, retrieval quality, prompt orchestration, evaluation, and maintenance loops", milestoneTheme: "data, retrieval, generation, and monitoring", audience: ["developers", "ML engineers", "technical founders", "educators"], useCases: ["system design", "engineering onboarding", "AI architecture explainers", "technical workshops"] },
  { topicName: "Cloud Migration Roadmap Infographic", structureType: "transformation roadmap", domain: "technology", styleName: "Transformation Program Roadmap Style", coreFocus: "assessment, workload prioritization, migration waves, risk controls, and optimization", milestoneTheme: "assessment, migration waves, and steady-state optimization", audience: ["IT leaders", "architects", "consultants", "students"], useCases: ["migration planning", "technology strategy", "enterprise education", "stakeholder alignment"] },
  { topicName: "Cybersecurity Maturity Roadmap Infographic", structureType: "maturity roadmap", domain: "technology", styleName: "Transformation Program Roadmap Style", coreFocus: "security baselines, monitoring, response readiness, resilience, and governance maturity", milestoneTheme: "baseline, hardening, response, and resilience", audience: ["security teams", "IT leaders", "risk managers", "educators"], useCases: ["security planning", "maturity reviews", "risk communication", "training content"] },
  { topicName: "Data Analytics Roadmap Infographic", structureType: "capability roadmap", domain: "technology", styleName: "Quarterly Planning Roadmap Style", coreFocus: "data collection, reporting, insight quality, decision loops, and analytics enablement", milestoneTheme: "foundations, dashboards, analysis, and adoption", audience: ["analysts", "operators", "students", "team leads"], useCases: ["analytics strategy", "data team planning", "education", "dashboard adoption"] },
  { topicName: "Business Intelligence Roadmap Infographic", structureType: "implementation roadmap", domain: "business", styleName: "Executive Strategy Roadmap Style", coreFocus: "metric standardization, dashboard rollout, stakeholder adoption, and decision support", milestoneTheme: "metric cleanup, dashboard rollout, and usage maturity", audience: ["BI teams", "executives", "analysts", "educators"], useCases: ["BI planning", "stakeholder communication", "data literacy", "internal training"] },
  { topicName: "Digital Transformation Roadmap Infographic", structureType: "transformation roadmap", domain: "enterprise", styleName: "Transformation Program Roadmap Style", coreFocus: "process redesign, platform modernization, team enablement, governance, and measurable outcomes", milestoneTheme: "diagnosis, redesign, rollout, and optimization", audience: ["enterprise leaders", "consultants", "program teams", "operators"], useCases: ["transformation planning", "executive decks", "workshops", "program communication"] },
  { topicName: "E-commerce Growth Roadmap Infographic", structureType: "quarterly roadmap", domain: "marketing", styleName: "Quarterly Planning Roadmap Style", coreFocus: "traffic, conversion, merchandising, retention, and operational growth loops", milestoneTheme: "traffic, conversion, retention, and scale", audience: ["e-commerce teams", "founders", "growth marketers", "students"], useCases: ["growth planning", "channel coordination", "marketing education", "shop optimization"] },
  { topicName: "SEO Strategy Roadmap Infographic", structureType: "strategic roadmap", domain: "marketing", styleName: "Executive Strategy Roadmap Style", coreFocus: "technical cleanup, content expansion, internal linking, authority growth, and performance tracking", milestoneTheme: "foundation, content, authority, and compounding results", audience: ["SEO teams", "content strategists", "founders", "educators"], useCases: ["SEO planning", "content ops", "marketing training", "client explainers"] },
  { topicName: "Content Marketing Roadmap Infographic", structureType: "phased roadmap", domain: "marketing", styleName: "Quarterly Planning Roadmap Style", coreFocus: "message pillars, content engine setup, distribution rhythm, repurposing, and conversion linkage", milestoneTheme: "strategy, production, distribution, and optimization", audience: ["content teams", "marketers", "creators", "students"], useCases: ["content planning", "editorial operations", "creator education", "campaign coordination"] },
  { topicName: "Social Media Growth Roadmap Infographic", structureType: "journey roadmap", domain: "marketing", styleName: "Journey Milestone Roadmap Style", coreFocus: "platform focus, content testing, consistency, community interaction, and conversion paths", milestoneTheme: "setup, experimentation, traction, and momentum", audience: ["creators", "marketing teams", "small businesses", "students"], useCases: ["social planning", "creator coaching", "growth experiments", "audience development"] },
  { topicName: "Email Marketing Roadmap Infographic", structureType: "step-by-step roadmap", domain: "marketing", styleName: "Quarterly Planning Roadmap Style", coreFocus: "list growth, segmentation, automation, campaign quality, and revenue contribution", milestoneTheme: "list setup, automation, testing, and optimization", audience: ["growth marketers", "operators", "founders", "students"], useCases: ["email planning", "automation setup", "marketing education", "retention campaigns"] },
  { topicName: "B2B Lead Generation Roadmap Infographic", structureType: "journey roadmap", domain: "marketing", styleName: "Executive Strategy Roadmap Style", coreFocus: "ICP definition, channel testing, qualification flow, follow-up rhythm, and pipeline consistency", milestoneTheme: "targeting, capture, nurture, and conversion", audience: ["B2B marketers", "sales teams", "founders", "consultants"], useCases: ["pipeline planning", "demand generation", "sales-marketing alignment", "playbook creation"] },
  { topicName: "LinkedIn Personal Brand Roadmap Infographic", structureType: "ladder roadmap", domain: "career", styleName: "Journey Milestone Roadmap Style", coreFocus: "positioning, profile clarity, publishing consistency, network growth, and opportunity capture", milestoneTheme: "profile, content, network, and authority", audience: ["professionals", "job seekers", "creators", "coaches"], useCases: ["personal branding", "career coaching", "creator planning", "audience growth"] },
  { topicName: "Product Manager Career Roadmap Infographic", structureType: "ladder roadmap", domain: "career", styleName: "Career Learning Path Style", coreFocus: "core product thinking, execution skills, stakeholder communication, and career progression markers", milestoneTheme: "fundamentals, shipping, influence, and leadership", audience: ["career switchers", "junior PMs", "students", "coaches"], useCases: ["career planning", "PM education", "mentorship", "skill mapping"] },
  { topicName: "UX Designer Career Roadmap Infographic", structureType: "learning path roadmap", domain: "career", styleName: "Career Learning Path Style", coreFocus: "research, interaction design, visual systems, portfolio building, and collaboration maturity", milestoneTheme: "learning, practice, portfolio, and role readiness", audience: ["design learners", "career switchers", "students", "design coaches"], useCases: ["design education", "career planning", "portfolio strategy", "mentoring"] },
  { topicName: "Data Scientist Learning Roadmap Infographic", structureType: "learning path roadmap", domain: "learning", styleName: "Career Learning Path Style", coreFocus: "math basics, coding, analysis, modeling, communication, and real project practice", milestoneTheme: "foundations, modeling, projects, and job readiness", audience: ["learners", "students", "bootcamp mentors", "educators"], useCases: ["learning plans", "course design", "study coaching", "career guidance"] },
  { topicName: "AI Engineer Learning Roadmap Infographic", structureType: "ladder roadmap", domain: "learning", styleName: "Career Learning Path Style", coreFocus: "software basics, model understanding, systems thinking, tooling, and production habits", milestoneTheme: "coding, ML, systems, and deployment", audience: ["developers", "students", "career switchers", "educators"], useCases: ["AI upskilling", "technical education", "mentorship", "study planning"] },
  { topicName: "Full-Stack Developer Roadmap Infographic", structureType: "step-by-step roadmap", domain: "learning", styleName: "Career Learning Path Style", coreFocus: "frontend, backend, databases, deployment, and product shipping confidence", milestoneTheme: "web basics, app building, APIs, and deployment", audience: ["new developers", "bootcamp students", "career switchers", "mentors"], useCases: ["developer learning", "curriculum design", "bootcamp guidance", "skill mapping"] },
  { topicName: "DevOps Engineer Roadmap Infographic", structureType: "capability roadmap", domain: "learning", styleName: "Transformation Program Roadmap Style", coreFocus: "infrastructure basics, automation, observability, security, and platform reliability", milestoneTheme: "systems, automation, pipelines, and reliability", audience: ["engineers", "learners", "team leads", "educators"], useCases: ["DevOps training", "engineering growth", "team onboarding", "skills planning"] },
  { topicName: "English Learning Roadmap Infographic", structureType: "learning path roadmap", domain: "learning", styleName: "Career Learning Path Style", coreFocus: "input habits, vocabulary, grammar, speaking confidence, and real-use milestones", milestoneTheme: "understanding, practice, fluency, and confidence", audience: ["students", "language learners", "teachers", "parents"], useCases: ["study planning", "language coaching", "classroom support", "self-learning"] },
  { topicName: "Study Abroad Preparation Roadmap Infographic", structureType: "milestone timeline", domain: "learning", styleName: "Journey Milestone Roadmap Style", coreFocus: "goal setting, test preparation, application materials, visa preparation, and relocation readiness", milestoneTheme: "research, testing, applications, and transition", audience: ["students", "parents", "consultants", "educators"], useCases: ["application planning", "education counseling", "family guidance", "student support"] },
  { topicName: "Exam Preparation Roadmap Infographic", structureType: "sprint roadmap", domain: "learning", styleName: "Career Learning Path Style", coreFocus: "syllabus mapping, study cadence, revision loops, mock tests, and exam-week readiness", milestoneTheme: "planning, practice, review, and execution", audience: ["students", "teachers", "parents", "coaches"], useCases: ["study plans", "exam coaching", "classroom support", "revision systems"] },
  { topicName: "Research Paper Writing Roadmap Infographic", structureType: "lifecycle roadmap", domain: "learning", styleName: "Career Learning Path Style", coreFocus: "topic narrowing, literature review, outline logic, drafting, revision, and submission readiness", milestoneTheme: "research, writing, revision, and submission", audience: ["students", "researchers", "teachers", "academic coaches"], useCases: ["writing support", "academic planning", "research methods teaching", "student guidance"] },
  { topicName: "Weight Loss Journey Roadmap Infographic", structureType: "journey roadmap", domain: "health", styleName: "Journey Milestone Roadmap Style", coreFocus: "habit setup, consistency, nutrition awareness, movement rhythm, and progress reflection", milestoneTheme: "starting habits, building consistency, and sustainable progress", audience: ["general readers", "wellness creators", "coaches", "educators"], useCases: ["health education", "habit coaching", "wellness content", "visual goal setting"] },
  { topicName: "Healthy Habit Building Roadmap Infographic", structureType: "step-by-step roadmap", domain: "health", styleName: "Journey Milestone Roadmap Style", coreFocus: "small routines, accountability loops, friction reduction, progress tracking, and long-term consistency", milestoneTheme: "start small, repeat, track, and reinforce", audience: ["general readers", "coaches", "students", "educators"], useCases: ["habit education", "coaching visuals", "self-improvement content", "classroom wellbeing"] },
  { topicName: "Fitness Training Roadmap Infographic", structureType: "phased roadmap", domain: "health", styleName: "Journey Milestone Roadmap Style", coreFocus: "mobility, base conditioning, progressive overload, recovery habits, and performance checkpoints", milestoneTheme: "baseline, build, progress, and maintain", audience: ["fitness beginners", "trainers", "wellness creators", "students"], useCases: ["fitness education", "training plans", "coaching visuals", "habit support"] },
  { topicName: "Marathon Training Roadmap Infographic", structureType: "milestone timeline", domain: "health", styleName: "Journey Milestone Roadmap Style", coreFocus: "base mileage, long runs, recovery, pacing confidence, and race-week preparation", milestoneTheme: "base training, build-up, peak, and taper", audience: ["runners", "coaches", "wellness creators", "educators"], useCases: ["training education", "runner support", "coaching materials", "goal planning"] },
  { topicName: "Pregnancy Care Roadmap Infographic", structureType: "lifecycle roadmap", domain: "health", styleName: "Journey Milestone Roadmap Style", coreFocus: "trimester awareness, routine checkups, nutrition basics, support planning, and preparation milestones", milestoneTheme: "trimester stages and practical planning", audience: ["general readers", "families", "educators", "health content teams"], useCases: ["general health education", "family guides", "classroom health content", "wellness explainers"] },
  { topicName: "Mental Wellness Roadmap Infographic", structureType: "journey roadmap", domain: "health", styleName: "Journey Milestone Roadmap Style", coreFocus: "stress awareness, support habits, reflection practices, boundaries, and resilience-building routines", milestoneTheme: "awareness, support, practice, and resilience", audience: ["general readers", "students", "coaches", "educators"], useCases: ["wellbeing education", "support content", "habit guidance", "student wellness"] },
  { topicName: "Personal Finance Roadmap Infographic", structureType: "strategic roadmap", domain: "finance", styleName: "Executive Strategy Roadmap Style", coreFocus: "budget basics, emergency savings, debt control, goal planning, and steady financial progress", milestoneTheme: "stability, savings, planning, and progress", audience: ["general readers", "students", "content creators", "educators"], useCases: ["financial literacy", "planning education", "classroom visuals", "personal finance content"] },
  { topicName: "Debt Payoff Roadmap Infographic", structureType: "step-by-step roadmap", domain: "finance", styleName: "Journey Milestone Roadmap Style", coreFocus: "debt listing, repayment prioritization, payment habits, motivation checkpoints, and balance reduction milestones", milestoneTheme: "clarity, repayment rhythm, and milestone wins", audience: ["general readers", "finance educators", "coaches", "students"], useCases: ["debt education", "financial coaching", "habit tracking", "literacy content"] },
  { topicName: "Retirement Planning Roadmap Infographic", structureType: "lifecycle roadmap", domain: "finance", styleName: "Executive Strategy Roadmap Style", coreFocus: "time horizon awareness, contribution habits, risk review, retirement milestones, and plan adjustments", milestoneTheme: "early planning, growth, review, and transition", audience: ["general readers", "finance creators", "educators", "students"], useCases: ["retirement literacy", "planning education", "visual explainers", "family finance learning"] },
  { topicName: "Home Buying Roadmap Infographic", structureType: "milestone timeline", domain: "finance", styleName: "Quarterly Planning Roadmap Style", coreFocus: "savings prep, mortgage readiness, home search, closing steps, and move-in preparation", milestoneTheme: "saving, approval, search, and closing", audience: ["first-time buyers", "students", "educators", "content teams"], useCases: ["home buying education", "consumer explainers", "family planning", "finance literacy"] },
  { topicName: "ESG Strategy Roadmap Infographic", structureType: "strategic roadmap", domain: "sustainability", styleName: "Transformation Program Roadmap Style", coreFocus: "baseline assessment, target setting, reporting readiness, governance, and operational follow-through", milestoneTheme: "baseline, targets, action, and reporting", audience: ["strategy teams", "operators", "students", "consultants"], useCases: ["ESG education", "strategy workshops", "program planning", "stakeholder updates"] },
  { topicName: "Sustainability Transition Roadmap Infographic", structureType: "transformation roadmap", domain: "sustainability", styleName: "Transformation Program Roadmap Style", coreFocus: "current-state assessment, initiative sequencing, capability building, and long-term transition outcomes", milestoneTheme: "assessment, transition waves, and measured change", audience: ["operators", "leaders", "students", "consultants"], useCases: ["sustainability planning", "change management", "education", "program communication"] },
  { topicName: "Renewable Energy Adoption Roadmap Infographic", structureType: "implementation roadmap", domain: "sustainability", styleName: "Executive Strategy Roadmap Style", coreFocus: "energy assessment, option selection, rollout sequencing, stakeholder alignment, and adoption milestones", milestoneTheme: "assessment, selection, rollout, and optimization", audience: ["operators", "students", "policy readers", "consultants"], useCases: ["energy education", "adoption planning", "sustainability explainers", "stakeholder decks"] },
  { topicName: "Smart City Development Roadmap Infographic", structureType: "capability roadmap", domain: "sustainability", styleName: "Transformation Program Roadmap Style", coreFocus: "infrastructure priorities, service digitization, data coordination, and phased city-scale outcomes", milestoneTheme: "infrastructure, services, integration, and scale", audience: ["urban planners", "students", "operators", "policy teams"], useCases: ["urban strategy", "city innovation", "education", "public sector presentations"] },
  { topicName: "Supply Chain Transformation Roadmap Infographic", structureType: "transformation roadmap", domain: "enterprise", styleName: "Transformation Program Roadmap Style", coreFocus: "visibility, supplier coordination, resilience, automation, and decision speed improvements", milestoneTheme: "visibility, redesign, automation, and resilience", audience: ["operations teams", "supply chain leaders", "consultants", "students"], useCases: ["operations planning", "transformation programs", "team alignment", "education"] },
  { topicName: "Manufacturing Automation Roadmap Infographic", structureType: "implementation roadmap", domain: "enterprise", styleName: "Quarterly Planning Roadmap Style", coreFocus: "process assessment, pilot automation, workforce readiness, rollout sequencing, and productivity milestones", milestoneTheme: "assessment, pilot, rollout, and stabilization", audience: ["operations leaders", "manufacturing teams", "consultants", "students"], useCases: ["automation planning", "industrial education", "program communication", "factory modernization"] },
  { topicName: "Customer Success Roadmap Infographic", structureType: "journey roadmap", domain: "business", styleName: "Product Milestone Timeline Style", coreFocus: "onboarding, activation, value realization, renewal readiness, and expansion signals", milestoneTheme: "onboarding, adoption, value, and renewal", audience: ["CS teams", "SaaS operators", "founders", "educators"], useCases: ["customer lifecycle planning", "team enablement", "service design", "SaaS education"] },
  { topicName: "HR Digitalization Roadmap Infographic", structureType: "capability roadmap", domain: "enterprise", styleName: "Transformation Program Roadmap Style", coreFocus: "process cleanup, platform rollout, analytics maturity, employee experience, and governance", milestoneTheme: "digitization, rollout, adoption, and insight maturity", audience: ["HR leaders", "operations teams", "consultants", "students"], useCases: ["HR transformation", "internal planning", "people ops education", "program presentations"] },
  { topicName: "Enterprise AI Governance Roadmap Infographic", structureType: "maturity roadmap", domain: "enterprise", styleName: "Executive Strategy Roadmap Style", coreFocus: "policy baselines, review workflows, model risk controls, documentation, and organization-wide adoption guardrails", milestoneTheme: "baseline, control, review, and scale", audience: ["AI governance teams", "risk leaders", "operators", "educators"], useCases: ["governance planning", "risk communication", "AI policy education", "internal enablement"] },
  { topicName: "Business Expansion Roadmap Infographic", structureType: "strategic roadmap", domain: "business", styleName: "Executive Strategy Roadmap Style", coreFocus: "market selection, offer readiness, channel setup, operating expansion, and scaling checkpoints", milestoneTheme: "research, readiness, launch, and scale", audience: ["founders", "operators", "strategy teams", "consultants"], useCases: ["expansion planning", "market entry explainers", "strategy communication", "operations workshops"] },
] as const;

type GeneratedRoadmapImage = {
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

type GeneratedRoadmapManifest = {
  templates?: Record<string, GeneratedRoadmapImage>;
};

function readGeneratedTemplateManifest() {
  const manifestPath = path.join(process.cwd(), "src/lib/roadmap-infographic-generated-images.json");
  if (!existsSync(manifestPath)) return {} as Record<string, GeneratedRoadmapImage>;
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as GeneratedRoadmapManifest;
    return parsed.templates || {};
  } catch {
    return {} as Record<string, GeneratedRoadmapImage>;
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

function structureLabel(structureType: TopicDefinition["structureType"]) {
  return structureType.replace(/-/g, " ");
}

function aspectRatioForIndex(index: number) {
  return index < 5 ? "16:9" : "9:16";
}

function aspectRatioPromptForIndex(index: number) {
  return `Aspect ratio: ${aspectRatioForIndex(index)}`;
}

function imageSizeForIndex(index: number) {
  return aspectRatioForIndex(index) === "16:9"
    ? { width: 1536, height: 1024 }
    : { width: 1024, height: 1792 };
}

function buildSecondaryKeywords(topic: TopicDefinition) {
  return [
    `${topic.topicName.toLowerCase()} template`,
    `${topic.domain} roadmap visual`,
    `${topic.structureType} infographic`,
    `${topic.coreFocus.split(",")[0]} roadmap`,
  ];
}

function buildImageDescription(topic: TopicDefinition, primaryKeyword: string, index: number) {
  const orientation = aspectRatioForIndex(index) === "16:9" ? "wide" : "vertical";
  return `This ${orientation} ${primaryKeyword} organizes ${topic.coreFocus} into a ${topic.structureType} layout with visible stage movement, milestone markers, and concise action labels. The visual emphasizes progression, priorities, and outcome checkpoints so the roadmap reads clearly on mobile and desktop.`;
}

function buildVisibleDescription(topic: TopicDefinition, primaryKeyword: string, generatorKeyword: string) {
  return `This ${primaryKeyword} turns ${topic.topicName.replace(/\s+Infographic$/i, "").toLowerCase()} planning into a structured visual with clear phases, milestone checkpoints, and priority actions. Instead of showing a generic poster, the infographic uses a ${topic.structureType} layout to separate what happens first, what depends on earlier work, which milestones signal progress, and what outcomes each stage should unlock. Built as a ${generatorKeyword} example, it helps teams, learners, operators, and creators understand the sequence, identify the key actions in each stage, and explain the roadmap in a format that stays readable on a phone screen.`;
}

function buildAboutDescription(topic: TopicDefinition, primaryKeyword: string) {
  return `This ${primaryKeyword} is designed for people who need to explain a roadmap clearly without losing the sequence, milestones, or decision logic behind it. It works especially well for founders, product teams, marketers, learners, operators, and educators who want to turn a messy planning process into a visual that is easy to present, share, and review. The infographic breaks the topic into structured stages so viewers can see where the roadmap begins, what the core priorities are in the middle, and which milestones signal readiness for the next phase. Rather than acting like a decorative poster, it helps readers understand the order of execution, the key actions inside each step, the dependencies between stages, and the outcomes that each checkpoint is meant to unlock. That makes it useful for strategy discussions, onboarding, classroom teaching, internal planning, and social sharing. Because roadmap topics often involve many moving parts, this visual format is especially effective for showing progression, priorities, momentum, and next-step clarity in one mobile-friendly view.`;
}

function buildKnowledgePoints(topic: TopicDefinition, index: number) {
  const stageOpeners = [
    "The roadmap starts by clarifying",
    "An early stage should define",
    "The first milestone needs",
    "The opening phase focuses on",
    "A strong starting point is",
  ];
  const middleOpeners = [
    "The middle section should organize",
    "A core execution phase should show",
    "The next milestone block should highlight",
    "The central roadmap view should separate",
    "The implementation section should clarify",
  ];
  const priorityOpeners = [
    "Priority markers should make it obvious which actions unlock later stages.",
    "The visual should show which actions are foundational and which ones are follow-through work.",
    "Clear priority cues help readers distinguish setup work from scale-stage actions.",
    "The roadmap is stronger when dependencies are visible instead of implied.",
    "Milestone order matters, so the visual should make sequence and importance easy to scan.",
  ];
  const outcomeOpeners = [
    "Later stages should connect actions to outcomes so progress feels measurable.",
    "Each late-stage milestone should signal what success looks like before the roadmap expands.",
    "Outcome checkpoints help the roadmap move beyond tasks and toward visible progress.",
    "A strong closing phase should show what the roadmap enables after execution.",
    "Final milestones should explain the result of consistent progress, not just list more tasks.",
  ];
  const mobileOpeners = [
    "Labels should stay short enough that each stage remains readable on a phone screen.",
    "Stage notes should be concise so the roadmap keeps strong mobile readability.",
    "The best roadmap visuals reduce tiny text and let milestones carry the structure.",
    "Mobile-friendly layouts work best when each stage has one clear action focus and one visible checkpoint.",
    "Readable roadmap cards help the viewer understand progression without zooming into dense text.",
  ];

  return [
    `${stageOpeners[index % stageOpeners.length]} ${topic.milestoneTheme}.`,
    `${middleOpeners[index % middleOpeners.length]} ${topic.coreFocus}.`,
    priorityOpeners[index % priorityOpeners.length],
    outcomeOpeners[index % outcomeOpeners.length],
    mobileOpeners[index % mobileOpeners.length],
  ];
}

function buildTemplate(topic: TopicDefinition, index: number) {
  const slug = slugify(topic.topicName);
  const generated = readGeneratedTemplateManifest()[slug];
  const updatedAt = generated?.updatedAt || "2026-06-14T00:00:00.000Z";
  const aspectRatio = aspectRatioForIndex(index);
  const { width, height } = imageSizeForIndex(index);
  const primaryKeyword = topic.topicName;
  const title = `${topic.topicName} Template`;
  const detailPath = `/infographic/roadmap/${slug}/`;
  const canonicalUrl = siteUrl + detailPath;
  const stylePrompt = stylePrompts[topic.styleName];
  const topicPrompt = `Create a roadmap infographic about ${topic.topicName.replace(/\s+Infographic$/i, "")}. Use a ${topic.structureType} layout that clearly shows stage progression, priorities, milestone checkpoints, and key actions.`;
  const knowledgePoints = buildKnowledgePoints(topic, index);
  const imageDescription = buildImageDescription(topic, primaryKeyword, index);
  const visibleDescription = buildVisibleDescription(
    topic,
    primaryKeyword,
    generatorKeywords[index % generatorKeywords.length],
  );
  const aboutDescription = buildAboutDescription(topic, primaryKeyword);
  const contentPrompt =
    `Create a professional roadmap infographic about ${topic.topicName.replace(/\s+Infographic$/i, "")}. Structure type: ${topic.structureType}. Domain: ${topic.domain}. Focus on ${topic.coreFocus}. Show a clear start, staged progression, milestone checkpoints, priority cues, key actions, and outcome nodes. Milestone theme: ${topic.milestoneTheme}. Knowledge points: ${knowledgePoints.join(" ")}. Image description: ${imageDescription} Use concise English labels, roadmap cards, timeline or pathway structure, and mobile-readable hierarchy. Do not turn this into a generic concept poster. Do not add fake numbers, policy promises, medical treatment claims, legal claims, or investment advice.`;
  const finalPrompt = [stylePrompt, contentPrompt, aspectRatioPromptForIndex(index), qualityPrompt].join("\n\n");
  const imageFilename = `roadmap-${slug}.webp`;

  return {
    id: `roadmap-template-${String(index + 1).padStart(3, "0")}`,
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
    title,
    topicName: topic.topicName,
    primaryKeyword,
    secondaryKeywords: buildSecondaryKeywords(topic),
    generatorKeywords: generatorKeywords.slice(index % 2, index % 2 + 4),
    topicPrompt,
    knowledgePoints,
    contentPrompt,
    imageDescription,
    visibleDescription,
    aboutDescription,
    h1: title,
    seoTitle: `${title} - KnowLens AI`,
    metaDescription: `Explore this ${topic.topicName.toLowerCase()} template with clear stages, milestones, priorities, and action flow. Create a similar roadmap visual with KnowLens AI.`,
    shortDescription: `A structured ${topic.topicName.toLowerCase()} template with clear phases, milestones, and mobile-readable action flow.`,
    previewImagePath:
      generated?.previewImagePath ||
      (generated?.previewImageUrl ? new URL(generated.previewImageUrl).pathname : "/picture/text-to-ppt-hero.jpg"),
    previewImageUrl: generated?.previewImageUrl || `${siteUrl}/picture/text-to-ppt-hero.jpg`,
    storageKey: generated?.storageKey || `infographic/roadmap/${imageFilename}`,
    imageFilename: generated?.imageFilename || imageFilename,
    imageFormat: generated?.imageFormat || ("webp" as const),
    imageMimeType: generated?.imageMimeType || "image/webp",
    imageWidth: generated?.imageWidth || width,
    imageHeight: generated?.imageHeight || height,
    imageSizeBytes: generated?.imageSizeBytes,
    aspectRatio,
    imageAlt: `${topic.topicName.toLowerCase()} with clear milestones and stage planning`,
    imageTitle: title,
    imageCaption: `${topic.topicName} created with KnowLens AI as a structured roadmap infographic template.`,
    styleName: topic.styleName,
    stylePrompt,
    visualPrompt: contentPrompt,
    aspectRatioPrompt: aspectRatioPromptForIndex(index),
    qualityPrompt,
    finalPrompt,
    createSimilarPrompt: `Create a roadmap infographic about ${topic.topicName.replace(/\s+Infographic$/i, "")}. Use ${topic.styleName}. Show phases, milestones, priorities, key actions, and clear outcome checkpoints. Keep the design mobile-readable, reduce small text, and keep the roadmap structured and easy to scan.`,
    structureType: topic.structureType,
    useCases: topic.useCases,
    targetAudience: topic.audience,
    tags: Array.from(new Set(["roadmap", "infographic", topic.domain, topic.structureType, ...slug.split("-").slice(0, 8)])),
    relatedTemplateIds: [] as string[],
    relatedCategorySlugs: ["roadmap", "process", "infographic-examples"],
    relatedToolSlugs: ["ai-infographic-generator", "infographic-maker", "process-infographic-generator"],
    allowPublicDownload: false as const,
    allowPublicExport: false as const,
    allowOriginalView: false as const,
    allowSocialShare: true as const,
    createdAt: "2026-06-14T00:00:00.000Z",
    updatedAt,
  };
}

export function getRoadmapInfographicTemplates() {
  return topicDefinitions.map(buildTemplate).map((template, index, source) => ({
    ...template,
    relatedTemplateIds: source
      .filter((item) => item.id !== template.id && item.generationStatus === "success")
      .slice(Math.max(0, index - 2), index + 8)
      .filter((item) => item.id !== template.id)
      .slice(0, 6)
      .map((item) => item.id),
  }));
}

export const roadmapInfographicTemplates = getRoadmapInfographicTemplates();

export type RoadmapInfographicTemplate = ReturnType<typeof buildTemplate>;

export function getRoadmapInfographicTemplate(slug: string) {
  return getRoadmapInfographicTemplates().find((template) => template.slug === slug);
}
