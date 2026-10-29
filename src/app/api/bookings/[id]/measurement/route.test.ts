import { beforeEach, describe, expect, it, vi } from "vitest";
import { estimateBookingPrice } from "@/lib/bookingEstimate";
import { estimateQuoteMidpointCents } from "@/lib/promotion/applyCoupon";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  connectDB: vi.fn(),
  bookingFindOne: vi.fn(),
  bookingFindOneAndUpdate: vi.fn(),
  paymentFind: vi.fn(),
  couponFindOne: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/mongodb", () => ({ connectDB: mocks.connectDB }));
vi.mock("@/models/Booking", () => ({
  Booking: {
    findOne: mocks.bookingFindOne,
    findOneAndUpdate: mocks.bookingFindOneAndUpdate,
  },
}));
vi.mock("@/models/Payment", () => ({
  Payment: { find: mocks.paymentFind },
}));
vi.mock("@/models/Coupon", () => ({
  Coupon: { findOne: mocks.couponFindOne },
}));

import { PATCH } from "./route";

const bookingId = "SC-SIZE";

function chain(result: unknown) {
  const query = {
    select: vi.fn(() => query),
    lean: vi.fn().mockResolvedValue(result),
  };
  return query;
}

function patch(body: unknown, id = bookingId) {
  return PATCH(
    new Request(`http://localhost/api/bookings/${id}/measurement`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  );
}

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: bookingId,
    status: "SCHEDULED",
    paymentStatus: "UNPAID",
    assignedDriverId: "driver_thabo",
    estimatedPriceMin: 0,
    estimatedPriceMax: 0,
    rug: { type: "Persian", widthM: 5, lengthM: 4, areaSqM: 20 },
    addOns: { odourRemoval: false, stainProtection: false },
    customer: {
      id: "c1",
      name: "Sarah",
      phone: "0820000000",
      email: "sarah@example.com",
    },
    suburb: "Rosebank",
    addressLine1: "1 Jan Smuts",
    city: "Johannesburg",
    collectionDate: "2026-10-29",
    collectionSlot: "MORNING",
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({
    id: "tech-1",
    email: "thabo@sparkandclean.co.za",
    role: "technician",
    driverProfileId: "driver_thabo",
  });
  mocks.connectDB.mockResolvedValue(undefined);
  mocks.bookingFindOne.mockImplementation(() => chain(booking()));
  mocks.bookingFindOneAndUpdate.mockImplementation((_filter, update) => {
    const set = (update as { $set?: Record<string, unknown> }).$set ?? {};
    const current = booking();
    const rug = { ...(current.rug as Record<string, unknown>) };
    const next: Record<string, unknown> = { ...current, rug };
    for (const [key, value] of Object.entries(set)) {
      if (key.startsWith("rug.")) {
        rug[key.slice(4)] = value;
      } else {
        next[key] = value;
      }
    }
    return chain(next);
  });
  mocks.paymentFind.mockReturnValue({
    select: () => ({ lean: async () => [] }),
  });
  mocks.couponFindOne.mockReturnValue({
    select: () => ({ lean: async () => null }),
  });
});

describe("PATCH /api/bookings/[id]/measurement", () => {
  it("corrects a scheduled size and reprices, ignoring a posted price", async () => {
    const estimate = estimateBookingPrice({
      rug: { type: "Persian", widthM: 2, lengthM: 3, areaSqM: 6 },
      addOns: { odourRemoval: false, stainProtection: false },
    });
    const amountDueCents = estimateQuoteMidpointCents(
      estimate.totalMin,
      estimate.totalMax
    );

    const res = await patch({
      widthM: 2,
      lengthM: 3,
      estimatedPriceMin: 1,
      amountDueCents: 1,
      billing: { amountDueCents: 1, amountPaidCents: 999 },
    });

    expect(res.status).toBe(200);
    const update = mocks.bookingFindOneAndUpdate.mock.calls[0][1] as {
      $set: Record<string, unknown>;
    };
    expect(update.$set.status).toBeUndefined();
    expect(update.$set["rug.widthM"]).toBe(2);
    expect(update.$set["rug.lengthM"]).toBe(3);
    expect(update.$set["rug.areaSqM"]).toBe(6);
    expect(update.$set.estimatedPriceMin).toBeUndefined();
    expect(update.$set.estimatedPriceMax).toBeUndefined();
    expect(update.$set.paymentStatus).toBe("UNPAID");
    expect(update.$set.billing).toEqual({
      currency: "ZAR",
      amountDueCents,
      amountPaidCents: 0,
    });
    expect(update.$set.measuredQuote).toMatchObject({
      estimatedPriceMin: estimate.totalMin,
      estimatedPriceMax: estimate.totalMax,
      amountDueCents,
    });
    const body = await res.json();
    expect(body.rug.widthM).toBe(2);
    expect(body.measuredQuote.amountDueCents).toBe(amountDueCents);
  });

  it("refuses a size change after the rug is collected", async () => {
    mocks.bookingFindOne.mockImplementation(() =>
      chain(booking({ status: "COLLECTED" }))
    );

    const res = await patch({ widthM: 2, lengthM: 3 });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "Size can only be changed while the pickup is still scheduled.",
    });
    expect(mocks.bookingFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("refuses a size change from another driver", async () => {
    mocks.getSession.mockResolvedValue({
      id: "tech-2",
      role: "technician",
      driverProfileId: "driver_sipho",
    });

    const res = await patch({ widthM: 2, lengthM: 3 });

    expect(res.status).toBe(403);
    expect(mocks.bookingFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("requires both sides", async () => {
    const res = await patch({ widthM: 2 });

    expect(res.status).toBe(400);
    expect(mocks.bookingFindOneAndUpdate).not.toHaveBeenCalled();
  });
});
