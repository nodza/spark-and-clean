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

const fullAdmin = {
  id: "507f1f77bcf86cd799439011",
  email: "ada@example.com",
  role: "admin",
  adminTier: "full",
};

function session(role: string, adminTier?: string | null, id = fullAdmin.id) {
  return { id, email: "user@example.com", role, adminTier: adminTier ?? null };
}

describe("/api/admin/team", () => {
  beforeEach(() => {
    getSession.mockReset();
    find.mockReset();
    findOne.mockReset();
    create.mockReset();
    find.mockReturnValue({
      sort: () => ({ lean: async () => [] }),
    });
    findOne.mockReturnValue({
      select: () => ({ lean: async () => null }),
    });
    create.mockImplementation(async (doc: Record<string, unknown>) => ({
      _id: "507f1f77bcf86cd799439099",
      ...doc,
    }));
  });

  it("returns 401 for anonymous and 403 for a marketing admin", async () => {
    const { GET, POST } = await import("./route");

    getSession.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);

    getSession.mockResolvedValue(session("admin", "marketing-only"));
    expect((await GET()).status).toBe(403);
    const denied = await POST(
      new Request("http://localhost/api/admin/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Mia Marketing",
          email: "mia@example.com",
          adminTier: "marketing-only",
        }),
      })
    );
    expect(denied.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
    expect(find).not.toHaveBeenCalled();
  });

  it("lists name, email, tier, and active state", async () => {
    const { GET } = await import("./route");
    find.mockReturnValue({
      sort: () => ({
        lean: async () => [
          {
            _id: fullAdmin.id,
            name: "Ada Admin",
            email: "ada@example.com",
            role: "admin",
            adminTier: "full",
            disabledAt: null,
            isActive: true,
            passwordHash: "secret",
          },
          {
            _id: "507f1f77bcf86cd799439012",
            name: "Mia Marketing",
            email: "mia@example.com",
            role: "admin",
            adminTier: "marketing-only",
            disabledAt: new Date("2026-10-01T00:00:00.000Z"),
            isActive: false,
            passwordHash: "secret",
          },
        ],
      }),
    });
    getSession.mockResolvedValue(session("admin", "full"));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.admins).toEqual([
      {
        id: fullAdmin.id,
        name: "Ada Admin",
        email: "ada@example.com",
        adminTier: "full",
        active: true,
      },
      {
        id: "507f1f77bcf86cd799439012",
        name: "Mia Marketing",
        email: "mia@example.com",
        adminTier: "marketing-only",
        active: false,
      },
    ]);
    expect(JSON.stringify(body)).not.toContain("passwordHash");
    expect(JSON.stringify(body)).not.toContain("secret");
  });

  it("creates a marketing admin with a one-time password and a forced change", async () => {
    const { POST } = await import("./route");
    getSession.mockResolvedValue(session("admin", "full"));
    const res = await POST(
      new Request("http://localhost/api/admin/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "  Mia   Marketing ",
          email: "Mia@Example.com",
          adminTier: "marketing-only",
        }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.temporaryPassword).toBe("TempPassw0rd!");
    expect(body.admin).toEqual({
      id: "507f1f77bcf86cd799439099",
      name: "Mia Marketing",
      email: "mia@example.com",
      adminTier: "marketing-only",
      active: true,
    });
    expect(body.admin.passwordHash).toBeUndefined();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "mia@example.com",
        name: "Mia Marketing",
        role: "admin",
        adminTier: "marketing-only",
        mustChangePassword: true,
        passwordHash: "hashed-password",
        disabledAt: null,
        isActive: true,
      })
    );
  });

  it("refuses an email that already belongs to a client or technician", async () => {
    const { POST } = await import("./route");
    getSession.mockResolvedValue(session("admin", "full"));

    for (const role of ["client", "technician"]) {
      create.mockClear();
      findOne.mockReturnValue({
        select: () => ({ lean: async () => ({ role }) }),
      });
      const res = await POST(
        new Request("http://localhost/api/admin/team", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Pat Person",
            email: "pat@example.com",
            adminTier: "full",
          }),
        })
      );
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toMatch(/client or technician/i);
      expect(create).not.toHaveBeenCalled();
    }
  });
});
