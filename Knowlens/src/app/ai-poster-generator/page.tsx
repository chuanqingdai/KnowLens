import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, BookOpen, FlaskConical, Layers3, PanelTop, Sparkles } from "lucide-react";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

const siteUrl = "https://knowlens.ai";
const pageUrl = `${siteUrl}/ai-poster-generator`;

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
        url: `${siteUrl}/picture/ai-infographic-generator-learning-hero.jpg`,
        width: 1003,
        height: 565,
        alt: "AI-generated poster examples created from topics and notes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Poster Generator | Create Posters from Text | KnowLens.ai",
    description:
      "Turn topics, notes, and plain text into educational posters, science posters, social media posters, and infographic-style visuals.",
    images: [`${siteUrl}/picture/ai-infographic-generator-learning-hero.jpg`],
  },
};

const heroImages = [
  {
    src: "/picture/ai-infographic-generator-learning-hero.jpg",
    alt: "AI-generated poster examples created from topics and notes",
    title: "AI Poster Generator Examples",
  },
  {
    src: "/picture/blue-light-health-poster-case.jpg",
    alt: "Educational poster generated with AI from study notes",
    title: "AI-Generated Educational Poster",
  },
  {
    src: "/picture/inflation-daily-life-poster-case.jpg",
    alt: "Social media poster generated with AI from plain text",
    title: "AI-Generated Social Media Poster",
  },
];

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

const examples = [
  {
    title: "Solar System Learning Poster",
    description: "An educational poster that explains the planets with clear visual structure.",
    tags: ["Educational Poster", "Science Poster"],
    image: "/en-picture/astronomy/astronomy-long-infographic.jpg",
    alt: "Solar system learning poster generated with AI",
    topic: "Create a solar system learning poster that explains the planets, their order, and simple facts for students.",
  },
  {
    title: "Volcano Science Poster",
    description: "A science poster explaining how volcanoes form and erupt.",
    tags: ["Science Poster", "Visual Summary"],
    image: "/picture/ai-infographic-generator-learning-hero.jpg",
    alt: "Volcano science poster generated with AI",
    topic: "Create a volcano science poster explaining magma, eruptions, lava flow, ash clouds, and key safety ideas.",
  },
  {
    title: "Step-by-Step Recipe Poster",
    description: "A poster-style visual guide for explaining a simple recipe.",
    tags: ["Recipe Poster", "Step-by-Step Visual"],
    image: "/picture/ocean-circulation-infographic-case.jpg",
    alt: "Step-by-step recipe poster generated with AI",
    topic: "Create a step-by-step recipe poster that turns a simple recipe into clear visual instructions.",
  },
  {
    title: "Product Launch Poster",
    description: "A visual poster for explaining a new product idea or feature.",
    tags: ["Product Poster", "Marketing Visual"],
    image: "/picture/inflation-daily-life-poster-case.jpg",
    alt: "Product launch poster generated with AI from a short idea",
    topic: "Create a product launch poster explaining a new feature, the user problem, and three clear benefits.",
  },
  {
    title: "Study Notes Poster",
    description: "A structured poster that turns notes into a quick study visual.",
    tags: ["Study Poster", "Visual Summary"],
    image: "/en-picture/biology/biology-long-infographic.jpg",
    alt: "Study notes poster generated with AI",
    topic: "Create a study notes poster that organizes key biology terms, definitions, and takeaways for review.",
  },
  {
    title: "Social Media Idea Poster",
    description: "A poster-style social visual generated from a short idea.",
    tags: ["Social Media Poster", "Visual Content"],
    image: "/picture/blue-light-health-poster-case.jpg",
    alt: "Social media idea poster generated with AI",
    topic: "Create a social media poster from a short idea, with a strong headline, simple sections, and a clear takeaway.",
  },
];

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
          <div className="grid gap-3">
            <img src={heroImages[0].src} alt={heroImages[0].alt} title={heroImages[0].title} width={1003} height={565} className="aspect-video w-full rounded-xl bg-zinc-100 object-cover" loading="eager" />
            <div className="grid grid-cols-2 gap-3">
              {heroImages.slice(1).map((image) => (
                <img key={image.src} src={image.src} alt={image.alt} title={image.title} width={480} height={320} className="aspect-video w-full rounded-xl bg-zinc-100 object-cover" loading="eager" />
              ))}
            </div>
          </div>
          <p className="mt-3 text-center text-xs leading-5 text-zinc-500">
            Examples generated with KnowLens from short topics, notes, and text prompts.
          </p>
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

      <section id="examples" className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading title="Poster Examples Made with KnowLens" description="Explore poster examples created from topics, notes, and short text prompts." />
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {examples.map((item) => (
            <article key={item.title} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <img src={item.image} alt={item.alt} width={640} height={820} className="h-auto w-full bg-zinc-100 object-contain" loading="lazy" />
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
