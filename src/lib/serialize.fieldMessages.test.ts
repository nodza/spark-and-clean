import { describe, expect, it } from "vitest";
import { toClientBooking } from "@/lib/serialize";

describe("toClientBooking field thread strip", () => {
  it("never exposes fieldMessages or fieldThreadReadAt on customer payloads", () => {
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
      collectionDate: "2026-09-22",
      collectionSlot: "MORNING",
      rug: { type: "Persian", widthM: 1, lengthM: 2, areaSqM: 2 },
      addOns: { stainTreatment: false, fabricProtection: false },
      estimatedPriceMin: 100,
      estimatedPriceMax: 200,
      status: "SCHEDULED",
      paymentStatus: "UNPAID",
      assignedDriverId: "driver_1",
      createdAt: "2026-09-22T08:00:00.000Z",
      notes: [{ id: "n1", body: "ops only", author: "Ops", createdAt: "x" }],
      fieldMessages: [
        {
          id: "m1",
          authorRole: "admin",
          authorName: "Ops",
          body: "Gate on the left",
          createdAt: "2026-09-22T09:00:00.000Z",
        },
      ],
      fieldThreadReadAt: "2026-09-22T09:00:00.000Z",
    });

    expect(booking).not.toHaveProperty("notes");
    expect(booking).not.toHaveProperty("fieldMessages");
    expect(booking).not.toHaveProperty("fieldThreadReadAt");
    expect(booking.id).toBe("SC-TEST-1");
    expect(booking.assignedDriverId).toBe("driver_1");
  });
});
