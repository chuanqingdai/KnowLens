/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Brain,
  FlaskConical,
  GraduationCap,
  Landmark,
  Layers3,
  Map,
  NotebookPen,
  Sparkles,
} from "lucide-react";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

const siteOrigin = "https://knowlens.ai";
const pagePath = "/educational-infographic-maker";
const pageLink = `${siteOrigin}${pagePath}`;
const generatorHref = "/app?intent=generate";
const heroImage = "/picture/educational-infographic-generator.jpg";

export const metadata: Metadata = {
  title: "Educational Infographic Maker | Create Learning Visuals with AI | KnowLens.ai",
  description:
    "Turn educational topics, notes, and lesson text into clear infographics, visual study guides, and classroom-ready visuals with KnowLens.ai.",
  alternates: {
    canonical: pageLink,
  },
  openGraph: {
    type: "website",
    siteName: "KnowLens.ai",
    title: "Educational Infographic Maker | KnowLens.ai",
    description:
      "Create educational infographics from topics, notes, and plain text. Turn study notes and lesson ideas into readable visual summaries and classroom visuals.",
    url: pageLink,
    images: [
      {
        url: `${siteOrigin}${heroImage}`,
        width: 1003,
        height: 565,
        alt: "Electromagnetic induction educational infographic with coil magnet and Faraday law labels",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Educational Infographic Maker | KnowLens.ai",
    description:
      "Turn educational topics, notes, and lesson text into clear infographics and visual study guides.",
    images: [`${siteOrigin}${heroImage}`],
  },
};

function createSimilarHref(prompt: string) {
  return `${generatorHref}&prompt=${encodeURIComponent(prompt)}`;
}

const visualTypes = [
  {
    title: "Classroom Infographics",
    description: "Turn lesson topics and teaching notes into classroom-ready visuals with clear sections and labels.",
    icon: GraduationCap,
  },
  {
    title: "Visual Study Guides",
    description: "Convert study notes and key concepts into visual summaries that are easier to review.",
    icon: NotebookPen,
  },
  {
    title: "Science Learning Visuals",
    description: "Explain science concepts with structured diagrams, labels, and educational layouts.",
    icon: FlaskConical,
  },
  {
    title: "History and Timeline Visuals",
    description: "Turn historical events, timelines, and key facts into clear educational infographics.",
    icon: Landmark,
  },
  {
    title: "Geography Learning Visuals",
    description: "Create visuals for maps, regions, landforms, climate, and location-based learning topics.",
    icon: Map,
  },
  {
    title: "Concept Explanation Cards",
    description: "Break down one idea into key points, examples, and visual sections for quick understanding.",
    icon: Brain,
  },
];

const workflowSteps = [
  {
    title: "Add a Topic or Notes",
    description: "Start with a lesson topic, study notes, a short explanation, or plain text.",
  },
  {
    title: "Structure the Lesson",
    description: "KnowLens organizes the content into sections, key points, labels, and visual hierarchy.",
  },
  {
    title: "Generate the Infographic",
    description:
      "Create an educational infographic, visual study guide, poster-style learning visual, or carousel-style educational visual.",
  },
];

const prompts = [
  "Create an educational infographic explaining photosynthesis for middle school students.",
  "Turn these study notes about the water cycle into a visual study guide.",
  "Create a classroom infographic about the causes and effects of the Industrial Revolution.",
  "Explain the parts of a plant cell with readable labels and short text.",
  "Make a study guide infographic about Newton's laws of motion.",
  "Create a geography learning visual about landforms and examples.",
  "Turn this lesson outline about ecosystems into an educational infographic.",
  "Create a visual summary for a vocabulary lesson with examples.",
  "Make an infographic that explains a historical timeline in clear sections.",
  "Create a classroom-ready visual about the difference between weather and climate.",
];

const useCases = [
  {
    title: "Students",
    description: "Turn study notes and concepts into visual study guides.",
    icon: GraduationCap,
  },
  {
    title: "Teachers",
    description: "Create classroom-ready infographics from lesson topics and explanations.",
    icon: BookOpen,
  },
  {
    title: "Tutors",
    description: "Create simple learning visuals that help students understand difficult concepts.",
    icon: Brain,
  },
  {
    title: "Course Creators",
    description: "Turn lesson ideas and teaching points into visual learning materials.",
    icon: Layers3,
  },
  {
    title: "Content Creators",
    description: "Create educational visuals for blogs, social platforms, and learning content.",
    icon: Sparkles,
  },
  {
    title: "Learning Teams",
    description: "Create quick educational posters and knowledge visuals without a designer.",
    icon: NotebookPen,
  },
];

const horizontalExamples = [
  {
    title: "Electromagnetic Induction Lesson",
    description:
      "A physics classroom visual that explains magnetic flux, induced current, coil movement, and Faraday's law.",
    image: heroImage,
    width: 1003,
    height: 565,
    alt: "Electromagnetic induction classroom infographic with magnet coil galvanometer and process labels",
    tags: ["Science Learning", "Classroom Visual"],
    prompt: "Create an educational infographic explaining electromagnetic induction with a coil, magnet, and step labels.",
  },
  {
    title: "Photosynthesis Study Guide",
    description:
      "A science learning infographic that explains how plants use sunlight, water, and carbon dioxide to make energy.",
    image: "/en-picture/photosynthesis-infographic-case.jpg",
    width: 1672,
    height: 941,
    alt: "Photosynthesis educational infographic created from study notes with readable labels",
    tags: ["Science Learning", "Study Guide"],
    prompt: "Create an educational infographic explaining photosynthesis for middle school students.",
  },
  {
    title: "Printing Press History Lesson",
    description:
      "A history learning visual that explains movable type, faster book production, literacy, and long-term cultural change.",
    image: "/en-picture/printing-press-history-infographic-case.jpg",
    width: 1672,
    height: 941,
    alt: "Printing press history classroom visual with timeline and key invention labels",
    tags: ["History Visual", "Classroom Visual"],
    prompt: "Create a classroom infographic about how the printing press changed communication and learning.",
  },
];

const verticalExamples = [
  {
    title: "DNA Replication Study Guide",
    description:
      "A biology study guide that breaks DNA replication into helicase, unzipping, base pairing, polymerase, and summary steps.",
    image: "/en-picture/biology/biology-long-infographic.jpg",
    width: 941,
    height: 1672,
    alt: "DNA replication visual study guide with step-by-step biology labels",
    tags: ["Science Learning", "Visual Study Guide"],
    prompt: "Turn these biology notes about DNA replication into a step-by-step visual study guide.",
  },
  {
    title: "Printing Press Timeline",
    description:
      "A vertical history infographic that organizes Gutenberg, movable type, literacy growth, reform, and cultural impact.",
    image: "/en-picture/history/history-infographic-card.jpg",
    width: 941,
    height: 1672,
    alt: "Printing press history learning infographic with timeline and classroom labels",
    tags: ["History Visual", "Timeline"],
    prompt: "Make an infographic that explains the printing press and its historical timeline in clear sections.",
  },
  {
    title: "Volcano Structure Lesson",
    description:
      "A geography and geology learning visual that explains magma chambers, ash clouds, lava flow, and eruption structure.",
    image: "/en-picture/geography/geography-long-infographic.jpg",
    width: 941,
    height: 1672,
    alt: "Volcano structure geography learning infographic with readable eruption labels",
    tags: ["Geography Visual", "Science Learning"],
    prompt: "Create a classroom-ready visual about volcano structure, lava flow, ash clouds, and eruption parts.",
  },
];

const whyKnowLens = [
  {
    title: "Readable Labels",
    description:
      "Create educational visuals with clear headings, labels, and short text blocks that are easier to scan.",
  },
  {
    title: "Structured Learning Content",
    description: "Organize educational topics into steps, key facts, comparisons, examples, or review points.",
  },
  {
    title: "Clear Visual Hierarchy",
    description: "Emphasize the most important ideas with sections, spacing, titles, and visual grouping.",
  },
  {
    title: "Content-First Visuals",
    description: "Start from a lesson idea, notes, or explanation instead of a blank canvas.",
  },
  {
    title: "Built for Review and Teaching",
    description: "Create visuals for studying, teaching, reviewing, and sharing learning ideas.",
  },
];

const faqs = [
  {
    question: "What is an educational infographic maker?",
    answer:
      "An educational infographic maker turns learning topics, notes, or plain text into structured visual summaries. KnowLens helps organize the content into key points, readable labels, and a clear visual hierarchy.",
  },
  {
    question: "Can I create educational infographics from notes?",
    answer:
      "Yes. You can start with study notes, lesson notes, a topic, or plain text, and KnowLens can help turn it into an educational infographic, visual study guide, or poster-style learning visual.",
  },
  {
    question: "What educational topics can I visualize?",
    answer:
      "You can create visuals for science, history, geography, language learning, study skills, classroom concepts, step-by-step lessons, and general knowledge topics.",
  },
  {
    question: "Do I need design skills?",
    answer:
      "No. KnowLens helps organize your educational content into a clear visual layout, so you do not need to start from a blank canvas or design template.",
  },
  {
    question: "Can teachers use this for classroom visuals?",
    answer:
      "Yes. Teachers can use KnowLens to create classroom-ready infographics, lesson visuals, study guides, and educational posters from topics or notes.",
  },
  {
    question: "Can students use it for study guides?",
    answer:
      "Yes. Students can turn study notes and learning concepts into visual study guides that are easier to review.",
  },
  {
    question: "Is this only for science education?",
    answer:
      "No. KnowLens can help create educational infographics for science, history, geography, language learning, study skills, and general knowledge topics.",
  },
  {
    question: "How is KnowLens different from a normal infographic maker?",
    answer:
      "A normal infographic maker usually starts with templates. KnowLens starts with your educational topic or text, organizes the message, and turns it into structured visual information.",
  },
  {
    question: "How is KnowLens different from a generic AI image generator?",
    answer:
      "Generic AI image tools often focus on decorative images. KnowLens focuses on structured educational visuals with readable labels, clear sections, and infographic-style layouts.",
  },
  {
    question: "What should I include in my input?",
    answer:
      "For best results, include the learning topic, key facts, important steps, examples, audience, and the message you want students or readers to understand.",
  },
];

const relatedTools = [
  {
    title: "Earth Science Infographic Generator",
    description: "Create structured Earth Science visuals for natural systems, geology, weather, and classroom topics.",
    href: "/earth-science-infographic-generator",
  },
  {
    title: "Infographic Examples",
    description: "Browse example educational visuals and infographic ideas before creating your own.",
    href: "/infographic-examples",
  },
];

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "KnowLens Educational Infographic Maker",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  url: pageLink,
  description:
    "KnowLens turns educational topics, notes, and plain text into structured educational infographics, visual study guides, and poster-style learning visuals.",
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
      name: "Educational Infographic Maker",
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

export default function EducationalInfographicMakerPage() {
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
              LEARNING MADE VISUAL
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-6xl">
              Educational Infographic Maker for Classroom Visuals
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-600 sm:text-lg">
              Turn educational topics, notes, or plain text into clear infographics, visual study guides, and
              classroom-ready visuals with readable labels and structured sections.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={generatorHref}
                className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-950 px-6 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800"
              >
                Create an Educational Infographic
                <ArrowRight size={16} className="ml-2" />
              </Link>
              <Link
                href="#examples"
                className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-300 bg-white px-6 text-sm font-medium text-zinc-900 shadow-sm transition hover:bg-zinc-100"
              >
                View Examples
              </Link>
            </div>
            <p className="mt-4 text-sm text-zinc-500">Start with notes or a topic. KnowLens structures the visual.</p>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-sm">
            <img
              src={heroImage}
              alt="Electromagnetic induction educational infographic with coil, magnet, current, and Faraday's law"
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
                Structured visual learning
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
                What is an Educational Infographic Maker?
              </h2>
            </div>
            <p className="text-base leading-8 text-zinc-600">
              An educational infographic maker helps turn learning topics, study notes, and lesson explanations into
              structured visual summaries. KnowLens organizes the content into key points, readable labels, clear
              sections, and visual hierarchy so the topic is easier to understand, teach, and review.
            </p>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Create Educational Infographics for Clear Learning
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              Use KnowLens to turn educational ideas into structured visuals for studying, teaching, explaining, and
              sharing.
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
              Create an Educational Infographic in 3 Steps
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              Start with a learning topic or notes. KnowLens helps organize the idea into a clear visual structure.
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
              Create an Educational Infographic
              <ArrowRight size={15} className="ml-2" />
            </Link>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Prompt starters</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
              Educational Topics You Can Turn into Infographics
            </h2>
            <p className="mt-4 text-sm leading-7 text-zinc-600">
              Start with a complete explanation or a short topic. Add key points, steps, examples, and the target
              audience for better results.
            </p>
            <p className="mt-4 rounded-2xl bg-zinc-50 p-4 text-sm leading-7 text-zinc-600">
              For best results, include the audience, key facts, steps, examples, and the learning goal you want to
              explain.
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
              Built for Teaching, Studying, and Explaining
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              Use the educational infographic maker when a learning topic needs to become clear, visual, and easy to
              review.
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
              Educational Infographic Examples
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              Explore educational infographics and visual study guides created from topics, notes, and short text
              prompts.
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
              Designed for Readable Educational Infographics
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
              Educational Infographic Maker FAQ
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              Practical answers for turning learning topics, notes, and plain text into clearer visual summaries.
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
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Create a Clear Educational Infographic
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-300">
            Start with an educational topic, notes, or plain text. Generate a structured infographic, visual study guide,
            or poster-style learning visual in minutes.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={generatorHref}
              className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200"
            >
              Create an Educational Infographic
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
              Explore more ways to turn learning ideas into structured infographic-style visuals.
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
