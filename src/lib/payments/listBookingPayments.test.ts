import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_BOOKING_PAYMENTS_LIMIT,
  listPaymentsForBooking,
} from "@/lib/payments/listBookingPayments";

const connectDB = vi.fn();
const paymentFind = vi.fn();
const paymentSort = vi.fn();
const paymentLimit = vi.fn();

vi.mock("@/lib/mongodb", () => ({
  connectDB: () => connectDB(),
}));

vi.mock("@/models/Payment", () => ({
  Payment: {
    find: (...args: unknown[]) => paymentFind(...args),
  },
}));

function mockPayments(docs: Record<string, unknown>[]) {
  paymentFind.mockReturnValue({
    sort: (...args: unknown[]) => {
      paymentSort(...args);
      return {
        limit: (...args: unknown[]) => {
          paymentLimit(...args);
          return { lean: async () => docs };
        },
      };
    },
  });
}

describe("listPaymentsForBooking", () => {
  beforeEach(() => {
    connectDB.mockReset();
    paymentFind.mockReset();
    paymentSort.mockReset();
    paymentLimit.mockReset();
    connectDB.mockResolvedValue(undefined);
    mockPayments([
      {
        _id: { toString: () => "pay-1" },
        provider: "stripe",
        providerRef: "pi_succeeded_1",
        bookingId: "SC-1",
        userId: "user-sarah",
        kind: "DEPOSIT",
        amountCents: 7500,
        currency: "ZAR",
        status: "SUCCEEDED",
        createdAt: "2026-10-05T12:00:00.000Z",
      },
    ]);
  });

  it("returns a succeeded Stripe providerRef for the booking, newest first", async () => {
    const rows = await listPaymentsForBooking("SC-1");

    expect(paymentFind).toHaveBeenCalledWith({ bookingId: "SC-1" });
    expect(paymentSort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(paymentLimit).toHaveBeenCalledWith(ADMIN_BOOKING_PAYMENTS_LIMIT);
    expect(rows).toEqual([
      {
        id: "pay-1",
        provider: "stripe",
        providerRef: "pi_succeeded_1",
        kind: "DEPOSIT",
        amountCents: 7500,
        currency: "ZAR",
        status: "SUCCEEDED",
        createdAt: "2026-10-05T12:00:00.000Z",
      },
    ]);
  });

  it("does not query when the booking id is blank", async () => {
    const rows = await listPaymentsForBooking("  ");
    expect(rows).toEqual([]);
    expect(paymentFind).not.toHaveBeenCalled();
    expect(connectDB).not.toHaveBeenCalled();
  });
});
