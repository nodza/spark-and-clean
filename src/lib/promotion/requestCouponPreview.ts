import type { CouponType } from "@/lib/coupon";

const HOLD_PREFIX = "spark-coupon-hold:";
const memoryHolds = new Map<string, string>();

/** Stable id for this browser session so Apply counts once, even if the step reloads. */
export function couponHoldId(code: string): string {
  const key = `${HOLD_PREFIX}${code}`;
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    const existing = memoryHolds.get(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    memoryHolds.set(key, id);
    return id;
  }
}

export type CouponPreviewQuote = {
  code: string;
  type: CouponType;
  value: number;
  discountCents: number;
  estimateMin: number;
  estimateMax: number;
  redeemedCount: number;
  maxRedemptions: number | null;
};

export async function requestCouponPreview(input: {
  code: string;
  estimateMin: number;
  estimateMax: number;
  city?: string;
  /** Count this apply once. Repeats with the same hold id do not count again. */
  recordUse?: boolean;
}): Promise<{ ok: true; quote: CouponPreviewQuote } | { ok: false; error: string }> {
  const res = await fetch("/api/coupons/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: input.code,
      estimateMin: input.estimateMin,
      estimateMax: input.estimateMax,
      ...(input.city ? { city: input.city } : {}),
      ...(input.recordUse
        ? { recordUse: true, holdId: couponHoldId(input.code) }
        : {}),
    }),
  });
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (
    !res.ok ||
    typeof payload.code !== "string" ||
    (payload.type !== "PERCENT" && payload.type !== "FIXED_CENTS") ||
    typeof payload.value !== "number" ||
    typeof payload.estimateMin !== "number" ||
    typeof payload.estimateMax !== "number" ||
    typeof payload.discountCents !== "number"
  ) {
    return {
      ok: false,
      error:
        typeof payload.error === "string"
          ? payload.error
          : "That coupon code isn't valid",
    };
  }
  return {
    ok: true,
    quote: {
      code: payload.code,
      type: payload.type,
      value: payload.value,
      discountCents: payload.discountCents,
      estimateMin: payload.estimateMin,
      estimateMax: payload.estimateMax,
      redeemedCount:
        typeof payload.redeemedCount === "number" &&
        Number.isFinite(payload.redeemedCount)
          ? payload.redeemedCount
          : 0,
      maxRedemptions:
        typeof payload.maxRedemptions === "number" &&
        Number.isInteger(payload.maxRedemptions)
          ? payload.maxRedemptions
          : null,
    },
  };
}
