import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLIENT_PAYMENT_HISTORY_LIMIT,
  listPaymentsForClient,
} from "@/lib/payments/listClientPayments";

const connectDB = vi.fn();
const bookingFind = vi.fn();
const paymentFind = vi.fn();
const paymentSort = vi.fn();
const paymentLimit = vi.fn();

vi.mock("@/lib/mongodb", () => ({
  connectDB: () => connectDB(),
}));

vi.mock("@/models/Booking", () => ({
  Booking: {
    find: (...args: unknown[]) => bookingFind(...args),
  },
}));

vi.mock("@/models/Payment", () => ({
  Payment: {
    find: (...args: unknown[]) => paymentFind(...args),
  },
}));

const ownedBookingFilter = {
  $or: [
    { userId: "user-sarah" },
    {
      "customer.email": "sarah@example.com",
      $or: [{ userId: { $exists: false } }, { userId: null }],
    },
  ],
};

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

describe("listPaymentsForClient", () => {
  beforeEach(() => {
    connectDB.mockReset();
    bookingFind.mockReset();
    paymentFind.mockReset();
    paymentSort.mockReset();
    paymentLimit.mockReset();
    connectDB.mockResolvedValue(undefined);
    bookingFind.mockReturnValue({
      select: () => ({
        lean: async () => [{ id: "SC-1" }],
      }),
    });
    mockPayments([
      {
        _id: { toString: () => "pay-1" },
        createdAt: "2026-09-29T12:00:00.000Z",
        bookingId: "SC-1",
        kind: "DEPOSIT",
        amountCents: 7500,
        currency: "ZAR",
        provider: "stripe",
        status: "SUCCEEDED",
      },
      {
        _id: { toString: () => "pay-2" },
        createdAt: "2026-09-28T12:00:00.000Z",
        bookingId: "SC-1",
        kind: "DEPOSIT",
        amountCents: 7500,
        currency: "ZAR",
        provider: "stripe",
        status: "PENDING",
      },
    ]);
  });

  it("returns owned payments including pending rows, newest first", async () => {
    const rows = await listPaymentsForClient({
      userId: "user-sarah",
      email: "sarah@example.com",
    });

    expect(bookingFind).toHaveBeenCalledWith(ownedBookingFilter);
    expect(paymentFind).toHaveBeenCalledWith({
      $or: [{ userId: "user-sarah" }, { bookingId: { $in: ["SC-1"] } }],
    });
    expect(paymentLimit).toHaveBeenCalledWith(CLIENT_PAYMENT_HISTORY_LIMIT);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.status).toBe("SUCCEEDED");
    expect(rows[1]?.status).toBe("PENDING");
    expect(rows[0]?.amountCents).toBe(7500);
    expect(rows[0]?.bookingId).toBe("SC-1");
  });

  it("queries only payment.userId when the client owns no bookings", async () => {
    bookingFind.mockReturnValue({
      select: () => ({
        lean: async () => [],
      }),
    });
    mockPayments([]);

    const rows = await listPaymentsForClient({
      userId: "user-sarah",
      email: "sarah@example.com",
    });

    expect(paymentFind).toHaveBeenCalledWith({ userId: "user-sarah" });
    expect(rows).toEqual([]);
  });

  it("includes unclaimed email-matched bookings and not claimed-by-someone-else", async () => {
    await listPaymentsForClient({
      userId: "user-sarah",
      email: "sarah@example.com",
    });

    expect(bookingFind).toHaveBeenCalledWith(ownedBookingFilter);
    const filter = bookingFind.mock.calls[0]?.[0] as {
      $or: Array<Record<string, unknown>>;
    };
    expect(filter.$or[1]).toMatchObject({
      "customer.email": "sarah@example.com",
      $or: [{ userId: { $exists: false } }, { userId: null }],
    });
  });
});
