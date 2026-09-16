import { describe, expect, it } from "vitest";
import {
  bookingCalendarDate,
  isBookingOnLocalDay,
  localCalendarDate,
} from "@/lib/localCalendarDate";

describe("localCalendarDate", () => {
  it("formats a local Date as yyyy-MM-dd", () => {
    expect(localCalendarDate(new Date(2026, 8, 14, 15, 30, 0))).toBe("2026-09-14");
  });
});

describe("bookingCalendarDate", () => {
  it("uses the local calendar day of an ISO timestamp", () => {
    const localMidnight = new Date(2026, 8, 14, 0, 0, 0);
    expect(bookingCalendarDate(localMidnight.toISOString())).toBe("2026-09-14");
  });

  it("keeps a date-only yyyy-MM-dd string as that calendar day", () => {
    expect(bookingCalendarDate("2026-09-14")).toBe("2026-09-14");
  });
});

describe("isBookingOnLocalDay", () => {
  it("matches a booking whose collection instant falls on that local day", () => {
    const laterThatDay = new Date(2026, 8, 14, 22, 0, 0);
    expect(isBookingOnLocalDay(laterThatDay.toISOString(), "2026-09-14")).toBe(
      true
    );
    expect(isBookingOnLocalDay(laterThatDay.toISOString(), "2026-09-13")).toBe(
      false
    );
  });
});
