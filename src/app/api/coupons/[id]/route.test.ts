import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const findByIdAndUpdate = vi.fn();

vi.mock("@/lib/mongodb", () => ({
  connectDB: vi.fn(async () => undefined),
}));

vi.mock("@/lib/session", () => ({
  getSession: () => getSession(),
}));

vi.mock("@/models/Coupon", () => ({
  Coupon: {
    findByIdAndUpdate: (...args: unknown[]) => findByIdAndUpdate(...args),
  },
}));

const id = "507f1f77bcf86cd799439011";

function patch(body: unknown) {
  return new Request(`http://localhost/api/coupons/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/coupons/[id]", () => {
  beforeEach(() => {
    getSession.mockReset();
    findByIdAndUpdate.mockReset();
    findByIdAndUpdate.mockReturnValue({
      lean: async () => ({
        _id: id,
        code: "SPARKFREE",
        type: "PERCENT",
        value: 5,
        active: false,
        maxRedemptions: null,
        redeemedCount: 0,
        validFrom: null,
        validTo: null,
        city: null,
      }),
    });
  });

  it("returns 403 for a client", async () => {
    getSession.mockResolvedValue({
      id: "c1",
      email: "c@example.com",
      role: "client",
      adminTier: null,
    });
    const { PATCH } = await import("./route");
    const res = await PATCH(patch({ active: false }), {
      params: Promise.resolve({ id }),
    });
    expect(res.status).toBe(403);
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("lets a marketing admin deactivate a coupon", async () => {
    getSession.mockResolvedValue({
      id: "a1",
      email: "m@example.com",
      role: "admin",
      adminTier: "marketing-only",
    });
    const { PATCH } = await import("./route");
    const res = await PATCH(patch({ active: false }), {
      params: Promise.resolve({ id }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.coupon).toEqual(
      expect.objectContaining({ code: "SPARKFREE", active: false })
    );
    expect(findByIdAndUpdate).toHaveBeenCalledWith(
      id,
      { $set: { active: false } },
      { new: true, runValidators: true }
    );
  });
});
