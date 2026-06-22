import { NextResponse } from "next/server";
import Stripe from "stripe";
import { findBillingPlan, type BillingCycle } from "@/lib/billing-plans";
import {
  getStripeServerClient,
  getStripeWebhookSecret,
  isStripeServerConfigured,
} from "@/lib/server/stripe";
import {
  applyCreditTopupFulfillmentAtomic,
  applyBillingFulfillmentAtomic,
  getSubscriptionDbByStripeSubscriptionId,
  logOpsEvent,
  syncStripeSubscriptionState,
} from "@/lib/server/store";

export const runtime = "nodejs";

function addMonths(date: Date, count: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + count);
  return next;
}

function parseCycle(value: string | null | undefined): BillingCycle {
  return value === "monthly" ? "monthly" : "yearly";
}

function resolveCheckoutSource(session: Stripe.Checkout.Session) {
  return (session.metadata?.checkout_source ?? "stripe_webhook").trim().slice(0, 64) || "stripe_webhook";
}

function isPaidCheckout(session: Stripe.Checkout.Session) {
  if (session.status !== "complete") {
    return false;
  }
  return session.payment_status === "paid" || session.payment_status === "no_payment_required";
}

function parsePositiveInteger(value: string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

async function parseStripeEvent(request: Request) {
  const payload = await request.text();
  if (!isStripeServerConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      return JSON.parse(payload) as Stripe.Event;
    }
    throw new Error("Stripe is not configured.");
  }
  const stripe = getStripeServerClient();
  const webhookSecret = getStripeWebhookSecret();
  if (!webhookSecret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("STRIPE_WEBHOOK_SECRET is required in production.");
    }
    return JSON.parse(payload) as Stripe.Event;
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    throw new Error("Missing Stripe webhook signature.");
  }
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const sessionId = session.id;
  const email = (session.metadata?.user_email ?? session.customer_email ?? "").trim().toLowerCase();
  const checkoutSource = resolveCheckoutSource(session);
  if (!email) {
    logOpsEvent({
      category: "billing",
      action: "stripe_webhook_error",
      status: "error",
      source: checkoutSource,
      code: "STRIPE_WEBHOOK_MISSING_EMAIL",
      message: "Checkout session completed without a customer email.",
      details: { sessionId },
    });
    return { ok: false, status: 400, code: "STRIPE_WEBHOOK_MISSING_EMAIL" };
  }
  if (!isPaidCheckout(session)) {
    logOpsEvent({
      category: "billing",
      action: "stripe_webhook_ignored",
      status: "info",
      source: checkoutSource,
      userEmail: email,
      code: "STRIPE_WEBHOOK_UNPAID_CHECKOUT",
      message: "Checkout session was not complete and paid.",
      details: {
        sessionId,
        checkoutStatus: session.status,
        paymentStatus: session.payment_status,
      },
    });
    return { ok: true, status: 200, ignored: true };
  }

  if (session.metadata?.purchase_type === "credit_topup") {
    const credits = parsePositiveInteger(session.metadata.topup_credits);
    const packageId = (session.metadata.package_id ?? "credit_topup").trim().slice(0, 80) || "credit_topup";
    const packageName = (session.metadata.package_name ?? "Credit top-up").trim().slice(0, 120) || "Credit top-up";
    if (credits <= 0) {
      logOpsEvent({
        category: "billing",
        action: "stripe_webhook_error",
        status: "error",
        source: checkoutSource,
        userEmail: email,
        code: "STRIPE_WEBHOOK_INVALID_TOPUP_METADATA",
        message: "Credit top-up checkout completed without valid credit metadata.",
        details: { sessionId, packageId, credits },
      });
      return { ok: false, status: 400, code: "STRIPE_WEBHOOK_INVALID_TOPUP_METADATA" };
    }
    const result = await applyCreditTopupFulfillmentAtomic({
      sessionId,
      userEmail: email,
      packageId,
      packageName,
      credits,
      checkoutSource,
    });
    logOpsEvent({
      category: "billing",
      action: result.applied ? "stripe_credit_topup_fulfilled" : "stripe_credit_topup_duplicate",
      status: result.applied ? "ok" : "info",
      source: checkoutSource,
      userEmail: email,
      message: `${packageId}:${credits}`,
      details: { sessionId, packageId, credits },
    });
    return { ok: true, status: 200, applied: result.applied };
  }

  const planId = (session.metadata?.plan_id ?? "").trim();
  const plan = findBillingPlan(planId);
  if (!plan) {
    logOpsEvent({
      category: "billing",
      action: "stripe_webhook_error",
      status: "error",
      source: checkoutSource,
      userEmail: email,
      code: "STRIPE_WEBHOOK_UNKNOWN_PLAN",
      message: `Unknown plan in Stripe metadata: ${planId || "empty"}`,
      details: { sessionId },
    });
    return { ok: false, status: 400, code: "STRIPE_WEBHOOK_UNKNOWN_PLAN" };
  }

  const cycle = parseCycle(session.metadata?.billing_cycle);
  const now = new Date();
  const result = await applyBillingFulfillmentAtomic({
    sessionId,
    userEmail: email,
    planId: plan.id,
    planName: plan.name,
    cycle,
    stripeSubscriptionId:
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id,
    startedAt: now.toISOString(),
    renewAt: (cycle === "yearly" ? addMonths(now, 12) : addMonths(now, 1)).toISOString(),
    monthlyCredits: plan.monthlyCredits,
    checkoutSource,
  });

  logOpsEvent({
    category: "billing",
    action: result.applied ? "stripe_webhook_fulfilled" : "stripe_webhook_duplicate",
    status: result.applied ? "ok" : "info",
    source: checkoutSource,
    userEmail: email,
    message: `${plan.id}:${cycle}`,
    details: { sessionId },
  });
  return { ok: true, status: 200, applied: result.applied };
}

function normalizeStripeSubscriptionStatus(
  status: string | null | undefined,
  cancelAtPeriodEnd = false,
): "inactive" | "active" | "canceling" | "canceled" {
  const normalized = (status || "").trim().toLowerCase();
  if (normalized === "canceled" || normalized === "unpaid" || normalized === "incomplete_expired") {
    return "canceled";
  }
  if (cancelAtPeriodEnd && (normalized === "active" || normalized === "trialing" || normalized === "past_due")) {
    return "canceling";
  }
  if (normalized === "active" || normalized === "trialing" || normalized === "past_due") {
    return "active";
  }
  return "inactive";
}

async function handleStripeSubscriptionLifecycle(source: string, stripeSubscriptionId: string) {
  const normalizedId = stripeSubscriptionId.trim();
  if (!normalizedId) {
    return { ok: true, status: 200, ignored: true };
  }
  const existing = await getSubscriptionDbByStripeSubscriptionId(normalizedId);
  if (!existing) {
    logOpsEvent({
      category: "billing",
      action: "stripe_webhook_ignored",
      status: "info",
      source,
      code: "STRIPE_SUBSCRIPTION_NOT_LINKED",
      message: "Subscription lifecycle event ignored because no local subscription row was found.",
      details: { stripeSubscriptionId: normalizedId },
    });
    return { ok: true, status: 200, ignored: true };
  }
  const stripe = getStripeServerClient();
  const subscription = (await stripe.subscriptions.retrieve(normalizedId)) as Stripe.Subscription & {
    current_period_end?: number;
  };
  const renewAt = new Date(Number(subscription.current_period_end || 0) * 1000 || Date.now()).toISOString();
  const status = normalizeStripeSubscriptionStatus(
    subscription.status,
    Boolean(subscription.cancel_at_period_end),
  );
  await syncStripeSubscriptionState({
    stripeSubscriptionId: normalizedId,
    renewAt,
    status,
    canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
  });
  logOpsEvent({
    category: "billing",
    action: "stripe_subscription_synced",
    status: "ok",
    source,
    userEmail: typeof (existing as { user_email?: unknown }).user_email === "string"
      ? ((existing as { user_email?: string }).user_email || undefined)
      : undefined,
    message: `${status}:${renewAt}`,
    details: {
      stripeSubscriptionId: normalizedId,
      status,
      renewAt,
    },
  });
  return { ok: true, status: 200, applied: true };
}

export async function POST(request: Request) {
  try {
    const event = await parseStripeEvent(request);
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const result = await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      return NextResponse.json(result, { status: result.status });
    }
    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice & {
        subscription?: string | { id?: string } | null;
      };
      const subscriptionId =
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id;
      const result = await handleStripeSubscriptionLifecycle("stripe_invoice_paid", subscriptionId || "");
      return NextResponse.json(result, { status: result.status });
    }
    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const result = await handleStripeSubscriptionLifecycle("stripe_subscription_event", subscription.id);
      return NextResponse.json(result, { status: result.status });
    }
    return NextResponse.json({ ok: true, ignored: true, type: event.type });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe webhook failed.";
    logOpsEvent({
      category: "billing",
      action: "stripe_webhook_error",
      status: "error",
      source: "stripe_webhook",
      code: "STRIPE_WEBHOOK_INTERNAL",
      message,
    });
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 400 },
    );
  }
}
