import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, BookOpen, FlaskConical, Layers3, PanelTop, Sparkles, Video } from "lucide-react";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

const siteUrl = "https://knowlens.ai";
const pageUrl = `${siteUrl}/ai-infographic-generator`;

export const metadata: Metadata = {
  title: { absolute: "AI Infographic Generator | Create Infographics & Visual Summaries | KnowLens.ai" },
  description:
    "Turn topics, notes, or plain text into clear infographics, visual summaries, posters, carousel-style visuals, and short explainer videos in minutes. Perfect for education, science, and knowledge sharing.",
  keywords: [
    "AI infographic generator",
    "infographic maker",
    "text to infographic",
    "visual summary generator",
    "notes to infographic",
    "topic to infographic",
    "educational infographic",
    "science infographic",
    "poster generator",
    "AI poster maker",
    "carousel-style visual",
  ],
  alternates: { canonical: pageUrl },
  openGraph: {
    type: "website",
    url: pageUrl,
    siteName: "KnowLens.ai",
    title: "AI Infographic Generator | KnowLens.ai",
    description:
      "Generate infographics, posters, visual summaries, and short explainer videos from text, notes, and topics using KnowLens.",
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
    title: "AI Infographic Generator | Create Infographics & Visual Summaries | KnowLens.ai",
    description:
      "Create infographics, visual summaries, posters, carousel-style visuals, and short explainer videos from topics, notes, or text.",
    images: [`${siteUrl}/picture/text-to-poster.jpg`],
  },
};

const heroImages = [
  { src: "/picture/text-to-poster.jpg", alt: "Infographic examples created from topics and notes" },
  { src: "/en-picture/photosynthesis-infographic-case.jpg", alt: "Photosynthesis infographic created from notes" },
  { src: "/en-picture/astronomy/astronomy-long-infographic.jpg", alt: "Solar system visual summary from topic" },
];

const features = [
  ["Educational Infographics", "Turn lesson topics or study notes into visual infographics.", BookOpen],
  ["Science Infographics", "Explain complex scientific concepts visually.", FlaskConical],
  ["Visual Summaries", "Convert rough notes into structured summary graphics.", Sparkles],
  ["Posters", "Generate poster-style visuals for presentations and social media.", PanelTop],
  ["Carousel-Style Visuals", "Split ideas into multi-section visuals for sharing.", Layers3],
  ["Short Explainer Videos", "Add a dynamic visual layer to key points.", Video],
] as const;

const steps = [
  ["Add Your Input", "Start with a topic, notes, short script, or text."],
  ["Structure Your Idea", "KnowLens organizes content into key points, sections, and visual structure."],
  ["Generate and Download", "Produce an infographic, visual summary, poster, carousel visual, or short explainer video."],
] as const;

const audiences = [
  ["Students", "Create visual study guides from notes and topics.", "Study guides"],
  ["Teachers", "Turn lesson topics into classroom-ready infographics.", "Lesson visuals"],
  ["Science Communicators", "Explain complex topics visually.", "Science communication"],
  ["Content Creators", "Create shareable short visual summaries.", "Social content"],
  ["Small Teams", "Make quick visual outputs without design expertise.", "Team visuals"],
  ["Marketers", "Turn product or campaign text into visual content.", "Campaign visuals"],
] as const;

const examples = [
  {
    title: "Photosynthesis at a Glance",
    description: "An educational infographic that explains how plants turn sunlight into stored energy.",
    tags: ["Educational Infographic", "Science Infographic"],
    image: "/en-picture/photosynthesis-infographic-case.jpg",
    alt: "Photosynthesis educational infographic from notes",
    topic: "Create an infographic explaining photosynthesis, including sunlight, water, carbon dioxide, glucose, oxygen, and why the process matters.",
  },
  {
    title: "Solar System Visual Summary",
    description: "A science visual summary that organizes planets, orbits, and key facts.",
    tags: ["Science Infographic", "Visual Summary"],
    image: "/en-picture/astronomy/astronomy-long-infographic.jpg",
    alt: "Solar system science visual summary",
    topic: "Create a visual summary of the solar system, including planet order, orbit basics, and simple facts for students.",
  },
  {
    title: "Step-by-Step Recipe Poster",
    description: "A poster-style visual that turns a simple process into clear steps.",
    tags: ["Poster", "Text to Infographic"],
    image: "/en-picture/biology/biology-long-infographic.jpg",
    alt: "Step-by-step recipe poster from text",
    topic: "Create a step-by-step poster from plain text that explains a simple recipe with clear sections and visual hierarchy.",
  },
];

const faqItems = [
  ["What is an AI infographic generator?", "It converts topics, notes, or text into infographics, visual summaries, posters, carousel-style visuals, and short explainer videos."],
  ["What inputs are supported?", "You can start with a topic, notes, plain text, rough outline, or short script."],
  ["Do I need design skills?", "No. KnowLens structures content automatically and generates polished visuals."],
  ["Is this only for science?", "No. It works for education, science, products, recipes, and general knowledge."],
  ["Can I create videos?", "Yes. Short explainer videos are supported as an output from text or notes."],
] as const;

const appSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "KnowLens AI Infographic Generator",
  url: pageUrl,
  applicationCategory: "DesignApplication",
  operatingSystem: "Web",
  description: "Create infographics, visual summaries, posters, carousel-style visuals, and short explainer videos from topics, notes, and text.",
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

export default function AiInfographicGeneratorPage() {
  return (
    <MarketingChrome>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-12 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)] lg:items-center lg:pt-16">
        <div className="text-center lg:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm">
            <Sparkles size={14} className="text-blue-600" aria-hidden="true" />
            AI Infographic Generator
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl lg:text-[4rem] lg:leading-[1.05]">
            AI Infographic Generator
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-zinc-600 lg:mx-0">
            Turn topics, notes, or plain text into clear infographics, visual summaries, posters, carousel-style visuals, and short explainer videos in minutes.
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
            No design skills required. Start from your ideas, notes, or text.
          </div>
          <p className="mt-2 text-sm text-zinc-500">Ideal for education, science, presentations, and social sharing.</p>
        </div>

        <div className="rounded-[2rem] border border-zinc-200 bg-white p-3 shadow-[0_24px_60px_rgba(15,23,42,0.10)]">
          <div className="grid gap-3">
            <img src={heroImages[0].src} alt={heroImages[0].alt} width={1003} height={565} className="aspect-video w-full rounded-xl bg-zinc-100 object-cover" loading="eager" />
            <div className="grid grid-cols-2 gap-3">
              {heroImages.slice(1).map((image) => (
                <img key={image.src} src={image.src} alt={image.alt} width={480} height={320} className="aspect-video w-full rounded-xl bg-zinc-100 object-cover" loading="eager" />
              ))}
            </div>
          </div>
          <p className="mt-3 text-center text-xs leading-5 text-zinc-500">Examples generated from topics, notes, and plain text.</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">What is KnowLens?</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-600 sm:text-base">
            KnowLens turns topics, notes, and plain text into infographics, visual summaries, posters, carousel-style visuals, and short explainer videos. It is designed for learning, teaching, and knowledge sharing.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading title="What You Can Create" description="Turn simple text into structured visual content for education, science, and knowledge sharing." />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {features.map(([title, description, Icon]) => (
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
        <SectionHeading eyebrow="HOW IT WORKS" title="Create an Infographic in 3 Steps" description="Start with a topic, notes, or text. KnowLens helps organize the message and create a clear visual output." />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map(([title, description], index) => (
            <article key={title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white">{index + 1}</span>
              <h3 className="mt-4 text-lg font-semibold text-zinc-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
            </article>
          ))}
        </div>
        <div className="mt-7 text-center"><Link href="/app?intent=generate" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white hover:bg-zinc-800">Create an Infographic<ArrowRight size={15} /></Link></div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading title="Who Can Benefit" description="Use KnowLens when an idea needs to become easier to scan, teach, share, or remember." />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {audiences.map(([title, description, tag]) => (
            <article key={title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-zinc-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
              <p className="mt-4 text-xs font-semibold text-emerald-700">{tag}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="examples" className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading title="Examples Made with KnowLens" description="Explore infographic and visual summary examples created from topics, notes, and text prompts." />
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {examples.map((item) => (
            <article key={item.title} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <img src={item.image} alt={item.alt} width={640} height={820} className="h-auto w-full bg-zinc-100 object-contain" loading="lazy" />
              <div className="p-4">
                <div className="flex flex-wrap gap-2">{item.tags.map((tag) => <span key={tag} className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-600">{tag}</span>)}</div>
                <h3 className="mt-3 text-lg font-semibold text-zinc-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{item.description}</p>
                <Link href={`/app?intent=generate&prompt=${encodeURIComponent(item.topic)}`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-950 hover:text-emerald-700">Create Similar<ArrowRight size={14} /></Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
        <SectionHeading title="FAQ" description="Common questions about creating infographics and visual summaries with KnowLens." />
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
          <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">Turn Your Notes or Ideas into Infographics or Videos</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-300">Start with a topic, notes, or plain text. Generate clear, shareable visual content in minutes.</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/app?intent=generate" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-zinc-950 hover:bg-zinc-100">Create an Infographic<ArrowRight size={16} /></Link>
            <Link href="#examples" className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-6 text-sm font-semibold text-white hover:bg-white/10">View Examples</Link>
          </div>
        </div>
      </section>
    </MarketingChrome>
  );
}
