import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  derivePaymentStatus,
  estimateMidpointCents,
  isMongoDuplicateKeyError,
  recomputeBookingPaymentStatus,
  resolveAmountDueCents,
  resolveAmountPaidCents,
  recordSuccess,
} from "@/lib/payments/ledger";

vi.mock("@/lib/mongodb", () => ({
  connectDB: vi.fn(async () => undefined),
}));

const paymentCreate = vi.fn();
const paymentFind = vi.fn();
const paymentFindOne = vi.fn();
const bookingFindOne = vi.fn();
const bookingUpdateOne = vi.fn();

vi.mock("@/models/Payment", () => ({
  Payment: {
    create: (...args: unknown[]) => paymentCreate(...args),
    find: (...args: unknown[]) => paymentFind(...args),
    findOne: (...args: unknown[]) => paymentFindOne(...args),
  },
  PAYMENT_KINDS: ["DEPOSIT", "BALANCE", "REFUND"],
}));

vi.mock("@/models/Booking", () => ({
  Booking: {
    findOne: (...args: unknown[]) => bookingFindOne(...args),
    updateOne: (...args: unknown[]) => bookingUpdateOne(...args),
  },
}));

describe("estimateMidpointCents / resolveAmountDueCents", () => {
  it("converts estimate midpoint to cents", () => {
    expect(estimateMidpointCents(100, 200)).toBe(15000);
  });

  it("uses promotion.amountDueCents when present (E8)", () => {
    expect(
      resolveAmountDueCents({
        estimatedPriceMin: 100,
        estimatedPriceMax: 200,
        promotion: { amountDueCents: 12000 },
      })
    ).toBe(12000);
  });

  it("falls back to midpoint when promotion is missing", () => {
    expect(
      resolveAmountDueCents({
        estimatedPriceMin: 80,
        estimatedPriceMax: 120,
      })
    ).toBe(10000);
  });

  it("keeps the saved amount due when the estimate later changes", () => {
    expect(
      resolveAmountDueCents({
        estimatedPriceMin: 100,
        estimatedPriceMax: 200,
        billing: {
          currency: "ZAR",
          amountDueCents: 5000,
          amountPaidCents: 2500,
        },
      })
    ).toBe(5000);
  });

  it("lets a promotion override the saved amount due", () => {
    expect(
      resolveAmountDueCents({
        estimatedPriceMin: 100,
        estimatedPriceMax: 200,
        billing: {
          currency: "ZAR",
          amountDueCents: 5000,
          amountPaidCents: 0,
        },
        promotion: { amountDueCents: 9000 },
      })
    ).toBe(9000);
  });
});

describe("resolveAmountPaidCents / missing billing", () => {
  it("treats missing billing as amountPaid = 0", () => {
    expect(
      resolveAmountPaidCents({
        estimatedPriceMin: 100,
        estimatedPriceMax: 200,
      })
    ).toBe(0);
  });
});

describe("derivePaymentStatus / recomputeBookingPaymentStatus", () => {
  it("returns UNPAID when nothing paid", () => {
    expect(derivePaymentStatus(0, 15000)).toBe("UNPAID");
    expect(
      recomputeBookingPaymentStatus({
        estimatedPriceMin: 100,
        estimatedPriceMax: 200,
      })
    ).toBe("UNPAID");
  });

  it("returns DEPOSIT for a 50% succeeded deposit", () => {
    const due = 15000;
    const paid = Math.round(due * 0.5);
    expect(derivePaymentStatus(paid, due)).toBe("DEPOSIT");
    expect(
      recomputeBookingPaymentStatus({
        estimatedPriceMin: 100,
        estimatedPriceMax: 200,
        billing: {
          currency: "ZAR",
          amountDueCents: due,
          amountPaidCents: paid,
        },
      })
    ).toBe("DEPOSIT");
  });

  it("returns PAID when amountPaidCents >= amountDueCents", () => {
    expect(derivePaymentStatus(15000, 15000)).toBe("PAID");
    expect(derivePaymentStatus(16000, 15000)).toBe("PAID");
  });

  it("returns PAID when nothing is owed", () => {
    expect(derivePaymentStatus(0, 0)).toBe("PAID");
    expect(
      recomputeBookingPaymentStatus({
        estimatedPriceMin: 100,
        estimatedPriceMax: 200,
        promotion: { amountDueCents: 0 },
      })
    ).toBe("PAID");
  });
});

describe("isMongoDuplicateKeyError", () => {
  it("detects Mongo duplicate key (11000)", () => {
    expect(isMongoDuplicateKeyError({ code: 11000 })).toBe(true);
    expect(isMongoDuplicateKeyError({ cause: { code: 11000 } })).toBe(true);
    expect(isMongoDuplicateKeyError({ code: 1 })).toBe(false);
    expect(isMongoDuplicateKeyError(null)).toBe(false);
  });
});

describe("recordSuccess", () => {
  beforeEach(() => {
    paymentCreate.mockReset();
    paymentFind.mockReset();
    paymentFindOne.mockReset();
    bookingFindOne.mockReset();
    bookingUpdateOne.mockReset();
    bookingUpdateOne.mockResolvedValue({ matchedCount: 1 });
  });

  it("inserting a 50% DEPOSIT sets DEPOSIT status and amountPaidCents", async () => {
    bookingFindOne.mockReturnValue({
      lean: async () => ({
        id: "SC-1",
        estimatedPriceMin: 100,
        estimatedPriceMax: 200,
      }),
    });
    paymentCreate.mockResolvedValue({});
    paymentFind.mockReturnValue({
      select: () => ({
        lean: async () => [{ amountCents: 7500 }],
      }),
    });
    const result = await recordSuccess({
      provider: "test",
      providerRef: "pi_deposit_1",
      bookingId: "SC-1",
      kind: "DEPOSIT",
      amountCents: 7500,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.paymentStatus).toBe("DEPOSIT");
    expect(result.billing.amountDueCents).toBe(15000);
    expect(result.billing.amountPaidCents).toBe(7500);
    expect(bookingUpdateOne).toHaveBeenCalled();
  });

  it("a second payment that fills amountDue sets PAID", async () => {
    bookingFindOne.mockReturnValue({
      lean: async () => ({
        id: "SC-1",
        estimatedPriceMin: 100,
        estimatedPriceMax: 200,
        billing: {
          currency: "ZAR",
          amountDueCents: 15000,
          amountPaidCents: 7500,
        },
      }),
    });
    paymentCreate.mockResolvedValue({});
    paymentFind.mockReturnValue({
      select: () => ({
        lean: async () => [{ amountCents: 7500 }, { amountCents: 7500 }],
      }),
    });
    const result = await recordSuccess({
      provider: "test",
      providerRef: "pi_balance_1",
      bookingId: "SC-1",
      kind: "BALANCE",
      amountCents: 7500,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.paymentStatus).toBe("PAID");
    expect(result.billing.amountPaidCents).toBe(15000);
  });

  it("reconciles a duplicate providerRef without adding the amount again", async () => {
    bookingFindOne.mockReturnValue({
      lean: async () => ({
        id: "SC-1",
        estimatedPriceMin: 100,
        estimatedPriceMax: 200,
      }),
    });
    paymentCreate.mockRejectedValue({ code: 11000 });
    paymentFindOne.mockReturnValue({
      lean: async () => ({
        provider: "test",
        providerRef: "pi_dup",
        bookingId: "SC-1",
        kind: "DEPOSIT",
        amountCents: 7500,
        currency: "ZAR",
        status: "SUCCEEDED",
        createdAt: "2026-09-25T00:00:00.000Z",
      }),
    });
    paymentFind.mockReturnValue({
      select: () => ({
        lean: async () => [{ amountCents: 7500, kind: "DEPOSIT" }],
      }),
    });

    const result = await recordSuccess({
      provider: "test",
      providerRef: "pi_dup",
      bookingId: "SC-1",
      kind: "DEPOSIT",
      amountCents: 7500,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.paymentStatus).toBe("DEPOSIT");
    expect(result.billing.amountPaidCents).toBe(7500);
    expect(result.payment.amountCents).toBe(7500);
    expect(bookingUpdateOne).toHaveBeenCalled();
  });

  it("does not reconcile a duplicate providerRef that belongs to another booking", async () => {
    bookingFindOne.mockReturnValue({
      lean: async () => ({
        id: "SC-1",
        estimatedPriceMin: 100,
        estimatedPriceMax: 200,
      }),
    });
    paymentCreate.mockRejectedValue({ code: 11000 });
    paymentFindOne.mockReturnValue({
      lean: async () => ({
        providerRef: "pi_dup",
        bookingId: "SC-OTHER",
        status: "SUCCEEDED",
        kind: "DEPOSIT",
        amountCents: 7500,
      }),
    });

    const result = await recordSuccess({
      provider: "test",
      providerRef: "pi_dup",
      bookingId: "SC-1",
      kind: "DEPOSIT",
      amountCents: 7500,
    });

    expect(result).toEqual({ ok: false, error: "duplicate_provider_ref" });
    expect(bookingUpdateOne).not.toHaveBeenCalled();
    expect(paymentFind).not.toHaveBeenCalled();
  });

  it("subtracts a succeeded refund from amount paid", async () => {
    bookingFindOne.mockReturnValue({
      lean: async () => ({
        id: "SC-1",
        estimatedPriceMin: 100,
        estimatedPriceMax: 200,
        billing: {
          currency: "ZAR",
          amountDueCents: 15000,
          amountPaidCents: 15000,
        },
      }),
    });
    paymentCreate.mockResolvedValue({});
    paymentFind.mockReturnValue({
      select: () => ({
        lean: async () => [
          { amountCents: 15000, kind: "DEPOSIT" },
          { amountCents: 7500, kind: "REFUND" },
        ],
      }),
    });

    const result = await recordSuccess({
      provider: "test",
      providerRef: "re_1",
      bookingId: "SC-1",
      kind: "REFUND",
      amountCents: 7500,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.billing.amountPaidCents).toBe(7500);
    expect(result.paymentStatus).toBe("DEPOSIT");
  });

  it("rejects a non-ZAR currency before writing a payment", async () => {
    const result = await recordSuccess({
      provider: "test",
      providerRef: "pi_usd",
      bookingId: "SC-1",
      kind: "DEPOSIT",
      amountCents: 7500,
      currency: "USD",
    });

    expect(result).toEqual({ ok: false, error: "invalid_currency" });
    expect(paymentCreate).not.toHaveBeenCalled();
    expect(bookingFindOne).not.toHaveBeenCalled();
  });

  it("retries when another writer changed paid cents first", async () => {
    bookingFindOne.mockReturnValue({
      lean: async () => ({
        id: "SC-1",
        estimatedPriceMin: 100,
        estimatedPriceMax: 200,
      }),
    });
    paymentCreate.mockResolvedValue({});
    let reads = 0;
    paymentFind.mockImplementation(() => ({
      select: () => ({
        lean: async () => {
          reads += 1;
          return reads === 1
            ? [{ amountCents: 7500, kind: "DEPOSIT" }]
            : [
                { amountCents: 7500, kind: "DEPOSIT" },
                { amountCents: 7500, kind: "BALANCE" },
              ];
        },
      }),
    }));
    bookingUpdateOne
      .mockResolvedValueOnce({ matchedCount: 0 })
      .mockResolvedValueOnce({ matchedCount: 1 });

    const result = await recordSuccess({
      provider: "test",
      providerRef: "pi_race",
      bookingId: "SC-1",
      kind: "BALANCE",
      amountCents: 7500,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.billing.amountPaidCents).toBe(15000);
    expect(result.paymentStatus).toBe("PAID");
    expect(bookingUpdateOne).toHaveBeenCalledTimes(2);
  });
});
