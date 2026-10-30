import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const findById = vi.fn();
const countDocuments = vi.fn();

vi.mock("@/lib/mongodb", () => ({
  connectDB: vi.fn(async () => undefined),
}));

vi.mock("@/lib/session", () => ({
  getSession: () => getSession(),
}));

vi.mock("@/models/User", () => ({
  User: {
    findById: (...args: unknown[]) => findById(...args),
    countDocuments: (...args: unknown[]) => countDocuments(...args),
  },
}));

import { PATCH } from "./route";

const actorId = "507f1f77bcf86cd799439011";
const otherId = "507f1f77bcf86cd799439012";

function session(id = actorId) {
  return {
    id,
    email: "ada@example.com",
    role: "admin",
    adminTier: "full" as const,
  };
}

function adminDoc(overrides: Record<string, unknown> = {}) {
  const save = vi.fn(async () => undefined);
  const doc = {
    _id: otherId,
    name: "Bea Admin",
    email: "bea@example.com",
    role: "admin",
    adminTier: "full",
    disabledAt: null as Date | null,
    isActive: true,
    sessionsInvalidatedAt: null as Date | null,
    save,
    ...overrides,
  };
  return doc;
}

function patch(id: string, body: unknown) {
  return new Request(`http://localhost/api/admin/team/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/admin/team/[id]", () => {
  beforeEach(() => {
    getSession.mockReset();
    findById.mockReset();
    countDocuments.mockReset();
    countDocuments.mockResolvedValue(1);
    getSession.mockResolvedValue(session());
  });

  it("returns 403 for a marketing admin before loading the account", async () => {
    getSession.mockResolvedValue({
      id: actorId,
      email: "mia@example.com",
      role: "admin",
      adminTier: "marketing-only",
    });
    const res = await PATCH(patch(otherId, { active: false }), {
      params: Promise.resolve({ id: otherId }),
    });
    expect(res.status).toBe(403);
    expect(findById).not.toHaveBeenCalled();
  });

  it("deactivates another admin and ends their open sessions", async () => {
    const doc = adminDoc();
    findById.mockResolvedValue(doc);
    const res = await PATCH(patch(otherId, { active: false }), {
      params: Promise.resolve({ id: otherId }),
    });
    expect(res.status).toBe(200);
    expect(doc.disabledAt).toBeInstanceOf(Date);
    expect(doc.isActive).toBe(false);
    expect(doc.sessionsInvalidatedAt).toBeInstanceOf(Date);
    expect(doc.save).toHaveBeenCalledOnce();
    const body = await res.json();
    expect(body.admin).toEqual(
      expect.objectContaining({
        id: otherId,
        adminTier: "full",
        active: false,
      })
    );
    expect(countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: { $ne: otherId },
        adminTier: "full",
        disabledAt: null,
      })
    );
  });

  it("refuses to deactivate the last full admin", async () => {
    const doc = adminDoc({ _id: actorId, email: "ada@example.com", name: "Ada" });
    findById.mockResolvedValue(doc);
    countDocuments.mockResolvedValue(0);
    const res = await PATCH(patch(actorId, { active: false }), {
      params: Promise.resolve({ id: actorId }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/last full admin cannot be deactivated/i);
    expect(doc.save).not.toHaveBeenCalled();
  });

  it("refuses to deactivate or downgrade the signed-in admin when another full admin remains", async () => {
    const self = adminDoc({ _id: actorId, email: "ada@example.com" });
    findById.mockResolvedValue(self);

    const deactivate = await PATCH(patch(actorId, { active: false }), {
      params: Promise.resolve({ id: actorId }),
    });
    expect(deactivate.status).toBe(409);
    expect((await deactivate.json()).error).toMatch(/your own account/i);

    const downgrade = await PATCH(
      patch(actorId, { adminTier: "marketing-only" }),
      { params: Promise.resolve({ id: actorId }) }
    );
    expect(downgrade.status).toBe(409);
    expect((await downgrade.json()).error).toMatch(/your own tier/i);
    expect(self.save).not.toHaveBeenCalled();
  });

  it("changes another admin's tier and ends the old session", async () => {
    const doc = adminDoc();
    findById.mockResolvedValue(doc);
    const res = await PATCH(patch(otherId, { adminTier: "marketing-only" }), {
      params: Promise.resolve({ id: otherId }),
    });
    expect(res.status).toBe(200);
    expect(doc.adminTier).toBe("marketing-only");
    expect(doc.disabledAt).toBeNull();
    expect(doc.sessionsInvalidatedAt).toBeInstanceOf(Date);
    const body = await res.json();
    expect(body.admin.adminTier).toBe("marketing-only");
    expect(body.admin.active).toBe(true);
  });

  it("reactivates an admin without restoring the ended session", async () => {
    const ended = new Date("2026-10-01T00:00:00.000Z");
    const doc = adminDoc({
      adminTier: "marketing-only",
      disabledAt: new Date("2026-10-02T00:00:00.000Z"),
      isActive: false,
      sessionsInvalidatedAt: ended,
    });
    findById.mockResolvedValue(doc);
    const res = await PATCH(patch(otherId, { active: true }), {
      params: Promise.resolve({ id: otherId }),
    });
    expect(res.status).toBe(200);
    expect(doc.disabledAt).toBeNull();
    expect(doc.isActive).toBe(true);
    expect(doc.sessionsInvalidatedAt).toBe(ended);
    const body = await res.json();
    expect(body.admin.active).toBe(true);
  });
});
