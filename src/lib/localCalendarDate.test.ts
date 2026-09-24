import { describe, expect, it } from "vitest";
import {
  APP_TIMEZONE,
  bookingCalendarDate,
  calendarDateInTimeZone,
  isBookingOnLocalDay,
  localCalendarDate,
} from "@/lib/localCalendarDate";

describe("calendarDateInTimeZone", () => {
  it("uses Africa/Johannesburg (UTC+2) for Date values", () => {
    // 21:30 UTC on 13 Sep → 23:30 SAST still 13 Sep
    expect(
      calendarDateInTimeZone(
        new Date("2026-09-13T21:30:00.000Z"),
        APP_TIMEZONE
      )
    ).toBe("2026-09-13");

    // 22:30 UTC on 13 Sep → 00:30 SAST on 14 Sep
    expect(
      calendarDateInTimeZone(
        new Date("2026-09-13T22:30:00.000Z"),
        APP_TIMEZONE
      )
    ).toBe("2026-09-14");
  });

  it("accepts ISO strings and maps at a UTC day boundary", () => {
    expect(
      calendarDateInTimeZone("2026-09-16T22:30:00.000Z", "Africa/Johannesburg")
    ).toBe("2026-09-17");
  });

  it("returns date-only yyyy-MM-dd strings unchanged", () => {
    expect(calendarDateInTimeZone("2026-09-16", APP_TIMEZONE)).toBe(
      "2026-09-16"
    );
  });
});

describe("localCalendarDate", () => {
  it("returns yyyy-MM-dd in South Africa", () => {
    expect(localCalendarDate(new Date("2026-09-14T10:00:00.000Z"))).toBe(
      "2026-09-14"
    );
  });
});

describe("bookingCalendarDate", () => {
  it("keeps a date-only yyyy-MM-dd string as that calendar day", () => {
    expect(bookingCalendarDate("2026-09-14")).toBe("2026-09-14");
  });

  it("maps ISO timestamps to the SA calendar day", () => {
    expect(bookingCalendarDate("2026-09-13T22:30:00.000Z")).toBe("2026-09-14");
  });
});

describe("isBookingOnLocalDay", () => {
  it("matches SA calendar day for an evening UTC instant", () => {
    expect(isBookingOnLocalDay("2026-09-13T22:30:00.000Z", "2026-09-14")).toBe(
      true
    );
    expect(isBookingOnLocalDay("2026-09-13T22:30:00.000Z", "2026-09-13")).toBe(
      false
    );
  });
});
