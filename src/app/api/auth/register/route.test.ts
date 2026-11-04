import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  create: vi.fn(),
  updateOne: vi.fn(),
  findById: vi.fn(),
  ensureClientReferralCode: vi.fn(),
  referrerIdForCode: vi.fn(),
  createSessionToken: vi.fn(),
  setSessionCookie: vi.fn(),
  attach: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: async () => ({ allowed: true, retryAfterSeconds: 0 }),
  getClientIp: () => "127.0.0.1",
}));
vi.mock("@/lib/session", () => ({
  createSessionToken: (...args: unknown[]) => mocks.createSessionToken(...args),
  setSessionCookie: (...args: unknown[]) => mocks.setSessionCookie(...args),
}));
vi.mock("@/lib/attachGuestBookings", () => ({
  attachUnclaimedBookingsByEmail: (...args: unknown[]) => mocks.attach(...args),
}));
vi.mock("@/models/Booking", () => ({
  Booking: { updateOne: vi.fn() },
}));
vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn(async () => "hashed") },
}));
vi.mock("@/models/User", () => ({
  User: {
    findOne: (...args: unknown[]) => mocks.findOne(...args),
    create: (...args: unknown[]) => mocks.create(...args),
    updateOne: (...args: unknown[]) => mocks.updateOne(...args),
    findById: (...args: unknown[]) => mocks.findById(...args),
  },
}));
vi.mock("@/lib/referral", () => ({
  ensureClientReferralCode: (...args: unknown[]) =>
    mocks.ensureClientReferralCode(...args),
  referrerIdForCode: (...args: unknown[]) => mocks.referrerIdForCode(...args),
}));

import { POST } from "./route";

const janeId = "507f1f77bcf86cd799439012";
const sarahId = "507f1f77bcf86cd799439011";

function signup(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

const jane = {
  name: "Jane Smith",
  email: "jane@example.com",
  phone: "0821234567",
  password: "secret123",
  confirmPassword: "secret123",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findOne.mockReturnValue({
    select: async () => null,
  });
  mocks.create.mockImplementation(async (doc: { email: string; name?: string; phone?: string }) => ({
    _id: janeId,
    email: doc.email,
    name: doc.name,
    phone: doc.phone,
  }));
  mocks.updateOne.mockResolvedValue({ modifiedCount: 1 });
  mocks.ensureClientReferralCode.mockResolvedValue("J4N3CODE");
  mocks.referrerIdForCode.mockResolvedValue(null);
  mocks.createSessionToken.mockResolvedValue("token");
  mocks.setSessionCookie.mockResolvedValue(undefined);
  mocks.attach.mockResolvedValue({ count: 0, ids: [] });
});

describe("POST /api/auth/register referral", () => {
  it("stores Sarah as Jane's referrer when the ref matches", async () => {
    mocks.referrerIdForCode.mockResolvedValue(sarahId);

    const res = await signup({ ...jane, ref: "K7MP4Q2N" });
    expect(res.status).toBe(201);

    expect(mocks.ensureClientReferralCode).toHaveBeenCalledWith(janeId);
    expect(mocks.referrerIdForCode).toHaveBeenCalledWith("K7MP4Q2N", janeId);
    expect(mocks.updateOne).toHaveBeenCalledWith(
      {
        _id: janeId,
        $or: [
          { referredByUserId: { $exists: false } },
          { referredByUserId: null },
        ],
      },
      { $set: { referredByUserId: sarahId } }
    );
  });

  it("still creates the account when the ref does not match a client", async () => {
    mocks.referrerIdForCode.mockResolvedValue(null);

    const res = await signup({ ...jane, ref: "NOT-A-CODE" });
    expect(res.status).toBe(201);
    expect(mocks.updateOne).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalled();
  });

  it("keeps name and password validation and does not look up a ref", async () => {
    const short = await signup({ ...jane, password: "short", confirmPassword: "short" });
    expect(short.status).toBe(400);
    expect(await short.json()).toMatchObject({
      error: "Password must be at least 8 characters.",
    });

    const badName = await signup({ ...jane, name: "J4ne" });
    expect(badName.status).toBe(400);

    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.referrerIdForCode).not.toHaveBeenCalled();
  });
});
