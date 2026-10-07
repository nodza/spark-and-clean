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

export function normalizeTagCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isActiveRugJobStatus(status: unknown): boolean {
  return (
    typeof status === "string" &&
    (ACTIVE_RUG_JOB_STATUSES as readonly string[]).includes(status)
  );
}

/**
 * Reject linking when the asset is IN_CARE on another non-delivered job.
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
