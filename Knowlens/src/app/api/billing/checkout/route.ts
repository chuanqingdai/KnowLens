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
import {
  findBillingPlan,
  getBillingPlanDefaultCycle,
  isBillingPlanCycleSupported,
  type BillingCycle,
  type BillingCurrency,
} from "@/lib/billing-plans";
import { logOpsEvent } from "@/lib/server/store";
import {
  attributionSource,
  attributionToStripeMetadata,
  normalizeAttributionPayload,
} from "@/lib/server/attribution";

export const runtime = "nodejs";

function normalizedSiteUrl() {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3000";
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function buildFallbackAmountMinorUnits(planId: string, cycle: BillingCycle) {
  const plan = findBillingPlan(planId);
  if (!plan) {
    return null;
  }
  const value = cycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
  return Math.max(100, Math.round(value * 100));
}

function getPlanCurrency(plan: NonNullable<ReturnType<typeof findBillingPlan>>): BillingCurrency {
  return plan.currency ?? "usd";
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

function hasWechatClientConstraintError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("wechat_pay") && normalized.includes("client");
}

function isNonRecurringSubscriptionPriceError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("recurring price") && normalized.includes("subscription");
}

function isDatabaseConnectivityError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();
  return (
    normalized.includes("connect_timeout") ||
    normalized.includes("connection terminated") ||
    normalized.includes("connection refused") ||
    normalized.includes("connection reset") ||
    normalized.includes("connection error") ||
    normalized.includes("timeout") && normalized.includes("neon") ||
    normalized.includes("postgres")
  );
}

async function enforceCheckoutRateLimit(email: string) {
  try {
    await rateLimitOrThrow({
      scopeKey: `user:${email}`,
      endpoint: "billing-checkout",
      limit: RATE_LIMIT_CONFIG.billingCheckout.limit,
      windowMs: RATE_LIMIT_CONFIG.billingCheckout.windowMs,
    });
    return;
  } catch (error) {
    if ((error as Error & { retryAfterSeconds?: number }).retryAfterSeconds) {
      throw error;
    }
    if (!isDatabaseConnectivityError(error)) {
      throw error;
    }
    logOpsEvent({
      category: "billing",
      action: "checkout_rate_limit_degraded",
      status: "info",
      source: "server",
      userEmail: email,
      code: "BILLING_CHECKOUT_RATE_LIMIT_DB_UNAVAILABLE",
      message: error instanceof Error ? error.message : String(error ?? "Database unavailable during checkout rate limit."),
    });
  }
}

async function createCheckoutSessionWithFallback(
  stripe: ReturnType<typeof getStripeServerClient>,
  params: Parameters<ReturnType<typeof getStripeServerClient>["checkout"]["sessions"]["create"]>[0],
) {
  try {
    return await stripe.checkout.sessions.create(params);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!hasWechatClientConstraintError(message)) {
      throw error;
    }
    const cardOnlyParams: Parameters<
      ReturnType<typeof getStripeServerClient>["checkout"]["sessions"]["create"]
    >[0] = {
      ...params,
      payment_method_types: ["card"],
    };
    delete (cardOnlyParams as { payment_method_options?: unknown }).payment_method_options;
    return stripe.checkout.sessions.create(cardOnlyParams);
  }
}

async function createProductBackedSubscriptionSession(
  stripe: ReturnType<typeof getStripeServerClient>,
  input: {
    cycle: BillingCycle;
    recurringProductId: string;
    amount: number;
    currency: BillingCurrency;
    successUrl: string;
    cancelUrl: string;
    email: string;
    metadata: Record<string, string>;
  },
) {
  return createCheckoutSessionWithFallback(stripe, {
    mode: "subscription",
    line_items: [
      {
        price_data: {
          currency: input.currency,
          product: input.recurringProductId,
          unit_amount: input.amount,
          recurring: buildRecurringInterval(input.cycle),
        },
        quantity: 1,
      },
    ],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    customer_email: input.email,
    metadata: input.metadata,
    allow_promotion_codes: true,
  });
}

export async function POST(request: NextRequest) {
  let checkoutSourceForLog = "unknown";
  let userEmailForLog = "";
  try {
    const session = await getServerSession(nextAuthOptions);
    const email = session?.user?.email?.trim().toLowerCase();
    userEmailForLog = email ?? "";
    if (!email) {
      logOpsEvent({
        category: "billing",
        action: "checkout_error",
        status: "error",
        source: "unknown",
        code: "BILLING_CHECKOUT_AUTH_REQUIRED",
        message: "Checkout requested without sign-in session.",
      });
      return NextResponse.json({ error: "Please sign in before checkout." }, { status: 401 });
    }

    await enforceCheckoutRateLimit(email);

    const body = (await request.json()) as {
      planId?: string;
      cycle?: BillingCycle;
      source?: string;
      attribution?: unknown;
    };

    const planId = (body.planId ?? "").trim();
    const requestedCycle: BillingCycle = body.cycle === "monthly" ? "monthly" : "yearly";
    const attribution = normalizeAttributionPayload(body.attribution);
    const checkoutSource =
      (attribution ? attributionSource(attribution) : (body.source ?? "unknown").trim().slice(0, 64)) ||
      "unknown";
    checkoutSourceForLog = checkoutSource;
    const plan = findBillingPlan(planId);
    if (!plan) {
      logOpsEvent({
        category: "billing",
        action: "checkout_error",
        status: "error",
        source: checkoutSource,
        userEmail: email,
        code: "BILLING_CHECKOUT_UNKNOWN_PLAN",
        message: `Unknown billing plan: ${planId || "empty"}`,
      });
      return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
    }
    const cycle = isBillingPlanCycleSupported(plan.id, requestedCycle)
      ? requestedCycle
      : getBillingPlanDefaultCycle(plan.id);
    logOpsEvent({
      category: "billing",
      action: "checkout_attempt",
      status: "info",
      source: checkoutSource,
      userEmail: email,
      message: `${plan.id}:${cycle}`,
      details: {
        planId: plan.id,
        cycle,
        attribution,
        uiSource: body.source ?? null,
      },
    });

    const siteUrl = normalizedSiteUrl();
    const metadata = {
      source: "knowlens-membership",
      user_email: email,
      plan_id: plan.id,
      plan_name: plan.name,
      billing_cycle: cycle,
      monthly_credits: String(plan.monthlyCredits),
      checkout_source: checkoutSource,
      ...attributionToStripeMetadata(attribution),
    };

    const successUrl = `${siteUrl}/membership?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${siteUrl}/membership?checkout=cancel`;
    const recurringPriceId = getStripePriceId(plan.id, cycle);
    const recurringProductId = getStripeProductId(plan.id, cycle);
    const planCurrency = getPlanCurrency(plan);
    const paymentLink = getStripePaymentLink(plan.id, cycle);
    if (!isStripeServerConfigured() && paymentLink) {
      logOpsEvent({
        category: "billing",
        action: "checkout_session_created",
        status: "ok",
        source: checkoutSource,
        userEmail: email,
        message: "payment_link_fallback",
        details: { planId: plan.id, cycle, attribution, uiSource: body.source ?? null },
      });
      return NextResponse.json({
        ok: true,
        mode: "payment_link",
        checkoutUrl: buildCrossBrowserRedirectUrl(paymentLink),
        directCheckoutUrl: paymentLink,
        sessionId: null,
      });
    }

    if (!isStripeServerConfigured()) {
      logOpsEvent({
        category: "billing",
        action: "checkout_error",
        status: "error",
        source: checkoutSource,
        userEmail: email,
        code: "STRIPE_ENV_MISSING",
        message: "Stripe checkout is not configured.",
      });
      return NextResponse.json(
        {
          code: "STRIPE_ENV_MISSING",
          error:
            "Stripe checkout is not configured yet. Please set STRIPE_SECRET_KEY (or STRIPE_API_KEY) in server environment variables, or configure Stripe Payment Links as fallback.",
        },
        { status: 503 },
      );
    }

    const stripe = getStripeServerClient();

    if (recurringPriceId) {
      let sessionResult: Awaited<ReturnType<typeof createCheckoutSessionWithFallback>>;
      let sessionMessage = `subscription_price_id:${recurringPriceId}`;
      try {
        sessionResult = await createCheckoutSessionWithFallback(stripe, {
          mode: "subscription",
          line_items: [{ price: recurringPriceId, quantity: 1 }],
          success_url: successUrl,
          cancel_url: cancelUrl,
          customer_email: email,
          metadata,
          allow_promotion_codes: true,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!recurringProductId || !isNonRecurringSubscriptionPriceError(message)) {
          throw error;
        }
        const amount = buildFallbackAmountMinorUnits(plan.id, cycle);
        if (!amount) {
          throw error;
        }
        logOpsEvent({
          category: "billing",
          action: "checkout_price_id_fallback",
          status: "info",
          source: checkoutSource,
          userEmail: email,
          code: "STRIPE_PRICE_NOT_RECURRING",
          message: `Configured price is not recurring; using product-backed subscription for ${plan.id}:${cycle}.`,
          details: { planId: plan.id, cycle, priceId: recurringPriceId, attribution, uiSource: body.source ?? null },
        });
        sessionResult = await createProductBackedSubscriptionSession(stripe, {
          cycle,
          recurringProductId,
          amount,
          currency: planCurrency,
          successUrl,
          cancelUrl,
          email,
          metadata,
        });
        sessionMessage = `subscription_price_data_fallback:${recurringProductId}`;
      }
      logOpsEvent({
        category: "billing",
        action: "checkout_session_created",
        status: "ok",
        source: checkoutSource,
        userEmail: email,
        message: sessionMessage,
        details: { planId: plan.id, cycle, attribution, uiSource: body.source ?? null },
      });
      return NextResponse.json({
        ok: true,
        mode: "subscription",
        checkoutUrl: sessionResult.url ? buildCrossBrowserRedirectUrl(sessionResult.url) : null,
        directCheckoutUrl: sessionResult.url ?? null,
        sessionId: sessionResult.id,
      });
    }

    if (recurringProductId) {
      const amount = buildFallbackAmountMinorUnits(plan.id, cycle);
      if (!amount) {
        return NextResponse.json({ error: "Unable to resolve recurring amount." }, { status: 400 });
      }
      const sessionResult = await createProductBackedSubscriptionSession(stripe, {
        cycle,
        recurringProductId,
        amount,
        currency: planCurrency,
        successUrl,
        cancelUrl,
        email,
        metadata,
      });
      logOpsEvent({
        category: "billing",
        action: "checkout_session_created",
        status: "ok",
        source: checkoutSource,
        userEmail: email,
        message: `subscription_price_data:${recurringProductId}`,
        details: { planId: plan.id, cycle, attribution, uiSource: body.source ?? null },
      });
      return NextResponse.json({
        ok: true,
        mode: "subscription",
        checkoutUrl: sessionResult.url ? buildCrossBrowserRedirectUrl(sessionResult.url) : null,
        directCheckoutUrl: sessionResult.url ?? null,
        sessionId: sessionResult.id,
      });
    }

    const amount = buildFallbackAmountMinorUnits(plan.id, cycle);
    if (!amount) {
      return NextResponse.json({ error: "Unable to resolve fallback amount." }, { status: 400 });
    }

    const fallbackSession = await createCheckoutSessionWithFallback(stripe, {
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: planCurrency,
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
      payment_method_options: {
        wechat_pay: {
          client: "web",
        },
      },
      allow_promotion_codes: true,
    });
    logOpsEvent({
      category: "billing",
      action: "checkout_session_created",
      status: "ok",
      source: checkoutSource,
      userEmail: email,
      message: "one_time_fallback",
      details: { planId: plan.id, cycle, attribution, uiSource: body.source ?? null },
    });

    return NextResponse.json({
      ok: true,
      mode: "payment",
      checkoutUrl: fallbackSession.url ? buildCrossBrowserRedirectUrl(fallbackSession.url) : null,
      directCheckoutUrl: fallbackSession.url ?? null,
      sessionId: fallbackSession.id,
      fallback: true,
    });
  } catch (error) {
    const retryAfter = (error as Error & { retryAfterSeconds?: number }).retryAfterSeconds;
    if (retryAfter) {
      logOpsEvent({
        category: "billing",
        action: "checkout_error",
        status: "error",
        source: checkoutSourceForLog,
        userEmail: userEmailForLog || undefined,
        code: "BILLING_CHECKOUT_RATE_LIMIT",
        message: "Too many checkout attempts.",
      });
      return NextResponse.json(
        { error: "Too many checkout attempts. Please retry later." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
    const message = error instanceof Error ? error.message : "Failed to create checkout session.";
    const normalized = message.toLowerCase();
    if (normalized.includes("invalid api key") || normalized.includes("stripeauthenticationerror")) {
      logOpsEvent({
        category: "billing",
        action: "checkout_error",
        status: "error",
        source: checkoutSourceForLog,
        userEmail: userEmailForLog || undefined,
        code: "STRIPE_ENV_INVALID",
        message,
      });
      return NextResponse.json(
        {
          code: "STRIPE_ENV_INVALID",
          error:
            "Stripe checkout is not configured correctly. Please verify STRIPE_SECRET_KEY (or STRIPE_API_KEY) in deployment settings.",
        },
        { status: 503 },
      );
    }
    logOpsEvent({
      category: "billing",
      action: "checkout_error",
      status: "error",
      source: checkoutSourceForLog,
      userEmail: userEmailForLog || undefined,
      code: "BILLING_CHECKOUT_INTERNAL",
      message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
