import { beforeEach, describe, expect, it, vi } from "vitest";

const recordSuccess = vi.fn();

vi.mock("@/lib/payments/ledger", () => ({
  recordSuccess: (...args: unknown[]) => recordSuccess(...args),
}));

describe("fulfillPaidCheckoutSession", () => {
  beforeEach(() => {
    recordSuccess.mockReset();
    recordSuccess.mockResolvedValue({ ok: true });
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
    recordSuccess.mockResolvedValue({ ok: true });
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
    recordSuccess.mockResolvedValue({ ok: true });
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
  });
});

