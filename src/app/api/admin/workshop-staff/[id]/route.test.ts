import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const findById = vi.fn();

vi.mock("@/lib/mongodb", () => ({
  connectDB: vi.fn(async () => undefined),
}));
vi.mock("@/lib/session", () => ({
  getSession: () => getSession(),
}));
vi.mock("@/models/User", () => ({
  User: { findById: (...args: unknown[]) => findById(...args) },
}));

const staffId = "507f1f77bcf86cd799439012";
const admin = {
  id: "507f1f77bcf86cd799439011",
  email: "admin@example.com",
  role: "admin",
  adminTier: "full",
};

function patch(active: boolean) {
  return new Request(`http://localhost/api/admin/workshop-staff/${staffId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ active }),
  });
}

describe("PATCH /api/admin/workshop-staff/[id]", () => {
  beforeEach(() => {
    getSession.mockReset();
    findById.mockReset();
    getSession.mockResolvedValue(admin);
  });

  it("deactivates the correct role and revokes existing sessions", async () => {
    const save = vi.fn(async () => undefined);
    const user = {
      _id: staffId,
      role: "workshop",
      name: "Pat Workshop",
      email: "pat@example.com",
      disabledAt: null as Date | null,
      isActive: true,
      sessionsInvalidatedAt: null as Date | null,
      save,
    };
    findById.mockResolvedValue(user);
    const { PATCH } = await import("./route");
    const response = await PATCH(patch(false), {
      params: Promise.resolve({ id: staffId }),
    });
    expect(response.status).toBe(200);
    expect(user.disabledAt).toBeInstanceOf(Date);
    expect(user.isActive).toBe(false);
    expect(user.sessionsInvalidatedAt).toBeInstanceOf(Date);
    expect(save).toHaveBeenCalledOnce();
    expect((await response.json()).workshopStaff.active).toBe(false);
  });

  it("does not allow a full admin to change another role", async () => {
    findById.mockResolvedValue({
      _id: staffId,
      role: "technician",
    });
    const { PATCH } = await import("./route");
    const response = await PATCH(patch(false), {
      params: Promise.resolve({ id: staffId }),
    });
    expect(response.status).toBe(404);
  });
});
