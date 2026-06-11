import type { Metadata } from "next";
import { FocusedLandingPage, type FocusedLandingPageContent } from "@/components/marketing/FocusedLandingPage";

const siteUrl = "https://knowlens.ai";
const pageUrl = `${siteUrl}/ai-information-generator`;
const pageTitle = "AI Information Generator for Clear Knowledge Visuals";

export const metadata: Metadata = {
  title: `${pageTitle} | KnowLens`,
  description:
    "Turn notes, topics, and outlines into clear information visualizations for lessons, science explainers, campaigns, and knowledge sharing.",
  keywords: [
    "AI information generator",
    "information visualization generator",
    "AI infographic generator",
    "visual knowledge generator",
    "educational visual generator",
    "science visualization maker",
    "information design AI",
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
      "Turn notes, topics, and outlines into information visualizations for teaching, publishing, and everyday knowledge work.",
    images: [{ url: `${siteUrl}/picture/text-to-poster.jpg`, width: 1003, height: 565, alt: "KnowLens AI information generator preview" }],
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "Create clear information visualizations from notes, topics, and outlines for lessons, science explainers, campaigns, and knowledge sharing.",
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
    "Create clear information visualizations from notes, topics, and outlines for lessons, science explainers, campaigns, and knowledge sharing.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  audience: {
    "@type": "Audience",
    audienceType: "Teachers, creators, marketers, and small teams",
  },
};

const informationLandingContent: Partial<FocusedLandingPageContent> = {
  pageVariant: "focused_information_generator",
  landingPageType: "information_generator",
  usePublicCases: false,
  hero: {
    eyebrow: "Polished Information Visuals",
    title: pageTitle,
    subtitle:
      "Start with a topic, a few notes, or a rough outline. KnowLens helps turn scattered information into visual knowledge people can understand at a glance.",
    badge: "Useful for lessons, science explainers, campaigns, and public communication",
    primaryCta: "Create an AI Information Image",
    secondaryCta: "See Examples",
    exampleTopic:
      "Create a clean information visualization explaining how plants absorb water and minerals through their roots.",
    image: "/picture/text-to-poster.jpg",
    imageAlt: "Information visualization examples created from written topics and short notes",
  },
  beforeAfter: {
    title: "From Notes to Clear Information Visualization",
    description:
      "Keep the idea simple, choose the most useful structure, and turn key points into a visual people can scan quickly.",
    steps: [
      {
        title: "Source",
        description: "A topic, lesson note, product idea, campaign message, or short outline.",
      },
      {
        title: "Structure",
        description: "Title, sections, key facts, examples, and a clear visual hierarchy.",
      },
      {
        title: "Information Visual",
        description: "A shareable visual for teaching, publishing, presenting, or explaining complex ideas.",
      },
    ],
  },
  formats: [
    { title: "Classroom Visuals", description: "Explain a lesson topic with a title, visual flow, and easy-to-scan facts." },
    { title: "Science Infographics", description: "Turn processes, systems, and cause-effect topics into clearer visuals." },
    { title: "Social Explainers", description: "Make compact visuals for LinkedIn, X, Instagram, and newsletter snippets." },
    { title: "Campaign Visuals", description: "Shape a theme, date, offer, or announcement into a simple information graphic." },
    { title: "Learning Inserts", description: "Create a visual summary that can drop into decks and teaching materials." },
  ],
  examples: [
    {
      title: "Photosynthesis at a Glance",
      image: "/en-picture/biology/biology-infographic-card.jpg",
      outputType: "Biology",
      platform: "Classroom",
      category: "Biology",
      description:
        "Photosynthesis is the process plants use to turn sunlight, water, and carbon dioxide into glucose. Chlorophyll captures light energy, roots deliver water, leaves absorb carbon dioxide, and oxygen is released as a byproduct.",
      topic:
        "Photosynthesis allows plants to turn light into stored energy. Chlorophyll inside leaf cells captures sunlight, roots absorb water from the soil, and carbon dioxide enters the leaves through stomata. These ingredients are used to produce glucose, which helps the plant grow, while oxygen is released into the air. This process is one reason plants are central to food chains and Earth's breathable atmosphere.",
    },
    {
      title: "How a Total Solar Eclipse Happens",
      image: "/en-picture/astronomy/astronomy-infographic-card.jpg",
      outputType: "Astronomy",
      platform: "Social",
      category: "Astronomy",
      description:
        "A total solar eclipse occurs when the Moon passes directly between the Sun and Earth. The Moon's umbra creates a narrow path of totality, while the penumbra produces a partial eclipse across a wider region.",
      topic:
        "A total solar eclipse happens during a new moon when the Moon lines up directly between the Sun and Earth. The Moon blocks the Sun for observers standing inside the umbra, the darkest part of its shadow. People in the surrounding penumbra see only a partial eclipse. Because the Moon's orbit is tilted, this alignment is rare, which is why solar eclipses do not happen every month.",
    },
    {
      title: "Plate Tectonics and Earthquakes",
      image: "/en-picture/geography/geography-infographic-card.jpg",
      outputType: "Earth Science",
      platform: "Lesson",
      category: "Earth Science",
      description:
        "Plate tectonics explains how Earth's outer shell moves in large pieces. Earthquakes occur when stress builds along faults and rocks suddenly slip, sending seismic waves through the ground.",
      topic:
        "Earth's outer shell is divided into tectonic plates that move slowly over time. At convergent boundaries plates collide, at divergent boundaries they separate, and at transform boundaries they slide past each other. When rocks along a fault become locked, stress can build for years or centuries. An earthquake begins when the rocks suddenly slip, releasing energy that travels outward as seismic waves and causes the ground to shake.",
    },
  ],
  personas: [
    { title: "Students", description: "Turn research notes, class topics, or project findings into clear visual information for reports and presentations.", tag: "Reports · Study visuals" },
    { title: "Science Communicators", description: "Explain public science topics with a visual that works for outreach tables, community posts, and awareness campaigns.", tag: "Outreach · Public education" },
    { title: "Teachers", description: "Turn a lesson point into a visual students can revisit after class or use as a quick classroom reference.", tag: "Lessons · Classroom visuals" },
    { title: "Campus Clubs", description: "Create event notices, topic explainers, and activity visuals without starting from a blank layout.", tag: "Events · Club campaigns" },
    { title: "Nonprofits", description: "Make accessible visuals for health, environment, safety, and community education messages.", tag: "Awareness · Community guides" },
    { title: "Small Teams", description: "Summarize a process, product idea, or internal note as a visual people can understand quickly.", tag: "Workflows · Internal notes" },
  ],
  pricing: [
    { title: "More Visuals", description: "Create more information visuals for lessons, posts, and campaigns." },
    { title: "HD Export", description: "Download cleaner visual files for publishing." },
    { title: "Remove Watermark", description: "Use polished visuals for professional sharing." },
    { title: "More Projects", description: "Keep separate information visualization ideas organized as you work." },
  ],
  faq: [
    {
      question: "What is an AI Information Generator?",
      answer:
        "An AI Information Generator turns notes, topics, outlines, and explanations into clear information visuals that are easier to scan, teach, publish, and share.",
    },
    {
      question: "Can I use KnowLens as an AI infographic generator?",
      answer:
        "Yes. KnowLens helps organize a topic into an infographic-style layout with a strong title, clear sections, key facts, labels, and visual hierarchy.",
    },
    {
      question: "What can I turn into an information visualization?",
      answer:
        "You can start with a lesson note, science topic, research summary, campaign message, product idea, event announcement, or short educational explanation.",
    },
    {
      question: "Is this only for classroom visuals?",
      answer:
        "No. It works for students, teachers, science communicators, nonprofits, campus clubs, marketers, and teams that need visual knowledge content.",
    },
    {
      question: "Can I create science information visuals?",
      answer:
        "Yes. It is useful for biology diagrams, astronomy explainers, earth science visuals, health education, environmental topics, and step-by-step science breakdowns.",
    },
    {
      question: "Does it help with social media information graphics?",
      answer:
        "Yes. You can create compact visual explainers for LinkedIn, X, Instagram, newsletters, community posts, and other channels where people need quick context.",
    },
    {
      question: "Do I need graphic design experience?",
      answer:
        "No. Start with the message you want to explain. KnowLens helps shape the structure, visual direction, and information hierarchy before you publish.",
    },
    {
      question: "How is this different from a normal poster maker?",
      answer:
        "A poster maker usually starts with layout. KnowLens starts with the information itself, then turns the idea into a clearer AI-generated visual explanation.",
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
