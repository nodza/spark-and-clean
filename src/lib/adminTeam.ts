import { accountIsDisabled } from "@/lib/adminAuth";
import { normalizeUserRole, type AdminTier } from "@/types/user";

export const SELF_DEACTIVATE_ERROR =
  "You cannot deactivate your own account.";
export const SELF_DOWNGRADE_ERROR = "You cannot change your own tier.";
export const LAST_FULL_DEACTIVATE_ERROR =
  "The last full admin cannot be deactivated.";
export const LAST_FULL_DOWNGRADE_ERROR =
  "The last full admin cannot be downgraded.";
export const ROLE_CONFLICT_ERROR =
  "This email already belongs to a client or technician.";
export const ADMIN_EMAIL_TAKEN_ERROR =
  "An admin with this email already exists.";

export type AdminTeamMember = {
  id: string;
  name: string;
  email: string;
  adminTier: AdminTier;
  active: boolean;
};

/** Login-capable admin: not disabled, and the legacy isActive flag is not false. */
export function adminAccountIsActive(user: {
  disabledAt?: Date | string | null;
  isActive?: boolean | null;
}): boolean {
  if (accountIsDisabled({ disabledAt: user.disabledAt })) return false;
  if (user.isActive === false) return false;
  return true;
}

/**
 * Active full admins other than the account being changed.
 * `disabledAt: null` also matches a missing field.
 */
export function otherActiveFullAdminFilter(targetId: string) {
  return {
    _id: { $ne: targetId },
    role: { $in: ["admin", "ADMIN"] },
    adminTier: "full" as const,
    disabledAt: null,
    isActive: { $ne: false },
  };
}

export function toAdminTeamMember(doc: {
  _id: { toString(): string };
  name?: unknown;
  email?: unknown;
  adminTier?: unknown;
  disabledAt?: Date | string | null;
  isActive?: boolean | null;
}): AdminTeamMember | null {
  if (doc.adminTier !== "full" && doc.adminTier !== "marketing-only") {
    return null;
  }
  return {
    id: String(doc._id),
    name: typeof doc.name === "string" ? doc.name : "",
    email: typeof doc.email === "string" ? doc.email : "",
    adminTier: doc.adminTier,
    active: adminAccountIsActive(doc),
  };
}

/** Refusal copy when the email is already a user. One role per account. */
export function emailTakenMessage(role: unknown): string {
  if (normalizeUserRole(role) === "admin") return ADMIN_EMAIL_TAKEN_ERROR;
  return ROLE_CONFLICT_ERROR;
}

/**
 * Returns an error message when the change is forbidden, or null when it is allowed.
 * `otherActiveFullAdmins` excludes the target.
 * The last active full admin is refused before the self-check, so the sole
 * full admin hears that they are the last one.
 */
export function guardAdminTeamChange(input: {
  actorId: string;
  targetId: string;
  currentTier: AdminTier;
  currentActive: boolean;
  nextTier: AdminTier;
  nextActive: boolean;
  otherActiveFullAdmins: number;
}): string | null {
  if (
    input.nextTier === input.currentTier &&
    input.nextActive === input.currentActive
  ) {
    return null;
  }

  const nextIsActiveFull = input.nextActive && input.nextTier === "full";
  const remainingActiveFull =
    input.otherActiveFullAdmins + (nextIsActiveFull ? 1 : 0);

  if (input.currentTier === "full" && remainingActiveFull < 1) {
    if (input.currentActive && !input.nextActive) {
      return LAST_FULL_DEACTIVATE_ERROR;
    }
    if (input.nextTier !== "full") {
      return LAST_FULL_DOWNGRADE_ERROR;
    }
    return LAST_FULL_DEACTIVATE_ERROR;
  }

  const self = input.actorId === input.targetId;
  if (self && input.currentActive && !input.nextActive) {
    return SELF_DEACTIVATE_ERROR;
  }
  if (self && input.currentTier === "full" && input.nextTier !== "full") {
    return SELF_DOWNGRADE_ERROR;
  }

  return null;
}
