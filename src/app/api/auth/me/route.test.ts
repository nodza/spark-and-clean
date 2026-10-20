import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  clearSessionCookie: vi.fn(),
  findById: vi.fn(),
  ensureClientReferralCode: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getSession: (...args: unknown[]) => mocks.getSession(...args),
  clearSessionCookie: (...args: unknown[]) => mocks.clearSessionCookie(...args),
}));
vi.mock("@/lib/mongodb", () => ({ connectDB: vi.fn() }));
vi.mock("@/models/User", () => ({
  User: {
    findById: (...args: unknown[]) => mocks.findById(...args),
  },
}));
vi.mock("@/lib/referral", () => ({
  ensureClientReferralCode: (...args: unknown[]) =>
    mocks.ensureClientReferralCode(...args),
}));

import { GET } from "./route";

const sarahId = "507f1f77bcf86cd799439011";
const sarahCode = "K7MP4Q2N";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findById.mockReturnValue({
    select: () => ({
      lean: async () => ({ loyalty: { punches: 2, rewardsRedeemed: 0 } }),
    }),
  });
  mocks.ensureClientReferralCode.mockResolvedValue(sarahCode);
});

describe("GET /api/auth/me referral code", () => {
  it("returns the same client code on refresh", async () => {
    mocks.getSession.mockResolvedValue({
      id: sarahId,
      email: "sarah@example.com",
      role: "client",
    });

    const first = await GET();
    const second = await GET();
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await first.json()).toMatchObject({
      user: { referralCode: sarahCode },
    });
    expect(await second.json()).toMatchObject({
      user: { referralCode: sarahCode },
    });
    expect(mocks.ensureClientReferralCode).toHaveBeenCalledTimes(2);
    expect(mocks.ensureClientReferralCode).toHaveBeenCalledWith(sarahId);
  });

  it("does not attach a customer referral code to a technician", async () => {
    mocks.getSession.mockResolvedValue({
      id: sarahId,
      email: "tech@example.com",
      role: "technician",
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.role).toBe("technician");
    expect(body.user).not.toHaveProperty("referralCode");
    expect(mocks.ensureClientReferralCode).not.toHaveBeenCalled();
  });
});
