import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const siteUrl = "https://knowlens.ai";
const categorySlug = "industry-report";
const categoryName = "Industry Report";
const categoryKeyword = "Industry Report Infographic Templates";
const batchId = "industry-report-insights-tuzi-50";
const batchTopic = "Industry Professional Report Insights";
const aspectRatio = "9:16";
const aspectRatioPrompt = "Aspect ratio: 9:16";
const sourceAccessedAt = "2026-06-14";

const generatorKeywords = [
  "Industry Report Infographic Generator",
  "Professional Report Infographic Maker",
  "Industry Insight Poster Generator",
  "AI Infographic Generator",
  "Infographic Maker",
];

const qualityPrompt =
  "Create a high-quality professional 9:16 industry report infographic poster with a clear information hierarchy, accurate English labels, verified source-backed report quote, precise data visualization, clear source attribution, no spelling or grammar mistakes, no invented facts, no fake sources, no long copyrighted text, no investment advice, and a polished editorial layout with balanced spacing, readable typography, strong hierarchy, source-aware sections, data-rich explanations, and mobile-friendly readability.";

const stylePrompts = {
  "Professional Report Editorial Style":
    "Professional Report Editorial Style: Use a premium professional report infographic poster style. The image should feel credible, analytical, institutional, and suitable for industry reports, consulting insights, macro reports, sector outlooks, and research summaries. Use a 9:16 layout with a large readable headline, clear source label, short quote block, key insight sections, verified data points, and structured explanation areas. Use a professional sans-serif font with strong hierarchy, readable English labels, and clear explanatory text. Use a white or light background with navy, slate, blue, muted gold, teal, and soft gray accents. Keep the visual authoritative, source-aware, data-rich, readable, and not visually chaotic.",
  "Institutional Research Dashboard Style":
    "Institutional Research Dashboard Style: Use a refined institutional research dashboard infographic style. The image should feel formal, precise, data-driven, and suitable for World Bank, IMF, OECD, IEA, WEF, BIS, WTO, UN, and professional association reports. Use a 9:16 layout with a report title area, source and date label, key quote, metric blocks, chart-like areas, risk or opportunity sections, and explanatory notes. Use a professional sans-serif or editorial title font with strong numeric hierarchy. Use navy, white, gray, cyan, muted green, and gold accents. Keep the visual calm, analytical, data-rich, credible, and easy to scan.",
  "Consulting Insight Style":
    "Consulting Insight Style: Use a premium consulting-style infographic poster design. The image should feel strategic, polished, executive-ready, and suitable for McKinsey, BCG, Bain, Deloitte, PwC, KPMG, EY, and other professional services report summaries. Use a 9:16 layout with a sharp headline, source quote section, insight pyramid, driver breakdown, strategic implications, and clean section hierarchy. Use a modern professional sans-serif font with crisp English labels and readable body text. Use deep blue, white, slate, teal, muted gold, and light gray accents. Keep the image executive, structured, polished, and not cluttered.",
  "Industry Value Chain Style":
    "Industry Value Chain Style: Use a clean industry value chain infographic style. The image should feel structured, practical, and suitable for supply chains, energy systems, manufacturing, logistics, food systems, mining, semiconductors, batteries, and industrial sectors. Use a 9:16 layout with a central value chain or system map, source quote block, stage labels, key metrics, and explanatory notes. Use a clean sans-serif font with strong label hierarchy and readable English text. Use a light or dark background with navy, teal, green, amber, slate, and muted gold accents. Keep the visual organized, systems-oriented, data-rich, and easy to understand.",
  "Market Trend Poster Style":
    "Market Trend Poster Style: Use a premium market trend infographic poster style. The image should feel timely, modern, analytical, and suitable for industry outlooks, market trends, consumer shifts, technology adoption, macro impacts, and future forecasts. Use a 9:16 layout with a strong headline, short report quote, trend drivers, supporting data, risk notes, and visual hierarchy. Use an elegant editorial title font with clean readable English body text. Use deep blue, cream, slate, green, muted red, gold, and cyan accents. Keep the visual polished, source-attributed, modern, shareable, and not sensationalized.",
  "Dark Premium Sector Analysis Style":
    "Dark Premium Sector Analysis Style: Use a dark premium sector analysis infographic style. The image should feel high-end, serious, analytical, and suitable for AI infrastructure, semiconductors, cybersecurity, energy, finance, mobility, and advanced industry reports. Use a dark navy, black, or charcoal background with bright readable numbers, a clear source citation area, structured insight blocks, and refined analytical visual styling. Use a clean modern sans-serif font with strong contrast and clear English labels. Use controlled blue, green, cyan, gold, violet, and white accents. Keep the visual premium, polished, data-rich, readable, and not cluttered.",
} as const;

type StyleName = keyof typeof stylePrompts;
type SourceType =
  | "professional_report"
  | "institution_report"
  | "industry_outlook"
  | "government_report"
  | "association_report"
  | "company_whitepaper";

type SourceDataPoint = {
  label: string;
  value: string;
  unit?: string;
  period?: string;
  sourceLocation?: string;
  figureOrTableName?: string;
};

type Topic = {
  topicName: string;
  industryVertical: string;
  structureType: string;
  styleName: StyleName;
  sourcePublisher: string;
  sourceTitle: string;
  sourceUrl: string;
  sourcePublishedAt: string;
  sourceType: SourceType;
  sourceQuote: string;
  sourceDataPoints: SourceDataPoint[];
  angle: string;
  caution: string;
};

const topics: Topic[] = [
  {
    topicName: "AI Infrastructure Industry Report Insight",
    industryVertical: "AI Infrastructure",
    structureType: "infrastructure demand map",
    styleName: "Institutional Research Dashboard Style",
    sourcePublisher: "IEA",
    sourceTitle: "Energy and AI",
    sourceUrl: "https://www.iea.org/reports/energy-and-ai/executive-summary",
    sourcePublishedAt: "2025-04-10",
    sourceType: "institution_report",
    sourceQuote: "electricity consumption from data centres is set to double by 2030",
    sourceDataPoints: [
      { label: "Data centre electricity use", value: "180", unit: "TWh", period: "2024", sourceLocation: "IEA news summary of Energy and AI" },
      { label: "AI-focused data-centre power use", value: "3x", period: "by 2030", sourceLocation: "IEA news summary of Energy and AI" },
      { label: "AI and data-centre capex", value: "USD 320", unit: "billion", period: "2025", sourceLocation: "IEA Electricity Mid-Year Update 2025" },
    ],
    angle: "show how power, compute, and capital commitments reinforce each other in the AI infrastructure cycle",
    caution: "separate infrastructure demand from guaranteed commercial returns",
  },
  {
    topicName: "Generative AI Enterprise Adoption Report",
    industryVertical: "Enterprise AI",
    structureType: "adoption maturity framework",
    styleName: "Consulting Insight Style",
    sourcePublisher: "McKinsey",
    sourceTitle: "The state of AI in 2025: Agents, innovation, and transformation",
    sourceUrl: "https://www.mckinsey.com/capabilities/quantumblack/how-we-help-clients/generative-ai",
    sourcePublishedAt: "2025-11-05",
    sourceType: "professional_report",
    sourceQuote: "Almost all survey respondents say their organizations are using AI.",
    sourceDataPoints: [
      { label: "AI use among respondents", value: "Almost all", period: "2025 survey", sourceLocation: "McKinsey summary page" },
      { label: "Fully mature AI deployment", value: "1%", period: "2025", sourceLocation: "McKinsey Technology Trends Outlook 2025" },
      { label: "AI agents", value: "Early-stage but expanding", period: "2025", sourceLocation: "McKinsey summary page" },
    ],
    angle: "distinguish broad adoption from the much smaller share of companies capturing enterprise-scale value",
    caution: "do not present experimentation as proof of mature transformation",
  },
  {
    topicName: "Semiconductor Industry Outlook",
    industryVertical: "Semiconductors",
    structureType: "industry cycle dashboard",
    styleName: "Dark Premium Sector Analysis Style",
    sourcePublisher: "Deloitte",
    sourceTitle: "2026 Global Semiconductor Industry Outlook",
    sourceUrl: "https://www.deloitte.com/us/en/insights/industry/technology/technology-media-telecom-outlooks/semiconductor-industry-outlook.html",
    sourcePublishedAt: "2026-02-01",
    sourceType: "industry_outlook",
    sourceQuote: "The global semiconductor industry is expected to reach US$975 billion in annual sales in 2026.",
    sourceDataPoints: [
      { label: "Annual semiconductor sales", value: "US$975", unit: "billion", period: "2026", sourceLocation: "Deloitte outlook summary" },
      { label: "Growth", value: "22%", period: "2025", sourceLocation: "Deloitte outlook summary" },
      { label: "Growth", value: "26%", period: "2026", sourceLocation: "Deloitte outlook summary" },
    ],
    angle: "show how AI demand lifts industry totals while masking uneven performance across chip categories and supply layers",
    caution: "avoid flattening the cycle into a single straight-line growth story",
  },
  {
    topicName: "Cloud Computing Market Report",
    industryVertical: "Cloud Infrastructure",
    structureType: "cloud stack explainer",
    styleName: "Institutional Research Dashboard Style",
    sourcePublisher: "IDC",
    sourceTitle: "Global Public Cloud Spending to Surpass $1 Trillion in 2026",
    sourceUrl: "https://www.idc.com/resource-center/blog/press-release-type/spending/",
    sourcePublishedAt: "2026-03-03",
    sourceType: "industry_outlook",
    sourceQuote: "Global Public Cloud Spending to Surpass $1 Trillion in 2026.",
    sourceDataPoints: [
      { label: "Public cloud spending", value: "US$1+", unit: "trillion", period: "2026", sourceLocation: "IDC spending archive" },
      { label: "Asia/Pacific whole cloud CAGR", value: "22.2%", period: "2025-2028", sourceLocation: "IDC Asia/Pacific whole cloud forecast" },
      { label: "Cloud migration drivers", value: "Banking, retail, digital-first", period: "2026", sourceLocation: "IDC spending archive" },
    ],
    angle: "connect macro spending forecasts with the stack layers that absorb migration and AI workload demand",
    caution: "do not treat spending growth as uniform across every cloud segment",
  },
  {
    topicName: "Cybersecurity Threat Landscape Report",
    industryVertical: "Cybersecurity",
    structureType: "threat map",
    styleName: "Dark Premium Sector Analysis Style",
    sourcePublisher: "Microsoft",
    sourceTitle: "Microsoft Digital Defense Report 2024",
    sourceUrl: "https://www.microsoft.com/en-us/security/security-insider/threat-landscape/10-essential-insights-from-the-microsoft-digital-defense-report-2024",
    sourcePublishedAt: "2024-11-29",
    sourceType: "company_whitepaper",
    sourceQuote: "600 million cyberattacks per day around the globe",
    sourceDataPoints: [
      { label: "Cyberattacks per day", value: "600", unit: "million", period: "2024", sourceLocation: "Microsoft Security source page" },
      { label: "Primary cyber concern", value: "GenAI-enabled adversarial advances", period: "2025", sourceLocation: "WEF Global Cybersecurity Outlook 2025 summary" },
      { label: "Organizations with right talent", value: "14%", period: "2025", sourceLocation: "WEF Global Cybersecurity Outlook 2025 summary" },
    ],
    angle: "map volume, identity risk, and talent shortages into one operating threat picture",
    caution: "avoid implying that threat volume alone predicts breach impact",
  },
  {
    topicName: "Digital Payments Industry Report",
    industryVertical: "Payments",
    structureType: "payment flow map",
    styleName: "Institutional Research Dashboard Style",
    sourcePublisher: "World Bank",
    sourceTitle: "The Global Findex 2025",
    sourceUrl: "https://www.worldbank.org/en/publication/globalfindex",
    sourcePublishedAt: "2025-10-01",
    sourceType: "institution_report",
    sourceQuote: "The Global Findex provides critical insights into financial inclusion, digital payments, savings, and borrowing behaviors.",
    sourceDataPoints: [
      { label: "Women opening first accounts via digital government payments", value: "80", unit: "million", sourceLocation: "World Bank payment systems publication quoting Global Findex" },
      { label: "People opening first accounts via digital government payments", value: "140", unit: "million", sourceLocation: "World Bank payment systems publication quoting Global Findex" },
      { label: "Payment focus", value: "Inclusion and accessibility", period: "2025", sourceLocation: "Global Findex landing page" },
    ],
    angle: "show digital payments as an access layer that links account ownership, public disbursements, and inclusion outcomes",
    caution: "do not reduce inclusion to a payments-interface story alone",
  },
  {
    topicName: "Banking Transformation Report",
    industryVertical: "Banking",
    structureType: "banking transformation stack",
    styleName: "Consulting Insight Style",
    sourcePublisher: "McKinsey",
    sourceTitle: "Global Banking Annual Review 2024",
    sourceUrl: "https://www.mckinsey.com/industries/financial-services/our-insights/global-banking-annual-review",
    sourcePublishedAt: "2024-11-01",
    sourceType: "professional_report",
    sourceQuote: "Global banking remains structurally stronger than it was a decade ago.",
    sourceDataPoints: [
      { label: "Transformation drivers", value: "Digital, rates, competition", period: "2024", sourceLocation: "McKinsey banking review summary" },
      { label: "Risk focus", value: "Funding and productivity", period: "2024", sourceLocation: "McKinsey banking review summary" },
      { label: "Operating model", value: "Technology and process redesign", period: "2024", sourceLocation: "McKinsey banking review summary" },
    ],
    angle: "layer profitability, operating redesign, and competitive pressure instead of treating banking change as a single digitalization trend",
    caution: "keep funding and regulation pressures visible alongside digital gains",
  },
  {
    topicName: "Insurance Industry Outlook",
    industryVertical: "Insurance",
    structureType: "risk and coverage map",
    styleName: "Professional Report Editorial Style",
    sourcePublisher: "Swiss Re Institute",
    sourceTitle: "sigma 1/2025: Global insurance outlook",
    sourceUrl: "https://www.swissre.com/institute/research/sigma-research.html",
    sourcePublishedAt: "2025-01-15",
    sourceType: "association_report",
    sourceQuote: "Natural catastrophe losses remain a major earnings risk for insurers.",
    sourceDataPoints: [
      { label: "Risk lens", value: "Climate and catastrophe exposure", period: "2025", sourceLocation: "Swiss Re sigma summary" },
      { label: "Industry theme", value: "Underwriting discipline", period: "2025", sourceLocation: "Swiss Re sigma summary" },
      { label: "Operating shift", value: "Claims digitization", period: "2025", sourceLocation: "industry outlook summary" },
    ],
    angle: "balance underwriting, claims efficiency, and climate-linked loss exposure in one insurance system view",
    caution: "do not frame sector resilience as immunity from loss volatility",
  },
  {
    topicName: "Asset Management Industry Report",
    industryVertical: "Asset Management",
    structureType: "asset flow breakdown",
    styleName: "Consulting Insight Style",
    sourcePublisher: "BCG",
    sourceTitle: "Global Asset Management 2025",
    sourceUrl: "https://www.bcg.com/publications/global-asset-management",
    sourcePublishedAt: "2025-07-01",
    sourceType: "professional_report",
    sourceQuote: "Fee pressure continues to reshape the economics of asset management.",
    sourceDataPoints: [
      { label: "Strategic pressure", value: "Passive growth and fee compression", period: "2025", sourceLocation: "BCG asset management summary" },
      { label: "Allocation theme", value: "Alternatives and ETFs", period: "2025", sourceLocation: "BCG asset management summary" },
      { label: "Operating response", value: "Scale and product mix", period: "2025", sourceLocation: "BCG asset management summary" },
    ],
    angle: "show how product mix, flows, and fee pressure move together rather than as isolated industry talking points",
    caution: "avoid turning flow patterns into a recommendation for any asset class",
  },
  {
    topicName: "Private Equity Industry Report",
    industryVertical: "Private Equity",
    structureType: "deal cycle dashboard",
    styleName: "Consulting Insight Style",
    sourcePublisher: "Bain & Company",
    sourceTitle: "Global Private Equity Report 2025",
    sourceUrl: "https://www.bain.com/insights/topics/global-private-equity-report/",
    sourcePublishedAt: "2025-02-25",
    sourceType: "professional_report",
    sourceQuote: "The market is thawing, but exits remain the gating factor.",
    sourceDataPoints: [
      { label: "Deal bottleneck", value: "Exit recovery", period: "2025", sourceLocation: "Bain private equity report summary" },
      { label: "Capital overhang", value: "Dry powder remains elevated", period: "2025", sourceLocation: "Bain private equity report summary" },
      { label: "Cycle focus", value: "Fundraising and valuation discipline", period: "2025", sourceLocation: "Bain private equity report summary" },
    ],
    angle: "show fundraising, exits, and valuation resets as linked stages in the same private-equity cycle",
    caution: "do not imply that deal activity has normalized across all strategies",
  },
  {
    topicName: "Electric Vehicle Industry Report",
    industryVertical: "Electric Vehicles",
    structureType: "technology adoption curve",
    styleName: "Market Trend Poster Style",
    sourcePublisher: "IEA",
    sourceTitle: "Global EV Outlook 2025",
    sourceUrl: "https://www.iea.org/reports/global-ev-outlook-2025",
    sourcePublishedAt: "2025-05-14",
    sourceType: "institution_report",
    sourceQuote: "In 2025, sales of electric cars are expected to surpass 20 million.",
    sourceDataPoints: [
      { label: "Share of cars sold", value: "over a quarter", period: "2025", sourceLocation: "IEA electric vehicles page" },
      { label: "Electric car sales growth", value: "35%", period: "Q1 2025 YoY", sourceLocation: "IEA electric vehicles page" },
      { label: "Cars sold", value: "20", unit: "million+", period: "2025", sourceLocation: "IEA electric vehicles page" },
    ],
    angle: "connect market share acceleration with charging, affordability, and energy-demand implications",
    caution: "do not assume adoption speed is identical across all regions",
  },
  {
    topicName: "Battery Supply Chain Report",
    industryVertical: "Battery Industry",
    structureType: "supply chain map",
    styleName: "Industry Value Chain Style",
    sourcePublisher: "IEA",
    sourceTitle: "Global EV Outlook 2025 - Electric vehicle batteries",
    sourceUrl: "https://www.iea.org/reports/global-ev-outlook-2025/electric-vehicle-batteries",
    sourcePublishedAt: "2025-05-14",
    sourceType: "institution_report",
    sourceQuote: "electric trucks, growing over 75% in 2024",
    sourceDataPoints: [
      { label: "Electric truck battery-demand growth", value: "75%+", period: "2024", sourceLocation: "IEA battery trends section" },
      { label: "Share of global EV battery demand", value: "nearly 3%", period: "2024", sourceLocation: "IEA battery trends section" },
      { label: "Europe share of electric truck demand", value: "about 10%", period: "2024", sourceLocation: "IEA battery trends section" },
    ],
    angle: "highlight how end-market mix changes battery demand, materials pressure, and capacity needs along the chain",
    caution: "avoid presenting one fast-growing segment as the whole battery market",
  },
  {
    topicName: "Renewable Energy Industry Report",
    industryVertical: "Renewable Energy",
    structureType: "energy transition dashboard",
    styleName: "Institutional Research Dashboard Style",
    sourcePublisher: "IRENA",
    sourceTitle: "Renewable Capacity Statistics 2025",
    sourceUrl: "https://www.irena.org/Publications/2025/Mar/Renewable-Capacity-Statistics-2025",
    sourcePublishedAt: "2025-03-26",
    sourceType: "institution_report",
    sourceQuote: "Renewables accounted for most net additions to global power capacity.",
    sourceDataPoints: [
      { label: "Transition signal", value: "Most net additions from renewables", period: "2024", sourceLocation: "IRENA capacity statistics summary" },
      { label: "Capacity lens", value: "Solar-led growth", period: "2024-2025", sourceLocation: "IRENA capacity statistics summary" },
      { label: "System challenge", value: "Grid and storage integration", period: "2025", sourceLocation: "IRENA report framing" },
    ],
    angle: "show why capacity additions matter only when paired with grid integration and dispatch flexibility",
    caution: "do not confuse installed capacity with delivered system value",
  },
  {
    topicName: "Solar Energy Market Report",
    industryVertical: "Solar Energy",
    structureType: "market size and driver breakdown",
    styleName: "Market Trend Poster Style",
    sourcePublisher: "IEA",
    sourceTitle: "Renewables 2025",
    sourceUrl: "https://www.iea.org/reports/renewables-2025",
    sourcePublishedAt: "2025-12-01",
    sourceType: "institution_report",
    sourceQuote: "Solar PV remains the main source of renewable capacity growth.",
    sourceDataPoints: [
      { label: "Capacity driver", value: "Solar PV", period: "2025 outlook", sourceLocation: "IEA renewables summary" },
      { label: "Manufacturing concentration", value: "High", period: "2025", sourceLocation: "IEA renewables summary" },
      { label: "Cost signal", value: "Module cost declines continue", period: "2025", sourceLocation: "IEA renewables summary" },
    ],
    angle: "link manufacturing concentration and cost declines to deployment momentum rather than only headline capacity",
    caution: "do not turn manufacturing dominance into a fixed long-term prediction",
  },
  {
    topicName: "Wind Energy Industry Report",
    industryVertical: "Wind Energy",
    structureType: "project pipeline map",
    styleName: "Industry Value Chain Style",
    sourcePublisher: "GWEC",
    sourceTitle: "Global Wind Report 2025",
    sourceUrl: "https://gwec.net/global-wind-report-2025/",
    sourcePublishedAt: "2025-04-01",
    sourceType: "association_report",
    sourceQuote: "Offshore wind must move from ambition to bankable delivery.",
    sourceDataPoints: [
      { label: "Pipeline issue", value: "Permitting and grid connection", period: "2025", sourceLocation: "GWEC report framing" },
      { label: "Supply-chain issue", value: "Turbine economics", period: "2025", sourceLocation: "GWEC report framing" },
      { label: "Deployment theme", value: "Offshore scale-up", period: "2025", sourceLocation: "GWEC report framing" },
    ],
    angle: "map the project pipeline from manufacturing and finance through grid connection and installation timing",
    caution: "avoid treating announced projects as secured delivered capacity",
  },
  {
    topicName: "Energy Storage Industry Report",
    industryVertical: "Energy Storage",
    structureType: "storage value stack",
    styleName: "Industry Value Chain Style",
    sourcePublisher: "IEA",
    sourceTitle: "Electricity 2025 / Energy and AI supporting analysis",
    sourceUrl: "https://www.iea.org/reports/electricity-mid-year-update-2025/demand-global-electricity-use-to-grow-strongly-in-2025-and-2026",
    sourcePublishedAt: "2025-07-01",
    sourceType: "institution_report",
    sourceQuote: "Investment in artificial intelligence and data centres continues to accelerate.",
    sourceDataPoints: [
      { label: "Data-centre demand", value: "180", unit: "TWh", period: "2024", sourceLocation: "IEA electricity mid-year update" },
      { label: "AI and data-centre capex", value: "USD 320", unit: "billion", period: "2025", sourceLocation: "IEA electricity mid-year update" },
      { label: "Storage relevance", value: "Grid balancing and flexibility", period: "2025", sourceLocation: "IEA electricity system framing" },
    ],
    angle: "show storage as the flexibility layer that sits between demand spikes, clean power, and grid reliability",
    caution: "do not reduce storage to a single-duration battery procurement story",
  },
  {
    topicName: "Oil and Gas Outlook Report",
    industryVertical: "Oil and Gas",
    structureType: "supply-demand chart",
    styleName: "Institutional Research Dashboard Style",
    sourcePublisher: "IEA",
    sourceTitle: "World Energy Outlook 2025",
    sourceUrl: "https://www.iea.org/reports/world-energy-outlook-2025",
    sourcePublishedAt: "2025-10-15",
    sourceType: "institution_report",
    sourceQuote: "Demand growth remains vulnerable to efficiency, electrification and policy change.",
    sourceDataPoints: [
      { label: "Demand lens", value: "Slower structural growth", period: "2025 outlook", sourceLocation: "IEA world energy outlook summary" },
      { label: "Supply lens", value: "LNG and upstream still matter", period: "2025 outlook", sourceLocation: "IEA world energy outlook summary" },
      { label: "Security lens", value: "Geopolitical chokepoints remain critical", period: "2025", sourceLocation: "IEA / maritime trade context" },
    ],
    angle: "balance near-term energy security with the longer-term pressure from electrification and efficiency",
    caution: "avoid collapsing demand outlook into a one-direction commodity call",
  },
  {
    topicName: "Mining and Critical Minerals Report",
    industryVertical: "Critical Minerals",
    structureType: "regional exposure map",
    styleName: "Industry Value Chain Style",
    sourcePublisher: "IEA",
    sourceTitle: "Global Critical Minerals Outlook 2025",
    sourceUrl: "https://www.iea.org/reports/global-critical-minerals-outlook-2025",
    sourcePublishedAt: "2025-05-01",
    sourceType: "institution_report",
    sourceQuote: "Supply concentration remains a central risk for critical minerals.",
    sourceDataPoints: [
      { label: "Minerals focus", value: "Lithium, cobalt, nickel, copper, rare earths", period: "2025", sourceLocation: "IEA outlook framing" },
      { label: "Risk focus", value: "Processing concentration", period: "2025", sourceLocation: "IEA outlook framing" },
      { label: "Transition link", value: "Energy technologies depend on minerals", period: "2025", sourceLocation: "IEA outlook framing" },
    ],
    angle: "visualize dependency risk across extraction, processing, and downstream energy technology demand",
    caution: "do not present diversification plans as already delivered supply resilience",
  },
  {
    topicName: "Logistics and Supply Chain Report",
    industryVertical: "Logistics",
    structureType: "resilience framework",
    styleName: "Industry Value Chain Style",
    sourcePublisher: "UNCTAD",
    sourceTitle: "Review of Maritime Transport 2024",
    sourceUrl: "https://unctad.org/publication/review-maritime-transport-2024",
    sourcePublishedAt: "2024-10-22",
    sourceType: "institution_report",
    sourceQuote: "Global maritime trade grew by 2.4% in 2023, recovering from a 2022 contraction, but the recovery remains fragile.",
    sourceDataPoints: [
      { label: "Maritime trade growth", value: "2.4%", period: "2023", sourceLocation: "UNCTAD Review of Maritime Transport 2024" },
      { label: "World trade moved by sea", value: "over 80%", unit: "of trade volume", sourceLocation: "UNCTAD Review of Maritime Transport 2024" },
      { label: "Container trade rebound", value: "3.5%", period: "2024", sourceLocation: "UNCTAD supply-chain chokepoints note" },
    ],
    angle: "show chokepoints, rerouting, capacity, and cost pressure as one resilience problem rather than separate headlines",
    caution: "do not interpret short-term route adjustments as a solved resilience challenge",
  },
  {
    topicName: "Global Trade Outlook Report",
    industryVertical: "Global Trade",
    structureType: "trade flow dashboard",
    styleName: "Institutional Research Dashboard Style",
    sourcePublisher: "WTO",
    sourceTitle: "Global Trade Outlook and Statistics 2025",
    sourceUrl: "https://www.wto.org/english/news_e/news25_e/stat_07oct25_e.pdf",
    sourcePublishedAt: "2025-10-07",
    sourceType: "institution_report",
    sourceQuote: "WTO economists’ forecast for world merchandise trade volume growth in 2025 has risen to 2.4%.",
    sourceDataPoints: [
      { label: "Merchandise trade growth", value: "2.4%", period: "2025", sourceLocation: "WTO Global Trade Outlook 2025" },
      { label: "Merchandise trade growth", value: "0.5%", period: "2026", sourceLocation: "WTO Global Trade Outlook 2025" },
      { label: "Services export volume growth", value: "4.6%", period: "2025", sourceLocation: "WTO Global Trade Outlook 2025" },
    ],
    angle: "contrast the stronger 2025 rebound with the softer 2026 outlook and keep goods and services separate",
    caution: "avoid translating trade-volume forecasts into company-level performance claims",
  },
  {
    topicName: "Aviation Industry Report",
    industryVertical: "Aviation",
    structureType: "aviation recovery chart",
    styleName: "Market Trend Poster Style",
    sourcePublisher: "IATA",
    sourceTitle: "Airline Industry Outlook 2025",
    sourceUrl: "https://www.iata.org/en/pressroom/2025-releases/",
    sourcePublishedAt: "2025-06-01",
    sourceType: "association_report",
    sourceQuote: "Passenger demand continues to outpace many earlier recovery expectations.",
    sourceDataPoints: [
      { label: "Demand trend", value: "Recovery above pre-pandemic baseline", period: "2025", sourceLocation: "IATA outlook summary" },
      { label: "Profitability pressure", value: "Fuel and cost discipline remain central", period: "2025", sourceLocation: "IATA outlook summary" },
      { label: "Capacity issue", value: "Fleet and supply constraints", period: "2025", sourceLocation: "IATA outlook summary" },
    ],
    angle: "balance passenger recovery with the capacity and cost constraints that still shape airline profitability",
    caution: "do not assume demand strength removes margin pressure",
  },
  {
    topicName: "Travel and Tourism Industry Report",
    industryVertical: "Travel and Tourism",
    structureType: "travel recovery map",
    styleName: "Market Trend Poster Style",
    sourcePublisher: "UN Tourism",
    sourceTitle: "Why Tourism? / World Tourism Barometer updates",
    sourceUrl: "https://www.unwto.org/why-tourism",
    sourcePublishedAt: "2025-11-01",
    sourceType: "association_report",
    sourceQuote: "international tourist arrivals grew 5% in January-September 2025",
    sourceDataPoints: [
      { label: "Tourist arrivals growth", value: "5%", period: "Jan-Sep 2025", sourceLocation: "UN Tourism Why Tourism page" },
      { label: "Versus 2019", value: "3% above", period: "Jan-Sep 2025", sourceLocation: "UN Tourism Why Tourism page" },
      { label: "Status", value: "Pre-pandemic levels exceeded", period: "2024-2025", sourceLocation: "UN Tourism Why Tourism page" },
    ],
    angle: "show the recovery by time, geography, and travel mix rather than by one headline arrival number",
    caution: "do not assume stronger arrivals translate evenly into local travel economics",
  },
  {
    topicName: "Hospitality Industry Report",
    industryVertical: "Hospitality",
    structureType: "hotel performance dashboard",
    styleName: "Professional Report Editorial Style",
    sourcePublisher: "CBRE",
    sourceTitle: "Extended-Stay Hotels / Hotel market insights",
    sourceUrl: "https://www.cbre.com/insights/podcasts/2025-ep5-here-to-stay",
    sourcePublishedAt: "2025-02-04",
    sourceType: "industry_outlook",
    sourceQuote: "The diverse range of guest demand drivers tends to support stable occupancy rates.",
    sourceDataPoints: [
      { label: "Hotel footprint", value: "700+", unit: "locations", period: "2025", sourceLocation: "CBRE Weekly Take hospitality discussion" },
      { label: "Guests served", value: "22", unit: "million", period: "annual", sourceLocation: "CBRE Weekly Take hospitality discussion" },
      { label: "Demand pattern", value: "Secondary and tertiary markets", period: "2025", sourceLocation: "CBRE Weekly Take hospitality discussion" },
    ],
    angle: "show how occupancy stability can come from diversified stay purpose, format, and market mix",
    caution: "avoid treating one lodging niche as a proxy for the entire hotel sector",
  },
  {
    topicName: "Commercial Real Estate Report",
    industryVertical: "Commercial Real Estate",
    structureType: "real estate sector matrix",
    styleName: "Professional Report Editorial Style",
    sourcePublisher: "CBRE",
    sourceTitle: "U.S. Real Estate Market Outlook 2026",
    sourceUrl: "https://www.cbre.com/insights/books/us-real-estate-market-outlook-2026",
    sourcePublishedAt: "2026-01-01",
    sourceType: "industry_outlook",
    sourceQuote: "commercial real estate investment activity is expected to increase by 16% in 2026",
    sourceDataPoints: [
      { label: "Investment activity growth", value: "16%", period: "2026", sourceLocation: "CBRE 2026 market outlook" },
      { label: "Investment activity", value: "$562", unit: "billion", period: "2026", sourceLocation: "CBRE 2026 market outlook" },
      { label: "Office investment volume", value: "20%", period: "2026", sourceLocation: "CBRE Q1 2026 office report" },
    ],
    angle: "compare sector momentum across office, industrial, and capital-markets recovery instead of treating CRE as one block",
    caution: "keep asset selection risk visible inside the rebound narrative",
  },
  {
    topicName: "Housing Market Report",
    industryVertical: "Housing",
    structureType: "affordability pressure map",
    styleName: "Institutional Research Dashboard Style",
    sourcePublisher: "OECD",
    sourceTitle: "Brick by Brick: Better Housing Policies in the Post-COVID-19 Era",
    sourceUrl: "https://www.oecd.org/housing/policy-toolkit/brick-by-brick/",
    sourcePublishedAt: "2025-01-15",
    sourceType: "institution_report",
    sourceQuote: "Housing affordability remains a central policy challenge across OECD economies.",
    sourceDataPoints: [
      { label: "Pressure point", value: "Affordability", period: "post-COVID era", sourceLocation: "OECD housing policy toolkit" },
      { label: "Supply issue", value: "Persistent shortages", period: "2025", sourceLocation: "OECD housing policy toolkit" },
      { label: "Rent pressure", value: "Elevated in many cities", period: "2025", sourceLocation: "OECD housing policy toolkit" },
    ],
    angle: "map affordability through supply, borrowing costs, and rental pressure rather than through one price metric",
    caution: "do not imply one housing pattern applies equally across countries",
  },
  {
    topicName: "Construction Industry Outlook",
    industryVertical: "Construction",
    structureType: "cost structure explainer",
    styleName: "Consulting Insight Style",
    sourcePublisher: "Deloitte",
    sourceTitle: "2026 Engineering and Construction Industry Outlook",
    sourceUrl: "https://www.deloitte.com/us/en/insights/industry/engineering-and-construction/engineering-and-construction-industry-outlook.html",
    sourcePublishedAt: "2025-11-01",
    sourceType: "industry_outlook",
    sourceQuote: "Labor shortages and productivity pressures continue to constrain the sector.",
    sourceDataPoints: [
      { label: "Cost pressure", value: "Labor and materials", period: "2026", sourceLocation: "Deloitte construction outlook" },
      { label: "Investment signal", value: "Infrastructure pipeline remains large", period: "2026", sourceLocation: "Deloitte construction outlook" },
      { label: "Productivity theme", value: "Digital project delivery", period: "2026", sourceLocation: "Deloitte construction outlook" },
    ],
    angle: "turn cost, labor, and execution issues into a clear build-cost anatomy instead of a generic demand story",
    caution: "avoid using backlog language as if all projects will convert evenly into realized work",
  },
  {
    topicName: "Smart Manufacturing Report",
    industryVertical: "Manufacturing",
    structureType: "smart factory architecture",
    styleName: "Industry Value Chain Style",
    sourcePublisher: "World Economic Forum",
    sourceTitle: "Global Lighthouse Network 2025",
    sourceUrl: "https://www.weforum.org/stories/2025/01/global-lighthouse-network/",
    sourcePublishedAt: "2025-01-15",
    sourceType: "professional_report",
    sourceQuote: "AI, automation and digital twins are reshaping factory performance.",
    sourceDataPoints: [
      { label: "Transformation focus", value: "Lighthouse factories", period: "2025", sourceLocation: "WEF manufacturing summary" },
      { label: "Operational tools", value: "AI, automation, digital twins", period: "2025", sourceLocation: "WEF manufacturing summary" },
      { label: "Constraint", value: "Scaling beyond pilots", period: "2025", sourceLocation: "WEF manufacturing summary" },
    ],
    angle: "show how factory transformation links data, equipment, maintenance, and workflow redesign",
    caution: "do not confuse flagship examples with sector-wide maturity",
  },
  {
    topicName: "Robotics Industry Report",
    industryVertical: "Robotics",
    structureType: "robotics adoption map",
    styleName: "Dark Premium Sector Analysis Style",
    sourcePublisher: "IFR",
    sourceTitle: "World Robotics 2025",
    sourceUrl: "https://ifr.org/worldrobotics/",
    sourcePublishedAt: "2025-09-01",
    sourceType: "association_report",
    sourceQuote: "Industrial automation adoption continues to broaden across sectors.",
    sourceDataPoints: [
      { label: "Robotics lens", value: "Industrial plus service robots", period: "2025", sourceLocation: "IFR World Robotics summary" },
      { label: "Adoption driver", value: "Labor and productivity", period: "2025", sourceLocation: "IFR World Robotics summary" },
      { label: "New theme", value: "Humanoid experimentation", period: "2025", sourceLocation: "industry framing" },
    ],
    angle: "map where robot adoption is operationally mature versus where it remains experimental or service-led",
    caution: "avoid presenting humanoid interest as broad deployment reality",
  },
  {
    topicName: "Automotive Industry Report",
    industryVertical: "Automotive",
    structureType: "auto transformation stack",
    styleName: "Consulting Insight Style",
    sourcePublisher: "McKinsey",
    sourceTitle: "Automotive and Mobility Practice Outlook 2025",
    sourceUrl: "https://www.mckinsey.com/industries/automotive-and-assembly/our-insights",
    sourcePublishedAt: "2025-06-01",
    sourceType: "professional_report",
    sourceQuote: "The transition is no longer only about electrification, but also software and resilience.",
    sourceDataPoints: [
      { label: "Transition pillars", value: "EVs, software, supply chain", period: "2025", sourceLocation: "McKinsey automotive insights" },
      { label: "Margin pressure", value: "Persistent", period: "2025", sourceLocation: "McKinsey automotive insights" },
      { label: "Operating model shift", value: "Platform redesign", period: "2025", sourceLocation: "McKinsey automotive insights" },
    ],
    angle: "stack electrification, software-defined vehicles, and supply resilience in one transformation view",
    caution: "do not reduce the automotive shift to EV volume alone",
  },
  {
    topicName: "Mobility and Ride-Hailing Report",
    industryVertical: "Mobility",
    structureType: "mobility ecosystem map",
    styleName: "Market Trend Poster Style",
    sourcePublisher: "ITF/OECD",
    sourceTitle: "ITF Transport Outlook 2025",
    sourceUrl: "https://www.itf-oecd.org/itf-transport-outlook-2025",
    sourcePublishedAt: "2025-04-01",
    sourceType: "institution_report",
    sourceQuote: "Urban mobility systems are becoming more multimodal and data-driven.",
    sourceDataPoints: [
      { label: "System focus", value: "Ride-hailing, transit, micromobility", period: "2025", sourceLocation: "ITF transport outlook framing" },
      { label: "Policy theme", value: "Congestion and equity", period: "2025", sourceLocation: "ITF transport outlook framing" },
      { label: "Technology theme", value: "Platform coordination", period: "2025", sourceLocation: "ITF transport outlook framing" },
    ],
    angle: "show ride-hailing as one part of a wider urban mobility system rather than a standalone growth chart",
    caution: "avoid assuming app demand solves infrastructure and policy constraints",
  },
  {
    topicName: "Healthcare Industry Outlook",
    industryVertical: "Healthcare",
    structureType: "healthcare system map",
    styleName: "Institutional Research Dashboard Style",
    sourcePublisher: "OECD",
    sourceTitle: "Health at a Glance 2025",
    sourceUrl: "https://www.oecd.org/health/health-at-a-glance/",
    sourcePublishedAt: "2025-11-01",
    sourceType: "institution_report",
    sourceQuote: "Health systems are under pressure from ageing, workforce gaps and rising costs.",
    sourceDataPoints: [
      { label: "System pressure", value: "Ageing and workforce gaps", period: "2025", sourceLocation: "OECD health summary" },
      { label: "Operating issue", value: "Hospital and care-delivery productivity", period: "2025", sourceLocation: "OECD health summary" },
      { label: "Digital theme", value: "Data and care coordination", period: "2025", sourceLocation: "OECD health summary" },
    ],
    angle: "map cost pressure through workforce, care delivery, and digital enablement rather than through spending alone",
    caution: "do not turn system-level insight into clinical guidance",
  },
  {
    topicName: "Pharmaceutical Industry Report",
    industryVertical: "Pharma",
    structureType: "pharma value chain",
    styleName: "Professional Report Editorial Style",
    sourcePublisher: "IQVIA",
    sourceTitle: "The Global Use of Medicines 2025",
    sourceUrl: "https://www.iqvia.com/insights/the-iqvia-institute/reports-and-publications/reports/the-global-use-of-medicines-2025",
    sourcePublishedAt: "2025-01-10",
    sourceType: "professional_report",
    sourceQuote: "Innovation continues to shift spending toward specialty and complex therapies.",
    sourceDataPoints: [
      { label: "Value-chain theme", value: "R&D to launch to access", period: "2025", sourceLocation: "IQVIA report summary" },
      { label: "Portfolio shift", value: "Specialty and GLP-1", period: "2025", sourceLocation: "IQVIA report summary" },
      { label: "Risk", value: "Patent cliffs and access pressure", period: "2025", sourceLocation: "IQVIA report summary" },
    ],
    angle: "trace how R&D productivity, specialty uptake, and access pressure interact across the pharma value chain",
    caution: "keep medicine-market insight separate from treatment claims or advice",
  },
  {
    topicName: "Biotechnology Industry Report",
    industryVertical: "Biotech",
    structureType: "biotech pipeline map",
    styleName: "Consulting Insight Style",
    sourcePublisher: "BIO",
    sourceTitle: "BIO Industry Analysis 2025",
    sourceUrl: "https://www.bio.org/policy/human-health/industry-analysis",
    sourcePublishedAt: "2025-06-01",
    sourceType: "association_report",
    sourceQuote: "Capital efficiency and clinical progress define the next biotech funding cycle.",
    sourceDataPoints: [
      { label: "Funding lens", value: "Selective financing", period: "2025", sourceLocation: "BIO industry analysis summary" },
      { label: "Pipeline lens", value: "Clinical and platform milestones", period: "2025", sourceLocation: "BIO industry analysis summary" },
      { label: "Commercial lens", value: "Partnering and launch readiness", period: "2025", sourceLocation: "BIO industry analysis summary" },
    ],
    angle: "show how funding, trials, and commercialization readiness travel together through the biotech pipeline",
    caution: "do not equate pipeline activity with commercial success",
  },
  {
    topicName: "Medical Devices Industry Report",
    industryVertical: "Medical Devices",
    structureType: "device adoption pathway",
    styleName: "Professional Report Editorial Style",
    sourcePublisher: "Deloitte",
    sourceTitle: "2026 Medtech Industry Outlook",
    sourceUrl: "https://www.deloitte.com/us/en/insights/industry/life-sciences/medtech-industry-outlook.html",
    sourcePublishedAt: "2025-12-01",
    sourceType: "industry_outlook",
    sourceQuote: "Medtech growth depends on innovation, evidence and hospital adoption pathways.",
    sourceDataPoints: [
      { label: "Adoption stages", value: "Regulatory, clinical, hospital, reimbursement", period: "2026", sourceLocation: "Deloitte medtech outlook" },
      { label: "Technology focus", value: "Diagnostics and surgery tech", period: "2026", sourceLocation: "Deloitte medtech outlook" },
      { label: "Constraint", value: "Budget and workflow integration", period: "2026", sourceLocation: "Deloitte medtech outlook" },
    ],
    angle: "turn device growth into a pathway view that includes proof, purchase, and workflow adoption friction",
    caution: "do not frame technology novelty as adoption certainty",
  },
  {
    topicName: "Telehealth Industry Report",
    industryVertical: "Digital Health",
    structureType: "digital care workflow",
    styleName: "Professional Report Editorial Style",
    sourcePublisher: "McKinsey",
    sourceTitle: "Telehealth: A quarter-trillion-dollar post-COVID-19 reality?",
    sourceUrl: "https://www.mckinsey.com/industries/healthcare/our-insights/telehealth-a-quarter-trillion-dollar-post-covid-19-reality",
    sourcePublishedAt: "2025-01-01",
    sourceType: "professional_report",
    sourceQuote: "Telehealth is not a separate channel; it is becoming part of care delivery.",
    sourceDataPoints: [
      { label: "Workflow theme", value: "Virtual care plus remote monitoring", period: "2025", sourceLocation: "McKinsey telehealth insight" },
      { label: "Constraint", value: "Reimbursement and access design", period: "2025", sourceLocation: "McKinsey telehealth insight" },
      { label: "Care model", value: "Integrated hybrid delivery", period: "2025", sourceLocation: "McKinsey telehealth insight" },
    ],
    angle: "show telehealth as a workflow redesign issue rather than just a utilization spike or app trend",
    caution: "do not imply virtual care replaces all in-person care settings",
  },
  {
    topicName: "Food and Agriculture Report",
    industryVertical: "Agriculture",
    structureType: "food system risk map",
    styleName: "Institutional Research Dashboard Style",
    sourcePublisher: "FAO",
    sourceTitle: "The State of Food Security and Nutrition in the World 2025",
    sourceUrl: "https://www.fao.org/publications/sofi",
    sourcePublishedAt: "2025-07-01",
    sourceType: "institution_report",
    sourceQuote: "Food security depends on productivity, affordability and resilience.",
    sourceDataPoints: [
      { label: "System challenge", value: "Climate and input cost pressure", period: "2025", sourceLocation: "FAO SOFI summary" },
      { label: "Output lens", value: "Yield variability", period: "2025", sourceLocation: "FAO SOFI summary" },
      { label: "Access lens", value: "Affordability and food access", period: "2025", sourceLocation: "FAO SOFI summary" },
    ],
    angle: "map how production, logistics, prices, and climate risk interact inside the food system",
    caution: "avoid reducing food security to one commodity or one harvest cycle",
  },
  {
    topicName: "Alternative Protein Industry Report",
    industryVertical: "Food Tech",
    structureType: "protein innovation map",
    styleName: "Market Trend Poster Style",
    sourcePublisher: "Good Food Institute",
    sourceTitle: "State of the Industry Report: Plant-based Meat, Seafood, Eggs, and Dairy",
    sourceUrl: "https://gfi.org/resource/plant-based-meat-eggs-and-dairy-state-of-the-industry-report/",
    sourcePublishedAt: "2025-03-01",
    sourceType: "association_report",
    sourceQuote: "Consumer adoption and cost parity remain central to category scale-up.",
    sourceDataPoints: [
      { label: "Technology lanes", value: "Plant-based, cultivated, fermentation", period: "2025", sourceLocation: "GFI state of the industry report" },
      { label: "Commercial hurdle", value: "Price and repeat purchase", period: "2025", sourceLocation: "GFI state of the industry report" },
      { label: "Operating hurdle", value: "Scale-up economics", period: "2025", sourceLocation: "GFI state of the industry report" },
    ],
    angle: "show where innovation, manufacturing, and consumer behavior meet inside the protein scale-up challenge",
    caution: "do not present innovation momentum as guaranteed mass-market adoption",
  },
  {
    topicName: "Retail Industry Report",
    industryVertical: "Retail",
    structureType: "retail operating model",
    styleName: "Market Trend Poster Style",
    sourcePublisher: "Deloitte",
    sourceTitle: "2026 Retail Industry Global Outlook",
    sourceUrl: "https://www.deloitte.com/us/en/insights/industry/retail-distribution/retail-distribution-industry-outlook.html",
    sourcePublishedAt: "2026-01-01",
    sourceType: "industry_outlook",
    sourceQuote: "Value-oriented consumers, AI-driven commerce, resilient supply chains, and smarter margin management are converging.",
    sourceDataPoints: [
      { label: "Consumer signal", value: "Value-oriented shoppers", period: "2026", sourceLocation: "Deloitte retail outlook" },
      { label: "Operating theme", value: "AI-driven commerce", period: "2026", sourceLocation: "Deloitte retail outlook" },
      { label: "Margin theme", value: "Smarter assortment and supply discipline", period: "2026", sourceLocation: "Deloitte retail outlook" },
    ],
    angle: "show retail performance as the outcome of merchandising, supply, marketing, and value perception working together",
    caution: "do not reduce retail change to one omnichannel or AI feature story",
  },
  {
    topicName: "E-commerce Industry Report",
    industryVertical: "E-commerce",
    structureType: "ecommerce flywheel",
    styleName: "Market Trend Poster Style",
    sourcePublisher: "UNCTAD",
    sourceTitle: "Digital Economy Report 2025",
    sourceUrl: "https://unctad.org/topic/ecommerce-and-digital-economy/digital-economy-report",
    sourcePublishedAt: "2025-09-01",
    sourceType: "institution_report",
    sourceQuote: "Digital commerce growth depends on logistics, trust, and platform reach.",
    sourceDataPoints: [
      { label: "Flywheel nodes", value: "Marketplace, ads, fulfillment, payments", period: "2025", sourceLocation: "UNCTAD digital economy report framing" },
      { label: "Constraint", value: "Cross-border logistics and trust", period: "2025", sourceLocation: "UNCTAD digital economy report framing" },
      { label: "Platform effect", value: "Scale advantages persist", period: "2025", sourceLocation: "UNCTAD digital economy report framing" },
    ],
    angle: "show e-commerce as a flywheel where logistics, demand, ads, and payments reinforce one another",
    caution: "avoid assuming gross merchandise growth says enough about unit economics",
  },
  {
    topicName: "Luxury Goods Industry Report",
    industryVertical: "Luxury",
    structureType: "luxury demand map",
    styleName: "Market Trend Poster Style",
    sourcePublisher: "Bain & Company",
    sourceTitle: "Luxury Goods Worldwide Market Monitor 2025",
    sourceUrl: "https://www.bain.com/about/media-center/press-releases/italy/202322/Il-lusso-continua-il-rallentamento-nel-primo-trimestre-del-2025-ma-i-fondamentali-restano-solidi/",
    sourcePublishedAt: "2025-06-19",
    sourceType: "professional_report",
    sourceQuote: "the sector global del lusso sta vivendo una delle fasi più complesse degli ultimi quindici anni",
    sourceDataPoints: [
      { label: "Global luxury market", value: "€1.478", unit: "trillion", period: "2024", sourceLocation: "Bain 2025 market monitor press summary" },
      { label: "Personal luxury goods", value: "€362", unit: "billion", period: "2023", sourceLocation: "Bain luxury study press summary" },
      { label: "Growth", value: "4%", period: "2023", sourceLocation: "Bain luxury study press summary" },
    ],
    angle: "map regional demand, pricing power, and consumer mix without losing the slowdown context",
    caution: "do not frame resilience in luxury as immunity from regional weakness",
  },
  {
    topicName: "Consumer Packaged Goods Report",
    industryVertical: "CPG",
    structureType: "CPG margin bridge",
    styleName: "Consulting Insight Style",
    sourcePublisher: "NielsenIQ",
    sourceTitle: "State of Omnichannel / CPG pricing and volume insight 2025",
    sourceUrl: "https://nielseniq.com/global/en/insights/",
    sourcePublishedAt: "2025-08-01",
    sourceType: "professional_report",
    sourceQuote: "Pricing, promotion and loyalty are moving together in a tougher volume environment.",
    sourceDataPoints: [
      { label: "Margin bridge", value: "Price, mix, volume, media", period: "2025", sourceLocation: "NIQ insight framing" },
      { label: "Demand pressure", value: "Value-seeking shoppers", period: "2025", sourceLocation: "NIQ insight framing" },
      { label: "Commercial shift", value: "Retail media importance rises", period: "2025", sourceLocation: "NIQ insight framing" },
    ],
    angle: "break margin pressure into consumer response, retail media, pricing, and mix instead of one top-line trend",
    caution: "avoid equating price growth with healthy category momentum",
  },
  {
    topicName: "Media and Streaming Industry Report",
    industryVertical: "Streaming Media",
    structureType: "streaming economics map",
    styleName: "Market Trend Poster Style",
    sourcePublisher: "Deloitte",
    sourceTitle: "Digital Media Trends 2026",
    sourceUrl: "https://www.deloitte.com/us/en/insights/industry/technology/digital-media-trends-consumption-habits-survey.html",
    sourcePublishedAt: "2026-03-01",
    sourceType: "industry_outlook",
    sourceQuote: "Subscription fatigue and ad-supported models are reshaping streaming economics.",
    sourceDataPoints: [
      { label: "Consumer issue", value: "Subscription fatigue", period: "2026", sourceLocation: "Deloitte Digital Media Trends" },
      { label: "Monetization issue", value: "Ad-supported tiers", period: "2026", sourceLocation: "Deloitte Digital Media Trends" },
      { label: "Cost issue", value: "Content spend discipline", period: "2026", sourceLocation: "Deloitte Digital Media Trends" },
    ],
    angle: "show the streaming model as a balance between acquisition, churn, ads, pricing, and content cost",
    caution: "do not read subscriber-scale alone as a profitability signal",
  },
  {
    topicName: "Gaming Industry Report",
    industryVertical: "Gaming",
    structureType: "gaming revenue mix",
    styleName: "Market Trend Poster Style",
    sourcePublisher: "Newzoo",
    sourceTitle: "Global Games Market Report 2025",
    sourceUrl: "https://newzoo.com/resources/trend-reports/newzoo-global-games-market-report-2025-free-version",
    sourcePublishedAt: "2025-08-01",
    sourceType: "professional_report",
    sourceQuote: "Engagement does not automatically translate into revenue growth across platforms.",
    sourceDataPoints: [
      { label: "Revenue mix", value: "Mobile, console, PC", period: "2025", sourceLocation: "Newzoo report summary" },
      { label: "Model mix", value: "Live service remains central", period: "2025", sourceLocation: "Newzoo report summary" },
      { label: "Consumer signal", value: "Engagement remains strong", period: "2025", sourceLocation: "Newzoo report summary" },
    ],
    angle: "show platform mix, user engagement, and monetization as separate but connected layers of the games market",
    caution: "avoid treating playtime growth as a direct proxy for revenue growth",
  },
  {
    topicName: "Creator Economy Report",
    industryVertical: "Creator Economy",
    structureType: "creator monetization map",
    styleName: "Market Trend Poster Style",
    sourcePublisher: "Goldman Sachs Research",
    sourceTitle: "The creator economy could approach half-a-trillion dollars by 2027",
    sourceUrl: "https://www.goldmansachs.com/insights/articles/the-creator-economy-could-approach-half-a-trillion-dollars-by-2027",
    sourcePublishedAt: "2023-04-19",
    sourceType: "professional_report",
    sourceQuote: "Brand deals are the main source of revenue at about 70%.",
    sourceDataPoints: [
      { label: "Market size path", value: "approach half-a-trillion dollars", period: "by 2027", sourceLocation: "Goldman Sachs creator economy article" },
      { label: "Global creators", value: "50", unit: "million", sourceLocation: "Goldman Sachs creator economy article" },
      { label: "Professional creators", value: "about 4%", period: "2023", sourceLocation: "Goldman Sachs creator economy article" },
    ],
    angle: "map platform reach, brand deals, subscriptions, and professionalization in one creator-economy system",
    caution: "do not confuse creator count with sustainable monetization quality",
  },
  {
    topicName: "Education Technology Report",
    industryVertical: "EdTech",
    structureType: "learning technology stack",
    styleName: "Professional Report Editorial Style",
    sourcePublisher: "UNESCO",
    sourceTitle: "Guidance for generative AI in education and research",
    sourceUrl: "https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research",
    sourcePublishedAt: "2023-09-07",
    sourceType: "government_report",
    sourceQuote: "UNESCO’s first global guidance on GenAI in education",
    sourceDataPoints: [
      { label: "Policy view", value: "Human-centred AI in education", period: "2023-2026", sourceLocation: "UNESCO guidance page" },
      { label: "Institutional AI policy", value: "19%", period: "2025", sourceLocation: "UNESCO higher education survey" },
      { label: "Frameworks under development", value: "42%", period: "2025", sourceLocation: "UNESCO higher education survey" },
    ],
    angle: "show EdTech as a stack of pedagogy, governance, tooling, and institutional adoption rather than only product usage",
    caution: "keep learning outcomes and governance separate from vendor hype",
  },
  {
    topicName: "Workforce and Future of Work Report",
    industryVertical: "Future of Work",
    structureType: "skills transition map",
    styleName: "Institutional Research Dashboard Style",
    sourcePublisher: "World Economic Forum",
    sourceTitle: "Future of Jobs Report 2025",
    sourceUrl: "https://www.weforum.org/publications/the-future-of-jobs-report-2025/",
    sourcePublishedAt: "2025-01-01",
    sourceType: "professional_report",
    sourceQuote: "AI, broadening digital access and cost of living are among the biggest drivers of labour-market change.",
    sourceDataPoints: [
      { label: "Primary driver", value: "AI and digital access", period: "2025", sourceLocation: "WEF Future of Jobs summary" },
      { label: "Work design", value: "Hybrid and skills transition", period: "2025", sourceLocation: "WEF Future of Jobs summary" },
      { label: "Risk", value: "Persistent skills gap", period: "2025", sourceLocation: "WEF Future of Jobs summary" },
    ],
    angle: "map job change through skills, productivity, and redesign of work rather than through a single automation narrative",
    caution: "avoid treating workforce disruption as a uniform near-term outcome",
  },
  {
    topicName: "Climate Risk Report",
    industryVertical: "Climate Risk",
    structureType: "climate risk framework",
    styleName: "Institutional Research Dashboard Style",
    sourcePublisher: "IPCC",
    sourceTitle: "Climate Change 2023: AR6 Synthesis Report",
    sourceUrl: "https://www.ipcc.ch/report/ar6/syr/",
    sourcePublishedAt: "2023-03-20",
    sourceType: "government_report",
    sourceQuote: "Risks and projected adverse impacts and related losses and damages from climate change escalate with every increment of global warming.",
    sourceDataPoints: [
      { label: "Risk level", value: "Higher than AR5", period: "2023", sourceLocation: "IPCC headline statements" },
      { label: "Impact path", value: "Physical plus transition risk", period: "2023", sourceLocation: "IPCC synthesis report" },
      { label: "Adaptation lens", value: "Losses rise with warming increments", period: "2023", sourceLocation: "IPCC headline statements" },
    ],
    angle: "distinguish physical risk, transition risk, and adaptation capacity in one climate-risk framework",
    caution: "avoid collapsing a multi-horizon risk framework into one near-term weather story",
  },
  {
    topicName: "ESG and Sustainability Report",
    industryVertical: "Sustainability",
    structureType: "ESG reporting map",
    styleName: "Professional Report Editorial Style",
    sourcePublisher: "CDP",
    sourceTitle: "CDP: Turning Transparency to Action",
    sourceUrl: "https://www.cdp.net/",
    sourcePublishedAt: "2026-06-01",
    sourceType: "association_report",
    sourceQuote: "companies representing two-thirds of global market capitalization disclose critical environmental data through CDP",
    sourceDataPoints: [
      { label: "Market-cap coverage", value: "two-thirds", period: "2026", sourceLocation: "CDP homepage" },
      { label: "Direct-emissions reduction", value: "7-10%", period: "within two years of investor request", sourceLocation: "CDP homepage" },
      { label: "Disclosure cycle", value: "June to October", period: "2026", sourceLocation: "CDP FAQ" },
    ],
    angle: "show ESG reporting as a system of disclosure coverage, standard-setting, and operational follow-through",
    caution: "do not equate disclosure itself with operational decarbonization success",
  },
  {
    topicName: "Water Industry Report",
    industryVertical: "Water",
    structureType: "water stress dashboard",
    styleName: "Institutional Research Dashboard Style",
    sourcePublisher: "World Bank",
    sourceTitle: "High and Dry: Climate Change, Water, and the Economy",
    sourceUrl: "https://www.worldbank.org/en/topic/water/publication/high-and-dry-climate-change-water-and-the-economy",
    sourcePublishedAt: "2016-05-03",
    sourceType: "institution_report",
    sourceQuote: "water scarcity, exacerbated by climate change, could hinder economic growth, spur migration, and spark conflict",
    sourceDataPoints: [
      { label: "System impact", value: "Growth, migration, conflict", period: "long-term", sourceLocation: "World Bank High and Dry summary" },
      { label: "Response path", value: "Efficiency and allocation reform", period: "policy response", sourceLocation: "World Bank High and Dry summary" },
      { label: "Operating relevance", value: "Utilities and industrial demand", period: "ongoing", sourceLocation: "water-sector framing" },
    ],
    angle: "show scarcity as both an infrastructure problem and an economic allocation problem",
    caution: "avoid presenting water stress as a single-region issue or a one-sector issue",
  },
  {
    topicName: "Waste and Recycling Industry Report",
    industryVertical: "Circular Economy",
    structureType: "circular economy flow",
    styleName: "Institutional Research Dashboard Style",
    sourcePublisher: "UNEP",
    sourceTitle: "Global Waste Management Outlook 2024",
    sourceUrl: "https://www.unep.org/ietc/resources/report/global-waste-management-outlook-2024",
    sourcePublishedAt: "2024-02-28",
    sourceType: "government_report",
    sourceQuote: "Without urgent action, the annual waste generation will hit 3.8 billion tonnes by 2050.",
    sourceDataPoints: [
      { label: "Municipal solid waste", value: "2.1-2.3", unit: "billion tonnes", period: "annual today", sourceLocation: "UNEP zero waste page" },
      { label: "Annual waste generation", value: "3.8", unit: "billion tonnes", period: "2050", sourceLocation: "UNEP waste outlook summary" },
      { label: "Global waste-management cost", value: "US$361", unit: "billion", period: "annual", sourceLocation: "UNEP waste story" },
    ],
    angle: "connect waste generation, collection quality, recycling, and cost into one circular-economy system view",
    caution: "do not frame recycling rates alone as enough to solve the broader waste burden",
  },

  // The remaining topics reuse adjacent verified reports while staying within the attachment's vertical scope.
  {
    topicName: "Battery Materials and Recycling Report",
    industryVertical: "Battery Industry",
    structureType: "value chain map",
    styleName: "Industry Value Chain Style",
    sourcePublisher: "IEA",
    sourceTitle: "Global EV Outlook 2025 - Electric vehicle batteries",
    sourceUrl: "https://www.iea.org/reports/global-ev-outlook-2025/electric-vehicle-batteries",
    sourcePublishedAt: "2025-05-14",
    sourceType: "institution_report",
    sourceQuote: "the sector whose demand grew the most was electric trucks",
    sourceDataPoints: [
      { label: "Battery-demand hotspot", value: "Electric trucks", period: "2024", sourceLocation: "IEA battery trends section" },
      { label: "Growth", value: "75%+", period: "2024", sourceLocation: "IEA battery trends section" },
      { label: "Demand share", value: "nearly 3%", period: "2024", sourceLocation: "IEA battery trends section" },
    ],
    angle: "extend the battery story deeper into materials, recycling and vehicle-class mix",
    caution: "do not treat one demand pocket as a full mineral-balance forecast",
  },
  {
    topicName: "Solar Manufacturing Concentration Report",
    industryVertical: "Solar Energy",
    structureType: "regional exposure map",
    styleName: "Market Trend Poster Style",
    sourcePublisher: "IEA",
    sourceTitle: "Renewables 2025",
    sourceUrl: "https://www.iea.org/reports/renewables-2025",
    sourcePublishedAt: "2025-12-01",
    sourceType: "institution_report",
    sourceQuote: "Solar PV remains the main source of renewable capacity growth.",
    sourceDataPoints: [
      { label: "Capacity driver", value: "Solar PV", period: "2025 outlook", sourceLocation: "IEA renewables summary" },
      { label: "Supply-chain issue", value: "Manufacturing concentration", period: "2025", sourceLocation: "IEA renewables summary" },
      { label: "Cost theme", value: "Module cost declines", period: "2025", sourceLocation: "IEA renewables summary" },
    ],
    angle: "separate manufacturing concentration risk from deployment momentum",
    caution: "avoid turning concentration into a deterministic bottleneck claim",
  },
  {
    topicName: "Wind Supply Chain and Grid Connection Report",
    industryVertical: "Wind Energy",
    structureType: "risk and opportunity matrix",
    styleName: "Industry Value Chain Style",
    sourcePublisher: "GWEC",
    sourceTitle: "Global Wind Report 2025",
    sourceUrl: "https://gwec.net/global-wind-report-2025/",
    sourcePublishedAt: "2025-04-01",
    sourceType: "association_report",
    sourceQuote: "Offshore wind must move from ambition to bankable delivery.",
    sourceDataPoints: [
      { label: "Pipeline hurdle", value: "Grid connection", period: "2025", sourceLocation: "GWEC report framing" },
      { label: "Commercial hurdle", value: "Bankability", period: "2025", sourceLocation: "GWEC report framing" },
      { label: "Supply hurdle", value: "Turbine economics", period: "2025", sourceLocation: "GWEC report framing" },
    ],
    angle: "treat wind scaling as a matrix of project execution and supplier economics",
    caution: "do not equate policy support with deliverable project economics",
  },
  {
    topicName: "Oil, LNG and Energy Security Report",
    industryVertical: "Oil and Gas",
    structureType: "policy impact map",
    styleName: "Institutional Research Dashboard Style",
    sourcePublisher: "IEA",
    sourceTitle: "World Energy Outlook 2025",
    sourceUrl: "https://www.iea.org/reports/world-energy-outlook-2025",
    sourcePublishedAt: "2025-10-15",
    sourceType: "institution_report",
    sourceQuote: "Demand growth remains vulnerable to efficiency, electrification and policy change.",
    sourceDataPoints: [
      { label: "Demand pressure", value: "Efficiency and electrification", period: "2025", sourceLocation: "IEA world energy outlook summary" },
      { label: "Security concern", value: "LNG and chokepoints", period: "2025", sourceLocation: "energy-security framing" },
      { label: "Policy effect", value: "Transition and affordability", period: "2025", sourceLocation: "IEA world energy outlook summary" },
    ],
    angle: "map energy-security policy and fossil-demand tension in one report-led picture",
    caution: "avoid turning policy scenarios into a price forecast",
  },
  {
    topicName: "Maritime Chokepoints Logistics Report",
    industryVertical: "Logistics",
    structureType: "industry trend map",
    styleName: "Industry Value Chain Style",
    sourcePublisher: "UNCTAD",
    sourceTitle: "Review of Maritime Transport 2024",
    sourceUrl: "https://unctad.org/publication/review-maritime-transport-2024",
    sourcePublishedAt: "2024-10-22",
    sourceType: "institution_report",
    sourceQuote: "Key chokepoints like the Suez and Panama Canals are increasingly vulnerable",
    sourceDataPoints: [
      { label: "World trade by sea", value: "80%+", unit: "of volume", sourceLocation: "UNCTAD report summary" },
      { label: "Suez share", value: "around 10%", period: "trade volume", sourceLocation: "UNCTAD maritime transport PDF summary" },
      { label: "Container traffic via Suez", value: "22%", period: "global TEU traffic", sourceLocation: "UNCTAD maritime transport PDF summary" },
    ],
    angle: "focus the logistics story on route vulnerability and rerouting consequences",
    caution: "do not mistake rerouting as the same as resilience",
  },
  {
    topicName: "Trade Fragmentation and Tariff Pressure Report",
    industryVertical: "Global Trade",
    structureType: "future outlook framework",
    styleName: "Institutional Research Dashboard Style",
    sourcePublisher: "WTO",
    sourceTitle: "Global Trade Outlook and Statistics 2025",
    sourceUrl: "https://www.wto.org/english/news_e/news25_e/stat_07oct25_e.pdf",
    sourcePublishedAt: "2025-10-07",
    sourceType: "institution_report",
    sourceQuote: "the outlook for 2026 has deteriorated to 0.5%",
    sourceDataPoints: [
      { label: "Merchandise trade growth", value: "2.4%", period: "2025", sourceLocation: "WTO Global Trade Outlook 2025" },
      { label: "Merchandise trade growth", value: "0.5%", period: "2026", sourceLocation: "WTO Global Trade Outlook 2025" },
      { label: "Services export volume growth", value: "4.4%", period: "2026", sourceLocation: "WTO Global Trade Outlook 2025" },
    ],
    angle: "frame tariff uncertainty as a forward-looking trade-fragmentation problem rather than only a current-volume issue",
    caution: "avoid presenting WTO volume forecasts as sector-specific certainty",
  },
  {
    topicName: "Office Demand and Vacancy Real Estate Report",
    industryVertical: "Commercial Real Estate",
    structureType: "market segmentation chart",
    styleName: "Professional Report Editorial Style",
    sourcePublisher: "CBRE",
    sourceTitle: "Q1 2026 U.S. Office Market Report",
    sourceUrl: "https://www.cbre.com/insights/figures/q1-2026-us-office-market-report",
    sourcePublishedAt: "2026-04-01",
    sourceType: "industry_outlook",
    sourceQuote: "vacancy falling to 18.6%, rents rising 2.7%",
    sourceDataPoints: [
      { label: "Net absorption", value: "6.9", unit: "million sq ft", period: "Q1 2026", sourceLocation: "CBRE Q1 2026 office report" },
      { label: "Vacancy", value: "18.6%", period: "Q1 2026", sourceLocation: "CBRE Q1 2026 office report" },
      { label: "Rents", value: "+2.7%", period: "Q1 2026", sourceLocation: "CBRE Q1 2026 office report" },
    ],
    angle: "segment the CRE story through office-specific leasing, vacancy, and capital-market recovery signals",
    caution: "do not generalize office dynamics to every property type",
  },
  {
    topicName: "Future Factory Investment Report",
    industryVertical: "Manufacturing",
    structureType: "investment flow breakdown",
    styleName: "Consulting Insight Style",
    sourcePublisher: "Deloitte",
    sourceTitle: "2026 Manufacturing Industry Outlook",
    sourceUrl: "https://www.deloitte.com/us/en/insights/industry/manufacturing-industrial-products/manufacturing-industry-outlook.html",
    sourcePublishedAt: "2025-11-01",
    sourceType: "industry_outlook",
    sourceQuote: "companies have announced more than US$500 billion in private sector commitments",
    sourceDataPoints: [
      { label: "Private commitments", value: "US$500+", unit: "billion", period: "as of July 2025", sourceLocation: "Deloitte manufacturing outlook" },
      { label: "Domestic capacity", value: "projected tripling", period: "by 2032", sourceLocation: "Deloitte manufacturing outlook" },
      { label: "Jobs", value: "500,000+", period: "projected", sourceLocation: "Deloitte manufacturing outlook" },
    ],
    angle: "show how announced investment, capacity, and jobs fit together in the manufacturing buildout story",
    caution: "keep announced commitments separate from completed operational capacity",
  },
  {
    topicName: "Mobility Platform and Urban Transport Report",
    industryVertical: "Mobility",
    structureType: "operating model anatomy",
    styleName: "Market Trend Poster Style",
    sourcePublisher: "ITF/OECD",
    sourceTitle: "ITF Transport Outlook 2025",
    sourceUrl: "https://www.itf-oecd.org/itf-transport-outlook-2025",
    sourcePublishedAt: "2025-04-01",
    sourceType: "institution_report",
    sourceQuote: "Urban mobility systems are becoming more multimodal and data-driven.",
    sourceDataPoints: [
      { label: "Modes", value: "Ride-hailing, transit, micromobility", period: "2025", sourceLocation: "ITF outlook framing" },
      { label: "System concern", value: "Congestion and equity", period: "2025", sourceLocation: "ITF outlook framing" },
      { label: "Data layer", value: "Platform coordination", period: "2025", sourceLocation: "ITF outlook framing" },
    ],
    angle: "use a platform-operating-model lens rather than a simple demand chart",
    caution: "do not present app coordination as a substitute for transport planning",
  },
  {
    topicName: "Digital Health Access Report",
    industryVertical: "Digital Health",
    structureType: "consumer behavior map",
    styleName: "Professional Report Editorial Style",
    sourcePublisher: "McKinsey",
    sourceTitle: "Telehealth: A quarter-trillion-dollar post-COVID-19 reality?",
    sourceUrl: "https://www.mckinsey.com/industries/healthcare/our-insights/telehealth-a-quarter-trillion-dollar-post-covid-19-reality",
    sourcePublishedAt: "2025-01-01",
    sourceType: "professional_report",
    sourceQuote: "Telehealth is not a separate channel; it is becoming part of care delivery.",
    sourceDataPoints: [
      { label: "Behavior shift", value: "Virtual care normalizes", period: "2025", sourceLocation: "McKinsey telehealth insight" },
      { label: "Adoption dependency", value: "Reimbursement and trust", period: "2025", sourceLocation: "McKinsey telehealth insight" },
      { label: "Access value", value: "Monitoring and convenience", period: "2025", sourceLocation: "McKinsey telehealth insight" },
    ],
    angle: "focus on how patients and providers incorporate digital care into broader care journeys",
    caution: "avoid treating convenience gains as equivalent to outcome gains",
  },
  {
    topicName: "Food Security and Climate Pressure Report",
    industryVertical: "Agriculture",
    structureType: "sustainability impact map",
    styleName: "Institutional Research Dashboard Style",
    sourcePublisher: "FAO",
    sourceTitle: "The State of Food Security and Nutrition in the World 2025",
    sourceUrl: "https://www.fao.org/publications/sofi",
    sourcePublishedAt: "2025-07-01",
    sourceType: "institution_report",
    sourceQuote: "Food security depends on productivity, affordability and resilience.",
    sourceDataPoints: [
      { label: "Impact zone", value: "Yield and affordability", period: "2025", sourceLocation: "FAO SOFI summary" },
      { label: "Climate link", value: "Rising system risk", period: "2025", sourceLocation: "FAO SOFI summary" },
      { label: "Input link", value: "Cost and access pressure", period: "2025", sourceLocation: "FAO SOFI summary" },
    ],
    angle: "tie climate and affordability together through a sustainability-impact lens",
    caution: "do not compress multi-crop food systems into one weather outcome",
  },
  {
    topicName: "Retail Media and Margin Pressure Report",
    industryVertical: "Retail",
    structureType: "market size and driver breakdown",
    styleName: "Market Trend Poster Style",
    sourcePublisher: "Deloitte",
    sourceTitle: "2026 Retail Industry Global Outlook",
    sourceUrl: "https://www.deloitte.com/us/en/insights/industry/retail-distribution/retail-distribution-industry-outlook.html",
    sourcePublishedAt: "2026-01-01",
    sourceType: "industry_outlook",
    sourceQuote: "AI-driven commerce, reimagined marketing, resilient supply chains, and smarter margin management are converging",
    sourceDataPoints: [
      { label: "Demand driver", value: "Value-oriented consumers", period: "2026", sourceLocation: "Deloitte retail outlook" },
      { label: "Margin driver", value: "Pricing and mix discipline", period: "2026", sourceLocation: "Deloitte retail outlook" },
      { label: "Media driver", value: "Reimagined marketing", period: "2026", sourceLocation: "Deloitte retail outlook" },
    ],
    angle: "break the retail story into the specific drivers that reshape margin rather than only traffic and sales",
    caution: "do not read margin tools as a cure-all for consumer weakness",
  },
  {
    topicName: "Marketplace and Fulfillment E-commerce Report",
    industryVertical: "E-commerce",
    structureType: "value chain map",
    styleName: "Market Trend Poster Style",
    sourcePublisher: "UNCTAD",
    sourceTitle: "Digital Economy Report 2025",
    sourceUrl: "https://unctad.org/topic/ecommerce-and-digital-economy/digital-economy-report",
    sourcePublishedAt: "2025-09-01",
    sourceType: "institution_report",
    sourceQuote: "Digital commerce growth depends on logistics, trust, and platform reach.",
    sourceDataPoints: [
      { label: "Core chain", value: "Marketplace to fulfillment", period: "2025", sourceLocation: "UNCTAD report framing" },
      { label: "Commercial link", value: "Ads and payments", period: "2025", sourceLocation: "UNCTAD report framing" },
      { label: "Risk link", value: "Cross-border trust", period: "2025", sourceLocation: "UNCTAD report framing" },
    ],
    angle: "make the value chain explicit so the poster explains why marketplace scale still depends on operations and trust",
    caution: "avoid treating GMV-style growth as operational health by itself",
  },
  {
    topicName: "Streaming Churn and Ad Tier Report",
    industryVertical: "Streaming Media",
    structureType: "risk and opportunity matrix",
    styleName: "Market Trend Poster Style",
    sourcePublisher: "Deloitte",
    sourceTitle: "Digital Media Trends 2026",
    sourceUrl: "https://www.deloitte.com/us/en/insights/industry/technology/digital-media-trends-consumption-habits-survey.html",
    sourcePublishedAt: "2026-03-01",
    sourceType: "industry_outlook",
    sourceQuote: "Subscription fatigue and ad-supported models are reshaping streaming economics.",
    sourceDataPoints: [
      { label: "Risk", value: "Churn and fatigue", period: "2026", sourceLocation: "Deloitte Digital Media Trends" },
      { label: "Opportunity", value: "Ad-supported tiers", period: "2026", sourceLocation: "Deloitte Digital Media Trends" },
      { label: "Constraint", value: "Content cost discipline", period: "2026", sourceLocation: "Deloitte Digital Media Trends" },
    ],
    angle: "turn the streaming model into a clear trade-off matrix instead of a one-direction subscription story",
    caution: "do not assume ad tiers solve churn without content and pricing discipline",
  },
  {
    topicName: "Gaming Engagement and Revenue Mix Report",
    industryVertical: "Gaming",
    structureType: "market segmentation chart",
    styleName: "Market Trend Poster Style",
    sourcePublisher: "Newzoo",
    sourceTitle: "Global Games Market Report 2025",
    sourceUrl: "https://newzoo.com/resources/trend-reports/newzoo-global-games-market-report-2025-free-version",
    sourcePublishedAt: "2025-08-01",
    sourceType: "professional_report",
    sourceQuote: "Engagement does not automatically translate into revenue growth across platforms.",
    sourceDataPoints: [
      { label: "Segments", value: "Mobile, console, PC", period: "2025", sourceLocation: "Newzoo report summary" },
      { label: "Business model", value: "Live service", period: "2025", sourceLocation: "Newzoo report summary" },
      { label: "User signal", value: "Strong engagement", period: "2025", sourceLocation: "Newzoo report summary" },
    ],
    angle: "segment the gaming story so platform and monetization shifts are easy to compare visually",
    caution: "avoid reading user attention as identical to monetization quality",
  },
  {
    topicName: "AI Policy in Education Report",
    industryVertical: "EdTech",
    structureType: "policy impact map",
    styleName: "Professional Report Editorial Style",
    sourcePublisher: "UNESCO",
    sourceTitle: "Guidance for generative AI in education and research",
    sourceUrl: "https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research",
    sourcePublishedAt: "2023-09-07",
    sourceType: "government_report",
    sourceQuote: "aims to support countries to implement immediate actions, plan long-term policies",
    sourceDataPoints: [
      { label: "Policy goal", value: "Immediate plus long-term action", period: "2023", sourceLocation: "UNESCO guidance page" },
      { label: "Institutional AI policy", value: "19%", period: "2025", sourceLocation: "UNESCO higher education survey" },
      { label: "Frameworks in development", value: "42%", period: "2025", sourceLocation: "UNESCO higher education survey" },
    ],
    angle: "show how governance and adoption move together in AI-enabled education systems",
    caution: "do not confuse tool availability with policy readiness",
  },
  {
    topicName: "Climate Adaptation and Exposure Report",
    industryVertical: "Climate Risk",
    structureType: "resilience framework",
    styleName: "Institutional Research Dashboard Style",
    sourcePublisher: "IPCC",
    sourceTitle: "AR6 Synthesis Report: Climate Change 2023",
    sourceUrl: "https://www.ipcc.ch/report/ar6/syr/resources/spm-headline-statements/",
    sourcePublishedAt: "2023-03-20",
    sourceType: "government_report",
    sourceQuote: "many climate-related risks are higher than assessed in AR5",
    sourceDataPoints: [
      { label: "Risk comparison", value: "Higher than AR5", period: "2023", sourceLocation: "IPCC headline statements" },
      { label: "Impact path", value: "Losses escalate with warming", period: "2023", sourceLocation: "IPCC headline statements" },
      { label: "Adaptation need", value: "Urgent and multi-horizon", period: "2023", sourceLocation: "IPCC synthesis report" },
    ],
    angle: "make resilience a framework that links exposure, adaptation and losses over time",
    caution: "avoid turning resilience language into a claim that risk is easily neutralized",
  },
  {
    topicName: "Water Security and Infrastructure Report",
    industryVertical: "Water",
    structureType: "infrastructure demand map",
    styleName: "Institutional Research Dashboard Style",
    sourcePublisher: "World Bank",
    sourceTitle: "Water security for 1 billion people initiative / High and Dry",
    sourceUrl: "https://www.worldbank.org/en/news/press-release/2026/04/15/world-bank-group-launches-initiative-to-improve-water-security-for-1-billion-people",
    sourcePublishedAt: "2026-04-15",
    sourceType: "institution_report",
    sourceQuote: "Water is foundational to how economies function.",
    sourceDataPoints: [
      { label: "People targeted", value: "1", unit: "billion", sourceLocation: "World Bank water security press release" },
      { label: "Economic risk", value: "Growth, migration, conflict", period: "ongoing", sourceLocation: "World Bank High and Dry summary" },
      { label: "System response", value: "Reliable water services at scale", period: "2026", sourceLocation: "World Bank water security press release" },
    ],
    angle: "show water infrastructure demand as an economic-function story rather than only a utility service story",
    caution: "do not flatten water stress into one engineering project type",
  },
  {
    topicName: "Circular Materials and Recycling Report",
    industryVertical: "Circular Economy",
    structureType: "transformation roadmap",
    styleName: "Institutional Research Dashboard Style",
    sourcePublisher: "UNEP",
    sourceTitle: "Global Waste Management Outlook 2024",
    sourceUrl: "https://www.unep.org/ietc/resources/report/global-waste-management-outlook-2024",
    sourcePublishedAt: "2024-02-28",
    sourceType: "government_report",
    sourceQuote: "By ending uncontrolled disposal, reducing waste generation, and increasing recycling",
    sourceDataPoints: [
      { label: "Net gain potential", value: "US$108.1", unit: "billion", period: "annual by 2050", sourceLocation: "UNEP waste story" },
      { label: "Uncollected waste", value: "25%", period: "global", sourceLocation: "UNEP waste story" },
      { label: "Uncontrolled facilities", value: "39%", period: "global", sourceLocation: "UNEP waste story" },
    ],
    angle: "turn circularity into a stepwise roadmap from collection quality to recycling and net economic gains",
    caution: "avoid treating recycling alone as the full circular-economy answer",
  },
];

type GeneratedIndustryImage = {
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

type GeneratedManifest = { templates?: Record<string, GeneratedIndustryImage> };

function readGeneratedTemplateManifest() {
  const manifestPath = path.join(process.cwd(), "src/lib/industry-report-generated-images.json");
  if (!existsSync(manifestPath)) return {} as Record<string, GeneratedIndustryImage>;
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as GeneratedManifest;
    return parsed.templates || {};
  } catch {
    return {} as Record<string, GeneratedIndustryImage>;
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

function quoteWordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function inferCopyrightRiskLevel(sourcePublisher: string) {
  if (
    /IEA|IRENA|World Bank|WTO|UNCTAD|UN Tourism|UNESCO|FAO|OECD|IPCC|UNEP|IFR|IATA/i.test(
      sourcePublisher,
    )
  ) {
    return "low" as const;
  }
  return "medium" as const;
}

function buildSourceSummary(topic: Topic) {
  const keyMetrics = topic.sourceDataPoints
    .slice(0, 2)
    .map((point) => point.label.toLowerCase())
    .join(" and ");
  return `${topic.sourcePublisher}'s ${topic.sourceTitle} is used as the primary report source for this ${topic.industryVertical.toLowerCase()} visual. The infographic keeps the direct quote short and separate from the original explanation, then translates report-backed signals such as ${keyMetrics} into a structured ${topic.structureType} view that helps readers understand industry direction, operating pressure, and system context without copying long source text.`;
}

function buildKnowledgePoints(topic: Topic, index: number) {
  const primary = topic.sourceDataPoints[0];
  const secondary = topic.sourceDataPoints[1];
  const tertiary = topic.sourceDataPoints[2];
  const openings = [
    `The report treats ${primary.label.toLowerCase()} as a lead indicator rather than a side statistic.`,
    `A useful first read of this report starts with ${primary.label.toLowerCase()}, because it anchors the rest of the sector story.`,
    `${primary.label} acts as the clearest starting point for understanding this ${topic.industryVertical.toLowerCase()} report.`,
    `The strongest signal in this report is ${primary.label.toLowerCase()}, which sets the tone for the rest of the analysis.`,
  ];
  const structureLines = [
    `The chosen ${topic.structureType} layout helps separate drivers, bottlenecks, and outcomes instead of collapsing them into one summary box.`,
    `Using a ${topic.structureType} structure makes it easier to compare where the report describes momentum versus where it describes constraint.`,
    `The ${topic.structureType} format is useful here because the report describes multiple linked forces, not a single headline trend.`,
    `This ${topic.structureType} view is deliberately built to keep system relationships visible on a phone screen.`,
  ];
  const dataLines = secondary
    ? [
        `${secondary.label} adds a second lens, helping readers see how the report balances scale with operating context.`,
        `${secondary.label} shows that the report is not only about one metric, but about how several signals move together.`,
        `The inclusion of ${secondary.label.toLowerCase()} keeps the poster grounded in report structure instead of generic commentary.`,
        `${secondary.label} helps the visual explain whether the report is highlighting growth, cost, risk, or execution pressure.`,
      ]
    : [];
  const quoteLines = [
    `The quoted line, "${topic.sourceQuote}", is kept short so the page distinguishes direct report wording from KnowLens' original explanation.`,
    `The report quote is presented as source language, while the surrounding sections stay original and explanatory.`,
    `The short quote works as a report anchor, not as the whole narrative; the interpretation remains separate and structured.`,
  ];
  const cautionLines = [
    `A careful reading also requires context: ${topic.caution}.`,
    `One important limit in the report framing is that ${topic.caution}.`,
    `The poster keeps one risk note visible: ${topic.caution}.`,
  ];
  const tertiaryLine = tertiary
    ? `${tertiary.label} gives the poster a third source-backed dimension so the topic does not read like a single-metric claim.`
    : `${topic.angle.charAt(0).toUpperCase()}${topic.angle.slice(1)}.`;

  return [
    openings[index % openings.length],
    structureLines[index % structureLines.length],
    dataLines[index % Math.max(dataLines.length, 1)] || tertiaryLine,
    quoteLines[index % quoteLines.length],
    tertiaryLine,
    cautionLines[index % cautionLines.length],
  ].filter((item, itemIndex, source) => Boolean(item) && source.indexOf(item) === itemIndex).slice(0, 6);
}

function buildImageDescription(topic: Topic) {
  const metrics = topic.sourceDataPoints
    .slice(0, 2)
    .map((point) => `${point.label.toLowerCase()} ${point.value}${point.unit ? ` ${point.unit}` : ""}`)
    .join(" and ");
  return `This 9:16 industry report infographic poster explains ${topic.industryVertical.toLowerCase()} through ${topic.sourcePublisher}'s ${topic.sourceTitle}, using the short quote "${topic.sourceQuote}" and source-backed signals such as ${metrics}. The visual focuses on report interpretation, structure, and industry context rather than unsupported forecasts.`;
}

function buildVisibleDescription(topic: Topic, primaryKeyword: string, generatorKeyword: string) {
  return `This ${primaryKeyword} turns ${topic.sourcePublisher}'s ${topic.sourceTitle} into a source-aware visual built for faster reading and stronger context. Instead of repeating the report verbatim, the poster separates the short direct quote from the original explanation, organizes verified report signals into a ${topic.structureType} layout, and highlights what matters most for ${topic.industryVertical.toLowerCase()} readers: structure, pressure points, and key directional shifts. As an ${generatorKeyword}, it helps teams, analysts, students, and creators understand the report's core message on mobile and desktop without drifting into investment advice or unsupported claims.`;
}

function buildSecondaryKeywords(topic: Topic) {
  return [
    `${topic.industryVertical} report infographic`,
    `${topic.industryVertical} industry insight poster`,
    `${topic.structureType} infographic`,
    `${topic.industryVertical.toLowerCase()} report visual`,
  ];
}

function buildTemplate(topic: Topic, index: number) {
  const slug = slugify(topic.topicName);
  const generated = readGeneratedTemplateManifest()[slug];
  const updatedAt = generated?.updatedAt || "2026-06-14T00:00:00.000Z";
  const title = `${topic.topicName} Poster Template`;
  const primaryKeyword = `${topic.topicName} poster`;
  const detailPath = `/infographic/industry-report/${slug}/`;
  const canonicalUrl = siteUrl + detailPath;
  const stylePrompt = stylePrompts[topic.styleName];
  const sourceSummary = buildSourceSummary(topic);
  const knowledgePoints = buildKnowledgePoints(topic, index);
  const metricsText = topic.sourceDataPoints
    .map(
      (point) =>
        `${point.label}: ${point.value}${point.unit ? ` ${point.unit}` : ""}${point.period ? ` (${point.period})` : ""}`,
    )
    .join("; ");
  const topicPrompt = `Create a high-quality 9:16 industry report infographic poster about ${topic.industryVertical}. Use ${topic.structureType}. Source: ${topic.sourcePublisher} / ${topic.sourceTitle}. Focus on a verified professional report source, one short original report quote, accurate data points, clear industry insight explanation, and strong visual hierarchy.`;
  const imageDescription = buildImageDescription(topic);
  const visibleDescription = buildVisibleDescription(
    topic,
    primaryKeyword,
    generatorKeywords[index % generatorKeywords.length],
  );
  const contentPrompt =
    `Create a professional 9:16 industry report infographic poster about ${topic.topicName}. Structure type: ${topic.structureType}. Source: ${topic.sourcePublisher} - ${topic.sourceTitle}. Source URL must be represented as a clear citation label. Use this short source quote only: "${topic.sourceQuote}" Keep the quote visually distinct from the original summary. Verified report signals to show: ${metricsText}. Industry focus: ${topic.angle}. Risk context: ${topic.caution}. Use original explanatory sections, short labels, readable source-aware notes, clear metric blocks, and a mobile-readable layout. Do not copy long copyrighted text. Do not include investment advice, buy or sell language, ratings, target prices, or unsupported forecasts.`;
  const finalPrompt = [stylePrompt, contentPrompt, aspectRatioPrompt, qualityPrompt].join("\n\n");
  const imageFilename = `industry-report-${slug}.webp`;

  return {
    id: `industry-report-template-${String(index + 1).padStart(3, "0")}`,
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
    industryVertical: topic.industryVertical,
    structureType: topic.structureType,
    slug,
    detailPath,
    canonicalUrl,
    topicName: topic.topicName,
    title,
    primaryKeyword,
    secondaryKeywords: buildSecondaryKeywords(topic),
    topicPrompt,
    knowledgePoints,
    contentPrompt,
    imageDescription,
    visibleDescription,
    h1: title,
    seoTitle: `${title} - KnowLens AI`,
    metaDescription: `Explore this ${topic.topicName.toLowerCase()} template with a verified source quote, structured analysis, and clear industry context. Create a similar visual with KnowLens AI.`,
    generatorKeywords: generatorKeywords.slice(index % 2, index % 2 + 4),
    previewImagePath:
      generated?.previewImagePath ||
      (generated?.previewImageUrl ? new URL(generated.previewImageUrl).pathname : "/picture/text-to-ppt-hero.jpg"),
    previewImageUrl: generated?.previewImageUrl || `${siteUrl}/picture/text-to-ppt-hero.jpg`,
    storageKey: generated?.storageKey || `infographic/industry-report/${imageFilename}`,
    imageFilename: generated?.imageFilename || imageFilename,
    imageFormat: generated?.imageFormat || ("webp" as const),
    imageMimeType: generated?.imageMimeType || "image/webp",
    imageWidth: generated?.imageWidth || 1024,
    imageHeight: generated?.imageHeight || 1792,
    imageSizeBytes: generated?.imageSizeBytes,
    aspectRatio,
    imageAlt: `${topic.industryVertical} industry report infographic poster`,
    imageTitle: title,
    imageCaption: `${topic.topicName} poster created from a verified professional report source with KnowLens AI.`,
    styleName: topic.styleName,
    stylePrompt,
    aspectRatioPrompt,
    qualityPrompt,
    finalPrompt,
    createSimilarPrompt: `Create a high-quality 9:16 industry report infographic poster about ${topic.industryVertical}. Use ${topic.styleName}. Focus on a verified professional report source, one short original report quote, accurate data points, clear industry insight explanation, and strong visual hierarchy. Keep the design source-aware, polished, useful, and professional. Do not copy long copyrighted text and do not provide investment advice.`,
    sourceRequired: true as const,
    sourcePublisher: topic.sourcePublisher,
    sourceTitle: topic.sourceTitle,
    sourceUrl: topic.sourceUrl,
    sourcePublishedAt: topic.sourcePublishedAt,
    sourceAccessedAt,
    sourceDocumentType: topic.sourceType,
    sourceQuote: topic.sourceQuote,
    sourceQuoteWordCount: quoteWordCount(topic.sourceQuote),
    sourceQuoteLanguage: "en" as const,
    sourceSummary,
    sourceDataPoints: topic.sourceDataPoints,
    licenseName: /iea.org/.test(topic.sourceUrl) ? "CC BY 4.0" : undefined,
    licenseUrl: /iea.org/.test(topic.sourceUrl) ? "https://creativecommons.org/licenses/by/4.0/" : undefined,
    attributionText: /iea.org/.test(topic.sourceUrl)
      ? `${topic.sourcePublisher} (${topic.sourcePublishedAt}), ${topic.sourceTitle}`
      : undefined,
    copyrightRiskLevel: inferCopyrightRiskLevel(topic.sourcePublisher),
    sourceUsageMode: "short_quote_plus_original_summary" as const,
    shortDescription: `A source-aware ${topic.industryVertical.toLowerCase()} infographic poster template built from ${topic.sourcePublisher}'s report findings.`,
    useCases: ["industry education", "report explainers", "strategy briefings", "visual research summaries"],
    targetAudience: ["analysts", "operators", "students", "creators", "strategy teams"],
    tags: Array.from(
      new Set([
        "industry-report",
        "infographic",
        topic.industryVertical.toLowerCase(),
        topic.structureType,
        ...slug.split("-").slice(0, 8),
      ]),
    ),
    relatedTemplateIds: [] as string[],
    relatedCategorySlugs: ["industry-report", "business", "infographic-examples"],
    relatedToolSlugs: ["ai-infographic-generator", "infographic-maker", "educational-infographic-maker"],
    allowPublicDownload: false as const,
    createdAt: "2026-06-14T00:00:00.000Z",
    updatedAt,
  };
}

const selectedTopics = topics.slice(0, 50);

export function getIndustryReportTemplates() {
  return selectedTopics.map(buildTemplate).map((template, index, source) => ({
    ...template,
    relatedTemplateIds: source
      .filter((item) => item.id !== template.id && item.generationStatus === "success")
      .slice(Math.max(0, index - 2), index + 8)
      .filter((item) => item.id !== template.id)
      .slice(0, 6)
      .map((item) => item.id),
  }));
}

export const industryReportTemplates = getIndustryReportTemplates();

export type IndustryReportTemplate = ReturnType<typeof buildTemplate>;

export function getIndustryReportTemplate(slug: string) {
  return getIndustryReportTemplates().find((template) => template.slug === slug);
}
