import { describe, expect, it } from "vitest";
import { estimateBookingPrice } from "@/lib/bookingEstimate";
import { applyCoupon, estimateQuoteMidpointCents } from "@/lib/promotion/applyCoupon";
import {
  confirmBookingQuote,
  confirmCouponQuote,
  confirmRugsQuote,
} from "@/lib/promotion/confirmCoupon";

describe("confirmCouponQuote", () => {
  it("prices the coupon from rug size and add-ons, not a posted area or total", () => {
    const quote = confirmCouponQuote({
      couponId: "coupon-1",
      code: "SPARK10",
      coupon: { type: "PERCENT", value: 10 },
      rug: { type: "Persian", widthM: 2, lengthM: 3, areaSqM: 999 },
      addOns: { odourRemoval: false, stainProtection: true },
    });

    const estimate = estimateBookingPrice({
      rug: { type: "Persian", widthM: 2, lengthM: 3, areaSqM: 6 },
      addOns: { odourRemoval: false, stainProtection: true },
    });
    const applied = applyCoupon(
      { type: "PERCENT", value: 10 },
      estimate.totalMin,
      estimate.totalMax
    );

    expect(quote.areaSqM).toBe(6);
    expect(quote.promotion).toEqual({
      couponId: "coupon-1",
      code: "SPARK10",
      discountCents: applied.discountCents,
      amountDueCents: estimateQuoteMidpointCents(
        applied.estimateMin,
        applied.estimateMax
      ),
    });
    expect(quote.estimatedPriceMin).toBe(applied.estimateMin);
    expect(quote.estimatedPriceMax).toBe(applied.estimateMax);
    expect(quote.promotion.discountCents).not.toBe(1);
  });
});

describe("confirmRugsQuote", () => {
  const coupon = {
    couponId: "coupon-1",
    code: "TAKE50",
    coupon: { type: "FIXED_CENTS" as const, value: 5000 },
  };
  const persian = {
    type: "Persian",
    widthM: 2,
    lengthM: 3,
    addOns: { odourRemoval: false, stainProtection: false },
  };
  const kilim = {
    type: "Kilim",
    widthM: 1,
    lengthM: 2,
    addOns: { odourRemoval: true, stainProtection: false },
  };

  it("sums three rug prices and applies a fixed coupon once", () => {
    const quoted = confirmRugsQuote({
      coupon,
      rugs: [persian, kilim, kilim],
    });
    expect("error" in quoted).toBe(false);
    if ("error" in quoted) return;

    const one = (rug: typeof persian) =>
      estimateBookingPrice({
        rug: {
          type: rug.type,
          widthM: rug.widthM,
          lengthM: rug.lengthM,
          areaSqM: rug.widthM * rug.lengthM,
        },
        addOns: rug.addOns,
      });
    const lines = [one(persian), one(kilim), one(kilim)];
    const subtotalMin = lines.reduce((sum, line) => sum + line.totalMin, 0);
    const subtotalMax = lines.reduce((sum, line) => sum + line.totalMax, 0);
    const once = applyCoupon(coupon.coupon, subtotalMin, subtotalMax);
    const perRug = lines.reduce(
      (sum, line) =>
        sum + applyCoupon(coupon.coupon, line.totalMin, line.totalMax).estimateMin,
      0
    );

    expect(quoted.subtotalMin).toBe(subtotalMin);
    expect(quoted.subtotalMax).toBe(subtotalMax);
    expect(quoted.lines.map((line) => line.estimatedPriceMin)).toEqual(
      lines.map((line) => line.totalMin)
    );
    expect(quoted.estimatedPriceMin).toBe(once.estimateMin);
    expect(quoted.estimatedPriceMax).toBe(once.estimateMax);
    expect(quoted.promotion?.discountCents).toBe(once.discountCents);
    expect(quoted.estimatedPriceMin).not.toBe(perRug);
  });

  it("matches a one-rug booking quote", () => {
    const many = confirmRugsQuote({
      rugs: [
        {
          type: "Persian",
          widthM: 2,
          lengthM: 3,
          addOns: { odourRemoval: false, stainProtection: true },
        },
      ],
    });
    const one = confirmBookingQuote({
      rug: { type: "Persian", widthM: 2, lengthM: 3, areaSqM: 999 },
      addOns: { odourRemoval: false, stainProtection: true },
    });
    expect("error" in many || "error" in one).toBe(false);
    if ("error" in many || "error" in one) return;
    expect(many.estimatedPriceMin).toBe(one.estimatedPriceMin);
    expect(many.estimatedPriceMax).toBe(one.estimatedPriceMax);
    expect(one.subtotalMin).toBe(one.estimatedPriceMin);
  });

  it("refuses a coupon when any rug has no size", () => {
    const quoted = confirmRugsQuote({
      coupon,
      rugs: [persian, { type: "Wool", widthM: null, lengthM: null }],
    });
    expect(quoted).toEqual({
      error: "Rug width and length are required to apply a coupon",
    });
  });
});

describe("confirmBookingQuote", () => {
  it("server-prices without a coupon from rug size", () => {
    const quote = confirmBookingQuote({
      rug: { type: "Persian", widthM: 2, lengthM: 3, areaSqM: 999 },
      addOns: { odourRemoval: false, stainProtection: true },
    });
    expect("error" in quote).toBe(false);
    if ("error" in quote) return;

    const estimate = estimateBookingPrice({
      rug: { type: "Persian", widthM: 2, lengthM: 3, areaSqM: 6 },
      addOns: { odourRemoval: false, stainProtection: true },
    });
    expect(quote.promotion).toBeNull();
    expect(quote.estimatedPriceMin).toBe(estimate.totalMin);
    expect(quote.estimatedPriceMax).toBe(estimate.totalMax);
    expect(quote.areaSqM).toBe(6);
  });

  it("rejects a coupon when dimensions are missing", () => {
    const quote = confirmBookingQuote({
      coupon: {
        couponId: "coupon-1",
        code: "SPARK10",
        coupon: { type: "PERCENT", value: 10 },
      },
      rug: { type: "Persian", widthM: null, lengthM: null },
      addOns: { odourRemoval: false, stainProtection: false },
    });
    expect(quote).toEqual({
      error: "Rug width and length are required to apply a coupon",
    });
  });

  it("rejects absurd rug sides even when numbers are finite", () => {
    const quote = confirmBookingQuote({
      coupon: {
        couponId: "coupon-1",
        code: "SPARK10",
        coupon: { type: "PERCENT", value: 10 },
      },
      rug: { type: "Persian", widthM: 100, lengthM: 100 },
      addOns: { odourRemoval: false, stainProtection: false },
    });
    expect(quote).toEqual({
      error: "Rug width and length are required to apply a coupon",
    });
  });
});
