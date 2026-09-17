/**
 * Product calendar days use South Africa Standard Time (no DST).
 * Booking `yyyy-MM-dd` values are treated as calendar days, not UTC midnights.
 */
export const APP_TIMEZONE = "Africa/Johannesburg";

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Calendar `yyyy-MM-dd` for a Date in the given IANA zone (default: SA). */
export function calendarDateInTimeZone(
  date: Date = new Date(),
  timeZone: string = APP_TIMEZONE
): string {
  const parts = new Intl.DateTimeFormat("en-ZA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  if (year && month && day) return `${year}-${month}-${day}`;

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Today as `yyyy-MM-dd` in South Africa. */
export function localCalendarDate(date: Date = new Date()): string {
  return calendarDateInTimeZone(date, APP_TIMEZONE);
}

/** Booking collection calendar day in South Africa. */
export function bookingCalendarDate(collectionDate: string): string | null {
  const prefix = collectionDate.slice(0, 10);
  const isDatePrefix = /^\d{4}-\d{2}-\d{2}$/.test(prefix);

  // Date-only values are calendar days (dispatch intent), not UTC midnights.
  if (isDatePrefix && collectionDate.length === 10) {
    return prefix;
  }

  const parsed = new Date(collectionDate);
  if (!Number.isNaN(parsed.getTime())) {
    return calendarDateInTimeZone(parsed, APP_TIMEZONE);
  }

  return isDatePrefix ? prefix : null;
}

export function isBookingOnLocalDay(
  collectionDate: string,
  day: string
): boolean {
  return bookingCalendarDate(collectionDate) === day;
}
