/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Layers3,
  ListChecks,
  Route,
  Sparkles,
} from "lucide-react";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

const siteOrigin = "https://knowlens.ai";
const pagePath = "/process-infographic-generator";
const pageLink = `${siteOrigin}${pagePath}`;
const generatorHref = "/app?intent=generate";
const heroImage = "/picture/process-infographic-generator.jpg";

export const metadata: Metadata = {
  title: "Process Infographic Generator | Create Step-by-Step Infographics with AI | KnowLens.ai",
  description:
    "Turn process notes, steps, and plain text into clear process infographics, workflow visuals, and step-by-step guides with KnowLens.ai.",
  alternates: {
    canonical: pageLink,
  },
  openGraph: {
    type: "website",
    siteName: "KnowLens.ai",
    title: "Process Infographic Generator | KnowLens.ai",
    description:
      "Create process infographics from topics, notes, and step-by-step text. Turn workflows, tutorials, and how-to instructions into readable visual summaries.",
    url: pageLink,
    images: [
      {
        url: `${siteOrigin}${heroImage}`,
        width: 1003,
        height: 565,
        alt: "Semiconductor chip manufacturing process infographic with seven production steps",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Process Infographic Generator | KnowLens.ai",
    description:
      "Turn process notes, steps, and plain text into clear process infographics and workflow visuals.",
    images: [`${siteOrigin}${heroImage}`],
  },
};

function createSimilarHref(prompt: string) {
  return `${generatorHref}&prompt=${encodeURIComponent(prompt)}`;
}

const visualTypes = [
  {
    title: "Step-by-Step Infographics",
    description: "Turn ordered steps and instructions into a clear visual guide with readable sections.",
    icon: ListChecks,
  },
  {
    title: "Workflow Infographics",
    description: "Explain how tasks, decisions, or actions move through a workflow.",
    icon: Route,
  },
  {
    title: "How-To Visual Guides",
    description: "Create visuals that help people understand how to complete a task or follow a process.",
    icon: CheckCircle2,
  },
  {
    title: "Tutorial Infographics",
    description: "Turn tutorial notes or short instructions into structured visual summaries.",
    icon: BookOpen,
  },
  {
    title: "Process Posters",
    description: "Create poster-style process visuals for teaching, presenting, or quick reference.",
    icon: BadgeCheck,
  },
  {
    title: "Carousel-Style Process Visuals",
    description: "Break one process into multiple visual sections that are easier to share.",
    icon: Layers3,
  },
];

const workflowSteps = [
  {
    title: "Add Your Process or Steps",
    description: "Start with a process topic, notes, plain text, step-by-step instructions, or a short explanation.",
  },
  {
    title: "Structure the Sequence",
    description: "KnowLens organizes the content into ordered steps, key points, labels, and visual hierarchy.",
  },
  {
    title: "Generate the Infographic",
    description:
      "Create a process infographic, workflow visual, step-by-step guide, poster-style visual, or carousel-style process visual.",
  },
];

const prompts = [
  "Turn this 5-step onboarding process into a clear process infographic.",
  "Create a workflow infographic for how customer support tickets are handled.",
  "Make a step-by-step visual guide for building a daily habit.",
  "Create a process infographic that explains how an idea becomes a finished design.",
  "Turn these cooking steps into a simple visual guide.",
  "Create a tutorial infographic for setting up a study plan.",
  "Explain a product launch workflow with steps, owners, and outcomes.",
  "Create a visual guide for how a student should prepare for an exam.",
  "Turn this content creation workflow into a structured infographic.",
  "Create a process visual that explains how to solve a common customer problem.",
];

const useCases = [
  {
    title: "Students",
    description: "Turn study processes and learning steps into visual guides.",
    icon: GraduationCap,
  },
  {
    title: "Teachers",
    description: "Create classroom-ready process visuals for lessons and activities.",
    icon: BookOpen,
  },
  {
    title: "Content Creators",
    description: "Turn how-to ideas and tutorials into shareable visual content.",
    icon: Sparkles,
  },
  {
    title: "Small Teams",
    description: "Create quick workflow visuals without a designer.",
    icon: Layers3,
  },
  {
    title: "Product Teams",
    description: "Explain product workflows, feature steps, and user journeys visually.",
    icon: Route,
  },
  {
    title: "Trainers",
    description: "Turn instructions and training points into visual process guides.",
    icon: BadgeCheck,
  },
];

const horizontalExamples = [
  {
    title: "Semiconductor Chip Manufacturing",
    description:
      "A step-by-step manufacturing infographic that explains wafer preparation, coating, photolithography, etching, implantation, interconnects, and testing.",
    image: heroImage,
    width: 1003,
    height: 565,
    alt: "Semiconductor chip manufacturing process infographic with wafer preparation photolithography etching and testing labels",
    tags: ["Process Infographic", "Workflow Visual"],
    prompt: "Create a process infographic explaining how semiconductor chips are made from wafer preparation to testing.",
  },
  {
    title: "Printing Press Change Process",
    description:
      "A historical process visual that shows how movable type led to faster production, wider reading, and cultural change.",
    image: "/en-picture/printing-press-history-infographic-case.jpg",
    width: 1672,
    height: 941,
    alt: "Printing press process infographic with movable type and cultural change steps",
    tags: ["Process Infographic", "Visual Summary"],
    prompt: "Create a process infographic explaining how the printing press changed knowledge sharing.",
  },
  {
    title: "Plate Tectonics Sequence",
    description:
      "An earth science process visual that explains plate movement, stress buildup, and earthquake-related outcomes.",
    image: "/en-picture/plate-tectonics-earthquake-infographic-case.jpg",
    width: 1672,
    height: 941,
    alt: "Plate tectonics process visual with movement and earthquake sequence labels",
    tags: ["Workflow Visual", "Step Order"],
    prompt: "Create a process visual that explains plate movement, stress buildup, and earthquake outcomes.",
  },
];

const verticalExamples = [
  {
    title: "DNA Replication Steps",
    description:
      "A biology process infographic that breaks replication into helicase, unzipping, base pairing, polymerase, and final copies.",
    image: heroImage,
    width: 941,
    height: 1672,
    alt: "DNA replication step-by-step infographic with helicase unzipping base pairing and polymerase labels",
    tags: ["Step-by-Step Guide", "Tutorial Infographic"],
    prompt: "Turn these biology notes about DNA replication into a clear step-by-step process infographic.",
  },
  {
    title: "Printing Press Timeline Process",
    description:
      "A vertical process summary that organizes Gutenberg, movable type, book production, literacy growth, and reform stages.",
    image: "/en-picture/history/history-infographic-card.jpg",
    width: 941,
    height: 1672,
    alt: "Printing press timeline process infographic with Gutenberg movable type and literacy stages",
    tags: ["Process Infographic", "Visual Summary"],
    prompt: "Make a process infographic showing the printing press timeline and its stages of influence.",
  },
  {
    title: "Volcano Eruption Process",
    description:
      "A geology process guide that explains magma chambers, pressure, ash clouds, lava flow, and eruption structure.",
    image: "/en-picture/geography/geography-long-infographic.jpg",
    width: 941,
    height: 1672,
    alt: "Volcano eruption process infographic with magma chamber ash cloud and lava flow labels",
    tags: ["How-To Visual", "Process Summary"],
    prompt: "Create a process infographic explaining the parts and sequence of a volcano eruption.",
  },
];

const whyKnowLens = [
  {
    title: "Clear Step Order",
    description: "Turn process text into ordered steps that are easier to follow.",
  },
  {
    title: "Readable Labels",
    description: "Create visuals with clear headings, step labels, and short text blocks.",
  },
  {
    title: "Structured Workflows",
    description: "Organize workflows into stages, actions, decisions, and outcomes.",
  },
  {
    title: "Clear Visual Hierarchy",
    description: "Emphasize the most important steps with sections, spacing, titles, and visual grouping.",
  },
  {
    title: "Content-First Visuals",
    description: "Start from a process explanation instead of a blank canvas.",
  },
];

const faqs = [
  {
    question: "What is a process infographic generator?",
    answer:
      "A process infographic generator turns steps, workflows, notes, or plain text into structured visual summaries. KnowLens helps organize the content into sequence, key points, readable labels, and a clear visual hierarchy.",
  },
  {
    question: "Can I create process infographics from text?",
    answer:
      "Yes. You can start with a process topic, step-by-step instructions, notes, or plain text, and KnowLens can help turn it into a process infographic, workflow visual, or how-to guide.",
  },
  {
    question: "What kinds of processes can I visualize?",
    answer:
      "You can create visuals for workflows, tutorials, how-to instructions, onboarding steps, learning processes, recipe steps, product workflows, support flows, and training processes.",
  },
  {
    question: "Do I need design skills?",
    answer:
      "No. KnowLens helps organize your process into a clear visual layout, so you do not need to start from a blank canvas or design template.",
  },
  {
    question: "Can I create workflow infographics?",
    answer:
      "Yes. KnowLens can help create workflow infographics that show stages, actions, decisions, and outcomes in a readable visual structure.",
  },
  {
    question: "Can I create step-by-step guides?",
    answer:
      "Yes. You can turn ordered steps, instructions, or how-to content into a step-by-step infographic or visual guide.",
  },
  {
    question: "How is this different from a normal infographic maker?",
    answer:
      "A normal infographic maker usually starts with templates. KnowLens starts with your process text or notes, organizes the sequence, and turns it into structured visual information.",
  },
  {
    question: "How is this different from a generic AI image generator?",
    answer:
      "Generic AI image tools often focus on decorative images. KnowLens focuses on structured process visuals with step order, readable labels, clear sections, and infographic-style layouts.",
  },
  {
    question: "What should I include in my input?",
    answer:
      "For best results, include the process topic, ordered steps, key actions, decision points, examples, and the audience you want to explain it to.",
  },
  {
    question: "Can I use this for teaching or training?",
    answer:
      "Yes. Process infographics can help explain learning steps, training workflows, tutorials, and simple operating processes.",
  },
];

const relatedTools = [
  {
    title: "Educational Infographic Maker",
    description: "Create structured learning visuals, study guides, and classroom-ready infographics.",
    href: "/educational-infographic-maker",
  },
  {
    title: "Infographic Examples",
    description: "Browse process-friendly infographic examples and visual summary ideas.",
    href: "/infographic-examples",
  },
];

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "KnowLens Process Infographic Generator",
  applicationCategory: "DesignApplication",
  operatingSystem: "Web",
  url: pageLink,
  description:
    "KnowLens turns process topics, steps, notes, and plain text into structured process infographics, workflow visuals, and step-by-step visual guides.",
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
      name: "Process Infographic Generator",
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

export default function ProcessInfographicGeneratorPage() {
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
              Process Infographic Generator
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-6xl">
              Process Infographic Generator
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-600 sm:text-lg">
              Turn steps, workflows, notes, or plain text into clear process infographics with readable labels,
              sequence, sections, and visual hierarchy.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={generatorHref}
                className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-950 px-6 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800"
              >
                Create a Process Infographic
                <ArrowRight size={16} className="ml-2" />
              </Link>
              <Link
                href="#examples"
                className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-300 bg-white px-6 text-sm font-medium text-zinc-900 shadow-sm transition hover:bg-zinc-100"
              >
                View Examples
              </Link>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-500">
              No design skills needed. Start with a process, workflow, how-to guide, or short explanation.
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
              Built for step-by-step guides, workflow visuals, tutorials, and clear process explanation.
            </p>
          </div>

          <div className="rounded-[2rem] border border-zinc-200 bg-white p-3 shadow-sm">
            <img
              src={heroImage}
              alt="Semiconductor chip manufacturing process infographic with seven production steps"
              width={1003}
              height={565}
              className="h-auto w-full rounded-[1.5rem] object-contain"
            />
            <p className="px-3 pb-3 pt-4 text-center text-sm text-zinc-500">
              Examples created from process topics, notes, steps, and plain text.
            </p>
          </div>
        </section>

        <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Structured step order
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
                What is a Process Infographic Generator?
              </h2>
            </div>
            <p className="text-base leading-8 text-zinc-600">
              A process infographic generator helps turn steps, workflows, instructions, and explanations into
              structured visual summaries. KnowLens organizes the content into sequence, key points, readable labels,
              and clear sections so a process is easier to understand and share.
            </p>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Create Process Infographics for Clear Step-by-Step Explanation
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              Use KnowLens to turn processes, workflows, and instructions into structured visuals for learning,
              training, explaining, and sharing.
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
              Create a Process Infographic in 3 Steps
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              Start with a process or set of steps. KnowLens helps organize the sequence into a clear visual structure.
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
              Create a Process Infographic
              <ArrowRight size={15} className="ml-2" />
            </Link>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Prompt starters</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
              Processes You Can Turn into Infographics
            </h2>
            <p className="mt-4 text-sm leading-7 text-zinc-600">
              Start with a complete explanation or a rough list of steps. Add sequence, key actions, decisions, and
              examples for better results.
            </p>
            <p className="mt-4 rounded-2xl bg-zinc-50 p-4 text-sm leading-7 text-zinc-600">
              For best results, include the sequence, key actions, decision points, examples, and the audience you want
              to explain the process to.
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
              Built for Workflows, Tutorials, and Step-by-Step Guides
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              Use the process infographic generator when a sequence needs to become clear, visual, and easy to follow.
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
              Process Infographic Examples
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              Explore process infographics and workflow visuals created from steps, notes, and short text prompts.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {horizontalExamples.map((example) => (
              <article
                key={example.title}
                className="overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white shadow-sm"
              >
                <div className="bg-zinc-50 p-3">
                  <img
                    src={example.image}
                    alt={example.alt}
                    width={example.width}
                    height={example.height}
                    className="h-auto w-full rounded-xl object-contain"
                  />
                </div>
                <div className="p-5">
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
            {verticalExamples.map((example) => (
              <article
                key={example.title}
                className="overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white shadow-sm"
              >
                <div className="bg-zinc-50 p-3">
                  <img
                    src={example.image}
                    alt={example.alt}
                    width={example.width}
                    height={example.height}
                    className="h-auto w-full rounded-xl object-contain"
                  />
                </div>
                <div className="p-5">
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
              Designed for Readable Process Infographics
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              KnowLens is built for visual explanation, not generic AI art.
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
              Process Infographic Generator FAQ
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              Practical answers for turning process topics, steps, notes, and plain text into clearer visual summaries.
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
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Create a Clear Process Infographic</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-300">
            Start with a process, notes, or plain text. Generate a structured workflow visual, step-by-step guide, or
            process infographic in minutes.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={generatorHref}
              className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200"
            >
              Create a Process Infographic
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
              Explore more ways to turn ideas, steps, and learning topics into structured infographic-style visuals.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
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
