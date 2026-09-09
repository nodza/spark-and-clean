import { describe, expect, it } from "vitest";
import { accountIsDisabled, HttpError, requireFullAdminSession } from "@/lib/adminAuth";
import {
  createTechnicianBodySchema,
  shouldGenerateTechnicianPassword,
} from "@/lib/createTechnician";
import { generateTemporaryPassword } from "@/lib/temporaryPassword";
import type { SessionUser } from "@/lib/session";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

function session(partial: Partial<SessionUser> & Pick<SessionUser, "role">): SessionUser {
  return {
    id: "u1",
    email: "user@example.com",
    ...partial,
  };
}

describe("requireFullAdminSession", () => {
  it("returns 401 when anonymous", () => {
    try {
      requireFullAdminSession(null);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(401);
    }
  });

  it("returns 403 for clients, technicians, and marketing-only admins", () => {
    const forbidden: SessionUser[] = [
      session({ role: "client" }),
      session({ role: "technician" }),
      session({ role: "admin", adminTier: "marketing-only" }),
      session({ role: "admin", adminTier: null }),
    ];
    for (const s of forbidden) {
      try {
        requireFullAdminSession(s);
        throw new Error(`expected throw for ${s.role} ${s.adminTier}`);
      } catch (err) {
        expect(err).toBeInstanceOf(HttpError);
        expect((err as HttpError).status).toBe(403);
      }
    }
  });

  it("allows full admin and does not mutate the session", () => {
    const admin = session({
      role: "admin",
      adminTier: "full",
      name: "Spark Admin",
    });
    const frozen = { ...admin };
    const result = requireFullAdminSession(admin);
    expect(result).toEqual(frozen);
    expect(result.role).toBe("admin");
    expect(result.adminTier).toBe("full");
  });
});

describe("accountIsDisabled", () => {
  it("treats disabledAt as the source of truth", () => {
    expect(accountIsDisabled({ disabledAt: new Date() })).toBe(true);
    expect(accountIsDisabled({ disabledAt: null, isActive: false })).toBe(false);
    expect(accountIsDisabled({ disabledAt: null, isActive: true })).toBe(false);
    expect(accountIsDisabled({})).toBe(false);
  });
});

describe("createTechnicianBodySchema", () => {
  it("requires name, SA phone, and login email", () => {
    const parsed = createTechnicianBodySchema.parse({
      name: "Thabo Mokoena",
      phone: "082 100 0001",
      email: "Thabo@SparkAndClean.co.za",
      generatePassword: true,
    });
    expect(parsed.email).toBe("thabo@sparkandclean.co.za");
    expect(parsed.name).toBe("Thabo Mokoena");
  });

  it("rejects invalid SA phone numbers", () => {
    const result = createTechnicianBodySchema.safeParse({
      name: "Thabo Mokoena",
      phone: "123",
      email: "thabo@sparkandclean.co.za",
      generatePassword: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing credential when generatePassword is false", () => {
    const result = createTechnicianBodySchema.safeParse({
      name: "Thabo Mokoena",
      phone: "082 123 4567",
      email: "thabo@sparkandclean.co.za",
      generatePassword: false,
    });
    expect(result.success).toBe(false);
  });
});

describe("shouldGenerateTechnicianPassword", () => {
  it("generates when no password is provided", () => {
    expect(shouldGenerateTechnicianPassword({})).toBe(true);
    expect(shouldGenerateTechnicianPassword({ generatePassword: true })).toBe(
      true
    );
    expect(
      shouldGenerateTechnicianPassword({ password: "Password123!" })
    ).toBe(false);
  });
});

describe("generateTemporaryPassword", () => {
  it("returns a unique-enough credential of usable length", () => {
    const a = generateTemporaryPassword();
    const b = generateTemporaryPassword();
    expect(a.length).toBeGreaterThanOrEqual(8);
    expect(b).not.toBe(a);
  });
});

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkFiles(full));
    else out.push(full.replace(/\\/g, "/"));
  }
  return out;
}

describe("no public technician signup", () => {
  it("has no /tech/signup, /register/driver, or technician role picker on signup", () => {
    const appDir = path.resolve(__dirname, "../app");
    const files = walkFiles(appDir);
    const forbidden = files.filter(
      (f) =>
        /\/app\/tech\/signup\//.test(f) ||
        /\/app\/register\/driver\//.test(f) ||
        /\/app\/tech\/register\//.test(f)
    );
    expect(forbidden).toEqual([]);
  });
});
