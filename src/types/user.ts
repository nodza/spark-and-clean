/** Service cities Spark & Clean operates in */
export const SERVICE_CITIES = ["Johannesburg", "Cape Town"] as const;
export type ServiceCity = (typeof SERVICE_CITIES)[number];

/** App roles — customers book; admins run ops; drivers run the tech app */
export const USER_ROLES = ["CUSTOMER", "ADMIN", "DRIVER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Client-facing user shape (API / UI). Maps to the Mongoose User model.
 */
export interface AppUser {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  role: UserRole;
  preferredCity?: ServiceCity;
  marketingOptIn: boolean;
  emailVerified: boolean;
  isActive: boolean;
  loyalty: {
    punches: number;
    rewardsRedeemed: number;
  };
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}
