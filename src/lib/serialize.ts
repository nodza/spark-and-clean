import type { Booking } from "@/types/booking";
import { normalizeUserRole, type AdminTier } from "@/types/user";

/** Strip Mongo internal fields for client responses */
export function toClientBooking(doc: Record<string, unknown>): Booking {
  const { _id, __v, updatedAt, userId, ...rest } = doc;
  const booking = rest as unknown as Booking;
  if (userId != null) {
    booking.userId = String(userId);
  }
  return booking;
}

export function toClientDriver(doc: Record<string, unknown>) {
  const { _id, __v, createdAt, updatedAt, ...rest } = doc;
  return rest;
}

/** Never includes passwordHash — strips even if select:+passwordHash was used */
export function toClientUser(doc: Record<string, unknown>) {
  const {
    _id,
    __v,
    passwordHash: _passwordHash,
    createdAt,
    updatedAt,
    emailVerifiedAt,
    disabledAt,
    lastLoginAt,
    role,
    adminTier,
    ...rest
  } = doc;

  const normalizedRole = normalizeUserRole(role);
  const tier: AdminTier | null =
    normalizedRole === "admin" &&
    (adminTier === "full" || adminTier === "marketing-only")
      ? adminTier
      : null;

  return {
    id: String(_id),
    ...rest,
    role: normalizedRole,
    adminTier: tier,
    emailVerifiedAt:
      emailVerifiedAt instanceof Date
        ? emailVerifiedAt.toISOString()
        : (emailVerifiedAt as string | null | undefined) ?? null,
    disabledAt:
      disabledAt instanceof Date
        ? disabledAt.toISOString()
        : (disabledAt as string | null | undefined) ?? null,
    lastLoginAt:
      lastLoginAt instanceof Date
        ? lastLoginAt.toISOString()
        : lastLoginAt,
    createdAt:
      createdAt instanceof Date ? createdAt.toISOString() : createdAt,
    updatedAt:
      updatedAt instanceof Date ? updatedAt.toISOString() : updatedAt,
  };
}
