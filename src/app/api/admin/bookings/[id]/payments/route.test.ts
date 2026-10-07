import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  connectDB: vi.fn(),
  bookingFindOne: vi.fn(),
  listPaymentsForBooking: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/mongodb", () => ({ connectDB: mocks.connectDB }));
vi.mock("@/models/Booking", () => ({
  Booking: { findOne: mocks.bookingFindOne },
}));
vi.mock("@/lib/payments/listBookingPayments", () => ({
  listPaymentsForBooking: mocks.listPaymentsForBooking,
}));

import { GET } from "./route";

const bookingId = "SC-1";

function getPayments(id = bookingId) {
  return GET(new Request(`http://localhost/api/admin/bookings/${id}/payments`), {
    params: Promise.resolve({ id }),
  });
}

function foundBooking() {
  mocks.bookingFindOne.mockReturnValue({
    select: () => ({
      lean: async () => ({ id: bookingId }),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.connectDB.mockResolvedValue(undefined);
  mocks.getSession.mockResolvedValue({
    id: "admin-1",
    email: "ops@example.com",
    role: "admin",
    adminTier: "full",
  });
  foundBooking();
  mocks.listPaymentsForBooking.mockResolvedValue([
    {
      id: "pay-1",
      provider: "stripe",
      providerRef: "pi_succeeded_1",
      kind: "DEPOSIT",
      amountCents: 7500,
      currency: "ZAR",
      status: "SUCCEEDED",
      createdAt: "2026-10-05T12:00:00.000Z",
    },
  ]);
});

describe("GET /api/admin/bookings/[id]/payments", () => {
  it("returns a succeeded Stripe providerRef for a full admin", async () => {
    const res = await getPayments();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      payments: [
        expect.objectContaining({
          provider: "stripe",
          providerRef: "pi_succeeded_1",
          kind: "DEPOSIT",
          amountCents: 7500,
          status: "SUCCEEDED",
        }),
      ],
    });
    expect(mocks.listPaymentsForBooking).toHaveBeenCalledWith(bookingId);
  });

  it("returns 403 for a marketing-only admin before loading payments", async () => {
    mocks.getSession.mockResolvedValue({
      id: "mkt-1",
      email: "marketing@example.com",
      role: "admin",
      adminTier: "marketing-only",
    });

    const res = await getPayments();
    expect(res.status).toBe(403);
    expect(mocks.connectDB).not.toHaveBeenCalled();
    expect(mocks.bookingFindOne).not.toHaveBeenCalled();
    expect(mocks.listPaymentsForBooking).not.toHaveBeenCalled();
  });

  it("returns 401 when anonymous", async () => {
    mocks.getSession.mockResolvedValue(null);
    const res = await getPayments();
    expect(res.status).toBe(401);
    expect(mocks.listPaymentsForBooking).not.toHaveBeenCalled();
  });

  it("returns 403 for a client", async () => {
    mocks.getSession.mockResolvedValue({
      id: "client-1",
      email: "sarah@example.com",
      role: "client",
    });
    const res = await getPayments();
    expect(res.status).toBe(403);
    expect(mocks.listPaymentsForBooking).not.toHaveBeenCalled();
  });

  it("returns 404 when the booking does not exist", async () => {
    mocks.bookingFindOne.mockReturnValue({
      select: () => ({
        lean: async () => null,
      }),
    });
    const res = await getPayments("SC-MISSING");
    expect(res.status).toBe(404);
    expect(mocks.listPaymentsForBooking).not.toHaveBeenCalled();
  });
});
