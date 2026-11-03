import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  updateMany: vi.fn(),
  create: vi.fn(),
  checkRateLimit: vi.fn(),
  tooManyAttemptsMessage: vi.fn((retryAfterSeconds: number) => {
    const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
    return `Too many attempts. Try again in ${minutes} ${
      minutes === 1 ? "minute" : "minutes"
    }.`;
  }),
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({ connectDB: vi.fn() }));
vi.mock("@/models/User", () => ({
  User: { findOne: (...args: unknown[]) => mocks.findOne(...args) },
}));
vi.mock("@/models/PasswordResetToken", () => ({
  PasswordResetToken: {
    updateMany: (...args: unknown[]) => mocks.updateMany(...args),
    create: (...args: unknown[]) => mocks.create(...args),
  },
}));
vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: (...args: unknown[]) => mocks.checkRateLimit(...args),
  getClientIp: () => "127.0.0.1",
  tooManyAttemptsMessage: (retryAfterSeconds: number) =>
    mocks.tooManyAttemptsMessage(retryAfterSeconds),
}));
vi.mock("@/lib/mail", () => ({
  getAppBaseUrl: () => "http://localhost:3000",
  sendPasswordResetEmail: (...args: unknown[]) =>
    mocks.sendPasswordResetEmail(...args),
}));
vi.mock("@/lib/passwordReset", () => ({
  FORGOT_PASSWORD_PUBLIC_MESSAGE:
    "If an account exists for that email, we've sent a reset link.",
  RESET_TOKEN_TTL_MS: 60 * 60 * 1000,
  generateResetToken: () => "reset-token",
  hashResetToken: () => "hashed-token",
}));

import { POST } from "./route";

function request(email: string) {
  return new Request("http://localhost/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findOne.mockReturnValue({ lean: async () => null });
  mocks.updateMany.mockResolvedValue({ modifiedCount: 0 });
  mocks.create.mockResolvedValue({});
  mocks.sendPasswordResetEmail.mockResolvedValue(undefined);
  mocks.checkRateLimit.mockResolvedValue({
    allowed: true,
    retryAfterSeconds: 0,
  });
});

describe("POST /api/auth/forgot-password", () => {
  it("returns a visible rate-limit error with the retry delay", async () => {
    mocks.checkRateLimit.mockImplementation(async (key: string) => ({
      allowed: !key.endsWith("known@example.com"),
      retryAfterSeconds: key.endsWith("known@example.com") ? 120 : 0,
    }));

    const capped = await POST(request("known@example.com"));

    expect(capped.status).toBe(429);
    expect(capped.headers.get("Retry-After")).toBe("120");
    expect(await capped.json()).toEqual({
      error: "Too many attempts. Try again in 2 minutes.",
    });
    expect(mocks.findOne).not.toHaveBeenCalled();
  });

  it("uses the same success response for known and unknown emails", async () => {
    mocks.findOne.mockReturnValue({
      lean: async () => ({ _id: "507f1f77bcf86cd799439011" }),
    });

    const known = await POST(request("known@example.com"));
    mocks.findOne.mockReturnValue({ lean: async () => null });
    const unknown = await POST(request("unknown@example.com"));

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    const knownBody = await known.json();
    const unknownBody = await unknown.json();
    expect(knownBody).toEqual(unknownBody);
    expect(unknownBody).toEqual({
      message: "If an account exists for that email, we've sent a reset link.",
    });
  });
});
