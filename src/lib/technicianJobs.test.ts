import { describe, expect, it } from "vitest";
import {
  countTechnicianJobsOnDay,
  technicianDoneToday,
  technicianJobsOnDay,
  technicianTodayStops,
  technicianUpcomingJobs,
} from "@/lib/technicianJobs";
import type { Booking } from "@/types/booking";

const today = "2026-09-16";
const todayIso = new Date(2026, 8, 16, 9, 0, 0).toISOString();
const tomorrowIso = new Date(2026, 8, 17, 9, 0, 0).toISOString();
const laterIso = new Date(2026, 8, 20, 9, 0, 0).toISOString();

function job(
  partial: Partial<
    Pick<
      Booking,
      | "assignedDriverId"
      | "collectionDate"
      | "collectionSlot"
      | "deliveryDate"
      | "deliverySlot"
      | "deliveryDriverId"
      | "status"
      | "updatedAt"
    >
  >
) {
  return {
    assignedDriverId: "driver_1",
    collectionDate: todayIso,
    collectionSlot: "MORNING" as const,
    status: "SCHEDULED" as const,
    ...partial,
  };
}

describe("technician job helpers", () => {
  it("counts only this driver, today, and open statuses", () => {
    const bookings = [
      job({}),
      job({ assignedDriverId: "driver_2" }),
      job({ collectionDate: tomorrowIso }),
      job({ status: "CANCELLED" }),
      job({ status: "DELIVERED" }),
    ];
    expect(countTechnicianJobsOnDay(bookings, "driver_1", today)).toBe(1);
    expect(countTechnicianJobsOnDay(bookings, undefined, today)).toBe(0);
    expect(technicianJobsOnDay(bookings, "driver_1", today)).toHaveLength(1);
  });

  it("lists upcoming jobs after today, sorted by day then slot", () => {
    const bookings = [
      job({ collectionDate: laterIso, collectionSlot: "MORNING" }),
      job({ collectionDate: tomorrowIso, collectionSlot: "AFTERNOON" }),
      job({ collectionDate: tomorrowIso, collectionSlot: "MORNING" }),
      job({}),
    ];
    const upcoming = technicianUpcomingJobs(bookings, "driver_1", today);
    expect(upcoming.map((item) => item.collectionSlot)).toEqual([
      "MORNING",
      "AFTERNOON",
      "MORNING",
    ]);
    expect(upcoming).toHaveLength(3);
  });

  it("shows today's pickups and READY only on the delivery date", () => {
    const jobs = [
      job({ status: "SCHEDULED", collectionSlot: "MORNING" }),
      job({ status: "BOOKED", collectionSlot: "AFTERNOON" }),
      job({
        status: "READY",
        deliveryDate: tomorrowIso,
        deliverySlot: "AFTERNOON",
        collectionSlot: "AFTERNOON",
      }),
      job({
        status: "READY",
        deliveryDate: today,
        deliverySlot: "AFTERNOON",
        collectionDate: tomorrowIso,
      }),
      job({
        status: "READY",
        collectionDate: todayIso,
      }),
      job({ status: "CLEANING", collectionDate: todayIso }),
      job({ status: "SCHEDULED", assignedDriverId: "driver_2" }),
      job({ status: "SCHEDULED", collectionDate: laterIso }),
    ];

    expect(
      technicianTodayStops(jobs, "driver_1", today).map((item) => item.status)
    ).toEqual(["SCHEDULED", "BOOKED", "READY"]);
  });

  it("puts a READY delivery on tomorrow's list, not today's", () => {
    const tomorrow = "2026-09-17";
    const readyTomorrow = job({
      status: "READY",
      deliveryDate: tomorrow,
      deliverySlot: "MORNING",
    });
    expect(technicianTodayStops([readyTomorrow], "driver_1", today)).toEqual([]);
    expect(
      technicianTodayStops([readyTomorrow], "driver_1", tomorrow).map(
        (item) => item.status
      )
    ).toEqual(["READY"]);
  });

  it("puts delivered jobs updated today in Done", () => {
    const jobs = [
      job({ status: "DELIVERED", updatedAt: `${today}T12:00:00.000Z` }),
      job({ status: "DELIVERED", updatedAt: `${tomorrowIso}` }),
      job({ status: "READY", deliveryDate: today, deliverySlot: "MORNING" }),
    ];

    expect(technicianDoneToday(jobs, "driver_1", today)).toHaveLength(1);
  });
});
