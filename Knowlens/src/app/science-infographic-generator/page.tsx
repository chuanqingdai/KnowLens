import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Atom,
  Beaker,
  Dna,
  GraduationCap,
  Mountain,
  Orbit,
} from "lucide-react";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

const siteUrl = "https://knowlens.ai";
const pageUrl = `${siteUrl}/science-infographic-generator`;

export const metadata: Metadata = {
  title: { absolute: "Science Infographic Generator | Create Science Infographics with AI | KnowLens.ai" },
  description:
    "Turn science topics, notes, and explanations into clear science infographics, visual summaries, and classroom-ready science visuals with KnowLens.ai.",
  keywords: [
    "science infographic generator",
    "science infographic",
    "AI science infographic generator",
    "science infographic maker",
    "educational science infographic",
    "biology infographic",
    "physics infographic",
    "chemistry infographic",
    "astronomy infographic",
    "earth science infographic",
    "science visual summary",
    "science poster generator",
    "topic to science infographic",
    "notes to science infographic",
    "text to science infographic",
    "classroom science infographic",
    "science diagram infographic",
  ],
  alternates: { canonical: pageUrl },
  openGraph: {
    type: "website",
    url: pageUrl,
    siteName: "KnowLens.ai",
    title: "Science Infographic Generator | KnowLens.ai",
    description:
      "Create science infographics from topics, notes, and plain text. Turn biology, physics, astronomy, chemistry, and earth science ideas into clear visual summaries.",
    images: [
      {
        url: `${siteUrl}/picture/science-infographic.jpg`,
        width: 1003,
        height: 565,
        alt: "Musculoskeletal system science infographic with labeled anatomy",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Science Infographic Generator | Create Science Infographics with AI | KnowLens.ai",
    description:
      "Turn science topics, notes, and explanations into clear science infographics and classroom-ready science visuals.",
    images: [`${siteUrl}/picture/science-infographic.jpg`],
  },
};

const heroPreview = {
  title: "Musculoskeletal System",
  tag: "Science Infographic",
  image: "/picture/science-infographic.jpg",
  alt: "Musculoskeletal system science infographic with labeled anatomy",
  width: 1003,
  height: 565,
} as const;

const scienceVisuals = [
  ["Biology Infographics", "Turn biology topics like photosynthesis, cells, DNA, ecosystems, and human body concepts into visual summaries.", Dna],
  ["Physics Infographics", "Explain forces, motion, energy, waves, electricity, and space concepts with structured visual layouts.", Atom],
  ["Chemistry Infographics", "Create visual explanations for atoms, molecules, reactions, bonds, and lab concepts.", Beaker],
  ["Astronomy Infographics", "Turn astronomy topics into visuals about planets, eclipses, stars, galaxies, and space systems.", Orbit],
  ["Earth Science Infographics", "Explain volcanoes, earthquakes, weather, climate, rocks, oceans, and natural systems with clear sections.", Mountain],
  ["Classroom Science Visuals", "Create science visuals that help students review key ideas and understand complex topics faster.", GraduationCap],
] as const;

const steps = [
  ["Add a Science Topic or Text", "Start with a science topic, study notes, a short explanation, or plain text."],
  ["Structure the Concept", "KnowLens organizes the science idea into sections, key points, labels, and visual hierarchy."],
  ["Generate the Infographic", "Create a science infographic, visual summary, poster-style science visual, or carousel-style science visual."],
] as const;

const promptExamples = [
  "Explain photosynthesis in 5 key steps for middle school students.",
  "Create a science infographic about the water cycle, including evaporation, condensation, and precipitation.",
  "Turn these notes about DNA replication into a clear visual summary.",
  "Explain how volcanoes form and erupt using simple labels and sections.",
  "Create a visual summary of the solar system for a classroom poster.",
  "Explain Newton's laws of motion with examples and simple visuals.",
  "Create a chemistry infographic about atoms, molecules, and chemical bonds.",
  "Make an infographic about ecosystems, food chains, and energy flow.",
  "Explain how a solar eclipse happens using a step-by-step visual layout.",
  "Create an earth science infographic about plate tectonics and earthquakes.",
] as const;

const useCases = [
  ["Students", "Turn science notes and concepts into visual study guides that make review easier before class, exams, or presentations.", "Study guides"],
  ["Teachers", "Create classroom-ready science visuals from lesson topics, short explanations, and key facts students need to remember.", "Classroom visuals"],
  ["Science Communicators", "Explain complex ideas with structured labels, clear sections, and visual summaries built for public understanding.", "Science communication"],
  ["Content Creators", "Turn science topics into shareable educational visuals for social platforms, blogs, and learning newsletters.", "Educational content"],
  ["Tutors", "Create simple science visuals that help learners see steps, systems, comparisons, and cause-and-effect relationships.", "Tutoring aids"],
  ["Learning Teams", "Create quick science posters and knowledge visuals without waiting for design support.", "Learning materials"],
] as const;

const examples = [
  {
    title: "How Solar Storms Create Auroras",
    description: "An astronomy visual summary showing charged particles moving from the Sun toward Earth's magnetic field.",
    tags: ["Astronomy Infographic", "Visual Summary"],
    image: "/en-picture/astronomy/astronomy-long-infographic.jpg",
    alt: "Solar storms science visual summary infographic created with KnowLens",
    width: 941,
    height: 1672,
    topic:
      "Create a science infographic explaining how solar storms create auroras. Show solar flares, charged particles traveling through space, Earth's magnetosphere guiding particles toward the poles, collisions with oxygen and nitrogen, and why the sky glows in different colors.",
  },
  {
    title: "DNA Replication Poster",
    description: "A poster-style science infographic explaining how DNA replication works step by step.",
    tags: ["Biology Infographic", "Science Poster"],
    image: "/en-picture/biology/biology-long-infographic.jpg",
    alt: "DNA replication science infographic with readable labels",
    width: 941,
    height: 1672,
    topic:
      "Turn DNA replication into a clear science infographic. Include helicase unzipping the double helix, template strands, base pairing rules, DNA polymerase building new strands, semiconservative replication, and the result of two matching DNA molecules.",
  },
  {
    title: "Volcano Formation",
    description: "An earth science visual explaining how volcanoes form, build pressure, and erupt.",
    tags: ["Earth Science Infographic", "Science Visual"],
    image: "/en-picture/geography/geography-long-infographic.jpg",
    alt: "Volcano science infographic created from a short explanation",
    width: 941,
    height: 1672,
    topic:
      "Explain how volcanoes form and erupt as an earth science infographic. Include magma formation, pressure building inside a magma chamber, vents, lava flow, ash clouds, eruption types, and how volcanic landforms change over time.",
  },
  {
    title: "Seed Germination at a Glance",
    description: "A biology infographic explaining how a dry seed absorbs water, grows roots, and develops first leaves.",
    tags: ["Biology Infographic", "Educational Visual"],
    image: "/en-picture/photosynthesis-infographic-case.jpg",
    alt: "Seed germination science infographic created from notes",
    width: 1672,
    height: 941,
    topic:
      "Explain seed germination as a clear science infographic for students. Include dry seed, water absorption, swelling, root growth, shoot growth, first leaves, and why water, warmth, and air matter.",
  },
  {
    title: "How Solar Eclipses Happen",
    description: "An astronomy infographic showing how the Sun, Moon, and Earth align to create an eclipse shadow.",
    tags: ["Astronomy Infographic", "Classroom Visual"],
    image: "/en-picture/landscape/1117c95b-ae2a-46e1-9e1a-d86cf24389ff-16x9.png",
    alt: "Solar eclipse astronomy infographic created with KnowLens",
    width: 1600,
    height: 900,
    topic:
      "Create an astronomy infographic explaining how solar eclipses happen. Include the Sun, Moon, Earth, alignment, shadow path, umbra, penumbra, and why eclipses are only visible from some locations.",
  },
  {
    title: "How Roots Absorb Water and Minerals",
    description: "A biology infographic showing root hairs, osmosis, mineral ion uptake, xylem transport, and upward movement through a plant.",
    tags: ["Biology Infographic", "Classroom Visual"],
    image: "/en-picture/plate-tectonics-earthquake-infographic-case.jpg",
    alt: "Root absorption science infographic explaining how roots absorb water and minerals",
    width: 1672,
    height: 941,
    topic:
      "Explain how roots absorb water and minerals as a classroom biology infographic. Include root hairs, osmosis, mineral ions, active transport, xylem, and how water and nutrients move upward through the plant.",
  },
] as const;

const portraitExamples = examples.filter((item) => item.height > item.width);
const landscapeExamples = examples.filter((item) => item.width > item.height);

const whyPoints = [
  ["Readable Labels", "Create science visuals with clear headings, labels, and short text blocks that are easier to scan."],
  ["Structured Concepts", "Organize science topics into steps, systems, comparisons, processes, or key facts."],
  ["Clear Visual Hierarchy", "Emphasize the most important ideas with sections, spacing, titles, and visual grouping."],
  ["Content-First Visuals", "Start from a science explanation or topic instead of a blank canvas."],
  ["Built for Learning", "Create visuals for studying, teaching, reviewing, and sharing science ideas."],
] as const;

const faqItems = [
  ["What is a science infographic generator?", "A science infographic generator turns science topics, notes, or plain text into structured visual summaries. KnowLens helps organize the content into key points, readable labels, and a clear visual hierarchy."],
  ["Can I create science infographics from text?", "Yes. You can start with a science topic, notes, or plain text, and KnowLens can help turn it into a science infographic, visual summary, or poster-style science visual."],
  ["What science topics can I visualize?", "You can create visuals for biology, physics, chemistry, astronomy, earth science, ecosystems, human body concepts, space topics, natural systems, and general science ideas."],
  ["Do I need design skills?", "No. KnowLens helps organize your science explanation into a clear visual layout, so you do not need to start from a blank canvas or design template."],
  ["Can teachers use this for classroom visuals?", "Yes. Teachers can use KnowLens to create classroom-ready science infographics, study visuals, science posters, and visual summaries from lesson topics or notes."],
  ["Can students use it for study guides?", "Yes. Students can turn notes and science concepts into visual study guides that are easier to review."],
  ["Is this only for biology?", "No. KnowLens can help create infographics for biology, physics, chemistry, astronomy, earth science, and other science topics."],
  ["How is KnowLens different from a normal infographic maker?", "A normal infographic maker usually starts with templates. KnowLens starts with your science topic or text, organizes the message, and turns it into structured visual information."],
  ["How is KnowLens different from a generic AI image generator?", "Generic AI image tools often focus on decorative images. KnowLens focuses on structured science visuals with readable labels, clear sections, and infographic-style layouts."],
  ["What should I include in my input?", "For best results, include the science topic, key facts, important steps, examples, and the audience you want to explain it to."],
] as const;

const relatedLinks = [
  ["AI Infographic Generator", "/ai-infographic-generator"],
  ["Infographic Maker", "/infographic-maker"],
  ["Text to Infographic", "/text-to-infographic"],
  ["Infographic Examples", "/infographic-examples"],
  ["AI Poster Generator", "/ai-poster-generator"],
] as const;

const appSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "KnowLens Science Infographic Generator",
  url: pageUrl,
  applicationCategory: "DesignApplication",
  operatingSystem: "Web",
  description:
    "KnowLens turns science topics, notes, and plain text into structured science infographics, visual summaries, and classroom-ready science visuals.",
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

function promptHref(topic: string) {
  return `/app?prompt=${encodeURIComponent(topic)}`;
}

export default function ScienceInfographicGeneratorPage() {
  return (
    <MarketingChrome>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-12 pt-10 sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1fr)] lg:items-center lg:pt-16">
        <div className="text-center lg:text-left">
          <p className="inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 shadow-sm">
            SCIENCE VISUAL LEARNING
          </p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl lg:text-[4rem] lg:leading-[1.05]">
            Science Infographic Generator for Clear Visuals
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-zinc-600 lg:mx-0">
            Turn science topics, notes, or plain text into clear science infographics with readable labels, structured sections, and visual hierarchy.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <Link href="/app?intent=generate" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-zinc-950 px-6 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(15,23,42,0.18)] transition hover:bg-zinc-800">
              Create a Science Infographic
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="#examples" className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-300 bg-white px-6 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50">
              View Examples
            </Link>
          </div>
          <p className="mt-4 text-sm text-zinc-500">Start with notes or a topic. KnowLens structures the visual.</p>
        </div>

        <div className="mx-auto w-full max-w-[640px] lg:mx-0">
          <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <img
              src={heroPreview.image}
              alt={heroPreview.alt}
              width={heroPreview.width}
              height={heroPreview.height}
              className="aspect-[16/9] w-full bg-zinc-50 object-contain"
              loading="eager"
            />
          </article>
        </div>
      </section>

      <section id="examples" className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading title="Science Infographic Examples" description="Explore science infographics and visual summaries created from topics, notes, and short text prompts." />
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {portraitExamples.map((item) => (
            <article key={item.title} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
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
                <Link href={promptHref(item.topic)} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-950 hover:text-emerald-700">
                  Create Similar
                  <ArrowRight size={14} />
                </Link>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {landscapeExamples.map((item) => (
            <article key={item.title} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
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
                <Link href={promptHref(item.topic)} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-950 hover:text-emerald-700">
                  Create Similar
                  <ArrowRight size={14} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">What is a Science Infographic Generator?</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-600 sm:text-base">
            A science infographic generator helps turn science topics, notes, and explanations into structured visual summaries. KnowLens organizes the content into key points, readable labels, clear sections, and visual hierarchy so the concept is easier to understand and share.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading title="Create Science Infographics for Clear Learning" description="Use KnowLens to turn science ideas into structured visuals for studying, teaching, explaining, and sharing." />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {scienceVisuals.map(([title, description, Icon]) => (
            <article key={title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                <Icon size={22} aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-zinc-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading eyebrow="HOW IT WORKS" title="Create a Science Infographic in 3 Steps" description="Start with a science topic or explanation. KnowLens helps organize the idea into a clear visual structure." />
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
            Create a Science Infographic
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading title="Science Topics You Can Turn into Infographics" description="Start with a complete explanation or a short topic. Add key points, steps, facts, or examples for better results." />
        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {promptExamples.map((prompt, index) => (
            <Link key={prompt} href={promptHref(prompt)} className="group rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
              <span className="text-xs font-semibold text-emerald-700">Prompt {index + 1}</span>
              <p className="mt-2 text-sm leading-6 text-zinc-700">{prompt}</p>
            </Link>
          ))}
        </div>
        <p className="mx-auto mt-5 max-w-3xl text-center text-sm leading-6 text-zinc-600">
          For best results, include the audience, key facts, steps, and examples you want to show in the infographic.
        </p>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading title="Built for Science Learning and Communication" description="Use the science infographic generator when a complex idea needs to become clear, visual, and easy to review." />
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
        <SectionHeading title="Designed for Readable Science Infographics" description="KnowLens is built for visual explanation, not generic AI art." />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {whyPoints.map(([title, description]) => (
            <article key={title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-zinc-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
        <SectionHeading title="FAQ" description="Common questions about creating science infographics with KnowLens." />
        <div className="mt-8 divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white">
          {faqItems.map(([question, answer]) => (
            <details key={question} className="group p-5">
              <summary className="cursor-pointer list-none text-base font-semibold text-zinc-950">{question}</summary>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <SectionHeading title="Related Infographic Tools" description="Explore nearby KnowLens tools for turning text and topics into structured visuals." />
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {relatedLinks.map(([label, href]) => (
            <Link key={href} href={href} className="inline-flex h-10 items-center rounded-full border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950">
              {label}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <div className="rounded-[2rem] bg-zinc-950 px-6 py-12 text-center text-white sm:px-10">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">Create a Clear Science Infographic</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-300">
            Start with a science topic, notes, or plain text. Generate a structured science infographic, visual summary, or poster-style visual in minutes.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/app?intent=generate" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-zinc-950 hover:bg-zinc-100">
              Create a Science Infographic
              <ArrowRight size={16} />
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
