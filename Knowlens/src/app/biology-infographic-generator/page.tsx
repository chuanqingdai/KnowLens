import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Dna,
  Leaf,
  Microscope,
  Network,
  UserRound,
} from "lucide-react";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

const siteUrl = "https://knowlens.ai";
const pageUrl = `${siteUrl}/biology-infographic-generator`;

export const metadata: Metadata = {
  title: {
    absolute: "Biology Infographic Generator | Create Biology Infographics with AI | KnowLens.ai",
  },
  description:
    "Turn biology topics, notes, and explanations into clear biology infographics, visual summaries, and educational biology visuals with KnowLens.ai.",
  keywords: [
    "biology infographic generator",
    "biology infographic",
    "AI biology infographic generator",
    "biology infographic maker",
    "educational biology infographic",
    "biology visual summary",
    "cell infographic",
    "photosynthesis infographic",
    "DNA infographic",
    "ecosystem infographic",
    "human body infographic",
    "life science infographic",
  ],
  alternates: { canonical: pageUrl },
  openGraph: {
    type: "website",
    url: pageUrl,
    siteName: "KnowLens.ai",
    title: "Biology Infographic Generator | KnowLens.ai",
    description:
      "Create biology infographics from topics, notes, and plain text. Turn life science ideas into clear visual summaries with readable labels and structured sections.",
    images: [
      {
        url: `${siteUrl}/picture/biology-infographic.jpg`,
        width: 1003,
        height: 565,
        alt: "Blood vessel network biology infographic created from notes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Biology Infographic Generator | Create Biology Infographics with AI | KnowLens.ai",
    description:
      "Turn biology topics, notes, and explanations into clear biology infographics and educational biology visuals.",
    images: [`${siteUrl}/picture/biology-infographic.jpg`],
  },
};

const heroPreview = {
  featured: {
    title: "Blood Vessel Network",
    tag: "Human Body Basics",
    image: "/picture/biology-infographic.jpg",
    alt: "Blood vessel network biology infographic with readable labels",
    width: 1003,
    height: 565,
  },
  side: [
    {
      title: "DNA Replication",
      tag: "DNA Visual",
      image: "/en-picture/biology/biology-long-infographic.jpg",
      alt: "DNA replication biology infographic with labeled steps",
      width: 941,
      height: 1672,
    },
    {
      title: "Seed Germination",
      tag: "Plant Life Cycle",
      image: "/en-picture/photosynthesis-infographic-case.jpg",
      alt: "Seed germination biology infographic showing growth stages",
      width: 1672,
      height: 941,
    },
  ],
} as const;

const biologyVisuals = [
  [
    "Cell Biology Infographics",
    "Turn cell structure, organelles, membranes, and cell processes into visual summaries.",
    Microscope,
  ],
  [
    "Plant Biology Infographics",
    "Explain plant systems, photosynthesis, seed germination, and plant life cycles with clear sections and labels.",
    Leaf,
  ],
  [
    "Genetics and DNA Visuals",
    "Create visuals for DNA, genes, inheritance basics, and biological processes in a simple infographic format.",
    Dna,
  ],
  [
    "Ecosystem Infographics",
    "Show food chains, energy flow, habitats, and ecosystems through clear visual structures.",
    Network,
  ],
  [
    "Human Body Basics",
    "Turn introductory anatomy and body-system concepts into readable biology visuals.",
    UserRound,
  ],
  [
    "Biology Study Guides",
    "Create biology visuals that help students review key ideas and understand complex topics faster.",
    BookOpen,
  ],
] as const;

const steps = [
  ["Add a Biology Topic or Text", "Start with a biology topic, study notes, a short explanation, or plain text."],
  [
    "Structure the Concept",
    "KnowLens organizes the biology idea into sections, key points, labels, and visual hierarchy.",
  ],
  [
    "Generate the Infographic",
    "Create a biology infographic, visual summary, poster-style biology visual, or carousel-style biology visual.",
  ],
] as const;

const promptExamples = [
  "Explain photosynthesis in 5 key steps for middle school students.",
  "Create a biology infographic about the structure of a plant cell with clear labels.",
  "Turn these notes about DNA replication into a visual summary.",
  "Explain seed germination using simple steps and labeled visuals.",
  "Create an infographic about food chains and energy flow in an ecosystem.",
  "Explain the main parts of the human digestive system in a simple biology poster.",
  "Create a visual summary of how cells divide.",
  "Make a biology infographic about the life cycle of a butterfly.",
  "Explain the differences between plant cells and animal cells.",
  "Create a classroom infographic about ecosystems, habitats, and biodiversity.",
] as const;

const useCases = [
  ["Students", "Turn biology notes and concepts into visual study guides.", "Study guides"],
  ["Teachers", "Create classroom-ready biology visuals from lesson topics and explanations.", "Classroom visuals"],
  [
    "Biology Educators",
    "Explain complex life science ideas with structured labels, sections, and visual summaries.",
    "Biology education",
  ],
  [
    "Content Creators",
    "Turn biology topics into shareable educational visuals for blogs and social platforms.",
    "Educational content",
  ],
  ["Tutors", "Create simple biology visuals that help students understand difficult concepts.", "Tutoring aids"],
  ["Learning Teams", "Create quick biology posters and knowledge visuals without a designer.", "Learning materials"],
] as const;

const examples = [
  {
    title: "Photosynthesis Process",
    description:
      "A plant biology infographic showing sunlight, water, carbon dioxide, glucose, oxygen, and the photosynthesis equation.",
    tags: ["Plant Biology", "Biology Infographic"],
    image: "/en-picture/biology/biology-infographic-card.jpg",
    alt: "Photosynthesis educational biology infographic created with KnowLens",
    width: 941,
    height: 1672,
    topic:
      "Create a biology infographic explaining photosynthesis. Include sunlight, water, carbon dioxide, chlorophyll, glucose, oxygen, the photosynthesis equation, and the key steps students should remember.",
  },
  {
    title: "DNA Replication Poster",
    description:
      "A genetics visual explaining helicase, unzipping, base pairing, polymerase, and two identical DNA molecules.",
    tags: ["Genetics Visual", "Educational Visual"],
    image: "/en-picture/biology/biology-long-infographic.jpg",
    alt: "DNA replication biology visual summary with readable labels",
    width: 941,
    height: 1672,
    topic:
      "Turn DNA replication into a clear biology infographic. Include helicase, unzipping, template strands, base pairing rules, DNA polymerase, semiconservative replication, and the final result.",
  },
  {
    title: "Mitosis Cell Division",
    description:
      "A cell biology infographic showing prophase, metaphase, anaphase, telophase, and cytokinesis.",
    tags: ["Cell Biology", "Educational Visual"],
    image: "/en-picture/biology/d64c1b7c-e35d-4ff9-8753-03a3df83eded.png",
    alt: "Mitosis biology infographic showing how one cell divides into two cells",
    width: 941,
    height: 1672,
    topic:
      "Create a biology infographic explaining mitosis. Include prophase, metaphase, anaphase, telophase, cytokinesis, chromosomes, spindle fibers, and the result of two genetically similar daughter cells.",
  },
  {
    title: "Ocean Food Chain",
    description:
      "An ecosystem infographic showing plankton, small fish, large fish, sharks, and energy loss across food-chain levels.",
    tags: ["Ecosystem Infographic", "Biology Infographic"],
    image: "/en-picture/biology/09222a94-ab66-4ba1-8b95-f28ac121f083.png",
    alt: "Ocean food chain biology infographic showing energy flow through ecosystem levels",
    width: 941,
    height: 1672,
    topic:
      "Create a biology infographic about an ocean food chain. Include plankton, small fish, large fish, sharks, energy flow, energy loss, ecosystem balance, and why each level matters.",
  },
] as const;

const portraitExamples = examples.filter((item) => item.height > item.width);
const landscapeExamples = examples.filter((item) => item.width > item.height);

const whyPoints = [
  [
    "Readable Labels",
    "Create biology visuals with clear headings, labels, and short text blocks that are easier to scan.",
  ],
  [
    "Structured Concepts",
    "Organize biology topics into systems, steps, comparisons, life cycles, or key facts.",
  ],
  [
    "Clear Visual Hierarchy",
    "Emphasize the most important ideas with sections, spacing, titles, and visual grouping.",
  ],
  ["Content-First Visuals", "Start from a biology explanation or topic instead of a blank canvas."],
  ["Built for Learning", "Create visuals for studying, teaching, reviewing, and sharing biology ideas."],
] as const;

const faqItems = [
  [
    "What is a biology infographic generator?",
    "A biology infographic generator turns biology topics, notes, or plain text into structured visual summaries. KnowLens helps organize the content into key points, readable labels, and a clear visual hierarchy.",
  ],
  [
    "Can I create biology infographics from text?",
    "Yes. You can start with a biology topic, notes, or plain text, and KnowLens can help turn it into a biology infographic, visual summary, or poster-style biology visual.",
  ],
  [
    "What biology topics can I visualize?",
    "You can create visuals for cells, plants, DNA, genetics basics, ecosystems, food chains, life cycles, and introductory human body concepts.",
  ],
  [
    "Do I need design skills?",
    "No. KnowLens helps organize your biology explanation into a clear visual layout, so you do not need to start from a blank canvas or design template.",
  ],
  [
    "Can teachers use this for classroom visuals?",
    "Yes. Teachers can use KnowLens to create classroom-ready biology infographics, study visuals, biology posters, and visual summaries from lesson topics or notes.",
  ],
  [
    "Can students use it for study guides?",
    "Yes. Students can turn biology notes and concepts into visual study guides that are easier to review.",
  ],
  [
    "Is this only for one biology topic?",
    "No. KnowLens can help create infographics for plant biology, cell biology, genetics basics, ecosystems, life cycles, and other biology topics.",
  ],
  [
    "How is KnowLens different from a normal infographic maker?",
    "A normal infographic maker usually starts with templates. KnowLens starts with your biology topic or text, organizes the message, and turns it into structured visual information.",
  ],
  [
    "How is KnowLens different from a generic AI image generator?",
    "Generic AI image tools often focus on decorative images. KnowLens focuses on structured biology visuals with readable labels, clear sections, and infographic-style layouts.",
  ],
  [
    "What should I include in my input?",
    "For best results, include the biology topic, key facts, important steps, examples, and the audience you want to explain it to.",
  ],
] as const;

const relatedLinks = [
  ["AI Infographic Generator", "/ai-infographic-generator"],
  ["Science Infographic Generator", "/science-infographic-generator"],
  ["Infographic Maker", "/infographic-maker"],
  ["Text to Infographic", "/text-to-infographic"],
  ["Infographic Examples", "/infographic-examples"],
] as const;

const appSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "KnowLens Biology Infographic Generator",
  url: pageUrl,
  applicationCategory: "DesignApplication",
  operatingSystem: "Web",
  description:
    "KnowLens turns biology topics, notes, and plain text into structured biology infographics, visual summaries, and poster-style biology visuals.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
    { "@type": "ListItem", position: 2, name: "Biology Infographic Generator", item: pageUrl },
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

function promptHref(topic: string) {
  return `/app?intent=generate&prompt=${encodeURIComponent(topic)}`;
}

export default function BiologyInfographicGeneratorPage() {
  return (
    <MarketingChrome>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-12 pt-10 sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1fr)] lg:items-center lg:pt-16">
        <div className="text-center lg:text-left">
          <p className="inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 shadow-sm">
            Biology Infographic Generator
          </p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl lg:text-[4rem] lg:leading-[1.05]">
            Biology Infographic Generator
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-zinc-600 lg:mx-0">
            Turn biology topics, notes, or plain text into clear biology infographics with readable labels,
            structured sections, and visual hierarchy.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <Link
              href="/app?intent=generate"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-zinc-950 px-6 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(15,23,42,0.18)] transition hover:bg-zinc-800"
            >
              Create a Biology Infographic
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link
              href="#examples"
              className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-300 bg-white px-6 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
            >
              View Examples
            </Link>
          </div>
          <div className="mt-5 flex flex-col items-center gap-2 text-sm text-zinc-600 sm:flex-row sm:justify-center lg:justify-start">
            <span className="inline-flex items-center gap-2">
              <BadgeCheck size={16} className="text-emerald-600" aria-hidden="true" />
              No design skills needed.
            </span>
            <span>Start with a biology topic, notes, or a short explanation.</span>
          </div>
          <p className="mt-3 text-sm text-zinc-500">
            Built for classroom visuals, study guides, biology education, and visual learning.
          </p>
        </div>

        <div className="mx-auto grid w-full max-w-[640px] gap-3 sm:grid-cols-[0.72fr_1fr] lg:mx-0">
          <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm">
            <img
              src={heroPreview.featured.image}
              alt={heroPreview.featured.alt}
              width={heroPreview.featured.width}
              height={heroPreview.featured.height}
              className={`${heroPreview.featured.height > heroPreview.featured.width ? "aspect-[9/16]" : "aspect-[16/9]"} w-full rounded-xl bg-zinc-50 object-contain`}
              loading="eager"
            />
            <div className="flex items-center justify-between gap-2 px-2 py-2">
              <p className="truncate text-sm font-semibold text-zinc-950">{heroPreview.featured.title}</p>
              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                {heroPreview.featured.tag}
              </span>
            </div>
          </article>
          <div className="grid gap-3">
            {heroPreview.side.map((item) => (
              <article key={item.title} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm">
                <img
                  src={item.image}
                  alt={item.alt}
                  width={item.width}
                  height={item.height}
                  className={`${item.height > item.width ? "aspect-[9/16]" : "aspect-[16/9]"} w-full rounded-xl bg-zinc-50 object-contain`}
                  loading="eager"
                />
                <div className="flex items-center justify-between gap-2 px-2 py-2">
                  <p className="truncate text-sm font-semibold text-zinc-950">{item.title}</p>
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-semibold text-zinc-600">
                    {item.tag}
                  </span>
                </div>
              </article>
            ))}
          </div>
          <p className="text-center text-sm text-zinc-500 sm:col-span-2">
            Examples created from biology topics, notes, and plain text.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">
            What is a Biology Infographic Generator?
          </h2>
          <p className="mt-3 text-sm leading-7 text-zinc-600 sm:text-base">
            A biology infographic generator helps turn biology topics, notes, and explanations into structured visual
            summaries. KnowLens organizes the content into key points, readable labels, clear sections, and visual
            hierarchy so the topic is easier to understand and share.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading
          title="Create Biology Infographics for Clear Learning"
          description="Use KnowLens to turn biology ideas into structured visuals for studying, teaching, explaining, and sharing."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {biologyVisuals.map(([title, description, Icon]) => (
            <article key={title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                <Icon size={22} aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-zinc-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading
          eyebrow="HOW IT WORKS"
          title="Create a Biology Infographic in 3 Steps"
          description="Start with a biology topic or explanation. KnowLens helps organize the idea into a clear visual structure."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map(([title, description], index) => (
            <article key={title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white">
                {index + 1}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-zinc-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
            </article>
          ))}
        </div>
        <div className="mt-7 text-center">
          <Link
            href="/app?intent=generate"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Create a Biology Infographic
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading
          title="Biology Topics You Can Turn into Infographics"
          description="Start with a complete explanation or a short topic. Add key points, steps, facts, or examples for better results."
        />
        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {promptExamples.map((prompt, index) => (
            <Link
              key={prompt}
              href={promptHref(prompt)}
              className="group rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
            >
              <span className="text-xs font-semibold text-emerald-700">Prompt {index + 1}</span>
              <p className="mt-2 text-sm leading-6 text-zinc-700">{prompt}</p>
            </Link>
          ))}
        </div>
        <p className="mx-auto mt-5 max-w-3xl text-center text-sm leading-6 text-zinc-600">
          For best results, include the audience, key facts, steps, and examples you want to show in the infographic.
        </p>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading
          title="Built for Biology Learning and Communication"
          description="Use the biology infographic generator when a complex biology idea needs to become clear, visual, and easy to review."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {useCases.map(([title, description, tag]) => (
            <article key={title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-zinc-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
              <p className="mt-4 text-xs font-semibold text-emerald-700">{tag}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="examples" className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading
          title="Biology Infographic Examples"
          description="Explore biology infographics and visual summaries created from topics, notes, and short text prompts."
        />
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {portraitExamples.map((item) => (
            <ExampleCard key={item.title} item={item} />
          ))}
        </div>
        {landscapeExamples.length > 0 ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {landscapeExamples.map((item) => (
              <ExampleCard key={item.title} item={item} />
            ))}
          </div>
        ) : null}
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading
          title="Designed for Readable Biology Infographics"
          description="KnowLens is built for visual explanation, not generic AI art."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {whyPoints.map(([title, description]) => (
            <article key={title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-zinc-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
        <SectionHeading title="FAQ" description="Common questions about creating biology infographics with KnowLens." />
        <div className="mt-8 divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white">
          {faqItems.map(([question, answer]) => (
            <details key={question} className="group p-5">
              <summary className="cursor-pointer list-none text-base font-semibold text-zinc-950">{question}</summary>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading
          title="Related Infographic Tools"
          description="Explore nearby KnowLens tools for turning text and topics into structured visuals."
        />
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {relatedLinks.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="inline-flex h-10 items-center rounded-full border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950"
            >
              {label}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <div className="rounded-[2rem] bg-zinc-950 px-6 py-12 text-center text-white sm:px-10">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">Create a Clear Biology Infographic</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-300">
            Start with a biology topic, notes, or plain text. Generate a structured biology infographic, visual summary,
            or poster-style visual in minutes.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/app?intent=generate"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-zinc-950 hover:bg-zinc-100"
            >
              Create a Biology Infographic
              <ArrowRight size={16} />
            </Link>
            <Link
              href="#examples"
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-6 text-sm font-semibold text-white hover:bg-white/10"
            >
              View Examples
            </Link>
          </div>
        </div>
      </section>
    </MarketingChrome>
  );
}

function ExampleCard({ item }: { item: (typeof examples)[number] }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="bg-zinc-50 p-3">
        <img
          src={item.image}
          alt={item.alt}
          width={item.width}
          height={item.height}
          className="mx-auto h-auto w-full rounded-xl object-contain"
          loading="lazy"
        />
      </div>
      <div className="p-4">
        <div className="flex flex-wrap gap-2">
          {item.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-600">
              {tag}
            </span>
          ))}
        </div>
        <h3 className="mt-3 text-lg font-semibold text-zinc-950">{item.title}</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-600">{item.description}</p>
        <Link
          href={promptHref(item.topic)}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-950 hover:text-emerald-700"
        >
          Create Similar
          <ArrowRight size={14} />
        </Link>
      </div>
    </article>
  );
}
