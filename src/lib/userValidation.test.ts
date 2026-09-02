import { describe, expect, it } from "vitest";
import {
  assertRoleTierInvariants,
  createUserSchema,
  isValidRoleTier,
} from "@/lib/userValidation";
import { toClientUser } from "@/lib/serialize";

describe("assertRoleTierInvariants", () => {
  it("allows client with null adminTier", () => {
    expect(assertRoleTierInvariants({ role: "client", adminTier: null })).toEqual({
      role: "client",
      adminTier: null,
    });
  });

  it("allows technician with null adminTier", () => {
    expect(
      assertRoleTierInvariants({ role: "technician", adminTier: null })
    ).toEqual({ role: "technician", adminTier: null });
  });

  it("allows admin with full tier", () => {
    expect(
      assertRoleTierInvariants({ role: "admin", adminTier: "full" })
    ).toEqual({ role: "admin", adminTier: "full" });
  });

  it("allows admin with marketing-only tier", () => {
    expect(
      assertRoleTierInvariants({
        role: "admin",
        adminTier: "marketing-only",
      })
    ).toEqual({ role: "admin", adminTier: "marketing-only" });
  });

  it("rejects admin without tier", () => {
    expect(() =>
      assertRoleTierInvariants({ role: "admin", adminTier: null })
    ).toThrow(/adminTier/);
  });

  it("rejects client with adminTier set", () => {
    expect(() =>
      assertRoleTierInvariants({ role: "client", adminTier: "full" })
    ).toThrow(/Non-admin/);
  });

  it("rejects technician with adminTier set", () => {
    expect(() =>
      assertRoleTierInvariants({
        role: "technician",
        adminTier: "marketing-only",
      })
    ).toThrow(/Non-admin/);
  });

  it("rejects invalid role", () => {
    expect(() =>
      assertRoleTierInvariants({
        role: "CUSTOMER" as "client",
        adminTier: null,
      })
    ).toThrow(/Invalid role/);
  });
});

describe("isValidRoleTier", () => {
  it("returns false for invalid combinations", () => {
    expect(isValidRoleTier({ role: "admin", adminTier: null })).toBe(false);
    expect(isValidRoleTier({ role: "client", adminTier: "full" })).toBe(false);
  });

  it("returns true for valid combinations", () => {
    expect(isValidRoleTier({ role: "admin", adminTier: "full" })).toBe(true);
    expect(isValidRoleTier({ role: "client", adminTier: null })).toBe(true);
  });
});

describe("createUserSchema", () => {
  it("normalizes email to lowercase", () => {
    const parsed = createUserSchema.parse({
      email: "Sarah.J@Example.com",
      role: "client",
      adminTier: null,
    });
    expect(parsed.email).toBe("sarah.j@example.com");
  });

  it("rejects admin without tier", () => {
    const result = createUserSchema.safeParse({
      email: "admin@example.com",
      role: "admin",
      adminTier: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-admin with tier", () => {
    const result = createUserSchema.safeParse({
      email: "client@example.com",
      role: "client",
      adminTier: "full",
    });
    expect(result.success).toBe(false);
  });
});

describe("toClientUser", () => {
  it("never exposes passwordHash", () => {
    const user = toClientUser({
      _id: "507f1f77bcf86cd799439011",
      email: "sarah.j@example.com",
      role: "client",
      adminTier: null,
      passwordHash: "$2a$10$should-never-leak",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-02"),
    });
    expect(user).not.toHaveProperty("passwordHash");
    expect(JSON.stringify(user)).not.toContain("should-never-leak");
    expect(user.role).toBe("client");
    expect(user.adminTier).toBe(null);
  });

  it("normalizes legacy roles and clears tier for non-admins", () => {
    const user = toClientUser({
      _id: "507f1f77bcf86cd799439012",
      email: "thabo@example.com",
      role: "DRIVER",
      adminTier: "full",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(user.role).toBe("technician");
    expect(user.adminTier).toBe(null);
  });
});
