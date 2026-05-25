import Link from "next/link";
import type { Metadata } from "next";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

export const metadata: Metadata = {
  title: "About",
  description: "The personal story behind KnowLens.ai, why visual learning matters, and how AI Coding made it possible.",
  alternates: {
    canonical: "/about",
  },
};

export default function AboutPage() {
  return (
    <MarketingChrome>
      <section className="mx-auto w-full max-w-4xl px-4 pb-14 pt-8 sm:px-6 sm:pt-10">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs text-zinc-500">About KnowLens.ai</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">Why I Started Building KnowLens.ai</h1>
          <p className="mt-4 text-sm leading-7 text-zinc-700">
            I am a designer and an independent builder. I love learning, especially AI, science, and how complex systems work in the real world. Many nights, I try to explain what I learn to my son. That simple moment changed everything for me.
          </p>
          <p className="mt-3 text-sm leading-7 text-zinc-700">
            This was my first time seriously using AI Coding tools. I started by experimenting, then iterating, then rebuilding again and again. KnowLens.ai grew out of that journey: turning dense content from webpages, videos, podcasts, and documents into clear visual posters, presentation slides, and video drafts.
          </p>

          <div className="mt-8 space-y-8">
            <article>
              <h2 className="text-lg font-semibold text-zinc-900">Why Visual Thinking Matters to Me</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                I believe visualization is not decoration. It is understanding. When knowledge becomes visual, people can grasp structure faster, remember key ideas longer, and explain them with more confidence. For students, it lowers the learning barrier. For creators, it makes communication clearer and more powerful.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">Three Principles I Build With</h2>
              <ul className="mt-3 space-y-2 text-sm leading-7 text-zinc-700">
                <li>Clarity first: define the message, structure, and priority before generating visuals.</li>
                <li>Control over gimmicks: every step should be editable, reviewable, and replaceable.</li>
                <li>One knowledge backbone, many outputs: poster, slides, and video draft should stay consistent.</li>
              </ul>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">What Good Visualization Changes</h2>
              <ul className="mt-3 space-y-2 text-sm leading-7 text-zinc-700">
                <li>Faster learning: complex ideas become clear steps people can follow.</li>
                <li>Stronger memory: visual structure creates anchors that are easier to recall.</li>
                <li>Clearer expression: it helps in classrooms, content creation, and team communication.</li>
                <li>Higher output efficiency: research, organization, and presentation happen in one flow.</li>
              </ul>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">A Note from Me</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                If you have feedback, run into issues, or want a feature prioritized, please reach out through
                <Link href="/contact" className="mx-1 text-zinc-900 underline decoration-zinc-300 underline-offset-4">
                  Contact
                </Link>
                . I am still learning every day, and I care deeply about making this product genuinely useful. Your message helps me build it better.
              </p>
            </article>
          </div>
        </div>
      </section>
    </MarketingChrome>
  );
}
