import { describe, expect, it } from "vitest";
import { bookingRugs, LEGACY_RUG_ID } from "@/lib/bookingRugs";
import { toClientBooking } from "@/lib/serialize";

describe("bookingRugs", () => {
  it("loads a stored singular rug as one line", () => {
    const lines = bookingRugs({
      rug: {
        type: "Persian",
        widthM: 2,
        lengthM: 3,
        areaSqM: 6,
        photos: ["rug-photos/2026/11/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg"],
        tagCode: "SC-RUG-1",
        assetId: "507f1f77bcf86cd799439011",
      },
      addOns: { stainTreatment: true, fabricProtection: false },
      estimatedPriceMin: 720,
      estimatedPriceMax: 864,
      measuredQuote: {
        estimatedPriceMin: 800,
        estimatedPriceMax: 960,
        amountDueCents: 88000,
        discountCents: 0,
        measuredAt: "2026-11-10T08:00:00.000Z",
      },
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      id: LEGACY_RUG_ID,
      type: "Persian",
      widthM: 2,
      lengthM: 3,
      areaSqM: 6,
      tagCode: "SC-RUG-1",
      assetId: "507f1f77bcf86cd799439011",
      addOns: { odourRemoval: true, stainProtection: false },
      estimatedPriceMin: 720,
      estimatedPriceMax: 864,
      measuredQuote: { amountDueCents: 88000 },
    });
  });

  it("keeps the line id and follows the singular rug after a size or tag write", () => {
    const lines = bookingRugs({
      rug: {
        type: "Wool",
        widthM: 4,
        lengthM: 5,
        areaSqM: 20,
        tagCode: "SC-NEW",
      },
      rugs: [
        {
          id: "line-a",
          type: "Wool",
          widthM: 1,
          lengthM: 1,
          areaSqM: 1,
          tagCode: "SC-OLD",
          addOns: { odourRemoval: false, stainProtection: true },
          estimatedPriceMin: 80,
          estimatedPriceMax: 96,
        },
      ],
      addOns: { odourRemoval: false, stainProtection: true },
      estimatedPriceMin: 80,
      estimatedPriceMax: 96,
    });

    expect(lines).toEqual([
      expect.objectContaining({
        id: "line-a",
        widthM: 4,
        lengthM: 5,
        areaSqM: 20,
        tagCode: "SC-NEW",
        estimatedPriceMin: 80,
      }),
    ]);
  });

  it("returns every stored line once a booking has more than one rug", () => {
    const lines = bookingRugs({
      rug: { type: "Persian", widthM: 2, lengthM: 3, areaSqM: 6 },
      rugs: [
        {
          id: "line-a",
          type: "Persian",
          widthM: 2,
          lengthM: 3,
          areaSqM: 6,
          addOns: { odourRemoval: false, stainProtection: false },
          estimatedPriceMin: 720,
          estimatedPriceMax: 864,
        },
        {
          id: "line-b",
          type: "Kilim",
          widthM: 1,
          lengthM: 2,
          areaSqM: 2,
          addOns: { odourRemoval: true, stainProtection: false },
          estimatedPriceMin: 100,
          estimatedPriceMax: 120,
          tagCode: "SC-RUG-2",
        },
      ],
      estimatedPriceMin: 820,
      estimatedPriceMax: 984,
    });

    expect(lines.map((line) => line.id)).toEqual(["line-a", "line-b"]);
    expect(lines[1]).toMatchObject({
      type: "Kilim",
      tagCode: "SC-RUG-2",
      addOns: { odourRemoval: true, stainProtection: false },
      estimatedPriceMin: 100,
    });
  });
});

describe("toClientBooking rugs", () => {
  it("adds a one-item list and leaves the singular rug in place", () => {
    const booking = toClientBooking({
      id: "SC-TEST-1",
      customer: {
        id: "c1",
        name: "Pat",
        phone: "0825551234",
        email: "pat@example.com",
      },
      suburb: "Sea Point",
      addressLine1: "1 Beach Rd",
      city: "Cape Town",
      collectionDate: "2026-11-10",
      collectionSlot: "MORNING",
      rug: { type: "Kilim", widthM: 1, lengthM: 2, areaSqM: 2, tagCode: "SC-1" },
      addOns: { odourRemoval: false, stainProtection: false },
      estimatedPriceMin: 160,
      estimatedPriceMax: 192,
      status: "BOOKED",
      paymentStatus: "UNPAID",
      createdAt: "2026-11-10T08:00:00.000Z",
    });

    expect(booking.rug.tagCode).toBe("SC-1");
    expect(booking.rugs).toHaveLength(1);
    expect(booking.rugs?.[0]).toMatchObject({
      id: LEGACY_RUG_ID,
      type: "Kilim",
      tagCode: "SC-1",
      estimatedPriceMin: 160,
      estimatedPriceMax: 192,
    });
  });
});
