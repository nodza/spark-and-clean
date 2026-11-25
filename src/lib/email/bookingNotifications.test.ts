import { beforeEach, describe, expect, it, vi } from "vitest";
import { johannesburgCalendarDate } from "@/lib/localCalendarDate";
import type { Booking } from "@/types/booking";

type SentMail = {
  kind: string;
  to: string;
  bookingId?: string;
  dedupeKey?: string;
};

const mocks = vi.hoisted(() => ({
  send: vi.fn(async (_input: SentMail): Promise<string> => "logged"),
  payments: vi.fn(async (_bookingId?: string) => [] as unknown[]),
  findById: vi.fn(),
  driverFindOne: vi.fn(),
}));

vi.mock("@/lib/email/sendTransactionalEmail", () => ({
  sendTransactionalEmail: (input: SentMail) => mocks.send(input),
}));
vi.mock("@/lib/payments/listBookingPayments", () => ({
  listPaymentsForBooking: (bookingId: string) => mocks.payments(bookingId),
}));
vi.mock("@/models/User", () => ({
  User: { findById: (id: string) => mocks.findById(id) },
}));
vi.mock("@/models/Driver", () => ({
  Driver: { findOne: (query: { id?: string }) => mocks.driverFindOne(query) },
}));

import { notifyAfterBookingUpdate } from "@/lib/email/bookingNotifications";

function userDoc(doc: unknown) {
  return { select: () => ({ lean: async () => doc }) };
}

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "SC-2418",
    userId: "507f1f77bcf86cd799439011",
    customer: {
      id: "c1",
      name: "Nomsa Dlamini",
      phone: "0820000000",
      email: "Nomsa@Example.com",
    },
    suburb: "Sandton",
    addressLine1: "18 Fredman Drive",
    city: "Johannesburg",
    collectionDate: "2026-09-02",
    collectionSlot: "MORNING",
    rug: { type: "Persian", widthM: 2, lengthM: 3, areaSqM: 6 },
    addOns: { odourRemoval: false, stainProtection: false },
    estimatedPriceMin: 1000,
    estimatedPriceMax: 1000,
    status: "DELIVERED",
    paymentStatus: "PAID",
    createdAt: "2026-08-26T08:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  mocks.send.mockClear();
  mocks.payments.mockReset();
  mocks.payments.mockResolvedValue([
    {
      kind: "BALANCE",
      provider: "stripe",
      amountCents: 100000,
      status: "SUCCEEDED",
      createdAt: "2026-09-04T10:00:00.000Z",
    },
  ]);
  mocks.findById.mockReset();
  mocks.driverFindOne.mockReset();
  mocks.findById.mockImplementation(() =>
    userDoc({ name: "Nomsa", loyalty: { punches: 5, rewardsRedeemed: 0 } })
  );
  mocks.driverFindOne.mockReturnValue({
    select: () => ({ lean: async () => ({ name: "Thabo", phone: "064 289 2384" }) }),
  });
});

describe("notifyAfterBookingUpdate", () => {
  it("sends delivered and a loyalty reward to the booking email", async () => {
    await notifyAfterBookingUpdate({
      previousStatus: "READY",
      booking: booking(),
      clientUserId: "507f1f77bcf86cd799439011",
      loyaltyUserId: "507f1f77bcf86cd799439011",
    });

    const kinds = mocks.send.mock.calls.map((call) => call[0].kind);
    expect(kinds).toEqual(["delivered", "loyalty_reward"]);
    for (const call of mocks.send.mock.calls) {
      expect(call[0]).toMatchObject({ to: "nomsa@example.com", bookingId: "SC-2418" });
    }
  });

  it("does not send delivered or loyalty again when the status is already delivered", async () => {
    mocks.findById.mockImplementation(() =>
      userDoc({ loyalty: { punches: 4, rewardsRedeemed: 0 } })
    );
    await notifyAfterBookingUpdate({
      previousStatus: "DELIVERED",
      booking: booking(),
      loyaltyUserId: "507f1f77bcf86cd799439011",
    });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("sends out-for-delivery when today's return is scheduled", async () => {
    const today = johannesburgCalendarDate(new Date());
    await notifyAfterBookingUpdate({
      previousStatus: "READY",
      booking: booking({
        status: "READY",
        deliveryDate: today,
        deliverySlot: "AFTERNOON",
      }),
      deliveryDateSet: today,
    });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send.mock.calls[0][0]).toMatchObject({
      kind: "out_for_delivery",
      dedupeKey: `booking:SC-2418:out_for_delivery:${today}`,
    });
  });

  it("resolves when the send log records a failure", async () => {
    mocks.send.mockResolvedValueOnce("failed");
    await expect(
      notifyAfterBookingUpdate({
        previousStatus: "READY",
        booking: booking(),
      })
    ).resolves.toBeUndefined();
  });
});
