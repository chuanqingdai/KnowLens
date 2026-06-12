import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, BookOpen, FlaskConical, Layers3, Play, Sparkles, Video } from "lucide-react";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

const siteUrl = "https://knowlens.ai";
const pageUrl = `${siteUrl}/text-to-video-ai`;

export const metadata: Metadata = {
  title: { absolute: "Text to Video | Create Short Educational Videos | KnowLens.ai" },
  description:
    "Turn your ideas, notes, or text into short educational videos, science explainers, and visual summary clips in minutes. Perfect for classrooms, online learning, and knowledge sharing.",
  keywords: ["text to video", "short explainer video", "educational video", "science explainer video", "topic to video", "notes to video", "text-based video", "visual summary video", "infographic video", "knowledge video"],
  alternates: { canonical: pageUrl },
  openGraph: {
    type: "website",
    url: pageUrl,
    siteName: "KnowLens.ai",
    title: "Text to Video | KnowLens.ai",
    description: "Generate short explainer videos from topics, notes, or text. Create educational and science visual summary videos easily.",
    images: [{ url: `${siteUrl}/picture/ai-explainer-videos.jpg`, width: 1003, height: 565, alt: "Educational text to video examples from notes and topics" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Text to Video | Create Short Educational Videos | KnowLens.ai",
    description: "Turn text, notes, and topics into short educational and science explainer videos.",
    images: [`${siteUrl}/picture/ai-explainer-videos.jpg`],
  },
};

const featureCards = [
  { title: "Educational Videos", description: "Convert lesson topics or study notes into short videos.", image: "/en-picture/biology/biology-infographic-card.jpg", alt: "Photosynthesis educational video from notes" },
  { title: "Science Explainers", description: "Create visual explanations for physics, biology, chemistry, or astronomy concepts.", image: "/en-picture/astronomy/astronomy-infographic-card.jpg", alt: "Solar system explainer video from topic text" },
  { title: "Visual Summary Clips", description: "Highlight key points in short video form.", image: "/en-picture/geography/geography-infographic-card.jpg", alt: "Water cycle short video for educational use" },
  { title: "Social Media Shorts", description: "Make 15-60 second videos optimized for sharing.", image: "/picture/dna-video-script-case.jpg", alt: "Science short video scene for social media learning" },
  { title: "Script-to-Video", description: "Turn a short script or outline into a visual explainer video.", image: "/picture/black-hole-video-visual-case.jpg", alt: "Black hole explainer video scene from a short script" },
  { title: "Topic-to-Video", description: "Describe a topic and produce a clear, visual explanation.", image: "/picture/immune-mechanism-infographic-case.jpg", alt: "Immune system topic to video visual summary" },
];

const steps = [
  ["Add Your Text", "Start with a topic, notes, short script, or plain text."],
  ["Structure Your Message", "KnowLens organizes text into key points, scenes, captions, and visual flow."],
  ["Generate and Download", "Produce a short explainer video with visual scenes and clear narration."],
];

const audiences = [
  { title: "Students", description: "Create short study videos from notes and topics.", tag: "Study videos", Icon: BookOpen },
  { title: "Teachers", description: "Generate classroom-ready explainer videos from lesson content.", tag: "Classroom videos", Icon: BookOpen },
  { title: "Science Communicators", description: "Turn complex topics into clear visual explanations.", tag: "Science explainers", Icon: FlaskConical },
  { title: "Content Creators", description: "Produce short knowledge clips for social media.", tag: "Knowledge clips", Icon: Video },
  { title: "Small Teams", description: "Quickly generate educational or science explainer videos without editing skills.", tag: "Team learning", Icon: Layers3 },
];

const examples = [
  { title: "Photosynthesis in 45 Seconds", description: "A classroom-friendly video that explains how plants turn sunlight into energy.", tags: ["Educational Video", "Visual Summary"], image: "/en-picture/photosynthesis-infographic-case.jpg", alt: "Photosynthesis educational video from notes", topic: "Create a short educational video explaining photosynthesis for students, including sunlight, water, carbon dioxide, glucose, and oxygen." },
  { title: "Solar System Basics", description: "A science explainer that turns planet order and orbit concepts into clear visual scenes.", tags: ["Science Explainer", "Topic to Video"], image: "/en-picture/astronomy/astronomy-long-infographic.jpg", alt: "Solar system explainer video for learning", topic: "Create a short science explainer video about the solar system, planet order, orbits, and why planets move around the Sun." },
  { title: "Water Cycle Overview", description: "A visual summary video about evaporation, condensation, precipitation, and collection.", tags: ["Short Explainer Video", "Science Video"], image: "/en-picture/geography/geography-long-infographic.jpg", alt: "Water cycle visual summary video", topic: "Create a short educational video explaining the water cycle with evaporation, condensation, precipitation, and collection." },
];

const faqItems = [
  ["What is Text to Video AI?", "Text to Video AI turns text, notes, or scripts into short educational or science explainer videos."],
  ["Can I generate videos from notes?", "Yes. Add notes or text to create short visual videos for learning, teaching, or knowledge sharing."],
  ["Do I need editing skills?", "No. KnowLens structures the content and generates the video flow automatically."],
  ["What inputs are supported?", "You can start with a topic, notes, text, rough outline, or short script."],
  ["Is this only for science?", "No. It works for general educational content as well as science topics."],
];

const appSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "KnowLens Text to Video",
  url: pageUrl,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web",
  description: "Turn text, notes, topics, or short scripts into educational videos and science explainer videos.",
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

function FrameImage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-zinc-100">
      <img src={src} alt={alt} width={640} height={360} className="aspect-video w-full object-cover" loading="lazy" />
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/45 via-transparent to-transparent" aria-hidden="true" />
      <span className="absolute bottom-3 left-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-zinc-950">
        <Play size={14} fill="currentColor" aria-hidden="true" />
      </span>
    </div>
  );
}

export default function TextToVideoAiPage() {
  return (
    <MarketingChrome>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-12 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)] lg:items-center lg:pt-16">
        <div className="text-center lg:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm"><Sparkles size={14} className="text-blue-600" />PROMPT TO SHORT CLIP</div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl lg:text-[4rem] lg:leading-[1.05]">Text to Video AI for Short Videos</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-zinc-600 lg:mx-0">Turn topics, notes, or short scripts into concise educational or science explainer videos.</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <Link href="/app?intent=generate" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-zinc-950 px-6 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(15,23,42,0.18)] transition hover:bg-zinc-800">Create a Video<ArrowRight size={16} /></Link>
            <Link href="#examples" className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-300 bg-white px-6 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50">View Examples</Link>
          </div>
          <div className="mt-5 inline-flex items-center gap-2 text-sm text-zinc-600"><BadgeCheck size={16} className="text-emerald-600" />No editing skills needed. Provide your topic or text and get a structured visual explanation.</div>
          <p className="mt-2 text-sm text-zinc-500">For classrooms, online courses, and knowledge sharing.</p>
        </div>
        <div className="rounded-[2rem] border border-zinc-200 bg-white p-3 shadow-[0_24px_60px_rgba(15,23,42,0.10)]">
          <div className="grid gap-3"><FrameImage src="/picture/ai-explainer-videos.jpg" alt="Photosynthesis educational video from notes" /><div className="grid grid-cols-2 gap-3"><FrameImage src="/en-picture/astronomy/astronomy-infographic-card.jpg" alt="Solar system explainer video from topic text" /><FrameImage src="/en-picture/geography/geography-infographic-card.jpg" alt="Water cycle short video for educational use" /></div></div>
          <p className="mt-3 text-center text-xs leading-5 text-zinc-500">Examples generated from topics, notes, and text prompts.</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading title="What You Can Create" description="Transform text into educational or science explainer videos with visual summaries." />
        <div className="mt-8 grid gap-4 md:grid-cols-2">{featureCards.map((item) => <article key={item.title} className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-[160px_minmax(0,1fr)]"><FrameImage src={item.image} alt={item.alt} /><div><h3 className="text-lg font-semibold text-zinc-950">{item.title}</h3><p className="mt-2 text-sm leading-6 text-zinc-600">{item.description}</p></div></article>)}</div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading eyebrow="HOW IT WORKS" title="Create a Short Video in 3 Steps" description="Start with text. KnowLens turns your message into scenes, captions, and a clear visual flow." />
        <div className="mt-8 grid gap-4 md:grid-cols-3">{steps.map(([title, description], index) => <article key={title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"><span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white">{index + 1}</span><h3 className="mt-4 text-lg font-semibold text-zinc-950">{title}</h3><p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p></article>)}</div>
        <div className="mt-7 text-center"><Link href="/app?intent=generate" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white hover:bg-zinc-800">Create a Video<ArrowRight size={15} /></Link></div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading title="Built for Educators, Students, and Knowledge Creators" description="Create short study videos, classroom explainers, and knowledge clips from the text you already have." />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-5">{audiences.map(({ title, description, tag, Icon }) => <article key={title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100"><Icon size={19} /></span><h3 className="mt-4 text-lg font-semibold text-zinc-950">{title}</h3><p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p><p className="mt-4 text-xs font-semibold text-blue-700">{tag}</p></article>)}</div>
      </section>

      <section id="examples" className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading title="Text-to-Video Examples" description="Explore short educational video ideas generated from topics, notes, and text prompts." />
        <div className="mt-8 grid gap-5 md:grid-cols-3">{examples.map((item) => <article key={item.title} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"><FrameImage src={item.image} alt={item.alt} /><div className="p-4"><div className="flex flex-wrap gap-2">{item.tags.map((tag) => <span key={tag} className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-600">{tag}</span>)}</div><h3 className="mt-3 text-lg font-semibold text-zinc-950">{item.title}</h3><p className="mt-2 text-sm leading-6 text-zinc-600">{item.description}</p><Link href={`/app?intent=generate&prompt=${encodeURIComponent(item.topic)}`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-950 hover:text-blue-700">Create Similar<ArrowRight size={14} /></Link></div></article>)}</div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
        <SectionHeading title="FAQ" description="Common questions about turning text into short educational videos." />
        <div className="mt-8 divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white">{faqItems.map(([question, answer]) => <details key={question} className="group p-5"><summary className="cursor-pointer list-none text-base font-semibold text-zinc-950">{question}</summary><p className="mt-3 text-sm leading-6 text-zinc-600">{answer}</p></details>)}</div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <div className="rounded-[2rem] bg-zinc-950 px-6 py-12 text-center text-white sm:px-10"><h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">Turn Your Text into a Short Video</h2><p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-300">Start with a topic, notes, or text to produce educational, science, or visual summary videos.</p><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/app?intent=generate" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-zinc-950 hover:bg-zinc-100">Create a Video<ArrowRight size={16} /></Link><Link href="#examples" className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-6 text-sm font-semibold text-white hover:bg-white/10">View Examples</Link></div></div>
      </section>
    </MarketingChrome>
  );
}
