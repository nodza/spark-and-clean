import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const findOne = vi.fn();
const retrieveCheckoutSession = vi.fn();
const fulfillPaidCheckoutSession = vi.fn();

vi.mock("@/lib/mongodb", () => ({
  connectDB: vi.fn(async () => undefined),
}));

vi.mock("@/lib/session", () => ({
  getSession: () => getSession(),
}));

vi.mock("@/models/Booking", () => ({
  Booking: {
    findOne: (...args: unknown[]) => findOne(...args),
    updateOne: () => {
      throw new Error("sync-session must not update the booking");
    },
  },
}));

vi.mock("@/lib/payments/stripe", () => ({
  retrieveCheckoutSession: (...args: unknown[]) => retrieveCheckoutSession(...args),
  getStripe: () => {
    throw new Error("sync-session must not call Stripe");
  },
}));

vi.mock("@/lib/payments/stripeWebhook", () => ({
  fulfillPaidCheckoutSession: (...args: unknown[]) =>
    fulfillPaidCheckoutSession(...args),
}));

vi.mock("@/lib/payments/ledger", () => ({
  recordSuccess: () => {
    throw new Error("sync-session must not record a payment");
  },
}));

vi.mock("@/lib/serialize", () => ({
  toClientBooking: (doc: unknown) => doc,
}));

const sarahBooking = {
  id: "SC-1",
  userId: "user-sarah",
  status: "BOOKED",
  paymentStatus: "UNPAID",
  estimatedPriceMin: 100,
  estimatedPriceMax: 200,
  customer: { email: "sarah@example.com", name: "Sarah", phone: "082", id: "c1" },
  billing: { currency: "ZAR", amountDueCents: 15000, amountPaidCents: 0 },
};

function post(body: unknown) {
  return new Request("http://localhost/api/payments/sync-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/payments/sync-session", () => {
  beforeEach(() => {
    getSession.mockReset();
    findOne.mockReset();
    retrieveCheckoutSession.mockReset();
    fulfillPaidCheckoutSession.mockReset();
    findOne.mockReturnValue({ lean: async () => sarahBooking });
    getSession.mockResolvedValue({
      id: "user-sarah",
      email: "sarah@example.com",
      role: "client",
    });
  });

  it("returns the stored status and does not record a payment from the browser", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      post({
        bookingId: "SC-1",
        clientSecret: "cs_test_paid_secret_abc",
        paymentStatus: "PAID",
      })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      applied: false,
      paymentStatus: "UNPAID",
    });
    expect(sarahBooking.paymentStatus).toBe("UNPAID");
    expect(sarahBooking.billing.amountPaidCents).toBe(0);
    expect(retrieveCheckoutSession).not.toHaveBeenCalled();
    expect(fulfillPaidCheckoutSession).not.toHaveBeenCalled();
  });
});
