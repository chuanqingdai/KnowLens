import Link from "next/link";
import type { Metadata } from "next";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Read the KnowLens.ai Privacy Policy to understand how KnowLens.ai collects, uses, stores, and protects your data.",
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
            How KnowLens.ai Handles Your Data
          </h1>
          <p className="mt-4 text-sm leading-7 text-zinc-700">
            KnowLens.ai respects your privacy. This Privacy Policy explains what information KnowLens.ai collects,
            how KnowLens.ai uses that information, what rights you have, and how KnowLens.ai protects your data.
          </p>
          <p className="mt-2 text-xs text-zinc-500">Effective date: May 24, 2026</p>

          <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p className="text-xs font-medium text-zinc-700">Contents</p>
            <div className="mt-2 grid gap-1 text-xs text-zinc-600 sm:grid-cols-2">
              <p>1. Scope and Definitions</p>
              <p>2. Information We Collect</p>
              <p>3. Legal Basis for Processing</p>
              <p>4. How KnowLens.ai Uses Data</p>
              <p>5. Cookies and Similar Technologies</p>
              <p>6. Data Sharing and Disclosure</p>
              <p>7. Data Retention</p>
              <p>8. Cross-border Data Transfers</p>
              <p>9. Data Storage and Security</p>
              <p>10. Your Privacy Rights</p>
              <p>11. Children&apos;s Privacy</p>
              <p>12. Policy Updates and Contact</p>
            </div>
          </div>

          <div className="mt-8 space-y-8">
            <article>
              <h2 className="text-lg font-semibold text-zinc-900">1. Scope and Definitions</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                This Privacy Policy applies when you use KnowLens.ai websites and product experiences, including
                landing pages, workspace features, membership pages, and feedback channels. It covers account login,
                uploads, generation, and exports across KnowLens.ai. Unless stated otherwise, this policy does not
                apply to third-party websites or services not controlled by KnowLens.ai.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">2. Information We Collect</h2>
              <ul className="mt-3 space-y-2 text-sm leading-7 text-zinc-700">
                <li>Account information: email, display name, avatar, and login provider.</li>
                <li>Content data: text prompts, uploaded files, and submitted URLs.</li>
                <li>Usage data: page events, error logs, and device/browser basics.</li>
                <li>Transaction data: subscription plan, credit usage, and payment status.</li>
              </ul>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">3. Legal Basis for Processing</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                Depending on where you live, KnowLens.ai processes personal data based on one or more legal bases:
                your consent, performance of a contract, compliance with legal obligations, and legitimate interests
                such as improving service reliability, preventing abuse, and protecting platform security.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">4. How KnowLens.ai Uses Data</h2>
              <ul className="mt-3 space-y-2 text-sm leading-7 text-zinc-700">
                <li>To operate core KnowLens.ai features: understanding, drafting, styling, and exports.</li>
                <li>To improve quality and performance: model quality checks, UX improvements, and debugging.</li>
                <li>To protect security and compliance: abuse prevention and legal obligations.</li>
                <li>To provide support: feedback handling, account help, and subscription service.</li>
              </ul>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">5. Cookies and Similar Technologies</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                KnowLens.ai may use cookies, local storage, and similar technologies for authentication, session
                continuity, language preference, security checks, and analytics. You can manage cookie behavior through
                browser settings, but some features of KnowLens.ai may not function properly if essential cookies are
                disabled.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">6. Data Sharing and Disclosure</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                KnowLens.ai does not sell your personal data. KnowLens.ai may share limited data with trusted service
                providers (such as authentication, billing, storage, and infrastructure partners), when required by
                law, or when you explicitly authorize such processing.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">7. Data Retention</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                KnowLens.ai retains data only as long as necessary for service delivery, legal compliance, dispute
                resolution, and abuse prevention. Retention periods may differ by data category (for example account
                records, billing records, logs, and generated project data). When data is no longer needed, KnowLens.ai
                deletes or anonymizes it where reasonably possible.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">8. Cross-border Data Transfers</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                KnowLens.ai may rely on service providers that operate in multiple jurisdictions. Where data is
                transferred across borders, KnowLens.ai uses appropriate safeguards such as contractual protections and
                security controls consistent with applicable data protection laws.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">9. Data Storage and Security</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                KnowLens.ai applies reasonable technical and organizational safeguards, including access control,
                least-privilege policies, encrypted transmission, and security monitoring. You are also responsible
                for protecting your account credentials.
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-700">
                While KnowLens.ai works to protect your data, no online system can guarantee absolute security. If
                KnowLens.ai becomes aware of a material security incident affecting personal data, KnowLens.ai will take
                reasonable response measures and provide notice where required by law.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">10. Your Privacy Rights</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                Depending on your jurisdiction, you may have rights to access, correct, export, or delete your data,
                and to request restriction of processing. For payment-related records, third-party billing provider
                rules may also apply.
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-700">
                To exercise rights, contact KnowLens.ai through the Contact page with enough detail for identity and
                request verification. KnowLens.ai may request additional information to confirm account ownership before
                completing sensitive actions.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">11. Children&apos;s Privacy</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                If you are a minor, please use KnowLens.ai with parent or guardian guidance. If KnowLens.ai discovers
                non-compliant collection of children&apos;s data, KnowLens.ai will take reasonable steps to correct or
                delete the relevant data.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">12. Policy Updates and Contact</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                KnowLens.ai may update this Privacy Policy when product features, legal requirements, or operational
                needs change. If major changes occur, KnowLens.ai will provide notice on the site. If you have
                questions, please use
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
