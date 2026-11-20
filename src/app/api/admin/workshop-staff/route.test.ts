import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const find = vi.fn();
const findOne = vi.fn();
const create = vi.fn();

vi.mock("@/lib/mongodb", () => ({
  connectDB: vi.fn(async () => undefined),
}));
vi.mock("@/lib/session", () => ({
  getSession: () => getSession(),
}));
vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn(async () => "hashed-password") },
}));
vi.mock("@/lib/temporaryPassword", () => ({
  generateTemporaryPassword: () => "TempPassw0rd!",
}));
vi.mock("@/models/User", () => ({
  User: {
    find: (...args: unknown[]) => find(...args),
    findOne: (...args: unknown[]) => findOne(...args),
    create: (...args: unknown[]) => create(...args),
  },
}));

const admin = {
  id: "507f1f77bcf86cd799439011",
  email: "admin@example.com",
  role: "admin",
  adminTier: "full",
};

function request(body: unknown) {
  return new Request("http://localhost/api/admin/workshop-staff", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/admin/workshop-staff", () => {
  beforeEach(() => {
    getSession.mockReset();
    find.mockReset();
    findOne.mockReset();
    create.mockReset();
    find.mockReturnValue({ sort: () => ({ lean: async () => [] }) });
    findOne.mockReturnValue({ select: () => ({ lean: async () => null }) });
    create.mockImplementation(async (doc: Record<string, unknown>) => ({
      _id: "507f1f77bcf86cd799439099",
      ...doc,
    }));
  });

  it("requires a full admin", async () => {
    const { GET, POST } = await import("./route");
    getSession.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    getSession.mockResolvedValue({ ...admin, adminTier: "marketing-only" });
    expect((await POST(request({ name: "Pat", email: "pat@example.com" }))).status)
      .toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it("creates a workshop account with a one-time password and forced change", async () => {
    const { POST } = await import("./route");
    getSession.mockResolvedValue(admin);
    const response = await POST(
      request({ name: "  Pat   Workshop ", email: "Pat@Example.com" })
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      workshopStaff: {
        id: "507f1f77bcf86cd799439099",
        name: "Pat Workshop",
        email: "pat@example.com",
        active: true,
      },
      temporaryPassword: "TempPassw0rd!",
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Pat Workshop",
        email: "pat@example.com",
        role: "workshop",
        adminTier: null,
        mustChangePassword: true,
        passwordHash: "hashed-password",
      })
    );
  });

  it("rejects duplicate email and invalid input", async () => {
    const { POST } = await import("./route");
    getSession.mockResolvedValue(admin);
    const invalid = await POST(request({ name: "", email: "invalid" }));
    expect(invalid.status).toBe(400);

    findOne.mockReturnValue({
      select: () => ({ lean: async () => ({ role: "client" }) }),
    });
    const duplicate = await POST(
      request({ name: "Pat Workshop", email: "pat@example.com" })
    );
    expect(duplicate.status).toBe(409);
    expect(create).not.toHaveBeenCalled();
  });
});
