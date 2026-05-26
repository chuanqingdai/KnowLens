import Link from "next/link";
import type { Metadata } from "next";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Read the KnowLens.ai Terms of Service covering account use, content responsibility, AI output, subscriptions, credits, and legal rules.",
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
            Terms of Service for KnowLens.ai
          </h1>
          <p className="mt-4 text-sm leading-7 text-zinc-700">
            These Terms of Service govern access to and use of KnowLens.ai. By creating an account or using any part
            of KnowLens.ai, you agree to these terms and to the
            <Link href="/privacy" className="mx-1 text-zinc-900 underline decoration-zinc-300 underline-offset-4">
              Privacy Policy
            </Link>
            .
          </p>
          <p className="mt-2 text-xs text-zinc-500">Effective date: May 26, 2026</p>
          <p className="mt-1 text-xs text-zinc-500">Last updated: May 26, 2026</p>

          <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p className="text-xs font-medium text-zinc-700">Contents</p>
            <div className="mt-2 grid gap-1 text-xs text-zinc-600 sm:grid-cols-2">
              <p>1. Service Scope</p>
              <p>2. Eligibility and Accounts</p>
              <p>3. Acceptable Use</p>
              <p>4. User Content and Rights</p>
              <p>5. AI Outputs and Review Responsibility</p>
              <p>6. Plan Access and Feature Availability</p>
              <p>7. Billing, Subscription, and Credits</p>
              <p>8. Promotions and Credit Incentives</p>
              <p>9. Cancellation, Renewal, and Refunds</p>
              <p>10. Enforcement and Suspension</p>
              <p>11. Third-party Services</p>
              <p>12. Disclaimers</p>
              <p>13. Liability Limits</p>
              <p>14. Governing Law and Updates</p>
            </div>
          </div>

          <div className="mt-8 space-y-8">
            <article>
              <h2 className="text-lg font-semibold text-zinc-900">1. Service Scope</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                KnowLens.ai provides AI-assisted tools for turning source materials into visual content formats,
                including poster drafts, slide drafts, storyboard drafts, and related editable outputs. Features,
                limits, and model access may vary by plan, region, product stage, and technical constraints.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">2. Eligibility and Accounts</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                You must be legally capable of entering a binding agreement in your jurisdiction. You are responsible
                for maintaining account security and for all activities under your account credentials. If unauthorized
                use is suspected, you must promptly report the issue through
                <Link href="/contact" className="mx-1 text-zinc-900 underline decoration-zinc-300 underline-offset-4">
                  Contact
                </Link>
                .
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">3. Acceptable Use</h2>
              <ul className="mt-3 space-y-2 text-sm leading-7 text-zinc-700">
                <li>You must not use KnowLens.ai for unlawful, deceptive, harmful, or abusive activities.</li>
                <li>You must not bypass limits, perform unauthorized scraping, or disrupt service stability.</li>
                <li>You must not upload content that infringes intellectual property or privacy rights.</li>
                <li>You must not reverse engineer or attempt to extract protected system internals.</li>
              </ul>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">4. User Content and Rights</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                You retain rights in content you submit where applicable by law. To provide the service, you grant
                KnowLens.ai a limited, non-exclusive, revocable license to process submitted content for generation,
                rendering, moderation, delivery, debugging, and quality improvement of core product operations.
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-700">
                You represent that you have all necessary rights to submit content. KnowLens.ai may remove or restrict
                content that appears unlawful or policy-violating.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">5. AI Outputs and Review Responsibility</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                AI outputs may contain inaccuracies, omissions, or outdated information. You are responsible for
                reviewing outputs before relying on them in educational, medical, financial, legal, regulatory, or
                other high-impact contexts. KnowLens.ai does not provide legal, medical, or financial advice.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">6. Plan Access and Feature Availability</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                Features such as premium models, higher-resolution output, accelerated queues, and advanced export
                options may be restricted to specific paid plans. KnowLens.ai may adjust plan composition, quotas, and
                regional availability to maintain service quality and anti-abuse controls.
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-700">
                Certain promotional capabilities may be temporary and may be changed, paused, or withdrawn at any time
                in accordance with applicable law.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">7. Billing, Subscription, and Credits</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                Paid plans are billed in advance on a recurring cycle unless otherwise stated at checkout. Pricing,
                billing cadence (monthly or annual), and included credit amounts are displayed on KnowLens.ai billing
                interfaces at time of purchase.
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-700">
                Credits are a usage metric within KnowLens.ai and are not cash, stored value, or transferable property.
                Credit consumption depends on output type, quality mode, and applicable pricing rules. Promotional
                credit conversion rules may differ from standard conversion rules.
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-700">
                Detailed billing and payment rules are published in
                <Link href="/payment-terms" className="mx-1 text-zinc-900 underline decoration-zinc-300 underline-offset-4">
                  Payment Terms
                </Link>
                , which are incorporated into these Terms of Service by reference.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">8. Promotions and Credit Incentives</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                KnowLens.ai may run promotions, discount windows, or incentive campaigns. Unless explicitly stated
                otherwise, promotions cannot be combined and may be limited by account status, geography, traffic risk
                controls, billing history, and anti-fraud checks.
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-700">
                Promotional terms apply only during the valid window and may be modified or ended. Misuse of
                promotional mechanisms may result in cancellation of promotional benefits or account restrictions.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">9. Cancellation, Renewal, and Refunds</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                Unless canceled before renewal, subscriptions renew automatically at the then-applicable price and
                billing period displayed at checkout. You can request cancellation through account and profile billing
                management pages or other designated methods provided by KnowLens.ai.
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-700">
                Refunds are handled under the payment terms shown at checkout, this Terms page, and mandatory consumer
                law in your jurisdiction. If payment disputes or chargebacks occur, KnowLens.ai may suspend features or
                credits related to the disputed transaction during investigation.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">10. Enforcement and Suspension</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                KnowLens.ai may monitor abuse signals and enforce these terms through warnings, temporary limits,
                content removal, suspension, or account termination where necessary for safety, legal compliance, or
                service integrity.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">11. Third-party Services</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                KnowLens.ai relies on third-party infrastructure, authentication providers, analytics vendors, and
                payment processors. Those services may have independent terms and privacy policies that also apply to
                your interactions with them.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">12. Disclaimers</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                To the maximum extent permitted by law, KnowLens.ai is provided on an &quot;as is&quot; and
                &quot;as available&quot; basis. Availability, speed, and output consistency are not guaranteed in all
                network or device environments.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">13. Liability Limits</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                To the extent permitted by law, KnowLens.ai is not liable for indirect, incidental, consequential, or
                punitive damages, or for losses arising from third-party outages, force majeure events, network
                failures, or misuse of outputs. Nothing in these terms excludes liability that cannot be excluded under
                applicable law.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">14. Governing Law and Updates</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                These terms are governed by applicable law in the jurisdiction designated by KnowLens.ai, subject to
                mandatory consumer protections in your place of residence. KnowLens.ai may update these terms to
                reflect legal, operational, or product changes. Updated terms are effective on posting unless a later
                date is stated.
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-700">
                Questions about these terms can be submitted through
                <Link href="/contact" className="mx-1 text-zinc-900 underline decoration-zinc-300 underline-offset-4">
                  Contact
                </Link>
                .
              </p>
            </article>
          </div>
        </div>
      </section>
    </MarketingChrome>
  );
}
