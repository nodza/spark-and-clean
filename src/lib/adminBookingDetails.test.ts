import { describe, expect, it } from "vitest";
import {
  bookingDeleteBlockReason,
  canDeleteBooking,
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

describe("bookingDeleteBlockReason", () => {
  it("allows BOOKED or SCHEDULED unpaid bookings with no tag", () => {
    expect(
      canDeleteBooking({
        status: "BOOKED",
        paymentStatus: "UNPAID",
        rug: {},
      })
    ).toBe(true);
    expect(
      canDeleteBooking({
        status: "SCHEDULED",
        paymentStatus: "UNPAID",
        rug: { tagCode: "" },
      })
    ).toBe(true);
  });

  it("blocks paid, collected, or tagged bookings with a clear reason", () => {
    expect(
      bookingDeleteBlockReason({
        status: "BOOKED",
        paymentStatus: "DEPOSIT",
        rug: {},
      })
    ).toMatch(/payment/i);
    expect(
      bookingDeleteBlockReason({
        status: "COLLECTED",
        paymentStatus: "UNPAID",
        rug: {},
      })
    ).toMatch(/collected/i);
    expect(
      bookingDeleteBlockReason({
        status: "BOOKED",
        paymentStatus: "UNPAID",
        rug: { tagCode: "SC-RUG-1" },
      })
    ).toMatch(/tag/i);
  });
});
