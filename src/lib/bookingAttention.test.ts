import { describe, expect, it } from "vitest";
import {
  isActionableUnassignedToday,
  isExcludedFromUnassignedQueue,
  isUnassignedDriver,
} from "@/lib/bookingAttention";
import type { Booking } from "@/types/booking";

const today = "2026-09-14";
const todayIso = new Date(2026, 8, 14, 9, 0, 0).toISOString();
const yesterdayIso = new Date(2026, 8, 13, 9, 0, 0).toISOString();

function booking(
  partial: Partial<Pick<Booking, "collectionDate" | "assignedDriverId" | "status">>
) {
  return {
    collectionDate: todayIso,
    assignedDriverId: undefined as string | undefined,
    status: "BOOKED" as const,
    ...partial,
  };
}

describe("isUnassignedDriver", () => {
  it("treats missing and empty ids as unassigned", () => {
    expect(isUnassignedDriver(undefined)).toBe(true);
    expect(isUnassignedDriver("")).toBe(true);
    expect(isUnassignedDriver("driver_1")).toBe(false);
  });
});

describe("isActionableUnassignedToday", () => {
  it("counts unassigned work for today", () => {
    expect(isActionableUnassignedToday(booking({}), today)).toBe(true);
  });

  it("excludes other days, assigned jobs, cancelled, and delivered", () => {
    expect(
      isActionableUnassignedToday(booking({ collectionDate: yesterdayIso }), today)
    ).toBe(false);
    expect(
      isActionableUnassignedToday(booking({ assignedDriverId: "driver_1" }), today)
    ).toBe(false);
    expect(
      isActionableUnassignedToday(booking({ status: "CANCELLED" }), today)
    ).toBe(false);
    expect(
      isActionableUnassignedToday(booking({ status: "DELIVERED" }), today)
    ).toBe(false);
  });
});

describe("isExcludedFromUnassignedQueue", () => {
  it("matches the dashboard exclusions", () => {
    expect(isExcludedFromUnassignedQueue("CANCELLED")).toBe(true);
    expect(isExcludedFromUnassignedQueue("DELIVERED")).toBe(true);
    expect(isExcludedFromUnassignedQueue("BOOKED")).toBe(false);
  });
});
