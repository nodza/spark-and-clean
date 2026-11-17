import { describe, expect, it } from "vitest";
import { bookingPageUrl } from "@/lib/email/appUrl";
import {
  bookingConfirmedEmail,
  collectionReminderEmail,
  deliveredEmail,
  loyaltyRewardEmail,
  outForDeliveryEmail,
} from "@/lib/email/copy";
import { formatEmailRand } from "@/lib/email/money";
import type { Booking } from "@/types/booking";

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "SC-2418",
    customer: {
      id: "c1",
      name: "Nomsa Dlamini",
      phone: "0820000000",
      email: "nomsa@example.com",
    },
    suburb: "Sandton",
    addressLine1: "18 Fredman Drive",
    city: "Johannesburg",
    collectionDate: "2026-09-02",
    collectionSlot: "MORNING",
    rug: { type: "Persian", widthM: 2, lengthM: 3, areaSqM: 6 },
    addOns: { odourRemoval: false, stainProtection: true },
    estimatedPriceMin: 1000,
    estimatedPriceMax: 1000,
    status: "READY",
    paymentStatus: "DEPOSIT",
    createdAt: "2026-08-26T08:00:00.000Z",
    deliveryDate: "2026-09-04",
    deliverySlot: "MORNING",
    ...overrides,
  };
}

describe("customer email copy", () => {
  it("links confirmation, reminder, and delivery mail to that booking", () => {
    const page = bookingPageUrl("SC-2418");
    expect(bookingConfirmedEmail(booking()).cta.href).toBe(page);
    expect(
      collectionReminderEmail(booking(), {
        name: "Thabo Mokoena",
        phone: "064 289 2384",
      }).cta.href
    ).toBe(page);
    expect(collectionReminderEmail(booking(), null).subject).toBe(
      "We collect tomorrow morning — SC-2418"
    );
    expect(
      outForDeliveryEmail(booking(), { name: "Thabo Mokoena" }, 0).cta.href
    ).toBe(page);
  });

  it("builds the delivered invoice from ledger payments", () => {
    const email = deliveredEmail(
      booking({ status: "DELIVERED", userId: "user-1" }),
      [
        {
          kind: "DEPOSIT",
          provider: "stripe",
          amountCents: 40000,
          status: "SUCCEEDED",
          createdAt: "2026-09-02T08:00:00.000Z",
        },
        {
          kind: "BALANCE",
          provider: "ozow",
          amountCents: 10000,
          status: "SUCCEEDED",
          createdAt: "2026-09-04T09:00:00.000Z",
        },
        {
          kind: "DEPOSIT",
          provider: "stripe",
          amountCents: 99999,
          status: "FAILED",
          createdAt: "2026-09-01T09:00:00.000Z",
        },
      ],
      2
    );

    expect(email.hero?.value).toBe(formatEmailRand(50000));
    expect(email.hero?.label).toBe("AMOUNT PAID");
    expect(email.ledger?.map((row) => row.value)).toContain(formatEmailRand(40000));
    expect(email.ledger?.map((row) => row.value)).toContain(formatEmailRand(10000));
    expect(email.ledger?.map((row) => row.value)).not.toContain(formatEmailRand(99999));
    expect(email.cta.href).toBe(bookingPageUrl("SC-2418", "invoice"));
    expect(email.stamps).toEqual({
      filled: 2,
      total: 5,
      note: "That's stamp 2 of 5. Five cleans earn one rug free, up to R500.",
    });
  });

  it("links a loyalty reward back to the booking that earned it", () => {
    const email = loyaltyRewardEmail({ bookingId: "SC-2418", name: "Nomsa" });
    expect(email.links?.[0]?.href).toBe(bookingPageUrl("SC-2418"));
    expect(email.cta.href).toBe("http://localhost:3000/book/rug");
    expect(email.stamps?.filled).toBe(5);
  });
});
