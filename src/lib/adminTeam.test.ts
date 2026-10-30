import { describe, expect, it } from "vitest";
import {
  ADMIN_EMAIL_TAKEN_ERROR,
  LAST_FULL_DEACTIVATE_ERROR,
  LAST_FULL_DOWNGRADE_ERROR,
  ROLE_CONFLICT_ERROR,
  SELF_DEACTIVATE_ERROR,
  SELF_DOWNGRADE_ERROR,
  adminAccountIsActive,
  emailTakenMessage,
  guardAdminTeamChange,
  otherActiveFullAdminFilter,
  toAdminTeamMember,
} from "@/lib/adminTeam";

const actor = "507f1f77bcf86cd799439011";
const other = "507f1f77bcf86cd799439012";

describe("admin team guards", () => {
  it("treats disabledAt and isActive false as inactive", () => {
    expect(adminAccountIsActive({ disabledAt: null, isActive: true })).toBe(true);
    expect(adminAccountIsActive({ disabledAt: null })).toBe(true);
    expect(adminAccountIsActive({ disabledAt: new Date(), isActive: true })).toBe(
      false
    );
    expect(adminAccountIsActive({ disabledAt: null, isActive: false })).toBe(
      false
    );
  });

  it("refuses an email that already belongs to a client or technician", () => {
    expect(emailTakenMessage("client")).toBe(ROLE_CONFLICT_ERROR);
    expect(emailTakenMessage("CUSTOMER")).toBe(ROLE_CONFLICT_ERROR);
    expect(emailTakenMessage("technician")).toBe(ROLE_CONFLICT_ERROR);
    expect(emailTakenMessage("DRIVER")).toBe(ROLE_CONFLICT_ERROR);
    expect(emailTakenMessage("admin")).toBe(ADMIN_EMAIL_TAKEN_ERROR);
  });

  it("hides password fields when listing an admin", () => {
    const row = toAdminTeamMember({
      _id: { toString: () => actor },
      name: "Ada Admin",
      email: "ada@example.com",
      adminTier: "marketing-only",
      disabledAt: null,
      isActive: true,
    });
    expect(row).toEqual({
      id: actor,
      name: "Ada Admin",
      email: "ada@example.com",
      adminTier: "marketing-only",
      active: true,
    });
    expect(row && "passwordHash" in row).toBe(false);
  });

  it("blocks deactivating or downgrading the last active full admin", () => {
    expect(
      guardAdminTeamChange({
        actorId: actor,
        targetId: actor,
        currentTier: "full",
        currentActive: true,
        nextTier: "full",
        nextActive: false,
        otherActiveFullAdmins: 0,
      })
    ).toBe(LAST_FULL_DEACTIVATE_ERROR);

    expect(
      guardAdminTeamChange({
        actorId: actor,
        targetId: actor,
        currentTier: "full",
        currentActive: true,
        nextTier: "marketing-only",
        nextActive: true,
        otherActiveFullAdmins: 0,
      })
    ).toBe(LAST_FULL_DOWNGRADE_ERROR);
  });

  it("blocks an admin from deactivating or downgrading themselves when another full admin remains", () => {
    expect(
      guardAdminTeamChange({
        actorId: actor,
        targetId: actor,
        currentTier: "full",
        currentActive: true,
        nextTier: "full",
        nextActive: false,
        otherActiveFullAdmins: 1,
      })
    ).toBe(SELF_DEACTIVATE_ERROR);

    expect(
      guardAdminTeamChange({
        actorId: actor,
        targetId: actor,
        currentTier: "full",
        currentActive: true,
        nextTier: "marketing-only",
        nextActive: true,
        otherActiveFullAdmins: 1,
      })
    ).toBe(SELF_DOWNGRADE_ERROR);
  });

  it("allows deactivating another admin when one full admin stays active", () => {
    expect(
      guardAdminTeamChange({
        actorId: actor,
        targetId: other,
        currentTier: "full",
        currentActive: true,
        nextTier: "full",
        nextActive: false,
        otherActiveFullAdmins: 1,
      })
    ).toBeNull();

    expect(
      guardAdminTeamChange({
        actorId: actor,
        targetId: other,
        currentTier: "marketing-only",
        currentActive: false,
        nextTier: "marketing-only",
        nextActive: true,
        otherActiveFullAdmins: 1,
      })
    ).toBeNull();
  });

  it("counts other active full admins without the target", () => {
    expect(otherActiveFullAdminFilter(other)).toEqual({
      _id: { $ne: other },
      role: { $in: ["admin", "ADMIN"] },
      adminTier: "full",
      disabledAt: null,
      isActive: { $ne: false },
    });
  });
});
