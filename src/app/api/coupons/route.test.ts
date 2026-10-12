import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const find = vi.fn();
const findOne = vi.fn();
const create = vi.fn();
const userFind = vi.fn();

vi.mock("@/lib/mongodb", () => ({
  connectDB: vi.fn(async () => undefined),
}));

vi.mock("@/lib/session", () => ({
  getSession: () => getSession(),
}));

vi.mock("@/models/Coupon", () => ({
  Coupon: {
    find: (...args: unknown[]) => find(...args),
    findOne: (...args: unknown[]) => findOne(...args),
    create: (...args: unknown[]) => create(...args),
  },
}));

vi.mock("@/models/User", () => ({
  User: {
    find: (...args: unknown[]) => userFind(...args),
  },
}));

const sparkDoc = {
  _id: "coupon-spark10",
  code: "SPARK10",
  type: "PERCENT",
  value: 10,
  active: true,
  maxRedemptions: null,
  redeemedCount: 0,
  validFrom: null,
  validTo: null,
  city: null,
  createdAt: new Date("2026-09-30T12:00:00.000Z"),
};

function session(role: string, adminTier?: string | null) {
  return {
    id: "user-1",
    email: "user@example.com",
    role,
    adminTier: adminTier ?? null,
  };
}

function post(body: unknown) {
  return new Request("http://localhost/api/coupons", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/coupons", () => {
  beforeEach(() => {
    getSession.mockReset();
    find.mockReset();
    findOne.mockReset();
    create.mockReset();
    userFind.mockReset();
    userFind.mockReturnValue({
      select: () => ({ lean: async () => [] }),
    });
    find.mockReturnValue({
      sort: () => ({ lean: async () => [sparkDoc] }),
    });
    findOne.mockReturnValue({
      select: () => ({ lean: async () => null }),
    });
    create.mockImplementation(async (doc: Record<string, unknown>) => ({
      toObject: () => ({
        ...doc,
        _id: "coupon-new",
        createdAt: new Date("2026-09-30T12:00:00.000Z"),
      }),
    }));
  });

  it("returns 401 when anonymous and 403 for a client", async () => {
    const { GET, POST } = await import("./route");

    getSession.mockResolvedValue(null);
    const anon = await GET();
    expect(anon.status).toBe(401);

    getSession.mockResolvedValue(session("client"));
    const clientGet = await GET();
    expect(clientGet.status).toBe(403);
    const clientPost = await POST(
      post({ code: "SPARK10", type: "PERCENT", value: 10 })
    );
    expect(clientPost.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it("lists SPARK10 for a marketing-only admin", async () => {
    const { GET } = await import("./route");
    getSession.mockResolvedValue(session("admin", "marketing-only"));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.coupons).toEqual([
      expect.objectContaining({
        id: "coupon-spark10",
        code: "SPARK10",
        type: "PERCENT",
        value: 10,
        active: true,
        ownerUserId: null,
        ownerName: null,
      }),
    ]);
    expect(userFind).not.toHaveBeenCalled();
  });

  it("shows the client name only on a personal reward", async () => {
    const sarahId = "507f1f77bcf86cd799439011";
    find.mockReturnValue({
      sort: () => ({
        lean: async () => [
          sparkDoc,
          {
            ...sparkDoc,
            _id: "coupon-rwd",
            code: "RWDSARAH",
            type: "FIXED_CENTS",
            value: 50_000,
            ownerUserId: sarahId,
          },
        ],
      }),
    });
    userFind.mockReturnValue({
      select: () => ({
        lean: async () => [{ _id: sarahId, name: "Sarah Jenkins" }],
      }),
    });

    const { GET } = await import("./route");
    getSession.mockResolvedValue(session("admin", "full"));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.coupons).toEqual([
      expect.objectContaining({ code: "SPARK10", ownerUserId: null, ownerName: null }),
      expect.objectContaining({
        code: "RWDSARAH",
        ownerUserId: sarahId,
        ownerName: "Sarah Jenkins",
      }),
    ]);
  });

  it("lets a marketing-only admin create SPARK10 at 10%", async () => {
    const { POST } = await import("./route");
    getSession.mockResolvedValue(session("admin", "marketing-only"));
    const res = await POST(
      post({ code: " SPARK10 ", type: "PERCENT", value: 10 })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.coupon).toEqual(
      expect.objectContaining({
        code: "SPARK10",
        type: "PERCENT",
        value: 10,
        active: true,
        redeemedCount: 0,
      })
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "SPARK10",
        type: "PERCENT",
        value: 10,
        redeemedCount: 0,
      })
    );
  });

  it("rejects a duplicate code", async () => {
    const { POST } = await import("./route");
    getSession.mockResolvedValue(session("admin", "full"));
    findOne.mockReturnValue({
      select: () => ({ lean: async () => ({ _id: "existing" }) }),
    });
    const res = await POST(
      post({ code: "SPARK10", type: "PERCENT", value: 10 })
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "A coupon with that code already exists",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a duplicate unique-index race", async () => {
    const { POST } = await import("./route");
    getSession.mockResolvedValue(session("admin", "full"));
    create.mockRejectedValue({ code: 11000 });
    const res = await POST(
      post({ code: "SPARK10", type: "PERCENT", value: 10 })
    );
    expect(res.status).toBe(409);
  });
});
