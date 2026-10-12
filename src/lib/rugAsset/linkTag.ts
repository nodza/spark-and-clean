import type { BookingStatus } from "@/types/booking";

/** Tag format shared with intake and admin lookup. */
export const RUG_TAG_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,63}$/;

/**
 * Booking statuses that mean the rug is still in an active job.
 * Linking the same tag onto another booking while one of these is open is rejected.
 */
export const ACTIVE_RUG_JOB_STATUSES: readonly BookingStatus[] = [
  "BOOKED",
  "SCHEDULED",
  "COLLECTED",
  "CLEANING",
  "DRYING",
  "READY",
] as const;

/** A repeat-clean link can only land on a job that has not been collected yet. */
export const LINKABLE_TARGET_STATUSES: readonly BookingStatus[] = [
  "BOOKED",
  "SCHEDULED",
] as const;

export type RugCustomerRef = {
  userId?: unknown;
  email?: unknown;
};

export function normalizeTagCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isActiveRugJobStatus(status: unknown): boolean {
  return (
    typeof status === "string" &&
    (ACTIVE_RUG_JOB_STATUSES as readonly string[]).includes(status)
  );
}

export function isLinkableTargetStatus(status: unknown): boolean {
  return (
    typeof status === "string" &&
    (LINKABLE_TARGET_STATUSES as readonly string[]).includes(status)
  );
}

/**
 * Same account when both bookings have a user id.
 * Guest jobs (no user id) match on customer email.
 */
export function sameRugCustomer(left: RugCustomerRef, right: RugCustomerRef): boolean {
  const leftId = customerId(left.userId);
  const rightId = customerId(right.userId);
  if (leftId && rightId) return leftId === rightId;
  const leftEmail = customerEmail(left.email);
  const rightEmail = customerEmail(right.email);
  return Boolean(leftEmail && leftEmail === rightEmail);
}

function customerId(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function customerEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * Reject linking when the asset is IN_CARE on another open job (BOOKED through READY).
 * DELIVERED / CANCELLED (or a missing/stale current booking) do not block.
 */
export function inCareLinkConflict(input: {
  assetStatus: string;
  assetCurrentBookingId: string | null | undefined;
  targetBookingId: string;
  currentBookingStatus: unknown;
}): string | null {
  const currentId = input.assetCurrentBookingId?.trim() || "";
  if (!currentId || currentId === input.targetBookingId) return null;
  if (input.assetStatus !== "IN_CARE") return null;
  if (!isActiveRugJobStatus(input.currentBookingStatus)) return null;
  return (
    `This tag is IN_CARE on active booking ${currentId}. ` +
    "Finish or cancel that job before linking it to another booking."
  );
}
