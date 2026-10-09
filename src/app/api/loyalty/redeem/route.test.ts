import { beforeEach, describe, expect, it, vi } from "vitest";
import { LOYALTY_PUNCHES_PER_REWARD } from "@/lib/promotion/loyaltyReward";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  connectDB: vi.fn(),
  findOneAndUpdate: vi.fn(),
  updateOne: vi.fn(),
  create: vi.fn(),
  findOne: vi.fn(),
  find: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/mongodb", () => ({ connectDB: mocks.connectDB }));
vi.mock("@/models/User", () => ({
  User: {
    findOneAndUpdate: (...args: unknown[]) => mocks.findOneAndUpdate(...args),
    updateOne: (...args: unknown[]) => mocks.updateOne(...args),
  },
}));
vi.mock("@/models/Coupon", () => ({
  Coupon: {
    create: (...args: unknown[]) => mocks.create(...args),
    findOne: (...args: unknown[]) => mocks.findOne(...args),
    find: (...args: unknown[]) => mocks.find(...args),
  },
}));

import { GET, POST } from "./route";

const sarahId = "507f1f77bcf86cd799439011";

function redeem() {
  return POST();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.connectDB.mockResolvedValue(undefined);
  mocks.updateOne.mockResolvedValue({ modifiedCount: 1 });
  mocks.getSession.mockResolvedValue({
    id: sarahId,
    email: "sarah@example.com",
    role: "client",
  });
  mocks.findOneAndUpdate.mockReturnValue({
    lean: async () => null,
  });
  mocks.findOne.mockReturnValue({
    select: () => ({ lean: async () => null }),
  });
  mocks.find.mockReturnValue({
    select: () => ({
      sort: () => ({ lean: async () => [] }),
    }),
  });
});

describe("POST /api/loyalty/redeem", () => {
  it("turns 5 punches into a personal fixed coupon and records the reward", async () => {
    expect(LOYALTY_PUNCHES_PER_REWARD).toBe(5);
    mocks.findOneAndUpdate.mockReturnValue({
      lean: async () => ({
        loyalty: { punches: 0, rewardsRedeemed: 1 },
      }),
    });
    mocks.create.mockImplementation(async (doc: { code: string }) => doc);

    const res = await redeem();
    expect(res.status).toBe(200);

    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: sarahId,
        "loyalty.punches": { $gte: 5 },
      },
      {
        $inc: {
          "loyalty.punches": -5,
          "loyalty.rewardsRedeemed": 1,
        },
      },
      { new: true }
    );

    const created = mocks.create.mock.calls[0][0] as {
      code: string;
      type: string;
      value: number;
      maxRedemptions: number;
      ownerUserId: string;
    };
    expect(created).toMatchObject({
      type: "FIXED_CENTS",
      value: 50_000,
      active: true,
      maxRedemptions: 1,
      redeemedCount: 0,
      ownerUserId: sarahId,
    });
    expect(created.code).toMatch(/^RWD[A-F0-9]{12}$/);

    expect(await res.json()).toEqual({
      code: created.code,
      punches: 0,
      rewardsRedeemed: 1,
      punchesPerReward: 5,
    });
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it("returns 400 at 4 punches and does not change the balance", async () => {
    const res = await redeem();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "You need 5 punches to redeem a reward.",
    });
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: sarahId,
        "loyalty.punches": { $gte: 5 },
      },
      expect.any(Object),
      { new: true }
    );
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it("puts the punches back when the coupon cannot be saved", async () => {
    mocks.findOneAndUpdate.mockReturnValue({
      lean: async () => ({
        loyalty: { punches: 0, rewardsRedeemed: 1 },
      }),
    });
    mocks.create.mockRejectedValue(new Error("coupon write failed"));

    const res = await redeem();
    expect(res.status).toBe(500);
    expect(mocks.updateOne).toHaveBeenCalledWith(
      {
        _id: sarahId,
        "loyalty.rewardsRedeemed": { $gte: 1 },
      },
      {
        $inc: {
          "loyalty.punches": 5,
          "loyalty.rewardsRedeemed": -1,
        },
      }
    );
  });

  it("keeps the punches spent when the coupon was saved despite a write error", async () => {
    mocks.findOneAndUpdate.mockReturnValue({
      lean: async () => ({
        loyalty: { punches: 0, rewardsRedeemed: 1 },
      }),
    });
    mocks.create.mockRejectedValue(new Error("ack failed"));
    mocks.findOne.mockReturnValue({
      select: () => ({ lean: async () => ({ _id: "saved" }) }),
    });

    const res = await redeem();
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.punches).toBe(0);
    expect(payload.code).toMatch(/^RWD[A-F0-9]{12}$/);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it("returns only this client's unused codes", async () => {
    mocks.find.mockReturnValue({
      select: () => ({
        sort: () => ({ lean: async () => [{ code: "RWDSARAH" }] }),
      }),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ codes: ["RWDSARAH"] });
    expect(mocks.find).toHaveBeenCalledWith({
      ownerUserId: sarahId,
      active: { $ne: false },
      redeemedCount: { $lt: 1 },
    });

    mocks.find.mockClear();
    mocks.getSession.mockResolvedValue(null);
    const anon = await GET();
    expect(anon.status).toBe(401);
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it("requires a signed-in client", async () => {
    mocks.getSession.mockResolvedValue(null);
    const anon = await redeem();
    expect(anon.status).toBe(401);

    mocks.getSession.mockResolvedValue({
      id: "admin-1",
      email: "ops@example.com",
      role: "admin",
      adminTier: "full",
    });
    const admin = await redeem();
    expect(admin.status).toBe(403);
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
