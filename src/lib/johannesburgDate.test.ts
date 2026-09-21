import { describe, expect, it } from "vitest";
import {
  bookingCalendarDateInJohannesburg,
  isBookingOnJohannesburgDay,
  isValidCalendarDate,
  johannesburgCalendarDate,
} from "@/lib/johannesburgDate";

describe("johannesburgCalendarDate", () => {
  it("uses Africa/Johannesburg, not UTC", () => {
    // 22:30 UTC on 16 Sep is 00:30 on 17 Sep in Johannesburg (UTC+2, no DST).
    const instant = new Date("2026-09-16T22:30:00.000Z");
    expect(johannesburgCalendarDate(instant)).toBe("2026-09-17");
  });
});

describe("bookingCalendarDateInJohannesburg", () => {
  it("keeps a date-only string as that calendar day", () => {
    expect(bookingCalendarDateInJohannesburg("2026-09-17")).toBe("2026-09-17");
  });

  it("maps an ISO instant onto the Johannesburg calendar day", () => {
    expect(
      bookingCalendarDateInJohannesburg("2026-09-16T22:30:00.000Z")
    ).toBe("2026-09-17");
  });
});

describe("isBookingOnJohannesburgDay", () => {
  it("matches the Johannesburg calendar day", () => {
    expect(
      isBookingOnJohannesburgDay("2026-09-16T22:30:00.000Z", "2026-09-17")
    ).toBe(true);
    expect(
      isBookingOnJohannesburgDay("2026-09-16T22:30:00.000Z", "2026-09-16")
    ).toBe(false);
  });
});

describe("isValidCalendarDate", () => {
  it("accepts real yyyy-MM-dd values only", () => {
    expect(isValidCalendarDate("2026-09-17")).toBe(true);
    expect(isValidCalendarDate("2026-02-30")).toBe(false);
    expect(isValidCalendarDate("today")).toBe(false);
  });
});
