import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, BookOpen, FlaskConical, Layers3, PanelTop, Sparkles } from "lucide-react";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

const siteUrl = "https://knowlens.ai";
const pageUrl = `${siteUrl}/text-to-infographic`;

export const metadata: Metadata = {
  title: { absolute: "Text to Infographic Generator | Create Infographics from Text | KnowLens.ai" },
  description:
    "Turn plain text, notes, topics, or outlines into clear infographics, visual summaries, posters, and carousel-style visuals with KnowLens.ai.",
  keywords: [
    "text to infographic",
    "text to infographic generator",
    "convert text to infographic",
    "turn text into infographic",
    "AI infographic generator",
    "infographic maker",
    "infographic generator",
    "text to visual summary",
    "notes to infographic",
    "topic to infographic",
    "visual summary generator",
    "educational infographic",
    "science infographic",
  ],
  alternates: { canonical: pageUrl },
  openGraph: {
    type: "website",
    url: pageUrl,
    siteName: "KnowLens.ai",
    title: "Text to Infographic Generator | KnowLens.ai",
    description:
      "Create infographics from text, notes, topics, or outlines. Turn plain text into visual summaries, posters, and infographic-style visuals.",
    images: [
      {
        url: `${siteUrl}/en-picture/photosynthesis-infographic-case.jpg`,
        width: 1003,
        height: 565,
        alt: "Photosynthesis infographic created from text notes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Text to Infographic Generator | Create Infographics from Text | KnowLens.ai",
    description:
      "Turn plain text, notes, topics, or outlines into infographics, visual summaries, posters, and carousel-style visuals.",
    images: [`${siteUrl}/en-picture/photosynthesis-infographic-case.jpg`],
  },
};

const heroImages = [
  { src: "/picture/ai-information-generator.jpg?v=20260612-nvidia", alt: "NVIDIA earnings infographic generated from text notes", width: 878, height: 878 },
];

const createCards = [
  ["Educational Infographics", "Turn lesson topics, study notes, and short explanations into classroom-ready visuals.", BookOpen],
  ["Science Infographics", "Explain science concepts with clear sections, labels, and visual structure.", FlaskConical],
  ["Visual Summaries", "Turn rough notes or plain text into a structured visual summary.", Sparkles],
  ["Poster-Style Visuals", "Create poster-style graphics for learning, presentations, and social media.", PanelTop],
  ["Carousel-Style Visuals", "Break one idea into clear visual sections for sharing.", Layers3],
  ["Knowledge Cards", "Turn short ideas into simple knowledge visuals that are easy to understand.", BadgeCheck],
] as const;

const steps = [
  ["Add Your Text", "Start with plain text, notes, a topic, a short explanation, or a rough outline."],
  ["Structure the Message", "KnowLens organizes your content into sections, key points, and a visual hierarchy."],
  ["Generate the Infographic", "Create an infographic, visual summary, poster-style graphic, or carousel-style visual."],
] as const;

const audiences = [
  ["Students", "Turn study notes and concepts into visual study guides."],
  ["Teachers", "Create educational infographics from lesson topics and outlines."],
  ["Science Communicators", "Explain complex topics with clear visual summaries."],
  ["Content Creators", "Turn ideas and explanations into shareable visual content."],
  ["Small Teams", "Create quick knowledge visuals without a designer."],
  ["Marketers", "Turn product ideas and campaign messages into simple visual summaries."],
] as const;

const examples = [
  {
    title: "Seed Germination Steps",
    description: "A 16:9 learning visual that explains how a seed absorbs water, grows roots, and sends up its first leaves.",
    tags: ["Plant Science", "Learning Visual"],
    image: "/en-picture/photosynthesis-infographic-case.jpg",
    alt: "Seed germination infographic created from text notes",
    prompt:
      "Explain seed germination as a clear infographic. Include the dry seed stage, water absorption, swelling, root growth, shoot growth, first leaves, and why water, warmth, air, and stored nutrients help a new plant begin life.",
    ratio: "landscape",
  },
  {
    title: "How Vaccines Train Immunity",
    description: "A 16:9 health science visual that turns immune response steps into a simple sequence.",
    tags: ["Health Science", "Process Visual"],
    image: "/en-picture/printing-press-history-infographic-case.jpg",
    alt: "Vaccine immune system infographic created from a short topic",
    prompt:
      "Explain how vaccines train the immune system as a clear infographic. Include vaccine exposure, antigen recognition, antibody production, immune memory, memory B cells, memory T cells, and faster protection during future exposure.",
    ratio: "landscape",
  },
  {
    title: "How an Electric Vehicle Works",
    description: "A 16:9 technical infographic that labels charging, the battery pack, inverter, motor, and regenerative braking.",
    tags: ["Technology", "System Diagram"],
    image: "/en-picture/inflation-daily-life-infographic-case.jpg",
    alt: "Electric vehicle system infographic created from text",
    prompt:
      "Explain how an electric vehicle works as a clean infographic. Include charging, the battery pack, inverter, electric motor, wheel power, and regenerative braking that sends energy back to the battery.",
    ratio: "landscape",
  },
  {
    title: "How Solar Storms Create Auroras",
    description: "A vertical science infographic that follows charged particles from the Sun to glowing auroras.",
    tags: ["Space Science", "Visual Summary"],
    image: "/en-picture/astronomy/astronomy-long-infographic.jpg",
    alt: "Solar storm infographic created from a short topic",
    prompt:
      "Explain how solar storms create auroras as a clear vertical infographic. Include solar flares, charged particles, Earth's magnetic field, polar regions, atmospheric collisions, and why auroras glow green, red, or purple.",
    ratio: "portrait",
  },
  {
    title: "DNA Replication Step by Step",
    description: "A vertical biology infographic that explains helicase, base pairing, polymerase, and matching DNA copies.",
    tags: ["Biology", "Step-by-Step"],
    image: "/en-picture/biology/biology-long-infographic.jpg",
    alt: "DNA replication infographic created from text",
    prompt:
      "Explain DNA replication step by step as a clear infographic. Include helicase unzipping the double helix, template strands, free nucleotide base pairing, DNA polymerase building new strands, and two identical DNA molecules.",
    ratio: "portrait",
  },
  {
    title: "Why Volcanoes Erupt",
    description: "A vertical earth science visual that explains magma, pressure, vents, ash clouds, and lava flow.",
    tags: ["Earth Science", "Cycle Diagram"],
    image: "/en-picture/geography/geography-long-infographic.jpg",
    alt: "Volcano eruption infographic created from plain text",
    prompt:
      "Explain why volcanoes erupt as a clear earth science infographic. Include magma formation, gas pressure, the magma chamber, the vent, lava flow, ash clouds, and how eruptions reshape the land.",
    ratio: "portrait",
  },
];

const landscapeExamples = examples.filter((item) => item.ratio === "landscape");
const portraitExamples = examples.filter((item) => item.ratio === "portrait");

const whyItems = [
  ["Starts from Your Text", "Begin with plain text, notes, a topic, or an outline instead of a blank canvas."],
  ["Structures the Idea", "KnowLens organizes your message into sections, key points, and visual hierarchy."],
  ["Creates Clear Visuals", "Generate infographic-style visuals, poster-style graphics, and visual summaries for different uses."],
  ["No Design Skills Needed", "You provide the idea. KnowLens helps create a clear visual layout."],
] as const;

const faqItems = [
  ["What is a text to infographic generator?", "A text to infographic generator turns plain text, notes, topics, or outlines into infographic-style visuals. KnowLens helps structure your message into sections and key points before creating the visual."],
  ["Can I turn text into an infographic with KnowLens?", "Yes. You can start with plain text, notes, a topic, or a short explanation and generate an infographic, visual summary, poster-style graphic, or carousel-style visual."],
  ["What can I use as input?", "You can use plain text, notes, a short explanation, a topic, or a rough outline."],
  ["Do I need design experience?", "No. KnowLens helps organize your text and turn it into a clear visual layout."],
  ["Can I create educational infographics?", "Yes. KnowLens can help create educational infographics, science visuals, visual study guides, and classroom-ready summaries."],
  ["Can I create social media visuals?", "Yes. You can create poster-style visuals and carousel-style graphics for social platforms, blogs, and presentations."],
  ["How is this different from a normal infographic maker?", "A normal infographic maker usually starts with templates. KnowLens starts with your text, organizes the message, and turns it into structured visual information."],
  ["Is this only for science topics?", "No. You can use it for education, science, product ideas, recipes, study notes, business concepts, and general knowledge topics."],
] as const;

const appSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "KnowLens Text to Infographic Generator",
  url: pageUrl,
  applicationCategory: "DesignApplication",
  operatingSystem: "Web",
  description:
    "KnowLens turns plain text, notes, topics, and outlines into infographics, visual summaries, posters, and carousel-style visuals.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
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

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
    { "@type": "ListItem", position: 2, name: "Text to Infographic", item: pageUrl },
  ],
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

export default function TextToInfographicPage() {
  return (
    <MarketingChrome>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-12 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)] lg:items-center lg:pt-16">
        <div className="text-center lg:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm">
            <Sparkles size={14} className="text-blue-600" aria-hidden="true" />
            Text to Infographic
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl lg:text-[4rem] lg:leading-[1.05]">
            Text to Infographic Generator
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-zinc-600 lg:mx-0">
            Turn plain text, notes, topics, or outlines into clear infographics, visual summaries, posters, and carousel-style visuals in minutes.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <Link href="/app?intent=generate" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-zinc-950 px-6 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(15,23,42,0.18)] transition hover:bg-zinc-800">
              Create an Infographic
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="#examples" className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-300 bg-white px-6 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50">
              View Examples
            </Link>
          </div>
          <div className="mt-5 inline-flex items-center gap-2 text-sm text-zinc-600">
            <BadgeCheck size={16} className="text-emerald-600" aria-hidden="true" />
            No design skills needed. Start with text, notes, or a short explanation.
          </div>
          <p className="mt-2 text-sm text-zinc-500">Built for learning, science explainers, social posts, and clear visual communication.</p>
        </div>

        <div>
          <img src={heroImages[0].src} alt={heroImages[0].alt} width={heroImages[0].width} height={heroImages[0].height} className="aspect-square w-full rounded-[1.5rem] object-cover shadow-[0_24px_60px_rgba(15,23,42,0.10)]" loading="eager" />
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">What is Text to Infographic?</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-600 sm:text-base">
            Text to infographic means turning plain text, notes, topics, or outlines into a visual layout that explains the idea clearly. KnowLens helps organize the message into sections, key points, and visual structure before creating an infographic-style visual.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading title="Create Infographics from Plain Text" description="Use KnowLens to turn simple text into structured visual content for learning, explaining, and sharing." />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {createCards.map(([title, description, Icon]) => (
            <article key={title} className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-[96px_minmax(0,1fr)]">
              <div className="flex h-20 w-full items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                <Icon size={24} aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading eyebrow="HOW IT WORKS" title="Turn Text into an Infographic in 3 Steps" description="Start with text. KnowLens helps organize the message and generate a clear infographic-style visual." />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map(([title, description], index) => (
            <article key={title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white">{index + 1}</span>
              <h3 className="mt-4 text-lg font-semibold text-zinc-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
            </article>
          ))}
        </div>
        <div className="mt-7 text-center">
          <Link href="/app?intent=generate" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white hover:bg-zinc-800">
            Create an Infographic
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading title="Built for Learning, Explaining, and Sharing" description="Create infographic-style visuals from text for education, science communication, social media, and quick knowledge sharing." />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {audiences.map(([title, description]) => (
            <article key={title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-zinc-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="examples" className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading title="Text-to-Infographic Examples" description="Explore examples created from topics, notes, short explanations, and plain text prompts." />
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {landscapeExamples.map((item) => (
            <article key={item.title} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <img src={item.image} alt={item.alt} width={1672} height={941} className="aspect-[16/9] w-full bg-zinc-100 object-cover" loading="lazy" />
              <div className="p-4">
                <div className="flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-600">{tag}</span>
                  ))}
                </div>
                <h3 className="mt-3 text-lg font-semibold text-zinc-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{item.description}</p>
                <Link href={`/app?intent=generate&prompt=${encodeURIComponent(item.prompt)}`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-950 hover:text-emerald-700">
                  Create Similar
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          {portraitExamples.map((item) => (
            <article key={item.title} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <img src={item.image} alt={item.alt} width={941} height={1672} className="aspect-[9/16] w-full bg-zinc-100 object-cover" loading="lazy" />
              <div className="p-4">
                <div className="flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-600">{tag}</span>
                  ))}
                </div>
                <h3 className="mt-3 text-lg font-semibold text-zinc-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{item.description}</p>
                <Link href={`/app?intent=generate&prompt=${encodeURIComponent(item.prompt)}`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-950 hover:text-emerald-700">
                  Create Similar
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading title="More Than a Template-Based Infographic Maker" description="KnowLens starts with your text and helps structure the message before creating the visual." />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {whyItems.map(([title, description]) => (
            <article key={title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-zinc-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
        <SectionHeading title="FAQ" description="Common questions about turning text into infographics with KnowLens." />
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
          <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">Turn Your Text into an Infographic</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-300">Start with plain text, notes, a topic, or an outline. Generate a clear infographic, poster, or visual summary in minutes.</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/app?intent=generate" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-zinc-950 hover:bg-zinc-100">
              Create an Infographic
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="#examples" className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-6 text-sm font-semibold text-white hover:bg-white/10">View Examples</Link>
          </div>
        </div>
      </section>
    </MarketingChrome>
  );
}
