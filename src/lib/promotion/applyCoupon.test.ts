import { describe, expect, it } from "vitest";
import { applyCoupon, estimateQuoteMidpointCents } from "@/lib/promotion/applyCoupon";

describe("applyCoupon", () => {
  it("reduces a R1000 midpoint by 10% to R900", () => {
    // R909–R1091 midpoints to R1000. Each bound loses 10%, nearest rand.
    expect(estimateQuoteMidpointCents(909, 1091)).toBe(100_000);
    const applied = applyCoupon({ type: "PERCENT", value: 10 }, 909, 1091);
    expect(applied.estimateMin).toBe(818);
    expect(applied.estimateMax).toBe(982);
    expect(estimateQuoteMidpointCents(applied.estimateMin, applied.estimateMax)).toBe(
      90_000
    );
    expect((applied.estimateMin + applied.estimateMax) / 2).toBe(900);
    expect(applied.discountCents).toBe(10_000);
  });

  it("takes 10% off a R1000–R1000 quote", () => {
    expect(applyCoupon({ type: "PERCENT", value: 10 }, 1000, 1000)).toEqual({
      discountCents: 10_000,
      estimateMin: 900,
      estimateMax: 900,
    });
  });

  it("subtracts a fixed cent amount from both bounds", () => {
    expect(applyCoupon({ type: "FIXED_CENTS", value: 5000 }, 1000, 1200)).toEqual({
      discountCents: 5000,
      estimateMin: 950,
      estimateMax: 1150,
    });
  });

  it("floors a discount that is larger than the quote at 0", () => {
    const applied = applyCoupon({ type: "FIXED_CENTS", value: 500_000 }, 10, 20);
    expect(applied.estimateMin).toBe(0);
    expect(applied.estimateMax).toBe(0);
    expect(applied.discountCents).toBe(estimateQuoteMidpointCents(10, 20));
  });

  it("uses the coupon value, so 25% is not the same as 10%", () => {
    expect(applyCoupon({ type: "PERCENT", value: 25 }, 1000, 1000)).toMatchObject({
      estimateMin: 750,
      estimateMax: 750,
      discountCents: 25_000,
    });
  });
});
