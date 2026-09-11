import { describe, expect, it } from "vitest";
import { estimateBookingPrice, hasRugDimensions } from "@/lib/bookingEstimate";

describe("hasRugDimensions", () => {
  it("requires positive finite width and length", () => {
    expect(hasRugDimensions(2, 3)).toBe(true);
    expect(hasRugDimensions(null, 3)).toBe(false);
    expect(hasRugDimensions(2, 0)).toBe(false);
    expect(hasRugDimensions(undefined, undefined)).toBe(false);
  });
});

describe("estimateBookingPrice", () => {
  it("returns zero totals when size is unknown", () => {
    const estimate = estimateBookingPrice({
      rug: { type: "Persian", widthM: null, lengthM: null, areaSqM: 0 },
      addOns: { odourRemoval: true, stainProtection: true },
    });
    expect(estimate.dimensionsSkipped).toBe(true);
    expect(estimate.totalMin).toBe(0);
    expect(estimate.totalMax).toBe(0);
  });

  it("applies the Persian multiplier and add-ons when sized", () => {
    const estimate = estimateBookingPrice({
      rug: { type: "Persian", widthM: 2, lengthM: 3, areaSqM: 6 },
      addOns: { odourRemoval: true, stainProtection: false },
    });
    expect(estimate.dimensionsSkipped).toBe(false);
    expect(estimate.basePrice).toBe(720);
    expect(estimate.odourPrice).toBe(150);
    expect(estimate.totalMin).toBe(870);
    expect(estimate.totalMax).toBe(1044);
  });
});
