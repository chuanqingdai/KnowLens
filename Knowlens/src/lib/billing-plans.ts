export type BillingPlanId = "starter" | "pro" | "scale" | "insurance";
export type BillingCycle = "monthly" | "yearly";

export type BillingPlanCatalogItem = {
  id: BillingPlanId;
  name: string;
  monthlyCredits: number;
  monthlyPrice: number;
  yearlyPrice: number;
  displayNameZh?: string;
  allowedCycles?: BillingCycle[];
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
  {
    id: "insurance",
    name: "Insurance Annual",
    displayNameZh: "保险包年会员",
    monthlyCredits: 6000,
    monthlyPrice: 199,
    yearlyPrice: 199,
    allowedCycles: ["yearly"],
  },
];

export function findBillingPlan(planId: string) {
  return BILLING_PLAN_CATALOG.find((plan) => plan.id === planId) ?? null;
}

export function getBillingPlanDefaultCycle(planId: string): BillingCycle {
  const plan = findBillingPlan(planId);
  if (plan?.allowedCycles?.length === 1) {
    return plan.allowedCycles[0];
  }
  return "monthly";
}

export function isBillingPlanCycleSupported(planId: string, cycle: BillingCycle) {
  const plan = findBillingPlan(planId);
  if (!plan) {
    return false;
  }
  if (!plan.allowedCycles?.length) {
    return true;
  }
  return plan.allowedCycles.includes(cycle);
}
