import { describe, expect, it } from "vitest";
import { estimateBookingPrice } from "@/lib/bookingEstimate";
import { quoteWizardRugs, type WizardRug } from "@/lib/wizardRugs";

function rug(overrides: Partial<WizardRug>): WizardRug {
  return {
    id: "line",
    type: "Persian",
    widthM: 2,
    lengthM: 3,
    areaSqM: 6,
    photos: [],
    labelPhotos: [],
    addOns: { odourRemoval: false, stainProtection: false },
    ...overrides,
  };
}

describe("quoteWizardRugs", () => {
  it("prices each rug and sums the booking", () => {
    const persian = rug({ id: "a" });
    const kilim = rug({
      id: "b",
      type: "Kilim",
      widthM: 1,
      lengthM: 2,
      areaSqM: 2,
      addOns: { odourRemoval: true, stainProtection: false },
    });
    const quoted = quoteWizardRugs([persian, kilim]);
    const persianPrice = estimateBookingPrice({
      rug: persian,
      addOns: persian.addOns,
    });
    const kilimPrice = estimateBookingPrice({
      rug: kilim,
      addOns: kilim.addOns,
    });
    expect(quoted.lines.map((line) => line.totalMin)).toEqual([
      persianPrice.totalMin,
      kilimPrice.totalMin,
    ]);
    expect(quoted.totalMin).toBe(persianPrice.totalMin + kilimPrice.totalMin);
    expect(quoted.dimensionsSkipped).toBe(false);
  });

  it("marks the booking unpriced when any rug has no size", () => {
    const quoted = quoteWizardRugs([
      rug({ id: "a" }),
      rug({ id: "b", widthM: null, lengthM: null, areaSqM: 0 }),
    ]);
    expect(quoted.lines[1].dimensionsSkipped).toBe(true);
    expect(quoted.dimensionsSkipped).toBe(true);
  });
});
