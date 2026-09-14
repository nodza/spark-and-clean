import type { BookingStatus } from "@/types/booking";

/**
 * Assign-driver status rule (admin persist ticket):
 * - First assign from BOOKED → set SCHEDULED
 * - If status is already SCHEDULED or past BOOKED (COLLECTED+), leave status unchanged
 * - Unassign (null) never changes status
 */
export function statusAfterDriverAssign(
  currentStatus: BookingStatus,
  assignedDriverId: string | null
): BookingStatus | undefined {
  if (!assignedDriverId) return undefined;
  if (currentStatus === "BOOKED") return "SCHEDULED";
  return undefined;
}
