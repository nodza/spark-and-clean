import { describe, expect, it } from "vitest";
import { canAccessFieldThread } from "@/lib/fieldMessageAuth";
import type { SessionUser } from "@/lib/sessionJwt";

function session(partial: Partial<SessionUser>): SessionUser {
  return {
    id: "user_1",
    email: "user@example.com",
    role: "technician",
    ...partial,
  } as SessionUser;
}

describe("canAccessFieldThread", () => {
  it("allows full admin on any assignment", () => {
    expect(
      canAccessFieldThread(
        session({ role: "admin", adminTier: "full" }),
        "driver_1"
      )
    ).toBe(true);
    expect(
      canAccessFieldThread(
        session({ role: "admin", adminTier: "full" }),
        null
      )
    ).toBe(true);
  });

  it("denies marketing-only admin", () => {
    expect(
      canAccessFieldThread(
        session({ role: "admin", adminTier: "marketing-only" }),
        "driver_1"
      )
    ).toBe(false);
  });

  it("allows Thabo only on Thabo’s assigned job", () => {
    const thabo = session({
      role: "technician",
      driverProfileId: "driver_1",
    });
    expect(canAccessFieldThread(thabo, "driver_1")).toBe(true);
    expect(canAccessFieldThread(thabo, "driver_2")).toBe(false);
    expect(canAccessFieldThread(thabo, null)).toBe(false);
  });

  it("denies Sipho on Thabo’s job", () => {
    const sipho = session({
      role: "technician",
      driverProfileId: "driver_2",
      email: "sipho@sparkandclean.co.za",
    });
    expect(canAccessFieldThread(sipho, "driver_1")).toBe(false);
  });

  it("denies customers", () => {
    expect(
      canAccessFieldThread(
        session({ role: "client", driverProfileId: undefined }),
        "driver_1"
      )
    ).toBe(false);
  });
});
