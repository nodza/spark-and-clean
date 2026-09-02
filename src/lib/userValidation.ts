import { z } from "zod";
import {
  ADMIN_TIERS,
  USER_ROLES,
  type AdminTier,
  type UserRole,
} from "@/types/user";

export type RoleTierInput = {
  role: UserRole;
  adminTier?: AdminTier | null;
};

/**
 * Pure invariants (unit-tested):
 * - exactly one role from USER_ROLES
 * - admin ⇒ adminTier required
 * - non-admin ⇒ adminTier must be null/undefined
 */
export function assertRoleTierInvariants(input: RoleTierInput): {
  role: UserRole;
  adminTier: AdminTier | null;
} {
  const role = input.role;
  if (!(USER_ROLES as readonly string[]).includes(role)) {
    throw new Error(`Invalid role: ${String(role)}`);
  }

  if (role === "admin") {
    if (
      input.adminTier == null ||
      !(ADMIN_TIERS as readonly string[]).includes(input.adminTier)
    ) {
      throw new Error(
        "Admin users require adminTier of 'full' or 'marketing-only'"
      );
    }
    return { role, adminTier: input.adminTier };
  }

  if (input.adminTier != null) {
    throw new Error("Non-admin users cannot have an adminTier");
  }

  return { role, adminTier: null };
}

export function isValidRoleTier(input: RoleTierInput): boolean {
  try {
    assertRoleTierInvariants(input);
    return true;
  } catch {
    return false;
  }
}

export const createUserSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z.string().trim().email().transform((e) => e.toLowerCase()),
    phone: z.string().trim().optional(),
    passwordHash: z.string().min(1).optional(),
    role: z.enum(USER_ROLES),
    adminTier: z.enum(ADMIN_TIERS).nullable().optional(),
    emailVerifiedAt: z.coerce.date().nullable().optional(),
    disabledAt: z.coerce.date().nullable().optional(),
    driverProfileId: z.string().trim().optional(),
  })
  .superRefine((val, ctx) => {
    try {
      assertRoleTierInvariants({
        role: val.role,
        adminTier: val.adminTier ?? null,
      });
    } catch (err) {
      ctx.addIssue({
        code: "custom",
        message: err instanceof Error ? err.message : "Invalid role/tier",
        path: ["adminTier"],
      });
    }
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;
