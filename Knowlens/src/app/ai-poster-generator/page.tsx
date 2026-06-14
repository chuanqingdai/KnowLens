import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, BookOpen, FlaskConical, Layers3, PanelTop, Sparkles } from "lucide-react";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

const siteUrl = "https://knowlens.ai";
const pageUrl = `${siteUrl}/ai-poster-generator`;
const heroImage = {
  src: "/picture/text-to-ppt-hero.jpg",
  alt: "Text to visual PPT example showing renewable energy market presentation slides",
  title: "Text to Visual PPT Example",
};

export const metadata: Metadata = {
  title: { absolute: "AI Poster Generator | Create Posters from Text | KnowLens.ai" },
  description:
    "Turn topics, notes, and plain text into visual posters with KnowLens.ai. Create educational posters, science posters, social media posters, and infographic-style visuals in minutes.",
  keywords: [
    "AI poster generator",
    "poster maker",
    "AI poster maker",
    "poster generator",
    "text to poster",
    "topic to poster",
    "notes to poster",
    "visual poster generator",
    "educational poster generator",
    "science poster generator",
    "social media poster generator",
    "infographic poster maker",
  ],
  alternates: { canonical: pageUrl },
  openGraph: {
    type: "website",
    url: pageUrl,
    siteName: "KnowLens.ai",
    title: "AI Poster Generator | KnowLens.ai",
    description:
      "Create poster-style visuals from topics, notes, and plain text. Generate educational posters, science posters, social media posters, and visual summaries with AI.",
    images: [
      {
        url: `${siteUrl}${heroImage.src}`,
        width: 752,
        height: 752,
        alt: heroImage.alt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Poster Generator | Create Posters from Text | KnowLens.ai",
    description:
      "Turn topics, notes, and plain text into educational posters, science posters, social media posters, and infographic-style visuals.",
    images: [`${siteUrl}${heroImage.src}`],
  },
};

const createCards = [
  ["Educational Posters", "Turn lesson topics, study notes, and concepts into classroom-ready posters.", BookOpen],
  ["Science Posters", "Explain science topics with diagrams, labels, and visual structure.", FlaskConical],
  ["Social Media Posters", "Create poster-style visuals for X, LinkedIn, Instagram, blogs, and presentations.", PanelTop],
  ["Infographic Posters", "Turn key points into infographic-style posters with clear sections and visual hierarchy.", Layers3],
  ["Visual Summary Posters", "Transform notes and outlines into clear poster-style summaries.", Sparkles],
  ["Product Posters", "Turn a product idea or feature explanation into a simple visual poster.", PanelTop],
] as const;

const steps = [
  ["Add Your Idea", "Start with a topic, notes, plain text, or a rough outline."],
  ["Choose a Visual Direction", "KnowLens organizes your idea into key points, sections, and a visual structure."],
  ["Generate and Download", "Create a polished poster, infographic-style visual, visual summary, or carousel-style graphic."],
] as const;

const useCases = [
  ["Students", "Turn study notes and concepts into visual study posters.", "Study posters"],
  ["Teachers", "Create classroom posters and lesson visuals faster.", "Lesson visuals"],
  ["Content Creators", "Turn ideas and explanations into poster-style visuals for social platforms.", "Social posters"],
  ["Science Communicators", "Explain complex topics with clear visual posters.", "Science posters"],
  ["Small Teams", "Create quick posters and knowledge visuals without a designer.", "Team visuals"],
  ["Marketers", "Turn product ideas and campaign messages into simple visual posters.", "Campaign posters"],
] as const;

const exampleRows = [
  [
    {
      title: "Google Earnings Summary Poster",
      description: "A wide business poster that organizes Google Q1 2024 revenue, segment growth, and management highlights into a clean report-style visual.",
      tags: ["Business Poster", "Financial Summary"],
      image: "/en-picture/17e1c7f5-b04e-4e54-88af-787c79d1e8e3.png",
      alt: "Google earnings summary poster in landscape format",
      topic: "Create a wide earnings poster that summarizes Google revenue, operating income, cloud momentum, segment breakdowns, and business highlights in a clean dashboard layout.",
      aspectClassName: "aspect-[16/9]",
    },
    {
      title: "Seed Germination Learning Poster",
      description: "A wide classroom poster that explains seed germination with four simple stages and a clean plant-growth narrative.",
      tags: ["Classroom Poster", "Science"],
      image: "/en-picture/645ecabf-1b29-4d05-a377-1c886b5a2ae8.png",
      alt: "Seed germination learning poster in landscape format",
      topic: "Create a wide classroom poster that explains seed germination through the stages of dry seed, water absorption, root emergence, and first leaves.",
      aspectClassName: "aspect-[16/9]",
    },
    {
      title: "Vaccine Immunity Explainer Poster",
      description: "A wide medical poster that shows how vaccines train the immune system with clear protective stages and memory-cell visuals.",
      tags: ["Medical Poster", "Biology"],
      image: "/en-picture/d561aaef-2126-479e-bef3-5726b925f88e.png",
      alt: "Vaccine immunity explainer poster in landscape format",
      topic: "Create a wide medical poster that explains vaccine exposure, antigen recognition, immune memory, and faster protection on future exposure.",
      aspectClassName: "aspect-[16/9]",
    },
  ],
  [
    {
      title: "Solar Storms Science Poster",
      description: "A vertical science poster that explains solar storms and aurora formation with a cinematic space-weather sequence.",
      tags: ["Science Poster", "Astronomy"],
      image: "/en-picture/astronomy/astronomy-long-infographic.jpg",
      alt: "Solar storms science poster in vertical format",
      topic: "Create a vertical science poster that explains solar flares, particle travel, Earth's magnetosphere, atmospheric collisions, and aurora formation.",
      aspectClassName: "aspect-[9/16]",
    },
    {
      title: "DNA Replication Study Poster",
      description: "A vertical biology poster that explains DNA replication through a central double-helix diagram and concise learning points.",
      tags: ["Biology Poster", "Study Guide"],
      image: "/en-picture/biology/biology-infographic-card.jpg",
      alt: "DNA replication study poster in vertical format",
      topic: "Create a DNA replication study poster that explains helicase, base pairing, polymerase, and how one DNA molecule becomes two identical copies.",
      aspectClassName: "aspect-[9/16]",
    },
    {
      title: "Silk Road History Poster",
      description: "A vertical history poster that maps Silk Road routes, trade goods, cultural exchange, and why the network connected civilizations.",
      tags: ["History Poster", "Visual Summary"],
      image: "/en-picture/history/b09d63d7-b6d4-4ff7-87e4-aad50d709b9d.png",
      alt: "Silk Road history poster in vertical format",
      topic: "Create a vertical history poster about the Silk Road. Explain route geography, traded goods, exchanged ideas, key cities, and long-term historical impact.",
      aspectClassName: "aspect-[9/16]",
    },
  ],
] as const;

const whyPoints = [
  ["Starts from Your Idea", "Begin with a topic, notes, or plain text instead of a blank canvas."],
  ["Structures the Message", "KnowLens organizes your content into sections, key points, and visual hierarchy."],
  ["Creates Shareable Posters", "Generate poster-style visuals for learning, social media, presentations, and quick explanations."],
  ["No Design Skills Needed", "You describe the idea. KnowLens handles the visual structure and style."],
] as const;

const faqItems = [
  ["What is an AI poster generator?", "An AI poster generator helps turn a topic, notes, or plain text into a poster-style visual. KnowLens uses AI to structure your idea and generate clear posters, visual summaries, and infographic-style designs."],
  ["Can I make posters online with KnowLens?", "Yes. You can use KnowLens as an online poster maker. Start with a topic, notes, or plain text, then generate a poster-style visual."],
  ["Is KnowLens an AI poster maker?", "Yes. KnowLens can help create educational posters, science posters, social media posters, product posters, and visual summary posters."],
  ["What can I use as input?", "You can start with a topic, notes, a short explanation, plain text, or a rough outline."],
  ["Can I create educational posters?", "Yes. KnowLens can help create educational posters, science posters, study posters, and classroom-ready visual summaries."],
  ["Can I create social media posters?", "Yes. You can generate poster-style visuals for social platforms, blogs, presentations, and quick sharing."],
  ["Do I need design experience?", "No. KnowLens helps turn your idea into a clear visual structure, so you do not need design experience."],
  ["How is this different from a normal poster maker?", "A normal poster maker starts with design templates. KnowLens starts with your idea or notes, structures the message, and turns it into visual information."],
] as const;

const appSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "KnowLens AI Poster Generator",
  url: pageUrl,
  applicationCategory: "DesignApplication",
  operatingSystem: "Web",
  description: "Create poster-style visuals from topics, notes, and plain text.",
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

function SectionHeading({ title, description, eyebrow }: { title: string; description: string; eyebrow?: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{eyebrow}</p> : null}
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">{title}</h2>
      <p className="mt-3 text-base leading-7 text-zinc-600">{description}</p>
    </div>
  );
}

export default function AiPosterGeneratorPage() {
  return (
    <MarketingChrome>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-12 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)] lg:items-center lg:pt-16">
        <div className="text-center lg:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm">
            <Sparkles size={14} className="text-blue-600" aria-hidden="true" />
            BOLD VISUAL OUTPUTS
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl lg:text-[4rem] lg:leading-[1.05]">
            AI Poster Generator for Clear Posters
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-zinc-600 lg:mx-0">
            Turn topics, notes, or plain text into clear visual posters, infographic-style designs, and social media graphics in minutes.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <Link href="/app?intent=generate" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-zinc-950 px-6 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(15,23,42,0.18)] transition hover:bg-zinc-800">
              Create a Poster
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="#examples" className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-300 bg-white px-6 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50">
              View Examples
            </Link>
          </div>
          <div className="mt-5 inline-flex items-center gap-2 text-sm text-zinc-600">
            <BadgeCheck size={16} className="text-emerald-600" aria-hidden="true" />
            No design skills needed. Start with an idea, notes, or a short explanation.
          </div>
          <p className="mt-2 text-sm text-zinc-500">
            Create educational posters, science posters, social media posters, and visual summaries from text.
          </p>
        </div>

        <div className="rounded-[2rem] border border-zinc-200 bg-white p-3 shadow-[0_24px_60px_rgba(15,23,42,0.10)]">
          <img
            src={heroImage.src}
            alt={heroImage.alt}
            title={heroImage.title}
            width={752}
            height={752}
            className="aspect-square w-full rounded-xl bg-zinc-100 object-cover"
            loading="eager"
          />
          <p className="mt-3 text-center text-xs leading-5 text-zinc-500">
            Examples generated with KnowLens from short topics, notes, and text prompts.
          </p>
        </div>
      </section>

      <section id="examples" className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading title="Poster Examples Made with KnowLens" description="Explore poster examples created from topics, notes, and short text prompts." />
        <div className="mt-8 space-y-5">
          {exampleRows.map((row, rowIndex) => (
            <div key={rowIndex} className="grid gap-5 md:grid-cols-3">
              {row.map((item) => (
                <article key={item.title} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                  <div className={`${item.aspectClassName} flex w-full items-center justify-center overflow-hidden bg-zinc-50 p-3`}>
                    <img src={item.image} alt={item.alt} width={960} height={960} className="h-full w-full object-contain" loading="lazy" />
                  </div>
                  <div className="p-4">
                    <div className="flex flex-wrap gap-2">{item.tags.map((tag) => <span key={tag} className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-600">{tag}</span>)}</div>
                    <h3 className="mt-3 text-lg font-semibold text-zinc-950">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">{item.description}</p>
                    <Link href={`/app?intent=generate&prompt=${encodeURIComponent(item.topic)}`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-950 hover:text-emerald-700">
                      Create Similar
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading title="Create Posters for Any Idea" description="Turn simple text into poster-style visuals for learning, sharing, and explaining." />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {createCards.map(([title, description, Icon]) => (
            <article key={title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"><Icon size={19} /></span>
              <h3 className="mt-4 text-lg font-semibold text-zinc-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading eyebrow="HOW IT WORKS" title="Create a Poster in 3 Simple Steps" description="Start with an idea. KnowLens helps structure the message and generate a clear poster-style visual." />
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
            Create a Poster
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading title="Built for Learning, Social Media, and Quick Visual Communication" description="Use the poster generator for education, content creation, product ideas, and social sharing." />
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

            <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading title="More Than a Template-Based Poster Maker" description="KnowLens helps structure your idea before generating the poster, so the visual is clear, useful, and easy to share." />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {whyPoints.map(([title, description]) => (
            <article key={title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-zinc-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
        <SectionHeading title="FAQ" description="Common questions about creating posters with KnowLens." />
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
          <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">Create Your Next Poster with AI</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-300">
            Start with a topic, notes, or plain text. Generate a clear poster, visual summary, or infographic-style design in minutes.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/app?intent=generate" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-zinc-950 hover:bg-zinc-100">Create a Poster<ArrowRight size={16} /></Link>
            <Link href="#examples" className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-6 text-sm font-semibold text-white hover:bg-white/10">View Examples</Link>
          </div>
        </div>
      </section>
    </MarketingChrome>
  );
}
