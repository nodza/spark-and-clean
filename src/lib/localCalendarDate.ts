import { format } from "date-fns";

/**
 * Product calendar days use South Africa Standard Time (no DST).
 * Booking `yyyy-MM-dd` values are treated as calendar days, not UTC midnights.
 */
export const APP_TIMEZONE = "Africa/Johannesburg";

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatDateInTimeZone(date: Date, timeZone: string): string {
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

/**
 * Calendar `yyyy-MM-dd` for a Date or ISO/date string in the given IANA zone
 * (default: South Africa). Date-only `yyyy-MM-dd` strings are returned as-is.
 */
export function calendarDateInTimeZone(
  value: Date | string = new Date(),
  timeZone: string = APP_TIMEZONE
): string | null {
  if (typeof value === "string") {
    if (!value.trim()) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return formatDateInTimeZone(parsed, timeZone);
  }

  if (Number.isNaN(value.getTime())) return null;
  return formatDateInTimeZone(value, timeZone);
}

/** Today as `yyyy-MM-dd` in South Africa. */
export function localCalendarDate(date: Date = new Date()): string {
  return (
    calendarDateInTimeZone(date, APP_TIMEZONE) ??
    formatDateInTimeZone(date, APP_TIMEZONE)
  );
}

/** Alias used by technician Today filtering (same zone as localCalendarDate). */
export function johannesburgCalendarDate(date: Date = new Date()): string {
  return localCalendarDate(date);
}

/**
 * Local civil date from a DatePicker / Calendar selection.
 * Do not use `toISOString()` — that shifts the calendar day in UTC+2.
 */
export function toCalendarDateString(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Booking collection calendar day in South Africa. */
export function bookingCalendarDate(collectionDate: string): string | null {
  const trimmed = collectionDate.trim();
  if (!trimmed) return null;

  // Pure date-only values are calendar days (dispatch intent), not UTC midnights.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Full ISO timestamps: use Africa/Johannesburg, never the UTC date prefix.
  // (`2026-10-01T22:00:00.000Z` is 2 Oct in SA — slicing to 2026-10-01 is wrong.)
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return calendarDateInTimeZone(parsed, APP_TIMEZONE);
  }

  const prefix = trimmed.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(prefix) ? prefix : null;
}

/**
 * Local Date at noon for a booking calendar day (safe for date-fns / Calendar UI).
 */
export function bookingCalendarDateLocal(collectionDate: string): Date | null {
  const day = bookingCalendarDate(collectionDate);
  if (!day) return null;
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return null;
  return new Date(year, month - 1, date, 12, 0, 0, 0);
}

export function isBookingOnLocalDay(
  collectionDate: string,
  day: string
): boolean {
  return bookingCalendarDate(collectionDate) === day;
}

/**
 * Format a booking collection day with date-fns.
 * Never falls back to raw `new Date(iso)` (UTC prefix / off-by-one).
 */
export function formatBookingCollection(
  collectionDate: string,
  pattern: string,
  fallback: string = collectionDate
): string {
  const local = bookingCalendarDateLocal(collectionDate);
  if (!local) return fallback;
  return format(local, pattern);
}
