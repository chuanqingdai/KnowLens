import Stripe from "stripe";

let stripeClient: Stripe | null = null;

const DEFAULT_STRIPE_INSURANCE_PRODUCT_YEARLY = "prod_UjexmkNahAsZYi";
const DEFAULT_STRIPE_INSURANCE_PRICE_YEARLY = "price_1TkBdJRtp72JQAtkQDuUnOXr";

const STRIPE_SECRET_ENV_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_API_KEY",
  "STRIPE_LIVE_SECRET_KEY",
] as const;

function isPlaceholderSecret(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return (
    normalized.startsWith("replace-") ||
    normalized.includes("placeholder") ||
    normalized.includes("your-stripe-secret-key")
  );
}

function getConfiguredStripeSecret() {
  for (const key of STRIPE_SECRET_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (!value) {
      continue;
    }
    if (isPlaceholderSecret(value)) {
      continue;
    }
    return value;
  }
  return null;
}

export function isStripeServerConfigured() {
  return Boolean(getConfiguredStripeSecret());
}

export function getStripePaymentLink(planId: string, cycle: "monthly" | "yearly") {
  const map: Record<string, { monthly?: string; yearly?: string }> = {
    starter: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_STARTER_MONTHLY,
      yearly: process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_STARTER_YEARLY,
    },
    pro: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_CREATOR_MONTHLY,
      yearly: process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_CREATOR_YEARLY,
    },
    scale: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_PRO_MONTHLY,
      yearly: process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_PRO_YEARLY,
    },
    insurance: {
      yearly:
        process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_INSURANCE_YEARLY?.trim() ||
        process.env.NEXT_PUBLIC_STRIPE_INSURANCE_PAYMENT_LINK_YEARLY?.trim(),
    },
  };
  const value = map[planId]?.[cycle]?.trim();
  return value || null;
}

export function getStripeServerClient() {
  if (stripeClient) {
    return stripeClient;
  }
  const secret = getConfiguredStripeSecret();
  if (!secret) {
    throw new Error(
      `Stripe is not configured. Please set one of: ${STRIPE_SECRET_ENV_KEYS.join(", ")}.`,
    );
  }
  stripeClient = new Stripe(secret, {
    apiVersion: "2026-04-22.dahlia",
  });
  return stripeClient;
}

export function getStripeWebhookSecret() {
  const value =
    process.env.STRIPE_WEBHOOK_SECRET?.trim() ||
    process.env.STRIPE_SIGNING_SECRET?.trim() ||
    "";
  return value || null;
}

export function getStripePriceId(planId: string, cycle: "monthly" | "yearly") {
  const map: Record<string, { monthly?: string; yearly?: string }> = {
    starter: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_ESSENTIAL_MONTHLY,
      yearly: process.env.NEXT_PUBLIC_STRIPE_ESSENTIAL_YEARLY,
    },
    pro: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_CREATOR_MONTHLY,
      yearly: process.env.NEXT_PUBLIC_STRIPE_CREATOR_YEARLY,
    },
    scale: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_MONTHLY,
      yearly: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY,
    },
    insurance: {
      yearly:
        process.env.NEXT_PUBLIC_STRIPE_INSURANCE_YEARLY?.trim() ||
        process.env.NEXT_PUBLIC_STRIPE_INSURANCE_PRICE_YEARLY?.trim() ||
        DEFAULT_STRIPE_INSURANCE_PRICE_YEARLY,
    },
  };
  const value = map[planId]?.[cycle]?.trim();
  return value || null;
}

export function getStripeProductId(planId: string, cycle: "monthly" | "yearly") {
  const map: Record<string, { monthly?: string; yearly?: string }> = {
    starter: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_ESSENTIAL_PRODUCT_MONTHLY,
      yearly: process.env.NEXT_PUBLIC_STRIPE_ESSENTIAL_PRODUCT_YEARLY,
    },
    pro: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_CREATOR_PRODUCT_MONTHLY,
      yearly: process.env.NEXT_PUBLIC_STRIPE_CREATOR_PRODUCT_YEARLY,
    },
    scale: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRODUCT_MONTHLY,
      yearly: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRODUCT_YEARLY,
    },
    insurance: {
      yearly:
        process.env.NEXT_PUBLIC_STRIPE_INSURANCE_PRODUCT_YEARLY?.trim() ||
        DEFAULT_STRIPE_INSURANCE_PRODUCT_YEARLY,
    },
  };
  const value = map[planId]?.[cycle]?.trim();
  return value || null;
}
