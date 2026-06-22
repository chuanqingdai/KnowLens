import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import { rateLimitOrThrow } from "@/lib/server/rate-limit";
import { RATE_LIMIT_CONFIG } from "@/lib/server/rate-limit-config";
import { getStripeServerClient, isStripeServerConfigured } from "@/lib/server/stripe";
import { logOpsEvent } from "@/lib/server/store";

export const runtime = "nodejs";

const CREDIT_TOPUP_PACKAGE = {
  id: "insurance_credits_6000",
  name: "BAOX Insurance Credits",
  credits: 6000,
  currency: "cny",
  amountMinor: 19900,
} as const;

function normalizedSiteUrl() {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3000";
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function buildCrossBrowserRedirectUrl(url: string) {
  return `/api/billing/redirect?target=${encodeURIComponent(url)}`;
}

function isWechatPayUnavailableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();
  return (
    normalized.includes("wechat") ||
    normalized.includes("wechat_pay") ||
    normalized.includes("payment_method_types")
  ) && (
    normalized.includes("unavailable") ||
    normalized.includes("not available") ||
    normalized.includes("not supported") ||
    normalized.includes("invalid") ||
    normalized.includes("disabled") ||
    normalized.includes("activate") ||
    normalized.includes("capability")
  );
}

export async function POST(request: NextRequest) {
  let userEmailForLog = "";
  let checkoutSourceForLog = "insurance_credit_topup";
  try {
    const session = await getServerSession(nextAuthOptions);
    const email = session?.user?.email?.trim().toLowerCase();
    userEmailForLog = email ?? "";
    if (!email) {
      logOpsEvent({
        category: "billing",
        action: "credit_topup_checkout_error",
        status: "error",
        source: checkoutSourceForLog,
        code: "BILLING_CREDIT_TOPUP_AUTH_REQUIRED",
        message: "Credit top-up checkout requested without sign-in session.",
      });
      return NextResponse.json({ error: "请先登录后再充值积分。" }, { status: 401 });
    }

    await rateLimitOrThrow({
      scopeKey: `user:${email}`,
      endpoint: "billing-credit-topup-checkout",
      limit: RATE_LIMIT_CONFIG.billingCheckout.limit,
      windowMs: RATE_LIMIT_CONFIG.billingCheckout.windowMs,
    });

    const body = (await request.json().catch(() => ({}))) as { source?: string };
    const checkoutSource = (body.source ?? "insurance_credit_topup").trim().slice(0, 64) || "insurance_credit_topup";
    checkoutSourceForLog = checkoutSource;

    if (!isStripeServerConfigured()) {
      return NextResponse.json(
        {
          code: "STRIPE_ENV_MISSING",
          error: "Stripe checkout is not configured yet.",
        },
        { status: 503 },
      );
    }

    const siteUrl = normalizedSiteUrl();
    const stripe = getStripeServerClient();
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: CREDIT_TOPUP_PACKAGE.currency,
            product_data: {
              name: CREDIT_TOPUP_PACKAGE.name,
              description: `${CREDIT_TOPUP_PACKAGE.credits} credits for BAOX insurance poster generation and downloads.`,
            },
            unit_amount: CREDIT_TOPUP_PACKAGE.amountMinor,
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/membership?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/membership?checkout=cancel`,
      customer_email: email.replace(/^password:/, ""),
      metadata: {
        source: "knowlens-credit-topup",
        purchase_type: "credit_topup",
        package_id: CREDIT_TOPUP_PACKAGE.id,
        package_name: CREDIT_TOPUP_PACKAGE.name,
        topup_credits: String(CREDIT_TOPUP_PACKAGE.credits),
        user_email: email,
        checkout_source: checkoutSource,
      },
      payment_method_types: ["wechat_pay", "alipay", "card"],
      payment_method_options: {
        wechat_pay: {
          client: "web",
        },
      },
      locale: "zh",
      allow_promotion_codes: true,
    });

    logOpsEvent({
      category: "billing",
      action: "credit_topup_checkout_created",
      status: "ok",
      source: checkoutSource,
      userEmail: email,
      message: CREDIT_TOPUP_PACKAGE.id,
      details: {
        packageId: CREDIT_TOPUP_PACKAGE.id,
        credits: CREDIT_TOPUP_PACKAGE.credits,
        amountMinor: CREDIT_TOPUP_PACKAGE.amountMinor,
        currency: CREDIT_TOPUP_PACKAGE.currency,
      },
    });

    return NextResponse.json({
      ok: true,
      mode: "payment",
      checkoutUrl: checkout.url ? buildCrossBrowserRedirectUrl(checkout.url) : null,
      directCheckoutUrl: checkout.url ?? null,
      sessionId: checkout.id,
      packageId: CREDIT_TOPUP_PACKAGE.id,
      credits: CREDIT_TOPUP_PACKAGE.credits,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create credit top-up checkout.";
    if (isWechatPayUnavailableError(error)) {
      logOpsEvent({
        category: "billing",
        action: "credit_topup_checkout_error",
        status: "error",
        source: checkoutSourceForLog,
        userEmail: userEmailForLog || undefined,
        code: "WECHAT_PAY_UNAVAILABLE",
        message,
      });
      return NextResponse.json(
        {
          code: "WECHAT_PAY_UNAVAILABLE",
          error: "微信支付暂不可用，请先使用银行卡支付，或联系我们协助处理。",
        },
        { status: 503 },
      );
    }
    logOpsEvent({
      category: "billing",
      action: "credit_topup_checkout_error",
      status: "error",
      source: checkoutSourceForLog,
      userEmail: userEmailForLog || undefined,
      code: "BILLING_CREDIT_TOPUP_CHECKOUT_INTERNAL",
      message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
