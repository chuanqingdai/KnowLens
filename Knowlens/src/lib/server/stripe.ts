import Stripe from "stripe";

let stripeClient: Stripe | null = null;

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

export function isStripeServerConfigured() {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) {
    return false;
  }
  return !isPlaceholderSecret(secret);
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
  };
  const value = map[planId]?.[cycle]?.trim();
  return value || null;
}

export function getStripeServerClient() {
  if (stripeClient) {
    return stripeClient;
  }
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret || isPlaceholderSecret(secret)) {
    throw new Error("Stripe is not configured. Please set a valid STRIPE_SECRET_KEY.");
  }
  stripeClient = new Stripe(secret, {
    apiVersion: "2026-04-22.dahlia",
  });
  return stripeClient;
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
  };
  const value = map[planId]?.[cycle]?.trim();
  return value || null;
}
