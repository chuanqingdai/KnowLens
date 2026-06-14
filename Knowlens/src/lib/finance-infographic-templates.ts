import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const siteUrl = "https://knowlens.ai";
const categorySlug = "financial-report";
const categoryName = "Financial Report";
const categoryKeyword = "Financial Report Infographic Templates";
const batchId = "finance-report-insights-tuzi-50";
const batchTopic = "Finance Report Insights";
const aspectRatio = "9:16";
const aspectRatioPrompt = "Aspect ratio: 9:16";

const generatorKeywords = [
  "Financial Report Infographic Generator",
  "Earnings Infographic Generator",
  "Market Report Infographic Maker",
  "Finance Infographic Generator",
  "AI Infographic Generator",
  "Business Infographic Maker",
];

const qualityPrompt =
  "Create a high-quality professional 9:16 financial report infographic poster with a clear information hierarchy, accurate English labels, verified financial numbers from official or reputable sources, clear source attribution, precise data visualization, no spelling or grammar mistakes, no incorrect or distorted charts, no invented facts, no long copyrighted text, no investment advice, and a polished editorial layout with balanced spacing, readable typography, strong numeric hierarchy, source-aware sections, data-rich explanations, and mobile-friendly readability.";

const stylePrompts = {
  "Financial Editorial Report Style":
    "Financial Editorial Report Style: Use a premium financial editorial infographic poster style. The image should feel credible, polished, analytical, and suitable for earnings reports, institutional research summaries, market insight posters, and business media visual explainers. Use a 9:16 layout with a large readable headline, source label, key quote or insight section, verified metric blocks, and structured explanation areas. Use a professional sans-serif font with strong numeric hierarchy, readable English labels, and clear explanatory text. Use a white or light background with navy, slate, blue, green, muted gold, and soft gray accents. Keep the visual elegant, source-aware, data-rich, readable, and not visually chaotic.",
  "Dark Premium Finance Insight Style":
    "Dark Premium Finance Insight Style: Use a dark premium finance infographic poster style. The image should feel high-end, serious, modern, and suitable for major company earnings, market analysis, financial media insights, banking, semiconductors, AI infrastructure, and institutional report summaries. Use a dark navy, black, or charcoal background with bright readable numbers, a clear source citation area, structured information blocks, and refined financial visual styling. Use a clean modern sans-serif font with strong contrast and clear English labels. Use controlled blue, green, cyan, gold, violet, and white accents. Keep the visual premium, polished, data-rich, readable, and not cluttered.",
  "Data Dashboard Finance Style":
    "Data Dashboard Finance Style: Use a modern data dashboard infographic poster style. The image should feel structured, precise, analytical, and suitable for financial KPIs, segment performance, margin analysis, market data, and source-backed report insights. Use a clean 9:16 dashboard layout with metric blocks, chart-like areas, quote or source panels, and organized explanatory notes. Use a professional sans-serif font with strong numeric hierarchy, readable labels, and clear English text. Use a light gray or white background with navy, cyan, green, amber, muted red, and slate accents. Keep the image polished, data-driven, information-rich, readable, and visually balanced.",
  "Business Model Breakdown Style":
    "Business Model Breakdown Style: Use a polished business model breakdown infographic poster style. The image should feel clear, strategic, analytical, and suitable for explaining how a company makes money, how segments contribute to revenue, how margins work, and how market trends affect business units. Use a 9:16 layout with a strong title, company/source label, segmented business blocks, flow arrows, metric cards, and explanatory notes. Use a clean professional sans-serif font with clear English labels and strong visual hierarchy. Use a white, cream, navy, green, blue, and muted gold palette. Keep the visual business-oriented, structured, source-backed, and easy to scan.",
  "Institutional Research Summary Style":
    "Institutional Research Summary Style: Use a refined institutional research infographic poster style. The image should feel formal, credible, policy-aware, and suitable for IMF, BIS, OECD, World Bank, central bank, consulting firm, or professional research report summaries. Use a 9:16 layout with a report title area, source and date label, key thesis section, data points, risk map, and concise interpretation blocks. Use a professional serif or sans-serif title with clean readable English body text. Use navy, white, gray, muted gold, teal, and slate accents. Keep the visual authoritative, data-rich, calm, and easy to read.",
  "Market Media Quote Style":
    "Market Media Quote Style: Use a premium market media quote infographic poster style. The image should feel editorial, timely, sharp, and suitable for short media quotes, market headlines, analyst commentary, and financial news visual summaries. Use a 9:16 layout with a large headline, short quoted excerpt, source label, key numbers, and original explanatory sections. Use an elegant editorial title font with clean readable English body text. Use deep blue, cream, slate, muted red, green, and gold accents. Keep the visual polished, source-attributed, modern, shareable, and not sensationalized.",
} as const;

type StyleName = keyof typeof stylePrompts;
type SourceType = "official_company_report" | "institution_report" | "government_report" | "media_article" | "research_report";

type SourceDataPoint = {
  label: string;
  value: string;
  unit?: string;
  period?: string;
  sourceLocation?: string;
};

type FinanceTopic = {
  topicName: string;
  structureType: string;
  styleName: StyleName;
  sourcePublisher: string;
  sourceTitle: string;
  sourceUrl: string;
  sourcePublishedAt: string;
  sourceType: SourceType;
  sourceQuote: string;
  sourceSummary: string;
  sourceDataPoints: SourceDataPoint[];
  angle: string;
  riskNote: string;
};

const topics: FinanceTopic[] = [
  ["Nvidia AI Data Center Revenue Insight", "capex and demand cycle", "Dark Premium Finance Insight Style", "NVIDIA Investor Relations", "NVIDIA Fiscal 2025 Form 10-K", "https://investor.nvidia.com/financial-info/annual-reports-and-proxies/default.aspx", "2025-02-26", "Data Center revenue was $115.2 billion in fiscal 2025.", [["Data Center revenue", "$115.2", "billion", "FY2025"], ["Total revenue", "$130.5", "billion", "FY2025"], ["Gross margin", "75.0%", "", "FY2025"]], "show Data Center as the central AI infrastructure revenue engine", "supply, customer concentration, and infrastructure cycle risk should stay visible"],
  ["Microsoft Cloud Growth and AI Capex Insight", "capex and demand cycle", "Data Dashboard Finance Style", "Microsoft Investor Relations", "Microsoft Fiscal 2024 Form 10-K", "https://www.microsoft.com/en-us/Investor/annual-reports.aspx", "2024-07-30", "Microsoft Cloud revenue was $135.0 billion in fiscal year 2024.", [["Microsoft Cloud revenue", "$135.0", "billion", "FY2024"], ["Capital expenditures", "$44.5", "billion", "FY2024"], ["Total revenue", "$245.1", "billion", "FY2024"]], "connect cloud revenue scale with AI infrastructure spending", "capex intensity should not be presented as a guaranteed growth forecast"],
  ["Amazon AWS Margin vs Retail Profitability", "margin bridge", "Business Model Breakdown Style", "Amazon Investor Relations", "Amazon 2024 Form 10-K", "https://ir.aboutamazon.com/annual-reports-proxies-and-shareholder-letters/default.aspx", "2025-02-07", "AWS net sales were $107.6 billion in 2024.", [["AWS net sales", "$107.6", "billion", "2024"], ["AWS operating income", "$39.8", "billion", "2024"], ["North America operating income", "$25.0", "billion", "2024"]], "contrast AWS profit contribution with retail segment economics", "segment profit should be separated from consolidated cash flow"],
  ["Alphabet Search Ads and AI Investment Insight", "revenue mix chart", "Financial Editorial Report Style", "Alphabet Investor Relations", "Alphabet 2024 Form 10-K", "https://abc.xyz/investor/", "2025-02-05", "Google Search and other revenues were $198.1 billion in 2024.", [["Google Search and other", "$198.1", "billion", "2024"], ["Total revenues", "$350.0", "billion", "2024"], ["Capital expenditures", "$52.5", "billion", "2024"]], "separate Search advertising scale from AI infrastructure investment", "regulatory, traffic acquisition, and capex context should be neutral"],
  ["Meta Advertising Growth and AI Infrastructure Spend", "capex and demand cycle", "Dark Premium Finance Insight Style", "Meta Investor Relations", "Meta Platforms 2024 Form 10-K", "https://investor.fb.com/financials/", "2025-01-30", "Advertising revenue was $160.6 billion in 2024.", [["Advertising revenue", "$160.6", "billion", "2024"], ["Total revenue", "$164.5", "billion", "2024"], ["Capital expenditures", "$39.2", "billion", "2024"]], "show advertising as the funding base for AI infrastructure expansion", "AI spending should be shown as an investment requirement, not a return guarantee"],
  ["Apple Services Revenue and Hardware Cycle", "segment breakdown", "Financial Editorial Report Style", "Apple Investor Relations", "Apple Fiscal 2024 Form 10-K", "https://investor.apple.com/sec-filings/default.aspx", "2024-11-01", "Services net sales were $96.2 billion in 2024.", [["Services net sales", "$96.2", "billion", "FY2024"], ["iPhone net sales", "$201.2", "billion", "FY2024"], ["Total net sales", "$391.0", "billion", "FY2024"]], "place recurring services beside the larger hardware cycle", "device replacement timing should not be turned into a demand forecast"],
  ["Tesla Automotive Margin and Delivery Trend", "trend timeline", "Data Dashboard Finance Style", "Tesla Investor Relations", "Tesla 2024 Form 10-K", "https://ir.tesla.com/#quarterly-disclosure", "2025-01-30", "Vehicle deliveries were approximately 1.79 million in 2024.", [["Vehicle deliveries", "1.79", "million", "2024"], ["Automotive revenue", "$77.1", "billion", "2024"], ["Total revenues", "$97.7", "billion", "2024"]], "connect unit deliveries with automotive revenue and margin context", "pricing, mix, and production utilization should be shown as context"],
  ["Netflix Paid Membership and Operating Margin", "data snapshot", "Financial Editorial Report Style", "Netflix Investor Relations", "Netflix 2024 Form 10-K", "https://ir.netflix.net/financials/annual-reports-and-proxies/default.aspx", "2025-01-24", "Paid memberships were 301.6 million at year-end 2024.", [["Paid memberships", "301.6", "million", "2024"], ["Revenue", "$39.0", "billion", "2024"], ["Operating margin", "27.0%", "", "2024"]], "show membership scale beside operating leverage", "content cost and regional mix should remain separate from subscriber count"],
  ["Adobe Subscription Revenue and AI Creative Tools", "business model anatomy", "Business Model Breakdown Style", "Adobe Investor Relations", "Adobe Fiscal 2024 Form 10-K", "https://www.adobe.com/investor-relations/financial-documents.html", "2025-01-17", "Subscription revenue was $19.6 billion in fiscal 2024.", [["Subscription revenue", "$19.6", "billion", "FY2024"], ["Total revenue", "$21.5", "billion", "FY2024"], ["Digital Media revenue", "$15.9", "billion", "FY2024"]], "explain subscription revenue as the monetization base for creative software", "AI product narrative should not imply unreported standalone revenue"],
  ["Salesforce RPO and SaaS Revenue Durability", "source quote + data explanation", "Data Dashboard Finance Style", "Salesforce Investor Relations", "Salesforce Fiscal 2025 Form 10-K", "https://investor.salesforce.com/financials/sec-filings/default.aspx", "2025-03-05", "Remaining performance obligation was approximately $63.4 billion.", [["Total revenue", "$37.9", "billion", "FY2025"], ["Remaining performance obligation", "$63.4", "billion", "FY2025"], ["Subscription and support revenue", "$35.7", "billion", "FY2025"]], "use RPO to explain contracted revenue visibility", "RPO should not be framed as guaranteed recognized revenue timing"],
  ["TSMC AI Chip Demand and Foundry Margin", "industry cycle chart", "Dark Premium Finance Insight Style", "TSMC Investor Relations", "TSMC 2024 Annual Report", "https://investor.tsmc.com/english/annual-reports", "2025-04-01", "Net revenue was NT$2,894.3 billion in 2024.", [["Net revenue", "NT$2,894.3", "billion", "2024"], ["Gross margin", "56.1%", "", "2024"], ["HPC revenue share", "51%", "", "2024"]], "connect HPC platform mix with foundry margin performance", "semiconductor cycle timing should remain source-neutral"],
  ["ASML EUV Backlog and Semiconductor Cycle", "industry cycle chart", "Dark Premium Finance Insight Style", "ASML Investor Relations", "ASML 2024 Annual Report", "https://www.asml.com/en/investors/annual-report", "2025-02-19", "Net sales were EUR28.3 billion in 2024.", [["Net sales", "EUR28.3", "billion", "2024"], ["Gross margin", "51.3%", "", "2024"], ["Backlog", "EUR36.3", "billion", "2024 year-end"]], "explain EUV and backlog as equipment-cycle indicators", "backlog should not be shown as risk-free revenue conversion"],
  ["AMD Data Center GPU Growth", "data snapshot", "Dark Premium Finance Insight Style", "AMD Investor Relations", "AMD 2024 Form 10-K", "https://ir.amd.com/financial-information/annual-reports", "2025-02-05", "Data Center segment revenue was $12.6 billion in 2024.", [["Data Center revenue", "$12.6", "billion", "2024"], ["Total net revenue", "$25.8", "billion", "2024"], ["Gross margin", "49%", "", "2024"]], "show Data Center as a larger part of AMD revenue mix", "GPU growth should stay within reported segment disclosures"],
  ["Broadcom AI Networking Revenue", "segment breakdown", "Data Dashboard Finance Style", "Broadcom Investor Relations", "Broadcom Fiscal 2024 Form 10-K", "https://investors.broadcom.com/financial-information/annual-reports", "2024-12-20", "Semiconductor solutions revenue was $30.1 billion in fiscal 2024.", [["Semiconductor solutions revenue", "$30.1", "billion", "FY2024"], ["Infrastructure software revenue", "$21.5", "billion", "FY2024"], ["Total net revenue", "$51.6", "billion", "FY2024"]], "split chip revenue from infrastructure software after acquisition effects", "AI networking should not be overstated beyond reported category commentary"],
  ["Intel Foundry Strategy and Margin Pressure", "risk factor map", "Data Dashboard Finance Style", "Intel Investor Relations", "Intel 2024 Form 10-K", "https://www.intc.com/filings-reports/annual-reports-proxies/default.aspx", "2025-01-31", "Intel Foundry operating loss was $13.4 billion in 2024.", [["Total revenue", "$53.1", "billion", "2024"], ["Gross margin", "32.7%", "", "2024"], ["Intel Foundry operating loss", "$13.4", "billion", "2024"]], "map foundry transition costs beside consolidated margin pressure", "turnaround language should be avoided"],
  ["Samsung Memory Recovery Cycle", "industry cycle chart", "Dark Premium Finance Insight Style", "Samsung Electronics Investor Relations", "Samsung Electronics 2024 Business Report", "https://www.samsung.com/global/ir/reports-disclosures/business-report/", "2025-03-01", "2024 revenue was KRW300.9 trillion.", [["Revenue", "KRW300.9", "trillion", "2024"], ["Operating profit", "KRW32.7", "trillion", "2024"], ["Device Solutions revenue", "KRW111.1", "trillion", "2024"]], "frame memory recovery through profit rebound and chip segment scale", "memory price direction should not be guessed"],
  ["Micron DRAM and HBM Demand", "industry cycle chart", "Dark Premium Finance Insight Style", "Micron Investor Relations", "Micron Fiscal 2024 Form 10-K", "https://investors.micron.com/sec-filings", "2024-10-04", "Fiscal 2024 revenue was $25.1 billion.", [["Revenue", "$25.1", "billion", "FY2024"], ["DRAM revenue share", "69%", "", "FY2024"], ["NAND revenue share", "30%", "", "FY2024"]], "show DRAM as the largest revenue category and HBM as AI memory context", "do not invent HBM capacity or pricing data"],
  ["Arm Licensing and Royalty Revenue", "business model anatomy", "Business Model Breakdown Style", "Arm Investor Relations", "Arm Fiscal 2025 Form 20-F", "https://investors.arm.com/financials/sec-filings/default.aspx", "2025-05-29", "Total revenue was $4.0 billion in fiscal 2025.", [["Total revenue", "$4.0", "billion", "FY2025"], ["Royalty revenue", "$2.2", "billion", "FY2025"], ["License and other revenue", "$1.8", "billion", "FY2025"]], "contrast upfront license fees with recurring royalties", "chip unit shipment assumptions should not be added"],
  ["Qualcomm Smartphone and Auto Chip Mix", "revenue mix chart", "Data Dashboard Finance Style", "Qualcomm Investor Relations", "Qualcomm Fiscal 2024 Form 10-K", "https://investor.qualcomm.com/financial-information/annual-reports", "2024-11-06", "QCT handset revenue was $24.9 billion in fiscal 2024.", [["QCT handset revenue", "$24.9", "billion", "FY2024"], ["QCT automotive revenue", "$2.9", "billion", "FY2024"], ["Total revenues", "$39.0", "billion", "FY2024"]], "show handset dependence and automotive diversification in one mix view", "smartphone cycle forecasts should be excluded"],
  ["Dell AI Server Demand", "capex and demand cycle", "Dark Premium Finance Insight Style", "Dell Technologies Investor Relations", "Dell Fiscal 2025 Form 10-K", "https://investors.delltechnologies.com/financial-information/sec-filings", "2025-03-27", "Infrastructure Solutions Group revenue was $43.6 billion.", [["ISG revenue", "$43.6", "billion", "FY2025"], ["Servers and networking revenue", "$27.6", "billion", "FY2025"], ["Total net revenue", "$95.6", "billion", "FY2025"]], "connect AI server demand with ISG and server networking revenue", "orders and backlog should not be treated as immediate revenue"],
  ["JPMorgan Net Interest Income and Deposit Trend", "data snapshot", "Financial Editorial Report Style", "JPMorgan Chase Investor Relations", "JPMorgan Chase 2024 Form 10-K", "https://www.jpmorganchase.com/ir/annual-report", "2025-02-21", "Net interest income was $92.7 billion in 2024.", [["Net interest income", "$92.7", "billion", "2024"], ["Average deposits", "$2.4", "trillion", "2024"], ["Net income", "$58.5", "billion", "2024"]], "show bank spread income beside deposit scale", "rate sensitivity should not be forecast"],
  ["Bank of America Net Interest Yield", "data snapshot", "Financial Editorial Report Style", "Bank of America Investor Relations", "Bank of America 2024 Form 10-K", "https://investor.bankofamerica.com/regulatory-and-other-filings/annual-reports-and-proxy-statements", "2025-02-19", "Net interest income was $56.9 billion in 2024.", [["Net interest income", "$56.9", "billion", "2024"], ["Net interest yield", "1.92%", "", "2024"], ["Net income", "$27.1", "billion", "2024"]], "explain yield as the spread bridge behind NII", "future rate moves should not be implied"],
  ["Visa Cross-Border Volume and Payment Network", "business model anatomy", "Business Model Breakdown Style", "Visa Investor Relations", "Visa Fiscal 2024 Form 10-K", "https://investor.visa.com/financial-information/sec-filings/default.aspx", "2024-11-13", "Cross-border volume grew 15% in fiscal 2024.", [["Net revenue", "$35.9", "billion", "FY2024"], ["Payments volume", "$16.0", "trillion", "FY2024"], ["Cross-border volume growth", "15%", "", "FY2024"]], "show payment volume, cross-border activity, and revenue as distinct layers", "network growth should not become a stock thesis"],
  ["Mastercard Switched Transactions Growth", "data snapshot", "Data Dashboard Finance Style", "Mastercard Investor Relations", "Mastercard 2024 Form 10-K", "https://investor.mastercard.com/financials/sec-filings/default.aspx", "2025-02-14", "Switched transactions were 159.0 billion in 2024.", [["Switched transactions", "159.0", "billion", "2024"], ["Net revenue", "$28.2", "billion", "2024"], ["Gross dollar volume", "$9.8", "trillion", "2024"]], "explain switched transactions as processing activity, not revenue", "consumer spending interpretation should stay neutral"],
  ["American Express Card Member Spending", "data snapshot", "Financial Editorial Report Style", "American Express Investor Relations", "American Express 2024 Form 10-K", "https://ir.americanexpress.com/financials/sec-filings/default.aspx", "2025-02-07", "Card Member spending was $1.6 trillion in 2024.", [["Card Member spending", "$1.6", "trillion", "2024"], ["Total revenues net of interest expense", "$65.9", "billion", "2024"], ["Net income", "$10.1", "billion", "2024"]], "connect spend volume with fee and lending economics", "credit exposure should not be simplified away"],
  ["BlackRock AUM and ETF Flow", "revenue mix chart", "Financial Editorial Report Style", "BlackRock Investor Relations", "BlackRock 2024 Form 10-K", "https://ir.blackrock.com/financials/sec-filings/default.aspx", "2025-02-21", "Assets under management were $11.6 trillion at year-end 2024.", [["AUM", "$11.6", "trillion", "2024 year-end"], ["Long-term net inflows", "$390", "billion", "2024"], ["Revenue", "$20.4", "billion", "2024"]], "show AUM scale and inflow mechanics for an asset manager", "fund recommendations must be excluded"],
  ["Berkshire Hathaway Cash Position and Insurance Float", "cash flow profile", "Financial Editorial Report Style", "Berkshire Hathaway", "Berkshire Hathaway 2024 Annual Report", "https://www.berkshirehathaway.com/reports.html", "2025-02-22", "Insurance float was approximately $171 billion at year-end 2024.", [["Insurance float", "$171", "billion", "2024 year-end"], ["Cash and Treasury bills", "$334", "billion", "2024 year-end"], ["Operating earnings", "$47.4", "billion", "2024"]], "show float, cash, and operating earnings as separate balance sheet concepts", "cash position should not be interpreted as a recommendation"],
  ["Coinbase Trading Volume and Crypto Revenue", "unit economics explainer", "Dark Premium Finance Insight Style", "Coinbase Investor Relations", "Coinbase 2024 Form 10-K", "https://investor.coinbase.com/financials/sec-filings/default.aspx", "2025-02-13", "Trading volume was $1.1 trillion in 2024.", [["Trading volume", "$1.1", "trillion", "2024"], ["Total revenue", "$6.6", "billion", "2024"], ["Transaction revenue", "$4.0", "billion", "2024"]], "differentiate trading volume from monetized transaction revenue", "crypto price direction must not be implied"],
  ["PayPal Transaction Margin", "margin bridge", "Data Dashboard Finance Style", "PayPal Investor Relations", "PayPal 2024 Form 10-K", "https://investor.pypl.com/financials/sec-filings/default.aspx", "2025-02-07", "Total payment volume was $1.7 trillion in 2024.", [["Total payment volume", "$1.7", "trillion", "2024"], ["Net revenues", "$31.8", "billion", "2024"], ["Transaction margin dollars", "$13.6", "billion", "2024"]], "bridge payment volume to transaction margin dollars", "payment product advice should not appear"],
  ["Block Cash App and Square Gross Profit", "segment breakdown", "Business Model Breakdown Style", "Block Investor Relations", "Block 2024 Form 10-K", "https://investors.block.xyz/financials/sec-filings/default.aspx", "2025-02-21", "Gross profit was $8.9 billion in 2024.", [["Total gross profit", "$8.9", "billion", "2024"], ["Cash App gross profit", "$5.2", "billion", "2024"], ["Square gross profit", "$3.7", "billion", "2024"]], "split consumer Cash App and seller Square ecosystems", "bitcoin-related activity should be shown cautiously"],
  ["Walmart Comparable Sales and Inventory", "company earnings visual summary", "Data Dashboard Finance Style", "Walmart Investor Relations", "Walmart Fiscal 2025 Form 10-K", "https://stock.walmart.com/financials/annual-reports-and-proxies/default.aspx", "2025-03-14", "Fiscal 2025 revenue was $681.0 billion.", [["Total revenues", "$681.0", "billion", "FY2025"], ["Walmart U.S. comparable sales", "5.0%", "", "FY2025"], ["Inventories", "$56.0", "billion", "FY2025 year-end"]], "show comparable sales and inventory as retail execution indicators", "consumer demand conclusions should not exceed company disclosure"],
  ["Costco Membership Fee Income", "business model anatomy", "Business Model Breakdown Style", "Costco Investor Relations", "Costco Fiscal 2024 Form 10-K", "https://investor.costco.com/financials/sec-filings/default.aspx", "2024-10-09", "Membership fees were $5.2 billion in fiscal 2024.", [["Membership fees", "$5.2", "billion", "FY2024"], ["Net sales", "$249.6", "billion", "FY2024"], ["Worldwide renewal rate", "90.5%", "", "FY2024"]], "explain membership fees as a distinct club-model profit layer", "membership behavior should not be projected forward"],
  ["Home Depot Housing Cycle and Comparable Sales", "macro-to-company impact map", "Financial Editorial Report Style", "Home Depot Investor Relations", "Home Depot Fiscal 2024 Form 10-K", "https://ir.homedepot.com/financial-reports/sec-filings", "2025-03-14", "Comparable sales decreased 1.8% in fiscal 2024.", [["Net sales", "$159.5", "billion", "FY2024"], ["Comparable sales", "-1.8%", "", "FY2024"], ["Operating income", "$21.6", "billion", "FY2024"]], "connect housing cycle pressure to comparable sales", "macro housing forecasts should not be added"],
  ["Nike Direct-to-Consumer Revenue", "revenue mix chart", "Financial Editorial Report Style", "Nike Investor Relations", "Nike Fiscal 2024 Form 10-K", "https://investors.nike.com/investors/news-events-and-reports/sec-filings/default.aspx", "2024-07-25", "NIKE Direct revenues were $21.5 billion in fiscal 2024.", [["NIKE Direct revenue", "$21.5", "billion", "FY2024"], ["Wholesale revenue", "$29.0", "billion", "FY2024"], ["Total revenues", "$51.4", "billion", "FY2024"]], "contrast direct-to-consumer channels with wholesale distribution", "brand demand forecasts should be excluded"],
  ["LVMH Luxury Demand and Regional Mix", "regional revenue map", "Financial Editorial Report Style", "LVMH Investor Relations", "LVMH 2024 Annual Results", "https://www.lvmh.com/investors/publications/", "2025-01-28", "LVMH revenue was EUR84.7 billion in 2024.", [["Group revenue", "EUR84.7", "billion", "2024"], ["Fashion and Leather Goods revenue", "EUR41.1", "billion", "2024"], ["Organic revenue change", "1%", "", "2024"]], "map luxury demand through group, segment, and regional mix", "regional demand should remain sourced and non-predictive"],
  ["Starbucks Store Growth and Comparable Sales", "trend timeline", "Data Dashboard Finance Style", "Starbucks Investor Relations", "Starbucks Fiscal 2024 Form 10-K", "https://investor.starbucks.com/financial-data/sec-filings/default.aspx", "2024-11-22", "Starbucks ended fiscal 2024 with 40,199 stores.", [["Stores", "40,199", "", "FY2024 year-end"], ["Global comparable store sales", "-2%", "", "FY2024"], ["Net revenues", "$36.2", "billion", "FY2024"]], "show store base expansion beside comparable sales pressure", "traffic recovery assumptions should not be included"],
  ["McDonald’s Franchise Revenue Model", "business model anatomy", "Business Model Breakdown Style", "McDonald's Investor Relations", "McDonald's 2024 Form 10-K", "https://corporate.mcdonalds.com/corpmcd/investors/financial-information/sec-filings.html", "2025-02-21", "More than 95% of restaurants were franchised at year-end 2024.", [["Total revenues", "$25.9", "billion", "2024"], ["Franchised restaurant share", ">95%", "", "2024 year-end"], ["Operating income", "$11.7", "billion", "2024"]], "show royalty, rent, and company-operated restaurant layers", "franchise economics should not become business advice"],
  ["Coca-Cola Organic Revenue Growth", "before-and-after performance comparison", "Financial Editorial Report Style", "The Coca-Cola Company Investor Relations", "Coca-Cola 2024 Form 10-K", "https://investors.coca-colacompany.com/filings-reports/annual-filings-10-k", "2025-02-20", "Organic revenues grew 12% in 2024.", [["Net operating revenues", "$47.1", "billion", "2024"], ["Organic revenue growth", "12%", "", "2024"], ["Operating income", "$11.3", "billion", "2024"]], "explain organic growth separately from reported revenue", "beverage category projections should be avoided"],
  ["PepsiCo Snack vs Beverage Profit Mix", "segment breakdown", "Data Dashboard Finance Style", "PepsiCo Investor Relations", "PepsiCo 2024 Form 10-K", "https://investors.pepsico.com/financial-information/sec-filings", "2025-02-06", "Net revenue was $91.9 billion in 2024.", [["Net revenue", "$91.9", "billion", "2024"], ["Frito-Lay North America revenue", "$25.3", "billion", "2024"], ["PepsiCo Beverages North America revenue", "$27.8", "billion", "2024"]], "separate snack and beverage revenue engines", "profit mix should not rely on unsupported margin estimates"],
  ["Procter and Gamble Pricing vs Volume", "margin bridge", "Data Dashboard Finance Style", "Procter & Gamble Investor Relations", "P&G Fiscal 2024 Form 10-K", "https://www.pginvestor.com/financial-reporting/sec-filings/default.aspx", "2024-08-06", "Organic sales increased 4% in fiscal 2024.", [["Net sales", "$84.0", "billion", "FY2024"], ["Organic sales growth", "4%", "", "FY2024"], ["Diluted EPS", "$6.02", "", "FY2024"]], "break organic growth into price, mix, and volume concepts", "consumer staples demand should not be forecast"],
  ["Eli Lilly GLP-1 Drug Revenue Growth", "revenue mix chart", "Financial Editorial Report Style", "Eli Lilly Investor Relations", "Eli Lilly 2024 Form 10-K", "https://investor.lilly.com/financial-information/sec-filings", "2025-02-19", "Mounjaro revenue was $11.5 billion in 2024.", [["Total revenue", "$45.0", "billion", "2024"], ["Mounjaro revenue", "$11.5", "billion", "2024"], ["Zepbound revenue", "$4.9", "billion", "2024"]], "show GLP-1 product revenue within the pharmaceutical portfolio", "medical efficacy claims should not be added"],
  ["Pfizer Post-COVID Portfolio Reset", "before-and-after performance comparison", "Financial Editorial Report Style", "Pfizer Investor Relations", "Pfizer 2024 Form 10-K", "https://investors.pfizer.com/financials/sec-filings/default.aspx", "2025-02-27", "2024 revenues were $63.6 billion.", [["Revenues", "$63.6", "billion", "2024"], ["Comirnaty revenue", "$5.4", "billion", "2024"], ["Paxlovid revenue", "$5.7", "billion", "2024"]], "show COVID-product normalization within the broader portfolio reset", "clinical or treatment advice must not appear"],
  ["UnitedHealth Medical Care Ratio", "data snapshot", "Data Dashboard Finance Style", "UnitedHealth Group Investor Relations", "UnitedHealth Group 2024 Form 10-K", "https://www.unitedhealthgroup.com/investors/sec-filings.html", "2025-02-14", "Medical care ratio was 85.5% in 2024.", [["Revenues", "$400.3", "billion", "2024"], ["Medical care ratio", "85.5%", "", "2024"], ["Net earnings", "$14.4", "billion", "2024"]], "explain medical cost ratio as healthcare benefit cost pressure", "health plan advice should not be included"],
  ["Toyota Hybrid and EV Sales Mix", "revenue mix chart", "Business Model Breakdown Style", "Toyota Motor Corporation", "Toyota FY2025 Financial Results", "https://global.toyota/en/ir/financial-results/", "2025-05-08", "Electrified vehicle sales were 4.5 million units in FY2025.", [["Net revenues", "JPY48.0", "trillion", "FY2025"], ["Operating income", "JPY4.8", "trillion", "FY2025"], ["Electrified vehicle sales", "4.5", "million units", "FY2025"]], "show hybrid-heavy electrified mix beside revenue scale", "vehicle technology strategy should not become purchase advice"],
  ["BYD NEV Sales and Gross Margin", "data snapshot", "Dark Premium Finance Insight Style", "BYD Company Investor Relations", "BYD 2024 Annual Report", "https://www.bydglobal.com/en/Investor/index.html", "2025-03-24", "BYD sold 4.27 million new energy vehicles in 2024.", [["NEV sales", "4.27", "million units", "2024"], ["Revenue", "RMB777.1", "billion", "2024"], ["Gross margin", "20.2%", "", "2024"]], "connect NEV unit scale with revenue and gross margin", "EV market share claims should be sourced or omitted"],
  ["Volkswagen EV Transition Cost", "risk factor map", "Financial Editorial Report Style", "Volkswagen Group Investor Relations", "Volkswagen 2024 Annual Report", "https://www.volkswagen-group.com/en/publications/more/annual-report-2024-2754", "2025-03-11", "Sales revenue was EUR324.7 billion in 2024.", [["Sales revenue", "EUR324.7", "billion", "2024"], ["Operating return on sales", "5.9%", "", "2024"], ["BEV deliveries", "745,000", "vehicles", "2024"]], "map EV transition cost pressure against deliveries and operating return", "transition timing should not be forecast"],
  ["Boeing Aircraft Deliveries and Cash Flow", "cash flow profile", "Data Dashboard Finance Style", "Boeing Investor Relations", "Boeing 2024 Form 10-K", "https://investors.boeing.com/investors/financial-reports/default.aspx", "2025-01-31", "Commercial airplane deliveries were 348 in 2024.", [["Commercial deliveries", "348", "aircraft", "2024"], ["Revenues", "$66.5", "billion", "2024"], ["Free cash flow", "-$14.3", "billion", "2024"]], "show aircraft deliveries as the bridge to cash flow pressure", "production recovery should not be predicted"],
  ["Airbus Order Backlog and Production Ramp", "capex and demand cycle", "Data Dashboard Finance Style", "Airbus Investor Relations", "Airbus 2024 Annual Report", "https://www.airbus.com/en/investors/financial-results-annual-reports", "2025-02-20", "The commercial aircraft backlog was 8,658 aircraft.", [["Commercial aircraft deliveries", "766", "aircraft", "2024"], ["Commercial backlog", "8,658", "aircraft", "2024 year-end"], ["Revenues", "EUR69.2", "billion", "2024"]], "contrast order backlog with annual delivery conversion", "production ramp risk should stay visible"],
  ["Disney Streaming Losses vs Parks Profit", "segment breakdown", "Business Model Breakdown Style", "The Walt Disney Company Investor Relations", "Disney Fiscal 2024 Form 10-K", "https://thewaltdisneycompany.com/investor-relations/", "2024-11-14", "Experiences operating income was $9.3 billion in fiscal 2024.", [["Experiences operating income", "$9.3", "billion", "FY2024"], ["Entertainment DTC operating income", "$0.1", "billion", "FY2024"], ["Total revenues", "$91.4", "billion", "FY2024"]], "compare parks profit scale with direct-to-consumer streaming economics", "subscriber or box office forecasts should not be added"],
  ["Spotify Premium Subscribers and Gross Margin", "data snapshot", "Financial Editorial Report Style", "Spotify Investor Relations", "Spotify 2024 Form 20-F", "https://investors.spotify.com/financials/default.aspx", "2025-02-28", "Premium subscribers were 263 million at year-end 2024.", [["Premium subscribers", "263", "million", "2024 year-end"], ["Monthly active users", "675", "million", "2024 year-end"], ["Gross margin", "29.2%", "", "2024"]], "show paid subscriber base, MAU scale, and margin improvement together", "music streaming royalty economics should not be oversimplified"],
].map(([topicName, structureType, styleName, sourcePublisher, sourceTitle, sourceUrl, sourcePublishedAt, sourceQuote, points, angle, riskNote]) => ({
  topicName,
  structureType,
  styleName,
  sourcePublisher,
  sourceTitle,
  sourceUrl,
  sourcePublishedAt,
  sourceType: "official_company_report",
  sourceQuote,
  sourceSummary: `${sourcePublisher} reports ${String(topicName).toLowerCase()} through company-disclosed metrics. The infographic uses the source as a data anchor and turns the figures into original, non-advisory financial explanation.`,
  sourceDataPoints: (points as string[][]).map(([label, value, unit, period]) => ({
    label,
    value,
    unit: unit || undefined,
    period,
    sourceLocation: `${sourceTitle}, reported financial or operating data`,
  })),
  angle,
  riskNote,
})) as FinanceTopic[];

type GeneratedFinanceImage = {
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

type GeneratedFinanceManifest = { templates?: Record<string, GeneratedFinanceImage> };

function readGeneratedTemplateManifest() {
  const manifestPath = path.join(process.cwd(), "src/lib/finance-infographic-generated-images.json");
  if (!existsSync(manifestPath)) return {} as Record<string, GeneratedFinanceImage>;
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as GeneratedFinanceManifest;
    return parsed.templates || {};
  } catch {
    return {} as Record<string, GeneratedFinanceImage>;
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

function buildKnowledgePoints(topic: FinanceTopic) {
  const [primary, secondary, tertiary] = topic.sourceDataPoints;
  return [
    `${primary.label} is the anchor figure for this ${topic.structureType} view: ${primary.value}${primary.unit ? ` ${primary.unit}` : ""}${primary.period ? ` in ${primary.period}` : ""}.`,
    `${secondary.label} adds a different lens, helping the poster avoid reducing the topic to one headline metric.`,
    `${tertiary.label} provides the third data layer so the visual can separate scale, mix, margin, or operating pressure.`,
    `The core interpretation is to ${topic.angle}.`,
    `The risk context is specific: ${topic.riskNote}.`,
  ];
}

function buildTemplate(topic: FinanceTopic, index: number) {
  const slug = slugify(topic.topicName);
  const generated = readGeneratedTemplateManifest()[slug];
  const updatedAt = generated?.updatedAt || "2026-06-13T00:00:00.000Z";
  const sourceAccessedAt = "2026-06-13";
  const primaryKeyword = `${topic.topicName} Infographic`;
  const detailPath = `/infographic/financial-report/${slug}/`;
  const canonicalUrl = siteUrl + detailPath;
  const stylePrompt = stylePrompts[topic.styleName];
  const metricsText = topic.sourceDataPoints
    .map((point) => `${point.label}: ${point.value}${point.unit ? ` ${point.unit}` : ""}${point.period ? ` (${point.period})` : ""}`)
    .join("; ");
  const knowledgePoints = buildKnowledgePoints(topic);
  const topicPrompt = `Create a source-backed finance infographic poster about ${topic.topicName}. Use a ${topic.structureType} structure, cite ${topic.sourcePublisher}, and explain the business context with original wording.`;
  const imageDescription = `This 9:16 financial report infographic poster explains ${topic.topicName.toLowerCase()} using ${topic.sourcePublisher} data, verified metric cards, a clear source label, and a ${topic.structureType} layout. It focuses on company-reported financial context rather than forecasts or investment recommendations.`;
  const visibleDescription = `This ${primaryKeyword} turns ${topic.sourcePublisher}'s reported figures into a clear finance visual for earnings, market report, and business model learning. It uses a ${topic.structureType} layout to connect ${topic.sourceDataPoints[0].label}, ${topic.sourceDataPoints[1].label}, and ${topic.sourceDataPoints[2].label} with source-aware explanation. Built as a Financial Report Infographic Generator example, it helps readers scan the source, understand the metric relationships, and compare the business context without copying long source text or offering investment advice.`;
  const contentPrompt =
    `Create a professional 9:16 financial report infographic poster about ${topic.topicName}. Structure type: ${topic.structureType}. Source: ${topic.sourcePublisher} - ${topic.sourceTitle}. Show the source line clearly near the top or bottom. Use this short source quote only: "${topic.sourceQuote}" Metrics to show accurately: ${metricsText}. Content focus: ${topicPrompt} Knowledge points: ${knowledgePoints.join("; ")}. Image description: ${imageDescription} Use original explanatory sections, short labels, financial metric cards, simple chart-like visual areas, and no long copyrighted text. Do not include investment advice, buy/sell language, target prices, ratings, or unsupported forecasts.`;
  const finalPrompt = [stylePrompt, contentPrompt, aspectRatioPrompt, qualityPrompt].join("\n\n");
  const imageFilename = `finance-${slug}.webp`;

  return {
    id: `finance-template-${String(index + 1).padStart(3, "0")}`,
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
    title: `${topic.topicName} Infographic Template`,
    topicName: topic.topicName,
    shortDescription: `A source-backed ${topic.topicName.toLowerCase()} infographic template for earnings and market report learning.`,
    visibleDescription,
    seoTitle: `${topic.topicName} Infographic Template - KnowLens AI`,
    metaDescription: `Explore this source-backed ${topic.topicName.toLowerCase()} infographic template for financial report learning. Create a similar visual with KnowLens AI.`,
    h1: `${topic.topicName} Infographic Template`,
    primaryKeyword,
    secondaryKeywords: [`${topic.topicName.toLowerCase()} visual analysis`, "earnings infographic template", "market report infographic", "financial report visual"],
    generatorKeywords: generatorKeywords.slice(index % 3, index % 3 + 4),
    previewImagePath: generated?.previewImagePath || (generated?.previewImageUrl ? new URL(generated.previewImageUrl).pathname : "/picture/text-to-ppt-hero.jpg"),
    previewImageUrl: generated?.previewImageUrl || `${siteUrl}/picture/text-to-ppt-hero.jpg`,
    storageKey: generated?.storageKey || `infographic/financial-report/${imageFilename}`,
    imageFilename: generated?.imageFilename || imageFilename,
    imageFormat: generated?.imageFormat || ("webp" as const),
    imageMimeType: generated?.imageMimeType || "image/webp",
    imageWidth: generated?.imageWidth || 1024,
    imageHeight: generated?.imageHeight || 1792,
    imageSizeBytes: generated?.imageSizeBytes,
    aspectRatio,
    imageAlt: `${topic.topicName} finance infographic poster`,
    imageTitle: `${topic.topicName} Infographic Template`,
    imageCaption: `${topic.topicName} infographic - a source-backed finance report insight poster created with KnowLens AI.`,
    imageDescription,
    styleName: topic.styleName,
    stylePrompt,
    topicPrompt,
    visualPrompt: contentPrompt,
    contentPrompt,
    aspectRatioPrompt,
    qualityPrompt,
    finalPrompt,
    createSimilarPrompt: `Create a 9:16 financial report infographic poster about ${topic.topicName}. Use ${topic.styleName}. Source: ${topic.sourcePublisher} - ${topic.sourceTitle}. Use verified financial metrics, cite the source clearly, explain the business context with original wording, and avoid investment advice.`,
    structureType: topic.structureType,
    sourceRequired: true as const,
    sourcePublisher: topic.sourcePublisher,
    sourceTitle: topic.sourceTitle,
    sourceUrl: topic.sourceUrl,
    sourcePublishedAt: topic.sourcePublishedAt,
    sourceAccessedAt,
    sourceDocumentType: topic.sourceType,
    sourceQuote: topic.sourceQuote,
    sourceQuoteWordCount: quoteWordCount(topic.sourceQuote),
    sourceSummary: topic.sourceSummary,
    sourceDataPoints: topic.sourceDataPoints,
    copyrightRiskLevel: "low" as const,
    sourceUsageMode: "short_quote_plus_original_summary" as const,
    knowledgePoints,
    useCases: ["earnings education", "market report explainers", "business model analysis", "financial literacy content"],
    targetAudience: ["students", "finance creators", "business analysts", "educators", "content teams"],
    tags: Array.from(new Set(["finance", "earnings", "market report", "infographic", topic.structureType, ...slug.split("-").slice(0, 8)])),
    relatedTemplateIds: [] as string[],
    relatedCategorySlugs: ["financial-report", "business", "infographic-examples"],
    relatedToolSlugs: ["ai-infographic-generator", "infographic-maker", "educational-infographic-maker"],
    allowPublicDownload: false as const,
    createdAt: "2026-06-13T00:00:00.000Z",
    updatedAt,
  };
}

export function getFinanceInfographicTemplates() {
  return topics.map(buildTemplate).map((template, index, source) => ({
    ...template,
    relatedTemplateIds: source
      .filter((item) => item.id !== template.id && item.generationStatus === "success")
      .slice(Math.max(0, index - 2), index + 8)
      .filter((item) => item.id !== template.id)
      .slice(0, 6)
      .map((item) => item.id),
  }));
}

export const financeInfographicTemplates = getFinanceInfographicTemplates();

export type FinanceInfographicTemplate = ReturnType<typeof buildTemplate>;

export function getFinanceInfographicTemplate(slug: string) {
  return getFinanceInfographicTemplates().find((template) => template.slug === slug);
}
