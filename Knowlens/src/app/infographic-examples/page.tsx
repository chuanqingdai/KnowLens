import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, BookOpen, FlaskConical, Grid2X2, Layers3, Lightbulb, Sparkles } from "lucide-react";
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
    title: "Seed Germination at a Glance",
    description:
      "An educational infographic that explains seed germination stages with simple labels, a clear sequence, and a classroom-ready structure.",
    tags: ["Educational Infographic", "Science Visual"],
    image: "/en-picture/photosynthesis-infographic-case.jpg",
    alt: "Seed germination educational infographic created with KnowLens",
    width: 1672,
    height: 941,
    topic:
      "Explain seed germination in 5 stages for middle school students. Include dry seed, water absorption, swelling, root growth, shoot growth, first leaves, and why water, warmth, and air matter.",
  },
  {
    title: "Solar Storms Visual Summary",
    description:
      "A science visual summary that organizes solar storm causes, charged particles, Earth's magnetic field, and aurora colors into a readable layout.",
    tags: ["Science Infographic", "Visual Summary"],
    image: "/en-picture/astronomy/astronomy-long-infographic.jpg",
    alt: "Solar storms visual summary infographic created with KnowLens",
    width: 941,
    height: 1672,
    topic:
      "Create an infographic about solar storms, including solar flares, charged particles, Earth's magnetosphere, auroras, and key facts students should remember.",
  },
  {
    title: "DNA Replication Poster",
    description:
      "A poster-style infographic that explains helicase, base pairing, DNA polymerase, and two matching DNA molecules step by step.",
    tags: ["Science Poster", "Educational Visual"],
    image: "/en-picture/biology/biology-long-infographic.jpg",
    alt: "DNA replication poster-style infographic created with KnowLens",
    width: 941,
    height: 1672,
    topic:
      "Turn these notes about DNA replication into a poster-style infographic. Include helicase, template strands, base pairing, DNA polymerase, semiconservative replication, and the final result.",
  },
  {
    title: "Volcano Eruption Structure",
    description:
      "An earth science visual summary showing magma chambers, pressure, vents, ash clouds, lava flow, and eruption stages.",
    tags: ["Science Infographic", "Visual Summary"],
    image: "/en-picture/geography/geography-long-infographic.jpg",
    alt: "Volcano eruption visual summary infographic created with KnowLens",
    width: 941,
    height: 1672,
    topic:
      "Create a visual summary explaining how volcanoes erupt. Include magma chamber, pressure buildup, vent, crater, lava flow, ash cloud, eruption stages, and key takeaways for students.",
  },
  {
    title: "How Roots Absorb Water and Minerals",
    description:
      "A biology infographic showing root hairs, osmosis, mineral ion uptake, xylem transport, and how water moves upward through a plant.",
    tags: ["Biology Infographic", "Classroom Visual"],
    image: "/en-picture/plate-tectonics-earthquake-infographic-case.jpg",
    alt: "Root absorption infographic explaining how roots absorb water and minerals",
    width: 1672,
    height: 941,
    topic:
      "Create a biology infographic explaining how roots absorb water and minerals. Include root hairs, osmosis, mineral ions, active transport, xylem, and how water and nutrients move upward through the plant.",
  },
  {
    title: "How a Tesla EV Works",
    description:
      "A technology infographic that labels the charging system, battery pack, inverter, motor, and regenerative braking in an electric vehicle.",
    tags: ["Technology Infographic", "Engineering Visual"],
    image: "/en-picture/inflation-daily-life-infographic-case.jpg",
    alt: "Tesla EV infographic explaining electric vehicle components",
    width: 1672,
    height: 941,
    topic:
      "Create a technology infographic explaining how a Tesla EV works. Include charging, the battery pack, inverter, electric motor, power flow, and regenerative braking.",
  },
  {
    title: "How Vaccines Train the Immune System",
    description:
      "A health science infographic explaining vaccine exposure, antigen recognition, antibody production, immune memory, and faster future protection.",
    tags: ["Health Science Infographic", "Educational Visual"],
    image: "/en-picture/printing-press-history-infographic-case.jpg",
    alt: "Vaccine infographic explaining how vaccines train immune memory",
    width: 1672,
    height: 941,
    topic:
      "Create a health science infographic explaining how vaccines train the immune system. Include vaccine exposure, antigen recognition, B cells, antibodies, immune memory, and faster protection after future exposure.",
  },
] as const;

const portraitExamples = examples.filter((item) => item.height > item.width);
const landscapeExamples = examples.filter((item) => item.width > item.height);

const categories = [
  {
    title: "Science Infographics",
    description: "Visual examples for biology, physics, astronomy, earth science, and classroom science topics.",
    href: "/science-infographic-generator",
    Icon: FlaskConical,
  },
  {
    title: "Educational Infographics",
    description: "Study guides, lesson visuals, classroom posters, and learning summaries.",
    Icon: BookOpen,
  },
  {
    title: "Process Infographics",
    description: "Step-by-step visuals for workflows, tutorials, recipes, and simple explanations.",
    Icon: Layers3,
  },
  {
    title: "Visual Summaries",
    description: "Structured summaries created from plain text, notes, or short explanations.",
    href: "/text-to-infographic",
    Icon: Sparkles,
  },
  {
    title: "Poster-Style Infographics",
    description: "Single-page visuals for social posts, presentations, and quick knowledge sharing.",
    href: "/ai-poster-generator",
    Icon: Grid2X2,
  },
  {
    title: "Carousel-Style Visuals",
    description: "Multi-section visuals that break one idea into easy-to-share parts.",
    href: "/ai-carousel-generator",
    Icon: Lightbulb,
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
  ["Infographic Maker", "/infographic-maker", "Make clear infographics without design skills."],
  ["Text to Infographic", "/text-to-infographic", "Turn plain text into infographic-style visuals."],
  ["Science Infographic Generator", "/science-infographic-generator", "Create structured science infographics from science topics and notes."],
  ["AI Poster Generator", "/ai-poster-generator", "Create poster-style visuals from ideas and notes."],
  ["AI Carousel Generator", "/ai-carousel-generator", "Create carousel-style visuals for sharing."],
] as const;

const faqItems = [
  ["What are infographic examples?", "Infographic examples are sample visuals that show how information can be organized into sections, labels, diagrams, and summaries. They help you understand what kind of infographic structure might work for your own topic or notes."],
  ["Can I create a similar infographic with KnowLens?", "Yes. Choose an example, click Create Similar, and start with your own topic, notes, or plain text."],
  ["What kinds of infographic examples are included?", "This page includes examples for science topics, education, study notes, recipes, product ideas, visual summaries, process visuals, and poster-style infographics."],
  ["What inputs can I use to create an infographic?", "You can start with a topic, notes, plain text, a short explanation, or a rough text idea."],
  ["Do I need design skills to create these infographics?", "No. KnowLens helps organize your content into a visual structure, so you do not need to design from a blank canvas."],
  ["How do I get better infographic results?", "Use complete input. Include the topic, audience, key points, steps, facts, and examples you want to show in the visual."],
  ["Are these only science infographic examples?", "No. The gallery can include science, education, recipes, product explanations, study notes, process visuals, and social content examples."],
  ["Can I use these examples for social media ideas?", "Yes. Poster-style infographics, visual summaries, and carousel-style visuals can be useful for social posts, presentations, blogs, and learning materials."],
  ["How is this different from a template gallery?", "A template gallery usually starts from fixed layouts. KnowLens examples show what can be created from text, notes, or topics, then let you create a similar visual with your own content."],
  ["Can I browse by infographic type?", "Yes. The page organizes examples by type, such as science infographics, educational visuals, process infographics, visual summaries, poster-style infographics, and carousel-style visuals."],
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
        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
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
