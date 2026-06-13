import Link from "next/link";
import type { Metadata } from "next";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";

export const metadata: Metadata = {
  title: "Payment Terms",
  description:
    "Read KnowLens.ai Payment Terms, including subscription billing, credit usage rules, renewals, refunds, and payment dispute handling.",
  alternates: {
    canonical: "/payment-terms",
  },
};

export default function PaymentTermsPage() {
  return (
    <MarketingChrome>
      <section className="mx-auto w-full max-w-4xl px-4 pb-14 pt-8 sm:px-6 sm:pt-10">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs text-zinc-500">Payment Terms</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
            Billing and Payment Terms for KnowLens.ai
          </h1>
          <p className="mt-4 text-sm leading-7 text-zinc-700">
            These Payment Terms apply to all paid plans, credit grants, and paid feature access on KnowLens.ai.
            Together with the
            <Link href="/terms" className="mx-1 text-zinc-900 underline decoration-zinc-300 underline-offset-4">
              Terms of Service
            </Link>
            and
            <Link href="/privacy" className="mx-1 text-zinc-900 underline decoration-zinc-300 underline-offset-4">
              Privacy Policy
            </Link>
            , they govern your purchases and subscription use.
          </p>
          <p className="mt-2 text-xs text-zinc-500">Effective date: May 26, 2026</p>
          <p className="mt-1 text-xs text-zinc-500">Last updated: May 26, 2026</p>

          <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p className="text-xs font-medium text-zinc-700">Contents</p>
            <div className="mt-2 grid gap-1 text-xs text-zinc-600 sm:grid-cols-2">
              <p>1. Plan Types and Pricing Display</p>
              <p>2. Payment Processing and Authorization</p>
              <p>3. Subscription Cycles and Auto-renewal</p>
              <p>4. Credit Grants and Usage Rules</p>
              <p>5. Promotional Pricing and Discount Windows</p>
              <p>6. Failed Charges and Recovery</p>
              <p>7. Cancellation and Effective Date</p>
              <p>8. Refund Policy</p>
              <p>9. Taxes, Currency, and Invoices</p>
              <p>10. Chargebacks and Payment Disputes</p>
              <p>11. Anti-fraud and Abuse Controls</p>
              <p>12. Changes to Paid Plans</p>
              <p>13. Contact for Billing Matters</p>
            </div>
          </div>

          <div className="mt-8 space-y-8">
            <article>
              <h2 className="text-lg font-semibold text-zinc-900">1. Plan Types and Pricing Display</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                KnowLens.ai may offer free access, monthly subscriptions, annual subscriptions, and additional
                paid-feature packages. Current prices, plan names, included credits, and major feature differences are
                displayed on the active billing interface at purchase time. If there is any difference between older
                marketing copy and current checkout pricing, the checkout pricing controls.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">2. Payment Processing and Authorization</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                Payments are processed by third-party payment providers. By submitting payment details, you authorize
                the provider and KnowLens.ai to charge the selected payment method for the plan, renewal cycle, taxes,
                and any applicable fees shown at checkout.
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-700">
                KnowLens.ai does not store full payment card numbers. Payment method security, risk controls, and
                authentication flows are subject to provider standards and requirements.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">3. Subscription Cycles and Auto-renewal</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                Paid subscriptions renew automatically unless canceled before the next renewal time. Monthly plans renew
                each month. Annual plans renew each year. If annual plans include monthly credit grants, those credits
                are provisioned per monthly cycle according to the active plan design.
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-700">
                Renewal charges are attempted using your default payment method. You are responsible for maintaining
                valid payment information.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">4. Credit Grants and Usage Rules</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                Credits are an internal usage unit for generation and export features. Credits are not legal tender,
                not cash equivalents, and not transferable between users unless a formal transfer feature is explicitly
                provided. Credit costs may vary by output type, output quality, model selection, and promotional rules.
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-700">
                Credit usage is consumed at execution time. If a generation attempt fails due to platform error,
                KnowLens.ai may restore credits as part of normal recovery logic. Repeated abusive retries may be
                restricted by risk controls.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">5. Promotional Pricing and Discount Windows</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                KnowLens.ai may run promotional pricing, optimized-credit events, or limited-time offers. Promotional
                terms can be account-specific and may depend on region, risk profile, traffic strategy, and eligibility
                checks. Unless expressly stated, promotions cannot be combined with other offers.
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-700">
                Promotional conversion rates and discount labels may be adjusted, paused, or discontinued. Once a
                promotion ends, standard pricing and standard credit rules apply to future usage.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">6. Failed Charges and Recovery</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                If a charge fails at sign-up or renewal, access to paid features may be limited until payment succeeds.
                KnowLens.ai and payment providers may retry failed payments using industry-standard retry schedules. If
                retries fail, subscriptions may be downgraded, paused, or canceled according to provider and plan
                policy.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">7. Cancellation and Effective Date</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                You can cancel renewal through designated account or profile billing management interfaces. Cancellation
                generally prevents the next renewal charge and remains effective at the end of the current paid period,
                unless mandatory local law requires otherwise.
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-700">
                Canceling a subscription does not automatically reverse prior charges already processed for the current
                cycle, subject to applicable refund rules.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">8. Refund Policy</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                Except where required by law, payments are generally non-refundable once service access or credits have
                been provisioned. Refund requests are reviewed based on plan type, account activity, usage status,
                payment method, and regional legal requirements.
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-700">
                If your jurisdiction grants a mandatory withdrawal period or statutory refund rights, those rights are
                honored to the extent required by applicable law.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">9. Taxes, Currency, and Invoices</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                Prices may be displayed in USD or local currency where supported. Taxes, VAT, or similar charges may
                be added where required by law. You are responsible for providing accurate billing information and for
                any tax obligations not collected at checkout.
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-700">
                Where invoice features are available, invoices are generated using billing data linked to your payment
                profile and transaction records.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">10. Chargebacks and Payment Disputes</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                If you believe a charge is incorrect, please contact KnowLens.ai support before filing a chargeback so
                the issue can be reviewed quickly. Chargebacks, payment reversals, or fraud alerts may trigger
                temporary restrictions on paid features and associated credits while investigation is pending.
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-700">
                If a chargeback is resolved against your claim and service has already been delivered, KnowLens.ai may
                recover equivalent value through account restrictions or other lawful remedies.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">11. Anti-fraud and Abuse Controls</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                To protect users and platform stability, KnowLens.ai may apply anti-fraud screening, transaction
                monitoring, login risk checks, generation rate limits, and credit abuse controls. Transactions flagged
                as high risk may be delayed, limited, or declined.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">12. Changes to Paid Plans</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                KnowLens.ai may update plan names, prices, credits, features, and usage rules to reflect product
                evolution, infrastructure cost changes, legal requirements, or abuse mitigation needs. Material changes
                affecting future renewals are communicated through billing pages, email notices, or in-app notices
                where feasible.
              </p>
            </article>

            <article className="border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold text-zinc-900">13. Contact for Billing Matters</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                For subscription support, payment questions, invoice requests, or billing disputes, please use
                <Link href="/contact" className="mx-1 text-zinc-900 underline decoration-zinc-300 underline-offset-4">
                  Contact
                </Link>
                and include your account email, payment date, and relevant order references to speed up review.
              </p>
            </article>
          </div>
        </div>
      </section>
    </MarketingChrome>
  );
}
