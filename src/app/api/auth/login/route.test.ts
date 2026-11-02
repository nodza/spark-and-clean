import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  updateOne: vi.fn(),
  checkRateLimit: vi.fn(),
  clearRateLimit: vi.fn(),
  compare: vi.fn(),
  createSessionToken: vi.fn(),
  setSessionCookie: vi.fn(),
  failureCounts: new Map<string, number>(),
  compareCalls: 0,
}));

vi.mock("@/lib/mongodb", () => ({ connectDB: vi.fn() }));
vi.mock("@/models/User", () => ({
  User: {
    findOne: (...args: unknown[]) => mocks.findOne(...args),
    updateOne: (...args: unknown[]) => mocks.updateOne(...args),
  },
}));
vi.mock("@/lib/session", () => ({
  createSessionToken: (...args: unknown[]) =>
    mocks.createSessionToken(...args),
  setSessionCookie: (...args: unknown[]) => mocks.setSessionCookie(...args),
}));
vi.mock("@/lib/rateLimit", () => ({
  clearRateLimit: (...args: unknown[]) => mocks.clearRateLimit(...args),
  getClientIp: () => "127.0.0.1",
  checkRateLimit: (...args: unknown[]) => mocks.checkRateLimit(...args),
  tooManyAttemptsMessage: (retryAfterSeconds: number) => {
    const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
    return `Too many attempts. Try again in ${minutes} ${
      minutes === 1 ? "minute" : "minutes"
    }.`;
  },
}));
vi.mock("bcryptjs", () => ({
  default: { compare: (...args: unknown[]) => mocks.compare(...args) },
}));

import { POST } from "./route";

function request(password: string) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "person@example.com", password }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.failureCounts.clear();
  mocks.compareCalls = 0;
  mocks.findOne.mockReturnValue({
    select: () => ({
      lean: async () => ({
        _id: { toString: () => "user-id" },
        email: "person@example.com",
        role: "client",
        passwordHash: "hashed-password",
      }),
    }),
  });
  mocks.updateOne.mockResolvedValue({});
  mocks.checkRateLimit.mockImplementation(
    async (key: string, limit: number) => {
      const count = (mocks.failureCounts.get(key) ?? 0) + 1;
      mocks.failureCounts.set(key, count);
      const allowed = count <= limit;
      return {
        allowed,
        retryAfterSeconds: allowed ? 0 : 900,
      };
    }
  );
  mocks.compare.mockImplementation(async () => ++mocks.compareCalls > 5);
  mocks.createSessionToken.mockResolvedValue("session-token");
  mocks.setSessionCookie.mockResolvedValue(undefined);
});

describe("POST /api/auth/login rate limiting", () => {
  it("blocks a correct password after five failures for the email", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await POST(request("wrong-password"));
      expect(response.status).toBe(401);
    }

    const response = await POST(request("correct-password"));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("900");
    expect(await response.json()).toEqual({
      error: "Too many attempts. Try again in 15 minutes.",
    });
    expect(mocks.compare).toHaveBeenCalledTimes(5);
    expect(mocks.findOne).toHaveBeenCalledTimes(5);
    expect(mocks.clearRateLimit).not.toHaveBeenCalled();
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(
      "auth-login:email:person@example.com",
      5,
      15 * 60 * 1000
    );
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(
      "auth-login:ip:127.0.0.1",
      20,
      15 * 60 * 1000
    );
  });

  it("still checks a different email after one account has used its five attempts", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await POST(request("wrong-password"));
      expect(response.status).toBe(401);
    }

    mocks.compare.mockResolvedValue(false);
    mocks.findOne.mockReturnValue({
      select: () => ({
        lean: async () => ({
          _id: { toString: () => "other-id" },
          email: "other@example.com",
          role: "client",
          passwordHash: "hashed-password",
        }),
      }),
    });

    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "other@example.com",
          password: "wrong-password",
        }),
      })
    );

    expect(response.status).toBe(401);
    expect(mocks.compare).toHaveBeenCalledTimes(6);
    expect(mocks.clearRateLimit).not.toHaveBeenCalled();
  });
});
