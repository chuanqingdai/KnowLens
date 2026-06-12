/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CloudSun,
  Compass,
  Droplets,
  GraduationCap,
  Layers3,
  Mountain,
  Orbit,
  Sparkles,
} from "lucide-react";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

const siteOrigin = "https://knowlens.ai";
const pagePath = "/earth-science-infographic-generator";
const pageLink = `${siteOrigin}${pagePath}`;
const generatorHref = "/app?intent=generate";
const heroImage = "/picture/earth-science-infographic-generator.jpg";

export const metadata: Metadata = {
  title: "Earth Science Infographic Generator | Create Earth Science Infographics with AI | KnowLens.ai",
  description:
    "Turn Earth Science topics, notes, and explanations into clear infographics, visual summaries, and educational Earth Science visuals with KnowLens.ai.",
  alternates: {
    canonical: pageLink,
  },
  openGraph: {
    type: "website",
    siteName: "KnowLens.ai",
    title: "Earth Science Infographic Generator | KnowLens.ai",
    description:
      "Create Earth Science infographics from topics, notes, and plain text. Turn Earth systems and natural processes into clear visual summaries with readable labels and structured sections.",
    url: pageLink,
    images: [
      {
        url: `${siteOrigin}${heroImage}`,
        width: 1003,
        height: 565,
        alt: "Inside the Earth educational Earth Science infographic with readable labels",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Earth Science Infographic Generator | KnowLens.ai",
    description:
      "Turn Earth Science topics, notes, and explanations into clear infographics and visual summaries.",
    images: [`${siteOrigin}${heroImage}`],
  },
};

function createSimilarHref(prompt: string) {
  return `${generatorHref}&prompt=${encodeURIComponent(prompt)}`;
}

const visualTypes = [
  {
    title: "Earth Systems Infographics",
    description: "Turn Earth systems, natural cycles, and physical processes into structured visual summaries.",
    icon: Orbit,
  },
  {
    title: "Geology Infographics",
    description:
      "Explain rocks, minerals, landforms, Earth structure, and geological processes with clear sections and labels.",
    icon: Mountain,
  },
  {
    title: "Weather and Climate Visuals",
    description:
      "Create visuals for weather patterns, climate concepts, atmosphere topics, and environmental change.",
    icon: CloudSun,
  },
  {
    title: "Ocean and Water System Infographics",
    description: "Turn ocean, water movement, and Earth water system concepts into readable visual summaries.",
    icon: Droplets,
  },
  {
    title: "Natural Hazard Visuals",
    description: "Explain natural hazards and Earth processes with visual steps, labels, and cause-effect structure.",
    icon: Layers3,
  },
  {
    title: "Earth Science Study Guides",
    description:
      "Create Earth Science visuals that help students review key ideas and understand complex topics faster.",
    icon: BookOpen,
  },
];

const workflowSteps = [
  {
    title: "Add an Earth Science Topic or Text",
    description: "Start with an Earth Science topic, study notes, a short explanation, or plain text.",
  },
  {
    title: "Structure the Concept",
    description:
      "KnowLens organizes the Earth Science idea into sections, key points, labels, and visual hierarchy.",
  },
  {
    title: "Generate the Infographic",
    description:
      "Create an Earth Science infographic, visual summary, poster-style Earth Science visual, or carousel-style Earth Science visual.",
  },
];

const prompts = [
  "Create an Earth Science infographic explaining how a natural cycle works.",
  "Turn these notes about Earth systems into a clear visual summary.",
  "Explain a geological process using simple sections and readable labels.",
  "Create a classroom infographic about weather patterns and atmospheric systems.",
  "Make a visual summary about climate concepts for middle school students.",
  "Explain how ocean and water systems connect with the rest of the Earth system.",
  "Create an infographic about rocks, minerals, and geological change.",
  "Explain a natural hazard with causes, effects, and safety-related concepts.",
  "Create an Earth Science poster that explains landforms and surface processes.",
  "Turn a short Earth Science explanation into a classroom-ready infographic.",
];

const useCases = [
  {
    title: "Students",
    description: "Turn Earth Science notes and concepts into visual study guides.",
    icon: GraduationCap,
  },
  {
    title: "Teachers",
    description: "Create classroom-ready Earth Science visuals from lesson topics and explanations.",
    icon: BookOpen,
  },
  {
    title: "Earth Science Educators",
    description:
      "Explain natural systems and Earth processes with structured labels, sections, and visual summaries.",
    icon: Compass,
  },
  {
    title: "Science Communicators",
    description: "Turn Earth Science topics into shareable educational visuals for blogs and social platforms.",
    icon: Sparkles,
  },
  {
    title: "Tutors",
    description: "Create simple Earth Science visuals that help students understand difficult concepts.",
    icon: Layers3,
  },
  {
    title: "Learning Teams",
    description: "Create quick Earth Science posters and knowledge visuals without a designer.",
    icon: Mountain,
  },
];

const horizontalExamples = [
  {
    title: "Inside the Earth",
    description:
      "A classroom Earth Science infographic that explains Earth layers, plate motion, volcano formation, and magnetic fields.",
    image: heroImage,
    width: 1003,
    height: 565,
    alt: "Inside the Earth Earth Science infographic with crust mantle core and plate motion labels",
    tags: ["Earth Science Infographic", "Earth Systems"],
    prompt: "Create an Earth Science infographic explaining Earth's layers, plate motion, and core structure.",
  },
  {
    title: "Plate Tectonics and Earthquakes",
    description:
      "A geology visual that shows how tectonic plates move, build stress, and connect with earthquake activity.",
    image: "/en-picture/plate-tectonics-earthquake-infographic-case.jpg",
    width: 1200,
    height: 675,
    alt: "Plate tectonics and earthquakes Earth Science visual summary with readable labels",
    tags: ["Geology Visual", "Classroom Visual"],
    prompt: "Explain plate tectonics and earthquakes with simple diagrams, labels, and cause-effect sections.",
  },
  {
    title: "Ocean Circulation Overview",
    description:
      "An ocean system infographic that organizes surface currents, deep currents, temperature flow, and global circulation.",
    image: "/picture/ocean-circulation-infographic-case.jpg",
    width: 1200,
    height: 675,
    alt: "Ocean circulation Earth Science infographic with current and temperature labels",
    tags: ["Ocean System", "Visual Summary"],
    prompt: "Make an Earth Science infographic explaining ocean circulation and global current patterns.",
  },
];

const verticalExamples = [
  {
    title: "Volcano Eruption Structure",
    description:
      "A geology infographic that explains magma chambers, eruption pressure, ash clouds, lava flow, and volcano structure.",
    image: "/en-picture/geography/geography-long-infographic.jpg",
    width: 941,
    height: 1672,
    alt: "Volcano eruption geology infographic with magma chamber ash cloud and lava flow labels",
    tags: ["Geology Visual", "Natural Hazard"],
    prompt: "Create a geology infographic explaining volcano structure, eruption pressure, lava flow, and ash clouds.",
  },
  {
    title: "Tectonic Plate Boundary Guide",
    description:
      "A plate boundary infographic that compares Earth surface motion, landform change, and earthquake-related processes.",
    image: "/en-picture/geography/geography-infographic-card.jpg",
    width: 941,
    height: 1672,
    alt: "Tectonic plate boundary Earth Science infographic with landform and earthquake labels",
    tags: ["Earth Systems", "Geology Visual"],
    prompt: "Create a classroom Earth Science visual comparing tectonic plate boundaries and related landforms.",
  },
];

const whyKnowLens = [
  {
    title: "Readable Labels",
    description:
      "Create Earth Science visuals with clear headings, labels, and short text blocks that are easier to scan.",
  },
  {
    title: "Structured Earth Systems",
    description: "Organize Earth Science topics into systems, processes, cycles, comparisons, or key facts.",
  },
  {
    title: "Clear Visual Hierarchy",
    description: "Emphasize the most important ideas with sections, spacing, titles, and visual grouping.",
  },
  {
    title: "Content-First Visuals",
    description: "Start from an Earth Science explanation or topic instead of a blank canvas.",
  },
  {
    title: "Built for Learning",
    description: "Create visuals for studying, teaching, reviewing, and sharing Earth Science ideas.",
  },
];

const faqs = [
  {
    question: "What is an Earth Science infographic generator?",
    answer:
      "An Earth Science infographic generator turns Earth Science topics, notes, or plain text into structured visual summaries. KnowLens helps organize the content into key points, readable labels, and a clear visual hierarchy.",
  },
  {
    question: "Can I create Earth Science infographics from text?",
    answer:
      "Yes. You can start with an Earth Science topic, notes, or plain text, and KnowLens can help turn it into an Earth Science infographic, visual summary, or poster-style Earth Science visual.",
  },
  {
    question: "What Earth Science topics can I visualize?",
    answer:
      "You can create visuals for Earth systems, geology, weather, climate, oceans, landforms, rocks and minerals, natural processes, and environmental systems.",
  },
  {
    question: "Do I need design skills?",
    answer:
      "No. KnowLens helps organize your Earth Science explanation into a clear visual layout, so you do not need to start from a blank canvas or design template.",
  },
  {
    question: "Can teachers use this for classroom visuals?",
    answer:
      "Yes. Teachers can use KnowLens to create classroom-ready Earth Science infographics, study visuals, posters, and visual summaries from lesson topics or notes.",
  },
  {
    question: "Can students use it for study guides?",
    answer:
      "Yes. Students can turn Earth Science notes and concepts into visual study guides that are easier to review.",
  },
  {
    question: "Is this only for geology?",
    answer:
      "No. KnowLens can help create infographics for geology, weather, climate, oceans, Earth systems, landforms, and other Earth Science topics.",
  },
  {
    question: "How is KnowLens different from a normal infographic maker?",
    answer:
      "A normal infographic maker usually starts with templates. KnowLens starts with your Earth Science topic or text, organizes the message, and turns it into structured visual information.",
  },
  {
    question: "How is KnowLens different from a generic AI image generator?",
    answer:
      "Generic AI image tools often focus on decorative images. KnowLens focuses on structured Earth Science visuals with readable labels, clear sections, and infographic-style layouts.",
  },
  {
    question: "What should I include in my input?",
    answer:
      "For best results, include the Earth Science topic, key facts, important steps, examples, and the audience you want to explain it to.",
  },
];

const relatedTools = [
  {
    title: "Infographic Examples",
    description: "Browse science and education examples before creating your own Earth Science visual.",
    href: "/infographic-examples",
  },
];

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "KnowLens Earth Science Infographic Generator",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  url: pageLink,
  description:
    "KnowLens turns Earth Science topics, notes, and plain text into structured Earth Science infographics, visual summaries, and poster-style Earth Science visuals.",
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
      name: "Earth Science Infographic Generator",
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

export default function EarthScienceInfographicGeneratorPage() {
  return (
    <MarketingChrome>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([softwareJsonLd, breadcrumbJsonLd, faqJsonLd]) }}
      />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-4 py-14 sm:px-6 lg:py-20">
        <section className="flex flex-col items-center text-center">
          <div className="mx-auto max-w-4xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-emerald-700 shadow-sm">
              <Sparkles size={14} />
              EARTH SYSTEM VISUALS
            </div>
            <h1 className="mx-auto max-w-4xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-6xl">
              Earth Science Infographic Generator for Visual Learning
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-zinc-600 sm:text-lg">
              Turn Earth Science topics, notes, or plain text into clear infographics with readable labels,
              structured sections, and visual hierarchy.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href={generatorHref}
                className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-950 px-6 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800"
              >
                Create an Earth Science Infographic
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

          <div className="mt-8 w-full max-w-[760px] overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-sm">
            <img
              src={heroImage}
              alt="Inside the Earth educational Earth Science infographic with readable labels"
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
                Clear visual learning
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
                What is an Earth Science Infographic Generator?
              </h2>
            </div>
            <p className="text-base leading-8 text-zinc-600">
              An Earth Science infographic generator helps turn Earth Science topics, notes, and explanations into
              structured visual summaries. KnowLens organizes the content into key points, readable labels, clear
              sections, and visual hierarchy so Earth systems and natural processes are easier to understand and share.
            </p>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Create Earth Science Infographics for Clear Learning
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              Use KnowLens to turn Earth Science ideas into structured visuals for studying, teaching, explaining, and
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
              Create an Earth Science Infographic in 3 Steps
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              Start with an Earth Science topic or explanation. KnowLens helps organize the idea into a clear visual
              structure.
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
              Create an Earth Science Infographic
              <ArrowRight size={15} className="ml-2" />
            </Link>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Prompt starters</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
              Earth Science Topics You Can Turn into Infographics
            </h2>
            <p className="mt-4 text-sm leading-7 text-zinc-600">
              Start with a complete explanation or a short topic. Add key points, steps, facts, or examples for better
              results.
            </p>
            <p className="mt-4 rounded-2xl bg-zinc-50 p-4 text-sm leading-7 text-zinc-600">
              For best results, include the audience, key facts, steps, examples, and the Earth Science concept you want
              to explain.
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
              Built for Earth Science Learning and Communication
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              Use the Earth Science infographic generator when a complex Earth system or natural process needs to become
              clear, visual, and easy to review.
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
              Earth Science Infographic Examples
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              Explore Earth Science infographics and visual summaries created from topics, notes, and short text
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

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {verticalExamples.map((example) => (
              <article
                key={example.title}
                className="grid overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white shadow-sm md:grid-cols-[0.82fr_1fr]"
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
                <div className="flex flex-col justify-center p-5">
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
              Designed for Readable Earth Science Infographics
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
              Earth Science Infographic Generator FAQ
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              Practical answers for turning Earth Science topics, notes, and plain text into clearer visual summaries.
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
            Create a Clear Earth Science Infographic
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-300">
            Start with an Earth Science topic, notes, or plain text. Generate a structured Earth Science infographic,
            visual summary, or poster-style visual in minutes.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={generatorHref}
              className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200"
            >
              Create an Earth Science Infographic
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
              Continue exploring Earth Science and classroom infographic ideas with KnowLens.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {relatedTools.map((tool) => (
              <Link
                key={tool.title}
                href={tool.href}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200"
              >
                <h3 className="text-base font-semibold text-zinc-950">{tool.title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-600">{tool.description}</p>
                <span className="mt-5 inline-flex items-center text-sm font-semibold text-emerald-700">
                  Browse examples
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
