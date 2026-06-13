/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  FlaskConical,
  Layers3,
  Lightbulb,
  Sparkles,
} from "lucide-react";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

const siteUrl = "https://knowlens.ai";
const pageUrl = `${siteUrl}/infographic-examples`;

export const metadata: Metadata = {
  title: "Infographic Examples | AI-Generated Visual Summaries | KnowLens.ai",
  description:
    "Explore infographic examples made with KnowLens. Browse science infographics, educational visuals, poster-style summaries, and carousel-style visuals created from topics, notes, and text.",
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    type: "website",
    url: pageUrl,
    siteName: "KnowLens.ai",
    title: "Infographic Examples | KnowLens.ai",
    description:
      "Browse infographic examples created from topics, notes, and plain text. Get ideas for science visuals, educational infographics, posters, and visual summaries.",
    images: [
      {
        url: `${siteUrl}/en-picture/astronomy/astronomy-long-infographic.jpg`,
        width: 1200,
        height: 1600,
        alt: "Solar storms visual summary infographic created with KnowLens",
      },
    ],
  },
};

const generatorHref = "/app?intent=generate";

function createSimilarHref(prompt: string) {
  return `${generatorHref}&prompt=${encodeURIComponent(prompt)}`;
}

const examples = [
  {
    title: "Seed Germination Stages",
    description:
      "A classroom-style biology infographic that shows how a seed absorbs water, sprouts a root, and grows its first leaves in a clear four-step sequence.",
    image: "/en-picture/645ecabf-1b29-4d05-a377-1c886b5a2ae8.png",
    alt: "Seed germination infographic showing four visual growth stages",
    tags: ["Biology Infographic", "16:9"],
    prompt: "Explain seed germination in 5 stages for middle school students.",
    aspect: "landscape",
  },
  {
    title: "How Vaccines Train Immunity",
    description:
      "A health science explainer that breaks vaccine exposure, immune recognition, memory-cell development, and future protection into a clean horizontal overview.",
    image: "/en-picture/d561aaef-2126-479e-bef3-5726b925f88e.png",
    alt: "Vaccine immunity infographic with immune memory and protection stages",
    tags: ["Health Science", "16:9"],
    prompt: "Create a health science infographic explaining how vaccines train immune memory.",
    aspect: "landscape",
  },
  {
    title: "Google Earnings in Focus",
    description:
      "A report-style infographic that combines revenue charts, segment highlights, cloud growth, and key takeaways into a readable business snapshot.",
    image: "/en-picture/17e1c7f5-b04e-4e54-88af-787c79d1e8e3.png",
    alt: "Google quarterly earnings infographic with charts and segment highlights",
    tags: ["Business Report", "16:9"],
    prompt: "Create a business report infographic summarizing quarterly revenue, growth segments, charts, and executive highlights.",
    aspect: "landscape",
  },
  {
    title: "Photosynthesis Process",
    description:
      "A mobile-friendly biology poster that explains how sunlight, water, and carbon dioxide become glucose and oxygen with labeled process panels.",
    image: "/en-picture/biology/74380d3a-9a1b-44a2-998a-7c3482175ff4.png",
    alt: "Photosynthesis infographic showing leaf structure, inputs, and outputs",
    tags: ["Science Poster", "9:16"],
    prompt: "Create a biology infographic about photosynthesis with inputs, outputs, and simple process labels.",
    aspect: "portrait",
  },
  {
    title: "How Solar Storms Create Auroras",
    description:
      "A vertical astronomy infographic that follows solar flares, charged particles, Earth’s magnetosphere, and upper-atmosphere collisions to explain auroras.",
    image: "/en-picture/astronomy/63f2d8b5-da95-4f3c-9e02-46a61519071d.png",
    alt: "Solar storms infographic explaining how auroras form above Earth",
    tags: ["Astronomy Infographic", "9:16"],
    prompt: "Create an infographic about solar storms, including causes, effects, auroras, and key facts.",
    aspect: "portrait",
  },
  {
    title: "The Printing Press Timeline",
    description:
      "A history infographic that presents Gutenberg’s invention, literacy growth, scientific exchange, and a timeline of cultural impact in one vertical layout.",
    image: "/en-picture/history/88e45522-e408-429c-b670-92c62faa47d9.png",
    alt: "Printing press history infographic with timeline and historical milestones",
    tags: ["History Infographic", "9:16"],
    prompt: "Create a history infographic showing how the printing press changed literacy, publishing, and knowledge sharing.",
    aspect: "portrait",
  },
];

const landscapeExamples = examples.filter((example) => example.aspect === "landscape");
const portraitExamples = examples.filter((example) => example.aspect === "portrait");

const categories = [
  {
    title: "Science Infographics",
    description:
      "Visual examples for biology, physics, astronomy, earth science, and classroom science topics.",
    icon: FlaskConical,
  },
  {
    title: "Educational Infographics",
    description: "Study guides, lesson visuals, classroom posters, and learning summaries.",
    icon: BookOpen,
  },
  {
    title: "Process Infographics",
    description: "Step-by-step visuals for workflows, tutorials, recipes, and simple explanations.",
    icon: Layers3,
  },
  {
    title: "Visual Summaries",
    description: "Structured summaries created from plain text, notes, or short explanations.",
    icon: Lightbulb,
  },
  {
    title: "Poster-Style Infographics",
    description: "Single-page visuals for social posts, presentations, and quick knowledge sharing.",
    icon: BadgeCheck,
  },
  {
    title: "Carousel-Style Visuals",
    description: "Multi-section visuals that break one idea into easy-to-share parts.",
    icon: Sparkles,
  },
];

const prompts = [
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
];

const workflowSteps = [
  {
    title: "Choose an Example",
    description: "Browse the gallery and choose a style or structure that fits your idea.",
  },
  {
    title: "Add Your Text",
    description: "Paste your topic, notes, or short explanation.",
  },
  {
    title: "Generate Your Visual",
    description: "Create a new infographic, visual summary, poster-style visual, or carousel-style graphic.",
  },
];

const valuePoints = [
  {
    title: "Find the Right Structure",
    description:
      "Use examples to decide whether your idea works best as a timeline, process, comparison, poster, or visual summary.",
  },
  {
    title: "Learn What to Include",
    description: "Strong infographics use focused key points, short labels, and clear visual grouping.",
  },
  {
    title: "Get Better Results",
    description: "Seeing examples helps you write better prompts and provide more complete input.",
  },
  {
    title: "Create Faster",
    description: "Start from a proven format instead of beginning with a blank page.",
  },
];

const relatedWays = [
  {
    title: "AI Infographic Generator",
    description: "Turn topics, notes, and plain text into structured infographics.",
  },
  {
    title: "Infographic Maker",
    description: "Make clear infographics without design skills.",
  },
  {
    title: "Text to Infographic",
    description: "Turn plain text into infographic-style visuals.",
  },
  {
    title: "Science Infographic Generator",
    description: "Create structured science infographics from science topics and notes.",
  },
  {
    title: "AI Poster Generator",
    description: "Create poster-style visuals from ideas and notes.",
  },
  {
    title: "AI Carousel Generator",
    description: "Create carousel-style visuals for sharing.",
  },
];

const faqs = [
  {
    question: "What are infographic examples?",
    answer:
      "Infographic examples are finished visual references that show how ideas, notes, data, steps, or concepts can be turned into clear sections, diagrams, labels, charts, and summaries. They help you quickly judge what structure and visual style fits your own content best.",
  },
  {
    question: "Can I create a similar infographic with KnowLens?",
    answer:
      "Yes. Each example can act as a starting point for a new visual. You can open a similar workflow, replace the topic with your own notes or prompt, and generate a fresh infographic that keeps the same clarity while changing the content.",
  },
  {
    question: "What types of infographic examples are on this page?",
    answer:
      "This page includes a mix of science explainers, classroom visuals, history summaries, business report layouts, and poster-style knowledge graphics. The goal is to show different ways KnowLens can organize information depending on topic, format, and audience.",
  },
  {
    question: "How do I choose the right infographic format?",
    answer:
      "Start by looking at the kind of information you want to explain. Step-by-step content works well as a process infographic, concept explanations fit labeled posters, and metrics or comparisons often work better in report or comparison layouts. The examples here make those differences easier to spot.",
  },
  {
    question: "What should I give KnowLens for better results?",
    answer:
      "The best results usually come from a clear topic plus a few strong points you want included. Good inputs can be a short explanation, study notes, structured bullets, a process outline, or a plain-text summary with the main facts, steps, or labels you want shown.",
  },
  {
    question: "Do I need design skills to make infographics like these?",
    answer:
      "No. KnowLens is designed to help non-designers turn information into a cleaner visual format. The examples are useful because they show what a polished result can look like before you start, without requiring you to build a layout from scratch.",
  },
  {
    question: "Are these examples useful for classroom, presentation, or social content?",
    answer:
      "Yes. Many of these layouts work well for lessons, study guides, internal explainers, reports, slides, blog visuals, and shareable educational posts. The right example can help you decide whether your idea should feel more like a study sheet, a poster, or a structured summary.",
  },
  {
    question: "Why browse examples before generating an infographic?",
    answer:
      "Browsing examples first helps you get more intentional about structure, tone, and content density. Instead of starting from a blank idea, you can choose a direction that already matches your topic, then generate something clearer and closer to the result you want.",
  },
];

const collectionJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Infographic Examples Made with KnowLens",
  url: pageUrl,
  description:
    "A gallery of infographic examples created from topics, notes, and plain text with KnowLens, including science infographics, educational visuals, poster-style summaries, and carousel-style visuals.",
  mainEntity: examples.map((example) => ({
    "@type": "CreativeWork",
    name: example.title,
    description: example.description,
    image: `${siteUrl}${example.image}`,
  })),
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: siteUrl,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Infographic Examples",
      item: pageUrl,
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

export default function InfographicExamplesPage() {
  return (
    <MarketingChrome>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([collectionJsonLd, breadcrumbJsonLd, faqJsonLd]) }}
      />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-4 py-14 sm:px-6 lg:py-20">
        <section className="text-center">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-zinc-600 shadow-sm">
            <Sparkles size={14} className="text-emerald-600" />
            Infographic Examples
          </div>
          <h1 className="mx-auto max-w-4xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-6xl">
            Infographic Examples Made with KnowLens
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-zinc-600 sm:text-lg">
            Explore science infographics, educational visuals, poster-style summaries, and carousel-style examples
            created from topics, notes, and plain text.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={generatorHref}
              className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-950 px-6 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800"
            >
              Create Your Infographic
              <ArrowRight size={16} className="ml-2" />
            </Link>
            <Link
              href="#examples"
              className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-300 bg-white px-6 text-sm font-medium text-zinc-900 shadow-sm transition hover:bg-zinc-100"
            >
              Browse Examples
            </Link>
          </div>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-zinc-500">
            Use these examples as inspiration, then create a similar infographic from your own text or notes.
          </p>
        </section>

        <section className="rounded-[2rem] border border-zinc-200 bg-white/90 p-6 shadow-sm sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Visual reference guide
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
                What Are Infographic Examples?
              </h2>
              <p className="mt-4 text-base leading-8 text-zinc-600">
                Infographic examples are visual references that show how information can be organized into clear
                sections, labels, diagrams, and summaries. KnowLens examples show how topics, notes, and plain text can
                become structured infographics, visual summaries, poster-style visuals, and carousel-style graphics.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {examples.slice(0, 4).map((example) => (
                <div key={example.title} className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
                  <img
                    src={example.image}
                    alt={example.alt}
                    width={520}
                    height={420}
                    className="h-40 w-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="examples" className="scroll-mt-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Featured Infographic Examples
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              Browse examples across science, education, study notes, recipes, product ideas, and social visuals.
            </p>
          </div>

          <div className="mt-10 space-y-5">
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {landscapeExamples.map((example) => (
                <article
                  key={example.title}
                  className="overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white shadow-sm"
                >
                  <div className="bg-zinc-100 p-3">
                    <img
                      src={example.image}
                      alt={example.alt}
                      width={1672}
                      height={941}
                      className="aspect-[16/9] w-full rounded-[1rem] object-cover"
                    />
                  </div>
                  <div className="p-5">
                    <div className="flex flex-wrap gap-2">
                      {example.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <h3 className="mt-4 text-xl font-semibold tracking-tight text-zinc-950">{example.title}</h3>
                    <p className="mt-3 min-h-[5.25rem] text-sm leading-6 text-zinc-600">{example.description}</p>
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

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {portraitExamples.map((example) => (
                <article
                  key={example.title}
                  className="overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white shadow-sm"
                >
                  <div className="bg-zinc-100 p-3">
                    <img
                      src={example.image}
                      alt={example.alt}
                      width={941}
                      height={1672}
                      className="aspect-[9/16] w-full rounded-[1rem] object-cover object-top"
                    />
                  </div>
                  <div className="p-5">
                    <div className="flex flex-wrap gap-2">
                      {example.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <h3 className="mt-4 text-xl font-semibold tracking-tight text-zinc-950">{example.title}</h3>
                    <p className="mt-3 min-h-[5.25rem] text-sm leading-6 text-zinc-600">{example.description}</p>
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
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Browse Infographic Ideas by Category
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              Find examples for different use cases, then create your own version with KnowLens.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <div key={category.title} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-zinc-950">{category.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-600">{category.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Prompt starters</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">Try These Infographic Prompts</h2>
            <p className="mt-4 text-sm leading-7 text-zinc-600">
              Use these prompts as starting points. Complete text and clear key points usually produce better visuals.
            </p>
            <p className="mt-4 rounded-2xl bg-zinc-50 p-4 text-sm leading-7 text-zinc-600">
              For better results, include the topic, audience, key points, steps, facts, and examples you want to show.
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
          <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-zinc-950">
                  How to Create a Similar Infographic
                </h2>
                <p className="mt-4 text-base leading-7 text-zinc-600">
                  Start from an example, then use your own text, notes, or topic.
                </p>
                <Link
                  href={generatorHref}
                  className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-zinc-950 px-5 text-sm font-medium text-white transition hover:bg-zinc-800"
                >
                  Create Similar
                  <ArrowRight size={15} className="ml-2" />
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {workflowSteps.map((step, index) => (
                  <div key={step.title} className="rounded-2xl bg-zinc-50 p-5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-semibold text-zinc-900 shadow-sm">
                      {index + 1}
                    </div>
                    <h3 className="mt-5 text-base font-semibold text-zinc-950">{step.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-zinc-600">{step.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Why Browse Infographic Examples?
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              Examples help you understand what kind of visual structure works best for your idea.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {valuePoints.map((point) => (
              <div key={point.title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold text-zinc-950">{point.title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-600">{point.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Related Infographic Tools
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              Explore more ways to create infographic-style visuals with KnowLens.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {relatedWays.map((tool) => (
              <Link
                key={tool.title}
                href={generatorHref}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200"
              >
                <h3 className="text-base font-semibold text-zinc-950">{tool.title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-600">{tool.description}</p>
                <span className="mt-5 inline-flex items-center text-sm font-semibold text-emerald-700">
                  Start creating
                  <ArrowRight size={15} className="ml-2" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Infographic Examples FAQ
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              Practical answers for turning ideas, notes, and plain text into clearer visual summaries.
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
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Create Your Own Infographic</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-300">
            Start with a topic, notes, or plain text. Turn your idea into a clear infographic, visual summary,
            poster-style visual, or carousel-style graphic.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={generatorHref}
              className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200"
            >
              Create an Infographic
              <ArrowRight size={16} className="ml-2" />
            </Link>
            <Link
              href="#examples"
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-6 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Browse Examples
            </Link>
          </div>
        </section>
      </div>
    </MarketingChrome>
  );
}
