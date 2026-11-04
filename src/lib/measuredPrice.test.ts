import { describe, expect, it } from "vitest";
import { estimateBookingPrice } from "@/lib/bookingEstimate";
import { priceAfterMeasurement, withoutPostedPrice } from "@/lib/measuredPrice";
import { readMeasuredMeters } from "@/lib/measuredSize";
import { quotedValueRand } from "@/lib/priceFormat";
import {
  applyCoupon,
  estimateQuoteMidpointCents,
} from "@/lib/promotion/applyCoupon";

const measuredAt = "2026-10-28T08:00:00.000Z";

function wizardDue(
  rugType: string,
  addOns: { odourRemoval: boolean; stainProtection: boolean },
  coupon?: { type: "PERCENT" | "FIXED_CENTS"; value: number }
) {
  const estimate = estimateBookingPrice({
    rug: { type: rugType, widthM: 2, lengthM: 3, areaSqM: 6 },
    addOns,
  });
  if (!coupon) {
    return {
      estimate,
      amountDueCents: estimateQuoteMidpointCents(estimate.totalMin, estimate.totalMax),
      discountCents: 0,
      min: estimate.totalMin,
      max: estimate.totalMax,
    };
  }
  const applied = applyCoupon(coupon, estimate.totalMin, estimate.totalMax);
  return {
    estimate,
    amountDueCents: estimateQuoteMidpointCents(applied.estimateMin, applied.estimateMax),
    discountCents: applied.discountCents,
    min: applied.estimateMin,
    max: applied.estimateMax,
  };
}

describe("readMeasuredMeters", () => {
  it("accepts metres and rejects a missing side", () => {
    expect(readMeasuredMeters(2, 3)).toEqual({ ok: true, widthM: 2, lengthM: 3 });
    expect(readMeasuredMeters("2,5", "3")).toEqual({
      ok: true,
      widthM: 2.5,
      lengthM: 3,
    });
    expect(readMeasuredMeters(2, "")).toEqual({
      ok: false,
      error: "Enter both width and length in metres.",
    });
  });
});

describe("priceAfterMeasurement", () => {
  it("prices a skipped-size rug at the wizard total for 2 m × 3 m", () => {
    const addOns = { odourRemoval: false, stainProtection: true };
    const expected = wizardDue("Persian", addOns);
    const priced = priceAfterMeasurement({
      rugType: "Persian",
      addOns,
      widthM: 2,
      lengthM: 3,
      coupon: null,
      amountPaidCents: 0,
      measuredAt,
    });

    expect(priced.ok).toBe(true);
    if (!priced.ok) return;
    expect(priced.write.set.estimatedPriceMin).toBeUndefined();
    expect(priced.write.set.estimatedPriceMax).toBeUndefined();
    expect(priced.write.set["rug.areaSqM"]).toBe(6);
    expect(priced.write.set.paymentStatus).toBe("UNPAID");
    expect(priced.write.set.refundRequired).toBe(false);
    expect(priced.write.set.billing).toEqual({
      currency: "ZAR",
      amountDueCents: expected.amountDueCents,
      amountPaidCents: 0,
    });
    expect(priced.write.set.measuredQuote).toMatchObject({
      estimatedPriceMin: expected.min,
      estimatedPriceMax: expected.max,
      amountDueCents: expected.amountDueCents,
      discountCents: 0,
      measuredAt,
    });
    expect(expected.amountDueCents).toBeGreaterThan(0);
  });

  it("keeps a paid deposit and recalculates status when the size changes", () => {
    const paid = 39_600;
    const priced = priceAfterMeasurement({
      rugType: "Persian",
      addOns: { odourRemoval: false, stainProtection: false },
      widthM: 1,
      lengthM: 1,
      coupon: null,
      amountPaidCents: paid,
      measuredAt,
    });
    expect(priced.ok).toBe(true);
    if (!priced.ok) return;
    const billing = priced.write.set.billing as {
      amountDueCents: number;
      amountPaidCents: number;
    };
    expect(billing.amountPaidCents).toBe(paid);
    expect(billing.amountDueCents).toBeLessThan(paid);
    expect(priced.write.set.paymentStatus).toBe("PAID");
    expect(priced.write.set.refundRequired).toBe(true);
  });

  it("stays on deposit when the new price is still above what was paid", () => {
    const paid = 39_600;
    const priced = priceAfterMeasurement({
      rugType: "Persian",
      addOns: { odourRemoval: true, stainProtection: true },
      widthM: 3,
      lengthM: 3,
      coupon: null,
      amountPaidCents: paid,
      measuredAt,
    });
    expect(priced.ok).toBe(true);
    if (!priced.ok) return;
    const billing = priced.write.set.billing as { amountDueCents: number };
    expect(billing.amountDueCents).toBeGreaterThan(paid);
    expect(priced.write.set.paymentStatus).toBe("DEPOSIT");
    expect(priced.write.set.refundRequired).toBe(false);
  });

  it("reapplies the booking coupon the same way the wizard does", () => {
    const addOns = { odourRemoval: false, stainProtection: true };
    const coupon = { type: "PERCENT" as const, value: 10 };
    const expected = wizardDue("Persian", addOns, coupon);
    const priced = priceAfterMeasurement({
      rugType: "Persian",
      addOns,
      widthM: 2,
      lengthM: 3,
      coupon: { couponId: "coupon-1", code: "SPARK10", coupon },
      amountPaidCents: 0,
      measuredAt,
    });
    expect(priced.ok).toBe(true);
    if (!priced.ok) return;
    expect(priced.write.set["promotion.discountCents"]).toBe(expected.discountCents);
    expect(priced.write.set["promotion.amountDueCents"]).toBe(expected.amountDueCents);
    expect(priced.write.set.couponCode).toBe("SPARK10");
    expect(priced.write.set.billing).toMatchObject({
      amountDueCents: expected.amountDueCents,
    });
    expect(priced.write.unset).toBeUndefined();
    expect(expected.discountCents).toBeGreaterThan(0);
  });

  it("counts older add-on field names", () => {
    const modern = priceAfterMeasurement({
      rugType: "Kilim",
      addOns: { odourRemoval: true, stainProtection: false },
      widthM: 2,
      lengthM: 3,
      coupon: null,
      amountPaidCents: 0,
      measuredAt,
    });
    const legacy = priceAfterMeasurement({
      rugType: "Kilim",
      addOns: { stainTreatment: true, fabricProtection: false },
      widthM: 2,
      lengthM: 3,
      coupon: null,
      amountPaidCents: 0,
      measuredAt,
    });
    expect(modern.ok && legacy.ok).toBe(true);
    if (!modern.ok || !legacy.ok) return;
    expect(legacy.write.set.billing).toEqual(modern.write.set.billing);
  });
});

describe("withoutPostedPrice", () => {
  it("keeps the job status and drops a posted price", () => {
    expect(
      withoutPostedPrice({
        status: "COLLECTED",
        "rug.widthM": 2,
        estimatedPriceMin: 1,
        billing: { amountDueCents: 1 },
        "promotion.amountDueCents": 1,
        amountDueCents: 1,
      })
    ).toEqual({
      status: "COLLECTED",
      "rug.widthM": 2,
    });
  });
});

describe("quotedValueRand", () => {
  it("uses the measured quote when the original estimate is still zero", () => {
    expect(
      quotedValueRand({
        estimatedPriceMin: 0,
        estimatedPriceMax: 0,
        measuredQuote: { estimatedPriceMin: 720, estimatedPriceMax: 864 },
      })
    ).toBe(792);
    expect(quotedValueRand({ estimatedPriceMin: 0, estimatedPriceMax: 0 })).toBe(0);
  });
});
