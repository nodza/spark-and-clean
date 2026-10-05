import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const findOne = vi.fn();
const createDepositCheckoutSession = vi.fn();
const createBalanceCheckoutSession = vi.fn();
const createOzowHostedPayment = vi.fn();

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
      throw new Error("create-session must not update the booking");
    },
  },
}));

vi.mock("@/lib/payments/stripe", () => ({
  createDepositCheckoutSession: (...args: unknown[]) =>
    createDepositCheckoutSession(...args),
  createBalanceCheckoutSession: (...args: unknown[]) =>
    createBalanceCheckoutSession(...args),
}));

vi.mock("@/lib/payments/ozow", () => ({
  createOzowHostedPayment: (...args: unknown[]) =>
    createOzowHostedPayment(...args),
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
  customer: {
    email: "sarah@example.com",
    name: "Sarah",
    phone: "082",
    id: "c1",
  },
  billing: { currency: "ZAR", amountDueCents: 15000, amountPaidCents: 0 },
};

const sarahDepositBooking = {
  ...sarahBooking,
  paymentStatus: "DEPOSIT",
  billing: { currency: "ZAR", amountDueCents: 15000, amountPaidCents: 7500 },
};

function post(body: unknown) {
  return new Request("http://localhost/api/payments/create-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/payments/create-session", () => {
  beforeEach(() => {
    getSession.mockReset();
    findOne.mockReset();
    createDepositCheckoutSession.mockReset();
    createBalanceCheckoutSession.mockReset();
    createOzowHostedPayment.mockReset();
    findOne.mockReturnValue({
      lean: async () => ({ ...sarahBooking, billing: { ...sarahBooking.billing } }),
    });
    createDepositCheckoutSession.mockResolvedValue({
      clientSecret: "cs_test_secret",
      amountCents: 7500,
    });
    createBalanceCheckoutSession.mockResolvedValue({
      clientSecret: "cs_test_balance",
      amountCents: 7500,
    });
    createOzowHostedPayment.mockResolvedValue({
      url: "https://pay.ozow.com/test",
      paymentRequestId: "pr-1",
      amountCents: 7500,
      transactionReference: "SC-1-DEP-ABC",
    });
    vi.resetModules();
  });

  it("starts Stripe Checkout for the owning client", async () => {
    getSession.mockResolvedValue({
      id: "user-sarah",
      email: "sarah@example.com",
      role: "client",
    });
    const { POST } = await import("./route");
    const res = await POST(
      post({ bookingId: "SC-1", kind: "DEPOSIT", provider: "STRIPE" })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      client_secret: "cs_test_secret",
      provider: "STRIPE",
      kind: "DEPOSIT",
    });
    expect(sarahBooking.paymentStatus).toBe("UNPAID");
    expect(sarahBooking.billing.amountPaidCents).toBe(0);
    expect(createDepositCheckoutSession).toHaveBeenCalledWith({
      bookingId: "SC-1",
      customerEmail: "sarah@example.com",
      amountDueCents: 15000,
    });
    expect(createOzowHostedPayment).not.toHaveBeenCalled();
  });

  it("starts Ozow Instant EFT for the owning client", async () => {
    getSession.mockResolvedValue({
      id: "user-sarah",
      email: "sarah@example.com",
      role: "client",
    });
    const { POST } = await import("./route");
    const res = await POST(
      post({ bookingId: "SC-1", kind: "DEPOSIT", provider: "OZOW" })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      url: "https://pay.ozow.com/test",
      provider: "OZOW",
      kind: "DEPOSIT",
      amountCents: 7500,
    });
    expect(createOzowHostedPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "SC-1",
        kind: "DEPOSIT",
        amountCents: 7500,
      })
    );
    expect(createDepositCheckoutSession).not.toHaveBeenCalled();
  });

  it("starts a Stripe balance Checkout for remaining cents when status is DEPOSIT", async () => {
    getSession.mockResolvedValue({
      id: "user-sarah",
      email: "sarah@example.com",
      role: "client",
    });
    findOne.mockReturnValue({ lean: async () => sarahDepositBooking });
    const { POST } = await import("./route");
    const res = await POST(
      post({ bookingId: "SC-1", kind: "BALANCE", provider: "STRIPE" })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      client_secret: "cs_test_balance",
      provider: "STRIPE",
      kind: "BALANCE",
    });
    expect(createBalanceCheckoutSession).toHaveBeenCalledWith({
      bookingId: "SC-1",
      customerEmail: "sarah@example.com",
      amountCents: 7500,
    });
    expect(createDepositCheckoutSession).not.toHaveBeenCalled();
  });

  it("rejects BALANCE unless paymentStatus is DEPOSIT", async () => {
    getSession.mockResolvedValue({
      id: "user-sarah",
      email: "sarah@example.com",
      role: "client",
    });
    const { POST } = await import("./route");
    const res = await POST(
      post({ bookingId: "SC-1", kind: "BALANCE", provider: "STRIPE" })
    );
    expect(res.status).toBe(409);
    expect(createBalanceCheckoutSession).not.toHaveBeenCalled();
  });

  it("rejects BALANCE when remaining cents are zero", async () => {
    getSession.mockResolvedValue({
      id: "user-sarah",
      email: "sarah@example.com",
      role: "client",
    });
    findOne.mockReturnValue({
      lean: async () => ({
        ...sarahDepositBooking,
        billing: {
          currency: "ZAR",
          amountDueCents: 15000,
          amountPaidCents: 15000,
        },
      }),
    });
    const { POST } = await import("./route");
    const res = await POST(
      post({ bookingId: "SC-1", kind: "BALANCE", provider: "STRIPE" })
    );
    expect(res.status).toBe(400);
    expect(createBalanceCheckoutSession).not.toHaveBeenCalled();
  });

  it("returns 403 when the client does not own the booking", async () => {
    getSession.mockResolvedValue({
      id: "user-other",
      email: "other@example.com",
      role: "client",
    });
    const { POST } = await import("./route");
    const res = await POST(
      post({ bookingId: "SC-1", kind: "DEPOSIT", provider: "OZOW" })
    );
    expect(res.status).toBe(403);
    expect(createOzowHostedPayment).not.toHaveBeenCalled();
  });

  it("returns 401 for an anonymous caller", async () => {
    getSession.mockResolvedValue(null);
    const { POST } = await import("./route");
    const res = await POST(
      post({ bookingId: "SC-1", kind: "DEPOSIT", provider: "STRIPE" })
    );
    expect(res.status).toBe(401);
    expect(findOne).not.toHaveBeenCalled();
  });

  it("returns 403 for a technician", async () => {
    getSession.mockResolvedValue({
      id: "tech-1",
      email: "thabo@example.com",
      role: "technician",
    });
    const { POST } = await import("./route");
    const res = await POST(
      post({ bookingId: "SC-1", kind: "DEPOSIT", provider: "OZOW" })
    );
    expect(res.status).toBe(403);
    expect(createOzowHostedPayment).not.toHaveBeenCalled();
  });
});
