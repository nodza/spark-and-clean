import { beforeEach, describe, expect, it, vi } from "vitest";

const recordSuccess = vi.fn();
const recordFailure = vi.fn();
const findSucceededTransfer = vi.fn();

vi.mock("@/lib/payments/ledger", () => ({
  recordSuccess: (...args: unknown[]) => recordSuccess(...args),
  recordFailure: (...args: unknown[]) => recordFailure(...args),
  findSucceededTransfer: (...args: unknown[]) => findSucceededTransfer(...args),
}));

describe("fulfillPaidCheckoutSession", () => {
  beforeEach(() => {
    recordSuccess.mockReset();
    recordFailure.mockReset();
    findSucceededTransfer.mockReset();
    recordSuccess.mockResolvedValue({ ok: true });
    recordFailure.mockResolvedValue({ ok: true, applied: true });
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

  it("records a paid deposit; userId is stamped inside recordSuccess", async () => {
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
      kind: "DEPOSIT",
      amountCents: 7500,
      currency: "zar",
    });
  });
});

describe("fulfillSucceededPaymentIntent", () => {
  beforeEach(() => {
    recordSuccess.mockReset();
    recordFailure.mockReset();
    recordSuccess.mockResolvedValue({ ok: true });
    recordFailure.mockResolvedValue({ ok: true, applied: true });
  });

  it("records a succeeded intent against the same providerRef as Checkout", async () => {
    const { fulfillSucceededPaymentIntent } = await import(
      "@/lib/payments/stripeWebhook"
    );
    await fulfillSucceededPaymentIntent({
      id: "pi_1",
      status: "succeeded",
      amount: 7500,
      amount_received: 7500,
      currency: "zar",
      metadata: { bookingId: "SC-1", kind: "DEPOSIT" },
    });
    expect(recordSuccess).toHaveBeenCalledWith({
      provider: "stripe",
      providerRef: "pi_1",
      bookingId: "SC-1",
      kind: "DEPOSIT",
      amountCents: 7500,
      currency: "zar",
    });
  });

  it("does not record an intent that is not tied to a booking deposit", async () => {
    const { fulfillSucceededPaymentIntent } = await import(
      "@/lib/payments/stripeWebhook"
    );
    const result = await fulfillSucceededPaymentIntent({
      id: "pi_1",
      status: "succeeded",
      amount_received: 7500,
      currency: "zar",
      metadata: {},
    });
    expect(result).toEqual({ ok: true, applied: false });
    expect(recordSuccess).not.toHaveBeenCalled();
  });
});

describe("applyStripeEvent", () => {
  beforeEach(() => {
    recordSuccess.mockReset();
    recordFailure.mockReset();
    findSucceededTransfer.mockReset();
    recordSuccess.mockResolvedValue({ ok: true });
    recordFailure.mockResolvedValue({ ok: true, applied: true });
  });

  it("ignores unrelated event types", async () => {
    const { applyStripeEvent } = await import("@/lib/payments/stripeWebhook");
    const result = await applyStripeEvent({
      id: "evt_customer",
      object: "event",
      type: "customer.created",
      data: { object: { id: "cus_1" } },
    } as never);
    expect(result).toEqual({ ok: true, applied: false });
    expect(recordSuccess).not.toHaveBeenCalled();
    expect(recordFailure).not.toHaveBeenCalled();
  });

  it("records a declined card as FAILED against the PaymentIntent id", async () => {
    const { applyStripeEvent } = await import("@/lib/payments/stripeWebhook");
    await applyStripeEvent({
      id: "evt_fail",
      object: "event",
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: "pi_declined",
          amount: 7500,
          currency: "zar",
          status: "requires_payment_method",
          metadata: { bookingId: "SC-1", kind: "DEPOSIT" },
        },
      },
    } as never);
    expect(recordFailure).toHaveBeenCalledWith({
      provider: "stripe",
      providerRef: "pi_declined",
      bookingId: "SC-1",
      kind: "DEPOSIT",
      amountCents: 7500,
      currency: "zar",
    });
    expect(recordSuccess).not.toHaveBeenCalled();
  });

  it("uses the PaymentIntent id for an async payment failure", async () => {
    const { applyStripeEvent } = await import("@/lib/payments/stripeWebhook");
    await applyStripeEvent({
      id: "evt_async_fail",
      object: "event",
      type: "checkout.session.async_payment_failed",
      data: {
        object: {
          id: "cs_async",
          amount_total: 7500,
          currency: "zar",
          payment_intent: "pi_declined",
          metadata: { bookingId: "SC-1", kind: "DEPOSIT" },
        },
      },
    } as never);
    expect(recordFailure).toHaveBeenCalledWith(
      expect.objectContaining({ providerRef: "pi_declined", kind: "DEPOSIT" })
    );
  });

  it("records each Stripe refund id and can resolve the booking from the original charge", async () => {
    findSucceededTransfer.mockResolvedValue({ bookingId: "SC-1" });
    const { applyStripeEvent } = await import("@/lib/payments/stripeWebhook");
    await applyStripeEvent({
      id: "evt_refund",
      object: "event",
      type: "charge.refunded",
      data: {
        object: {
          id: "ch_1",
          currency: "zar",
          payment_intent: "pi_1",
          refunds: {
            data: [
              {
                id: "re_partial",
                amount: 2500,
                currency: "zar",
                status: "succeeded",
                metadata: { reason: "Customer cancelled" },
              },
            ],
          },
        },
      },
    } as never);
    expect(findSucceededTransfer).toHaveBeenCalledWith("pi_1");
    expect(recordSuccess).toHaveBeenCalledWith({
      provider: "stripe",
      providerRef: "re_partial",
      bookingId: "SC-1",
      kind: "REFUND",
      amountCents: 2500,
      currency: "zar",
      sourceProviderRef: "pi_1",
      reason: "Customer cancelled",
    });
  });
});

