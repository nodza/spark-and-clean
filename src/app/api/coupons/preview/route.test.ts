import { beforeEach, describe, expect, it, vi } from "vitest";

const findOne = vi.fn();
const findOneAndUpdate = vi.fn();

vi.mock("@/lib/mongodb", () => ({
  connectDB: vi.fn(async () => undefined),
}));

vi.mock("@/models/Coupon", () => ({
  Coupon: {
    findOne: (...args: unknown[]) => findOne(...args),
    findOneAndUpdate: (...args: unknown[]) => findOneAndUpdate(...args),
  },
}));

function post(body: unknown) {
  return new Request("http://localhost/api/coupons/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/coupons/preview", () => {
  beforeEach(() => {
    findOne.mockReset();
    findOneAndUpdate.mockReset();
    findOne.mockReturnValue({
      select: () => ({ lean: async () => null }),
    });
  });

  it("quotes SPARK10 at 10% of the estimate, not a fixed amount", async () => {
    findOne.mockReturnValue({
      select: () => ({
        lean: async () => ({ active: true, type: "PERCENT", value: 10 }),
      }),
    });
    const { POST } = await import("./route");
    const res = await POST(
      post({ code: "SPARK10", estimateMin: 909, estimateMax: 1091 })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      code: "SPARK10",
      type: "PERCENT",
      value: 10,
      discountCents: 10_000,
      estimateMin: 818,
      estimateMax: 982,
      redeemedCount: 0,
      maxRedemptions: null,
    });
  });

  it("quotes a fixed coupon from its own cent value", async () => {
    findOne.mockReturnValue({
      select: () => ({
        lean: async () => ({ active: true, type: "FIXED_CENTS", value: 5000 }),
      }),
    });
    const { POST } = await import("./route");
    const res = await POST(
      post({ code: "SAVE50", estimateMin: 1000, estimateMax: 1200 })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      code: "SAVE50",
      type: "FIXED_CENTS",
      value: 5000,
      discountCents: 5000,
      estimateMin: 950,
      estimateMax: 1150,
    });
  });

  it("rejects an unknown code and does not invent a discount", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      post({ code: "NOPE", estimateMin: 1000, estimateMax: 1200 })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "That coupon code isn't valid" });
  });

  it("rejects an inactive coupon with a message other than the format error", async () => {
    findOne.mockReturnValue({
      select: () => ({
        lean: async () => ({ active: false, type: "PERCENT", value: 10 }),
      }),
    });
    const { POST } = await import("./route");
    const res = await POST(
      post({ code: "SPARKFREE", estimateMin: 1000, estimateMax: 1200 })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "This coupon is no longer active",
    });
  });

  it("rejects an expired coupon with a message other than the format error", async () => {
    findOne.mockReturnValue({
      select: () => ({
        lean: async () => ({
          active: true,
          type: "PERCENT",
          value: 10,
          validTo: "2000-01-01T12:00:00.000Z",
        }),
      }),
    });
    const { POST } = await import("./route");
    const res = await POST(
      post({ code: "OLD10", estimateMin: 1000, estimateMax: 1200 })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "This coupon has expired" });
  });

  it("counts one use on recordUse and returns the new total", async () => {
    findOne.mockReturnValue({
      select: () => ({
        lean: async () => ({
          active: true,
          type: "PERCENT",
          value: 5,
          maxRedemptions: 1,
          redeemedCount: 0,
          redemptionHoldId: null,
        }),
      }),
    });
    findOneAndUpdate.mockReturnValue({
      select: () => ({ lean: async () => ({ redeemedCount: 1 }) }),
    });
    const { POST } = await import("./route");
    const res = await POST(
      post({
        code: "FIRSTTIME",
        estimateMin: 1000,
        estimateMax: 1200,
        recordUse: true,
        holdId: "hold-1",
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      code: "FIRSTTIME",
      redeemedCount: 1,
      maxRedemptions: 1,
    });
    expect(findOneAndUpdate).toHaveBeenCalledOnce();
  });

  it("keeps 1/1 when the same hold previews again", async () => {
    findOne.mockReturnValue({
      select: () => ({
        lean: async () => ({
          active: true,
          type: "PERCENT",
          value: 5,
          maxRedemptions: 1,
          redeemedCount: 1,
          redemptionHoldId: "hold-1",
        }),
      }),
    });
    const { POST } = await import("./route");
    const res = await POST(
      post({
        code: "FIRSTTIME",
        estimateMin: 1000,
        estimateMax: 1200,
        recordUse: true,
        holdId: "hold-1",
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ redeemedCount: 1, maxRedemptions: 1 });
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });
});
