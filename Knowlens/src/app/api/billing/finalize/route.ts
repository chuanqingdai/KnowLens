import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import { getStripeServerClient } from "@/lib/server/stripe";
import { findBillingPlan, type BillingCycle } from "@/lib/billing-plans";
import {
  appendCreditRecordDb,
  hasBillingFulfillment,
  recordBillingFulfillment,
  saveSubscriptionDb,
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
  try {
    const session = await getServerSession(nextAuthOptions);
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Please sign in before finalizing payment." }, { status: 401 });
    }

    const body = (await request.json()) as { sessionId?: string };
    const sessionId = (body.sessionId ?? "").trim();
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
    }

    const stripe = getStripeServerClient();
    const checkout = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (checkout.customer_email?.trim().toLowerCase() !== email) {
      return NextResponse.json({ error: "Checkout session does not belong to current user." }, { status: 403 });
    }

    if (checkout.status !== "complete" || checkout.payment_status !== "paid") {
      return NextResponse.json({
        ok: false,
        status: checkout.status,
        paymentStatus: checkout.payment_status,
        message: "Payment is not completed yet.",
      });
    }

    const meta = checkout.metadata ?? {};
    const planId = (meta.plan_id ?? "").trim();
    const plan = findBillingPlan(planId);
    if (!plan) {
      return NextResponse.json({ error: "Unknown plan in checkout metadata." }, { status: 400 });
    }

    const cycle = parseCycle(meta.billing_cycle);
    if (hasBillingFulfillment(sessionId)) {
      return NextResponse.json({
        ok: true,
        plan: {
          id: plan.id,
          name: plan.name,
        },
        cycle,
        checkoutMode: checkout.mode,
        credited: false,
        duplicate: true,
      });
    }

    const startedAt = new Date().toISOString();
    const renewAt = (cycle === "yearly" ? addMonths(new Date(), 12) : addMonths(new Date(), 1)).toISOString();
    saveSubscriptionDb({
      userEmail: email,
      planId: plan.id,
      planName: plan.name,
      cycle,
      status: "active",
      startedAt,
      renewAt,
    });
    appendCreditRecordDb({
      type: "topup",
      description: `${plan.name} ${cycle} purchase credited`,
      delta: plan.monthlyCredits,
      userEmail: email,
    });
    recordBillingFulfillment({
      sessionId,
      userEmail: email,
      planId: plan.id,
      cycle,
    });

    return NextResponse.json({
      ok: true,
      plan: {
        id: plan.id,
        name: plan.name,
      },
      cycle,
      checkoutMode: checkout.mode,
      credited: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Finalize payment failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
