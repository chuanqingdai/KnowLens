import fs from "fs/promises";
import path from "path";
import Stripe from "stripe";

const rootDir = process.cwd();
const configPath = path.join(rootDir, "scripts", "stripe-products.config.json");
const outputPath = path.join(rootDir, "scripts", "stripe-products.output.json");

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY. Set it before running this script.");
}

const stripe = new Stripe(secretKey, {
  apiVersion: "2025-04-30.basil",
});

function toCents(value) {
  return Math.round(value * 100);
}

function buildMetadata(plan, interval) {
  return {
    product_line: "knowlens-membership",
    plan_id: plan.planId,
    billing_interval: interval,
    monthly_credits: String(plan.monthlyCredits),
  };
}

async function getOrCreateProduct(plan) {
  const query = `active:'true' AND metadata['product_line']:'knowlens-membership' AND metadata['plan_id']:'${plan.planId}'`;
  const existing = await stripe.products.search({ query, limit: 1 });
  if (existing.data.length) {
    const current = existing.data[0];
    const nextDescription = `${plan.description}\n\nIncludes:\n- ${plan.features.join("\n- ")}`;
    if (current.name !== plan.displayName || current.description !== nextDescription) {
      return stripe.products.update(current.id, {
        name: plan.displayName,
        description: nextDescription,
      });
    }
    return current;
  }

  return stripe.products.create({
    name: plan.displayName,
    description: `${plan.description}\n\nIncludes:\n- ${plan.features.join("\n- ")}`,
    metadata: {
      product_line: "knowlens-membership",
      plan_id: plan.planId,
    },
  });
}

async function getOrCreateRecurringPrice(productId, plan, currency, interval, amount) {
  const query = `active:'true' AND product:'${productId}' AND currency:'${currency}' AND metadata['billing_interval']:'${interval}'`;
  const existing = await stripe.prices.search({ query, limit: 1 });
  if (existing.data.length) {
    return existing.data[0];
  }
  return stripe.prices.create({
    product: productId,
    currency,
    unit_amount: amount,
    recurring: {
      interval: interval === "monthly" ? "month" : "year",
    },
    metadata: buildMetadata(plan, interval),
  });
}

async function main() {
  const raw = await fs.readFile(configPath, "utf8");
  const config = JSON.parse(raw);
  const currency = String(config.currency || "usd").toLowerCase();
  const plans = Array.isArray(config.plans) ? config.plans : [];

  const output = {
    createdAt: new Date().toISOString(),
    currency,
    plans: [],
  };

  for (const plan of plans) {
    const product = await getOrCreateProduct(plan);
    const monthlyPrice = await getOrCreateRecurringPrice(
      product.id,
      plan,
      currency,
      "monthly",
      toCents(plan.monthlyPrice),
    );
    const yearlyPrice = await getOrCreateRecurringPrice(
      product.id,
      plan,
      currency,
      "yearly",
      toCents(plan.yearlyPrice),
    );

    output.plans.push({
      planId: plan.planId,
      displayName: plan.displayName,
      productId: product.id,
      monthly: {
        amount: plan.monthlyPrice,
        priceId: monthlyPrice.id,
      },
      yearly: {
        amount: plan.yearlyPrice,
        priceId: yearlyPrice.id,
      },
    });
  }

  await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
  process.stdout.write(`Stripe products configured. Output saved to ${outputPath}\n`);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
