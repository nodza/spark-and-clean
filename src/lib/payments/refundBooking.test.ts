import { beforeEach, describe, expect, it, vi } from "vitest";
import { refundBookingPayment } from "@/lib/payments/refundBooking";

type PaymentRow = {
  provider: string;
  providerRef: string;
  bookingId: string;
  kind: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
  reason?: string;
  sourceProviderRef?: string;
};

type BookingRow = {
  id: string;
  estimatedPriceMin: number;
  estimatedPriceMax: number;
  paymentStatus: string;
  status: string;
  billing: {
    currency: string;
    amountDueCents: number;
    amountPaidCents: number;
  };
};

const state = vi.hoisted(() => ({
  payments: [] as PaymentRow[],
  booking: null as BookingRow | null,
}));

function matches(row: PaymentRow, query: Record<string, unknown>) {
  if (query.bookingId && row.bookingId !== query.bookingId) return false;
  if (query.providerRef && row.providerRef !== query.providerRef) return false;
  if (query.status && row.status !== query.status) return false;
  if (query.sourceProviderRef && row.sourceProviderRef !== query.sourceProviderRef) {
    return false;
  }
  const kind = query.kind;
  if (typeof kind === "string" && row.kind !== kind) return false;
  if (
    kind &&
    typeof kind === "object" &&
    "$in" in kind &&
    Array.isArray((kind as { $in: string[] }).$in) &&
    !(kind as { $in: string[] }).$in.includes(row.kind)
  ) {
    return false;
  }
  return true;
}

vi.mock("@/lib/mongodb", () => ({
  connectDB: vi.fn(async () => undefined),
}));

vi.mock("@/models/Payment", () => ({
  Payment: {
    create: async (doc: PaymentRow) => {
      if (state.payments.some((row) => row.providerRef === doc.providerRef)) {
        const err = new Error("E11000 duplicate key") as Error & { code: number };
        err.code = 11000;
        throw err;
      }
      state.payments.push({ ...doc });
      return doc;
    },
    find: (query: Record<string, unknown>) => ({
      select() {
        return this;
      },
      lean: async () => state.payments.filter((row) => matches(row, query)),
    }),
    findOne: (query: Record<string, unknown>) => ({
      lean: async () => state.payments.find((row) => matches(row, query)) ?? null,
    }),
    updateOne: async () => ({ matchedCount: 0 }),
  },
}));

vi.mock("@/models/Booking", () => ({
  Booking: {
    findOne: (query: { id?: string }) => ({
      lean: async () => {
        if (!state.booking || state.booking.id !== query.id) return null;
        return state.booking;
      },
    }),
    updateOne: async (
      filter: { id?: string; $or?: Array<Record<string, unknown>> },
      update: {
        $set?: {
          billing?: BookingRow["billing"];
          paymentStatus?: string;
        };
      }
    ) => {
      const booking = state.booking;
      if (!booking || booking.id !== filter.id) return { matchedCount: 0 };
      const paid = booking.billing.amountPaidCents;
      const matchesPaid = (filter.$or ?? []).some((clause) => {
        if ("billing.amountPaidCents" in clause) {
          return clause["billing.amountPaidCents"] === paid;
        }
        if (clause.billing === null) return paid === 0;
        return false;
      });
      if (!matchesPaid) return { matchedCount: 0 };
      if (update.$set?.billing) booking.billing = update.$set.billing;
      if (update.$set?.paymentStatus) booking.paymentStatus = update.$set.paymentStatus;
      return { matchedCount: 1 };
    },
  },
}));

const KEY = "11111111-1111-4111-8111-111111111111";

function depositBooking() {
  state.booking = {
    id: "SC-1",
    estimatedPriceMin: 100,
    estimatedPriceMax: 200,
    paymentStatus: "DEPOSIT",
    status: "CONFIRMED",
    billing: {
      currency: "ZAR",
      amountDueCents: 15000,
      amountPaidCents: 7500,
    },
  };
  state.payments = [
    {
      provider: "stripe",
      providerRef: "pi_deposit",
      bookingId: "SC-1",
      kind: "DEPOSIT",
      amountCents: 7500,
      currency: "ZAR",
      status: "SUCCEEDED",
      createdAt: "2026-10-01T00:00:00.000Z",
    },
  ];
}

describe("refundBookingPayment", () => {
  beforeEach(() => {
    depositBooking();
  });

  it("refunds a card through Stripe and returns a full deposit to unpaid", async () => {
    const createRefund = vi.fn(async () => ({
      id: "re_full",
      amount: 7500,
      currency: "zar",
      status: "succeeded",
    }));
    const result = await refundBookingPayment(
      {
        bookingId: "SC-1",
        sourceProviderRef: "pi_deposit",
        amountCents: 7500,
        reason: "Customer cancelled before collection",
        idempotencyKey: KEY,
      },
      { stripe: { createRefund, listRefunds: vi.fn() } }
    );

    expect(createRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentIntentId: "pi_deposit",
        amountCents: 7500,
        idempotencyKey: KEY,
        metadata: expect.objectContaining({
          bookingId: "SC-1",
          reason: "Customer cancelled before collection",
        }),
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.paymentStatus).toBe("DEPOSIT");
    expect(result.billing.amountPaidCents).toBe(7500);
    expect(state.booking?.status).toBe("CONFIRMED");
    expect(state.payments.find((row) => row.kind === "REFUND")).toMatchObject({
      providerRef: "re_full",
      amountCents: 7500,
      sourceProviderRef: "pi_deposit",
      reason: "Customer cancelled before collection",
      status: "SUCCEEDED",
    });
  });

  it("lowers the amount paid by a partial refund", async () => {
    const createRefund = vi.fn(async (input: { amountCents: number }) => ({
      id: "re_part",
      amount: input.amountCents,
      currency: "zar",
      status: "succeeded",
    }));
    const result = await refundBookingPayment(
      {
        bookingId: "SC-1",
        sourceProviderRef: "pi_deposit",
        amountCents: 2500,
        reason: "Goodwill",
        idempotencyKey: KEY,
      },
      { stripe: { createRefund, listRefunds: vi.fn() } }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.billing.amountPaidCents).toBe(7500);
    expect(result.paymentStatus).toBe("DEPOSIT");
    expect(state.booking?.status).toBe("CONFIRMED");
  });

  it("does not call Stripe when the amount is more than what was paid", async () => {
    const createRefund = vi.fn();
    const result = await refundBookingPayment(
      {
        bookingId: "SC-1",
        sourceProviderRef: "pi_deposit",
        amountCents: 8000,
        reason: "Too much",
        idempotencyKey: KEY,
      },
      { stripe: { createRefund, listRefunds: vi.fn() } }
    );
    expect(result).toMatchObject({ ok: false, field: "amount" });
    expect(createRefund).not.toHaveBeenCalled();
    expect(state.payments).toHaveLength(1);
    expect(state.booking?.billing.amountPaidCents).toBe(7500);
  });

  it("records an Ozow refund by hand and does not add the same reference twice", async () => {
    state.payments[0].provider = "ozow";
    state.payments[0].providerRef = "ozow-tx-1";
    const createRefund = vi.fn();
    const stripe = { createRefund, listRefunds: vi.fn() };
    const first = await refundBookingPayment(
      {
        bookingId: "SC-1",
        sourceProviderRef: "ozow-tx-1",
        amountCents: 2000,
        reason: "Issued in Ozow",
        reference: "OZ-REF-1",
      },
      { stripe }
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.billing.amountPaidCents).toBe(7500);
    expect(createRefund).not.toHaveBeenCalled();

    const replay = await refundBookingPayment(
      {
        bookingId: "SC-1",
        sourceProviderRef: "ozow-tx-1",
        amountCents: 2000,
        reason: "Issued in Ozow",
        reference: "OZ-REF-1",
      },
      { stripe }
    );
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.billing.amountPaidCents).toBe(7500);
    expect(state.payments.filter((row) => row.kind === "REFUND")).toHaveLength(1);
    expect(state.booking?.paymentStatus).toBe("DEPOSIT");
  });

  it("requires a reason before refunding", async () => {
    const createRefund = vi.fn();
    const result = await refundBookingPayment(
      {
        bookingId: "SC-1",
        sourceProviderRef: "pi_deposit",
        amountCents: 1000,
        reason: "   ",
        idempotencyKey: KEY,
      },
      { stripe: { createRefund, listRefunds: vi.fn() } }
    );
    expect(result).toMatchObject({ ok: false, field: "reason" });
    expect(createRefund).not.toHaveBeenCalled();
  });
});
