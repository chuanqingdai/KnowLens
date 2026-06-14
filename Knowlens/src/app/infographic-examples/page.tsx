import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, BookOpen, Briefcase, FlaskConical, Grid2X2, Layers3, Lightbulb, Sparkles, UtensilsCrossed } from "lucide-react";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

const siteUrl = "https://knowlens.ai";
const pageUrl = `${siteUrl}/infographic-examples`;

export const metadata: Metadata = {
  title: { absolute: "Infographic Examples | AI-Generated Visual Summaries | KnowLens.ai" },
  description:
    "Explore infographic examples made with KnowLens. Browse science infographics, educational visuals, poster-style summaries, and carousel-style visuals created from topics, notes, and text.",
  keywords: [
    "infographic examples",
    "AI infographic examples",
    "infographic design examples",
    "educational infographic examples",
    "science infographic examples",
    "visual summary examples",
    "poster infographic examples",
    "carousel-style visual examples",
    "infographic inspiration",
    "infographic ideas",
    "infographic maker examples",
    "AI infographic generator examples",
    "text to infographic examples",
  ],
  alternates: { canonical: pageUrl },
  openGraph: {
    type: "website",
    url: pageUrl,
    siteName: "KnowLens.ai",
    title: "Infographic Examples | KnowLens.ai",
    description:
      "Browse infographic examples created from topics, notes, and plain text. Get ideas for science visuals, educational infographics, posters, and visual summaries.",
    images: [
      {
        url: `${siteUrl}/en-picture/photosynthesis-infographic-case.jpg`,
        width: 1672,
        height: 941,
        alt: "Seed germination educational infographic created with KnowLens",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Infographic Examples | AI-Generated Visual Summaries | KnowLens.ai",
    description:
      "Browse infographic examples, science visuals, educational infographics, poster-style summaries, and carousel-style visuals created from text.",
    images: [`${siteUrl}/en-picture/photosynthesis-infographic-case.jpg`],
  },
};

const examples = [
  {
    title: "Cell Structure",
    description:
      "A biology infographic that maps the membrane, nucleus, cytoplasm, mitochondria, and other core organelles in a wide classroom-friendly layout.",
    tags: ["Biology Infographic", "16:9"],
    image: "/images/infographic/biology/biology-cell-structure-infographic.webp",
    alt: "Cell structure infographic with membrane nucleus cytoplasm mitochondria and labeled organelles",
    width: 1659,
    height: 948,
    topic:
      "Create a biology infographic explaining cell structure with membrane, nucleus, cytoplasm, mitochondria, ribosomes, and core organelle functions.",
  },
  {
    title: "Earth Layers",
    description:
      "An earth science infographic that explains the crust, mantle, outer core, inner core, and the relationship between internal layers and surface processes.",
    tags: ["Earth Science", "16:9"],
    image: "/images/infographic/earth-science/earth-science-earth-layers-infographic.webp",
    alt: "Earth layers infographic with crust mantle outer core inner core and internal structure sections",
    width: 1659,
    height: 948,
    topic:
      "Create an earth science infographic explaining the crust, mantle, outer core, inner core, and how Earth layers connect to tectonic activity.",
  },
  {
    title: "Pizza Margherita Recipe Process",
    description:
      "A recipe process infographic that turns ingredients, preparation, baking, and serving steps into one easy-to-follow cooking visual.",
    tags: ["Recipe Infographic", "16:9"],
    image: "/images/infographic/recipe/recipe-pizza-margherita-recipe-process-infographic.webp",
    alt: "Pizza margherita recipe process infographic with ingredients cooking steps and serving notes",
    width: 1659,
    height: 948,
    topic:
      "Create a recipe infographic showing pizza margherita ingredients, dough preparation, topping steps, baking instructions, and serving tips.",
  },
  {
    title: "Crusades Overview",
    description:
      "A history infographic that organizes the causes, major campaigns, key groups, and historical consequences of the Crusades in a tall editorial layout.",
    tags: ["History Infographic", "9:16"],
    image: "/images/infographic/history/history-crusades-overview-infographic.webp",
    alt: "Crusades overview history infographic with causes campaigns groups and outcomes",
    width: 948,
    height: 1659,
    topic:
      "Create a history infographic explaining the Crusades with causes, major campaigns, religious and political actors, and long-term consequences.",
  },
  {
    title: "AI Agent vs AI Assistant",
    description:
      "A comparison infographic that separates autonomy, tool use, workflow scope, supervision needs, and practical use cases for AI agents and AI assistants.",
    tags: ["Comparison Infographic", "9:16"],
    image: "/images/infographic/comparison/comparison-ai-agent-vs-ai-assistant-comparison-infographic.webp",
    alt: "AI agent versus AI assistant comparison infographic with side by side workflow and autonomy differences",
    width: 948,
    height: 1659,
    topic:
      "Create a comparison infographic showing AI agents versus AI assistants with autonomy, tool use, workflow ownership, oversight, and business use cases.",
  },
  {
    title: "Nvidia AI Data Center Revenue Insight",
    description:
      "A financial report infographic that summarizes Nvidia's AI data center revenue growth, demand drivers, and investor-facing market context in a mobile-friendly format.",
    tags: ["Financial Report", "9:16"],
    image: "/images/infographic/financial-report/finance-nvidia-ai-data-center-revenue-insight.webp",
    alt: "Nvidia AI data center revenue insight infographic with growth metrics demand drivers and market context",
    width: 948,
    height: 1659,
    topic:
      "Create a finance infographic explaining Nvidia AI data center revenue growth, demand drivers, valuation context, and market implications.",
  },
] as const;

const portraitExamples = examples.filter((item) => item.height > item.width);
const landscapeExamples = examples.filter((item) => item.width > item.height);

const categories = [
  {
    title: "Science Infographics",
    description: "Visual examples for biology, physics, astronomy, earth science, and classroom science topics.",
    href: "/infographic/science",
    Icon: FlaskConical,
  },
  {
    title: "Biology Infographics",
    description: "Cells, anatomy, genetics, ecosystems, and other life science visuals.",
    href: "/infographic/biology",
    Icon: BookOpen,
  },
  {
    title: "Earth Science Infographics",
    description: "Geology, weather, climate, Earth layers, and natural system visuals.",
    href: "/infographic/earth-science",
    Icon: Grid2X2,
  },
  {
    title: "Process Infographics",
    description: "Step-by-step visuals for workflows, operations, tutorials, and technical sequences.",
    href: "/infographic/process",
    Icon: Layers3,
  },
  {
    title: "Recipe Infographics",
    description: "Visual recipe cards with ingredients, prep steps, cooking flow, and serving notes.",
    href: "/infographic/recipe",
    Icon: UtensilsCrossed,
  },
  {
    title: "History Infographics",
    description: "Historical explainers, civilization overviews, timelines, and visual learning pages.",
    href: "/infographic/history",
    Icon: BookOpen,
  },
  {
    title: "Business Infographics",
    description: "Market insight, financial report, insurance, roadmap, and industry report visuals.",
    href: "/infographic/business",
    Icon: Briefcase,
  },
  {
    title: "Educational Infographics",
    description: "Study guides, classroom posters, lesson visuals, and structured learning summaries.",
    href: "/infographic/education",
    Icon: Sparkles,
  },
] as const;

const promptExamples = [
  "Explain seed germination in 5 stages for middle school students.",
  "Create an infographic about solar storms, including causes, effects, and key facts.",
  "Turn these notes about DNA replication into a poster-style infographic.",
  "Make a visual summary of the water cycle with simple labels.",
  "Create a step-by-step infographic for a simple pasta recipe.",
  "Explain my product idea in 5 clear sections.",
  "Turn my study notes into a visual study guide.",
  "Create a comparison infographic showing the pros and cons of two options.",
  "Make a process infographic for a 4-step workflow.",
  "Create a social media infographic that explains one idea clearly.",
] as const;

const creationSteps = [
  ["Choose an Example", "Browse the gallery and choose a style or structure that fits your idea."],
  ["Add Your Text", "Paste your topic, notes, or short explanation."],
  ["Generate Your Visual", "Create a new infographic, visual summary, poster-style visual, or carousel-style graphic."],
] as const;

const whyExamples = [
  ["Find the Right Structure", "Use examples to decide whether your idea works best as a timeline, process, comparison, poster, or visual summary."],
  ["Learn What to Include", "Strong infographics use focused key points, short labels, and clear visual grouping."],
  ["Get Better Results", "Seeing examples helps you write better prompts and provide more complete input."],
  ["Create Faster", "Start from a proven format instead of beginning with a blank page."],
] as const;

const relatedTools = [
  ["AI Infographic Generator", "/ai-infographic-generator", "Turn topics, notes, and plain text into structured infographics."],
  ["Text to Infographic", "/text-to-infographic", "Turn plain text into infographic-style visuals."],
  ["Infographic Maker", "/infographic-maker", "Make clear infographics without design skills."],
  ["Science Infographic Generator", "/science-infographic-generator", "Create structured science infographics from science topics and notes."],
  ["Biology Infographic Generator", "/biology-infographic-generator", "Create life science visuals for cells, body systems, ecosystems, and biology lessons."],
  ["Earth Science Infographic Generator", "/earth-science-infographic-generator", "Create visuals for geology, weather, climate, oceans, and Earth systems."],
  ["Educational Infographic Maker", "/educational-infographic-maker", "Create classroom visuals, study guides, and learning summaries."],
  ["Process Infographic Generator", "/process-infographic-generator", "Create step-by-step workflow visuals, tutorials, and process guides."],
  ["Recipe Infographic Maker", "/recipe-infographic-maker", "Turn ingredients and cooking steps into visual recipe cards."],
  ["AI Poster Generator", "/ai-poster-generator", "Create poster-style visuals from ideas and notes."],
  ["AI Carousel Generator", "/ai-carousel-generator", "Create carousel-style visuals for sharing."],
] as const;

const faqItems = [
  [
    "What are infographic examples?",
    "Infographic examples are finished visuals that show how one topic can be organized into sections, labels, charts, timelines, comparisons, or step-by-step blocks. They help you see the structure before you start creating your own version, which makes it much easier to decide whether your content should become a science explainer, a classroom study guide, a recipe process card, a financial summary, or a poster-style visual.",
  ],
  [
    "Can I create a similar infographic with KnowLens?",
    "Yes. Each example can act as a starting point for a new visual. If you like the pacing, hierarchy, or general composition of an example, you can use it as inspiration, replace the topic with your own notes or text, and generate a new infographic that keeps the same broad structure while changing the actual content. This is especially useful when you know the kind of layout you want but have not written the final prompt yet.",
  ],
  [
    "What kinds of infographic examples are included on this page?",
    "The gallery is intentionally mixed so you can compare different visual structures side by side. It may include biology diagrams, earth science explainers, recipe process infographics, financial report summaries, history visuals, comparison charts, roadmap layouts, and study-guide style examples. The goal is to show different ways plain text can become a readable visual system rather than repeating one narrow format.",
  ],
  [
    "What should I provide to get better infographic results?",
    "The best results usually come from complete input. Include the topic, intended audience, the main sections or stages you want covered, any required labels, and the kind of structure you want the infographic to use. If your content has steps, comparisons, milestones, definitions, or key facts, naming them directly gives KnowLens more to work with and usually leads to a clearer, more accurate, and more useful result.",
  ],
  [
    "Do I need design skills to make something like these examples?",
    "No. KnowLens is built for people who have information to explain but do not want to start from a blank canvas. Instead of manually placing every title, box, and label, you focus on the content and the system helps shape that content into a clearer visual hierarchy. That makes it useful for students, teachers, marketers, founders, operators, writers, and creators who want polished visuals without traditional design work.",
  ],
  [
    "How is this different from a normal template gallery?",
    "A normal template gallery usually starts with fixed layouts that you fill in manually. KnowLens examples work differently because they reflect outputs generated from topics, notes, and prompts. That means each example is both a visual reference and a practical hint about how to describe your own content, what level of detail works well, and how much structure is useful when you want the final infographic to feel clear instead of crowded.",
  ],
  [
    "Are these examples useful for social media, teaching, and presentations?",
    "Yes. Many examples on this page work well across multiple contexts. A science infographic can support classroom teaching, a comparison layout can work in a blog post or LinkedIn carousel, and a report-style visual can support presentations, briefings, or internal communication. Browsing examples helps you spot which structures feel easiest to reuse for sharing, teaching, or explaining ideas in a professional setting.",
  ],
  [
    "Can I browse examples to choose the right infographic format first?",
    "Yes. That is one of the main reasons this page exists. If you are unsure whether your topic should become a process infographic, a comparison visual, a roadmap, a study guide, a poster-style summary, or a financial insight card, browsing examples first makes that decision much easier. Once the format is clear, writing a stronger prompt and getting a better result usually becomes much faster and more predictable.",
  ],
] as const;

const collectionSchema = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Infographic Examples",
  url: pageUrl,
  description:
    "A gallery of infographic examples created from topics, notes, and plain text with KnowLens, including science infographics, educational visuals, poster-style summaries, and carousel-style visuals.",
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
    { "@type": "ListItem", position: 2, name: "Infographic Examples", item: pageUrl },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map(([question, answer]) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  })),
};

function SectionHeading({ title, description, eyebrow }: { title: string; description: string; eyebrow?: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{eyebrow}</p> : null}
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">{title}</h2>
      <p className="mt-3 text-base leading-7 text-zinc-600">{description}</p>
    </div>
  );
}

function generateHref(prompt: string) {
  return `/app?intent=generate&prompt=${encodeURIComponent(prompt)}`;
}

export default function InfographicExamplesPage() {
  return (
    <MarketingChrome>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <section className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-10 pt-10 text-center sm:px-6 lg:pt-16">
        <p className="inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 shadow-sm">
          CURATED VISUAL IDEAS
        </p>
        <h1 className="mx-auto mt-6 max-w-5xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl lg:text-[4rem] lg:leading-[1.05]">
          Infographic Examples for Visual Inspiration
        </h1>
        <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-zinc-600">
          Explore science infographics, educational visuals, poster-style summaries, and carousel-style examples created from topics, notes, and plain text.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/app?intent=generate" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-zinc-950 px-6 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(15,23,42,0.18)] transition hover:bg-zinc-800">
            Create Your Infographic
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="#examples" className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-300 bg-white px-6 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50">
            Browse Examples
          </Link>
        </div>
        <div className="mt-4 inline-flex items-center gap-2 text-sm text-zinc-600">
          <BadgeCheck size={16} className="text-emerald-600" aria-hidden="true" />
          Start with your own text or notes.
        </div>
        <div className="mt-8 w-full max-w-[760px]">
          <img
            src="/picture/science-infographic.jpg"
            alt="Musculoskeletal system science infographic with labeled anatomy"
            width={1003}
            height={565}
            className="mx-auto h-auto w-full rounded-[1.5rem] object-contain shadow-[0_20px_55px_rgba(15,23,42,0.14)]"
            loading="eager"
          />
        </div>
      </section>

      <section id="examples" className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading title="Featured Infographic Examples" description="Browse examples across science, education, study notes, product ideas, process visuals, and social visuals." />
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {landscapeExamples.map((item) => (
            <article key={item.title} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="bg-zinc-50 p-3">
                <img src={item.image} alt={item.alt} width={item.width} height={item.height} className="mx-auto h-auto w-full rounded-xl object-contain" loading="lazy" />
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-600">{tag}</span>
                  ))}
                </div>
                <h3 className="mt-3 text-lg font-semibold text-zinc-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{item.description}</p>
                <Link href={generateHref(item.topic)} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-950 hover:text-emerald-700">
                  Create Similar
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {portraitExamples.map((item) => (
            <article key={item.title} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="bg-zinc-50 p-3">
                <img src={item.image} alt={item.alt} width={item.width} height={item.height} className="mx-auto h-auto w-full rounded-xl object-contain" loading="lazy" />
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-600">{tag}</span>
                  ))}
                </div>
                <h3 className="mt-3 text-lg font-semibold text-zinc-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{item.description}</p>
                <Link href={generateHref(item.topic)} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-950 hover:text-emerald-700">
                  Create Similar
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">What Are Infographic Examples?</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-600 sm:text-base">
            Infographic examples are visual references that show how information can be organized into clear sections, labels, diagrams, and summaries. KnowLens examples show how topics, notes, and plain text can become structured infographics, visual summaries, poster-style visuals, and carousel-style graphics.
          </p>
        </div>
      </section>

            <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading title="Browse Infographic Ideas by Category" description="Find examples for different use cases, then create your own version with KnowLens." />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((item) => {
            const { title, description, Icon } = item;
            const href = "href" in item ? item.href : undefined;
            const content = (
              <>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                  <Icon size={22} aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-zinc-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
              </>
            );
            return href ? (
              <Link key={title} href={href} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
                {content}
              </Link>
            ) : (
              <article key={title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                {content}
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading title="Try These Infographic Prompts" description="Use these prompts as starting points. Complete text and clear key points usually produce better visuals." />
        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {promptExamples.map((prompt, index) => (
            <Link key={prompt} href={generateHref(prompt)} className="group rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
              <span className="text-xs font-semibold text-emerald-700">Prompt {index + 1}</span>
              <p className="mt-2 text-sm leading-6 text-zinc-700">{prompt}</p>
            </Link>
          ))}
        </div>
        <p className="mx-auto mt-5 max-w-3xl text-center text-sm leading-6 text-zinc-600">
          For better results, include the topic, audience, key points, steps, facts, and examples you want to show.
        </p>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading eyebrow="CREATE SIMILAR" title="How to Create a Similar Infographic" description="Start from an example, then use your own text, notes, or topic." />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {creationSteps.map(([title, description], index) => (
            <article key={title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white">{index + 1}</span>
              <h3 className="mt-4 text-lg font-semibold text-zinc-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
            </article>
          ))}
        </div>
        <div className="mt-7 text-center">
          <Link href="#examples" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white hover:bg-zinc-800">
            Create Similar
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading title="Why Browse Infographic Examples?" description="Examples help you understand what kind of visual structure works best for your idea." />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {whyExamples.map(([title, description]) => (
            <article key={title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-zinc-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading title="Related Infographic Tools" description="Explore more ways to create infographic-style visuals with KnowLens." />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {relatedTools.map(([title, href, description]) => (
            <Link key={href} href={href} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
              <h3 className="text-lg font-semibold text-zinc-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
        <SectionHeading title="FAQ" description="Common questions about KnowLens infographic examples." />
        <div className="mt-8 divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white">
          {faqItems.map(([question, answer]) => (
            <details key={question} className="group p-5">
              <summary className="cursor-pointer list-none text-base font-semibold text-zinc-950">{question}</summary>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <div className="rounded-[2rem] bg-zinc-950 px-6 py-12 text-center text-white sm:px-10">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">Create Your Own Infographic</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-300">
            Start with a topic, notes, or plain text. Turn your idea into a clear infographic, visual summary, poster-style visual, or carousel-style graphic.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/app?intent=generate" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-zinc-950 hover:bg-zinc-100">
              Create an Infographic
              <ArrowRight size={16} />
            </Link>
            <Link href="#examples" className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-6 text-sm font-semibold text-white hover:bg-white/10">
              Browse Examples
            </Link>
          </div>
        </div>
      </section>
    </MarketingChrome>
  );
}
