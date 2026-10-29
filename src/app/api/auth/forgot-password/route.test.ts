import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  updateMany: vi.fn(),
  create: vi.fn(),
  checkRateLimit: vi.fn(),
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
  it("returns an identical public response for capped and uncapped email keys", async () => {
    mocks.checkRateLimit.mockImplementation(async (key: string) => ({
      allowed: !key.endsWith("known@example.com"),
      retryAfterSeconds: key.endsWith("known@example.com") ? 120 : 0,
    }));

    const capped = await POST(request("known@example.com"));
    const uncapped = await POST(request("unknown@example.com"));

    expect(capped.status).toBe(200);
    expect(uncapped.status).toBe(200);
    expect(await capped.json()).toEqual(await uncapped.json());
    expect(mocks.findOne).not.toHaveBeenCalled();
  });
});
