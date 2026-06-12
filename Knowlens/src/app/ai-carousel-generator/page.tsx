import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, BookOpen, FlaskConical, Layers3, PanelTop, Share2, Sparkles } from "lucide-react";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

const siteUrl = "https://knowlens.ai";
const pageUrl = `${siteUrl}/ai-carousel-generator`;

export const metadata: Metadata = {
  title: { absolute: "AI Carousel Generator | Multi-Slide Infographics & Visual Summaries | KnowLens.ai" },
  description:
    "Transform text, notes, or topics into carousel-style visuals, infographic slides, and visual summaries for social media, presentations, and learning with KnowLens.ai.",
  keywords: [
    "AI carousel generator",
    "carousel slides generator",
    "text to carousel",
    "topic to carousel",
    "notes to carousel",
    "multi-slide visual",
    "visual summary carousel",
    "educational carousel",
    "social media carousel",
    "infographic carousel",
    "AI infographic slides",
  ],
  alternates: { canonical: pageUrl },
  openGraph: {
    type: "website",
    url: pageUrl,
    siteName: "KnowLens.ai",
    title: "AI Carousel Generator | KnowLens.ai",
    description:
      "Generate multi-slide carousel visuals from text, notes, or topics. Perfect for education, social media, and knowledge sharing.",
    images: [
      {
        url: `${siteUrl}/en-picture/astronomy/astronomy-long-infographic.jpg`,
        width: 720,
        height: 1120,
        alt: "Solar system carousel slides from topic",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Carousel Generator | Multi-Slide Infographics & Visual Summaries | KnowLens.ai",
    description:
      "Generate carousel-style visuals, infographic slides, and visual summaries from text, notes, or topics.",
    images: [`${siteUrl}/en-picture/astronomy/astronomy-long-infographic.jpg`],
  },
};

const heroFrames = [
  { src: "/en-picture/astronomy/astronomy-long-infographic.jpg", alt: "Solar system carousel slides from topic" },
  { src: "/en-picture/photosynthesis-infographic-case.jpg", alt: "Photosynthesis carousel slides from notes" },
  { src: "/en-picture/biology/biology-long-infographic.jpg", alt: "Biology visual summary carousel from notes" },
];

const outputTypes = [
  ["Educational Carousel Slides", "Turn lesson ideas into clear slide-by-slide explanations for students and self-study.", BookOpen],
  ["Infographic-Style Slides", "Break one idea into labeled sections, visual hierarchy, and easy-to-scan panels.", Layers3],
  ["Visual Summary Slides", "Convert notes or short explanations into a compact multi-slide summary.", Sparkles],
  ["Social Media Carousels", "Create carousel-style visuals for Instagram, LinkedIn, X/Twitter, and other social feeds.", Share2],
  ["Preview Thumbnails", "Shape key ideas into thumbnail-style visual frames for short explainer planning.", PanelTop],
] as const;

const steps = [
  ["Add Your Text", "Start with a topic, notes, plain text, or a short explanation."],
  ["Structure the Content", "KnowLens organizes the idea into multiple slides, key points, sections, and visual flow."],
  ["Generate and Share", "Produce a ready-to-share carousel for social media, presentations, or learning."],
] as const;

const audiences = [
  ["Students", "Turn study notes and concepts into visual study guides in carousel format."],
  ["Teachers", "Convert lesson topics into multi-slide educational content."],
  ["Science Communicators", "Explain complex concepts across slides with clear visual structure."],
  ["Social Media Creators", "Create carousel posts for LinkedIn, Instagram, X/Twitter, and knowledge-sharing channels."],
  ["Small Teams", "Make quick multi-slide visuals without a designer."],
] as const;

const examples = [
  {
    title: "Solar System Carousel",
    description: "A multi-slide visual summary that explains planets, orbits, and key space facts.",
    tags: ["Science Carousel", "Visual Summary"],
    image: "/en-picture/astronomy/astronomy-long-infographic.jpg",
    alt: "Solar system visual summary carousel",
    prompt:
      "Create a carousel explaining the solar system. Use one slide for the big idea, then slides for planet order, inner and outer planets, orbit basics, and memorable facts.",
  },
  {
    title: "Photosynthesis Learning Carousel",
    description: "An educational carousel that breaks photosynthesis into simple visual steps.",
    tags: ["Educational Carousel", "Science"],
    image: "/en-picture/photosynthesis-infographic-case.jpg",
    alt: "Photosynthesis educational carousel from notes",
    prompt:
      "Create a carousel about photosynthesis. Explain sunlight, water, carbon dioxide, chlorophyll, glucose, oxygen, and why plants are important for life on Earth.",
  },
  {
    title: "Cell Biology Summary",
    description: "A study-friendly carousel that turns biology notes into clear sections.",
    tags: ["Study Guide", "Visual Summary"],
    image: "/en-picture/biology/biology-long-infographic.jpg",
    alt: "Cell biology visual summary carousel from notes",
    prompt:
      "Create a carousel that explains cell structure. Include the nucleus, mitochondria, ribosomes, cell membrane, and how each part supports the cell.",
  },
  {
    title: "Earth Science Carousel",
    description: "A slide-by-slide explanation of landforms, erosion, and changing landscapes.",
    tags: ["Earth Science", "Infographic Slides"],
    image: "/en-picture/geography/geography-long-infographic.jpg",
    alt: "Earth science infographic carousel from topic",
    prompt:
      "Create a carousel about how landscapes change over time. Cover weathering, erosion, deposition, rivers, mountains, and why landforms keep changing.",
  },
  {
    title: "History Timeline Carousel",
    description: "A clear timeline carousel for explaining events and their impact.",
    tags: ["Timeline", "Knowledge Carousel"],
    image: "/en-picture/history/history-infographic-card.jpg",
    alt: "History timeline carousel created from notes",
    prompt:
      "Create a carousel about a major invention in history. Explain the problem it solved, how it spread, and why it changed communication and learning.",
  },
  {
    title: "Everyday Economics Carousel",
    description: "A simple business-style carousel for explaining a practical concept.",
    tags: ["Business Visual", "Social Carousel"],
    image: "/en-picture/economics/economics-infographic-card.jpg",
    alt: "Economics social media carousel from short explanation",
    prompt:
      "Create a carousel explaining inflation in everyday life. Cover prices, purchasing power, wages, savings, and why people notice inflation in daily spending.",
  },
];

const faqItems = [
  ["What is an AI Carousel Generator?", "An AI Carousel Generator turns text, notes, or topics into multi-slide carousel visuals, infographic slides, and visual summaries. KnowLens helps organize the idea into slide-by-slide sections so each point is easier to follow."],
  ["What inputs are supported?", "You can start with a topic, notes, short text, or a short explanation. The best input is a focused idea with the audience and takeaway you want the carousel to explain."],
  ["Can I create educational content?", "Yes. KnowLens can turn classroom lessons, study guides, and educational visual summaries into carousel-style slides for learning and review."],
  ["Can I create science or technical content?", "Yes. You can convert complex concepts into clear multi-slide visuals with sections, labels, and a structured explanation flow."],
  ["Can I create content for social media?", "Yes. The page is designed for Instagram, LinkedIn, X/Twitter, and other platforms where carousel posts help explain ideas across multiple frames."],
  ["How does this differ from a traditional carousel maker?", "Traditional tools require templates and manual layout. KnowLens starts from text, structures the content automatically, and turns the message into a visual carousel."],
  ["Can I create a short explainer from my carousel?", "Currently, KnowLens focuses on carousel slides and thumbnail-style previews for short explainer planning. The carousel itself is built as a visual sequence people can scan quickly."],
  ["Do I need graphic design skills?", "No. KnowLens automatically structures slides with consistent visual hierarchy, sections, and readable summaries, so you can start from a rough idea."],
  ["Can I generate multiple carousels from one topic?", "Yes. You can create variations from the same topic by emphasizing different angles, audiences, examples, or key takeaways."],
  ["How fast is generation?", "Generation usually takes seconds to a few minutes, depending on the length of your text and the number of slides needed for the visual explanation."],
  ["Can I edit slides after generation?", "Minor adjustments to text, color, and layout are possible after generation, so you can refine the carousel before sharing it."],
  ["Is this only for education or social media?", "No. It also works for team presentations, product explanations, marketing content, study materials, and general knowledge topics."],
] as const;

const appSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "KnowLens AI Carousel Generator",
  url: pageUrl,
  applicationCategory: "DesignApplication",
  operatingSystem: "Web",
  description:
    "KnowLens turns topics, notes, or plain text into carousel-style visuals, infographic slides, and multi-slide visual summaries.",
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

export default function AiCarouselGeneratorPage() {
  return (
    <MarketingChrome>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-12 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)] lg:items-center lg:pt-16">
        <div className="text-center lg:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm">
            <Sparkles size={14} className="text-blue-600" aria-hidden="true" />
            SLIDE-LIKE VISUALS
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl lg:text-[4rem] lg:leading-[1.05]">
            AI Carousel Generator for Multi-Part Visuals
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-zinc-600 lg:mx-0">
            Turn text, notes, or topics into carousel-style visuals, multi-slide infographics, and visual summary slides in minutes.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <Link href="/app?intent=generate" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-zinc-950 px-6 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(15,23,42,0.18)] transition hover:bg-zinc-800">
              Create a Carousel
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
        </div>

        <div className="rounded-[2rem] border border-zinc-200 bg-white p-3 shadow-[0_24px_60px_rgba(15,23,42,0.10)]">
          <div className="grid grid-cols-[1.1fr_0.9fr] gap-3">
            <img src={heroFrames[0].src} alt={heroFrames[0].alt} width={720} height={1120} className="h-full max-h-[520px] w-full rounded-xl bg-zinc-100 object-cover object-top" loading="eager" />
            <div className="grid gap-3">
              {heroFrames.slice(1).map((image) => (
                <img key={image.src} src={image.src} alt={image.alt} width={720} height={520} className="aspect-[4/3] w-full rounded-xl bg-zinc-100 object-cover object-top" loading="eager" />
              ))}
            </div>
          </div>
          <p className="mt-3 text-center text-xs leading-5 text-zinc-500">Examples generated from text, notes, and topics.</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">What is KnowLens?</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-600 sm:text-base">
            KnowLens turns topics, notes, or plain text into carousel-style visuals, infographic slides, and multi-slide visual summaries. It is designed for education, social media, and learning.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading title="What You Can Create" description="Turn a single idea into carousel slides people can scan, save, and share." />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {outputTypes.map(([title, description, Icon]) => (
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
        <SectionHeading eyebrow="HOW IT WORKS" title="Create a Carousel in 3 Steps" description="Start with text. KnowLens structures the idea into a multi-slide visual flow." />
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
            Create a Carousel
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading title="Who Benefits" description="Use carousel-style visuals when a topic needs more than one frame but still needs to stay simple." />
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
        <SectionHeading title="Carousel Examples" description="Explore carousel previews created from text, notes, short explanations, and topics." />
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {examples.map((item) => (
            <article key={item.title} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <img src={item.image} alt={item.alt} width={640} height={820} className="h-auto w-full bg-zinc-100 object-contain" loading="lazy" />
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

      <section className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
        <SectionHeading title="Frequently Asked Questions" description="Common questions about creating carousel-style visuals with KnowLens." />
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
          <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">Create Your Carousel or Multi-Slide Visual</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-300">Start with text, notes, or a topic. Generate carousel-style visuals, infographic slides, or visual summaries in minutes.</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/app?intent=generate" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-zinc-950 hover:bg-zinc-100">
              Create a Carousel
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="#examples" className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-6 text-sm font-semibold text-white hover:bg-white/10">View Examples</Link>
          </div>
        </div>
      </section>
    </MarketingChrome>
  );
}
