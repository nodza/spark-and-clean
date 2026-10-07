import { describe, expect, it } from "vitest";
import { estimateBookingPrice } from "@/lib/bookingEstimate";
import { applyCoupon, estimateQuoteMidpointCents } from "@/lib/promotion/applyCoupon";
import {
  confirmBookingQuote,
  confirmCouponQuote,
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
