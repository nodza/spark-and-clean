import { beforeEach, describe, expect, it, vi } from "vitest";
import { estimateBookingPrice } from "@/lib/bookingEstimate";
import {
  applyCoupon,
  estimateQuoteMidpointCents,
} from "@/lib/promotion/applyCoupon";

const bookingFindOne = vi.fn();
const bookingCreate = vi.fn();
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
    create: (...args: unknown[]) => bookingCreate(...args),
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

function writtenPayload(): Record<string, unknown> {
  return bookingCreate.mock.calls.at(-1)?.[0] as Record<string, unknown>;
}

describe("POST /api/bookings confirm coupon", () => {
  beforeEach(() => {
    bookingFindOne.mockReset();
    bookingCreate.mockReset();
    couponFindOne.mockReset();
    couponFindOneAndUpdate.mockReset();
    couponUpdateOne.mockReset();
    paymentCreate.mockReset();
    bookingFindOne.mockReturnValue({
      select: () => ({ lean: async () => null }),
    });
    bookingCreate.mockImplementation(async (payload: Record<string, unknown>) => ({
      toObject: () => ({ ...payload }),
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
    const payload = writtenPayload();
    expect(payload.promotion).toEqual({
      couponId: "coupon-1",
      code: "SPARK10",
      discountCents: applied.discountCents,
      amountDueCents: estimateQuoteMidpointCents(
        applied.estimateMin,
        applied.estimateMax
      ),
    });
    expect(payload.couponCode).toBe("SPARK10");
    expect(payload.estimatedPriceMin).toBe(applied.estimateMin);
    expect(payload.estimatedPriceMax).toBe(applied.estimateMax);
    expect(payload.paymentStatus).toBe("UNPAID");
    expect(payload.promotion).not.toMatchObject({ discountCents: 1 });
    expect(couponFindOneAndUpdate).toHaveBeenCalledWith(
      { code: "SPARK10", redeemedCount: { $lt: 10 } },
      { $inc: { redeemedCount: 1 } }
    );
    expect(couponUpdateOne).not.toHaveBeenCalled();
    expect(paymentCreate).not.toHaveBeenCalled();
  });

  it("server-prices bookings without a coupon and drops a posted promotion", async () => {
    const { POST } = await import("./route");
    const res = await POST(post());
    expect(res.status).toBe(200);
    const estimate = estimateBookingPrice({
      rug: { type: "Persian", widthM: 2, lengthM: 3, areaSqM: 6 },
      addOns: { odourRemoval: false, stainProtection: true },
    });
    const payload = writtenPayload();
    expect(payload.promotion).toBeUndefined();
    expect(payload.couponCode).toBeUndefined();
    expect(payload.estimatedPriceMin).toBe(estimate.totalMin);
    expect(payload.estimatedPriceMax).toBe(estimate.totalMax);
    expect(payload.paymentStatus).toBe("UNPAID");
    expect(payload.estimatedPriceMin).not.toBe(1);
    expect(paymentCreate).not.toHaveBeenCalled();
  });

  it("rejects create when the booking id already exists", async () => {
    bookingFindOne.mockReturnValue({
      select: () => ({ lean: async () => ({ _id: "existing" }) }),
    });
    couponLookup({
      _id: "coupon-1",
      code: "SPARK10",
      active: true,
      type: "PERCENT",
      value: 10,
      redeemedCount: 0,
      maxRedemptions: 1,
    });

    const { POST } = await import("./route");
    const res = await POST(post({ couponCode: "SPARK10" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "A booking with this id already exists",
    });
    expect(bookingCreate).not.toHaveBeenCalled();
    expect(couponFindOneAndUpdate).not.toHaveBeenCalled();
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
    });

    const { POST } = await import("./route");
    const res = await POST(post({ couponCode: "SPARK10" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "This coupon has been fully used (1/1)",
    });
    expect(bookingCreate).not.toHaveBeenCalled();
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
    });
    couponFindOneAndUpdate.mockResolvedValue(null);

    const { POST } = await import("./route");
    const res = await POST(post({ couponCode: "SPARK10" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "This coupon has been fully used (1/1)",
    });
    expect(bookingCreate).not.toHaveBeenCalled();
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
    expect(writtenPayload().promotion).toMatchObject({
      couponId: "coupon-1",
      code: "SPARK10",
    });
    expect(writtenPayload().couponHoldId).toBeUndefined();
    expect(writtenPayload().paymentStatus).toBe("UNPAID");
    expect(paymentCreate).not.toHaveBeenCalled();
  });

  it("rejects a coupon when rug dimensions are missing", async () => {
    couponLookup({
      _id: "coupon-1",
      code: "SPARK10",
      active: true,
      type: "PERCENT",
      value: 10,
      redeemedCount: 0,
      maxRedemptions: 10,
    });

    const { POST } = await import("./route");
    const res = await POST(
      post({
        couponCode: "SPARK10",
        rug: { type: "Persian", widthM: null, lengthM: null, areaSqM: 6, photos: [] },
      })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Rug width and length are required to apply a coupon",
    });
    expect(bookingCreate).not.toHaveBeenCalled();
    expect(couponFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("rejects a full coupon even when the caller sends an old hold id", async () => {
    couponLookup({
      _id: "coupon-1",
      code: "SPARK10",
      active: true,
      type: "PERCENT",
      value: 10,
      redeemedCount: 1,
      maxRedemptions: 1,
    });

    const { POST } = await import("./route");
    const res = await POST(
      post({ couponCode: "SPARK10", couponHoldId: "hold-spark10" })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "This coupon has been fully used (1/1)",
    });
    expect(bookingCreate).not.toHaveBeenCalled();
    expect(couponFindOneAndUpdate).not.toHaveBeenCalled();
    expect(paymentCreate).not.toHaveBeenCalled();
  });
});
