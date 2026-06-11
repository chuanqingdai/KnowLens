import type { Metadata } from "next";
import { FocusedLandingPage, type FocusedLandingPageContent } from "@/components/marketing/FocusedLandingPage";

const siteUrl = "https://knowlens.ai";
const pageUrl = `${siteUrl}/ai-information-generator`;
const pageTitle = "AI Infographic Generator & Infographic Maker";

export const metadata: Metadata = {
  title: "AI Infographic Generator & Infographic Maker | KnowLens",
  description:
    "Create infographics from topics, notes, outlines, and plain text with KnowLens. Turn ideas into visual summaries, posters, carousel-style graphics, and clear knowledge visuals in minutes.",
  keywords: [
    "AI infographic generator",
    "infographic maker",
    "infographic generator",
    "text to infographic",
    "notes to infographic",
    "topic to infographic",
    "visual summary generator",
    "AI poster generator",
    "AI carousel generator",
  ],
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    type: "website",
    url: pageUrl,
    siteName: "KnowLens.ai",
    title: pageTitle,
    description:
      "Create infographics from topics, notes, outlines, and plain text with KnowLens.",
    images: [{ url: `${siteUrl}/picture/text-to-poster.jpg`, width: 1003, height: 565, alt: "AI-generated infographic examples for science, education, and visual summaries" }],
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "Turn ideas into visual summaries, posters, carousel-style graphics, and clear knowledge visuals in minutes.",
    images: [`${siteUrl}/picture/text-to-poster.jpg`],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: `KnowLens ${pageTitle}`,
  url: pageUrl,
  applicationCategory: "DesignApplication",
  operatingSystem: "Web",
  description:
    "Create infographics from topics, notes, outlines, and plain text for education, science, social content, and knowledge sharing.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  audience: {
    "@type": "Audience",
    audienceType: "Students, teachers, content creators, science communicators, and small teams",
  },
};

const informationLandingContent: Partial<FocusedLandingPageContent> = {
  pageVariant: "focused_information_generator",
  landingPageType: "information_generator",
  usePublicCases: false,
  hero: {
    eyebrow: "AI Infographic Generator",
    title: pageTitle,
    subtitle:
      "Start with a topic, notes, or plain text. KnowLens turns your ideas into clear infographics, posters, and visual summaries in minutes.",
    badge: "No design skills needed. Just describe what you want to explain.",
    primaryCta: "Create an Infographic",
    secondaryCta: "View Examples",
    exampleTopic:
      "Create an infographic explaining how plants absorb water and minerals through their roots.",
    image: "/picture/text-to-poster.jpg",
    imageAlt: "AI-generated infographic examples for science, education, and visual summaries",
  },
  beforeAfter: {
    title: "From Ideas to Clear Infographics",
    description:
      "Start with a topic, notes, or rough outline. KnowLens helps structure your message and turn it into a polished visual.",
    steps: [
      {
        title: "Add Your Idea",
        description: "Start with a topic, notes, plain text, or a rough outline.",
      },
      {
        title: "Shape the Message",
        description: "KnowLens organizes your idea into key points, sections, and visual structure.",
      },
      {
        title: "Generate the Visual",
        description: "Create a polished infographic, poster, or carousel-style visual.",
      },
    ],
  },
  formats: [
    { title: "Topic to Infographic", description: "Describe a topic and turn it into a clear visual explanation." },
    { title: "Notes to Visual Summary", description: "Turn messy notes into structured visual content." },
    { title: "Text to Infographic", description: "Paste text and generate an infographic-style visual." },
    { title: "Educational Infographics", description: "Create classroom-ready visuals for concepts, lessons, and study notes." },
    { title: "Social Visuals", description: "Generate poster and carousel-style visuals for sharing." },
  ],
  examples: [
    {
      title: "Photosynthesis at a Glance",
      image: "/en-picture/biology/biology-infographic-card.jpg",
      outputType: "Topic to Infographic",
      platform: "Classroom",
      category: "Science Infographic",
      description:
        "Photosynthesis is the process plants use to turn sunlight, water, and carbon dioxide into glucose. Chlorophyll captures light energy, roots deliver water, leaves absorb carbon dioxide, and oxygen is released as a byproduct.",
      topic:
        "Photosynthesis allows plants to turn light into stored energy. Chlorophyll inside leaf cells captures sunlight, roots absorb water from the soil, and carbon dioxide enters the leaves through stomata. These ingredients are used to produce glucose, which helps the plant grow, while oxygen is released into the air. This process is one reason plants are central to food chains and Earth's breathable atmosphere.",
    },
    {
      title: "How a Total Solar Eclipse Happens",
      image: "/en-picture/astronomy/astronomy-infographic-card.jpg",
      outputType: "Educational Visual",
      platform: "Social",
      category: "Visual Summary",
      description:
        "A total solar eclipse occurs when the Moon passes directly between the Sun and Earth. The Moon's umbra creates a narrow path of totality, while the penumbra produces a partial eclipse across a wider region.",
      topic:
        "A total solar eclipse happens during a new moon when the Moon lines up directly between the Sun and Earth. The Moon blocks the Sun for observers standing inside the umbra, the darkest part of its shadow. People in the surrounding penumbra see only a partial eclipse. Because the Moon's orbit is tilted, this alignment is rare, which is why solar eclipses do not happen every month.",
    },
    {
      title: "Plate Tectonics and Earthquakes",
      image: "/en-picture/geography/geography-infographic-card.jpg",
      outputType: "Poster",
      platform: "Lesson",
      category: "Topic to Infographic",
      description:
        "Plate tectonics explains how Earth's outer shell moves in large pieces. Earthquakes occur when stress builds along faults and rocks suddenly slip, sending seismic waves through the ground.",
      topic:
        "Earth's outer shell is divided into tectonic plates that move slowly over time. At convergent boundaries plates collide, at divergent boundaries they separate, and at transform boundaries they slide past each other. When rocks along a fault become locked, stress can build for years or centuries. An earthquake begins when the rocks suddenly slip, releasing energy that travels outward as seismic waves and causes the ground to shake.",
    },
  ],
  personas: [
    { title: "Students", description: "Turn study notes and concepts into visual study guides.", tag: "Study notes · Visual guides" },
    { title: "Teachers", description: "Create educational infographics from lesson topics and outlines.", tag: "Lessons · Classroom visuals" },
    { title: "Content Creators", description: "Turn ideas and explanations into social visuals.", tag: "Social posts · Carousels" },
    { title: "Science Communicators", description: "Explain complex topics with clear visual summaries.", tag: "Science · Public education" },
    { title: "Small Teams", description: "Create quick posters and knowledge visuals without design work.", tag: "Posters · Knowledge visuals" },
  ],
  pricing: [
    { title: "More Infographics", description: "Create more visual summaries, posters, and carousel-style graphics." },
    { title: "HD Export", description: "Download cleaner visual files for publishing." },
    { title: "Remove Watermark", description: "Use polished visuals for professional sharing." },
    { title: "More Projects", description: "Keep separate infographic ideas organized as you work." },
  ],
  faq: [
    {
      question: "What is an AI infographic generator?",
      answer:
        "An AI infographic generator turns topics, notes, outlines, or plain text into visual infographics. KnowLens helps structure your message and generate a clear visual summary.",
    },
    {
      question: "Can I use KnowLens as an infographic maker?",
      answer:
        "Yes. You can use KnowLens to create educational infographics, science visuals, posters, visual summaries, and carousel-style graphics.",
    },
    {
      question: "What can I use as input?",
      answer:
        "You can start with a topic, notes, a short explanation, or plain text. PDF and report uploads are not required for the current workflow.",
    },
    {
      question: "Does KnowLens support PDF or report uploads?",
      answer:
        "Not yet. The current version focuses on topic, notes, and text input. PDF and report support may be added later.",
    },
    {
      question: "Is KnowLens only for science infographics?",
      answer:
        "No. You can create visuals for education, science, business ideas, product explanations, recipes, study notes, and social content.",
    },
    {
      question: "Do I need design experience?",
      answer:
        "No. Start with your idea or notes, and KnowLens helps turn them into a clear visual layout.",
    },
    {
      question: "How is this different from a normal poster maker?",
      answer:
        "A normal poster maker starts with design templates. KnowLens starts with your content, extracts the message, and turns it into structured visual information.",
    },
  ],
};

export default function AiInformationGeneratorPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <FocusedLandingPage content={informationLandingContent} />
    </>
  );
}
