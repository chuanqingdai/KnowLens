import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, BookOpen, Check, FlaskConical, Layers3, PanelTop, Sparkles } from "lucide-react";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

const siteUrl = "https://knowlens.ai";
const pageUrl = `${siteUrl}/infographic-maker`;

export const metadata: Metadata = {
  title: {
    absolute: "Infographic Maker Online | AI Infographic Maker | KnowLens.ai",
  },
  description:
    "Turn topics, notes, or plain text into infographics, visual summaries, posters, carousel-style visuals, and short explainer videos in minutes with KnowLens.",
  keywords: [
    "infographic maker",
    "AI infographic maker",
    "infographic generator",
    "text to infographic",
    "notes to infographic",
    "topic to infographic",
    "visual summary generator",
    "AI poster generator",
    "AI carousel generator",
    "short explainer video",
    "educational infographic",
    "science infographic",
  ],
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    type: "website",
    url: pageUrl,
    siteName: "KnowLens.ai",
    title: "Infographic Maker Online | AI Infographic Maker | KnowLens.ai",
    description:
      "Turn topics, notes, or plain text into infographics, visual summaries, posters, carousel-style visuals, and short explainer videos.",
    images: [
      {
        url: `${siteUrl}/picture/text-to-poster.jpg`,
        width: 1003,
        height: 565,
        alt: "AI-generated infographic examples made from topics and notes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Infographic Maker Online | AI Infographic Maker | KnowLens.ai",
    description:
      "Create infographics, posters, visual summaries, carousel-style visuals, and short explainer videos from topics, notes, or plain text.",
    images: [`${siteUrl}/picture/text-to-poster.jpg`],
  },
};

const heroImages = [
  {
    src: "/en-picture/photosynthesis-infographic-case.jpg",
    alt: "Photosynthesis educational infographic generated with AI",
  },
  {
    src: "/en-picture/astronomy/astronomy-long-infographic.jpg",
    alt: "Solar system science infographic generated with AI",
  },
  {
    src: "/en-picture/biology/biology-infographic-card.jpg",
    alt: "Biology visual summary generated from study notes",
  },
];

const features = [
  {
    title: "Educational Infographics",
    description: "Turn lesson topics and study notes into classroom-ready visuals.",
    Icon: BookOpen,
  },
  {
    title: "Science Infographics",
    description: "Explain science concepts visually with diagrams and labels.",
    Icon: FlaskConical,
  },
  {
    title: "Social Posters",
    description: "Generate poster-style visuals for social media and presentations.",
    Icon: PanelTop,
  },
  {
    title: "Carousel-Style Visuals",
    description: "Create multi-section visuals for easy sharing.",
    Icon: Layers3,
  },
  {
    title: "Visual Study Guides",
    description: "Convert notes and outlines into structured knowledge visuals.",
    Icon: BookOpen,
  },
  {
    title: "Product Explainers",
    description: "Turn product ideas into visual summaries.",
    Icon: Sparkles,
  },
];

const steps = [
  {
    title: "Add Your Idea",
    description: "Start with a topic, notes, plain text, or rough outline.",
  },
  {
    title: "Choose a Visual Direction",
    description: "KnowLens organizes content into sections and key points.",
  },
  {
    title: "Generate and Download",
    description: "Create a polished infographic, poster, visual summary, carousel visual, or short explainer video.",
  },
];

const audiences = [
  {
    title: "Students",
    description: "Turn study notes and concepts into visual study guides.",
    tag: "Study notes",
  },
  {
    title: "Teachers",
    description: "Generate lesson visuals and classroom-ready infographics.",
    tag: "Classroom visuals",
  },
  {
    title: "Content Creators",
    description: "Turn ideas into shareable visuals and short videos.",
    tag: "Social content",
  },
  {
    title: "Science Communicators",
    description: "Explain complex topics with clear visuals.",
    tag: "Science visuals",
  },
  {
    title: "Small Teams",
    description: "Quickly produce posters, carousel visuals, and short videos without a designer.",
    tag: "Team explainers",
  },
];

const examples = [
  {
    title: "Photosynthesis at a Glance",
    description: "An educational infographic that explains how plants turn sunlight into stored energy.",
    tags: ["Educational Infographic", "Science Visual"],
    image: "/en-picture/photosynthesis-infographic-case.jpg",
    alt: "Photosynthesis educational infographic generated with AI",
    topic:
      "Create an educational infographic explaining how photosynthesis turns sunlight, water, and carbon dioxide into glucose and oxygen.",
  },
  {
    title: "Solar System Overview",
    description: "A science infographic that organizes planets, distances, orbits, and key facts.",
    tags: ["Science Infographic", "Visual Summary"],
    image: "/en-picture/astronomy/astronomy-long-infographic.jpg",
    alt: "Solar system science infographic generated with AI",
    topic:
      "Create a science infographic explaining the solar system, planet order, orbital motion, and key facts for students.",
  },
  {
    title: "Study Notes Summary",
    description: "A visual summary that turns rough notes into clear sections, labels, and takeaways.",
    tags: ["Visual Summary", "Study Guide"],
    image: "/en-picture/biology/biology-long-infographic.jpg",
    alt: "Study notes visual summary generated from plain text",
    topic:
      "Turn messy biology study notes into a structured visual summary with sections, key terms, and simple takeaways.",
  },
];

const faqItems = [
  {
    question: "What is an infographic maker?",
    answer:
      "An infographic maker helps turn topics, notes, or plain text into infographic-style visuals. KnowLens uses AI to structure the content into clear sections, labels, and visual summaries.",
  },
  {
    question: "Can I create videos?",
    answer:
      "Yes. KnowLens can also generate short explainer videos from text, notes, or topics.",
  },
  {
    question: "What can I use as input?",
    answer: "You can start with a topic, notes, plain text, or a rough outline.",
  },
  {
    question: "Do I need design experience?",
    answer:
      "No. KnowLens structures your content into visual summaries automatically, so you can start with an idea instead of a blank canvas.",
  },
];

const appSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "KnowLens Infographic Maker",
  url: pageUrl,
  applicationCategory: "DesignApplication",
  operatingSystem: "Web",
  description:
    "Turn topics, notes, or plain text into infographics, posters, visual summaries, carousel-style visuals, and short explainer videos.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
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

export default function InfographicMakerPage() {
  return (
    <MarketingChrome>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <section className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-12 pt-10 text-center sm:px-6 lg:pt-16">
        <div className="mx-auto max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm">
            <Sparkles size={14} className="text-blue-600" aria-hidden="true" />
            NO DESIGN SKILLS NEEDED
          </div>
          <h1 className="mx-auto mt-6 max-w-5xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl lg:text-[4rem] lg:leading-[1.05]">
            Infographic Maker for Clear Visuals
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-zinc-600">
            Turn topics, notes, or plain text into infographics, visual summaries, posters, carousel-style visuals, and short explainer videos in minutes.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/app?intent=generate"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-zinc-950 px-6 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(15,23,42,0.18)] transition hover:bg-zinc-800"
            >
              Make an Infographic
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link
              href="#examples"
              className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-300 bg-white px-6 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
            >
              View Examples
            </Link>
          </div>
          <div className="mt-5 inline-flex items-center gap-2 text-sm text-zinc-600">
            <BadgeCheck size={16} className="text-emerald-600" aria-hidden="true" />
            No design skills needed. Start with an idea, notes, or a short explanation.
          </div>
        </div>

        <div className="mt-10 w-full max-w-4xl rounded-[2rem] border border-zinc-200 bg-white p-3 shadow-[0_24px_60px_rgba(15,23,42,0.10)]">
          <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
            <img
              src={heroImages[0].src}
              alt={heroImages[0].alt}
              width={1003}
              height={565}
              className="aspect-video w-full rounded-xl bg-zinc-100 object-cover"
              loading="eager"
            />
            <div className="grid gap-3">
              {heroImages.slice(1).map((image) => (
                <img
                  key={image.src}
                  src={image.src}
                  alt={image.alt}
                  width={480}
                  height={360}
                  className="aspect-video w-full rounded-xl bg-zinc-100 object-cover"
                  loading="eager"
                />
              ))}
            </div>
          </div>
          <p className="mt-3 text-center text-xs leading-5 text-zinc-500">
            Examples generated from topics, notes, and short text prompts.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading
          title="Create Infographics & Visual Summaries"
          description="Turn simple text into structured visual content for learning, sharing, and explaining."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((item) => {
            const Icon = item.Icon;
            return (
              <article key={item.title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                  <Icon size={19} aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-zinc-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{item.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading
          eyebrow="HOW IT WORKS"
          title="Make an Infographic in 3 Simple Steps"
          description="Start with text. KnowLens organizes your message and turns it into a clear visual output."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <article key={step.title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white">
                {index + 1}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-zinc-950">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{step.description}</p>
            </article>
          ))}
        </div>
        <div className="mt-7 text-center">
          <Link href="/app?intent=generate" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white hover:bg-zinc-800">
            Make an Infographic
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading
          title="Built for Learning, Sharing, and Explaining"
          description="Create infographics and visual summaries for education, content creation, social media, and presentations."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {audiences.map((item) => (
            <article key={item.title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-zinc-950">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{item.description}</p>
              <p className="mt-4 text-xs font-semibold text-emerald-700">{item.tag}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="examples" className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading
          title="Infographic Examples Made with KnowLens"
          description="Explore examples generated from topics, notes, and short text prompts."
        />
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {examples.map((item) => (
            <article key={item.title} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <img src={item.image} alt={item.alt} width={640} height={820} className="h-auto w-full bg-zinc-100 object-contain" loading="lazy" />
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
                <Link href={`/app?intent=generate&prompt=${encodeURIComponent(item.topic)}`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-950 hover:text-emerald-700">
                  Create Similar
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
        <SectionHeading title="FAQ" description="Common questions about making infographics with KnowLens." />
        <div className="mt-8 divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white">
          {faqItems.map((item) => (
            <details key={item.question} className="group p-5">
              <summary className="cursor-pointer list-none text-base font-semibold text-zinc-950">
                {item.question}
              </summary>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <div className="rounded-[2rem] bg-zinc-950 px-6 py-12 text-center text-white sm:px-10">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">Make Your Next Infographic with AI</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-300">
            Turn topics, notes, or plain text into clear infographics, posters, visual summaries, and short explainer videos.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/app?intent=generate" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-zinc-950 hover:bg-zinc-100">
              Make an Infographic
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="#examples" className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-6 text-sm font-semibold text-white hover:bg-white/10">
              View Examples
            </Link>
          </div>
        </div>
      </section>
    </MarketingChrome>
  );
}
