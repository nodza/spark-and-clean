import type { Booking, BookingStatus } from "@/types/booking";
import { isBookingOnLocalDay, localCalendarDate } from "@/lib/localCalendarDate";

const UNASSIGNED_TODAY_EXCLUDED: BookingStatus[] = ["CANCELLED", "DELIVERED"];

export function isUnassignedDriver(assignedDriverId?: string | null): boolean {
  return !assignedDriverId;
}

/** Same rule as Needs Attention “unassigned today” and Assign list filters. */
export function isActionableUnassignedToday(
  booking: Pick<Booking, "collectionDate" | "assignedDriverId" | "status">,
  today: string = localCalendarDate()
): boolean {
  if (!isBookingOnLocalDay(booking.collectionDate, today)) return false;
  if (!isUnassignedDriver(booking.assignedDriverId)) return false;
  return !UNASSIGNED_TODAY_EXCLUDED.includes(booking.status);
}

export function isExcludedFromUnassignedQueue(status: BookingStatus): boolean {
  return UNASSIGNED_TODAY_EXCLUDED.includes(status);
}
