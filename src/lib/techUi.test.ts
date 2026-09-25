import { describe, expect, it } from "vitest";
import type { Booking } from "@/types/booking";
import {
  MEASURE_ON_PICKUP,
  bookingAddOnLabels,
  paymentBadgeClass,
  rugDimensionLabel,
  rugSummary,
  techTagLabel,
} from "@/lib/techUi";

describe("rugDimensionLabel", () => {
  it("never prints null dimensions", () => {
    const label = rugDimensionLabel({
      widthM: null,
      lengthM: null,
      areaSqM: 0,
    });
    expect(label).toBe(MEASURE_ON_PICKUP);
    expect(label.toLowerCase()).not.toContain("null");
  });

  it("includes width, length, and area when both dimensions exist", () => {
    expect(
      rugDimensionLabel({ widthM: 2, lengthM: 3, areaSqM: 6 })
    ).toBe("2m × 3m (6 m²)");
  });

  it("falls back to width times length when area is missing", () => {
    expect(
      rugDimensionLabel({ widthM: 1.5, lengthM: 2, areaSqM: 0 })
    ).toBe("1.5m × 2m (3 m²)");
  });
});

describe("bookingAddOnLabels", () => {
  it("uses the booking names, including legacy keys", () => {
    expect(
      bookingAddOnLabels({ odourRemoval: true, stainProtection: false })
    ).toEqual(["Odour removal"]);
    expect(
      bookingAddOnLabels({ stainTreatment: true, fabricProtection: true })
    ).toEqual(["Odour removal", "Stain protection"]);
  });

  it("returns nothing when no add-on was selected", () => {
    expect(
      bookingAddOnLabels({ odourRemoval: false, stainProtection: false })
    ).toEqual([]);
  });
});

describe("rugSummary", () => {
  it("uses measure-on-pickup copy when size was skipped", () => {
    const booking = {
      suburb: "Sea Point",
      rug: { type: "Persian", widthM: null, lengthM: null, areaSqM: 0 },
    } as Booking;
    expect(rugSummary(booking)).toBe(
      `Sea Point · Persian · ${MEASURE_ON_PICKUP}`
    );
  });
});

describe("techTagLabel", () => {
  it("shows a collected stop as collected", () => {
    expect(techTagLabel("COLLECTED")).toBe("COLLECTED");
    expect(techTagLabel("CLEANING")).toBe("DEPOT");
    expect(techTagLabel("DELIVERED")).toBe("DONE");
  });
});

describe("paymentBadgeClass", () => {
  it("styles each read-only payment state", () => {
    expect(paymentBadgeClass("UNPAID")).toContain("bg-");
    expect(paymentBadgeClass("DEPOSIT")).not.toBe(paymentBadgeClass("PAID"));
    expect(paymentBadgeClass("PAID")).toContain("text-");
  });
});
