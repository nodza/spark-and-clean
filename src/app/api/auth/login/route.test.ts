import { beforeEach, describe, expect, it, vi } from "vitest";

const findOne = vi.fn();

vi.mock("@/lib/mongodb", () => ({
  connectDB: vi.fn(async () => undefined),
}));

vi.mock("@/lib/session", () => ({
  createSessionToken: vi.fn(),
  setSessionCookie: vi.fn(),
}));

vi.mock("@/models/User", () => ({
  User: {
    findOne: (...args: unknown[]) => findOne(...args),
    updateOne: vi.fn(),
  },
}));

function login(body: Record<string, unknown>) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    findOne.mockReset();
    findOne.mockReturnValue({
      select: () => ({ lean: async () => null }),
    });
  });

  it("only looks up accounts that are still allowed to sign in", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      login({
        email: "Ada@Example.com",
        password: "secret123",
        role: "admin",
      })
    );
    expect(res.status).toBe(401);
    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "ada@example.com",
        disabledAt: null,
        $or: [{ isActive: true }, { isActive: { $exists: false } }],
      })
    );
  });
});
