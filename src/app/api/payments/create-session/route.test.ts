import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const findOne = vi.fn();
const createDepositCheckoutSession = vi.fn();

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
    findOne.mockReturnValue({ lean: async () => sarahBooking });
    createDepositCheckoutSession.mockResolvedValue({
      clientSecret: "cs_test_secret",
      amountCents: 7500,
    });
  });

  it("starts Checkout for the owning client at half of billing.amountDueCents", async () => {
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
    });
    expect(createDepositCheckoutSession).toHaveBeenCalledWith({
      bookingId: "SC-1",
      customerEmail: "sarah@example.com",
      amountDueCents: 15000,
    });
  });

  it("returns 403 when the client does not own the booking", async () => {
    getSession.mockResolvedValue({
      id: "user-other",
      email: "other@example.com",
      role: "client",
    });
    const { POST } = await import("./route");
    const res = await POST(
      post({ bookingId: "SC-1", kind: "DEPOSIT", provider: "STRIPE" })
    );
    expect(res.status).toBe(403);
    expect(createDepositCheckoutSession).not.toHaveBeenCalled();
  });

  it("returns 401 for an anonymous caller", async () => {
    getSession.mockResolvedValue(null);
    const { POST } = await import("./route");
    const res = await POST(
      post({ bookingId: "SC-1", kind: "DEPOSIT", provider: "STRIPE" })
    );
    expect(res.status).toBe(401);
    expect(findOne).not.toHaveBeenCalled();
    expect(createDepositCheckoutSession).not.toHaveBeenCalled();
  });

  it("returns 403 for a technician", async () => {
    getSession.mockResolvedValue({
      id: "tech-1",
      email: "thabo@example.com",
      role: "technician",
    });
    const { POST } = await import("./route");
    const res = await POST(
      post({ bookingId: "SC-1", kind: "DEPOSIT", provider: "STRIPE" })
    );
    expect(res.status).toBe(403);
    expect(findOne).not.toHaveBeenCalled();
    expect(createDepositCheckoutSession).not.toHaveBeenCalled();
  });
});
