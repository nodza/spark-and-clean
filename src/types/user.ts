/**
 * Service areas Spark & Clean operates in.
 * Stored on coupon city scope and user preferredCity.
 * "Gauteng" replaced the legacy stored value "Johannesburg" (still accepted on read).
 * Do not confuse with Africa/Johannesburg — that is the business time zone only.
 */
export const SERVICE_CITIES = ["Gauteng", "Cape Town"] as const;
export type ServiceCity = (typeof SERVICE_CITIES)[number];

/** Legacy DB value — keep in Mongoose enums so old rows still load. */
export const LEGACY_SERVICE_CITIES = ["Johannesburg"] as const;

/** Enum values allowed on User/Coupon documents (canonical + legacy). */
export const SERVICE_CITY_SCHEMA_ENUM = [
  ...SERVICE_CITIES,
  ...LEGACY_SERVICE_CITIES,
] as const;

/**
 * Map a stored or typed city to a canonical service area.
 * Johannesburg / JHB aliases become Gauteng. Cape Town unchanged.
 */
export function normalizeServiceCity(value: unknown): ServiceCity | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const key = trimmed.toLowerCase().replace(/\s+/g, " ");
  if (
    key === "gauteng" ||
    key === "johannesburg" ||
    key === "jhb" ||
    key === "joburg" ||
    key === "city of johannesburg"
  ) {
    return "Gauteng";
  }
  if (
    key === "cape town" ||
    key === "cpt" ||
    key === "city of cape town"
  ) {
    return "Cape Town";
  }
  return null;
}

/** Customer/admin label: legacy Johannesburg → Gauteng; other towns unchanged. */
export function formatServiceAreaLabel(city: string): string {
  return normalizeServiceCity(city) ?? city.trim();
}

/**
 * Exactly one role per user (no roles[] / join table).
 * Ticket F6.x / E4 foundation — do not add multi-role support here.
 */
export const USER_ROLES = ["client", "technician", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Required when role === "admin"; otherwise must be null */
export const ADMIN_TIERS = ["full", "marketing-only"] as const;
export type AdminTier = (typeof ADMIN_TIERS)[number];

/** Legacy DB / JWT values — normalize on read */
const LEGACY_ROLE_MAP: Record<string, UserRole> = {
  CUSTOMER: "client",
  DRIVER: "technician",
  ADMIN: "admin",
  client: "client",
  technician: "technician",
  admin: "admin",
};

export function normalizeUserRole(role: unknown): UserRole {
  if (typeof role !== "string") return "client";
  return LEGACY_ROLE_MAP[role] ?? "client";
}

export function isAdminRole(role: unknown): boolean {
  return normalizeUserRole(role) === "admin";
}

export function isClientRole(role: unknown): boolean {
  return normalizeUserRole(role) === "client";
}

export function isTechnicianRole(role: unknown): boolean {
  return normalizeUserRole(role) === "technician";
}

/** True password account — leftover guest JWTs are treated as logged out. */
export function isFullAccount<T extends { guest?: boolean; id?: string }>(
  user: T | null | undefined
): user is NonNullable<T> {
  if (!user) return false;
  if (user.guest) return false;
  if (typeof user.id === "string" && user.id.startsWith("guest:")) return false;
  return true;
}

/** Full password client — not a leftover guest JWT. */
export function isPersistedClient(user: {
  role?: unknown;
  guest?: boolean;
  id?: string;
} | null | undefined): boolean {
  return isFullAccount(user) && isClientRole(user.role);
}

/**
 * Client-facing user shape (API / UI). Never includes passwordHash.
 */
export interface AppUser {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  role: UserRole;
  /** Present only for admins */
  adminTier: AdminTier | null;
  preferredCity?: ServiceCity;
  marketingOptIn: boolean;
  emailVerifiedAt: string | null;
  disabledAt: string | null;
  mustChangePassword?: boolean;
  /** @deprecated prefer emailVerifiedAt */
  emailVerified?: boolean;
  /** @deprecated prefer disabledAt === null for active */
  isActive?: boolean;
  loyalty: {
    punches: number;
    rewardsRedeemed: number;
  };
  /** Stable share code. Present for clients after the first portal view or signup. */
  referralCode?: string;
  /** Technician link to Driver profile (`drivers.id`); current bakkie is Vehicle.assignedDriverId */
  driverProfileId?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}
