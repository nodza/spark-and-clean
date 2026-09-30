import { beforeEach, describe, expect, it, vi } from "vitest";

const recordSuccess = vi.fn();
const bookingFindOne = vi.fn();

vi.mock("@/lib/payments/ledger", () => ({
  recordSuccess: (...args: unknown[]) => recordSuccess(...args),
}));

vi.mock("@/lib/mongodb", () => ({
  connectDB: vi.fn(async () => undefined),
}));

vi.mock("@/models/Booking", () => ({
  Booking: {
    findOne: (...args: unknown[]) => bookingFindOne(...args),
  },
}));

describe("fulfillPaidCheckoutSession", () => {
  beforeEach(() => {
    recordSuccess.mockReset();
    bookingFindOne.mockReset();
    recordSuccess.mockResolvedValue({ ok: true });
    bookingFindOne.mockReturnValue({
      select: () => ({
        lean: async () => ({ userId: "user-sarah" }),
      }),
    });
    vi.resetModules();
  });

  it("does not record an unpaid return", async () => {
    const { fulfillPaidCheckoutSession } = await import(
      "@/lib/payments/stripeWebhook"
    );
    const result = await fulfillPaidCheckoutSession({
      id: "cs_test",
      payment_status: "unpaid",
      amount_total: 7500,
      currency: "zar",
      metadata: { bookingId: "SC-1", kind: "DEPOSIT" },
      payment_intent: "pi_1",
    });
    expect(result).toEqual({ ok: true, applied: false });
    expect(recordSuccess).not.toHaveBeenCalled();
  });

  it("records a paid deposit with booking userId", async () => {
    const { fulfillPaidCheckoutSession } = await import(
      "@/lib/payments/stripeWebhook"
    );
    await fulfillPaidCheckoutSession({
      id: "cs_test",
      payment_status: "paid",
      amount_total: 7500,
      currency: "zar",
      metadata: { bookingId: "SC-1", kind: "DEPOSIT" },
      payment_intent: "pi_1",
    });
    expect(recordSuccess).toHaveBeenCalledWith({
      provider: "stripe",
      providerRef: "pi_1",
      bookingId: "SC-1",
      userId: "user-sarah",
      kind: "DEPOSIT",
      amountCents: 7500,
      currency: "zar",
    });
  });
});
