import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import { rateLimitOrThrow } from "@/lib/server/rate-limit";
import { RATE_LIMIT_CONFIG } from "@/lib/server/rate-limit-config";
import {
  getStripePaymentLink,
  getStripePriceId,
  getStripeProductId,
  getStripeServerClient,
  isStripeServerConfigured,
} from "@/lib/server/stripe";
import { findBillingPlan, type BillingCycle } from "@/lib/billing-plans";

export const runtime = "nodejs";

function normalizedSiteUrl() {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3000";
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function buildFallbackAmountCents(planId: string, cycle: BillingCycle) {
  const plan = findBillingPlan(planId);
  if (!plan) {
    return null;
  }
  const usdValue = cycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
  return Math.max(100, Math.round(usdValue * 100));
}

function buildRecurringInterval(cycle: BillingCycle) {
  return cycle === "yearly"
    ? { interval: "year" as const, interval_count: 1 }
    : { interval: "month" as const, interval_count: 1 };
}

function buildCrossBrowserRedirectUrl(url: string) {
  const safe = encodeURIComponent(url);
  return `/api/billing/redirect?target=${safe}`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(nextAuthOptions);
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Please sign in before checkout." }, { status: 401 });
    }

    rateLimitOrThrow({
      scopeKey: `user:${email}`,
      endpoint: "billing-checkout",
      limit: RATE_LIMIT_CONFIG.billingCheckout.limit,
      windowMs: RATE_LIMIT_CONFIG.billingCheckout.windowMs,
    });

    const body = (await request.json()) as {
      planId?: string;
      cycle?: BillingCycle;
    };

    const planId = (body.planId ?? "").trim();
    const cycle = body.cycle === "monthly" ? "monthly" : "yearly";
    const plan = findBillingPlan(planId);
    if (!plan) {
      return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
    }

    const siteUrl = normalizedSiteUrl();
    const metadata = {
      source: "knowlens-membership",
      user_email: email,
      plan_id: plan.id,
      plan_name: plan.name,
      billing_cycle: cycle,
      monthly_credits: String(plan.monthlyCredits),
    };

    const successUrl = `${siteUrl}/membership?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${siteUrl}/membership?checkout=cancel`;
    const recurringPriceId = getStripePriceId(plan.id, cycle);
    const recurringProductId = getStripeProductId(plan.id, cycle);
    const paymentLink = getStripePaymentLink(plan.id, cycle);
    if (!isStripeServerConfigured() && paymentLink) {
      return NextResponse.json({
        ok: true,
        mode: "payment_link",
        checkoutUrl: buildCrossBrowserRedirectUrl(paymentLink),
        sessionId: null,
      });
    }

    if (!isStripeServerConfigured()) {
      return NextResponse.json(
        {
          error:
            "Stripe checkout is not configured yet. Please add a valid STRIPE_SECRET_KEY, or configure Stripe Payment Links as fallback.",
        },
        { status: 503 },
      );
    }

    const stripe = getStripeServerClient();

    if (recurringPriceId) {
      const sessionResult = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: recurringPriceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: email,
        metadata,
        allow_promotion_codes: true,
      });
      return NextResponse.json({
        ok: true,
        mode: "subscription",
        checkoutUrl: sessionResult.url ? buildCrossBrowserRedirectUrl(sessionResult.url) : null,
        sessionId: sessionResult.id,
      });
    }

    if (recurringProductId) {
      const amount = buildFallbackAmountCents(plan.id, cycle);
      if (!amount) {
        return NextResponse.json({ error: "Unable to resolve recurring amount." }, { status: 400 });
      }
      const sessionResult = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product: recurringProductId,
              unit_amount: amount,
              recurring: buildRecurringInterval(cycle),
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: email,
        metadata,
        allow_promotion_codes: true,
      });
      return NextResponse.json({
        ok: true,
        mode: "subscription",
        checkoutUrl: sessionResult.url ? buildCrossBrowserRedirectUrl(sessionResult.url) : null,
        sessionId: sessionResult.id,
      });
    }

    const amount = buildFallbackAmountCents(plan.id, cycle);
    if (!amount) {
      return NextResponse.json({ error: "Unable to resolve fallback amount." }, { status: 400 });
    }

    const fallbackSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `KnowLens ${plan.name} (${cycle})`,
              description: `Fallback one-time payment for ${plan.name} ${cycle} plan.`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: email,
      metadata: {
        ...metadata,
        fallback_reason: "missing_recurring_price_id",
      },
      payment_method_types: ["card", "alipay", "wechat_pay"],
      allow_promotion_codes: true,
    });

    return NextResponse.json({
      ok: true,
      mode: "payment",
      checkoutUrl: fallbackSession.url ? buildCrossBrowserRedirectUrl(fallbackSession.url) : null,
      sessionId: fallbackSession.id,
      fallback: true,
    });
  } catch (error) {
    const retryAfter = (error as Error & { retryAfterSeconds?: number }).retryAfterSeconds;
    if (retryAfter) {
      return NextResponse.json(
        { error: "Too many checkout attempts. Please retry later." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
    const message = error instanceof Error ? error.message : "Failed to create checkout session.";
    const normalized = message.toLowerCase();
    if (normalized.includes("invalid api key") || normalized.includes("stripeauthenticationerror")) {
      return NextResponse.json(
        {
          error:
            "Stripe checkout is not configured correctly. Please verify STRIPE_SECRET_KEY in deployment settings.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
