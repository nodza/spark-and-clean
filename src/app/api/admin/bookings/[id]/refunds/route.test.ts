import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  refundBookingPayment: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/payments/refundBooking", () => ({
  refundBookingPayment: mocks.refundBookingPayment,
}));

import { POST } from "./route";

function postRefund(body: unknown, id = "SC-1") {
  return POST(
    new Request(`http://localhost/api/admin/bookings/${id}/refunds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({
    id: "admin-1",
    email: "ops@example.com",
    role: "admin",
    adminTier: "full",
  });
  mocks.refundBookingPayment.mockResolvedValue({
    ok: true,
    paymentStatus: "UNPAID",
    billing: { currency: "ZAR", amountDueCents: 15000, amountPaidCents: 0 },
    payment: {
      provider: "stripe",
      providerRef: "re_1",
      kind: "REFUND",
      amountCents: 7500,
      status: "SUCCEEDED",
    },
  });
});

describe("POST /api/admin/bookings/[id]/refunds", () => {
  it("lets a full admin refund and returns the recomputed payment status", async () => {
    const res = await postRefund({
      sourceProviderRef: "pi_1",
      amountCents: 7500,
      reason: "Cancelled",
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      paymentStatus: "UNPAID",
      billing: { currency: "ZAR", amountDueCents: 15000, amountPaidCents: 0 },
      payment: expect.objectContaining({ providerRef: "re_1", kind: "REFUND" }),
    });
    expect(mocks.refundBookingPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "SC-1",
        sourceProviderRef: "pi_1",
        amountCents: 7500,
        reason: "Cancelled",
      })
    );
  });

  it("returns 403 for a marketing admin before refunding", async () => {
    mocks.getSession.mockResolvedValue({
      id: "mkt-1",
      email: "marketing@example.com",
      role: "admin",
      adminTier: "marketing-only",
    });
    const res = await postRefund({
      sourceProviderRef: "pi_1",
      amountCents: 7500,
      reason: "Cancelled",
    });
    expect(res.status).toBe(403);
    expect(mocks.refundBookingPayment).not.toHaveBeenCalled();
  });

  it("returns 401 when anonymous", async () => {
    mocks.getSession.mockResolvedValue(null);
    const res = await postRefund({ amountCents: 100, reason: "No" });
    expect(res.status).toBe(401);
    expect(mocks.refundBookingPayment).not.toHaveBeenCalled();
  });

  it("returns 403 for a client", async () => {
    mocks.getSession.mockResolvedValue({
      id: "client-1",
      email: "sarah@example.com",
      role: "client",
    });
    const res = await postRefund({ amountCents: 100, reason: "No" });
    expect(res.status).toBe(403);
    expect(mocks.refundBookingPayment).not.toHaveBeenCalled();
  });
});
