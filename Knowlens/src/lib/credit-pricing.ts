export const STANDARD_OUTPUT_REGULAR_CREDITS = 20;
export const STANDARD_OUTPUT_PROMO_CREDITS = 6;

export const STANDARD_OUTPUTS_PER_PLAN = {
  starter: 200,
  pro: 500,
  scale: 1250,
} as const;

export function getStandardOutputCredits(usePromo: boolean) {
  return usePromo ? STANDARD_OUTPUT_PROMO_CREDITS : STANDARD_OUTPUT_REGULAR_CREDITS;
}

