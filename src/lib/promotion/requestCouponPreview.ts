import type { CouponType } from "@/lib/coupon";

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

/** Ask the server what this code would do. This does not use up a redemption. */
export async function requestCouponPreview(input: {
  code: string;
  estimateMin: number;
  estimateMax: number;
  city?: string;
}): Promise<{ ok: true; quote: CouponPreviewQuote } | { ok: false; error: string }> {
  const res = await fetch("/api/coupons/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: input.code,
      estimateMin: input.estimateMin,
      estimateMax: input.estimateMax,
      ...(input.city ? { city: input.city } : {}),
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
