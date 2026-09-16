import { format } from "date-fns";

/** Local calendar day as `yyyy-MM-dd` (not UTC). */
export function localCalendarDate(date: Date = new Date()): string {
  return format(date, "yyyy-MM-dd");
}

/** Booking collection calendar day in the local timezone. */
export function bookingCalendarDate(collectionDate: string): string | null {
  const prefix = collectionDate.slice(0, 10);
  const isDatePrefix = /^\d{4}-\d{2}-\d{2}$/.test(prefix);

  // Date-only values are calendar days, not UTC midnights.
  if (isDatePrefix && collectionDate.length === 10) {
    return prefix;
  }

  const parsed = new Date(collectionDate);
  if (!Number.isNaN(parsed.getTime())) {
    return format(parsed, "yyyy-MM-dd");
  }

  return isDatePrefix ? prefix : null;
}

export function isBookingOnLocalDay(
  collectionDate: string,
  day: string
): boolean {
  return bookingCalendarDate(collectionDate) === day;
}
