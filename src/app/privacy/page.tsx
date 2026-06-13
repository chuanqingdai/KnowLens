import Link from "next/link";
import type { Metadata } from "next";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Read the KnowLens.ai Privacy Policy to understand how KnowLens.ai collects, processes, stores, and protects personal data.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <MarketingChrome>
      <section className="mx-auto w-full max-w-4xl px-4 pb-14 pt-8 sm:px-6 sm:pt-10">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs text-zinc-500">Privacy Policy</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
            Privacy Policy for KnowLens.ai
          </h1>
          <p className="mt-4 text-sm leading-7 text-zinc-700">
            This Privacy Policy explains how KnowLens.ai collects, uses, discloses, stores, and protects personal data
            when you use the KnowLens.ai website, product pages, workspace, generation flows, membership purchase
            flows, and support channels.
          </p>
          <p className="mt-2 text-sm leading-7 text-zinc-700">
            By using KnowLens.ai, you acknowledge that your personal data will be handled as described in this policy.
            If you do not agree, please discontinue use of KnowLens.ai.
          </p>
          <p className="mt-2 text-xs text-zinc-500">Effective date: May 26, 2026</p>
          <p className="mt-1 text-xs text-zinc-500">Last updated: May 26, 2026</p>

          <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p className="text-xs font-medium text-zinc-700">Contents</p>
            <div className="mt-2 grid gap-1 text-xs text-zinc-600 sm:grid-cols-2">
              <p>1. Scope and Data Controller</p>
              <p>2. Personal Data We Collect</p>
              <p>3. Sources of Data</p>
              <p>4. Why We Process Data</p>
              <p>5. Legal Bases for Processing</p>
              <p>6. Cookies and Similar Technologies</p>
              <p>7. How We Share Data</p>
              <p>8. International Data Transfers</p>
              <p>9. Data Retention</p>
              <p>10. Security Safeguards</p>
              <p>11. Your Privacy Rights</p>
              <p>12. Children&apos;s Privacy</p>
              <p>13. Third-party Links and Services</p>
              <p>14. Changes to This Policy</p>
              <p>15. Contact and Requests</p>
            </div>
          </div>

          <div className="mt-8 space-y-8">
            <article>
              <h2 className="text-lg font-semibold text-zinc-900">1. Scope and Data Controller</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                This policy applies to personal data processed through KnowLens.ai, including landing pages, sign-in,
                membership checkout, workspace generation, and support communication. For data protection purposes,
                KnowLens.ai acts as the data controller for user account and product-operation data described in this
                policy, except where a third-party service acts as an independent controller under its own terms.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">2. Personal Data We Collect</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">Depending on your usage, KnowLens.ai may collect:</p>
              <ul className="mt-2 space-y-2 text-sm leading-7 text-zinc-700">
                <li>
                  <span className="font-medium text-zinc-900">Account data:</span> email, display name, profile image,
                  authentication provider identifiers, and account creation timestamps.
                </li>
                <li>
                  <span className="font-medium text-zinc-900">Content data:</span> prompts, uploaded files, URLs,
                  source text, generated drafts, and selected styles.
                </li>
                <li>
                  <span className="font-medium text-zinc-900">Project and activity data:</span> project titles,
                  generation history, likes, view interactions, and feedback tickets.
                </li>
                <li>
                  <span className="font-medium text-zinc-900">Billing data:</span> plan tier, subscription status,
                  renewal cycle, invoice references, and credit ledger events. Card numbers are processed by payment
                  providers and are not stored directly by KnowLens.ai.
                </li>
                <li>
                  <span className="font-medium text-zinc-900">Technical and diagnostic data:</span> IP-derived region,
                  browser type, device type, crash logs, request metadata, and anti-abuse signals.
                </li>
              </ul>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">3. Sources of Data</h2>
              <ul className="mt-3 space-y-2 text-sm leading-7 text-zinc-700">
                <li>Information you provide directly when registering, purchasing, or using generation tools.</li>
                <li>Signals automatically collected when you browse pages or interact with the product.</li>
                <li>Data returned by integrated services such as authentication providers and payment processors.</li>
                <li>Support data submitted through contact forms, feedback tickets, or account requests.</li>
              </ul>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">4. Why We Process Data</h2>
              <ul className="mt-3 space-y-2 text-sm leading-7 text-zinc-700">
                <li>To provide and operate KnowLens.ai features, including generation and export workflows.</li>
                <li>To authenticate users, maintain account security, and prevent unauthorized access.</li>
                <li>To manage subscriptions, grant credits, process billing status, and provide receipts.</li>
                <li>To improve reliability and model quality, including debugging and performance optimization.</li>
                <li>To detect fraud, enforce policies, and protect platform integrity.</li>
                <li>To communicate service notices, legal updates, and support responses.</li>
              </ul>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">5. Legal Bases for Processing</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                Where applicable data protection law requires a legal basis, KnowLens.ai relies on one or more of the
                following: performance of a contract, legitimate interests, legal obligations, and consent where
                required. Legitimate interests include service security, product quality improvements, abuse prevention,
                and maintaining stable operations.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">6. Cookies and Similar Technologies</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                KnowLens.ai uses cookies, local storage, and similar technologies to support login sessions, language
                preferences, anti-fraud checks, and analytics. Some cookies are strictly necessary for core site
                operation. You may manage cookie preferences in your browser, but disabling required cookies may break
                authentication and generation flows.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">7. How We Share Data</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                KnowLens.ai does not sell personal data. Data may be shared only when required to operate the service
                or comply with law, including with:
              </p>
              <ul className="mt-2 space-y-2 text-sm leading-7 text-zinc-700">
                <li>Cloud hosting and delivery providers.</li>
                <li>Authentication partners.</li>
                <li>Payment and billing processors.</li>
                <li>Monitoring and security tooling providers.</li>
                <li>Authorities where legal disclosure is required.</li>
              </ul>
              <p className="mt-2 text-sm leading-7 text-zinc-700">
                Service providers are expected to process data under contractual or policy controls consistent with
                their role.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">8. International Data Transfers</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                KnowLens.ai may use vendors and infrastructure operating in multiple countries. When personal data is
                transferred internationally, KnowLens.ai applies reasonable safeguards such as contractual commitments
                and technical protections appropriate to the transfer context.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">9. Data Retention</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                Retention periods vary by data type and purpose. Account records are retained while your account is
                active and for a limited period afterward for legal compliance and security purposes. Billing and
                transaction records may be retained longer to satisfy accounting, tax, and dispute obligations.
                Diagnostic logs and anti-abuse records are retained for operational security windows.
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-700">
                When data is no longer required, KnowLens.ai deletes or de-identifies it within reasonable operational
                limits.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">10. Security Safeguards</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                KnowLens.ai uses layered safeguards including transport encryption, access controls, least-privilege
                permissions, logging, abuse monitoring, and service hardening. No internet service is fully immune from
                risk. If a material incident affecting personal data occurs, KnowLens.ai will investigate, mitigate,
                and provide required notifications under applicable law.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">11. Your Privacy Rights</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                Depending on your location, you may have rights to access, correct, export, delete, or restrict use of
                your personal data, and to object to certain processing. You may also have rights related to automated
                decision-making and data portability.
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-700">
                To exercise these rights, submit a request through
                <Link href="/contact" className="mx-1 text-zinc-900 underline decoration-zinc-300 underline-offset-4">
                  Contact
                </Link>
                and include sufficient details for identity verification. KnowLens.ai may request additional
                verification before processing sensitive requests.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">12. Children&apos;s Privacy</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                KnowLens.ai is not intended for children under the age required by local law to consent independently
                to data processing. If KnowLens.ai learns that personal data was collected from a child in violation of
                applicable law, KnowLens.ai will take reasonable steps to remove that data.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">13. Third-party Links and Services</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                KnowLens.ai may include links to third-party pages or services. Their privacy practices are governed by
                their own policies. Please review those policies directly before submitting personal data on external
                sites.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">14. Changes to This Policy</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                KnowLens.ai may revise this Privacy Policy to reflect product updates, legal requirements, or
                operational changes. Updated versions become effective on posting unless a later date is specified.
                Material changes may be highlighted in-app or on relevant site pages.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">15. Contact and Requests</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                For privacy questions, rights requests, or data concerns, please use
                <Link href="/contact" className="mx-1 text-zinc-900 underline decoration-zinc-300 underline-offset-4">
                  Contact
                </Link>
                and include your account email and request scope so KnowLens.ai can respond efficiently.
              </p>
            </article>
          </div>
        </div>
      </section>
    </MarketingChrome>
  );
}
