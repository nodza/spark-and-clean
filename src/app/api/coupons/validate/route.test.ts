import { beforeEach, describe, expect, it, vi } from "vitest";

const findOne = vi.fn();
const getSession = vi.fn();

vi.mock("@/lib/mongodb", () => ({
  connectDB: vi.fn(async () => undefined),
}));

vi.mock("@/lib/session", () => ({
  getSession: (...args: unknown[]) => getSession(...args),
}));

vi.mock("@/models/Coupon", () => ({
  Coupon: {
    findOne: (...args: unknown[]) => findOne(...args),
  },
}));

function post(code: string) {
  return new Request("http://localhost/api/coupons/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
}

describe("POST /api/coupons/validate", () => {
  beforeEach(() => {
    getSession.mockReset();
    getSession.mockResolvedValue(null);
    findOne.mockReset();
    findOne.mockReturnValue({
      select: () => ({ lean: async () => null }),
    });
  });

  it("rejects a deactivated coupon", async () => {
    findOne.mockReturnValue({
      select: () => ({ lean: async () => ({ active: false }) }),
    });
    const { POST } = await import("./route");
    const res = await POST(post("SPARKFREE"));
    expect(findOne).toHaveBeenCalledWith({ code: "SPARKFREE" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      valid: false,
      error: "This coupon is no longer active",
    });
  });

  it("accepts an active catalogue coupon", async () => {
    findOne.mockReturnValue({
      select: () => ({ lean: async () => ({ active: true }) }),
    });
    const { POST } = await import("./route");
    const res = await POST(post("SPARK10"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ valid: true, code: "SPARK10" });
  });

  it("does not treat lowercase as the uppercase code", async () => {
    const { POST } = await import("./route");
    const res = await POST(post("spark10"));
    expect(findOne).toHaveBeenCalledWith({ code: "spark10" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      valid: false,
      error: "That coupon code isn't valid",
    });
  });

  it("rejects a code that is not in the catalogue", async () => {
    const { POST } = await import("./route");
    const res = await POST(post("HELLO"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      valid: false,
      error: "That coupon code isn't valid",
    });
  });

  it("rejects an expired catalogue coupon", async () => {
    findOne.mockReturnValue({
      select: () => ({
        lean: async () => ({
          active: true,
          validTo: "2000-01-01T12:00:00.000Z",
        }),
      }),
    });
    const { POST } = await import("./route");
    const res = await POST(post("OLD10"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      valid: false,
      error: "This coupon has expired",
    });
  });

  it("rejects another client checking Sarah's personal code", async () => {
    findOne.mockReturnValue({
      select: () => ({
        lean: async () => ({
          active: true,
          ownerUserId: "507f1f77bcf86cd799439011",
        }),
      }),
    });
    getSession.mockResolvedValue({
      id: "507f1f77bcf86cd799439012",
      email: "lee@example.com",
      role: "client",
    });
    const { POST } = await import("./route");
    const res = await POST(post("RWDSARAH"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      valid: false,
      error: "That coupon code isn't valid",
    });
  });
});
