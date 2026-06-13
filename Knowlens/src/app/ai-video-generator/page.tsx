import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, BookOpen, FlaskConical, Play, Sparkles, Video } from "lucide-react";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

const siteUrl = "https://knowlens.ai";
const pageUrl = `${siteUrl}/ai-video-generator`;

export const metadata: Metadata = {
  title: {
    absolute: "AI Video Generator for Science & Educational Videos | KnowLens.ai",
  },
  description:
    "Turn topics, notes, or plain text into short explainer videos with infographic overlays and visual summaries for education and science with KnowLens.",
  keywords: [
    "AI video generator",
    "short explainer video",
    "science explainer video",
    "educational video generator",
    "AI infographic video",
    "topic to video",
    "notes to video",
    "visual summary video",
  ],
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    type: "website",
    url: pageUrl,
    siteName: "KnowLens.ai",
    title: "AI Video Generator for Science & Educational Videos | KnowLens.ai",
    description:
      "Turn topics, notes, or plain text into short explainer videos with infographic overlays and visual summaries for education and science.",
    images: [
      {
        url: `${siteUrl}/picture/ai-explainer-videos.jpg`,
        width: 1003,
        height: 565,
        alt: "AI-generated science and educational explainer video examples from topics and notes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Video Generator for Science & Educational Videos | KnowLens.ai",
    description:
      "Create short educational videos from topics, notes, and plain text with infographic overlays and visual summaries.",
    images: [`${siteUrl}/picture/explainer-videos-hero.jpg`],
  },
};

const featureCards = [
  {
    title: "Science Explainers",
    description: "Turn physics, biology, chemistry, or astronomy topics into short explainer videos.",
    image: "/en-picture/astronomy/astronomy-infographic-card.jpg",
    alt: "Astronomy science explainer video frame generated from topic notes",
  },
  {
    title: "Educational Tutorials",
    description: "Convert lesson topics or study notes into visually engaging short videos.",
    image: "/en-picture/biology/biology-infographic-card.jpg",
    alt: "Biology lesson short video generated with AI from study notes",
  },
  {
    title: "Infographic Overlay Videos",
    description: "Add infographic-style visual summaries to video content.",
    image: "/en-picture/geography/geography-infographic-card.jpg",
    alt: "Earth science explainer video with infographic overlay generated from text",
  },
  {
    title: "Social Short Videos",
    description: "Create 15-60 second clips suitable for social media or classroom sharing.",
    image: "/en-picture/photosynthesis-infographic-case.jpg",
    alt: "Plant science short explainer video thumbnail for social sharing",
  },
  {
    title: "Carousel-Style Visual Videos",
    description: "Split a topic into multiple scenes with key points and visuals.",
    image: "/en-picture/history/history-infographic-card.jpg",
    alt: "History visual summary video split into educational scenes",
  },
];

const steps = [
  {
    title: "Add a Topic, Text, or Notes",
    description: "Start from an idea, lesson topic, notes, or short explanation.",
  },
  {
    title: "Choose a Visual Direction",
    description: "KnowLens converts your content into video scenes, highlights key points, and overlays infographics.",
  },
  {
    title: "Generate and Download",
    description: "Produce a short explainer video with visual summaries.",
  },
];

const audiences = [
  { title: "Students", description: "Create visual study guides and quick science explainer clips.", tag: "Study guides" },
  { title: "Teachers", description: "Transform lesson topics or class notes into classroom-ready explainer videos.", tag: "Lesson videos" },
  { title: "Science Communicators", description: "Turn complex topics into simple, clear visual explanations.", tag: "Science explainers" },
  { title: "Content Creators", description: "Produce short educational video clips for social media.", tag: "Short-form content" },
  { title: "Small Teams", description: "Make quick explainer videos without a design team.", tag: "Team explainers" },
];

const examples = [
  {
    title: "How Gravity Shapes Orbits",
    description: "A physics explainer showing how gravity bends motion into stable orbital paths.",
    tags: ["Science Explainer", "Short Explainer Video"],
    image: "/en-picture/astronomy/astronomy-long-infographic.jpg",
    alt: "Physics explainer video generated from text with infographic overlays",
    topic:
      "Explain how gravity shapes orbits using a simple example of a planet moving around a star. Include the role of forward motion, gravitational pull, and why objects can keep falling around each other instead of crashing immediately.",
  },
  {
    title: "Inside a Plant Cell",
    description: "A biology lesson clip that explains the nucleus, chloroplasts, mitochondria, and cell membrane.",
    tags: ["Educational Video", "Visual Summary"],
    image: "/en-picture/biology/biology-long-infographic.jpg",
    alt: "Biology lesson short video generated with AI",
    topic:
      "Create a short biology explainer about the main parts of a plant cell, including the nucleus, chloroplasts, mitochondria, cell wall, and cell membrane. Keep the explanation clear for students.",
  },
  {
    title: "Why Eclipses Happen",
    description: "An astronomy visual summary clip about the Sun, Moon, Earth, shadow, and alignment.",
    tags: ["Science Explainer", "Visual Summary"],
    image: "/en-picture/astronomy/astronomy-infographic-card.jpg",
    alt: "Astronomy visual summary clip created from topic notes",
    topic:
      "Explain why solar eclipses happen. Show how the Sun, Moon, and Earth align, what the umbra and penumbra are, and why eclipses do not happen every month.",
  },
];

const faqItems = [
  {
    question: "What is an AI video generator?",
    answer:
      "An AI video generator turns topics, notes, or plain text into short educational or science explainer videos with visual summaries.",
  },
  {
    question: "Can I generate videos from study notes?",
    answer: "Yes. KnowLens converts notes into visual short videos for learning, review, and classroom sharing.",
  },
  {
    question: "Do I need design experience?",
    answer: "No. KnowLens automatically structures content and adds infographic-style visual overlays.",
  },
  {
    question: "What inputs are supported?",
    answer: "You can start with a topic, notes, plain text, rough outlines, or short explanations.",
  },
  {
    question: "Can I generate long videos?",
    answer: "KnowLens currently supports short explainer videos, usually around 15-60 seconds. Longer videos are not supported in this flow.",
  },
  {
    question: "Is this only for science?",
    answer: "No. It works for science, education, general knowledge, product ideas, and other topics that benefit from visual explanation.",
  },
];

const webApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "KnowLens AI Video Generator",
  url: pageUrl,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web",
  description:
    "Turn topics, notes, or plain text into short explainer videos with infographic overlays and visual summaries for education and science.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  audience: {
    "@type": "Audience",
    audienceType: "Students, teachers, science communicators, content creators, and small teams",
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

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{eyebrow}</p> : null}
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">{title}</h2>
      <p className="mt-3 text-base leading-7 text-zinc-600">{description}</p>
    </div>
  );
}

function VideoThumb({ image, alt }: { image: string; alt: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-zinc-100">
      <img src={image} alt={alt} className="aspect-video h-full w-full object-cover" loading="lazy" />
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/55 via-transparent to-transparent" aria-hidden="true" />
      <span className="absolute bottom-3 left-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-zinc-950 shadow-sm">
        <Play size={15} fill="currentColor" aria-hidden="true" />
      </span>
    </div>
  );
}

export default function AiVideoGeneratorPage() {
  return (
    <MarketingChrome>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webApplicationSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <section className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-12 pt-10 text-center sm:px-6 lg:pt-16">
        <div className="mx-auto max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm">
            <Sparkles size={14} className="text-blue-600" aria-hidden="true" />
            TEXT TO VISUAL MOTION
          </div>
          <h1 className="mx-auto mt-6 max-w-5xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl lg:text-[4rem] lg:leading-[1.05]">
            AI Video Generator for Short Stories
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-zinc-600">
            Turn topics, notes, or plain text into short explainer videos with infographic overlays and visual summaries in minutes.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/app?intent=generate"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-zinc-950 px-6 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(15,23,42,0.18)] transition hover:bg-zinc-800"
            >
              Create a Video
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
            No design experience required. Just describe the topic or idea.
          </div>
        </div>

        <div className="mt-10 w-full max-w-4xl rounded-[2rem] border border-zinc-200 bg-white p-3 shadow-[0_24px_60px_rgba(15,23,42,0.10)]">
          <img
            src="/picture/ai-explainer-videos.jpg"
            alt="AI-generated science and educational explainer video examples from topics and notes"
            width={1003}
            height={565}
            className="aspect-[1003/565] w-full rounded-[1.35rem] bg-zinc-100 object-cover"
            loading="eager"
          />
          <p className="mt-3 text-center text-xs leading-5 text-zinc-500">
            Generated with KnowLens from short topics, notes, and plain text.
          </p>
        </div>
      </section>

      <section id="examples" className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading
          title="AI-Generated Short Videos"
          description="Explore examples generated from topics, notes, and short text prompts."
        />
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {examples.map((item) => (
            <article key={item.title} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <VideoThumb image={item.image} alt={item.alt} />
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
                <Link href={`/app?intent=generate&prompt=${encodeURIComponent(item.topic)}`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-950 hover:text-blue-700">
                  Create Similar
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading
          title="What You Can Create"
          description="Transform text into educational videos, science explainers, and visual summaries."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {featureCards.map((item) => (
            <article key={item.title} className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-[160px_minmax(0,1fr)]">
              <VideoThumb image={item.image} alt={item.alt} />
              <div>
                <h3 className="text-lg font-semibold text-zinc-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{item.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading
          eyebrow="HOW IT WORKS"
          title="Create a Short Educational Video in 3 Simple Steps"
          description="Start with text. KnowLens helps organize the message and generate a clear visual output."
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
            Create a Video
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading
          title="Built for Educators, Students, and Science Communicators"
          description="Quickly turn educational content into engaging short videos."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {audiences.map((item) => (
            <article key={item.title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                {/science/i.test(item.title) ? <FlaskConical size={19} /> : /teacher|student/i.test(item.title) ? <BookOpen size={19} /> : <Video size={19} />}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-zinc-950">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{item.description}</p>
              <p className="mt-4 text-xs font-semibold text-blue-700">{item.tag}</p>
            </article>
          ))}
        </div>
      </section>

            <section className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
        <SectionHeading title="FAQ" description="Common questions about creating short educational videos with KnowLens." />
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
          <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">Turn Your Topic into a Short Video</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-300">
            Start with a topic, notes, or plain text. Generate educational and science explainer videos in minutes.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/app?intent=generate" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-zinc-950 hover:bg-zinc-100">
              Create a Video
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
