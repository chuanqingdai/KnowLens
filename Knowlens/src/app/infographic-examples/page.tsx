import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, BookOpen, FlaskConical, Layers3, Sparkles, Users } from "lucide-react";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

const siteUrl = "https://knowlens.ai";
const pageUrl = `${siteUrl}/infographic-examples`;

export const metadata: Metadata = {
  title: { absolute: "Infographic Examples | Visual Summaries & Posters | KnowLens.ai" },
  description:
    "Explore real examples of infographics, visual summaries, posters, and carousel-style visuals created from topics, notes, and plain text using KnowLens.ai.",
  keywords: [
    "infographic examples",
    "visual summary examples",
    "poster examples",
    "carousel-style examples",
    "educational infographic",
    "science infographic",
    "knowledge visualization",
    "infographic gallery",
  ],
  alternates: { canonical: pageUrl },
  openGraph: {
    type: "website",
    url: pageUrl,
    siteName: "KnowLens.ai",
    title: "Infographic Examples | KnowLens.ai",
    description:
      "Discover examples of educational, science, and social media visuals generated with KnowLens from text, notes, or topics.",
    images: [
      {
        url: `${siteUrl}/picture/text-to-poster.jpg`,
        width: 1003,
        height: 565,
        alt: "Infographic examples created from topics and notes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Infographic Examples | Visual Summaries & Posters | KnowLens.ai",
    description:
      "Browse infographic, poster, and visual summary examples created from topics, notes, and plain text.",
    images: [`${siteUrl}/picture/text-to-poster.jpg`],
  },
};

const examples = [
  {
    title: "Photosynthesis Educational Infographic",
    description: "A classroom-friendly visual that explains how plants turn sunlight into stored energy.",
    tags: ["Educational Infographic", "Science Visual"],
    image: "/en-picture/photosynthesis-infographic-case.jpg",
    alt: "Photosynthesis educational infographic created from notes",
    topic: "Create an educational infographic explaining photosynthesis from student notes.",
  },
  {
    title: "Solar System Visual Summary",
    description: "A science visual summary that organizes planet order, orbits, and key facts.",
    tags: ["Science Infographic", "Visual Summary"],
    image: "/en-picture/astronomy/astronomy-long-infographic.jpg",
    alt: "Solar system visual summary from topic text",
    topic: "Create a solar system visual summary from a short topic description.",
  },
  {
    title: "Study Notes Summary",
    description: "A structured graphic that turns rough notes into sections, labels, and takeaways.",
    tags: ["Visual Summary", "Study Guide"],
    image: "/en-picture/biology/biology-long-infographic.jpg",
    alt: "Study notes visual summary created from topic notes",
    topic: "Turn study notes into a visual summary with key terms and takeaways.",
  },
  {
    title: "Earth Science Poster",
    description: "A poster-style explanation of Earth systems, labels, and cause-and-effect ideas.",
    tags: ["Poster", "Science Visual"],
    image: "/en-picture/geography/geography-infographic-card.jpg",
    alt: "Earth science poster created from plain text",
    topic: "Create an Earth science poster from plain text for students.",
  },
  {
    title: "Social Carousel-Style Visual",
    description: "A multi-section visual that breaks one idea into short, easy-to-share points.",
    tags: ["Carousel-style Visual", "Social Visual"],
    image: "/picture/blue-light-health-poster-case.jpg",
    alt: "Carousel-style social visual created from notes",
    topic: "Create a carousel-style social visual from notes about healthy screen habits.",
  },
  {
    title: "Step-by-Step Recipe Poster",
    description: "A poster-style guide that turns a simple process into clear visual steps.",
    tags: ["Poster", "Step-by-Step Visual"],
    image: "/picture/ocean-circulation-infographic-case.jpg",
    alt: "Step-by-step recipe poster created from plain text",
    topic: "Create a step-by-step recipe poster from plain text.",
  },
];

const audiences = [
  ["Students", "Turn notes and topics into study visuals.", BookOpen],
  ["Teachers", "Make lesson topics easier to scan and explain.", BookOpen],
  ["Science Communicators", "Explain complex topics visually.", FlaskConical],
  ["Content Creators", "Create short educational visuals for social media.", Sparkles],
  ["Small Teams", "Generate knowledge visuals quickly without designers.", Users],
] as const;

const steps = [
  ["Add topic, notes, or text", "Start with the idea you want to explain."],
  ["Structure key points", "KnowLens organizes sections, labels, and visual hierarchy."],
  ["Generate a visual", "Create infographics, posters, carousel-style visuals, or visual summaries."],
] as const;

const faqItems = [
  ["What is this page?", "This page showcases infographics, visual summaries, and posters generated with KnowLens from text and notes."],
  ["Can I create similar visuals?", "Yes. Click Create Similar or start from your own topic, notes, or text."],
  ["What input types are supported?", "You can start with a topic, notes, plain text, rough outline, or short script."],
  ["Is this only for science?", "No. Examples can cover education, science, recipes, social content, products, and general knowledge."],
  ["Do I need design skills?", "No. KnowLens structures your content automatically and helps generate polished visual drafts."],
] as const;

const appSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "KnowLens Infographic Examples",
  url: pageUrl,
  applicationCategory: "DesignApplication",
  operatingSystem: "Web",
  description: "Examples of infographics, posters, visual summaries, and carousel-style visuals created from topics, notes, and text.",
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

export default function InfographicExamplesPage() {
  return (
    <MarketingChrome>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <section className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-10 pt-10 text-center sm:px-6 lg:pt-16">
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm">
          <Sparkles size={14} className="text-blue-600" aria-hidden="true" />
          Infographic Examples
        </div>
        <h1 className="mx-auto mt-6 max-w-5xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl lg:text-[4rem] lg:leading-[1.05]">
          Infographic Examples
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-zinc-600">
          Explore infographics, visual summaries, posters, and carousel-style visuals created from topics, notes, and plain text.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/app?intent=generate" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-zinc-950 px-6 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(15,23,42,0.18)] transition hover:bg-zinc-800">
            Create Your Infographic
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="#examples" className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-300 bg-white px-6 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50">
            Browse All Examples
          </Link>
        </div>
        <div className="mt-5 inline-flex items-center gap-2 text-sm text-zinc-600">
          <BadgeCheck size={16} className="text-emerald-600" aria-hidden="true" />
          See how ideas become clear visual explanations in seconds.
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">What is KnowLens?</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-600 sm:text-base">
            KnowLens turns topics, notes, and plain text into infographics, posters, visual summaries, and carousel-style visuals. It is designed for education, science, and knowledge sharing.
          </p>
        </div>
      </section>

      <section id="examples" className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading title="Inspiring Infographics & Visual Summaries" description="Browse examples created from short prompts, learning notes, and everyday explanation topics." />
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {examples.map((item) => (
            <article key={item.title} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
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
        <SectionHeading title="Who Uses These Infographics?" description="KnowLens examples are useful wherever ideas need to become easier to understand, teach, or share." />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {audiences.map(([title, description, Icon]) => (
            <article key={title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"><Icon size={19} /></span>
              <h3 className="mt-4 text-lg font-semibold text-zinc-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading eyebrow="HOW IT WORKS" title="From Text to Visual Example" description="The same flow used for these examples starts with a simple idea and turns it into visual structure." />
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
          <Link href="/app?intent=generate" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white hover:bg-zinc-800">Try It Yourself<ArrowRight size={15} /></Link>
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
          <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">Create Your Own Infographic or Visual Summary</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-300">
            Start with your topic, notes, or text and generate clear, shareable visuals in minutes.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/app?intent=generate" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-zinc-950 hover:bg-zinc-100">Create an Infographic<ArrowRight size={16} /></Link>
            <Link href="#examples" className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-6 text-sm font-semibold text-white hover:bg-white/10">Browse Examples</Link>
          </div>
        </div>
      </section>
    </MarketingChrome>
  );
}
