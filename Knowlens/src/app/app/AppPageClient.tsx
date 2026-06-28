"use client";
/* eslint-disable @next/next/no-img-element */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import {
  Bot,
  BookOpen,
  Brain,
  Check,
  Crown,
  Dna,
  FileText,
  FlaskConical,
  FolderOpen,
  Globe,
  Headphones,
  Heart,
  Home as HomeIcon,
  ImagePlay,
  Landmark,
  Layers3,
  Leaf,
  Lightbulb,
  LoaderCircle,
  Map,
  Menu,
  Minus,
  Network,
  PanelsTopLeft,
  PanelTop,
  Play,
  Plus,
  SendHorizontal,
  ExternalLink,
  Share2,
  Video,
  UserCircle2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { SidebarNav } from "@/components/app-shell/SidebarNav";
import { UserMenu } from "@/components/auth/UserMenu";
import { LocaleSwitch } from "@/components/i18n/LocaleSwitch";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  consumeCheckoutReturnNotice,
  getCreditRecords,
  getSubscriptionByUser,
  syncCreditRecordsFromServer,
} from "@/lib/billing";
import {
  getCaseMetrics,
  incrementCaseView,
  getFeaturedDetailPath,
  getResolvedFeaturedCases,
  type FeaturedCaseItem,
  normalizeCategoryLabel,
  normalizeFormatLabel,
  toggleCaseLike,
} from "@/lib/featured-cases";
import { PaywallDialog } from "@/components/billing/PaywallDialog";
import { PublishedVideoPlayer } from "@/components/featured/PublishedVideoPlayer";
import { readAttributionPayload } from "@/lib/attribution";

const navItems = [
  { key: "home", label: "Home", icon: HomeIcon, href: "/app" },
  { key: "projects", label: "Projects", icon: FolderOpen, href: "/projects" },
  { key: "profile", label: "Profile", icon: UserCircle2, href: "/profile" },
];

const HOME_GENERATE_CTA_BASE_CLASS =
  "mt-1 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border-0 px-4 text-sm font-medium text-white shadow-[0_8px_20px_rgba(15,23,42,0.18)] transition hover:bg-zinc-700 hover:shadow-[0_10px_24px_rgba(15,23,42,0.20)] active:translate-y-px active:shadow-[0_6px_16px_rgba(15,23,42,0.16)] disabled:cursor-wait disabled:text-white disabled:active:translate-y-0 sm:ml-auto sm:mt-0 sm:w-auto";
const HOME_GENERATE_CTA_READY_CLASS = "bg-zinc-900";
const HOME_GENERATE_CTA_BUSY_CLASS = "cursor-wait bg-zinc-800";
const DEFAULT_SHOWCASE_CATEGORY = "All";
const FEATURED_CASE_BATCH_SIZE = 8;
const SUPPORTED_SHOWCASE_CATEGORIES = [
  "Earth Science",
  "Process",
  "Recipe",
  "Financial Report",
  "Biology",
  "History",
  "Timeline",
  "Comparison",
  "Roadmap",
  "Astronomy",
  "Medicine",
];


const textModelOptions = [
  {
    value: "gemini-2.5",
    label: "Gemini 3",
    desc: "Fast drafting for everyday topics and first-pass content planning.",
    premium: false,
  },
  {
    value: "gpt-5.5",
    label: "GPT-5.5",
    desc: "Best for deep reasoning and infographic-ready information architecture.",
    premium: true,
  },
  {
    value: "gpt-5.4",
    label: "GPT-5.4",
    desc: "Strong structure stability for consistent multi-page explainers.",
    premium: false,
  },
  {
    value: "gemini-3.1-pro",
    label: "Gemini 3.5",
    desc: "Strong at long-context synthesis for complex knowledge understanding.",
    premium: true,
  },
  {
    value: "claude-sonnet-4.6",
    label: "Claude Sonnet 4.7",
    desc: "Polished narrative quality for clear, concise visual storytelling copy.",
    premium: true,
  },
];

function defaultFreeModelByLocale(locale: "en" | "zh") {
  return "gemini-2.5";
}

function isKnownTextModel(value: string | null | undefined): value is string {
  if (!value) {
    return false;
  }
  return textModelOptions.some((option) => option.value === value);
}

function getHomeTextModelPreferenceKey(email?: string) {
  const normalizedEmail = email?.trim().toLowerCase();
  return normalizedEmail ? `${HOME_TEXT_MODEL_KEY}:${normalizedEmail}` : HOME_TEXT_MODEL_KEY;
}

function readStoredHomeTextModel(email?: string) {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const keys = email
      ? [getHomeTextModelPreferenceKey(email), HOME_TEXT_MODEL_KEY]
      : [HOME_TEXT_MODEL_KEY];
    for (const key of keys) {
      const storedValue = window.localStorage.getItem(key)?.trim();
      if (isKnownTextModel(storedValue)) {
        return storedValue;
      }
    }
  } catch {
    // Ignore unavailable storage, private browsing, or malformed values.
  }
  return null;
}

function writeStoredHomeTextModel(modelValue: string | null, email?: string) {
  if (typeof window === "undefined" || !isKnownTextModel(modelValue)) {
    return;
  }
  try {
    window.localStorage.setItem(HOME_TEXT_MODEL_KEY, modelValue);
    window.localStorage.setItem(getHomeTextModelPreferenceKey(email), modelValue);
  } catch {
    // Ignore storage quota or permission failures.
  }
}

const creationInputPlaceholder = "Enter a science idea or paste your learning text.";

type SourceKind = "file" | "web" | "youtube" | "podcast";

type SourceItem = {
  id: string;
  jobId?: string;
  kind: SourceKind;
  name: string;
  origin: string;
  mimeType?: string;
  sizeBytes?: number;
  progress?: number;
  previewUrl?: string;
  status: "queued" | "uploading" | "extracting" | "processing" | "ready" | "failed";
  excerpt: string;
  contentText?: string;
};

type HomeDraftPayload = {
  prompt?: string;
  textModel?: string;
  imageModel?: string;
  sources?: Array<Partial<SourceItem>>;
  project?: {
    projectId?: string;
    projectTraceId?: string;
    projectUserId?: string;
    projectTitle?: string;
  };
};

type WorkspaceStartErrorPayload = {
  error?: string;
  code?: string;
};

type PromptSuggestionCard = {
  id: string;
  label: string;
  category: string;
  weight: 1 | 2 | 3;
  prompt: string;
};

const PROMPT_SUGGESTION_VISIBLE_COUNT = 8;
const PROMPT_SUGGESTION_CARDS: PromptSuggestionCard[] = [
  { id: "mediterranean-diet-recipe", label: "Mediterranean Diet Recipe", category: "recipe", weight: 3, prompt: "Create an English infographic poster about a Mediterranean diet recipe. Show a beautiful central plate with salmon, olive oil, vegetables, grains, and herbs. Include key ingredients, simple cooking steps, nutrition benefits, and serving tips. Use a clean editorial food infographic style with large readable text." },
  { id: "high-protein-breakfast", label: "High Protein Breakfast", category: "recipe", weight: 3, prompt: "Create an English infographic explaining a high-protein breakfast recipe. Show eggs, Greek yogurt, oats, berries, and nuts as the central visual. Include ingredients, protein sources, simple preparation steps, and why the meal helps people feel full. Make it healthy, modern, and easy to read." },
  { id: "air-fryer-chicken", label: "Air Fryer Chicken", category: "recipe", weight: 3, prompt: "Create an English recipe infographic for air fryer chicken. Show crispy chicken as the central visual. Include ingredients, seasoning mix, cooking time and temperature, step-by-step process, and serving ideas. Keep the design practical, clean, and appetizing." },
  { id: "glp1-food-list", label: "GLP-1 Food List", category: "health", weight: 3, prompt: "Create an English educational infographic about a GLP-1 friendly food list. Show a balanced plate divided into protein, fiber-rich vegetables, healthy fats, and hydration. Include foods to prioritize, foods to limit, and a simple meal-building rule. Keep the tone educational and avoid medical advice." },
  { id: "meal-prep-plan", label: "Meal Prep Plan", category: "recipe", weight: 2, prompt: "Create an English infographic showing a 5-day healthy meal prep plan. Use lunch boxes as the central visual. Include breakfast, lunch, dinner, and snack examples. Make the layout easy to scan, practical, colorful, and clean." },
  { id: "ancient-egypt-timeline", label: "Ancient Egypt Timeline", category: "history", weight: 3, prompt: "Create an English history timeline infographic about Ancient Egypt. Show the main periods, the Nile River, pyramids, pharaohs, writing, religion, governance, achievements, and legacy. Keep the tone neutral, educational, and visually clear." },
  { id: "world-war-ii-timeline", label: "World War II Timeline", category: "history", weight: 3, prompt: "Create an English educational timeline infographic about World War II. Show key events from 1939 to 1945, including the invasion of Poland, Battle of Britain, Pearl Harbor, D-Day, and the end of the war. Use a neutral, non-propagandistic tone and avoid graphic violence." },
  { id: "history-of-ai", label: "History of AI", category: "ai-tech", weight: 3, prompt: "Create an English infographic timeline about the history of artificial intelligence. Include the Turing Test, expert systems, deep learning, transformers, generative AI, and AI agents. Use a premium technology editorial style with clear milestones." },
  { id: "space-race-timeline", label: "Space Race Timeline", category: "history", weight: 2, prompt: "Create an English history infographic about the Space Race. Show key milestones such as Sputnik, Yuri Gagarin, Apollo 11, space stations, and reusable rockets. Use rockets, Earth, orbit lines, and concise timeline cards." },
  { id: "roman-empire-timeline", label: "Roman Empire Timeline", category: "history", weight: 2, prompt: "Create an English history timeline infographic about the Roman Empire. Show the Roman Republic, Caesar, Augustus, Pax Romana, the empire split, and the fall of the Western Roman Empire. Include governance, engineering, military, law, and legacy." },
  { id: "ai-agent-workflow", label: "AI Agent Workflow", category: "ai-tech", weight: 3, prompt: "Create an English infographic explaining an AI agent workflow. Show a clear loop: user goal, planning, tool use, memory or context, action, feedback, and final result. Use clean nodes, arrows, concise labels, and a modern technology education style." },
  { id: "mcp-architecture", label: "MCP Architecture", category: "ai-tech", weight: 3, prompt: "Create an English technical infographic explaining MCP architecture. Show the relationship between an AI app, MCP client, MCP server, external tools, files, databases, and APIs. Use labeled layers, arrows, and simple explanations for developers and product managers." },
  { id: "mcp-vs-api", label: "MCP vs API", category: "comparison", weight: 3, prompt: "Create an English comparison infographic titled MCP vs API. Compare direct API request-response connections with MCP as a standardized context and tool connection layer for AI apps. Include purpose, connection style, AI use case, and flexibility." },
  { id: "ai-agent-vs-chatbot", label: "AI Agent vs Chatbot", category: "comparison", weight: 3, prompt: "Create an English comparison infographic explaining AI Agent vs Chatbot. Compare chatbots that respond to messages with AI agents that plan tasks, use tools, follow goals, and take multi-step actions. Use a clear two-column layout." },
  { id: "vibe-coding-workflow", label: "Vibe Coding Workflow", category: "ai-tech", weight: 2, prompt: "Create an English infographic explaining a vibe coding workflow. Show the process: describe product idea, generate code, preview, test, fix errors, polish UI, and deploy. Add practical tips for designers and product managers learning AI coding." },
  { id: "context-engineering", label: "Context Engineering", category: "ai-tech", weight: 2, prompt: "Create an English infographic explaining context engineering for AI systems. Show user goal, system instructions, retrieved knowledge, memory, tools, examples, output format, and evaluation around a central AI model visual." },
  { id: "photosynthesis-process", label: "Photosynthesis Process", category: "science", weight: 3, prompt: "Create an English science infographic explaining photosynthesis. Show sunlight, carbon dioxide, water, chloroplasts, glucose, and oxygen. Use a clear plant-centered diagram with arrows and simple educational labels." },
  { id: "water-cycle-diagram", label: "Water Cycle Diagram", category: "science", weight: 3, prompt: "Create an English earth science infographic about the water cycle. Show mountains, ocean, clouds, rain, and rivers. Label evaporation, condensation, precipitation, collection, runoff, and infiltration with clear arrows." },
  { id: "human-heart-anatomy", label: "Human Heart Anatomy", category: "science", weight: 3, prompt: "Create an English medical education infographic explaining basic human heart anatomy. Show a simplified heart with left atrium, right atrium, left ventricle, and right ventricle. Add blood flow arrows and explain oxygen-rich and oxygen-poor blood flow." },
  { id: "dna-replication", label: "DNA Replication", category: "science", weight: 2, prompt: "Create an English biology infographic explaining DNA replication. Show a DNA double helix opening into two strands. Label helicase, DNA polymerase, leading strand, lagging strand, and new complementary strands. Use simple steps and avoid overcrowding." },
  { id: "solar-system-comparison", label: "Solar System Comparison", category: "science", weight: 3, prompt: "Create an English educational infographic comparing the planets in the solar system. Show all eight planets in order from the Sun with simple labels for size, type, and one key fact each. Use a cinematic space style." },
  { id: "earth-layers-diagram", label: "Earth Layers Diagram", category: "science", weight: 2, prompt: "Create an English earth science infographic explaining Earth's layers. Show a cutaway globe and label crust, mantle, outer core, and inner core. Add simple notes about material, depth, and temperature trend." },
  { id: "volcano-eruption", label: "Volcano Eruption", category: "science", weight: 2, prompt: "Create an English earth science infographic explaining how a volcano erupts. Show a cutaway volcano with magma chamber, conduit, crater, lava flow, ash cloud, and tectonic plates. Add simple steps explaining pressure buildup and eruption." },
  { id: "design-thinking-process", label: "Design Thinking Process", category: "process", weight: 3, prompt: "Create an English process infographic explaining design thinking. Show the five stages: empathize, define, ideate, prototype, and test. Use a clean circular workflow layout with concise notes for each stage." },
  { id: "coffee-making-process", label: "Coffee Making Process", category: "process", weight: 2, prompt: "Create an English process infographic explaining how coffee is made from bean to cup. Show coffee plant, harvesting, roasting, grinding, brewing, and final cup. Use a warm editorial illustration style with concise labels." },
  { id: "product-roadmap", label: "Product Roadmap", category: "business", weight: 2, prompt: "Create an English product roadmap infographic for a SaaS product. Show a four-stage roadmap: research, MVP, launch, and growth. Include feature cards, milestones, and success metrics in a clean business editorial style." },
  { id: "etfs-vs-mutual-funds", label: "ETFs vs Mutual Funds", category: "finance", weight: 3, prompt: "Create an English finance comparison infographic explaining ETFs vs mutual funds. Compare trading style, fees, diversification, tax efficiency, investor fit, and key differences. Keep the tone neutral and educational, without giving financial advice." },
  { id: "compound-interest-chart", label: "Compound Interest Chart", category: "finance", weight: 3, prompt: "Create an English finance education infographic explaining compound interest. Show a simple growth curve with principal, interest, reinvested earnings, and time. Include a small example with simple numbers and keep it educational, not financial advice." },
  { id: "sp500-investing-guide", label: "S&P 500 Investing Guide", category: "finance", weight: 2, prompt: "Create an English educational finance infographic explaining the basics of S&P 500 investing. Explain what the S&P 500 is, why diversification matters, the long-term investing concept, dollar-cost averaging, and risk reminder. Avoid personalized financial advice." },
  { id: "ai-data-center-power", label: "AI Data Center Power", category: "ai-tech", weight: 2, prompt: "Create an English data-style infographic explaining why AI data centers need so much electricity. Show a central data center connected to GPUs, cooling systems, power grid, and AI model training. Include compute, cooling, storage, and grid demand." },
];

const PROMPT_SUGGESTION_ZH: Record<string, { label: string; prompt: string }> = {
  "mediterranean-diet-recipe": {
    label: "地中海饮食食谱",
    prompt: "生成一张中文食谱信息图，主题是地中海饮食。画面以三文鱼、橄榄油、蔬菜、谷物和香草组成的餐盘为核心，包含关键食材、简单步骤、营养亮点和搭配建议。整体风格清爽、健康、适合手机阅读。",
  },
  "high-protein-breakfast": {
    label: "高蛋白早餐",
    prompt: "生成一张中文早餐信息图，主题是高蛋白早餐。画面展示鸡蛋、希腊酸奶、燕麦、莓果和坚果，说明蛋白质来源、制作步骤、饱腹感原因和适合人群。排版现代、干净、易读。",
  },
  "air-fryer-chicken": {
    label: "空气炸锅鸡肉",
    prompt: "生成一张中文食谱流程信息图，主题是空气炸锅鸡肉。展示酥脆鸡肉、调味料、烹饪温度和时间、分步做法与摆盘建议。画面实用、清爽、有食欲。",
  },
  "glp1-food-list": {
    label: "GLP-1 饮食清单",
    prompt: "生成一张中文健康饮食科普信息图，主题是 GLP-1 友好食物清单。用均衡餐盘展示优先选择的蛋白质、高纤维蔬菜、健康脂肪和补水建议，同时说明应少吃的食物。语气保持科普，不提供医疗建议。",
  },
  "meal-prep-plan": {
    label: "一周备餐计划",
    prompt: "生成一张中文备餐计划信息图，展示 5 天健康备餐安排。以便当盒为核心视觉，包含早餐、午餐、晚餐和加餐示例。排版实用、清晰、色彩友好。",
  },
  "ancient-egypt-timeline": {
    label: "古埃及时间线",
    prompt: "生成一张中文历史时间线信息图，主题是古埃及文明。展示主要时期、尼罗河、金字塔、法老、文字、宗教、治理、成就与影响。语气中立，适合教学和复习。",
  },
  "world-war-ii-timeline": {
    label: "二战时间线",
    prompt: "生成一张中文历史时间线信息图，主题是第二次世界大战。展示 1939 到 1945 年的重要节点，包括波兰战役、不列颠空战、珍珠港、诺曼底登陆和战争结束。保持中立、教育导向，避免血腥画面。",
  },
  "history-of-ai": {
    label: "AI 发展史",
    prompt: "生成一张中文科技时间线信息图，主题是人工智能发展史。包含图灵测试、专家系统、深度学习、Transformer、生成式 AI 和 AI Agent 等关键阶段。风格高级、清晰、适合科普。",
  },
  "space-race-timeline": {
    label: "太空竞赛时间线",
    prompt: "生成一张中文历史信息图，主题是太空竞赛。展示 Sputnik、尤里·加加林、阿波罗 11 号、空间站和可复用火箭等节点。使用火箭、地球和轨道线，文字简洁。",
  },
  "roman-empire-timeline": {
    label: "罗马帝国时间线",
    prompt: "生成一张中文历史时间线信息图，主题是罗马帝国。展示罗马共和国、凯撒、奥古斯都、罗马和平、帝国分裂和西罗马灭亡，并说明治理、工程、军事、法律与影响。",
  },
  "ai-agent-workflow": {
    label: "AI Agent 工作流",
    prompt: "生成一张中文科技流程信息图，解释 AI Agent 的工作流。展示用户目标、规划、工具调用、记忆或上下文、执行、反馈和结果。使用清晰节点、箭头和简短说明。",
  },
  "mcp-architecture": {
    label: "MCP 架构",
    prompt: "生成一张中文技术架构信息图，解释 MCP 架构。展示 AI 应用、MCP Client、MCP Server、外部工具、文件、数据库和 API 的关系，适合开发者和产品经理理解。",
  },
  "mcp-vs-api": {
    label: "MCP vs API",
    prompt: "生成一张中文对比信息图，主题是 MCP vs API。对比传统 API 的请求响应连接方式，以及 MCP 作为 AI 应用连接上下文与工具的标准层。包含用途、连接方式、AI 场景和灵活性。",
  },
  "ai-agent-vs-chatbot": {
    label: "AI Agent vs 聊天机器人",
    prompt: "生成一张中文对比信息图，解释 AI Agent 和聊天机器人的区别。对比聊天机器人主要回复消息，而 AI Agent 可以规划任务、调用工具、追踪目标并执行多步操作。使用清晰双栏布局。",
  },
  "vibe-coding-workflow": {
    label: "Vibe Coding 流程",
    prompt: "生成一张中文流程信息图，解释 Vibe Coding 工作流。展示描述产品想法、生成代码、预览、测试、修复错误、打磨界面和部署等步骤，并加入给产品经理和设计师的实用建议。",
  },
  "context-engineering": {
    label: "上下文工程",
    prompt: "生成一张中文技术信息图，解释 AI 系统中的上下文工程。展示用户目标、系统指令、检索知识、记忆、工具、示例、输出格式和评估如何围绕模型协同工作。",
  },
  "photosynthesis-process": {
    label: "光合作用过程",
    prompt: "生成一张中文科学信息图，解释光合作用。展示阳光、二氧化碳、水、叶绿体、葡萄糖和氧气，用植物为中心的图解和箭头说明过程。",
  },
  "water-cycle-diagram": {
    label: "水循环图解",
    prompt: "生成一张中文地球科学信息图，解释水循环。画面包含山脉、海洋、云、降雨和河流，并标注蒸发、凝结、降水、汇集、径流和下渗。",
  },
  "human-heart-anatomy": {
    label: "心脏结构图",
    prompt: "生成一张中文医学科普信息图，解释基础心脏结构。展示简化心脏图，标注左心房、右心房、左心室、右心室和血流方向，说明含氧血与缺氧血的流动。",
  },
  "dna-replication": {
    label: "DNA 复制",
    prompt: "生成一张中文生物信息图，解释 DNA 复制。展示双螺旋打开成两条链，标注解旋酶、DNA 聚合酶、前导链、滞后链和互补新链。步骤简洁，避免文字过密。",
  },
  "solar-system-comparison": {
    label: "太阳系行星对比",
    prompt: "生成一张中文科学对比信息图，比较太阳系八大行星。按离太阳远近展示行星顺序，并用简短标签说明大小、类型和一个关键事实。风格具有宇宙感且易读。",
  },
  "earth-layers-diagram": {
    label: "地球圈层图",
    prompt: "生成一张中文地球科学信息图，解释地球圈层。展示地球剖面图，标注地壳、地幔、外核和内核，并用简短说明展示材料、深度和温度趋势。",
  },
  "volcano-eruption": {
    label: "火山喷发原理",
    prompt: "生成一张中文地球科学信息图，解释火山如何喷发。展示火山剖面，包含岩浆房、通道、火山口、熔岩流、火山灰云和板块，并说明压力积累和喷发过程。",
  },
  "design-thinking-process": {
    label: "设计思维流程",
    prompt: "生成一张中文流程信息图，解释设计思维五个阶段：共情、定义、创意、原型和测试。使用清晰的循环流程布局，每一步配简短说明。",
  },
  "coffee-making-process": {
    label: "咖啡制作流程",
    prompt: "生成一张中文流程信息图，解释咖啡从咖啡豆到杯子的过程。展示咖啡树、采摘、烘焙、研磨、冲煮和成品咖啡，使用温暖的编辑插画风格。",
  },
  "product-roadmap": {
    label: "产品路线图",
    prompt: "生成一张中文产品路线图信息图，面向 SaaS 产品。展示调研、MVP、发布和增长四个阶段，包含功能卡片、里程碑和成功指标。",
  },
  "etfs-vs-mutual-funds": {
    label: "ETF vs 共同基金",
    prompt: "生成一张中文金融科普对比信息图，解释 ETF 和共同基金的区别。比较交易方式、费用、分散投资、税务效率、适合人群和关键差异。保持中立，不提供投资建议。",
  },
  "compound-interest-chart": {
    label: "复利增长图",
    prompt: "生成一张中文金融科普信息图，解释复利。展示本金、利息、再投资收益和时间带来的增长曲线，并用简单数字举例。仅做教育说明，不提供投资建议。",
  },
  "sp500-investing-guide": {
    label: "标普 500 入门",
    prompt: "生成一张中文金融科普信息图，解释标普 500 投资基础。说明标普 500 是什么、分散投资为什么重要、长期投资、定投概念和风险提醒。避免个性化投资建议。",
  },
  "ai-data-center-power": {
    label: "AI 数据中心用电",
    prompt: "生成一张中文数据型信息图，解释为什么 AI 数据中心需要大量电力。展示数据中心与 GPU、冷却系统、电网和模型训练的连接，说明计算、散热、存储和电网需求。",
  },
};

const SHOWCASE_CATEGORY_ZH: Record<string, string> = {
  All: "全部",
  "Earth Science": "地球科学",
  Process: "流程",
  Recipe: "食谱",
  "Financial Report": "财报分析",
  Biology: "生物",
  History: "历史",
  Timeline: "时间线",
  Comparison: "对比图",
  Roadmap: "路线图",
  Astronomy: "天文",
  Medicine: "医学科普",
  Science: "科学",
  Education: "教育",
  Business: "商业",
};

const FORMAT_LABEL_ZH: Record<string, string> = {
  Infographic: "信息图",
  Poster: "海报",
  Video: "视频",
  PPT: "演示文稿",
  Carousel: "轮播图",
};

function getPromptSuggestionLabel(card: PromptSuggestionCard, locale: "en" | "zh") {
  return locale === "zh" ? PROMPT_SUGGESTION_ZH[card.id]?.label || card.label : card.label;
}

function getPromptSuggestionPrompt(card: PromptSuggestionCard, locale: "en" | "zh") {
  return locale === "zh" ? PROMPT_SUGGESTION_ZH[card.id]?.prompt || card.prompt : card.prompt;
}

function localizeShowcaseCategory(category: string, locale: "en" | "zh") {
  return locale === "zh" ? SHOWCASE_CATEGORY_ZH[category] || category : category;
}

function localizeFormatLabel(format: string, locale: "en" | "zh") {
  return locale === "zh" ? FORMAT_LABEL_ZH[format] || format : format;
}

function shuffleItems<T>(items: T[]) {
  const nextItems = [...items];
  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [nextItems[index], nextItems[randomIndex]] = [nextItems[randomIndex], nextItems[index]];
  }
  return nextItems;
}

function selectPromptSuggestionCards() {
  const selected: PromptSuggestionCard[] = [];
  const usedIds = new Set<string>();
  const categoryTargets = shuffleItems(Array.from(new Set(PROMPT_SUGGESTION_CARDS.map((item) => item.category)))).slice(0, 4);
  while (selected.length < Math.min(PROMPT_SUGGESTION_VISIBLE_COUNT, PROMPT_SUGGESTION_CARDS.length)) {
    const pendingCategories = categoryTargets.filter((category) => !selected.some((item) => item.category === category));
    const candidatePool = PROMPT_SUGGESTION_CARDS.filter((item) => !usedIds.has(item.id) && (!pendingCategories.length || pendingCategories.includes(item.category)));
    const fallbackPool = PROMPT_SUGGESTION_CARDS.filter((item) => !usedIds.has(item.id));
    const pool = candidatePool.length ? candidatePool : fallbackPool;
    if (!pool.length) break;
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
    let threshold = Math.random() * totalWeight;
    const picked = pool.find((item) => {
      threshold -= item.weight;
      return threshold <= 0;
    }) || pool[pool.length - 1];
    usedIds.add(picked.id);
    selected.push(picked);
  }
  return selected;
}

function getPromptSuggestionIcon(cardId: string) {
  switch (cardId) {
    case "mediterranean-diet-recipe":
      return Leaf;
    case "high-protein-breakfast":
      return Heart;
    case "air-fryer-chicken":
      return Crown;
    case "glp1-food-list":
      return Brain;
    case "meal-prep-plan":
      return PanelsTopLeft;
    case "ancient-egypt-timeline":
      return Landmark;
    case "world-war-ii-timeline":
      return Layers3;
    case "history-of-ai":
      return Bot;
    case "space-race-timeline":
      return Play;
    case "roman-empire-timeline":
      return BookOpen;
    case "ai-agent-workflow":
      return Network;
    case "mcp-architecture":
      return FolderOpen;
    case "mcp-vs-api":
      return PanelTop;
    case "ai-agent-vs-chatbot":
      return MessageSquareIconFallback;
    case "vibe-coding-workflow":
      return FileText;
    case "context-engineering":
      return Layers3;
    case "photosynthesis-process":
      return FlaskConical;
    case "water-cycle-diagram":
      return Globe;
    case "human-heart-anatomy":
      return Heart;
    case "dna-replication":
      return Dna;
    case "solar-system-comparison":
      return SparkleIconFallback;
    case "earth-layers-diagram":
      return Map;
    case "volcano-eruption":
      return Zap;
    case "design-thinking-process":
      return Lightbulb;
    case "coffee-making-process":
      return Headphones;
    case "product-roadmap":
      return Map;
    case "etfs-vs-mutual-funds":
      return Share2;
    case "compound-interest-chart":
      return Plus;
    case "sp500-investing-guide":
      return ExternalLink;
    case "ai-data-center-power":
      return ImagePlay;
    default:
      return BookOpen;
  }
}

const MessageSquareIconFallback = FileText;
const SparkleIconFallback = Lightbulb;

function normalizeLegacySourceName(name: string) {
  if (name === "网页链接") {
    return "Web URL";
  }
  if (name === "YouTube 视频") {
    return "YouTube Video";
  }
  if (name === "播客链接") {
    return "Podcast Link";
  }
  return name;
}

function normalizeLegacySourceExcerpt(excerpt: string) {
  if (excerpt === "Queued for processing...") return "Queued for processing...";
  if (excerpt === "Processing upload...") return "Processing upload...";
  if (excerpt === "Processing link...") return "Processing link...";
  if (excerpt === "Processing transcript...") return "Reading transcript...";
  if (excerpt === "Processing webpage text...") return "Reading page text...";
  if (excerpt === "文本内容较短，已完成解析。") {
    return "The extracted text is short. Parsing completed.";
  }
  if (excerpt.includes("字幕提取完成")) {
    return "Transcript extracted: key concepts, steps, and practical examples were detected.";
  }
  if (excerpt.includes("正文提取完成")) {
    return "Text extracted: title, key viewpoints, and main sections were identified.";
  }
  if (excerpt.includes("播客字幕提取完成")) {
    return "Transcript extracted: key arguments, examples, and speaking structure were identified.";
  }
  if (excerpt.includes("已识别图片素材")) {
    return "Image source detected. It can be used for visual explanation and prompt generation.";
  }
  if (excerpt.includes("已识别音视频素材")) {
    return "Audio/video source detected. Transcript draft extracted and ready for scripting.";
  }
  if (excerpt.includes("已识别文档")) {
    return "Document detected. Outline and key paragraphs extracted for visual generation.";
  }
  return excerpt;
}

function formatFileSize(bytes?: number) {
  if (!bytes || bytes <= 0) {
    return "--";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtensionLabel(fileName: string) {
  const ext = fileName.split(".").pop()?.trim().toUpperCase();
  if (!ext || ext === fileName.toUpperCase()) {
    return "FILE";
  }
  return ext;
}

function getSourceFormatLabel(item: SourceItem) {
  if (item.kind === "youtube") return "YOUTUBE";
  if (item.kind === "podcast") return "PODCAST";
  if (item.kind === "web") return "WEB";
  return getFileExtensionLabel(item.name);
}

function getSourceProgress(item: SourceItem) {
  if (item.status === "ready") return 100;
  if (item.status === "failed") return 0;
  if (item.status === "queued") return Math.max(3, Math.min(item.progress ?? 5, 20));
  if (item.status === "uploading") return Math.max(8, Math.min(item.progress ?? 18, 35));
  if (item.status === "extracting") return Math.max(35, Math.min(item.progress ?? 50, 70));
  return Math.max(60, Math.min(item.progress ?? 72, 98));
}

function getSourceStatusText(item: SourceItem) {
  if (item.status === "ready") return "";
  if (item.status === "failed") return item.excerpt || "Upload failed";
  return "Uploading";
}

function getCompactFileName(name: string, maxLength = 22) {
  if (name.length <= maxLength) return name;
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex >= name.length - 1) {
    return `${name.slice(0, maxLength - 1)}…`;
  }
  const ext = name.slice(dotIndex + 1);
  const base = name.slice(0, dotIndex);
  const head = Math.max(8, maxLength - ext.length - 4);
  return `${base.slice(0, head)}….${ext}`;
}

function cleanUploadErrorMessage(message: string) {
  const trimmed = message.trim();
  if (!trimmed) {
    return "Upload failed.";
  }
  if (/ENOENT/i.test(trimmed)) {
    return "Upload failed: file not found.";
  }
  if (/too large|exceeds|file size/i.test(trimmed)) {
    return "Upload failed: file is too large.";
  }
  if (/unsupported|not supported|invalid file type/i.test(trimmed)) {
    return "Upload failed: file type is not supported.";
  }
  if (/network|fetch|timeout/i.test(trimmed)) {
    return "Upload failed: network or server timeout.";
  }
  return trimmed.length > 90 ? `${trimmed.slice(0, 90)}...` : trimmed;
}

function getUploadFailureMessageFromJob(job: UploadJobRecord) {
  const code = String(job.errorCode || job.error_code || "").trim().toUpperCase();
  const rawMessage = String(job.errorMessage || job.error_message || "").trim();

  if (code === "UPLOAD_PROVIDER_NOT_CONFIGURED") {
    return "This source type requires premium model setup. Please upgrade or try another source.";
  }
  if (code === "UPLOAD_NETWORK_FAILURE") {
    return "Upload failed due to a network issue. Please retry.";
  }
  if (code === "UPLOAD_WORKER_TIMEOUT") {
    return "Upload timed out during extraction. Please retry.";
  }
  if (code === "UPLOAD_INPUT_TOO_LARGE") {
    return "Upload failed: the source is too large to process.";
  }
  if (code === "UPLOAD_INPUT_INVALID") {
    return "Upload failed: source input is invalid. Please check and retry.";
  }
  if (code === "UPLOAD_SOURCE_FETCH_4XX") {
    return "Upload failed: source link is not accessible. Please verify the URL.";
  }

  const fallback = cleanUploadErrorMessage(rawMessage || "Upload failed.");
  return code ? `${fallback} (${code})` : fallback;
}

function hasFilesInDataTransfer(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) {
    return false;
  }
  if (dataTransfer.files && dataTransfer.files.length > 0) {
    return true;
  }
  return Array.from(dataTransfer.types ?? []).includes("Files");
}

const projectTitleEnMap: Record<string, string> = {
  "火山喷发过程科普 PPT": "Volcanic Eruption Explainer PPT",
  "潮汐原理可视化长图": "Tide Mechanism Visual Poster",
  "DNA 复制流程演示": "DNA Replication Process",
  "行星运动与万有引力可视化课程": "Planetary Motion & Gravity Course",
  "细胞分裂全过程课堂 PPT": "Cell Division Classroom PPT",
  "货币通胀机制图解短视频": "Inflation Mechanism Short Video",
  "地震波传播与板块运动长图": "Seismic Waves & Plate Tectonics Poster",
};

function formatRecentProjectTitle(title: string, locale: "en" | "zh", index: number) {
  if (locale !== "en") {
    return title;
  }
  const mapped = projectTitleEnMap[title];
  if (mapped) {
    return mapped;
  }
  const hasCjk = /[\u3400-\u9fff]/.test(title);
  if (hasCjk) {
    return `Visual Knowledge Project ${index + 1}`;
  }
  return title;
}

const supportedUploadAccept = [
  "image/*",
  ".pdf",
  ".doc",
  ".docx",
  ".rtf",
  ".epub",
  ".ppt",
  ".pptx",
  ".key",
  ".xls",
  ".xlsx",
  ".csv",
  ".tsv",
  ".json",
  ".xml",
  ".txt",
  ".md",
  ".srt",
  ".vtt",
].join(",");

const FREE_MODEL_UPLOAD_LIMITS = {
  maxFileCount: 6,
  maxFileSizeBytes: 20 * 1024 * 1024,
  maxTotalBytes: 80 * 1024 * 1024,
};

const PREMIUM_MODEL_UPLOAD_LIMITS = {
  maxFileCount: 12,
  maxFileSizeBytes: 80 * 1024 * 1024,
  maxTotalBytes: 240 * 1024 * 1024,
};

const MAX_LINK_SOURCE_COUNT = 1;
const MAX_COMPOSE_TEXT_CHARS = 6000;
const LINK_UPLOAD_TEMP_DISABLED = true;
const SHOW_FILE_UPLOAD_ENTRY = false;

const MIN_COMPOSER_HEIGHT = 132;
const MAX_COMPOSER_HEIGHT = 260;
const DEFAULT_COVER_FALLBACK = "/picture/text-to-poster.png";
const ENABLE_IMAGE_DEBUG = process.env.NEXT_PUBLIC_DEBUG_IMAGE_LOAD === "true";
const HOME_DRAFT_KEY = "knowlens-home-draft";
const HOME_TEXT_MODEL_KEY = "knowlens-home-text-model-v1";
const GENERATE_INTENT_KEY = "knowlens:generate-intent";
const GENERATE_INTENT_TTL_MS = 15 * 60 * 1000;
const MEMBERSHIP_SOURCE_KEY = "knowlens:membership-source";
const WORKSPACE_START_TIMEOUT_MS = 10_000;
const loadedImageCache = new Set<string>();

function normalizeDraftSourceKind(kind: string | undefined): SourceKind {
  if (kind === "youtube" || kind === "podcast" || kind === "web") {
    return kind;
  }
  return "file";
}

function mapWorkspaceStartErrorMessage(code: string | undefined, fallback: string | undefined) {
  if (code === "WORKSPACE_START_EMPTY_INPUT") {
    return "Enter your topic or attach at least one source to continue.";
  }
  if (code === "WORKSPACE_START_AUTH_REQUIRED") {
    return "Please sign in to continue.";
  }
  if (code === "WORKSPACE_START_DAILY_LIMIT") {
    return "You reached today's project-start limit. Continue from existing projects or try again tomorrow.";
  }
  if (code === "WORKSPACE_START_RATE_LIMIT") {
    return "You're creating projects too quickly. Please wait a moment and retry.";
  }
  if (code === "WORKSPACE_START_FORBIDDEN_ORIGIN") {
    return "Request verification failed. Please refresh and try again.";
  }
  return fallback || "Unable to start a new project right now. Please try again later.";
}

function trackAppEvent(eventName: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag === "function") {
      gtag("event", eventName, params);
    }
  } catch {
    // analytics should never interrupt product flow
  }
}

function trackAppTelemetryEvent(input: {
  category: string;
  action: string;
  source?: string;
  message?: string;
  details?: Record<string, unknown>;
}) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    void fetch("/api/telemetry/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: input.category,
        action: input.action,
        status: "info",
        source: input.source ?? "home",
        message: input.message,
        details: input.details,
      }),
      keepalive: true,
    });
  } catch {
    // analytics should never interrupt product flow
  }
}

function shouldRetryWorkspaceStart(error: unknown) {
  if (!(error instanceof Error)) {
    return true;
  }
  const message = (error.message || "").toLowerCase();
  if (!message) {
    return true;
  }
  if (message.includes("abort") || message.includes("timeout")) {
    return true;
  }
  if (message.includes("network") || message.includes("failed to fetch") || message.includes("load failed")) {
    return true;
  }
  return false;
}

type ProgressiveCoverProps = {
  src: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
};

function ProgressiveCover({
  src,
  fallbackSrc,
  alt,
  className = "h-full w-full object-cover",
  loading = "lazy",
}: ProgressiveCoverProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [loaded, setLoaded] = useState(() => loadedImageCache.has(src));
  const [attemptedFallback, setAttemptedFallback] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setImgSrc(src);
    setAttemptedFallback(false);
    setLoaded(loadedImageCache.has(src));
  }, [src]);

  useEffect(() => {
    const img = imageRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      loadedImageCache.add(imgSrc);
      setLoaded(true);
    }
  }, [imgSrc]);

  return (
    <div className="relative h-full w-full">
      <div
        className={`absolute inset-0 transition-opacity ${
          loaded ? "opacity-0" : "skeleton-shimmer opacity-100"
        }`}
      />
      <img
        src={imgSrc}
        alt={alt}
        loading={loading}
        decoding="async"
        ref={imageRef}
        onLoad={() => {
          loadedImageCache.add(imgSrc);
          setLoaded(true);
        }}
        onError={() => {
          if (fallbackSrc && !attemptedFallback && imgSrc !== fallbackSrc) {
            if (ENABLE_IMAGE_DEBUG) {
              console.error("[ImageDebug][app] optimized cover failed, fallback enabled", {
                src,
                fallbackSrc,
                currentSrc: imgSrc,
                alt,
                page: typeof window !== "undefined" ? window.location.pathname : "",
              });
            }
            setImgSrc(fallbackSrc);
            setAttemptedFallback(true);
            setLoaded(false);
            return;
          }
          if (imgSrc !== DEFAULT_COVER_FALLBACK) {
            if (ENABLE_IMAGE_DEBUG) {
              console.error("[ImageDebug][app] fallback cover failed, use default cover", {
                src,
                fallbackSrc,
                currentSrc: imgSrc,
                defaultFallback: DEFAULT_COVER_FALLBACK,
                alt,
                page: typeof window !== "undefined" ? window.location.pathname : "",
              });
            }
            setImgSrc(DEFAULT_COVER_FALLBACK);
            setLoaded(false);
            return;
          }
          if (ENABLE_IMAGE_DEBUG) {
            console.error("[ImageDebug][app] default cover failed", {
              src,
              fallbackSrc,
              currentSrc: imgSrc,
              alt,
              page: typeof window !== "undefined" ? window.location.pathname : "",
            });
          }
          setLoaded(true);
        }}
        className={`${className} transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

function toOptimizedCaseCover(path: string) {
  if (!path || path.startsWith("/api/") || /^https?:\/\//i.test(path)) {
    return path;
  }
  return `/app-optimized${path}`;
}

function guessLinkKind(url: URL): SourceKind {
  const host = url.hostname.replace("www.", "");
  if (host.includes("youtube.com") || host.includes("youtu.be")) {
    return "youtube";
  }
  if (isPodcastLink(url)) {
    return "podcast";
  }
  return "web";
}

function hasValidYoutubeVideoId(url: URL) {
  const host = url.hostname.replace("www.", "");
  if (host.includes("youtu.be")) {
    const id = url.pathname.replace("/", "").trim();
    return id.length >= 6;
  }
  if (host.includes("youtube.com")) {
    const videoId = url.searchParams.get("v")?.trim() ?? "";
    return videoId.length >= 6;
  }
  return false;
}

function parseHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function isPodcastLink(url: URL) {
  const host = url.hostname.replace("www.", "").toLowerCase();
  const path = url.pathname.toLowerCase();

  if (
    host.includes("podcasts.apple.com") ||
    host.includes("open.spotify.com") ||
    host.includes("anchor.fm") ||
    host.includes("castbox.fm") ||
    host.includes("overcast.fm") ||
    host.includes("pocketcasts.com") ||
    host.includes("xiaoyuzhoufm.com") ||
    host.includes("music.163.com")
  ) {
    return true;
  }

  if (host.includes("podcast") || path.includes("/podcast")) {
    return true;
  }

  return /\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(path);
}

function isMediaFile(file: File) {
  if (file.type.startsWith("audio/") || file.type.startsWith("video/")) {
    return true;
  }
  return /\.(mp4|mov|avi|mkv|mp3|wav|m4a|flac|aac|ogg)$/i.test(file.name.toLowerCase());
}

function isSupportedFileUpload(file: File) {
  const mime = (file.type || "").toLowerCase();
  const lowerName = file.name.toLowerCase();
  if (mime.startsWith("image/") || mime.startsWith("text/")) {
    return true;
  }
  return /\.(pdf|doc|docx|rtf|epub|ppt|pptx|key|xls|xlsx|csv|tsv|json|xml|txt|md|srt|vtt)$/i.test(
    lowerName,
  );
}

function isPremiumTextModel(modelValue: string) {
  return textModelOptions.some((option) => option.value === modelValue && option.premium);
}

function sourceItemNeedsPremium(item: SourceItem) {
  if (item.kind === "youtube" || item.kind === "podcast") {
    return true;
  }
  if (item.kind === "file") {
    return /\.(mp4|mov|avi|mkv|mp3|wav|m4a|flac|aac|ogg)$/i.test(item.origin.toLowerCase());
  }
  return false;
}

async function extractFromFile(file: File) {
  const lowerName = file.name.toLowerCase();
  const canReadText =
    file.type.startsWith("text/") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".csv");

  if (canReadText) {
    const rawText = await file.text();
    const cleaned = rawText.replace(/\s+/g, " ").trim();
    if (cleaned.length > 180) {
      return `${cleaned.slice(0, 180)}...`;
    }
    return cleaned || "The extracted text is short. Parsing completed.";
  }

  if (file.type.startsWith("image/")) {
    return `Image source detected: "${file.name}". It can be used for visual explanation and prompt generation.`;
  }

  if (file.type.startsWith("video/") || file.type.startsWith("audio/")) {
    return `Audio/video source detected: "${file.name}". Transcript draft extracted and ready for scripting.`;
  }

  return `Document detected: "${file.name}". Outline and key paragraphs extracted for visual generation.`;
}

type UploadJobRecord = {
  id: string;
  file_name?: string;
  fileName?: string;
  mime_type?: string;
  mimeType?: string;
  source_kind?: SourceKind;
  sourceKind?: SourceKind;
  source_url?: string | null;
  sourceUrl?: string | null;
  status?: SourceItem["status"];
  progress?: number;
  error_message?: string | null;
  errorMessage?: string | null;
  error_code?: string | null;
  errorCode?: string | null;
  result_excerpt?: string | null;
  resultExcerpt?: string | null;
  result_text?: string | null;
  resultText?: string | null;
  result_kind?: string | null;
  resultKind?: string | null;
  public_url?: string | null;
  publicUrl?: string | null;
  storage_key?: string | null;
  storageKey?: string | null;
  created_at?: string;
  createdAt?: string;
};

function normalizeUploadJobStatus(status: string | undefined): SourceItem["status"] {
  if (status === "done") {
    return "ready";
  }
  if (status === "failed") {
    return "failed";
  }
  if (status === "processing") {
    return "processing";
  }
  if (status === "queued") {
    return "queued";
  }
  return "extracting";
}

type PublicCaseApiItem = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  category?: string;
  outputType?: string;
  authorLabel?: string;
  coverUrl?: string;
  sortOrder?: number;
  updatedAt?: string;
  publishedAt?: string;
  assets?: Array<{
    id: string;
    slug: string;
    title?: string;
    description?: string;
    pageIndex?: number;
    fileUrl: string;
    viewerUrl: string;
    downloadUrl?: string;
    thumbnailUrl?: string;
    mimeType?: string;
    width?: number | null;
    height?: number | null;
  }>;
};

function normalizeShowcaseCategory(category?: string) {
  const normalized = normalizeCategoryLabel((category || DEFAULT_SHOWCASE_CATEGORY).trim());
  const lower = normalized.toLowerCase();

  if (
    lower === "economics" ||
    lower.includes("financial report") ||
    lower.includes("market report") ||
    lower.includes("earnings")
  ) {
    return "Financial Report";
  }
  if (lower === "geography" || lower.includes("earth science")) {
    return "Earth Science";
  }
  if (lower.includes("recipe")) {
    return "Recipe";
  }
  if (lower.includes("process")) {
    return "Process";
  }
  if (lower.includes("biology")) {
    return "Biology";
  }
  if (lower.includes("history")) {
    return "History";
  }
  if (lower.includes("astronomy")) {
    return "Astronomy";
  }
  if (lower.includes("medicine")) {
    return "Medicine";
  }
  return normalized || DEFAULT_SHOWCASE_CATEGORY;
}

function getShowcaseSearchText(item: FeaturedCaseItem) {
  return `${item.title} ${item.description || ""} ${item.publicCaseSlug || ""}`.toLowerCase();
}

function getStructuralShowcaseCategories(item: FeaturedCaseItem) {
  const searchText = getShowcaseSearchText(item);
  const nextCategories: string[] = [];

  if (/\btimeline\b|\bchronology\b|over time|historical phases/.test(searchText)) {
    nextCategories.push("Timeline");
  }
  if (/\bcomparison\b|\bcompare\b|\bversus\b|\bvs\b/.test(searchText)) {
    nextCategories.push("Comparison");
  }
  if (/\broadmap\b|\bmilestone\b|\bquarterly plan\b/.test(searchText)) {
    nextCategories.push("Roadmap");
  }

  return nextCategories;
}

function itemMatchesShowcaseCategory(item: FeaturedCaseItem, category: string) {
  if (category === DEFAULT_SHOWCASE_CATEGORY) {
    return true;
  }
  if (normalizeShowcaseCategory(item.category) === category) {
    return true;
  }
  return getStructuralShowcaseCategories(item).includes(category);
}

type ServerProjectSummary = {
  id: string;
  title: string;
  status?: string;
  format?: string;
  duration?: string;
  updatedAt?: string;
  cover?: string;
  coverImageUrl?: string;
};

function formatPublicCaseOutputType(outputType?: string): FeaturedCaseItem["format"] {
  if (outputType === "ppt") {
    return "PPT";
  }
  if (outputType === "video") {
    return "Video";
  }
  return "Poster";
}

function isPublicCaseVideoAsset(asset: NonNullable<PublicCaseApiItem["assets"]>[number]) {
  const mimeType = (asset.mimeType || "").toLowerCase();
  return (
    mimeType.startsWith("video/") ||
    /\.mp4(?:$|\?)/i.test(asset.fileUrl) ||
    /\.mp4(?:$|\?)/i.test(asset.downloadUrl || "")
  );
}

function getPublicCaseAssetSize(asset?: { width?: number | null; height?: number | null }) {
  const width = Number(asset?.width || 0);
  const height = Number(asset?.height || 0);
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return { coverWidth: width, coverHeight: height };
  }
  return null;
}

function estimatePublicCaseCoverSize(item: PublicCaseApiItem) {
  const videoAsset = item.assets?.find(isPublicCaseVideoAsset);
  const videoSize = getPublicCaseAssetSize(videoAsset);
  if (videoSize) {
    return videoSize;
  }
  if (item.outputType === "ppt" || item.outputType === "video") {
    return { coverWidth: 1600, coverHeight: 900 };
  }
  return { coverWidth: 941, coverHeight: 1672 };
}

function mapPublicCaseToFeatured(item: PublicCaseApiItem, index: number): FeaturedCaseItem | null {
  const cover = item.coverUrl || item.assets?.[0]?.thumbnailUrl || item.assets?.[0]?.fileUrl || "";
  if (!cover) {
    return null;
  }
  const size = estimatePublicCaseCoverSize(item);
  return {
    id: `public-${item.id}`,
    projectId: item.id,
    title: item.title || "Published KnowLens Case",
    description: item.description || "",
    author: item.authorLabel || "KnowLens",
    views: 0,
    likes: 0,
    cover,
    coverWidth: size.coverWidth,
    coverHeight: size.coverHeight,
    format: formatPublicCaseOutputType(item.outputType),
    category: item.category || "All",
    order: item.sortOrder ?? index + 1,
    publicCaseSlug: item.slug,
    assets: (item.assets || []).map((asset) => ({
      id: asset.id,
      slug: asset.slug,
      title: asset.title || item.title,
      description: asset.description || "",
      pageIndex: asset.pageIndex,
      fileUrl: asset.fileUrl,
      viewerUrl: asset.viewerUrl,
      downloadUrl: asset.downloadUrl || asset.fileUrl,
      thumbnailUrl: asset.thumbnailUrl || asset.fileUrl,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
    })),
  };
}

type FeaturedPreviewAsset = NonNullable<FeaturedCaseItem["assets"]>[number];

function isVideoPreviewAsset(asset: FeaturedPreviewAsset | null | undefined) {
  const mimeType = (asset?.mimeType || "").toLowerCase();
  const fileUrl = asset?.fileUrl || "";
  const downloadUrl = asset?.downloadUrl || "";
  return mimeType.startsWith("video/") || /\.mp4(?:$|\?)/i.test(fileUrl) || /\.mp4(?:$|\?)/i.test(downloadUrl);
}

function isPptDeckPreviewAsset(asset: FeaturedPreviewAsset | null | undefined) {
  const mimeType = (asset?.mimeType || "").toLowerCase();
  const fileUrl = asset?.fileUrl || "";
  const downloadUrl = asset?.downloadUrl || "";
  return (
    mimeType.includes("presentation") ||
    mimeType.includes("powerpoint") ||
    /\.pptx?(?:$|\?)/i.test(fileUrl) ||
    /\.pptx?(?:$|\?)/i.test(downloadUrl)
  );
}

function isImagePreviewAsset(asset: FeaturedPreviewAsset | null | undefined) {
  return Boolean(asset) && !isVideoPreviewAsset(asset) && !isPptDeckPreviewAsset(asset);
}

function getPreviewAssetsForItem(item: FeaturedCaseItem | null): FeaturedPreviewAsset[] {
  if (!item) {
    return [];
  }
  const allAssets = item.assets?.length
    ? item.assets
    : [
        {
          id: item.id,
          slug: item.id,
          title: item.title,
          description: item.description || "",
          fileUrl: item.cover,
          viewerUrl: getFeaturedDetailPath(item),
          downloadUrl: item.cover,
          thumbnailUrl: item.cover,
          mimeType: "image/png",
        },
      ];
  const format = normalizeFormatLabel(item.format);
  if (format === "Video") {
    const videoAssets = allAssets.filter(isVideoPreviewAsset);
    if (videoAssets.length) {
      return videoAssets;
    }
    const imageAssets = allAssets.filter(isImagePreviewAsset);
    return imageAssets.length ? imageAssets : allAssets;
  }
  if (format === "PPT") {
    const imageAssets = allAssets.filter(isImagePreviewAsset);
    return imageAssets.length ? imageAssets : allAssets;
  }
  const imageAssets = allAssets.filter(isImagePreviewAsset);
  return imageAssets.length ? imageAssets : allAssets;
}

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status: sessionStatus } = useSession();
  const { locale, t } = useLocale();
  const currentEmail = session?.user?.email?.trim().toLowerCase() ?? "";
  const [textModel, setTextModel] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<"text" | null>(null);
  const [textMenuOpenUp, setTextMenuOpenUp] = useState(true);
  const [textMenuMaxHeight, setTextMenuMaxHeight] = useState(360);
  const [composeInput, setComposeInput] = useState("");
  const [visiblePromptCards, setVisiblePromptCards] = useState<PromptSuggestionCard[]>([]);
  const [serverRecentProjects, setServerRecentProjects] = useState<ServerProjectSummary[]>([]);
  const [linkInputOpen, setLinkInputOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState("");
  const [modelPaywallOpen, setModelPaywallOpen] = useState(false);
  const [mediaUploadPaywallOpen, setMediaUploadPaywallOpen] = useState(false);
  const hasMembership = useMemo(() => {
    const subscription = getSubscriptionByUser(currentEmail);
    return !!subscription && (subscription.status === "active" || subscription.status === "canceling");
  }, [currentEmail]);
  const [creditVersion, setCreditVersion] = useState(0);
  const currentCredits = useMemo(() => {
    void creditVersion;
    return getCreditRecords(currentEmail)[0]?.balance ?? 80;
  }, [currentEmail, creditVersion]);
  useEffect(() => {
    trackAppEvent("home_step1_view", {
      from: "home",
      step_number: 1,
      locale,
    });
    trackAppTelemetryEvent({
      category: "image",
      action: "ui.step1.view",
      source: "home",
      message: "Home creation input step viewed.",
      details: {
        stepNumber: 1,
        flowStage: "home_input",
        locale,
      },
    });
  }, [locale]);
  useEffect(() => {
    if (!currentEmail) {
      setServerRecentProjects([]);
      return;
    }
    let isCancelled = false;
    syncCreditRecordsFromServer(currentEmail)
      .then(() => {
        if (!isCancelled) {
          setCreditVersion((prev) => prev + 1);
        }
      })
      .catch(() => {
        // Keep the cached local balance if server sync is unavailable.
      });
    return () => {
      isCancelled = true;
    };
  }, [currentEmail]);
  useEffect(() => {
    if (!currentEmail) {
      setServerRecentProjects([]);
      return;
    }
    let isCancelled = false;
    fetch("/api/projects?summary=1&limit=4", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Failed to load projects."))))
      .then((payload: { projects?: ServerProjectSummary[] }) => {
        if (!isCancelled) {
          setServerRecentProjects(Array.isArray(payload.projects) ? payload.projects : []);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setServerRecentProjects([]);
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [currentEmail]);
  const [sourceItems, setSourceItems] = useState<SourceItem[]>([]);
  const [activeCategory, setActiveCategory] = useState(DEFAULT_SHOWCASE_CATEGORY);
  const [fallbackFeaturedItems] = useState<FeaturedCaseItem[]>(() => getResolvedFeaturedCases());
  const [publishedFeaturedItems, setPublishedFeaturedItems] = useState<FeaturedCaseItem[]>([]);
  const [featuredVisibleCount, setFeaturedVisibleCount] = useState(FEATURED_CASE_BATCH_SIZE);
  const [isFeaturedLoadingMore, setIsFeaturedLoadingMore] = useState(false);
  const [uploadToast, setUploadToast] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<FeaturedCaseItem | null>(null);
  const [previewAssetIndex, setPreviewAssetIndex] = useState(0);
  const [previewPaywallOpen, setPreviewPaywallOpen] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewImageLoaded, setPreviewImageLoaded] = useState(false);
  const [uploadJobs, setUploadJobs] = useState<Record<string, UploadJobRecord>>({});
  const [isStartingWorkspace, setIsStartingWorkspace] = useState(false);
  const [isDragOverPage, setIsDragOverPage] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [, setMetricVersion] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const menuLayerRef = useRef<HTMLDivElement | null>(null);
  const composeRef = useRef<HTMLTextAreaElement | null>(null);
  const textModelButtonRef = useRef<HTMLButtonElement | null>(null);
  const featuredLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const featuredLoadMoreTimerRef = useRef<number | null>(null);
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const composeLimitToastShownRef = useRef(false);
  const dragDepthRef = useRef(0);
  const notifiedUploadFailureIdsRef = useRef<Set<string>>(new Set());
  const autoGenerateOnceRef = useRef(false);
  const hydratedHomeDraftRef = useRef(false);
  useEffect(() => {
    const storedTextModel = readStoredHomeTextModel(currentEmail);
    if (storedTextModel) {
      setTextModel(storedTextModel);
    }
  }, [currentEmail]);
  useEffect(() => {
    writeStoredHomeTextModel(textModel, currentEmail);
  }, [currentEmail, textModel]);
  useEffect(() => {
    setVisiblePromptCards(selectPromptSuggestionCards());
  }, []);
  useEffect(() => {
    let isCancelled = false;
    let timeoutId: number | undefined;
    let idleId: number | undefined;

    const loadPublishedCases = () => {
      fetch("/api/public/cases?summary=1&limit=48")
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Failed to load cases."))))
        .then((payload: { cases?: PublicCaseApiItem[] }) => {
          if (isCancelled) {
            return;
          }
          const nextItems = (payload.cases || [])
            .map((item, index) => mapPublicCaseToFeatured(item, index))
            .filter(Boolean) as FeaturedCaseItem[];
          setPublishedFeaturedItems(nextItems);
        })
        .catch(() => {
          if (!isCancelled) {
            setPublishedFeaturedItems([]);
          }
        });
    };

    const idleWindow = window as unknown as {
      requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (idleWindow.requestIdleCallback && idleWindow.cancelIdleCallback) {
      idleId = idleWindow.requestIdleCallback(loadPublishedCases, { timeout: 1600 });
    } else {
      timeoutId = window.setTimeout(loadPublishedCases, 900);
    }

    return () => {
      isCancelled = true;
      if (idleId !== undefined && idleWindow.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);
  const activeUploadJobIdsKey = useMemo(
    () =>
      sourceItems
        .filter((item) => item.jobId && item.status !== "ready" && item.status !== "failed")
        .map((item) => item.jobId as string)
        .sort()
        .join(","),
    [sourceItems],
  );
  useEffect(() => {
    if (!currentEmail) {
      return;
    }
    const notice = consumeCheckoutReturnNotice();
    if (!notice) {
      return;
    }
    setModelPaywallOpen(false);
    setMediaUploadPaywallOpen(false);
    setPreviewPaywallOpen(false);
    void syncCreditRecordsFromServer(currentEmail)
      .then(() => {
        setCreditVersion((prev) => prev + 1);
      })
      .catch(() => undefined);
    setUploadToast(notice.message);
  }, [currentEmail]);

  const resolvedTextModel = textModel ?? defaultFreeModelByLocale(locale);
  const isPremiumModelSelected = hasMembership && isPremiumTextModel(resolvedTextModel);
  const uploadLimits = isPremiumModelSelected
    ? PREMIUM_MODEL_UPLOAD_LIMITS
    : FREE_MODEL_UPLOAD_LIMITS;
  const linkSourceCount = sourceItems.filter((item) => item.kind !== "file").length;
  const hasLinkSource = linkSourceCount >= MAX_LINK_SOURCE_COUNT;
  const fileSourceCount = sourceItems.filter((item) => item.kind === "file").length;
  const fileSourceBytes = sourceItems
    .filter((item) => item.kind === "file")
    .reduce((sum, item) => sum + (item.sizeBytes ?? 0), 0);
  const selectedTextModel =
    textModelOptions.find((item) => item.value === resolvedTextModel) ?? textModelOptions[0];
  const featuredItems = useMemo(() => {
    if (!publishedFeaturedItems.length) {
      return fallbackFeaturedItems;
    }
    const seenKeys = new Set(publishedFeaturedItems.map((item) => item.publicCaseSlug || item.id));
    return [
      ...publishedFeaturedItems,
      ...fallbackFeaturedItems.filter((item) => !seenKeys.has(item.publicCaseSlug || item.id)),
    ];
  }, [fallbackFeaturedItems, publishedFeaturedItems]);
  const showcaseCategories = useMemo(() => {
    const detectedCategories = new Set<string>();

    featuredItems.forEach((item) => {
      detectedCategories.add(normalizeShowcaseCategory(item.category));
      getStructuralShowcaseCategories(item).forEach((category) => detectedCategories.add(category));
    });

    const orderedSupported = SUPPORTED_SHOWCASE_CATEGORIES.filter((category) => detectedCategories.has(category));
    const additionalDetected = Array.from(detectedCategories).filter(
      (category) =>
        category !== DEFAULT_SHOWCASE_CATEGORY && !SUPPORTED_SHOWCASE_CATEGORIES.includes(category),
    );

    return [DEFAULT_SHOWCASE_CATEGORY, ...orderedSupported, ...additionalDetected.sort()];
  }, [featuredItems]);
  useEffect(() => {
    if (!showcaseCategories.includes(activeCategory)) {
      setActiveCategory(DEFAULT_SHOWCASE_CATEGORY);
    }
  }, [activeCategory, showcaseCategories]);
  const previewAssets = useMemo(() => getPreviewAssetsForItem(previewItem), [previewItem]);
  const activePreviewAsset =
    previewAssets[Math.min(previewAssetIndex, Math.max(0, previewAssets.length - 1))] ?? null;
  const activePreviewIsVideo = isVideoPreviewAsset(activePreviewAsset);
  const activePreviewIsPptDeck = isPptDeckPreviewAsset(activePreviewAsset);
  const activePreviewIsImage = isImagePreviewAsset(activePreviewAsset);
  const previewFormat = previewItem ? normalizeFormatLabel(previewItem.format) : "Poster";

  useEffect(() => {
    if (!previewItem || previewFormat !== "PPT" || !previewAssets.length || typeof window === "undefined") {
      return undefined;
    }
    const urls = previewAssets
      .filter(isImagePreviewAsset)
      .map((asset) => asset.fileUrl)
      .filter(Boolean);
    if (!urls.length) {
      return undefined;
    }
    const preloadImages = () => {
      urls.forEach((url) => {
        const image = new Image();
        image.decoding = "async";
        image.src = url;
      });
    };
    const idleWindow = window as unknown as {
      requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const requestIdle = idleWindow.requestIdleCallback?.bind(window);
    const cancelIdle = idleWindow.cancelIdleCallback?.bind(window);
    if (requestIdle && cancelIdle) {
      const idleId = requestIdle(preloadImages, { timeout: 800 });
      return () => cancelIdle(idleId);
    }
    const timer = globalThis.setTimeout(preloadImages, 120);
    return () => globalThis.clearTimeout(timer);
  }, [previewAssets, previewFormat, previewItem]);

  function updateComposeInput(nextRawValue: string) {
    if (nextRawValue.length <= MAX_COMPOSE_TEXT_CHARS) {
      composeLimitToastShownRef.current = false;
      setComposeInput(nextRawValue);
      return;
    }
    const trimmedValue = nextRawValue.slice(0, MAX_COMPOSE_TEXT_CHARS);
    setComposeInput(trimmedValue);
    if (!composeLimitToastShownRef.current) {
      setUploadToast(`Input limit reached (${MAX_COMPOSE_TEXT_CHARS} characters max).`);
      composeLimitToastShownRef.current = true;
    }
  }

  useEffect(() => {
    if (typeof window === "undefined" || hydratedHomeDraftRef.current) {
      return;
    }
    hydratedHomeDraftRef.current = true;
    if (composeInput.trim() || sourceItems.length > 0) {
      return;
    }
    try {
      const promptFromQuery = new URLSearchParams(window.location.search).get("prompt")?.trim() ?? "";
      if (promptFromQuery) {
        setComposeInput(promptFromQuery.slice(0, MAX_COMPOSE_TEXT_CHARS));
        return;
      }
      const raw = window.sessionStorage.getItem(HOME_DRAFT_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as HomeDraftPayload;
      const normalizedPrompt = String(parsed.prompt || "");
      const normalizedTextModel = String(parsed.textModel || "").trim();
      const normalizedSources: SourceItem[] = Array.isArray(parsed.sources)
        ? parsed.sources
            .filter((item): item is Partial<SourceItem> => Boolean(item && typeof item === "object"))
            .map((item, idx) => {
              const status: SourceItem["status"] = item.status === "ready" ? "ready" : "failed";
              return {
                id: item.id || `cached-${idx}-${Date.now()}`,
                kind: normalizeDraftSourceKind(item.kind),
                name: String(item.name || "Source"),
                origin: String(item.origin || ""),
                mimeType: item.mimeType ? String(item.mimeType) : undefined,
                sizeBytes: typeof item.sizeBytes === "number" ? item.sizeBytes : undefined,
                status,
                progress: status === "ready" ? 100 : 0,
                excerpt: String(item.excerpt || ""),
                contentText: item.contentText ? String(item.contentText) : undefined,
              };
            })
            .filter((item) => item.status === "ready")
            .slice(0, 30)
        : [];
      if (normalizedPrompt) {
        setComposeInput(normalizedPrompt.slice(0, MAX_COMPOSE_TEXT_CHARS));
      }
      if (normalizedTextModel) {
        const hasModel = textModelOptions.some((option) => option.value === normalizedTextModel);
        if (hasModel) {
          setTextModel(normalizedTextModel);
        }
      }
      if (normalizedSources.length) {
        setSourceItems((prev) => {
          if (prev.length > 0) {
            return prev;
          }
          return normalizedSources;
        });
      }
    } catch {
      // ignore broken cached payload
    }
  }, [composeInput, sourceItems.length]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuLayerRef.current) {
        return;
      }
      if (!menuLayerRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
        setLinkInputOpen(false);
        setLinkError("");
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!uploadToast) {
      return;
    }
    const timer = window.setTimeout(() => setUploadToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [uploadToast]);

  useEffect(() => {
    function preventBrowserOpenOnDrop(event: globalThis.DragEvent) {
      if (!hasFilesInDataTransfer(event.dataTransfer)) {
        return;
      }
      event.preventDefault();
    }

    window.addEventListener("dragover", preventBrowserOpenOnDrop);
    window.addEventListener("drop", preventBrowserOpenOnDrop);
    return () => {
      window.removeEventListener("dragover", preventBrowserOpenOnDrop);
      window.removeEventListener("drop", preventBrowserOpenOnDrop);
    };
  }, []);

  useEffect(() => {
    const node = composeRef.current;
    if (!node) {
      return;
    }
    node.style.height = `${MIN_COMPOSER_HEIGHT}px`;
    const nextHeight = Math.min(node.scrollHeight, MAX_COMPOSER_HEIGHT);
    node.style.height = `${Math.max(nextHeight, MIN_COMPOSER_HEIGHT)}px`;
    node.style.overflowY = node.scrollHeight > MAX_COMPOSER_HEIGHT ? "auto" : "hidden";
  }, [composeInput]);

  useEffect(() => {
    if (!activeUploadJobIdsKey) {
      setUploadJobs({});
      return;
    }
    let isActive = true;
    let timer: number | undefined;
    let retryDelayMs = 2500;
    let consecutiveFailures = 0;

    async function syncJobs() {
      try {
        const url = currentEmail
          ? `/api/upload/jobs?userEmail=${encodeURIComponent(currentEmail)}`
          : "/api/upload/jobs";
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) {
          consecutiveFailures += 1;
          retryDelayMs = Math.min(15000, 2500 * Math.min(consecutiveFailures + 1, 6));
          return;
        }
        const data = (await response.json()) as { jobs?: UploadJobRecord[] };
        if (!isActive || !Array.isArray(data.jobs)) {
          return;
        }
        consecutiveFailures = 0;
        retryDelayMs = 2500;
        const nextJobs = Object.fromEntries(data.jobs.map((job) => [job.id, job]));
        setUploadJobs(nextJobs);
        setSourceItems((prev) =>
          prev.reduce<SourceItem[]>((acc, item) => {
            if (!item.jobId) {
              acc.push(item);
              return acc;
            }
            const job = nextJobs[item.jobId];
            if (!job) {
              acc.push(item);
              return acc;
            }
            const status = normalizeUploadJobStatus(job.status);
            const resultText = String(job.resultText || job.result_text || "").trim();
            const resultExcerpt = String(job.resultExcerpt || job.result_excerpt || "").trim();
            const nextProgress =
              typeof job.progress === "number" && Number.isFinite(job.progress)
                ? Math.max(0, Math.min(Math.round(job.progress), 100))
                : item.progress;
            const nextItem = {
              ...item,
              status,
              progress: status === "ready" ? 100 : status === "failed" ? 0 : nextProgress,
              excerpt:
                job.errorMessage ||
                job.error_message ||
                resultExcerpt ||
                (resultText ? `${resultText.slice(0, 180)}${resultText.length > 180 ? "..." : ""}` : "") ||
                item.excerpt,
              contentText: resultText || item.contentText,
            };
            if (status === "failed") {
              if (!notifiedUploadFailureIdsRef.current.has(job.id)) {
                notifiedUploadFailureIdsRef.current.add(job.id);
                window.setTimeout(() => {
                  setUploadToast(getUploadFailureMessageFromJob(job));
                }, 0);
              }
              acc.push(nextItem);
              return acc;
            }
            acc.push(nextItem);
            return acc;
          }, []),
        );
      } catch {
        consecutiveFailures += 1;
        retryDelayMs = Math.min(15000, 2500 * Math.min(consecutiveFailures + 1, 6));
      }
    }

    const scheduleNext = () => {
      if (!isActive) {
        return;
      }
      timer = window.setTimeout(async () => {
        await syncJobs();
        scheduleNext();
      }, retryDelayMs);
    };

    void syncJobs().finally(() => {
      scheduleNext();
    });
    return () => {
      isActive = false;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [activeUploadJobIdsKey, currentEmail]);

  async function enqueueSelectedFiles(selectedFiles: File[]) {
    const blockedMediaFiles = selectedFiles.filter((file) => isMediaFile(file));
    if (blockedMediaFiles.length) {
      setUploadToast("Video/audio uploads are temporarily disabled. Please upload images or documents.");
    }

    const unsupportedFiles = selectedFiles.filter((file) => !isSupportedFileUpload(file));
    if (unsupportedFiles.length > blockedMediaFiles.length) {
      setUploadToast("Only image and document files are supported right now.");
    }

    const allowedFiles = selectedFiles.filter((file) => isSupportedFileUpload(file));

    if (!allowedFiles.length) {
      return;
    }

    const remainingSlots = uploadLimits.maxFileCount - fileSourceCount;
    if (remainingSlots <= 0) {
      return;
    }

    const files = allowedFiles.slice(0, remainingSlots);

    const acceptedFiles: File[] = [];
    let runningTotal = fileSourceBytes;

    files.forEach((file) => {
      if (file.size > uploadLimits.maxFileSizeBytes) {
        return;
      }
      if (runningTotal + file.size > uploadLimits.maxTotalBytes) {
        return;
      }
      runningTotal += file.size;
      acceptedFiles.push(file);
    });

    if (!acceptedFiles.length) {
      return;
    }

    const items = acceptedFiles.map((file) => ({
      id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: "file" as SourceKind,
      name: file.name,
      origin: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      progress: 12,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      status: "uploading" as const,
      excerpt: "Uploading...",
    }));

    setSourceItems((prev) => [...items, ...prev]);

    for (let idx = 0; idx < acceptedFiles.length; idx += 1) {
      const file = acceptedFiles[idx];
      const currentItem = items[idx];
      setSourceItems((prev) =>
        prev.map((item) =>
          item.id === currentItem.id
            ? {
                ...item,
                status: "uploading",
                progress: 25,
                excerpt: "Uploading...",
              }
            : item,
        ),
      );
      try {
        const formData = new FormData();
        formData.append("userEmail", currentEmail);
        formData.append("fileName", file.name);
        formData.append("mimeType", file.type || "application/octet-stream");
        formData.append("fileSize", String(file.size));
        formData.append("sourceKind", "file");
        formData.append("file", file);

        const response = await fetch("/api/upload/jobs", {
          method: "POST",
          body: formData,
        });
        const data = (await response.json()) as {
          job?: { jobId?: string };
          error?: string;
        };
        if (!response.ok || !data.job?.jobId) {
          throw new Error(data.error || "Upload job failed");
        }

        const jobId = data.job.jobId;
        setSourceItems((prev) =>
          prev.map((item) =>
            item.id === currentItem.id
              ? {
                  ...item,
                  jobId,
                  status: "processing",
                  progress: 65,
                  excerpt: "Processing upload...",
                }
              : item,
          ),
        );
        setUploadJobs((prev) => ({
          ...prev,
          [jobId]: {
            id: jobId,
            status: "processing",
            progress: 0,
            file_name: file.name,
            fileName: file.name,
            mime_type: file.type,
            mimeType: file.type,
            source_kind: "file",
            sourceKind: "file",
          },
        }));
      } catch (error) {
        const message = cleanUploadErrorMessage(
          error instanceof Error ? error.message : "Upload failed",
        );
        setSourceItems((prev) =>
          prev.map((item) =>
            item.id === currentItem.id
              ? {
                  ...item,
                  status: "failed",
                  progress: 0,
                  excerpt: message,
                }
              : item,
          ),
        );
        setUploadToast(message);
      }
    }
  }

  async function handleUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    await enqueueSelectedFiles(selectedFiles);
    event.target.value = "";
  }

  function handlePageDragEnter(event: DragEvent<HTMLDivElement>) {
    if (!hasFilesInDataTransfer(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragOverPage(true);
  }

  function handlePageDragOver(event: DragEvent<HTMLDivElement>) {
    if (!hasFilesInDataTransfer(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    if (!isDragOverPage) {
      setIsDragOverPage(true);
    }
  }

  function handlePageDragLeave(event: DragEvent<HTMLDivElement>) {
    if (!hasFilesInDataTransfer(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragOverPage(false);
    }
  }

  function handlePageDrop(event: DragEvent<HTMLDivElement>) {
    if (!hasFilesInDataTransfer(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragOverPage(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (!files.length) {
      return;
    }
    void enqueueSelectedFiles(files);
  }

  async function handleSubmitLink(rawInput?: string) {
    if (LINK_UPLOAD_TEMP_DISABLED) {
      setLinkInputOpen(false);
      setLinkError("");
      setUploadToast("Link uploads are temporarily unavailable.");
      return;
    }
    const value = (rawInput ?? linkValue).trim();
    if (!value) {
      setLinkError("Please enter a webpage, YouTube, or podcast URL.");
      return;
    }
    if (hasLinkSource) {
      setLinkError("Only one link can be attached per project. Remove the current link first.");
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      setLinkError("Invalid link format. Enter a full URL including http:// or https://.");
      return;
    }

    if (!["https:", "http:"].includes(parsed.protocol)) {
      setLinkError("Only http and https links are supported.");
      return;
    }

    const kind = guessLinkKind(parsed);
    const isYoutube = kind === "youtube";
    const isTranscriptMediaLink = kind === "youtube" || kind === "podcast";

    if (!hasMembership && isTranscriptMediaLink) {
      setMediaUploadPaywallOpen(true);
      setLinkError(
        "YouTube/podcast transcript extraction requires a premium language model. Please upgrade to continue.",
      );
      return;
    }

    if (isYoutube && !hasValidYoutubeVideoId(parsed)) {
      setLinkError("The YouTube URL is missing a valid video ID. Please check and try again.");
      return;
    }

    if (!isYoutube && !parsed.hostname.includes(".")) {
      setLinkError("Incomplete domain. Please enter an accessible webpage URL.");
      return;
    }

    const itemId = `link-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const pendingItem: SourceItem = {
      id: itemId,
      kind,
      name: isYoutube ? "YouTube Video" : kind === "podcast" ? "Podcast Link" : "Web URL",
      origin: value,
      mimeType: "text/plain",
      sizeBytes: value.length,
      progress: 20,
      status: "processing",
      excerpt:
        kind === "youtube"
          ? "Processing transcript..."
          : kind === "podcast"
            ? "Processing transcript..."
            : "Processing webpage text...",
    };

    setSourceItems((prev) => [pendingItem, ...prev]);
    setLinkValue(rawInput ? linkValue : "");
    setLinkInputOpen(false);
    setLinkError("");

    try {
      const response = await fetch("/api/upload/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userEmail: currentEmail,
          fileName: pendingItem.name,
          mimeType: "text/plain",
          fileSize: value.length,
          sourceKind: kind,
          sourceUrl: value,
        }),
      });
      const data = (await response.json()) as {
        job?: { jobId?: string };
        error?: string;
      };
      const jobId = data.job?.jobId?.trim() ?? "";
      if (!response.ok || !jobId) {
        throw new Error(data.error || "Link processing failed");
      }

      setSourceItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                jobId,
                progress: 60,
                excerpt: "Processing link...",
              }
            : item,
        ),
      );
      setUploadJobs((prev) => ({
        ...prev,
        [jobId]: {
          id: jobId,
          status: "processing",
          progress: 0,
          file_name: pendingItem.name,
          fileName: pendingItem.name,
          mime_type: "text/plain",
          mimeType: "text/plain",
          source_kind: kind,
          sourceKind: kind,
          source_url: value,
          sourceUrl: value,
        },
      }));
      setUploadToast(
        kind === "youtube"
          ? "YouTube transcript job queued."
          : kind === "podcast"
            ? "Podcast transcript job queued."
            : "Webpage text job queued.",
      );
    } catch (error) {
      setSourceItems((prev) => {
        const next = prev.filter((item) => item.id !== itemId);
        const removed = prev.find((item) => item.id === itemId);
        if (removed?.previewUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(removed.previewUrl);
        }
        return next;
      });
      setUploadToast(
        cleanUploadErrorMessage(
          error instanceof Error ? error.message : "Link processing failed.",
        ),
      );
    }
  }

  function removeSourceItem(id: string) {
    setSourceItems((prev) => {
      const removed = prev.find((item) => item.id === id);
      if (removed?.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  }

  function toggleTextModelMenu() {
    if (openMenu === "text") {
      setOpenMenu(null);
      return;
    }
    const rect = textModelButtonRef.current?.getBoundingClientRect();
    const viewportHeight =
      typeof window === "undefined" ? 800 : window.innerHeight || 800;
    const spaceAbove = rect ? rect.top : viewportHeight * 0.5;
    const spaceBelow = rect ? viewportHeight - rect.bottom : viewportHeight * 0.5;
    const openUp = spaceAbove >= spaceBelow;
    const available = openUp ? spaceAbove - 16 : spaceBelow - 16;
    setTextMenuOpenUp(openUp);
    setTextMenuMaxHeight(Math.max(180, Math.min(available, 420)));
    setOpenMenu("text");
  }

  async function handleComposerPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const clipboard = event.clipboardData;
    if (!clipboard) {
      return;
    }

    const files = Array.from(clipboard.files ?? []);
    if (files.length > 0) {
      event.preventDefault();
      await enqueueSelectedFiles(files);
      return;
    }

    const pastedText = clipboard.getData("text/plain").trim();
    if (!pastedText) {
      return;
    }
    if (LINK_UPLOAD_TEMP_DISABLED) {
      return;
    }
    const pastedUrl = parseHttpUrl(pastedText);
    if (!pastedUrl) {
      return;
    }
    event.preventDefault();
    await handleSubmitLink(pastedUrl.toString());
    setUploadToast("Link detected from paste and queued.");
  }

  function buildWorkspacePayload() {
    const readySources = sourceItems.filter((item) => item.status === "ready");
    const projectId = `p-${Date.now()}-${globalThis.crypto.randomUUID().slice(0, 8)}`;
    return {
      prompt: composeInput.trim(),
      textModel: resolvedTextModel,
      imageModel: "gpt-image2",
      sources: readySources,
      project: {
        projectId,
      },
    };
  }

  function persistHomeDraft(payload?: ReturnType<typeof buildWorkspacePayload>) {
    if (typeof window === "undefined") {
      return;
    }
    const nextPayload = payload ?? buildWorkspacePayload();
    window.sessionStorage.setItem(HOME_DRAFT_KEY, JSON.stringify(nextPayload));
  }

  async function createWorkspaceStartRequestWithRetry(payload: ReturnType<typeof buildWorkspacePayload>) {
    const maxAttempts = 1;
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => {
        controller.abort();
      }, WORKSPACE_START_TIMEOUT_MS);
      try {
        const response = await fetch("/api/workspace/start", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        return response;
      } catch (error) {
        lastError = error;
        const retryable = shouldRetryWorkspaceStart(error);
        if (!retryable || attempt >= maxAttempts) {
          throw error;
        }
        await new Promise((resolve) => {
          window.setTimeout(resolve, 280);
        });
      } finally {
        window.clearTimeout(timeoutId);
      }
    }
    throw lastError || new Error("Workspace start request failed.");
  }

  function rememberGenerateIntent() {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.sessionStorage.setItem(
        GENERATE_INTENT_KEY,
        JSON.stringify({
          createdAt: Date.now(),
        }),
      );
    } catch {
      // ignore storage quota errors
    }
  }

  function openMembershipFromHome(
    source: "model_paywall" | "media_paywall" | "preview_paywall" | "upgrade_button" = "model_paywall",
  ) {
    trackAppEvent("checkout_open_from_paywall", {
      source,
      from: "home",
      model: resolvedTextModel,
      has_sources: sourceItems.length > 0,
    });
    persistHomeDraft();
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("membership:return-path", pathname || "/");
      window.sessionStorage.setItem(MEMBERSHIP_SOURCE_KEY, source);
    }
    router.push("/membership");
  }

  async function handleGoGenerate() {
    if (isStartingWorkspace) {
      return;
    }
    setIsStartingWorkspace(true);
    trackAppEvent("generate_click", {
      from: "home",
      model: resolvedTextModel,
      has_prompt: composeInput.trim().length > 0,
      source_count: sourceItems.length,
    });
    trackAppEvent("home_generate_button_click", {
      from: "home",
      button_id: "home_generate",
      step_number: 1,
      model: resolvedTextModel,
      has_prompt: composeInput.trim().length > 0,
      source_count: sourceItems.length,
    });
    trackAppTelemetryEvent({
      category: "button",
      action: "home_generate_button_click",
      source: "home",
      message: "Home Generate button clicked.",
      details: {
        buttonId: "home_generate",
        stepNumber: 1,
        model: resolvedTextModel,
        hasPrompt: composeInput.trim().length > 0,
        sourceCount: sourceItems.length,
      },
    });
    if (sessionStatus === "loading") {
      setUploadToast("Checking your account. Please try again in a second.");
      setIsStartingWorkspace(false);
      return;
    }
    const attribution = readAttributionPayload();
    const payload = {
      ...buildWorkspacePayload(),
      attribution,
    };
    if (!currentEmail) {
      persistHomeDraft(payload);
      rememberGenerateIntent();
      trackAppEvent("generate_requires_login", {
        from: "home",
        model: resolvedTextModel,
      });
      router.prefetch("/workspace");
      router.push(`/auth?callbackUrl=${encodeURIComponent("/app?intent=generate")}`);
      return;
    }
    const hasPremiumRequiredSource = sourceItems.some((item) => sourceItemNeedsPremium(item));
    if (!hasMembership && hasPremiumRequiredSource) {
      setMediaUploadPaywallOpen(true);
      trackAppEvent("generate_blocked_premium_source", {
        from: "home",
        source_count: sourceItems.length,
      });
      setUploadToast(
        "Some uploaded sources require a premium language model for transcript extraction. Please upgrade to generate.",
      );
      setIsStartingWorkspace(false);
      return;
    }
    if (!hasMembership && isPremiumTextModel(resolvedTextModel)) {
      setModelPaywallOpen(true);
      trackAppEvent("generate_blocked_premium_model", {
        from: "home",
        model: resolvedTextModel,
      });
      setUploadToast(
        "The selected language model is a premium model. Please upgrade to generate with this model.",
      );
      setIsStartingWorkspace(false);
      return;
    }
    const pendingSources = sourceItems.filter((item) => item.status !== "ready" && item.status !== "failed");
    if (pendingSources.length > 0) {
      setUploadToast(
        "Some files are still being processed. Wait for extraction to finish, or remove pending files before generating.",
      );
      setIsStartingWorkspace(false);
      return;
    }
    try {
      const response = await createWorkspaceStartRequestWithRetry(payload);
      const data = (await response.json()) as {
        ok?: boolean;
        payload?: typeof payload;
        error?: string;
        code?: string;
      };
      if (!response.ok || !data?.ok || !data.payload) {
        const failedCode = (data as WorkspaceStartErrorPayload)?.code;
        trackAppEvent("workspace_start_fail_code", {
          from: "home",
          code: failedCode || `HTTP_${response.status}`,
          model: resolvedTextModel,
        });
        if (response.status >= 500 && typeof window !== "undefined") {
          persistHomeDraft(payload);
          const nextProjectId = payload.project?.projectId;
          const workspaceUrl =
            nextProjectId ? `/workspace?projectId=${encodeURIComponent(nextProjectId)}` : "/workspace";
          router.prefetch(workspaceUrl);
          router.push(workspaceUrl);
          return;
        }
        setUploadToast(
          mapWorkspaceStartErrorMessage(
            failedCode,
            data?.error || "Unable to start a new project right now. Please try again later.",
          ),
        );
        setIsStartingWorkspace(false);
        return;
      }
      if (typeof window !== "undefined") {
        persistHomeDraft(data.payload);
        window.sessionStorage.removeItem(GENERATE_INTENT_KEY);
      }
      trackAppEvent("workspace_start_success", {
        from: "home",
        model: resolvedTextModel,
        source_count: payload.sources.length,
        attribution_source: attribution.lastTouch?.source ?? attribution.firstTouch?.source ?? "unknown",
      });
      const nextProjectId = data.payload?.project?.projectId || payload.project?.projectId;
      const workspaceUrl =
        nextProjectId ? `/workspace?projectId=${encodeURIComponent(nextProjectId)}` : "/workspace";
      router.prefetch(workspaceUrl);
      router.push(workspaceUrl);
    } catch {
      if (typeof window !== "undefined") {
        persistHomeDraft(payload);
      }
      trackAppEvent("workspace_start_fail_code", {
        from: "home",
        code: "NETWORK_OR_RUNTIME",
        model: resolvedTextModel,
      });
      const nextProjectId = payload.project?.projectId;
      const workspaceUrl =
        nextProjectId ? `/workspace?projectId=${encodeURIComponent(nextProjectId)}` : "/workspace";
      router.prefetch(workspaceUrl);
      router.push(workspaceUrl);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) {
      return;
    }
    const isSubmitCombo = (event.metaKey || event.ctrlKey) && event.key === "Enter";
    const isEnterSubmit = event.key === "Enter" && !event.shiftKey;
    if (isSubmitCombo || isEnterSubmit) {
      event.preventDefault();
      void handleGoGenerate();
      return;
    }
    if (event.key === "Escape") {
      setOpenMenu(null);
      setLinkInputOpen(false);
      setLinkError("");
    }
  }

  function handleLinkInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) {
      return;
    }
    const isSubmitCombo = (event.metaKey || event.ctrlKey) && event.key === "Enter";
    const isEnterSubmit = event.key === "Enter";
    if (isSubmitCombo || isEnterSubmit) {
      event.preventDefault();
      void handleSubmitLink();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setLinkInputOpen(false);
      setLinkError("");
    }
  }

  function getFeaturedSharePath() {
    if (!previewItem) {
      return "/";
    }
    return activePreviewAsset?.viewerUrl || getFeaturedDetailPath(previewItem);
  }

  async function handleFeaturedShare() {
    const shareUrl = new URL(getFeaturedSharePath(), window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setUploadToast(t("Share link copied to clipboard.", "分享链接已复制。"));
  }

  function openFeaturedPreview(item: FeaturedCaseItem) {
    incrementCaseView(item.id, currentEmail);
    setMetricVersion((prev) => prev + 1);
    setPreviewZoom(1);
    setPreviewAssetIndex(0);
    setPreviewImageLoaded(false);
    setPreviewItem(item);
  }

  function buildFeaturedSimilarPrompt(item: FeaturedCaseItem) {
    const category = normalizeCategoryLabel(item.category).toLowerCase();
    const description = item.description?.trim();
    const format = normalizeFormatLabel(item.format);
    if (locale === "zh") {
      const zhCategory = localizeShowcaseCategory(normalizeShowcaseCategory(item.category), locale);
      if (format === "Video") {
        return [
          `生成一个关于「${item.title}」的${zhCategory}解说视频。`,
          description,
          "分镜要清晰、节奏自然、适合手机观看。",
        ]
          .filter(Boolean)
          .join(" ");
      }
      if (format === "PPT") {
        return [
          `生成一套关于「${item.title}」的${zhCategory}演示文稿。`,
          description,
          "页面结构要清楚，重点突出，适合快速阅读。",
        ]
          .filter(Boolean)
          .join(" ");
      }
      return [
        `生成一张关于「${item.title}」的${zhCategory}信息图。`,
        description,
        "画面要清晰、有层次，适合手机浏览，文字不要过密。",
      ]
        .filter(Boolean)
        .join(" ");
    }

    if (format === "Video") {
      return [
        `Create a ${category} explainer video about ${item.title}.`,
        description,
        "Keep the scenes clear, concise, and easy to follow.",
      ]
        .filter(Boolean)
        .join(" ");
    }

    if (format === "PPT") {
      return [
        `Create a ${category} presentation about ${item.title}.`,
        description,
        "Keep the slides structured, visual, and easy to scan.",
      ]
        .filter(Boolean)
        .join(" ");
    }

    return [
      `Create a ${category} infographic about ${item.title}.`,
      description,
      "Keep the layout clear, visual, and easy to scan.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  function handleCreateSimilarFromShowcase(item: FeaturedCaseItem) {
    handlePromptSuggestionSelect(
      buildFeaturedSimilarPrompt(item),
      t("Prompt added to the input.", "已填入输入框。"),
    );
  }

  function handlePromptSuggestionSelect(prompt: string, toastMessage?: string) {
    updateComposeInput(prompt);
    if (toastMessage) {
      setUploadToast(toastMessage);
    }
    window.requestAnimationFrame(() => {
      const node = composeRef.current;
      if (!node) {
        return;
      }
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      node.focus();
      node.setSelectionRange(prompt.length, prompt.length);
    });
  }

  function closeFeaturedPreview() {
    setPreviewZoom(1);
    setPreviewAssetIndex(0);
    setPreviewImageLoaded(false);
    setPreviewItem(null);
  }

  function applyPreviewZoom(nextZoom: number) {
    const clamped = Math.max(1, Math.min(3, Number(nextZoom.toFixed(2))));
    setPreviewZoom(clamped);

    window.requestAnimationFrame(() => {
      const node = previewScrollRef.current;
      if (!node || clamped <= 1) {
        return;
      }
      const centerX = Math.max(0, (node.scrollWidth - node.clientWidth) / 2);
      const centerY = Math.max(0, (node.scrollHeight - node.clientHeight) / 2);
      node.scrollTo({ left: centerX, top: centerY, behavior: "smooth" });
    });
  }

  function handleFeaturedCategoryChange(category: string) {
    setActiveCategory(category);
    setFeaturedVisibleCount(FEATURED_CASE_BATCH_SIZE);
    setIsFeaturedLoadingMore(false);
    if (featuredLoadMoreTimerRef.current) {
      window.clearTimeout(featuredLoadMoreTimerRef.current);
      featuredLoadMoreTimerRef.current = null;
    }
  }

  function handleToggleLike(item: FeaturedCaseItem) {
    toggleCaseLike(item.id, currentEmail);
    setMetricVersion((prev) => prev + 1);
  }

  const localizedNavItems = navItems.map((item) => ({
    label:
      item.key === "home"
        ? t("Home", "首页")
        : item.key === "projects"
          ? t("Projects", "项目")
          : item.key === "profile"
            ? t("Profile", "个人中心")
            : item.label,
    icon: item.icon,
    href: item.href,
  }));

  const resolvedRecentProjects = useMemo(() => {
    return serverRecentProjects.slice(0, 4).map((project, index) => ({
      id: project.id,
      title: formatRecentProjectTitle(project.title, locale, index),
      updatedAt: project.updatedAt
        ? locale === "zh"
          ? `更新于 ${project.updatedAt}`
          : `Updated ${project.updatedAt}`
        : t("Recently updated", "最近更新"),
      cover: project.cover || project.coverImageUrl || "",
      format: normalizeFormatLabel(project.format || "海报"),
      duration: project.duration,
    }));
  }, [locale, serverRecentProjects]);

  const shouldShowRecentProjects =
    sessionStatus === "authenticated" && currentEmail.length > 0 && resolvedRecentProjects.length > 0;
  const shouldShowCreditUpgradeButton = sessionStatus === "authenticated" && currentEmail.length > 0;

  const featuredFilteredItems = useMemo(
    () =>
      featuredItems.filter((item) => itemMatchesShowcaseCategory(item, activeCategory)),
    [activeCategory, featuredItems],
  );

  const featuredVisibleItems = useMemo(
    () => featuredFilteredItems.slice(0, featuredVisibleCount),
    [featuredFilteredItems, featuredVisibleCount],
  );

  const hasMoreFeaturedItems = featuredVisibleCount < featuredFilteredItems.length;
  const featuredRemainingCount = Math.max(0, featuredFilteredItems.length - featuredVisibleItems.length);

  useEffect(() => {
    const target = featuredLoadMoreRef.current;
    if (!target || !hasMoreFeaturedItems || isFeaturedLoadingMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) {
          return;
        }
        setIsFeaturedLoadingMore(true);
        featuredLoadMoreTimerRef.current = window.setTimeout(() => {
          setFeaturedVisibleCount((prev) =>
            Math.min(prev + FEATURED_CASE_BATCH_SIZE, featuredFilteredItems.length),
          );
          setIsFeaturedLoadingMore(false);
          featuredLoadMoreTimerRef.current = null;
        }, 260);
      },
      { rootMargin: "180px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMoreFeaturedItems, isFeaturedLoadingMore, featuredFilteredItems.length]);

  useEffect(() => {
    return () => {
      if (featuredLoadMoreTimerRef.current) {
        window.clearTimeout(featuredLoadMoreTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (autoGenerateOnceRef.current) {
      return;
    }
    if (sessionStatus !== "authenticated" || !currentEmail || isStartingWorkspace) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    const intentFromQuery = new URLSearchParams(window.location.search).get("intent") === "generate";
    let hasIntentFromStorage = false;
    try {
      const raw = window.sessionStorage.getItem(GENERATE_INTENT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { createdAt?: number };
        const createdAt = typeof parsed.createdAt === "number" ? parsed.createdAt : 0;
        hasIntentFromStorage = Date.now() - createdAt <= GENERATE_INTENT_TTL_MS;
      }
    } catch {
      hasIntentFromStorage = false;
    }
    if (!intentFromQuery && !hasIntentFromStorage) {
      return;
    }
    const hasInput = composeInput.trim().length > 0 || sourceItems.length > 0;
    if (!hasInput) {
      return;
    }
    autoGenerateOnceRef.current = true;
    trackAppEvent("generate_auto_resume_after_login", {
      from: "home",
      model: resolvedTextModel,
    });
    void handleGoGenerate();
  }, [
    composeInput,
    currentEmail,
    isStartingWorkspace,
    resolvedTextModel,
    sessionStatus,
    sourceItems.length,
  ]);

  return (
    <div
      className="min-h-screen bg-page text-zinc-900"
      onDragEnter={SHOW_FILE_UPLOAD_ENTRY ? handlePageDragEnter : undefined}
      onDragOver={SHOW_FILE_UPLOAD_ENTRY ? handlePageDragOver : undefined}
      onDragLeave={SHOW_FILE_UPLOAD_ENTRY ? handlePageDragLeave : undefined}
      onDrop={SHOW_FILE_UPLOAD_ENTRY ? handlePageDrop : undefined}
    >
      <SidebarNav
        items={localizedNavItems}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      <main className="px-3 py-4 sm:px-6 md:pl-[6.5rem] lg:px-12 lg:pl-[7.5rem]">
        <div className="mb-3 flex items-center justify-between gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-700 transition hover:bg-zinc-100"
            aria-label={t("Open navigation", "打开导航")}
            title={t("Open navigation", "打开导航")}
          >
            <Menu size={15} />
          </button>
          <div className="flex items-center gap-2">
            <LocaleSwitch />
            <button
              type="button"
              onClick={() => openMembershipFromHome("upgrade_button")}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 text-xs text-zinc-700 transition hover:bg-zinc-100"
            >
              {shouldShowCreditUpgradeButton ? (
                <>
                  <Zap size={14} className="text-zinc-500" />
                  <span className="font-medium text-zinc-900">{currentCredits}</span>
                  <span className="text-zinc-500">|</span>
                  <span className="font-medium">{t("Upgrade", "升级")}</span>
                </>
              ) : (
                <span className="font-medium text-zinc-900">{t("Pricing", "价格")}</span>
              )}
            </button>
            <UserMenu />
          </div>
        </div>
        <div className="fixed right-6 top-6 z-50 hidden items-center gap-3 md:flex">
          <LocaleSwitch />
          <button
            type="button"
            onClick={() => openMembershipFromHome("upgrade_button")}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 text-sm text-zinc-700 transition hover:bg-zinc-100"
          >
            {shouldShowCreditUpgradeButton ? (
              <>
                <Zap size={15} className="text-zinc-500" />
                <span className="font-medium text-zinc-900">{currentCredits}</span>
                <span className="text-zinc-500">|</span>
                <span className="font-medium">{t("Upgrade", "升级")}</span>
              </>
            ) : (
              <span className="font-medium text-zinc-900">{t("Pricing", "价格")}</span>
            )}
          </button>
          <UserMenu />
        </div>

        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 sm:gap-8">
          <div className="h-1 sm:h-2" />

          <section className="relative z-20 mx-auto flex min-h-[48vh] w-full max-w-3xl flex-col justify-center sm:min-h-[56vh]">
            <div className="mb-6 flex flex-col items-center text-center">
              <p className="text-sm font-medium text-blue-600">KnowLens.ai</p>
              <h1 className="mt-1 max-w-[14ch] text-center text-[clamp(1.55rem,4.15vw,2.45rem)] font-semibold leading-[1.08] tracking-tight text-zinc-900 sm:max-w-none sm:text-[clamp(1.65rem,4.15vw,2.55rem)]">
                <span className="block sm:inline">{t("Turn Text into Clear", "把文本变成清晰")}</span>{" "}
                <span className="block sm:inline">{t("Infographics", "的信息图")}</span>
              </h1>
            </div>

              <div
                ref={menuLayerRef}
                className="rounded-[30px] border border-zinc-200 bg-zinc-50 shadow-[0_20px_45px_rgba(15,23,42,0.08)]"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={supportedUploadAccept}
                  onChange={handleUploadChange}
                  className="hidden"
                />
                <label className="block">
                  <span className="sr-only">{t("Creation input", "创作输入框")}</span>
                  <textarea
                    ref={composeRef}
                    value={composeInput}
                    maxLength={MAX_COMPOSE_TEXT_CHARS}
                    onChange={(event) => updateComposeInput(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    onPaste={(event) => {
                      void handleComposerPaste(event);
                    }}
                    className="block h-[200px] w-full resize-none overflow-y-auto rounded-t-[30px] bg-transparent px-6 py-6 text-base leading-7 text-zinc-800 outline-none placeholder:text-zinc-400 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300"
                    placeholder={t(creationInputPlaceholder, "输入主题、笔记或一段说明，KnowLens 会帮你整理成信息图。")}
                  />
                </label>

                {sourceItems.length ? (
                  <div className="mx-5 mt-1">
                    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-400">
                      {sourceItems.map((item) => (
                        <div
                          key={item.id}
                          className="relative h-[96px] w-[96px] shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-white"
                        >
                          {item.previewUrl ? (
                            <img
                              src={item.previewUrl}
                              alt={item.name}
                              className="h-full w-full object-cover"
                              draggable={false}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-zinc-50 text-zinc-500">
                              {item.kind === "youtube" ? (
                                <ImagePlay size={26} />
                              ) : item.kind === "podcast" ? (
                                <Headphones size={26} />
                              ) : item.kind === "web" ? (
                                <Globe size={26} />
                              ) : (
                                <FileText size={26} />
                              )}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => removeSourceItem(item.id)}
                            className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-white transition hover:bg-black/80"
                            aria-label={t("Remove source", "移除素材")}
                          >
                            <X size={14} />
                          </button>

                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/55 to-transparent px-2 pb-1.5 pt-5 text-white">
                            <p className="truncate text-[10px] font-medium">
                              {getCompactFileName(normalizeLegacySourceName(item.name))}
                            </p>
                            <p className="mt-0.5 truncate text-[10px] text-white/85">
                              {getSourceFormatLabel(item)} · {formatFileSize(item.sizeBytes)}
                            </p>
                            {getSourceStatusText(item) ? (
                              <p className="mt-0.5 truncate text-[10px] text-white/90">
                                {getSourceStatusText(item)}
                              </p>
                            ) : null}
                            {item.status !== "ready" && item.status !== "failed" ? (
                              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/30">
                                <div
                                  className="h-full rounded-full bg-white transition-all duration-300"
                                  style={{ width: `${getSourceProgress(item)}%` }}
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                      <button
                        ref={textModelButtonRef}
                        type="button"
                        onClick={toggleTextModelMenu}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                        title={selectedTextModel.label}
                        aria-label={t(
                          `Choose text model. Current model: ${selectedTextModel.label}`,
                          `选择文本模型。当前模型：${selectedTextModel.label}`,
                        )}
                      >
                        <Bot size={16} className={openMenu === "text" ? "text-zinc-700" : ""} />
                      </button>
                      {openMenu === "text" ? (
                        <div
                          className={`absolute left-0 z-[80] w-[310px] rounded-xl border border-zinc-200 bg-white p-1.5 shadow-[0_18px_35px_rgba(15,23,42,0.18)] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-400 ${
                            textMenuOpenUp ? "bottom-12" : "top-12"
                          }`}
                          style={{ maxHeight: textMenuMaxHeight, overflowY: "auto" }}
                        >
                          {textModelOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                if (option.premium && !hasMembership) {
                                  setModelPaywallOpen(true);
                                  setOpenMenu(null);
                                  return;
                                }
                                setTextModel(option.value);
                                setOpenMenu(null);
                              }}
                              className="w-full rounded-xl px-2.5 py-2 text-left transition hover:bg-zinc-100"
                            >
                              <span className="flex items-center justify-between text-sm font-medium text-zinc-900">
                                <span className="inline-flex items-center gap-1.5">{option.label}</span>
                                <span className="inline-flex items-center gap-1.5">
                                  {option.premium ? (
                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-[0_2px_8px_rgba(245,158,11,0.45)]">
                                      <Crown size={11} />
                                    </span>
                                  ) : null}
                                  {resolvedTextModel === option.value ? <Check size={14} /> : null}
                                </span>
                              </span>
                              <span className="mt-1 block text-xs leading-5 text-zinc-500">
                                {option.desc}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={handleGoGenerate}
                      title={t("Generate (Enter / Ctrl+Enter)", "生成（Enter / Ctrl+Enter）")}
                      aria-busy={isStartingWorkspace}
                      disabled={isStartingWorkspace}
                      className={`${HOME_GENERATE_CTA_BASE_CLASS} ${
                        isStartingWorkspace ? HOME_GENERATE_CTA_BUSY_CLASS : HOME_GENERATE_CTA_READY_CLASS
                      }`}
                    >
                      {isStartingWorkspace ? <LoaderCircle size={15} className="animate-spin" /> : <SendHorizontal size={15} />}
                      {isStartingWorkspace ? t("Starting workspace...", "正在启动工作区...") : t("Generate", "生成")}
                    </button>
                  </div>
                </div>
              </div>

              {visiblePromptCards.length ? (
                <div className="relative left-1/2 mt-7 w-[min(calc(100vw-1.5rem),72rem)] -translate-x-1/2 px-3 sm:mt-8 sm:w-[min(calc(100vw-6rem),78rem)] sm:px-0">
                  <p className="mb-2.5 text-center text-xs font-medium text-zinc-500">
                    {t("Try a prompt", "点一个示例开始")}
                  </p>
                  <div className="mx-auto flex max-w-[58rem] flex-wrap items-center justify-center gap-x-1.5 gap-y-2 sm:gap-x-2">
                    {visiblePromptCards.map((card) => {
                      const CardIcon = getPromptSuggestionIcon(card.id);
                      return (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => handlePromptSuggestionSelect(getPromptSuggestionPrompt(card, locale))}
                          className="inline-flex w-auto min-w-0 max-w-full items-center justify-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-900"
                        >
                          <CardIcon size={12} className="shrink-0 text-zinc-400" />
                          <span className="truncate">{getPromptSuggestionLabel(card, locale)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </section>

            {shouldShowRecentProjects ? (
            <section className="mx-auto w-full max-w-6xl">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold tracking-tight text-zinc-900">
                  {t("Recent Projects", "最近项目")}
                </h2>
                <button
                  type="button"
                  onClick={() => router.push("/projects")}
                  className="text-sm text-zinc-500 transition hover:text-zinc-800"
                >
                  {t("View all", "查看全部")}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {resolvedRecentProjects.map((project) => (
                  <article
                    key={project.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/workspace?projectId=${encodeURIComponent(project.id)}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(`/workspace?projectId=${encodeURIComponent(project.id)}`);
                      }
                    }}
                    className="group cursor-pointer overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_10px_25px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(15,23,42,0.08)]"
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-zinc-100">
                        {project.cover ? (
                        <ProgressiveCover
                          src={toOptimizedCaseCover(project.cover)}
                          fallbackSrc={project.cover}
                          alt={project.title}
                          className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-zinc-50 text-xs text-zinc-400">
                          {t("No cover yet", "暂无封面")}
                        </div>
                      )}
                      <span className="absolute left-2 top-2 inline-flex items-center rounded-md border border-white/25 bg-black/78 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white shadow-[0_2px_8px_rgba(0,0,0,0.35)] backdrop-blur-[2px]">
                        {localizeFormatLabel(normalizeFormatLabel(project.format), locale)}
                      </span>
                    </div>
                    <div className="px-3 pb-3 pt-2.5">
                      <p className="text-[15px] font-medium leading-6 text-zinc-900">
                        {project.title}
                      </p>
                      <p className="mt-2 text-sm text-zinc-500">{project.updatedAt}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
            ) : null}

            <section className="mx-auto w-full max-w-6xl">
              <h2 className="mb-3 text-base font-semibold tracking-tight text-zinc-900">
                {t("Featured Cases", "精选案例")}
              </h2>
              <div className="mb-4 flex gap-2 overflow-x-auto pb-1 whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {showcaseCategories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleFeaturedCategoryChange(category)}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm transition ${
                      activeCategory === category
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                    }`}
                  >
                    {localizeShowcaseCategory(category, locale)}
                  </button>
                ))}
              </div>

              <div className="columns-2 gap-3 [column-gap:0.75rem] lg:columns-3 lg:[column-gap:1rem] xl:columns-4">
                {featuredVisibleItems.map((item, index) => {
                    const metric = getCaseMetrics(item.id, item.views, item.likes, currentEmail);
                    return (
                  <article
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openFeaturedPreview(item)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openFeaturedPreview(item);
                      }
                    }}
                    className="group mb-3 block w-full break-inside-avoid-column overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_10px_25px_rgba(15,23,42,0.05)] transition hover:border-zinc-300 hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)] lg:mb-4"
                  >
                    <div className="relative w-full bg-zinc-100">
                      <ProgressiveCover
                        src={toOptimizedCaseCover(item.cover)}
                        fallbackSrc={item.cover}
                        alt={item.title}
                        className="block h-auto w-full object-contain transition-transform duration-300 ease-out group-hover:scale-[1.02]"
                        loading={index < 8 ? "eager" : "lazy"}
                      />
                      <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/55 via-black/10 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
                        <div className="pointer-events-auto flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openFeaturedPreview(item);
                            }}
                            className="inline-flex h-9 items-center justify-center rounded-full bg-white px-4 text-sm font-medium text-zinc-900 shadow-[0_8px_24px_rgba(15,23,42,0.18)] transition hover:bg-zinc-100"
                          >
                            {t("View", "查看")}
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleCreateSimilarFromShowcase(item);
                            }}
                            className="inline-flex h-9 items-center justify-center rounded-full bg-zinc-900 px-4 text-sm font-medium text-white shadow-[0_8px_24px_rgba(15,23,42,0.24)] transition hover:bg-zinc-800"
                          >
                            {t("Similar", "同款")}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-zinc-500">
                        <span className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-zinc-500">
                          {localizeFormatLabel(normalizeFormatLabel(item.format), locale)}
                        </span>
                        <span className="truncate">@{item.author}</span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-zinc-500">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleToggleLike(item);
                          }}
                          className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 transition ${
                            metric.liked
                              ? "bg-rose-50 text-rose-600"
                              : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                          }`}
                          aria-label={metric.liked ? t("Unlike", "取消喜欢") : t("Like", "喜欢")}
                        >
                          <Heart size={12} className={metric.liked ? "fill-current" : ""} />
                          <span>{metric.likes}</span>
                        </button>
                        <span className="shrink-0 whitespace-nowrap tabular-nums">
                          {metric.views} {t("views", "次浏览")}
                        </span>
                      </div>
                    </div>
                  </article>
                    );
                })}
                {isFeaturedLoadingMore
                  ? Array.from({
                      length: Math.min(FEATURED_CASE_BATCH_SIZE, Math.max(1, featuredRemainingCount)),
                    }).map((_, index) => (
                      <div
                        key={`featured-loading-${index}`}
                        className="mb-3 block break-inside-avoid-column overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_10px_25px_rgba(15,23,42,0.04)] lg:mb-4"
                      >
                        <div className="aspect-[3/4] w-full animate-pulse bg-zinc-100" />
                        <div className="space-y-2 p-3">
                          <div className="h-3 w-20 rounded-full bg-zinc-100" />
                          <div className="h-3 w-2/3 rounded-full bg-zinc-100" />
                        </div>
                      </div>
                    ))
                  : null}
              </div>
              <div className="mt-4 flex justify-center" ref={hasMoreFeaturedItems ? featuredLoadMoreRef : undefined}>
                {hasMoreFeaturedItems ? (
                  <div
                    className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-500"
                    aria-live="polite"
                  >
                    {isFeaturedLoadingMore ? <LoaderCircle size={12} className="animate-spin" /> : null}
                    {isFeaturedLoadingMore
                      ? t(
                          `Loading ${Math.min(FEATURED_CASE_BATCH_SIZE, featuredRemainingCount)} more cases...`,
                          `正在加载 ${Math.min(FEATURED_CASE_BATCH_SIZE, featuredRemainingCount)} 个案例...`,
                        )
                      : t(
                          `Scroll to load more (${featuredVisibleItems.length}/${featuredFilteredItems.length})`,
                          `向下滚动加载更多（${featuredVisibleItems.length}/${featuredFilteredItems.length}）`,
                        )}
                  </div>
                ) : (
                  <div className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-500">
                    {t(
                      `You reached the end — all ${featuredFilteredItems.length} featured cases are shown.`,
                      `已显示全部 ${featuredFilteredItems.length} 个精选案例。`,
                    )}
                  </div>
                )}
              </div>
            </section>
        </div>
      </main>
      {uploadToast ? (
        <div className="fixed left-1/2 top-3 z-[200] w-[calc(100%-1.5rem)] max-w-[560px] -translate-x-1/2 rounded-xl bg-zinc-900 px-3 py-2 text-sm text-white shadow-lg sm:top-6 sm:w-auto sm:px-4">
          {uploadToast}
        </div>
      ) : null}
      {SHOW_FILE_UPLOAD_ENTRY && isDragOverPage ? (
        <div className="pointer-events-none fixed inset-0 z-[95] bg-black/72 backdrop-blur-[2px]">
          <div className="flex h-full w-full items-center justify-center px-4">
            <div className="w-full max-w-2xl text-center">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center">
                <div className="relative h-16 w-16">
                  <span className="absolute -left-5 top-1 inline-flex h-10 w-10 rotate-[-18deg] items-center justify-center rounded-xl bg-indigo-200 text-indigo-900 shadow-[0_6px_18px_rgba(79,70,229,0.35)]">
                    <FileText size={18} />
                  </span>
                  <span className="absolute -right-5 top-1 inline-flex h-10 w-10 rotate-[14deg] items-center justify-center rounded-xl bg-indigo-100 text-indigo-900 shadow-[0_6px_18px_rgba(79,70,229,0.35)]">
                    <Upload size={18} />
                  </span>
                  <span className="absolute left-1/2 top-5 inline-flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-[0_10px_24px_rgba(79,70,229,0.45)]">
                    <ImagePlay size={20} />
                  </span>
                </div>
              </div>
              <p className="text-[30px] font-semibold tracking-tight text-white sm:text-[38px]">
                {t("Add anything", "添加任意素材")}
              </p>
              <p className="mt-3 text-[22px] font-medium leading-tight text-white/92 sm:text-[28px]">
                {t("Drop files to upload", "拖放文件以上传")}
              </p>
            </div>
          </div>
        </div>
      ) : null}
      <PaywallDialog
        open={modelPaywallOpen}
        title={t("Membership required", "需要会员")}
        description={t(
          "This language model is available to members only. Please go to the membership page to continue.",
          "此语言模型仅会员可用。请前往会员页面继续。",
        )}
        compact
        onClose={() => setModelPaywallOpen(false)}
        onConfirm={() => {
          setModelPaywallOpen(false);
          openMembershipFromHome("model_paywall");
        }}
        confirmLabel={t("Go to Membership", "前往会员")}
      />
      {previewItem ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4">
          <button
            type="button"
            aria-label={t("Close preview", "关闭预览")}
            className="absolute inset-0 bg-zinc-950/75 backdrop-blur-[2px]"
            onClick={closeFeaturedPreview}
          />
          <div className="relative z-[111] w-full max-w-5xl">
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {(() => {
                  const metric = getCaseMetrics(previewItem.id, previewItem.views, previewItem.likes, currentEmail);
                  return (
                    <button
                      type="button"
                      onClick={() => handleToggleLike(previewItem)}
                      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition ${
                        metric.liked
                          ? "border-rose-300 bg-rose-50 text-rose-600"
                          : "border-white/20 bg-black/40 text-white hover:bg-black/55"
                      }`}
                    >
                      <Heart size={14} className={metric.liked ? "fill-current" : ""} />
                      <span>{metric.likes}</span>
                    </button>
                  );
                })()}
                {activePreviewIsImage ? (
                  <div className="inline-flex h-9 items-center gap-1 rounded-full border border-white/15 bg-black/45 px-1">
                    <button
                      type="button"
                      onClick={() => applyPreviewZoom(previewZoom - 0.25)}
                      disabled={previewZoom <= 1}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white/90 transition enabled:hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Zoom out"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="min-w-[48px] text-center text-xs font-medium text-white/90">
                      {Math.round(previewZoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => applyPreviewZoom(previewZoom + 0.25)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white/90 transition hover:bg-white/15"
                      aria-label="Zoom in"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleFeaturedShare()}
                  className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-3.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200"
                >
                  <Share2 size={16} />
                  {t("Share", "分享")}
                </button>
                {activePreviewAsset?.viewerUrl ? (
                  <button
                    type="button"
                    onClick={() => window.open(activePreviewAsset.viewerUrl, "_blank", "noopener,noreferrer")}
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-white/20 bg-black/40 px-3.5 text-sm font-medium text-white transition hover:bg-black/55"
                  >
                    <ExternalLink size={16} />
                    {t("Open details", "打开详情")}
                  </button>
                ) : null}
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={closeFeaturedPreview}
                  aria-label={t("Close", "关闭")}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white hover:bg-black/60"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-white/15 bg-black/40 shadow-[0_30px_70px_rgba(0,0,0,0.5)]">
              {previewAssets.length > 1 && previewFormat !== "PPT" ? (
                <div className="flex items-center justify-between border-b border-white/10 bg-black/35 px-3 py-2 text-xs text-white/80">
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewImageLoaded(false);
                      setPreviewZoom(1);
                      setPreviewAssetIndex((prev) => Math.max(0, prev - 1));
                    }}
                    disabled={previewAssetIndex <= 0}
                    className="rounded-full border border-white/15 px-2.5 py-1 transition enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t("Previous", "上一张")}
                  </button>
                  <span>
                    {previewFormat === "PPT" ? t("Slide ", "幻灯片 ") : ""}
                    {Math.min(previewAssetIndex + 1, previewAssets.length)} / {previewAssets.length}
                    {activePreviewAsset?.title ? ` · ${activePreviewAsset.title}` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewImageLoaded(false);
                      setPreviewZoom(1);
                      setPreviewAssetIndex((prev) => Math.min(previewAssets.length - 1, prev + 1));
                    }}
                    disabled={previewAssetIndex >= previewAssets.length - 1}
                    className="rounded-full border border-white/15 px-2.5 py-1 transition enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t("Next", "下一张")}
                  </button>
                </div>
              ) : null}
              <div
                ref={previewScrollRef}
                className={`relative max-h-[82dvh] bg-zinc-950/45 sm:max-h-[88vh] ${
                  activePreviewIsImage && previewZoom > 1
                    ? "overflow-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                    : "overflow-hidden"
                }`}
              >
                {!previewImageLoaded ? (
                  <div className="skeleton-shimmer mx-auto h-[62dvh] w-full max-w-[520px] rounded-lg sm:h-[72vh]" />
                ) : null}
                {activePreviewIsVideo ? (
                  <PublishedVideoPlayer
                    src={activePreviewAsset?.fileUrl || ""}
                    poster={activePreviewAsset?.thumbnailUrl || previewItem.cover}
                    title={activePreviewAsset?.title || previewItem.title}
                    className={`mx-auto aspect-video max-h-[82dvh] w-full max-w-5xl rounded-lg bg-black transition-opacity duration-300 ${
                      previewImageLoaded ? "opacity-100" : "opacity-0"
                    }`}
                    onReady={() => setPreviewImageLoaded(true)}
                  />
                ) : activePreviewIsPptDeck ? (
                  <div
                    className={`mx-auto flex min-h-[56dvh] max-w-3xl items-center justify-center rounded-lg border border-white/10 bg-black/60 px-6 text-center text-white transition-opacity duration-300 ${
                      previewImageLoaded ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <div>
                      <p className="text-base font-semibold">{t("PPT file preview", "PPT 文件预览")}</p>
                      <p className="mt-2 text-sm leading-6 text-white/70">
                        {t(
                          "This case includes a presentation file. Use Open details to view the deck.",
                          "此案例包含演示文稿文件。点击打开详情查看完整幻灯片。",
                        )}
                      </p>
                    </div>
                    <img
                      src={activePreviewAsset?.thumbnailUrl || previewItem.cover}
                      alt=""
                      className="hidden"
                      onLoad={() => setPreviewImageLoaded(true)}
                      onError={() => setPreviewImageLoaded(true)}
                    />
                  </div>
                ) : (
                  <img
                    src={activePreviewAsset?.fileUrl || previewItem.cover}
                    alt={activePreviewAsset?.title || previewItem.title}
                    className={`mx-auto h-auto rounded-lg object-contain transition-opacity duration-300 ${
                      previewImageLoaded ? "opacity-100" : "opacity-0"
                    }`}
                    style={
                      previewZoom <= 1
                        ? { maxWidth: "100%", maxHeight: "86vh" }
                        : { width: `${previewZoom * 100}%`, maxWidth: "none", height: "auto" }
                    }
                    draggable={false}
                    onContextMenu={(event) => event.preventDefault()}
                    onDragStart={(event) => event.preventDefault()}
                    onLoad={() => setPreviewImageLoaded(true)}
                    onError={() => setPreviewImageLoaded(true)}
                  />
                )}
                {previewAssets.length > 1 && previewFormat === "PPT" && activePreviewIsImage ? (
                  <div className="pointer-events-none sticky bottom-4 z-20 -mt-14 flex justify-center px-4 pb-4">
                    <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-2 py-2 text-xs text-white shadow-2xl backdrop-blur-md">
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewImageLoaded(false);
                          setPreviewZoom(1);
                          setPreviewAssetIndex((prev) => Math.max(0, prev - 1));
                        }}
                        disabled={previewAssetIndex <= 0}
                        className="rounded-full px-3 py-1.5 font-medium transition enabled:hover:bg-white/15 disabled:cursor-not-allowed disabled:text-white/35"
                      >
                        {t("Previous", "上一张")}
                      </button>
                      <span className="min-w-16 text-center font-medium text-white/85">
                        {Math.min(previewAssetIndex + 1, previewAssets.length)} / {previewAssets.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewImageLoaded(false);
                          setPreviewZoom(1);
                          setPreviewAssetIndex((prev) => Math.min(previewAssets.length - 1, prev + 1));
                        }}
                        disabled={previewAssetIndex >= previewAssets.length - 1}
                        className="rounded-full px-3 py-1.5 font-medium transition enabled:hover:bg-white/15 disabled:cursor-not-allowed disabled:text-white/35"
                      >
                        {t("Next", "下一张")}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <PaywallDialog
        open={previewPaywallOpen}
        title={t("Membership required", "需要会员")}
        description={t(
          "Image downloads are available to members only. Please go to the membership page to continue.",
          "图片下载仅会员可用。请前往会员页面继续。",
        )}
        compact
        onClose={() => setPreviewPaywallOpen(false)}
        onConfirm={() => {
          setPreviewPaywallOpen(false);
          closeFeaturedPreview();
          openMembershipFromHome("preview_paywall");
        }}
        confirmLabel={t("Go to Membership", "前往会员")}
      />
      <PaywallDialog
        open={mediaUploadPaywallOpen}
        title={t("Membership required", "需要会员")}
      description={t(
          "Audio, video, YouTube, and podcast transcript extraction require a premium language model. Please go to the membership page to continue.",
          "音频、视频、YouTube 和播客转录提取需要高级语言模型。请前往会员页面继续。",
        )}
        compact
        onClose={() => setMediaUploadPaywallOpen(false)}
        onConfirm={() => {
          setMediaUploadPaywallOpen(false);
          openMembershipFromHome("media_paywall");
        }}
        confirmLabel={t("Go to Membership", "前往会员")}
      />
    </div>
  );
}
