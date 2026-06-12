import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  Layers3,
  ListChecks,
  NotebookPen,
  Sparkles,
} from "lucide-react";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

const siteOrigin = "https://knowlens.ai";
const pagePath = "/recipe-infographic-maker";
const pageLink = `${siteOrigin}${pagePath}`;
const generatorHref = "/app?intent=generate";
const heroImage = "/picture/recipe-infographic-maker.jpg";

export const metadata: Metadata = {
  title: "Recipe Infographic Maker | Create Step-by-Step Recipe Visuals | KnowLens.ai",
  description:
    "Turn recipe steps, ingredients, and cooking notes into clear recipe infographics, visual recipe cards, and step-by-step cooking visuals with KnowLens.ai.",
  alternates: {
    canonical: pageLink,
  },
  openGraph: {
    type: "website",
    siteName: "KnowLens.ai",
    title: "Recipe Infographic Maker | KnowLens.ai",
    description:
      "Create recipe infographics from recipe steps, cooking notes, and plain text. Turn cooking instructions into readable visual recipe guides and recipe cards.",
    url: pageLink,
    images: [
      {
        url: `${siteOrigin}${heroImage}`,
        width: 1003,
        height: 565,
        alt: "Avocado toast with poached egg recipe infographic with ingredients and cooking steps",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Recipe Infographic Maker | KnowLens.ai",
    description:
      "Turn recipe steps, ingredients, and cooking notes into clear recipe infographics and visual recipe cards.",
    images: [`${siteOrigin}${heroImage}`],
  },
};

function createSimilarHref(prompt: string) {
  return `${generatorHref}&prompt=${encodeURIComponent(prompt)}`;
}

type RecipeExample = {
  title: string;
  description: string;
  tags: string[];
  prompt: string;
  image?: string;
  width?: number;
  height?: number;
  alt?: string;
  ingredients: string[];
  steps: string[];
  note: string;
  accent: string;
  layout: "wide" | "tall";
};

function RecipeVisual({ example, compact = false }: { example: RecipeExample; compact?: boolean }) {
  return (
    <div
      role="img"
      aria-label={`${example.title} recipe infographic with ingredients and cooking steps`}
      className={[
        "overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm",
        compact ? "p-4" : "p-5",
      ].join(" ")}
      style={{ aspectRatio: example.layout === "wide" ? "16 / 9" : "9 / 16" }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Recipe Guide</p>
            <p className="mt-1 text-lg font-semibold leading-tight text-zinc-950">{example.title}</p>
          </div>
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
            style={{ backgroundColor: example.accent }}
          >
            {example.title.includes("Lemonade") ? "🍋" : example.title.includes("Pancake") ? "🥞" : "🥗"}
          </div>
        </div>

        <div className={compact ? "mt-4 grid gap-3" : "mt-5 grid flex-1 gap-4"}>
          <div className="rounded-xl bg-zinc-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Ingredients</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {example.ingredients.map((ingredient) => (
                <span key={ingredient} className="rounded-full bg-white px-2.5 py-1 text-xs text-zinc-700 shadow-sm">
                  {ingredient}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            {example.steps.map((step, index) => (
              <div key={step} className="flex items-start gap-2 rounded-xl border border-zinc-100 bg-white p-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <span className="text-xs leading-5 text-zinc-700">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto pt-4">
          <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-600">
            {example.note}
          </p>
        </div>
      </div>
    </div>
  );
}

const heroExample: RecipeExample = {
  title: "Pancake Morning",
  description:
    "A breakfast recipe infographic that organizes batter ingredients, pan steps, flipping, and serving notes.",
  tags: ["Recipe Infographic", "Step-by-Step Visual"],
  prompt: "Turn this pancake recipe into a step-by-step recipe infographic.",
  ingredients: ["Flour", "Egg", "Milk", "Butter", "Maple"],
  steps: ["Mix batter until smooth.", "Pour onto a warm pan.", "Flip when bubbles appear.", "Serve with toppings."],
  note: "Best for quick breakfast guides and food blog visuals.",
  accent: "#fef3c7",
  layout: "tall",
};

const visualTypes = [
  {
    title: "Step-by-Step Recipe Infographics",
    description: "Turn ordered cooking steps into a clear visual guide that is easy to follow.",
    icon: ListChecks,
  },
  {
    title: "Recipe Card Visuals",
    description: "Create recipe card-style visuals with ingredients, steps, and short cooking notes.",
    icon: NotebookPen,
  },
  {
    title: "Cooking Process Infographics",
    description: "Explain preparation, cooking, and serving steps with readable labels and structured sections.",
    icon: CheckCircle2,
  },
  {
    title: "Meal Idea Visuals",
    description: "Turn meal ideas and ingredient lists into simple visual summaries.",
    icon: BookOpen,
  },
  {
    title: "Food Blog Graphics",
    description: "Create recipe visuals that are easy to include in blog posts, newsletters, and social content.",
    icon: BadgeCheck,
  },
  {
    title: "Carousel-Style Recipe Visuals",
    description: "Break one recipe into multiple visual sections that are easy to share.",
    icon: Layers3,
  },
];

const workflowSteps = [
  {
    title: "Add Your Recipe Text",
    description: "Start with ingredients, cooking steps, notes, a short recipe idea, or plain text.",
  },
  {
    title: "Structure the Recipe",
    description: "KnowLens organizes the content into ingredients, step order, short labels, and visual sections.",
  },
  {
    title: "Generate the Infographic",
    description:
      "Create a recipe infographic, visual recipe card, step-by-step cooking guide, poster-style recipe visual, or carousel-style recipe visual.",
  },
];

const prompts = [
  "Turn this pancake recipe into a step-by-step recipe infographic.",
  "Create a visual recipe card for a simple pasta dish with ingredients and steps.",
  "Make a cooking steps infographic for preparing a quick breakfast bowl.",
  "Turn these baking notes into a clear dessert recipe visual.",
  "Create a step-by-step visual guide for making homemade lemonade.",
  "Make a recipe infographic for a simple salad with ingredients and preparation steps.",
  "Turn this meal prep idea into a structured cooking visual.",
  "Create a food blog graphic that shows ingredients, steps, and serving tips.",
  "Make a recipe card-style infographic for a quick dinner idea.",
  "Turn these cooking instructions into a visual guide for beginners.",
];

const useCases = [
  {
    title: "Home Cooks",
    description: "Turn recipe notes and cooking steps into easy-to-follow visual guides.",
    icon: CheckCircle2,
  },
  {
    title: "Food Bloggers",
    description: "Create recipe visuals that make blog posts more readable and shareable.",
    icon: NotebookPen,
  },
  {
    title: "Content Creators",
    description: "Turn food ideas and recipe steps into visual content for social platforms.",
    icon: Sparkles,
  },
  {
    title: "Cooking Teachers",
    description: "Create simple cooking visuals for classes, workshops, or online lessons.",
    icon: BookOpen,
  },
  {
    title: "Meal Planning Creators",
    description: "Turn meal ideas and prep notes into structured visual summaries.",
    icon: Layers3,
  },
  {
    title: "Small Teams",
    description: "Create quick recipe posters and food visuals without a designer.",
    icon: BadgeCheck,
  },
];

const wideExamples: RecipeExample[] = [
  {
    title: "Avocado Toast with Poached Egg",
    description:
      "A recipe infographic that shows avocado toast ingredients, poached egg timing, assembly steps, and serving notes.",
    tags: ["Recipe Infographic", "Cooking Steps"],
    prompt: "Create a recipe infographic for avocado toast with poached egg, ingredients, timing, and steps.",
    image: heroImage,
    width: 1003,
    height: 565,
    alt: "Avocado toast with poached egg recipe infographic showing ingredients timing nutrition and cooking steps",
    ingredients: ["Avocado", "Sourdough", "Eggs", "Lemon", "Olive Oil"],
    steps: ["Toast bread.", "Mash avocado.", "Poach eggs.", "Top and serve."],
    note: "Useful for brunch recipe cards and step-by-step food blog visuals.",
    accent: "#dcfce7",
    layout: "wide",
  },
  {
    title: "Homemade Lemonade",
    description:
      "A drink recipe visual guide that organizes lemons, sugar, water, mixing, chilling, and serving.",
    tags: ["Visual Recipe Guide", "Drink Recipe"],
    prompt: "Create a step-by-step visual guide for making homemade lemonade.",
    ingredients: ["Lemon", "Sugar", "Water", "Ice", "Mint"],
    steps: ["Juice lemons.", "Stir with sugar.", "Add cold water.", "Serve over ice."],
    note: "Designed for simple drink guides and summer recipe posts.",
    accent: "#fef9c3",
    layout: "wide",
  },
  {
    title: "Quick Breakfast Bowl",
    description:
      "A cooking steps infographic that explains layering grains, fruit, yogurt, toppings, and serving ideas.",
    tags: ["Meal Idea", "Step-by-Step Visual"],
    prompt: "Make a cooking steps infographic for preparing a quick breakfast bowl.",
    ingredients: ["Oats", "Yogurt", "Fruit", "Seeds", "Honey"],
    steps: ["Add base.", "Layer yogurt.", "Top with fruit.", "Finish with seeds."],
    note: "Good for meal ideas, prep notes, and quick reference visuals.",
    accent: "#dcfce7",
    layout: "wide",
  },
];

const tallExamples: RecipeExample[] = [
  heroExample,
  {
    title: "Fresh Salad Prep",
    description:
      "A salad recipe infographic that shows washing, chopping, combining, dressing, and serving steps.",
    tags: ["Recipe Infographic", "Meal Idea"],
    prompt: "Make a recipe infographic for a simple salad with ingredients and preparation steps.",
    ingredients: ["Greens", "Tomato", "Cucumber", "Cheese", "Dressing"],
    steps: ["Wash greens.", "Chop vegetables.", "Combine in a bowl.", "Add dressing last."],
    note: "Keeps preparation steps clear for beginner-friendly recipes.",
    accent: "#bbf7d0",
    layout: "tall",
  },
  {
    title: "Dessert Baking Notes",
    description:
      "A baking process visual that organizes mixing, baking, cooling, decorating, and serving notes.",
    tags: ["Cooking Steps", "Food Blog Graphic"],
    prompt: "Turn these baking notes into a clear dessert recipe visual.",
    ingredients: ["Flour", "Cocoa", "Sugar", "Egg", "Cream"],
    steps: ["Mix dry ingredients.", "Fold in wet mixture.", "Bake until set.", "Cool before serving."],
    note: "Useful for dessert recipes and structured baking notes.",
    accent: "#fce7f3",
    layout: "tall",
  },
];

const whyKnowLens = [
  {
    title: "Clear Step Order",
    description: "Turn recipe text into ordered cooking steps that are easier to follow.",
  },
  {
    title: "Readable Labels",
    description: "Create visuals with clear ingredient labels, step headings, and short text blocks.",
  },
  {
    title: "Structured Recipe Layouts",
    description: "Organize recipes into ingredients, preparation, cooking steps, and serving notes.",
  },
  {
    title: "Visual Hierarchy",
    description: "Emphasize the most important recipe details with sections, spacing, and visual grouping.",
  },
  {
    title: "Content-First Visuals",
    description: "Start from recipe text instead of a blank canvas or decorative food prompt.",
  },
];

const faqs = [
  {
    question: "What is a recipe infographic maker?",
    answer:
      "A recipe infographic maker turns recipe steps, ingredients, and cooking notes into a structured visual guide. KnowLens helps organize the content into ingredient sections, step order, readable labels, and a clear visual layout.",
  },
  {
    question: "Can I create recipe infographics from text?",
    answer:
      "Yes. You can start with ingredients, cooking steps, notes, or plain text, and KnowLens can help turn it into a recipe infographic, recipe card, or step-by-step cooking visual.",
  },
  {
    question: "What kinds of recipes can I visualize?",
    answer:
      "You can create visuals for breakfast ideas, desserts, drinks, salads, quick meals, baking steps, meal prep ideas, and beginner cooking guides.",
  },
  {
    question: "Do I need design skills?",
    answer:
      "No. KnowLens helps organize your recipe text into a clear visual layout, so you do not need to start from a blank canvas or design template.",
  },
  {
    question: "Can I create recipe cards?",
    answer: "Yes. KnowLens can help create recipe card-style visuals with ingredients, steps, and short cooking notes.",
  },
  {
    question: "Can I create step-by-step cooking guides?",
    answer:
      "Yes. You can turn ordered recipe steps or cooking instructions into a step-by-step infographic or visual guide.",
  },
  {
    question: "How is this different from a normal recipe card maker?",
    answer:
      "A normal recipe card maker usually starts with templates. KnowLens starts with your recipe text or notes, organizes the information, and turns it into structured visual content.",
  },
  {
    question: "How is this different from a generic AI image generator?",
    answer:
      "Generic AI image tools often focus on decorative food images. KnowLens focuses on structured recipe visuals with step order, readable labels, clear sections, and infographic-style layouts.",
  },
  {
    question: "What should I include in my input?",
    answer:
      "For best results, include the recipe name, ingredients, ordered steps, timing notes, serving ideas, and the audience you want to explain it to.",
  },
  {
    question: "Can I use recipe infographics for social content?",
    answer:
      "Yes. Recipe infographics and visual recipe cards can be useful for food blogs, social posts, newsletters, and quick sharing.",
  },
];

const relatedTools = [
  {
    title: "Process Infographic Generator",
    description: "Turn ordered steps, workflows, and how-to instructions into structured infographic-style visuals.",
    href: "/process-infographic-generator",
  },
  {
    title: "Educational Infographic Maker",
    description: "Create structured learning visuals, study guides, and classroom-ready infographics.",
    href: "/educational-infographic-maker",
  },
  {
    title: "Infographic Examples",
    description: "Browse visual examples and layout ideas before creating your own recipe infographic.",
    href: "/infographic-examples",
  },
];

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "KnowLens Recipe Infographic Maker",
  applicationCategory: "DesignApplication",
  operatingSystem: "Web",
  url: pageLink,
  description:
    "KnowLens turns recipe steps, ingredients, cooking notes, and plain text into structured recipe infographics, visual recipe cards, and step-by-step cooking guides.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: siteOrigin,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Recipe Infographic Maker",
      item: pageLink,
    },
  ],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

export default function RecipeInfographicMakerPage() {
  return (
    <MarketingChrome>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([softwareJsonLd, breadcrumbJsonLd, faqJsonLd]) }}
      />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-4 py-14 sm:px-6 lg:py-20">
        <section className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-emerald-700 shadow-sm">
              <Sparkles size={14} />
              COOKING STEPS TO CARDS
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-6xl">
              Recipe Infographic Maker for Visual Recipe Cards
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-600 sm:text-lg">
              Turn recipe steps, ingredients, or cooking notes into clear recipe infographics with readable labels, step
              order, sections, and visual hierarchy.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={generatorHref}
                className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-950 px-6 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800"
              >
                Create a Recipe Infographic
                <ArrowRight size={16} className="ml-2" />
              </Link>
              <Link
                href="#examples"
                className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-300 bg-white px-6 text-sm font-medium text-zinc-900 shadow-sm transition hover:bg-zinc-100"
              >
                View Examples
              </Link>
            </div>
            <p className="mt-4 text-sm text-zinc-500">Start with recipe steps. KnowLens structures the visual.</p>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-sm">
            <img
              src={heroImage}
              alt="Avocado toast with poached egg recipe infographic with ingredients and cooking steps"
              width={1003}
              height={565}
              className="h-auto w-full object-contain"
            />
          </div>
        </section>

        <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Structured recipe guides
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
                What is a Recipe Infographic Maker?
              </h2>
            </div>
            <p className="text-base leading-8 text-zinc-600">
              A recipe infographic maker helps turn recipe steps, ingredients, and cooking notes into structured visual
              guides. KnowLens organizes the content into step order, key ingredients, readable labels, and clear
              sections so a recipe is easier to follow and share.
            </p>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Create Recipe Infographics for Clear Step-by-Step Cooking
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              Use KnowLens to turn cooking ideas, recipe steps, and ingredient notes into structured visuals for blogs,
              social posts, meal ideas, and quick reference.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visualTypes.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-zinc-950">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-600">{item.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Create a Recipe Infographic in 3 Steps
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              Start with recipe steps or cooking notes. KnowLens helps organize the content into a clear visual recipe
              layout.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {workflowSteps.map((step, index) => (
              <div key={step.title} className="rounded-2xl bg-zinc-50 p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-semibold text-zinc-950 shadow-sm">
                  {index + 1}
                </div>
                <h3 className="mt-5 text-lg font-semibold text-zinc-950">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-600">{step.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              href={generatorHref}
              className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-950 px-5 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              Create a Recipe Infographic
              <ArrowRight size={15} className="ml-2" />
            </Link>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Prompt starters</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
              Recipe Ideas You Can Turn into Infographics
            </h2>
            <p className="mt-4 text-sm leading-7 text-zinc-600">
              Start with complete recipe steps or a rough food idea. Add ingredients, cooking steps, timing notes, and
              examples for better results.
            </p>
            <p className="mt-4 rounded-2xl bg-zinc-50 p-4 text-sm leading-7 text-zinc-600">
              For best results, include the recipe name, ingredients, step order, timing notes, serving idea, and the
              audience you want to explain it to.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {prompts.map((prompt, index) => (
              <Link
                href={createSimilarHref(prompt)}
                key={prompt}
                className="group rounded-2xl border border-zinc-200 bg-white p-4 text-sm leading-6 text-zinc-700 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50/40"
              >
                <span className="mb-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700">
                  {index + 1}
                </span>
                <span className="block">{prompt}</span>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Built for Recipes, Food Content, and Cooking Guides
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              Use the recipe infographic maker when cooking steps need to become clear, visual, and easy to follow.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {useCases.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-50 text-zinc-800">
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-zinc-950">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-600">{item.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="examples" className="scroll-mt-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Recipe Infographic Examples
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              Explore recipe infographics, visual recipe cards, and cooking step visuals created from recipe notes,
              ingredients, and short text prompts.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {wideExamples.map((example) => (
              <article key={example.title} className="rounded-[1.5rem] border border-zinc-200 bg-white p-3 shadow-sm">
                {example.image ? (
                  <img
                    src={example.image}
                    alt={example.alt}
                    width={example.width}
                    height={example.height}
                    className="h-auto w-full rounded-2xl object-contain"
                  />
                ) : (
                  <RecipeVisual example={example} compact />
                )}
                <div className="p-3">
                  <div className="flex flex-wrap gap-2">
                    {example.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <h3 className="mt-4 text-xl font-semibold tracking-tight text-zinc-950">{example.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-600">{example.description}</p>
                  <Link
                    href={createSimilarHref(example.prompt)}
                    className="mt-5 inline-flex items-center text-sm font-semibold text-zinc-950 hover:text-emerald-700"
                  >
                    Create Similar
                    <ArrowRight size={15} className="ml-2" />
                  </Link>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {tallExamples.map((example) => (
              <article key={example.title} className="rounded-[1.5rem] border border-zinc-200 bg-white p-3 shadow-sm">
                <RecipeVisual example={example} compact />
                <div className="p-3">
                  <div className="flex flex-wrap gap-2">
                    {example.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <h3 className="mt-4 text-xl font-semibold tracking-tight text-zinc-950">{example.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-600">{example.description}</p>
                  <Link
                    href={createSimilarHref(example.prompt)}
                    className="mt-5 inline-flex items-center text-sm font-semibold text-zinc-950 hover:text-emerald-700"
                  >
                    Create Similar
                    <ArrowRight size={15} className="ml-2" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Designed for Readable Recipe Infographics
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              KnowLens is built for visual explanation, not generic food images.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {whyKnowLens.map((item) => (
              <div key={item.title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold text-zinc-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-600">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Recipe Infographic Maker FAQ
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              Practical answers for turning recipe steps, ingredients, cooking notes, and plain text into clearer visual
              guides.
            </p>
          </div>
          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {faqs.map((faq) => (
              <div key={faq.question} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold text-zinc-950">{faq.question}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-zinc-200 bg-zinc-950 p-8 text-center text-white shadow-sm sm:p-10">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Create a Clear Recipe Infographic</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-300">
            Start with recipe steps, ingredients, or cooking notes. Generate a structured recipe infographic, visual
            recipe card, or step-by-step cooking guide in minutes.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={generatorHref}
              className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200"
            >
              Create a Recipe Infographic
              <ArrowRight size={16} className="ml-2" />
            </Link>
            <Link
              href="#examples"
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-6 text-sm font-medium text-white transition hover:bg-white/10"
            >
              View Examples
            </Link>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Related Infographic Tools
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              Explore more ways to turn steps, learning ideas, and visual summaries into structured infographics.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {relatedTools.map((tool) => (
              <Link
                key={tool.title}
                href={tool.href}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200"
              >
                <h3 className="text-base font-semibold text-zinc-950">{tool.title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-600">{tool.description}</p>
                <span className="mt-5 inline-flex items-center text-sm font-semibold text-emerald-700">
                  Open tool
                  <ArrowRight size={15} className="ml-2" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </MarketingChrome>
  );
}
