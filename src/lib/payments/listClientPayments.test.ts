import { beforeEach, describe, expect, it, vi } from "vitest";

const connectDB = vi.fn();
const bookingFind = vi.fn();
const paymentFind = vi.fn();

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

import { listPaymentsForClient } from "@/lib/payments/listClientPayments";

describe("listPaymentsForClient", () => {
  beforeEach(() => {
    connectDB.mockReset();
    bookingFind.mockReset();
    paymentFind.mockReset();
    connectDB.mockResolvedValue(undefined);
    bookingFind.mockReturnValue({
      select: () => ({
        lean: async () => [{ id: "SC-1" }],
      }),
    });
    paymentFind.mockReturnValue({
      sort: () => ({
        lean: async () => [
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
        ],
      }),
    });
  });

  it("returns owned payments including pending rows, newest first", async () => {
    const rows = await listPaymentsForClient({
      userId: "user-sarah",
      email: "sarah@example.com",
    });

    expect(paymentFind).toHaveBeenCalledWith({
      $or: [{ userId: "user-sarah" }, { bookingId: { $in: ["SC-1"] } }],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]?.status).toBe("SUCCEEDED");
    expect(rows[1]?.status).toBe("PENDING");
    expect(rows[0]?.amountCents).toBe(7500);
    expect(rows[0]?.bookingId).toBe("SC-1");
  });
});
