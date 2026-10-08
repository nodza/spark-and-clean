import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkoutSessionIdFromClientSecret,
  createBalanceCheckoutSession,
  createDepositCheckoutSession,
} from "@/lib/payments/stripe";

const createSession = vi.fn();

vi.mock("stripe", () => ({
  default: class StripeMock {
    checkout = { sessions: { create: createSession } };
  },
}));

describe("checkoutSessionIdFromClientSecret", () => {
  it("reads the session id from a Checkout client secret", () => {
    expect(
      checkoutSessionIdFromClientSecret("cs_test_abc_secret_xyz")
    ).toBe("cs_test_abc");
    expect(checkoutSessionIdFromClientSecret("not-a-secret")).toBeNull();
  });
});

describe("createDepositCheckoutSession", () => {
  beforeEach(() => {
    createSession.mockReset();
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.APP_URL = "http://localhost:3000/";
    createSession.mockResolvedValue({
      client_secret: "cs_test_secret",
      id: "cs_test",
    });
  });

  it("sends bookingId and kind DEPOSIT and does not describe a paid booking", async () => {
    const result = await createDepositCheckoutSession({
      bookingId: "SC-1",
      customerEmail: "sarah@example.com",
      amountDueCents: 15000,
    });

    expect(result).toEqual({
      clientSecret: "cs_test_secret",
      amountCents: 7500,
    });
    expect(createSession).toHaveBeenCalledOnce();
    const payload = createSession.mock.calls[0][0];
    expect(payload.ui_mode).toBe("form");
    expect(payload.mode).toBe("payment");
    expect(payload.billing_address_collection).toBe("auto");
    expect(payload.phone_number_collection).toEqual({ enabled: false });
    expect(payload.automatic_tax).toEqual({ enabled: false });
    expect(payload.submit_type).toBe("auto");
    expect(payload.integration_identifier).toBe("custom_embedded_web_0001");
    expect(payload.payment_method_collection).toBeUndefined();
    expect(payload.line_items[0].price_data.unit_amount).toBe(7500);
    expect(payload.line_items[0].price_data.currency).toBe("zar");
    expect(payload.metadata).toEqual({ bookingId: "SC-1", kind: "DEPOSIT" });
    expect(payload.client_reference_id).toBe("SC-1");
    expect(payload.customer_email).toBeUndefined();
    expect(payload.return_url).toBe(
      "http://localhost:3000/booking/SC-1?checkout=success"
    );
  });
});

describe("createBalanceCheckoutSession", () => {
  beforeEach(() => {
    createSession.mockReset();
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.APP_URL = "http://localhost:3000/";
    createSession.mockResolvedValue({
      client_secret: "cs_test_balance",
      id: "cs_test_balance",
    });
  });

  it("charges the remaining cents with kind BALANCE", async () => {
    const result = await createBalanceCheckoutSession({
      bookingId: "SC-1",
      customerEmail: "sarah@example.com",
      amountCents: 7500,
    });

    expect(result).toEqual({
      clientSecret: "cs_test_balance",
      amountCents: 7500,
    });
    const payload = createSession.mock.calls[0][0];
    expect(payload.line_items[0].price_data.unit_amount).toBe(7500);
    expect(payload.metadata).toEqual({ bookingId: "SC-1", kind: "BALANCE" });
    expect(payload.customer_email).toBeUndefined();
    expect(payload.payment_intent_data.metadata).toEqual({
      bookingId: "SC-1",
      kind: "BALANCE",
    });
  });
});
