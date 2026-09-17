export const BUSINESS_TIMEZONE = "Africa/Johannesburg";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Calendar day as `yyyy-MM-dd` in Africa/Johannesburg. */
export function johannesburgCalendarDate(date: Date = new Date()): string {
  return calendarDateInTimeZone(date, BUSINESS_TIMEZONE);
}

export function calendarDateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

/** Booking collection calendar day in Africa/Johannesburg. */
export function bookingCalendarDateInJohannesburg(
  collectionDate: string
): string | null {
  const prefix = collectionDate.slice(0, 10);
  const isDatePrefix = DATE_ONLY.test(prefix);

  if (isDatePrefix && collectionDate.length === 10) {
    return prefix;
  }

  const parsed = new Date(collectionDate);
  if (!Number.isNaN(parsed.getTime())) {
    return johannesburgCalendarDate(parsed);
  }

  return isDatePrefix ? prefix : null;
}

export function isBookingOnJohannesburgDay(
  collectionDate: string,
  day: string
): boolean {
  return bookingCalendarDateInJohannesburg(collectionDate) === day;
}

export function isValidCalendarDate(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}
