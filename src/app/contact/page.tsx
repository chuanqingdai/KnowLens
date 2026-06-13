import Link from "next/link";
import { Mail, MessageSquare, Send } from "lucide-react";
import type { Metadata } from "next";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact KnowLens.ai for feedback, product questions, and collaboration inquiries.",
  alternates: {
    canonical: "/contact",
  },
};

export default function ContactPage() {
  return (
    <MarketingChrome>
      <section className="mx-auto w-full max-w-4xl px-4 pb-14 pt-8 sm:px-6 sm:pt-10">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs text-zinc-500">Contact</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
            I&apos;d Love to Hear from You
          </h1>
          <p className="mt-4 text-sm leading-7 text-zinc-700">
            I&apos;m an independent developer building KnowLens.ai. If you run into issues, want to suggest features,
            or discuss collaboration, you can reach me through the channels below.
          </p>

          <div className="mt-8 space-y-8">
            <article>
              <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-zinc-900">
                <Mail size={16} />
                Email
              </h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                Best for collaboration, account issues, billing questions, or any detailed request. If possible,
                include the page URL, time, and steps to reproduce so I can investigate faster.
              </p>
              <a
                href="mailto:support@knowlens.ai"
                className="mt-3 inline-flex text-sm font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4"
              >
                support@knowlens.ai
              </a>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-zinc-900">
                <MessageSquare size={16} />
                In-app Feedback
              </h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                Best for UX suggestions and reproducible product bugs. In-app feedback usually includes useful context,
                which helps me diagnose issues more quickly.
              </p>
              <Link
                href="/feedback"
                className="mt-3 inline-flex h-9 items-center rounded-xl border border-zinc-300 bg-white px-3 text-xs text-zinc-700 hover:bg-zinc-100"
              >
                Open Feedback Page
              </Link>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-zinc-900">
                <Send size={16} />
                Response Times
              </h2>
              <ul className="mt-3 space-y-2 text-sm leading-7 text-zinc-700">
                <li>General inquiries: usually within 1-3 business days.</li>
                <li>Critical workflow bugs: prioritized with progress updates.</li>
                <li>Subscription or billing issues: handled as quickly as possible.</li>
              </ul>
            </article>
          </div>
        </div>
      </section>
    </MarketingChrome>
  );
}
