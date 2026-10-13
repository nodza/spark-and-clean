import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const findByIdAndUpdate = vi.fn();
const findById = vi.fn();
const findOneAndUpdate = vi.fn();
const findOneAndDelete = vi.fn();

vi.mock("@/lib/mongodb", () => ({
  connectDB: vi.fn(async () => undefined),
}));

vi.mock("@/lib/session", () => ({
  getSession: () => getSession(),
}));

vi.mock("@/models/Coupon", () => ({
  Coupon: {
    findByIdAndUpdate: (...args: unknown[]) => findByIdAndUpdate(...args),
    findById: (...args: unknown[]) => findById(...args),
    findOneAndUpdate: (...args: unknown[]) => findOneAndUpdate(...args),
    findOneAndDelete: (...args: unknown[]) => findOneAndDelete(...args),
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

function remove() {
  return new Request(`http://localhost/api/coupons/${id}`, { method: "DELETE" });
}

describe("PATCH /api/coupons/[id]", () => {
  beforeEach(() => {
    getSession.mockReset();
    findByIdAndUpdate.mockReset();
    findById.mockReset();
    findOneAndUpdate.mockReset();
    findOneAndDelete.mockReset();
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
    findById.mockReturnValue({
      lean: async () => ({
        _id: id,
        code: "SPARKFREE",
        redeemedCount: 0,
      }),
    });
    findOneAndUpdate.mockReturnValue({
      lean: async () => ({
        _id: id,
        code: "SPARK15",
        type: "PERCENT",
        value: 15,
        active: true,
        maxRedemptions: null,
        redeemedCount: 0,
        validFrom: null,
        validTo: null,
        city: null,
      }),
    });
    findOneAndDelete.mockReturnValue({ lean: async () => ({ _id: id }) });
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

  it("lets a marketing admin edit coupon fields", async () => {
    getSession.mockResolvedValue({
      id: "a1",
      email: "m@example.com",
      role: "admin",
      adminTier: "marketing-only",
    });
    const { PATCH } = await import("./route");
    const res = await PATCH(
      patch({
        code: "SPARK15",
        type: "PERCENT",
        value: 15,
        city: null,
        maxRedemptions: null,
        validFrom: null,
        validTo: null,
      }),
      { params: Promise.resolve({ id }) }
    );
    expect(res.status).toBe(200);
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { _id: id, redeemedCount: 0 },
      {
        $set: expect.objectContaining({ code: "SPARK15", value: 15 }),
      },
      { new: true, runValidators: true }
    );
  });

  it("does not allow a used coupon's code to change", async () => {
    getSession.mockResolvedValue({
      id: "a1",
      email: "m@example.com",
      role: "admin",
      adminTier: "marketing-only",
    });
    findById.mockReturnValue({
      lean: async () => ({ _id: id, code: "SPARK10", redeemedCount: 1 }),
    });
    const { PATCH } = await import("./route");
    const res = await PATCH(
      patch({
        code: "SPARK15",
        type: "PERCENT",
        value: 15,
        city: null,
        maxRedemptions: null,
        validFrom: null,
        validTo: null,
      }),
      { params: Promise.resolve({ id }) }
    );
    expect(res.status).toBe(409);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("lets a marketing admin delete an unused coupon", async () => {
    getSession.mockResolvedValue({
      id: "a1",
      email: "m@example.com",
      role: "admin",
      adminTier: "marketing-only",
    });
    const { DELETE } = await import("./route");
    const res = await DELETE(remove(), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });
    expect(findOneAndDelete).toHaveBeenCalledWith({
      _id: id,
      redeemedCount: 0,
    });
  });

  it("rejects deletion if the coupon has been used", async () => {
    getSession.mockResolvedValue({
      id: "a1",
      email: "m@example.com",
      role: "admin",
      adminTier: "full",
    });
    findOneAndDelete.mockReturnValue({ lean: async () => null });
    findById.mockReturnValue({
      lean: async () => ({ _id: id, code: "SPARK10", redeemedCount: 1 }),
    });
    const { DELETE } = await import("./route");
    const res = await DELETE(remove(), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Used coupons cannot be deleted" });
  });
});
