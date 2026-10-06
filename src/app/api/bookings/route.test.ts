import { beforeEach, describe, expect, it, vi } from "vitest";
import { estimateBookingPrice } from "@/lib/bookingEstimate";
import {
  applyCoupon,
  estimateQuoteMidpointCents,
} from "@/lib/promotion/applyCoupon";

const bookingFindOne = vi.fn();
const bookingFindOneAndUpdate = vi.fn();
const couponFindOne = vi.fn();
const couponFindOneAndUpdate = vi.fn();
const couponUpdateOne = vi.fn();
const paymentCreate = vi.fn();

vi.mock("@/lib/mongodb", () => ({
  connectDB: vi.fn(async () => undefined),
}));

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(async () => null),
}));

vi.mock("@/lib/createNewBookingAlert", () => ({
  createNewBookingAlert: vi.fn(async () => undefined),
}));

vi.mock("@/models/Booking", () => ({
  Booking: {
    findOne: (...args: unknown[]) => bookingFindOne(...args),
    findOneAndUpdate: (...args: unknown[]) => bookingFindOneAndUpdate(...args),
  },
}));

vi.mock("@/models/Coupon", () => ({
  Coupon: {
    findOne: (...args: unknown[]) => couponFindOne(...args),
    findOneAndUpdate: (...args: unknown[]) => couponFindOneAndUpdate(...args),
    updateOne: (...args: unknown[]) => couponUpdateOne(...args),
  },
}));

vi.mock("@/models/Payment", () => ({
  Payment: {
    create: (...args: unknown[]) => paymentCreate(...args),
  },
}));

function couponLookup(doc: Record<string, unknown> | null) {
  couponFindOne.mockReturnValue({
    select: () => ({ lean: async () => doc }),
  });
}

function post(extra: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: "SC-2026-0001",
      customer: {
        id: "guest-1",
        name: "Amina",
        phone: "0820000000",
        email: "amina@example.com",
      },
      suburb: "Sea Point",
      addressLine1: "1 Main",
      city: "Cape Town",
      collectionDate: "2026-10-06",
      collectionSlot: "MORNING",
      rug: {
        type: "Persian",
        widthM: 2,
        lengthM: 3,
        areaSqM: 999,
        photos: [],
      },
      addOns: { odourRemoval: false, stainProtection: true },
      estimatedPriceMin: 1,
      estimatedPriceMax: 1,
      promotion: { discountCents: 1, amountDueCents: 50 },
      status: "BOOKED",
      paymentStatus: "PAID",
      ...extra,
    }),
  });
}

function writtenUpdate(): {
  $set: Record<string, unknown>;
  $unset?: Record<string, unknown>;
} {
  return bookingFindOneAndUpdate.mock.calls.at(-1)?.[1] as {
    $set: Record<string, unknown>;
    $unset?: Record<string, unknown>;
  };
}

describe("POST /api/bookings confirm coupon", () => {
  beforeEach(() => {
    bookingFindOne.mockReset();
    bookingFindOneAndUpdate.mockReset();
    couponFindOne.mockReset();
    couponFindOneAndUpdate.mockReset();
    couponUpdateOne.mockReset();
    paymentCreate.mockReset();
    bookingFindOne.mockReturnValue({
      select: () => ({ lean: async () => null }),
    });
    bookingFindOneAndUpdate.mockImplementation(() => ({
      lean: async () => ({ id: "SC-2026-0001", paymentStatus: "UNPAID" }),
    }));
    couponLookup(null);
    couponUpdateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  it("stores server discount math and stays unpaid, ignoring the posted total", async () => {
    couponLookup({
      _id: "coupon-1",
      code: "SPARK10",
      active: true,
      type: "PERCENT",
      value: 10,
      redeemedCount: 0,
      maxRedemptions: 10,
      redemptionHoldId: null,
    });
    couponFindOneAndUpdate.mockResolvedValue({ code: "SPARK10", redeemedCount: 1 });

    const { POST } = await import("./route");
    const res = await POST(post({ couponCode: "SPARK10" }));
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
    const update = writtenUpdate();
    expect(update.$set.promotion).toEqual({
      couponId: "coupon-1",
      code: "SPARK10",
      discountCents: applied.discountCents,
      amountDueCents: estimateQuoteMidpointCents(
        applied.estimateMin,
        applied.estimateMax
      ),
    });
    expect(update.$set.couponCode).toBe("SPARK10");
    expect(update.$set.estimatedPriceMin).toBe(applied.estimateMin);
    expect(update.$set.estimatedPriceMax).toBe(applied.estimateMax);
    expect(update.$set.paymentStatus).toBe("UNPAID");
    expect(update.$set.promotion).not.toMatchObject({ discountCents: 1 });
    expect(update.$unset).toBeUndefined();
    expect(couponFindOneAndUpdate).toHaveBeenCalledWith(
      { code: "SPARK10", redeemedCount: { $lt: 10 } },
      { $inc: { redeemedCount: 1 } }
    );
    expect(paymentCreate).not.toHaveBeenCalled();
  });

  it("does not store a promotion when the code is already fully redeemed", async () => {
    couponLookup({
      _id: "coupon-1",
      code: "SPARK10",
      active: true,
      type: "PERCENT",
      value: 10,
      redeemedCount: 1,
      maxRedemptions: 1,
      redemptionHoldId: null,
    });

    const { POST } = await import("./route");
    const res = await POST(post({ couponCode: "SPARK10" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "This coupon has been fully used (1/1)",
    });
    expect(bookingFindOneAndUpdate).not.toHaveBeenCalled();
    expect(couponFindOneAndUpdate).not.toHaveBeenCalled();
    expect(paymentCreate).not.toHaveBeenCalled();
  });

  it("does not store a promotion when the redemption cap is lost at claim time", async () => {
    couponLookup({
      _id: "coupon-1",
      code: "SPARK10",
      active: true,
      type: "PERCENT",
      value: 10,
      redeemedCount: 0,
      maxRedemptions: 1,
      redemptionHoldId: null,
    });
    couponFindOneAndUpdate.mockResolvedValue(null);

    const { POST } = await import("./route");
    const res = await POST(post({ couponCode: "SPARK10" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "This coupon has been fully used (1/1)",
    });
    expect(bookingFindOneAndUpdate).not.toHaveBeenCalled();
    expect(paymentCreate).not.toHaveBeenCalled();
  });

  it("counts one redemption on confirm and ignores a posted hold id", async () => {
    couponLookup({
      _id: "coupon-1",
      code: "SPARK10",
      active: true,
      type: "PERCENT",
      value: 10,
      redeemedCount: 0,
      maxRedemptions: 1,
      redemptionHoldId: "hold-spark10",
    });
    couponFindOneAndUpdate.mockResolvedValue({ code: "SPARK10", redeemedCount: 1 });

    const { POST } = await import("./route");
    const res = await POST(
      post({ couponCode: "SPARK10", couponHoldId: "hold-spark10" })
    );
    expect(res.status).toBe(200);
    expect(couponFindOneAndUpdate).toHaveBeenCalledWith(
      { code: "SPARK10", redeemedCount: { $lt: 1 } },
      { $inc: { redeemedCount: 1 } }
    );
    expect(writtenUpdate().$set.promotion).toMatchObject({
      couponId: "coupon-1",
      code: "SPARK10",
    });
    expect(writtenUpdate().$set.couponHoldId).toBeUndefined();
    expect(writtenUpdate().$set.paymentStatus).toBe("UNPAID");
    expect(paymentCreate).not.toHaveBeenCalled();
  });

  it("rejects a full coupon even when the posted hold matches", async () => {
    couponLookup({
      _id: "coupon-1",
      code: "SPARK10",
      active: true,
      type: "PERCENT",
      value: 10,
      redeemedCount: 1,
      maxRedemptions: 1,
      redemptionHoldId: "hold-spark10",
    });

    const { POST } = await import("./route");
    const res = await POST(
      post({ couponCode: "SPARK10", couponHoldId: "hold-spark10" })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "This coupon has been fully used (1/1)",
    });
    expect(bookingFindOneAndUpdate).not.toHaveBeenCalled();
    expect(couponFindOneAndUpdate).not.toHaveBeenCalled();
    expect(paymentCreate).not.toHaveBeenCalled();
  });

  it("drops a posted promotion when confirm has no coupon", async () => {
    const { POST } = await import("./route");
    const res = await POST(post());
    expect(res.status).toBe(200);
    const update = writtenUpdate();
    expect(update.$set.promotion).toBeUndefined();
    expect(update.$set.paymentStatus).toBe("UNPAID");
    expect(update.$unset).toEqual({ promotion: 1 });
    expect(paymentCreate).not.toHaveBeenCalled();
  });
});
