import { describe, expect, it } from "vitest";
import {
  bookingDeactivateBlockReason,
  canDeactivateBooking,
  sanitizeBookingDetailsPatch,
} from "@/lib/adminBookingDetails";

const validBody = {
  customer: {
    name: "Sarah Jenkins",
    phone: "082 123 4567",
    email: "sarah.j@example.com",
  },
  addressLine1: "12 Beach Road",
  suburb: "Sea Point",
  city: "Cape Town",
  collectionDate: "2026-10-20",
  collectionSlot: "MORNING",
};

describe("sanitizeBookingDetailsPatch", () => {
  it("accepts a full contact and collection patch", () => {
    const parsed = sanitizeBookingDetailsPatch(validBody);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.patch).toEqual({
      customer: {
        name: "Sarah Jenkins",
        phone: "082 123 4567",
        email: "sarah.j@example.com",
      },
      addressLine1: "12 Beach Road",
      suburb: "Sea Point",
      city: "Cape Town",
      collectionDate: "2026-10-20",
      collectionSlot: "MORNING",
    });
  });

  it("rejects an invalid city or slot", () => {
    expect(
      sanitizeBookingDetailsPatch({ ...validBody, city: "Durban" }).ok
    ).toBe(false);
    expect(
      sanitizeBookingDetailsPatch({
        ...validBody,
        collectionSlot: "EVENING",
      }).ok
    ).toBe(false);
  });

  it("ignores status and payment fields in the body", () => {
    const parsed = sanitizeBookingDetailsPatch({
      ...validBody,
      status: "DELIVERED",
      paymentStatus: "PAID",
      assignedDriverId: "driver_thabo",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.patch).not.toHaveProperty("status");
    expect(parsed.patch).not.toHaveProperty("paymentStatus");
  });
});

describe("bookingDeactivateBlockReason", () => {
  it("allows BOOKED or SCHEDULED unpaid bookings with no tag", () => {
    expect(
      canDeactivateBooking({
        status: "BOOKED",
        paymentStatus: "UNPAID",
        rug: {},
      })
    ).toBe(true);
    expect(
      canDeactivateBooking({
        status: "SCHEDULED",
        paymentStatus: "UNPAID",
        rug: { tagCode: "" },
      })
    ).toBe(true);
  });

  it("blocks paid, collected, tagged, or already-deactivated bookings", () => {
    expect(
      bookingDeactivateBlockReason({
        status: "BOOKED",
        paymentStatus: "DEPOSIT",
        rug: {},
      })
    ).toMatch(/payment/i);
    expect(
      bookingDeactivateBlockReason({
        status: "COLLECTED",
        paymentStatus: "UNPAID",
        rug: {},
      })
    ).toMatch(/collected/i);
    expect(
      bookingDeactivateBlockReason({
        status: "BOOKED",
        paymentStatus: "UNPAID",
        rug: { tagCode: "SC-RUG-1" },
      })
    ).toMatch(/tag/i);
    expect(
      bookingDeactivateBlockReason({
        status: "BOOKED",
        paymentStatus: "UNPAID",
        rug: {},
        deactivatedAt: "2026-10-14T08:00:00.000Z",
      })
    ).toMatch(/deactivated/i);
  });
});
