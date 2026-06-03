import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import { getStripeServerClient } from "@/lib/server/stripe";
import { findBillingPlan, type BillingCycle } from "@/lib/billing-plans";
import {
  applyBillingFulfillmentAtomic,
  hasBillingFulfillment,
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

export async function POST(request: NextRequest) {
  let userEmailForLog = "";
  let checkoutSourceForLog = "unknown";
  try {
    const session = await getServerSession(nextAuthOptions);
    const email = session?.user?.email?.trim().toLowerCase();
    userEmailForLog = email ?? "";
    if (!email) {
      logOpsEvent({
        category: "billing",
        action: "checkout_finalize_error",
        status: "error",
        source: "unknown",
        code: "BILLING_FINALIZE_AUTH_REQUIRED",
        message: "Finalize requested without sign-in session.",
      });
      return NextResponse.json({ error: "Please sign in before finalizing payment." }, { status: 401 });
    }

    const body = (await request.json()) as { sessionId?: string };
    const sessionId = (body.sessionId ?? "").trim();
    if (!sessionId) {
      logOpsEvent({
        category: "billing",
        action: "checkout_finalize_error",
        status: "error",
        source: "unknown",
        userEmail: email,
        code: "BILLING_FINALIZE_MISSING_SESSION",
        message: "Missing checkout session ID in finalize request.",
      });
      return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
    }

    const stripe = getStripeServerClient();
    const checkout = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (checkout.customer_email?.trim().toLowerCase() !== email) {
      logOpsEvent({
        category: "billing",
        action: "checkout_finalize_error",
        status: "error",
        source: "unknown",
        userEmail: email,
        code: "BILLING_FINALIZE_EMAIL_MISMATCH",
        message: "Checkout session email mismatch.",
        details: {
          sessionId,
          checkoutEmail: checkout.customer_email ?? null,
        },
      });
      return NextResponse.json({ error: "Checkout session does not belong to current user." }, { status: 403 });
    }

    if (checkout.status !== "complete" || checkout.payment_status !== "paid") {
      const normalized =
        checkout.status === "expired" || checkout.status === "open"
          ? "canceled_or_incomplete"
          : checkout.payment_status === "unpaid" || checkout.payment_status === "no_payment_required"
            ? "payment_failed_or_unpaid"
            : "pending";
      logOpsEvent({
        category: "billing",
        action: "checkout_finalize_failed",
        status: "error",
        source: "unknown",
        userEmail: email,
        code: normalized,
        message: "Payment is not completed or not paid during finalize.",
        details: {
          sessionId,
          checkoutStatus: checkout.status,
          paymentStatus: checkout.payment_status,
        },
      });
      return NextResponse.json({
        ok: false,
        reason: normalized,
        status: checkout.status,
        paymentStatus: checkout.payment_status,
        message: "Payment is not completed or not paid.",
      });
    }

    const meta = checkout.metadata ?? {};
    const planId = (meta.plan_id ?? "").trim();
    const plan = findBillingPlan(planId);
    if (!plan) {
      return NextResponse.json({ error: "Unknown plan in checkout metadata." }, { status: 400 });
    }

    const cycle = parseCycle(meta.billing_cycle);
    const checkoutSource = (meta.checkout_source ?? "unknown").trim().slice(0, 64) || "unknown";
    checkoutSourceForLog = checkoutSource;
    if (await hasBillingFulfillment(sessionId)) {
      logOpsEvent({
        category: "billing",
        action: "checkout_finalize_duplicate",
        status: "info",
        source: checkoutSource,
        userEmail: email,
        message: "Finalize duplicate: billing fulfillment already exists.",
        details: { sessionId },
      });
      return NextResponse.json({
        ok: true,
        plan: {
          id: plan.id,
          name: plan.name,
        },
        cycle,
        checkoutMode: checkout.mode,
        checkoutSource,
        credited: false,
        duplicate: true,
      });
    }

    const now = new Date();
    const startedAt = now.toISOString();
    const renewAt = (cycle === "yearly" ? addMonths(now, 12) : addMonths(now, 1)).toISOString();

    const result = await applyBillingFulfillmentAtomic({
      sessionId,
      userEmail: email,
      planId: plan.id,
      planName: plan.name,
      cycle,
      startedAt,
      renewAt,
      monthlyCredits: plan.monthlyCredits,
      checkoutSource,
    });

    if (!result.applied) {
      logOpsEvent({
        category: "billing",
        action: "checkout_finalize_duplicate",
        status: "info",
        source: checkoutSource,
        userEmail: email,
        message: "Finalize duplicate: atomic billing apply skipped.",
        details: { sessionId },
      });
      return NextResponse.json({
        ok: true,
        plan: {
          id: plan.id,
          name: plan.name,
        },
        cycle,
        checkoutMode: checkout.mode,
        checkoutSource,
        credited: false,
        duplicate: true,
      });
    }

    logOpsEvent({
      category: "billing",
      action: "checkout_finalize_success",
      status: "ok",
      source: checkoutSource,
      userEmail: email,
      message: `${plan.id}:${cycle}`,
      details: { sessionId },
    });

    return NextResponse.json({
      ok: true,
      plan: {
        id: plan.id,
        name: plan.name,
      },
      cycle,
      checkoutMode: checkout.mode,
      checkoutSource,
      credited: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Finalize payment failed.";
    const normalized = message.toLowerCase();
    if (normalized.includes("stripe is not configured")) {
      logOpsEvent({
        category: "billing",
        action: "checkout_finalize_error",
        status: "error",
        source: checkoutSourceForLog,
        userEmail: userEmailForLog || undefined,
        code: "STRIPE_ENV_MISSING",
        message,
      });
      return NextResponse.json(
        {
          code: "STRIPE_ENV_MISSING",
          error:
            "Stripe finalize is not configured yet. Please set STRIPE_SECRET_KEY (or STRIPE_API_KEY) in server environment variables.",
        },
        { status: 503 },
      );
    }
    if (normalized.includes("invalid api key") || normalized.includes("stripeauthenticationerror")) {
      logOpsEvent({
        category: "billing",
        action: "checkout_finalize_error",
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
            "Stripe finalize is not configured correctly. Please verify STRIPE_SECRET_KEY (or STRIPE_API_KEY) in deployment settings.",
        },
        { status: 503 },
      );
    }
    logOpsEvent({
      category: "billing",
      action: "checkout_finalize_error",
      status: "error",
      source: checkoutSourceForLog,
      userEmail: userEmailForLog || undefined,
      code: "BILLING_FINALIZE_INTERNAL",
      message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
