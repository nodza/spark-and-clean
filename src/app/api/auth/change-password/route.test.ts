import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findById: vi.fn(),
  compare: vi.fn(),
  hash: vi.fn(),
  createSessionToken: vi.fn(),
  setSessionCookie: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/session", () => ({
  getSession: () => mocks.getSession(),
  createSessionToken: (...args: unknown[]) => mocks.createSessionToken(...args),
  setSessionCookie: (...args: unknown[]) => mocks.setSessionCookie(...args),
}));
vi.mock("bcryptjs", () => ({
  default: {
    compare: (...args: unknown[]) => mocks.compare(...args),
    hash: (...args: unknown[]) => mocks.hash(...args),
  },
}));
vi.mock("@/models/User", () => ({
  User: {
    findById: (...args: unknown[]) => mocks.findById(...args),
  },
}));

import { POST } from "./route";

describe("POST /api/auth/change-password", () => {
  const save = vi.fn(async () => undefined);
  const user = {
    _id: { toString: () => "user-id" },
    email: "new-admin@example.com",
    name: "New Admin",
    phone: "",
    role: "admin",
    adminTier: "marketing-only",
    passwordHash: "old-hash",
    disabledAt: null,
    mustChangePassword: true,
    sessionsInvalidatedAt: null as Date | null,
    save,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    user.mustChangePassword = true;
    user.sessionsInvalidatedAt = null;
    mocks.getSession.mockResolvedValue({
      id: "user-id",
      email: user.email,
      role: "admin",
      adminTier: "marketing-only",
      mustChangePassword: true,
    });
    mocks.findById.mockReturnValue({
      select: () => user,
    });
    mocks.compare.mockResolvedValue(true);
    mocks.hash.mockResolvedValue("new-hash");
    mocks.createSessionToken.mockResolvedValue("new-token");
    mocks.setSessionCookie.mockResolvedValue(undefined);
  });

  it("ends every earlier session when the temporary password is replaced", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: "TempPassw0rd!",
          newPassword: "fresh-password",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(user.mustChangePassword).toBe(false);
    expect(user.sessionsInvalidatedAt).toBeInstanceOf(Date);
    const ageMs = Date.now() - (user.sessionsInvalidatedAt as Date).getTime();
    expect(ageMs).toBeGreaterThanOrEqual(500);
    expect(ageMs).toBeLessThan(5000);
    expect(mocks.setSessionCookie).toHaveBeenCalledWith("new-token");
    expect(mocks.createSessionToken).toHaveBeenCalledWith(
      expect.objectContaining({ mustChangePassword: false })
    );
  });
});
