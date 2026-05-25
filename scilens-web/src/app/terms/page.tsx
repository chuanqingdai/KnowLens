import Link from "next/link";
import type { Metadata } from "next";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Read the KnowLens.ai Terms of Service covering account use, subscriptions, credits, content responsibilities, and compliance rules.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
  return (
    <MarketingChrome>
      <section className="mx-auto w-full max-w-4xl px-4 pb-14 pt-8 sm:px-6 sm:pt-10">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs text-zinc-500">Terms of Service</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
            Rules for Using KnowLens.ai
          </h1>
          <p className="mt-4 text-sm leading-7 text-zinc-700">
            These Terms of Service explain your rights, responsibilities, and usage boundaries when using KnowLens.ai.
            By accessing or using KnowLens.ai, you agree to these terms.
          </p>
          <p className="mt-2 text-xs text-zinc-500">Effective date: May 24, 2026</p>

          <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p className="text-xs font-medium text-zinc-700">Contents</p>
            <div className="mt-2 grid gap-1 text-xs text-zinc-600 sm:grid-cols-2">
              <p>1. Service Overview</p>
              <p>2. Eligibility and Accounts</p>
              <p>3. Content Responsibility and License</p>
              <p>4. AI Output and User Review</p>
              <p>5. Subscriptions, Billing, and Credits</p>
              <p>6. Cancellation, Refunds, and Renewals</p>
              <p>7. Prohibited Conduct</p>
              <p>8. Suspension and Termination</p>
              <p>9. Third-party Services</p>
              <p>10. Disclaimers and Limitation of Liability</p>
              <p>11. Governing Law and Disputes</p>
              <p>12. Updates and Contact</p>
            </div>
          </div>

          <div className="mt-8 space-y-8">
            <article>
              <h2 className="text-lg font-semibold text-zinc-900">1. Service Overview</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                KnowLens.ai provides AI-powered understanding, structured drafting, style selection, and export flows
                for visual posters, slide decks, and video drafts. KnowLens.ai continuously improves features but does
                not guarantee uninterrupted operation in every environment or use case.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">2. Eligibility and Accounts</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                You must provide valid account details and are responsible for activity under your account. If you
                suspect unauthorized access, please notify KnowLens.ai immediately and update your credentials.
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-700">
                You must be legally able to enter into binding agreements in your jurisdiction. If you use KnowLens.ai
                on behalf of an organization, you represent that you are authorized to bind that organization to these
                Terms of Service.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">3. Content Responsibility and License</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                You are responsible for ensuring that uploaded, entered, or linked content is lawful and does not
                violate third-party rights. KnowLens.ai may restrict or remove content that appears infringing,
                unlawful, or abusive, as permitted by applicable law.
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-700">
                You retain rights to your input content where applicable. You grant KnowLens.ai a limited license to
                process that content solely to provide, maintain, and improve the service in accordance with these
                terms and the Privacy Policy.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">4. AI Output and User Review</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                AI-generated outputs from KnowLens.ai may contain errors, omissions, or outdated information. You are
                responsible for reviewing outputs before using them for publication, education, legal, financial, or
                other high-impact contexts.
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-700">
                KnowLens.ai does not provide legal, medical, tax, or professional advice. Any decisions made based on
                generated content are your responsibility.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">5. Subscriptions, Billing, and Credits</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                Plan tiers, credit quotas, billing cycles, renewals, cancellation, and refund rules are defined on the
                KnowLens.ai billing pages at time of purchase. Payment transactions may also be governed by third-party
                billing platform terms and risk controls.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">6. Cancellation, Refunds, and Renewals</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                Unless otherwise stated, subscriptions may renew automatically at the end of each billing cycle.
                You can cancel through the membership settings before renewal. Refund eligibility depends on plan type,
                region, payment provider rules, and any promotional terms shown at checkout.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">7. Prohibited Conduct</h2>
              <ul className="mt-3 space-y-2 text-sm leading-7 text-zinc-700">
                <li>Do not bypass platform limits, abuse APIs, or perform unauthorized scraping.</li>
                <li>Do not upload unlawful, infringing, harmful, or deceptive content.</li>
                <li>Do not attack, reverse engineer, or disrupt KnowLens.ai services.</li>
                <li>Do not access another user&apos;s account, data, or projects without authorization.</li>
              </ul>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">8. Suspension and Termination</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                KnowLens.ai may suspend, restrict, or terminate access if these Terms of Service are violated, if there
                is a security risk, if abuse is detected, or if required by law. You may stop using KnowLens.ai at any
                time. Certain obligations in these terms survive termination, including legal compliance and liability
                provisions.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">9. Third-party Services</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                KnowLens.ai may integrate with third-party services such as authentication providers, payment gateways,
                and infrastructure vendors. Use of such third-party services may also be subject to their own terms and
                privacy policies.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">10. Disclaimers and Limitation of Liability</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                To the extent permitted by law, KnowLens.ai is not liable for indirect losses caused by force majeure,
                third-party outages, network failures, or device issues. You are responsible for evaluating generated
                outputs before business, academic, or legal use.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">11. Governing Law and Disputes</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                These Terms of Service are governed by applicable law in the jurisdiction designated by KnowLens.ai.
                If disputes arise, both parties should first attempt good-faith resolution through direct communication.
                If unresolved, disputes may be submitted to competent courts or arbitration forums as required by
                applicable law.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">12. Updates and Contact</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                KnowLens.ai may update these Terms of Service based on product evolution, legal requirements, or
                operational changes. Updated terms become effective when posted. If you have questions, please use
                <Link href="/contact" className="mx-1 text-zinc-900 underline decoration-zinc-300 underline-offset-4">
                  Contact
                </Link>
                to reach KnowLens.ai.
              </p>
            </article>
          </div>
        </div>
      </section>
    </MarketingChrome>
  );
}
