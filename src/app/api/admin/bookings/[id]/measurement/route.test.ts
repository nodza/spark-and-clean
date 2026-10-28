import { beforeEach, describe, expect, it, vi } from "vitest";
import { estimateBookingPrice } from "@/lib/bookingEstimate";
import {
  applyCoupon,
  estimateQuoteMidpointCents,
} from "@/lib/promotion/applyCoupon";

const mocks = vi.hoisted(() => ({
  requireFullAdmin: vi.fn(),
  connectDB: vi.fn(),
  bookingFindOne: vi.fn(),
  bookingFindOneAndUpdate: vi.fn(),
  paymentFind: vi.fn(),
  couponFindOne: vi.fn(),
}));

vi.mock("@/lib/adminAuth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/adminAuth")>(
    "@/lib/adminAuth"
  );
  return {
    ...actual,
    requireFullAdmin: mocks.requireFullAdmin,
  };
});
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

import { HttpError } from "@/lib/adminAuth";
import { PATCH } from "./route";

const bookingId = "SC-SIZE";

function lean(result: unknown) {
  return { lean: vi.fn().mockResolvedValue(result) };
}

function patch(body: unknown, id = bookingId) {
  return PATCH(
    new Request(`http://localhost/api/admin/bookings/${id}/measurement`, {
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
    status: "COLLECTED",
    paymentStatus: "DEPOSIT",
    estimatedPriceMin: 720,
    estimatedPriceMax: 864,
    rug: { type: "Persian", widthM: 2, lengthM: 3, areaSqM: 6 },
    addOns: { odourRemoval: false, stainProtection: false },
    billing: {
      currency: "ZAR",
      amountDueCents: 79200,
      amountPaidCents: 39600,
    },
    customer: {
      id: "c1",
      name: "Sarah",
      phone: "0820000000",
      email: "sarah@example.com",
    },
    suburb: "Rosebank",
    addressLine1: "1 Jan Smuts",
    city: "Johannesburg",
    collectionDate: "2026-10-20",
    collectionSlot: "MORNING",
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireFullAdmin.mockResolvedValue({
    id: "admin-1",
    role: "admin",
    adminTier: "full",
  });
  mocks.connectDB.mockResolvedValue(undefined);
  mocks.bookingFindOne.mockImplementation(() => lean(booking()));
  mocks.bookingFindOneAndUpdate.mockImplementation((_filter, update) => {
    const set = (update as { $set?: Record<string, unknown> }).$set ?? {};
    return lean({ ...booking(), ...set, paymentStatus: set.paymentStatus });
  });
  mocks.paymentFind.mockReturnValue({
    select: () => ({
      lean: async () => [{ kind: "DEPOSIT", amountCents: 39600 }],
    }),
  });
  mocks.couponFindOne.mockReturnValue({
    select: () => ({ lean: async () => null }),
  });
});

describe("PATCH /api/admin/bookings/[id]/measurement", () => {
  it("changes the amount due, keeps the amount paid, and recalculates status", async () => {
    const res = await patch({
      widthM: 1,
      lengthM: 1,
      amountDueCents: 1,
      estimatedPriceMin: 5,
    });
    expect(res.status).toBe(200);

    const update = mocks.bookingFindOneAndUpdate.mock.calls[0][1] as {
      $set: Record<string, unknown>;
    };
    const billing = update.$set.billing as {
      amountDueCents: number;
      amountPaidCents: number;
    };
    const estimate = estimateBookingPrice({
      rug: { type: "Persian", widthM: 1, lengthM: 1, areaSqM: 1 },
      addOns: { odourRemoval: false, stainProtection: false },
    });
    const amountDueCents = estimateQuoteMidpointCents(
      estimate.totalMin,
      estimate.totalMax
    );

    expect(update.$set.estimatedPriceMin).toBeUndefined();
    expect(update.$set["rug.widthM"]).toBe(1);
    expect(update.$set["rug.lengthM"]).toBe(1);
    expect(billing.amountDueCents).toBe(amountDueCents);
    expect(billing.amountDueCents).not.toBe(1);
    expect(billing.amountPaidCents).toBe(39600);
    expect(update.$set.paymentStatus).toBe("PAID");
    expect(update.$set.refundRequired).toBe(true);
    expect(amountDueCents).toBeLessThan(39600);
  });

  it("reapplies the booking coupon onto the corrected size", async () => {
    const couponId = "507f1f77bcf86cd799439011";
    mocks.bookingFindOne.mockImplementation(() =>
      lean(
        booking({
          paymentStatus: "UNPAID",
          billing: { currency: "ZAR", amountDueCents: 79200, amountPaidCents: 0 },
          couponCode: "SPARK10",
          promotion: {
            couponId,
            code: "SPARK10",
            discountCents: 100,
            amountDueCents: 79200,
          },
          addOns: { odourRemoval: false, stainProtection: true },
        })
      )
    );
    mocks.paymentFind.mockReturnValue({
      select: () => ({ lean: async () => [] }),
    });
    mocks.couponFindOne.mockReturnValue({
      select: () => ({
        lean: async () => ({
          _id: couponId,
          code: "SPARK10",
          type: "PERCENT",
          value: 10,
        }),
      }),
    });

    const res = await patch({ widthM: 2, lengthM: 3 });
    expect(res.status).toBe(200);

    const estimate = estimateBookingPrice({
      rug: { type: "Persian", widthM: 2, lengthM: 3, areaSqM: 6 },
      addOns: { odourRemoval: false, stainProtection: true },
    });
    const applied = applyCoupon(
      { type: "PERCENT", value: 10 },
      estimate.totalMin,
      estimate.totalMax
    );
    const amountDueCents = estimateQuoteMidpointCents(
      applied.estimateMin,
      applied.estimateMax
    );
    const update = mocks.bookingFindOneAndUpdate.mock.calls[0][1] as {
      $set: Record<string, unknown>;
    };
    expect(update.$set["promotion.amountDueCents"]).toBe(amountDueCents);
    expect(update.$set["promotion.discountCents"]).toBe(applied.discountCents);
    expect(update.$set["promotion.code"]).toBe("SPARK10");
    expect(update.$set.couponCode).toBe("SPARK10");
    expect(update.$set.estimatedPriceMin).toBeUndefined();
    expect(update.$set.paymentStatus).toBe("UNPAID");
    expect(update.$set.refundRequired).toBe(false);
    expect(applied.discountCents).toBeGreaterThan(0);
  });

  it("rejects a size without a price field and does not write", async () => {
    const res = await patch({ widthM: 2, amountDueCents: 5000 });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Enter both width and length in metres.",
    });
    expect(mocks.bookingFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("returns 404 when the booking is gone", async () => {
    mocks.bookingFindOne.mockImplementation(() => lean(null));
    const res = await patch({ widthM: 2, lengthM: 3 });
    expect(res.status).toBe(404);
    expect(mocks.bookingFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("refuses a session that is not a full admin", async () => {
    mocks.requireFullAdmin.mockRejectedValue(new HttpError(403, "Forbidden"));
    const res = await patch({ widthM: 2, lengthM: 3 });
    expect(res.status).toBe(403);
    expect(mocks.bookingFindOne).not.toHaveBeenCalled();
  });
});
