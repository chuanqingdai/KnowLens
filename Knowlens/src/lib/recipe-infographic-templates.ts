import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const siteUrl = "https://knowlens.ai";
const categorySlug = "recipe";
const categoryName = "Recipe";
const categoryKeyword = "Recipe Infographic Templates";
const batchId = "recipe-infographic-tuzi-100";
const batchTopic = "Recipe Infographic";
const generatorKeywords = [
  "Recipe Infographic Maker",
  "AI Infographic Generator",
  "Text to Infographic Generator",
  "Knowledge Infographic Generator",
  "Educational Infographic Maker",
];

const topicTitles = [
  "Overnight Oats Recipe Infographic",
  "Avocado Toast Recipe Infographic",
  "Greek Yogurt Parfait Recipe Infographic",
  "Breakfast Burrito Recipe Infographic",
  "Smoothie Bowl Recipe Infographic",
  "Banana Pancakes Recipe Infographic",
  "Scrambled Eggs Recipe Infographic",
  "Chia Pudding Recipe Infographic",
  "Breakfast Sandwich Recipe Infographic",
  "Homemade Granola Recipe Infographic",
  "Chicken Salad Recipe Infographic",
  "Caesar Salad Recipe Infographic",
  "Greek Salad Recipe Infographic",
  "Quinoa Bowl Recipe Infographic",
  "Buddha Bowl Recipe Infographic",
  "Tuna Sandwich Recipe Infographic",
  "Turkey Wrap Recipe Infographic",
  "Veggie Wrap Recipe Infographic",
  "Lentil Soup Recipe Infographic",
  "Tomato Soup Recipe Infographic",
  "Spaghetti Bolognese Recipe Infographic",
  "Chicken Alfredo Pasta Recipe Infographic",
  "Pesto Pasta Recipe Infographic",
  "Mac and Cheese Recipe Infographic",
  "Garlic Butter Shrimp Pasta Recipe Infographic",
  "Vegetable Stir Fry Recipe Infographic",
  "Chicken Stir Fry Recipe Infographic",
  "Beef Tacos Recipe Infographic",
  "Chicken Fajitas Recipe Infographic",
  "Homemade Pizza Recipe Infographic",
  "Fried Rice Recipe Infographic",
  "Chicken Curry Recipe Infographic",
  "Butter Chicken Recipe Infographic",
  "Vegetable Curry Recipe Infographic",
  "Beef Stew Recipe Infographic",
  "Chicken Noodle Soup Recipe Infographic",
  "Chili Recipe Infographic",
  "Grilled Salmon Recipe Infographic",
  "Baked Chicken Breast Recipe Infographic",
  "Roasted Vegetables Recipe Infographic",
  "Mashed Potatoes Recipe Infographic",
  "Garlic Bread Recipe Infographic",
  "Coleslaw Recipe Infographic",
  "Roasted Sweet Potatoes Recipe Infographic",
  "Steamed Broccoli Recipe Infographic",
  "Rice Pilaf Recipe Infographic",
  "Couscous Salad Recipe Infographic",
  "Hummus Recipe Infographic",
  "Guacamole Recipe Infographic",
  "Salsa Recipe Infographic",
  "Chocolate Chip Cookies Recipe Infographic",
  "Brownies Recipe Infographic",
  "Banana Bread Recipe Infographic",
  "Apple Pie Recipe Infographic",
  "Cheesecake Recipe Infographic",
  "Tiramisu Recipe Infographic",
  "Vanilla Cupcakes Recipe Infographic",
  "Chocolate Cake Recipe Infographic",
  "Lemon Bars Recipe Infographic",
  "Rice Pudding Recipe Infographic",
  "Green Smoothie Recipe Infographic",
  "Berry Smoothie Recipe Infographic",
  "Mango Smoothie Recipe Infographic",
  "Iced Coffee Recipe Infographic",
  "Matcha Latte Recipe Infographic",
  "Lemonade Recipe Infographic",
  "Hot Chocolate Recipe Infographic",
  "Ginger Tea Recipe Infographic",
  "Fruit Infused Water Recipe Infographic",
  "Protein Smoothie Recipe Infographic",
  "Meal Prep Chicken Bowls Recipe Infographic",
  "Meal Prep Salad Jars Recipe Infographic",
  "Freezer Breakfast Burritos Recipe Infographic",
  "One-Pot Pasta Recipe Infographic",
  "Sheet Pan Chicken Recipe Infographic",
  "Slow Cooker Chili Recipe Infographic",
  "Air Fryer Fries Recipe Infographic",
  "Air Fryer Chicken Tenders Recipe Infographic",
  "Instant Pot Rice Recipe Infographic",
  "No-Bake Energy Bites Recipe Infographic",
  "Vegetable Sushi Rolls Recipe Infographic",
  "Ramen Bowl Recipe Infographic",
  "Miso Soup Recipe Infographic",
  "Dumplings Recipe Infographic",
  "Pad Thai Recipe Infographic",
  "Thai Green Curry Recipe Infographic",
  "Falafel Recipe Infographic",
  "Shakshuka Recipe Infographic",
  "Chicken Shawarma Recipe Infographic",
  "Mediterranean Bowl Recipe Infographic",
  "Kids Lunchbox Recipe Infographic",
  "Picnic Sandwich Recipe Infographic",
  "Party Nachos Recipe Infographic",
  "Game Day Sliders Recipe Infographic",
  "Holiday Stuffing Recipe Infographic",
  "Thanksgiving Mashed Potatoes Recipe Infographic",
  "Christmas Cookies Recipe Infographic",
  "Summer Fruit Salad Recipe Infographic",
  "BBQ Chicken Skewers Recipe Infographic",
  "Homemade Ice Cream Recipe Infographic"
] as const;

const stylePrompts: Record<string, string> = {
  "Clean Educational Style": "Clean Educational Style: Use a modern, clean, professional educational infographic style. The image should feel bright, trustworthy, polished, and suitable for recipe learning, cooking instructions, and lifestyle content. Use a clear layout with a large readable title, one central food visual or main recipe focus, and 3-6 supporting information areas. Use a clean sans-serif font with large title text, readable section headings, and short English labels. Use a light background with high contrast and soft blue, green, and orange accents. Use 2-4 harmonious colors. Keep the visual beautiful, organized, mobile-readable, and not overcrowded.",
  "Hand-drawn Explainer Style": "Hand-drawn Explainer Style: Use a warm hand-drawn educational explainer style. The image should feel friendly, approachable, charming, and suitable for beginner-friendly recipes, family cooking, and homemade food content. Use a notebook-like layout with neat hand-drawn food illustrations, small note areas, and simple section blocks. Keep the composition organized and balanced. Use neat handwritten-style English text with a large readable title, short labels, and simple notes. Use a warm paper background, pencil-gray lines, and muted green, blue, and yellow accents. Keep the visual soft, clean, appetizing, educational, and visually appealing.",
  "Blueprint Technical Style": "Blueprint Technical Style: Use a precise technical diagram style. The image should feel structured, analytical, and suitable for kitchen workflows, meal prep systems, cooking timing, preparation sequences, and step-by-step food processes. Use a grid-based blueprint layout with a central food preparation visual and organized explanation areas. Use a technical sans-serif font with crisp English labels and readable callouts. Use a dark navy or blueprint-blue background with white and cyan linework, plus one or two controlled accent colors. Keep the visual clean, accurate, premium, symmetrical, and not cluttered.",
  "Medical Science Style": "Medical Science Style: Use a clean nutrition and food science infographic style. The image should feel accurate, calm, trustworthy, polished, and suitable for ingredient education, balanced meal visuals, food groups, and general nutrition-friendly recipe topics. Use a simplified food or ingredient main visual with clear short explanations around it. Keep the content educational and avoid health claims. Use a clean medical sans-serif font with a large readable title, clear English labels, and short explanatory text. Use a white or soft light background with calm blue, teal, soft red, and muted natural food accents. Keep the visual clean, non-clinical, appetizing, and beautiful.",
  "Premium Editorial Style": "Premium Editorial Style: Use a premium magazine-style recipe infographic design. The image should feel elegant, polished, visually rich, appetizing, and suitable for food blogs, recipe cards, lifestyle content, seasonal recipes, desserts, and shareable cooking visuals. Use a strong hero food visual, a large headline, a concise subtitle, and supporting information blocks. Use refined editorial spacing, balanced composition, clean hierarchy, and beautiful visual rhythm. Use an elegant editorial title font with clean readable body text, all in English and mobile-readable. Use a sophisticated palette such as cream, warm beige, deep green, tomato red, soft gold, or topic-matching food accents. Keep the image premium, modern, shareable, and visually delicious.",
  "Dark Premium Tech Style": "Dark Premium Tech Style: Use a dark premium food-tech infographic style. The image should feel high-end, cinematic, precise, dramatic, and suitable for modern kitchen techniques, coffee brewing, air fryer recipes, meal prep systems, food science, and data-like recipe visuals. Use a dark background with a central polished food visual and clean information areas. Use a modern clean sans-serif font with a bright readable title, high-contrast English labels, and concise body text. Use a dark navy, black, or deep brown base with controlled cyan, amber, cream, or green accents. Keep the visual premium, polished, readable, and appetizing.",
};

const qualityPrompt = "Create a high-quality professional recipe process infographic with a clear information hierarchy, accurate and concise English labels, visually clear cooking steps, precise ingredient and preparation visualization, no spelling or grammar mistakes, no incorrect or distorted food drawings, no invented nutrition or health claims, and a polished editorial infographic layout with balanced spacing, readable typography, appetizing visual presentation, and easy-to-scan sections. Optimize the design for mobile viewing, keep the title and section headings large, reduce small text, avoid tiny labels, and keep each cooking step readable on a phone screen.";

export type RecipeInfographicTemplate = ReturnType<typeof buildTemplate>;

type GeneratedRecipeImage = {
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

type GeneratedRecipeManifest = {
  templates?: Record<string, GeneratedRecipeImage>;
};

function readGeneratedTemplateManifest() {
  const manifestPath = path.join(process.cwd(), "src/lib/recipe-infographic-generated-images.json");
  if (!existsSync(manifestPath)) return {} as Record<string, GeneratedRecipeImage>;
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as GeneratedRecipeManifest;
    return parsed.templates || {};
  } catch {
    return {} as Record<string, GeneratedRecipeImage>;
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

function recipeDomain(topic: string) {
  if (/oats|toast|parfait|breakfast|smoothie bowl|pancakes|scrambled eggs|chia|granola/i.test(topic)) return "breakfast";
  if (/salad|bowl|sandwich|wrap|soup/i.test(topic)) return "lunch";
  if (/pasta|stir fry|tacos|fajitas|pizza|rice|curry|stew|chili|salmon|chicken breast|vegetables/i.test(topic)) return "dinner";
  if (/potatoes|bread|coleslaw|broccoli|pilaf|couscous|hummus|guacamole|salsa/i.test(topic)) return "sides";
  if (/cookies|brownies|banana bread|pie|cheesecake|tiramisu|cupcakes|cake|lemon bars|pudding|ice cream/i.test(topic)) return "dessert";
  if (/smoothie|coffee|latte|lemonade|chocolate|tea|water/i.test(topic)) return "drinks";
  if (/meal prep|freezer|one-pot|sheet pan|slow cooker|air fryer|instant pot|no-bake/i.test(topic)) return "meal-prep";
  if (/sushi|ramen|miso|dumplings|pad thai|thai|falafel|shakshuka|shawarma|mediterranean/i.test(topic)) return "global";
  if (/holiday|thanksgiving|christmas|summer|bbq|party|game day|picnic|kids/i.test(topic)) return "occasion";
  return "recipe";
}

function styleName(topic: string, index: number) {
  const domain = recipeDomain(topic);
  if (domain === "breakfast") return index % 2 === 0 ? "Hand-drawn Explainer Style" : "Clean Educational Style";
  if (domain === "lunch" || domain === "dinner") return index % 2 === 0 ? "Clean Educational Style" : "Premium Editorial Style";
  if (domain === "dessert" || domain === "occasion") return index % 2 === 0 ? "Premium Editorial Style" : "Hand-drawn Explainer Style";
  if (domain === "drinks") return index % 2 === 0 ? "Premium Editorial Style" : "Dark Premium Tech Style";
  if (domain === "meal-prep") return index % 2 === 0 ? "Blueprint Technical Style" : "Clean Educational Style";
  if (domain === "sides") return index % 2 === 0 ? "Medical Science Style" : "Clean Educational Style";
  if (domain === "global") return index % 2 === 0 ? "Premium Editorial Style" : "Clean Educational Style";
  return index % 2 === 0 ? "Clean Educational Style" : "Premium Editorial Style";
}

function knowledgePoints(topic: string) {
  const domain = recipeDomain(topic);
  const base = [
    `Show the main ingredients for the ${topic.toLowerCase()}`,
    "Organize the preparation steps in clear order",
    "Highlight timing, texture, or doneness cues without inventing nutrition data",
    "Clarify serving, garnish, or storage tips in concise English",
  ];
  if (domain === "breakfast") return [...base, "Keep the recipe beginner-friendly and useful for morning meal planning"];
  if (domain === "lunch") return [...base, "Show quick assembly, freshness, and portable serving ideas"];
  if (domain === "dinner") return [...base, "Include prep, cooking, simmering, baking, or plating stages as appropriate"];
  if (domain === "sides") return [...base, "Emphasize simple ingredient prep, seasoning, and serving compatibility"];
  if (domain === "dessert") return [...base, "Show mixing, baking, chilling, decorating, or serving stages clearly"];
  if (domain === "drinks") return [...base, "Show ingredient ratios visually without unsupported wellness claims"];
  if (domain === "meal-prep") return [...base, "Include batching, containers, reheating, and planning cues where relevant"];
  if (domain === "global") return [...base, "Respect the dish theme with clear ingredients and approachable cooking steps"];
  return [...base, "Keep the visual practical for home cooks and food content creators"];
}

function useCases(domain: string) {
  if (domain === "breakfast") return ["breakfast planning", "family cooking", "recipe cards", "food blogs"];
  if (domain === "lunch") return ["lunch guides", "meal inspiration", "classroom visuals", "social posts"];
  if (domain === "dinner") return ["dinner planning", "cooking tutorials", "restaurant content", "recipe education"];
  if (domain === "dessert") return ["dessert cards", "holiday content", "baking lessons", "food blogs"];
  if (domain === "drinks") return ["drink recipes", "cafe content", "lifestyle posts", "visual recipe guides"];
  if (domain === "meal-prep") return ["meal prep guides", "kitchen workflows", "planning visuals", "creator content"];
  if (domain === "global") return ["global cuisine explainers", "food education", "recipe blogs", "cooking lessons"];
  return ["recipe learning", "food content", "home cooking", "visual instructions"];
}

function targetAudience(domain: string) {
  if (domain === "meal-prep") return ["home cooks", "meal prep creators", "food bloggers", "lifestyle teams"];
  if (domain === "global") return ["home cooks", "teachers", "food creators", "culinary content teams"];
  if (domain === "dessert" || domain === "occasion") return ["bakers", "food bloggers", "families", "holiday content creators"];
  return ["home cooks", "content creators", "teachers", "food bloggers"];
}

function buildTemplate(title: string, index: number) {
  const topic = topicName(title);
  const slug = slugify(title);
  const aspectRatio = index < 5 ? "16:9" : "9:16";
  const domain = recipeDomain(topic);
  const style = styleName(topic, index);
  const stylePrompt = stylePrompts[style];
  const points = knowledgePoints(topic);
  const detailPath = `/infographic/recipe/${slug}/`;
  const canonicalUrl = `${siteUrl}${detailPath}`;
  const imageFilename = `recipe-${slug}.webp`;
  const aspectRatioPrompt = `Aspect ratio: ${aspectRatio}`;
  const topicPrompt = `Explain the ${topic} as a clear recipe infographic with ingredients, preparation steps, and serving cues.`;
  const visibleDescription = `This ${topic.toLowerCase()} infographic template explains the recipe in a clear visual format for home cooks, food creators, bloggers, and educators. It organizes ingredients, preparation steps, cooking cues, serving ideas, and concise labels so viewers can understand the recipe at a glance.`;
  const imageDescription = `This ${topic.toLowerCase()} infographic explains the recipe in a clear visual format for home cooks, food creators, bloggers, and educators.`;
  const contentPrompt = `Create a recipe infographic about ${topic}. Use a large readable title, an appetizing central food visual, and 3-6 easy-to-scan sections or cards. Show ingredients, preparation steps, cooking or assembly sequence, timing cues, and serving suggestions. Do not invent nutrition data, medical benefits, diet claims, or alcohol content. Content focus: ${topicPrompt} Knowledge points: ${points.join("; ")}. Image description: ${imageDescription} Visible description: ${visibleDescription}`;
  const finalPrompt = [stylePrompt, contentPrompt, aspectRatioPrompt, qualityPrompt].join("\n\n");
  const generated = readGeneratedTemplateManifest()[slug];
  const updatedAt = generated?.updatedAt || "2026-06-13T00:00:00.000Z";

  return {
    id: `recipe-template-${String(index + 1).padStart(3, "0")}`,
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
    shortDescription: `A ready-to-use ${topic.toLowerCase()} infographic template for visual recipe learning.`,
    visibleDescription,
    seoTitle: `${topic} Infographic Template - KnowLens AI`,
    metaDescription: `Explore this ${topic.toLowerCase()} infographic template for recipe learning and cooking inspiration. Create a similar visual with KnowLens AI.`,
    h1: `${topic} Infographic Template`,
    primaryKeyword: title,
    secondaryKeywords: [`${topic.toLowerCase()} recipe card`, `${topic.toLowerCase()} visual recipe`, "recipe infographic template", "visual cooking instructions"],
    generatorKeywords: generatorKeywords.slice(0, 4),
    previewImagePath: generated?.previewImagePath || (generated?.previewImageUrl ? new URL(generated.previewImageUrl).pathname : "/picture/recipe-infographic-maker.jpg"),
    previewImageUrl: generated?.previewImageUrl || `${siteUrl}/picture/recipe-infographic-maker.jpg`,
    storageKey: generated?.storageKey || `infographic/recipe/${imageFilename}`,
    imageFilename: generated?.imageFilename || imageFilename,
    imageFormat: generated?.imageFormat || ("webp" as const),
    imageMimeType: generated?.imageMimeType || "image/webp",
    imageWidth: generated?.imageWidth || (aspectRatio === "16:9" ? 1792 : 1024),
    imageHeight: generated?.imageHeight || (aspectRatio === "16:9" ? 1024 : 1792),
    imageSizeBytes: generated?.imageSizeBytes,
    aspectRatio,
    imageAlt: `${topic} infographic`,
    imageTitle: `${topic} Infographic Template`,
    imageCaption: `${topic} Infographic - a recipe infographic example created with KnowLens AI.`,
    imageDescription,
    styleName: style,
    stylePrompt,
    contentPrompt,
    aspectRatioPrompt,
    qualityPrompt,
    finalPrompt,
    createSimilarPrompt: `Create an educational recipe infographic about ${topic}. Use ${style}. ${aspectRatioPrompt}. Focus on the key recipe details, ingredients, and preparation steps. Keep the design clear, polished, appetizing, and professional.`,
    topicPrompt,
    knowledgePoints: points,
    useCases: useCases(domain),
    targetAudience: targetAudience(domain),
    tags: Array.from(new Set(["recipe", "infographic", domain, "cooking", ...slug.split("-").filter((part) => !["recipe", "infographic"].includes(part)).slice(0, 5)])),
    relatedTemplateIds: [] as string[],
    relatedCategorySlugs: ["recipe", "education", "food", "lifestyle"],
    relatedToolSlugs: ["recipe-infographic-maker", "ai-infographic-generator", "text-to-infographic", "infographic-maker"],
    allowPublicDownload: false as const,
    createdAt: "2026-06-13T00:00:00.000Z",
    updatedAt,
  };
}

export function getRecipeInfographicTemplates() {
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

export const recipeInfographicTemplates = getRecipeInfographicTemplates();

export function getRecipeInfographicTemplate(slug: string) {
  return getRecipeInfographicTemplates().find((template) => template.slug === slug);
}

export function getRecipeInfographicBatchJob() {
  const manifestPath = path.join(process.cwd(), "src/lib/recipe-infographic-generated-images.json");
  if (!existsSync(manifestPath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(manifestPath, "utf8")).job || null;
  } catch {
    return null;
  }
}
