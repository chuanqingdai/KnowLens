export type BillingPlanId = "starter" | "pro" | "scale";
export type BillingCycle = "monthly" | "yearly";

export type BillingPlanCatalogItem = {
  id: BillingPlanId;
  name: string;
  monthlyCredits: number;
  monthlyPrice: number;
  yearlyPrice: number;
};

export const BILLING_PLAN_CATALOG: BillingPlanCatalogItem[] = [
  {
    id: "starter",
    name: "Starter",
    monthlyCredits: 1200,
    monthlyPrice: 14.9,
    yearlyPrice: 124.9,
  },
  {
    id: "pro",
    name: "Creator",
    monthlyCredits: 3000,
    monthlyPrice: 29,
    yearlyPrice: 242,
  },
  {
    id: "scale",
    name: "Pro",
    monthlyCredits: 7500,
    monthlyPrice: 59,
    yearlyPrice: 489.9,
  },
];

export function findBillingPlan(planId: string) {
  return BILLING_PLAN_CATALOG.find((plan) => plan.id === planId) ?? null;
}
