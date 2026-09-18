import { format } from "date-fns";

/** Local calendar day as `yyyy-MM-dd` (not UTC). */
export function localCalendarDate(date: Date = new Date()): string {
  return format(date, "yyyy-MM-dd");
}

export function calendarDateInTimeZone(
  value: Date | string,
  timeZone: string
): string | null {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function johannesburgCalendarDate(date: Date = new Date()): string {
  return calendarDateInTimeZone(date, "Africa/Johannesburg") ?? localCalendarDate(date);
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
