import type { CouponType } from "@/lib/coupon";

export type CouponDiscount = {
  type: CouponType;
  /** PERCENT: 1–100. FIXED_CENTS: positive integer cents. */
  value: number;
};

export type AppliedCoupon = {
  /** Saving on the estimate midpoint, in cents. Never more than the original midpoint. */
  discountCents: number;
  /** Discounted lower bound, whole rands. */
  estimateMin: number;
  /** Discounted upper bound, whole rands. */
  estimateMax: number;
};

/**
 * Midpoint of a rand range, in cents. Same rule as the payment ledger:
 * round(((min + max) / 2) * 100), floored at 0.
 */
export function estimateQuoteMidpointCents(
  estimateMin: number,
  estimateMax: number
): number {
  const min = Number(estimateMin);
  const max = Number(estimateMax);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return 0;
  return Math.max(0, Math.round(((min + max) / 2) * 100));
}

function wholeRand(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(0, Math.round(value));
}

/**
 * Discount one rand bound.
 *
 * Work in cents, then round back to the nearest rand (Math.round, half up).
 * PERCENT takes `value` percent of that bound. FIXED_CENTS subtracts `value`
 * cents. The result is never below 0.
 *
 * A 10% coupon on a R1000 midpoint (R909–R1091) lands on R900:
 * 90900 − round(10%) = 81810 cents → R818, 109100 − round(10%) = 98190 → R982,
 * and (818 + 982) / 2 = 900.
 */
function discountRand(amountRand: number, coupon: CouponDiscount): number {
  const cents = Math.round(wholeRand(amountRand) * 100);
  const face = Math.round(coupon.value);
  let next = cents;
  if (coupon.type === "PERCENT") {
    const percent = Math.min(100, Math.max(0, face));
    next = cents - Math.round((cents * percent) / 100);
  } else if (coupon.type === "FIXED_CENTS") {
    next = cents - Math.max(0, face);
  }
  return Math.max(0, Math.round(next / 100));
}

/** Percent of each bound, or the same fixed cents off each bound. Floors at 0. */
export function applyCoupon(
  coupon: CouponDiscount,
  estimateMin: number,
  estimateMax: number
): AppliedCoupon {
  const beforeMin = wholeRand(estimateMin);
  const beforeMax = wholeRand(estimateMax);
  const nextMin = discountRand(beforeMin, coupon);
  const nextMax = discountRand(beforeMax, coupon);
  const beforeCents = estimateQuoteMidpointCents(beforeMin, beforeMax);
  const afterCents = estimateQuoteMidpointCents(nextMin, nextMax);
  return {
    discountCents: Math.max(0, beforeCents - afterCents),
    estimateMin: nextMin,
    estimateMax: nextMax,
  };
}
