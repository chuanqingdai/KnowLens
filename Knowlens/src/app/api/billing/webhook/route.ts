import { NextResponse } from "next/server";
import Stripe from "stripe";
import { findBillingPlan, type BillingCycle } from "@/lib/billing-plans";
import {
  getStripeServerClient,
  getStripeWebhookSecret,
  isStripeServerConfigured,
} from "@/lib/server/stripe";
import {
  applyBillingFulfillmentAtomic,
  logOpsEvent,
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

async function parseStripeEvent(request: Request) {
  const payload = await request.text();
  if (!isStripeServerConfigured()) {
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
  const email = (session.customer_email ?? session.metadata?.user_email ?? "").trim().toLowerCase();
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
