import { accountIsDisabled } from "@/lib/adminAuth";

/** A driver is assignable only if both the profile and the login (when present) are active. */
export function isAssignableDriverPair(
  driver: { isActive?: boolean } | null | undefined,
  tech: { disabledAt?: Date | string | null; isActive?: boolean } | null | undefined
): boolean {
  if (!driver && !tech) return false;
  if (driver && driver.isActive === false) return false;
  if (tech && accountIsDisabled(tech)) return false;
  return true;
}
