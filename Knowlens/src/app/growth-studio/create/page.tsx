"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, FileText, FolderOpen, Home as HomeIcon, Menu, Search, TrendingUp, UserCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { SidebarNav } from "@/components/app-shell/SidebarNav";

type ContentSourceType = "theme" | "topics" | "text" | "trends";
type TopicStatus = "Draft" | "Queued" | "Used" | "Skipped" | "Archived";

type GrowthWorkflow = {
  id: string;
  name: string;
  createdAt: string;
  contentDirection: string;
  contentThemes: string[];
  selectedChannels: string[];
  assetTypes: string[];
  contentSourceStrategy: {
    type: ContentSourceType;
    summary: string;
    userTopics: string[];
    existingText: string;
  };
  topicQueue: Array<{ id: string; topic: string; status: TopicStatus }>;
  workflowRun: {
    id: string;
    status: "Draft created";
    contentBrief: {
      topic: string;
      angle: string;
      hook: string;
      audience: string;
      keyPoints: string[];
      suggestedAssetType: string;
      suggestedPlatform: string;
      sourceNotes: string;
      riskNotes: string;
    };
    contentDraftPack: {
      headline: string;
      hook: string;
      shortExplanation: string;
      posterOutline: string[];
      videoScript: string;
      sceneOutline: string[];
      socialPostDrafts: string[];
      seoTitle: string;
      seoDescription: string;
      hashtags: string[];
      cta: string;
    };
    projectAssets: Array<{ type: string; title: string; source: "Content draft pack" }>;
    publicationDrafts: Array<{ channel: string; title: string; source: "Content draft pack" }>;
  };
};

const navItems = [
  { label: "Home", icon: HomeIcon, href: "/app" },
  { label: "Projects", icon: FolderOpen, href: "/projects" },
  { label: "Growth Studio", icon: TrendingUp, href: "/growth-studio" },
  { label: "Profile", icon: UserCircle2, href: "/profile" },
];

const steps = [
  "Start point",
  "Content source",
  "Content direction",
  "Channels",
  "Recommended setup",
  "Review and create",
];

const contentSources = [
  {
    type: "theme" as const,
    title: "Theme-based generation",
    description: "Set a content direction and recurring themes. KnowLens will generate new ideas from them.",
    recommended: true,
    icon: TrendingUp,
  },
  {
    type: "topics" as const,
    title: "User-defined topics",
    description: "Add your own topics, prompts, or content ideas for this workflow to turn into assets.",
    recommended: false,
    icon: Check,
  },
  {
    type: "text" as const,
    title: "Existing text content",
    description: "Paste articles, notes, scripts, product descriptions, or course content to generate reusable ideas.",
    recommended: false,
    icon: FileText,
  },
  {
    type: "trends" as const,
    title: "Trend research",
    description: "Find rising topics from the web and turn them into original content ideas.",
    recommended: false,
    comingSoon: true,
    icon: Search,
  },
];

const channelOptions = ["LinkedIn", "Threads", "YouTube Shorts", "Instagram Reels"];
const assetOptions = ["Poster project", "Short video project", "Social post drafts", "SEO descriptions"];
const storageKey = "knowlens_growth_workflows_v1";

function splitLines(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function sourceSummary(type: ContentSourceType) {
  if (type === "topics") {
    return "New content ideas will come from the topics you add.";
  }
  if (type === "text") {
    return "New content ideas will be extracted from your pasted content.";
  }
  if (type === "trends") {
    return "New content ideas will be discovered from rising topics and source links.";
  }
  return "New content ideas will be generated from your content direction and themes.";
}

function buildTopics(input: {
  sourceType: ContentSourceType;
  contentDirection: string;
  themes: string[];
  userTopics: string[];
  existingText: string;
}) {
  if (input.sourceType === "topics" && input.userTopics.length) {
    return input.userTopics;
  }
  if (input.sourceType === "text" && input.existingText.trim()) {
    const textIdeas = splitLines(input.existingText)
      .map((item) => item.replace(/[.!?。！？]+$/g, ""))
      .slice(0, 5);
    return textIdeas.length ? textIdeas : [input.existingText.trim().slice(0, 80)];
  }
  const direction = input.contentDirection.trim() || "Content growth workflow";
  const themes = input.themes.length ? input.themes : ["Audience pain points", "Practical examples", "Common mistakes"];
  return themes.map((theme) => `${direction}: ${theme}`);
}

function buildWorkflow(input: {
  name: string;
  sourceType: ContentSourceType;
  contentDirection: string;
  themesText: string;
  topicsText: string;
  existingText: string;
  selectedChannels: string[];
  assetTypes: string[];
}): GrowthWorkflow {
  const contentThemes = splitLines(input.themesText);
  const userTopics = splitLines(input.topicsText);
  const topics = buildTopics({
    sourceType: input.sourceType,
    contentDirection: input.contentDirection,
    themes: contentThemes,
    userTopics,
    existingText: input.existingText,
  });
  const topicQueue = topics.map((topic, index) => ({
    id: makeId("topic"),
    topic,
    status: index === 0 ? ("Queued" as TopicStatus) : ("Draft" as TopicStatus),
  }));
  const firstTopic = topicQueue[0]?.topic || input.contentDirection || "First content idea";
  const firstChannel = input.selectedChannels[0] || "LinkedIn";
  const firstAsset = input.assetTypes[0] || "Poster project";

  return {
    id: makeId("workflow"),
    name: input.name.trim() || "Untitled workflow",
    createdAt: new Date().toISOString(),
    contentDirection: input.contentDirection.trim(),
    contentThemes,
    selectedChannels: input.selectedChannels,
    assetTypes: input.assetTypes,
    contentSourceStrategy: {
      type: input.sourceType,
      summary: sourceSummary(input.sourceType),
      userTopics,
      existingText: input.existingText.trim(),
    },
    topicQueue,
    workflowRun: {
      id: makeId("run"),
      status: "Draft created",
      contentBrief: {
        topic: firstTopic,
        angle: `Explain why "${firstTopic}" matters for the target audience.`,
        hook: `${firstTopic} is easier to understand when it becomes a visual story.`,
        audience: "Creators, educators, startup teams, and knowledge workers.",
        keyPoints: ["Clear problem", "Useful explanation", "Practical takeaway"],
        suggestedAssetType: firstAsset,
        suggestedPlatform: firstChannel,
        sourceNotes: sourceSummary(input.sourceType),
        riskNotes: "Review factual claims before publishing.",
      },
      contentDraftPack: {
        headline: firstTopic,
        hook: `${firstTopic}: what people usually miss.`,
        shortExplanation: "A concise explainer that turns the idea into reusable content assets.",
        posterOutline: ["Hook", "Core idea", "Three key points", "Takeaway"],
        videoScript: `Open with the hook, explain ${firstTopic}, then close with a practical takeaway.`,
        sceneOutline: ["Opening hook", "Visual explanation", "Example", "CTA"],
        socialPostDrafts: input.selectedChannels.map((channel) => `${channel} draft for ${firstTopic}`),
        seoTitle: `${firstTopic} explained`,
        seoDescription: `A visual explanation of ${firstTopic} for content growth workflows.`,
        hashtags: ["#KnowLens", "#ContentGrowth", "#Workflow"],
        cta: "Create your next visual asset with KnowLens.",
      },
      projectAssets: input.assetTypes.map((type) => ({
        type,
        title: `${firstTopic} ${type}`,
        source: "Content draft pack",
      })),
      publicationDrafts: input.selectedChannels.map((channel) => ({
        channel,
        title: `${channel} publication draft for ${firstTopic}`,
        source: "Content draft pack",
      })),
    },
  };
}

export default function CreateWorkflowPage() {
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [name, setName] = useState("AI explainers for creators");
  const [sourceType, setSourceType] = useState<ContentSourceType>("theme");
  const [contentDirection, setContentDirection] = useState("AI explainers for creators and startup teams");
  const [themesText, setThemesText] = useState("AI agents\nAI tools\nResearch workflow\nProductivity\nKnowledge management");
  const [topicsText, setTopicsText] = useState("AI agents for startup teams\nHow AI tools change research workflows\nProductivity systems for creators");
  const [existingText, setExistingText] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<string[]>(["LinkedIn", "YouTube Shorts"]);
  const [assetTypes, setAssetTypes] = useState<string[]>(["Poster project", "Short video project", "Social post drafts", "SEO descriptions"]);

  const previewWorkflow = useMemo(
    () =>
      buildWorkflow({
        name,
        sourceType,
        contentDirection,
        themesText,
        topicsText,
        existingText,
        selectedChannels,
        assetTypes,
      }),
    [assetTypes, contentDirection, existingText, name, selectedChannels, sourceType, themesText, topicsText],
  );

  function toggleValue(value: string, values: string[], setter: (next: string[]) => void) {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  function handleCreate() {
    const workflow = buildWorkflow({
      name,
      sourceType,
      contentDirection,
      themesText,
      topicsText,
      existingText,
      selectedChannels,
      assetTypes,
    });
    try {
      const existing = JSON.parse(window.localStorage.getItem(storageKey) || "[]") as GrowthWorkflow[];
      window.localStorage.setItem(storageKey, JSON.stringify([workflow, ...existing]));
    } catch {
      window.localStorage.setItem(storageKey, JSON.stringify([workflow]));
    }
    router.push(`/growth-studio/${encodeURIComponent(workflow.id)}`);
  }

  const canContinue =
    currentStep !== 1 ||
    sourceType === "theme" ||
    (sourceType === "topics" && splitLines(topicsText).length > 0) ||
    (sourceType === "text" && existingText.trim().length > 0);

  return (
    <div className="min-h-screen bg-[#f7f7f8] text-zinc-900">
      <SidebarNav
        items={navItems}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      <main className="px-3 pb-10 pt-4 sm:px-6 sm:pt-6 md:pl-[6.5rem] lg:px-12 lg:pl-[7.5rem]">
        <div className="mx-auto max-w-6xl">
          <div className="mb-3 md:hidden">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-300 bg-white text-zinc-700 transition hover:bg-zinc-100"
              aria-label="Open navigation"
              title="Open navigation"
            >
              <Menu size={15} />
            </button>
          </div>

          <header className="mb-5">
            <button
              type="button"
              onClick={() => router.push("/growth-studio")}
              className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-950"
            >
              <ArrowLeft size={15} />
              Growth Studio
            </button>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Create workflow</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600">
              Define where future content ideas come from, then create the first topic queue and draft pack.
            </p>
          </header>

          <section className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
              {steps.map((step, index) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => setCurrentStep(index)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    currentStep === index ? "bg-zinc-950 text-white" : "text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-xs font-semibold">
                    {index + 1}
                  </span>
                  {step}
                </button>
              ))}
            </aside>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_10px_25px_rgba(15,23,42,0.04)] sm:p-6">
              {currentStep === 0 ? (
                <div className="max-w-2xl">
                  <h2 className="text-xl font-semibold text-zinc-950">Start point</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    Name this Workflow and describe the long-term content direction.
                  </p>
                  <label className="mt-5 block text-sm font-medium text-zinc-900">Workflow name</label>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-900"
                  />
                  <label className="mt-4 block text-sm font-medium text-zinc-900">Content direction</label>
                  <textarea
                    value={contentDirection}
                    onChange={(event) => setContentDirection(event.target.value)}
                    rows={4}
                    className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm leading-6 outline-none focus:border-zinc-900"
                  />
                </div>
              ) : null}

              {currentStep === 1 ? (
                <div>
                  <h2 className="text-xl font-semibold text-zinc-950">Where should new content ideas come from?</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    Choose how this Workflow should find or generate new content ideas over time. This controls where future content ideas come from.
                  </p>
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {contentSources.map((source) => {
                      const Icon = source.icon;
                      const selected = sourceType === source.type;
                      return (
                        <button
                          key={source.type}
                          type="button"
                          disabled={source.comingSoon}
                          onClick={() => setSourceType(source.type)}
                          className={`rounded-2xl border p-4 text-left transition ${
                            selected
                              ? "border-zinc-950 bg-zinc-950 text-white"
                              : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300"
                          } ${source.comingSoon ? "cursor-not-allowed opacity-55" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <Icon size={18} />
                            {source.recommended ? (
                              <span className={`rounded-full px-2 py-0.5 text-[11px] ${selected ? "bg-white/15 text-white" : "bg-violet-50 text-violet-700"}`}>
                                Recommended
                              </span>
                            ) : null}
                            {source.comingSoon ? (
                              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">
                                Coming soon
                              </span>
                            ) : null}
                          </div>
                          <h3 className="mt-3 text-sm font-semibold">{source.title}</h3>
                          <p className={`mt-1.5 text-sm leading-6 ${selected ? "text-zinc-200" : "text-zinc-600"}`}>
                            {source.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {sourceType === "topics" ? (
                    <FieldBlock title="Topics" helper="Add one topic per line.">
                      <textarea value={topicsText} onChange={(event) => setTopicsText(event.target.value)} rows={5} className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm leading-6 outline-none focus:border-zinc-900" />
                    </FieldBlock>
                  ) : null}
                  {sourceType === "text" ? (
                    <FieldBlock title="Existing text content" helper="Paste articles, notes, scripts, product descriptions, course content, or social drafts.">
                      <textarea value={existingText} onChange={(event) => setExistingText(event.target.value)} rows={7} className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm leading-6 outline-none focus:border-zinc-900" placeholder="Paste content here..." />
                    </FieldBlock>
                  ) : null}
                </div>
              ) : null}

              {currentStep === 2 ? (
                <div className="max-w-2xl">
                  <h2 className="text-xl font-semibold text-zinc-950">Content direction</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    Content direction defines what this Workflow is about. Themes help create the Topic queue.
                  </p>
                  <label className="mt-5 block text-sm font-medium text-zinc-900">Content themes</label>
                  <textarea
                    value={themesText}
                    onChange={(event) => setThemesText(event.target.value)}
                    rows={6}
                    className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm leading-6 outline-none focus:border-zinc-900"
                  />
                </div>
              ) : null}

              {currentStep === 3 ? (
                <OptionStep
                  title="Channels"
                  description="Publication drafts are generated from the Content draft pack and selected channels."
                  options={channelOptions}
                  values={selectedChannels}
                  onToggle={(value) => toggleValue(value, selectedChannels, setSelectedChannels)}
                />
              ) : null}

              {currentStep === 4 ? (
                <OptionStep
                  title="Recommended setup"
                  description="Project assets are generated from the Content draft pack. Choose what this Workflow should prepare."
                  options={assetOptions}
                  values={assetTypes}
                  onToggle={(value) => toggleValue(value, assetTypes, setAssetTypes)}
                />
              ) : null}

              {currentStep === 5 ? (
                <div>
                  <h2 className="text-xl font-semibold text-zinc-950">Review and create</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    Review the source strategy and generated production chain before creating this Workflow.
                  </p>
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <SummaryCard title="Content source" value={previewWorkflow.contentSourceStrategy.summary} />
                    <SummaryCard title="Content direction" value={previewWorkflow.contentDirection || "Not set"} />
                    <SummaryCard title="Content themes" value={previewWorkflow.contentThemes.join(", ") || "Default themes"} />
                    <SummaryCard title="Selected channels" value={previewWorkflow.selectedChannels.join(", ") || "No channels selected"} />
                    <SummaryCard title="Recommended setup" value={previewWorkflow.assetTypes.join(", ") || "No assets selected"} />
                    <SummaryCard title="Publishing plan" value="Publication drafts enter the review queue before publishing." />
                  </div>

                  <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-sm font-semibold text-zinc-950">First Topic queue</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {previewWorkflow.topicQueue.slice(0, 6).map((topic) => (
                        <span key={topic.id} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200">
                          {topic.topic}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-7 flex items-center justify-between border-t border-zinc-200 pt-4">
                <button
                  type="button"
                  onClick={() => setCurrentStep((prev) => Math.max(prev - 1, 0))}
                  disabled={currentStep === 0}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowLeft size={15} />
                  Back
                </button>
                {currentStep < steps.length - 1 ? (
                  <button
                    type="button"
                    disabled={!canContinue}
                    onClick={() => setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1))}
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Continue
                    <ArrowRight size={15} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800"
                  >
                    Create workflow
                    <ArrowRight size={15} />
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function FieldBlock({ title, helper, children }: { title: string; helper: string; children: ReactNode }) {
  return (
    <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-sm font-semibold text-zinc-950">{title}</p>
      <p className="mb-3 mt-1 text-sm leading-6 text-zinc-600">{helper}</p>
      {children}
    </div>
  );
}

function OptionStep({
  title,
  description,
  options,
  values,
  onToggle,
}: {
  title: string;
  description: string;
  options: string[];
  values: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-zinc-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {options.map((option) => {
          const selected = values.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              className={`flex items-center gap-3 rounded-2xl border p-4 text-left text-sm font-medium transition ${
                selected ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300"
              }`}
            >
              <span className={`flex h-6 w-6 items-center justify-center rounded-full ${selected ? "bg-white text-zinc-950" : "bg-zinc-100 text-zinc-500"}`}>
                <Check size={14} />
              </span>
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-800">{value}</p>
    </div>
  );
}
