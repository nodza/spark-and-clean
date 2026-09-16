import type { Booking, BookingStatus } from "@/types/booking";
import { isExcludedFromUnassignedQueue } from "@/lib/bookingAttention";
import {
  bookingCalendarDate,
  isBookingOnLocalDay,
} from "@/lib/localCalendarDate";

type Job = Pick<
  Booking,
  "assignedDriverId" | "collectionDate" | "collectionSlot" | "status"
>;

function isAssignedOpenJob(job: Job, driverProfileId: string): boolean {
  return (
    job.assignedDriverId === driverProfileId &&
    !isExcludedFromUnassignedQueue(job.status as BookingStatus)
  );
}

export function countTechnicianJobsOnDay(
  bookings: Job[],
  driverProfileId: string | undefined,
  day: string
): number {
  if (!driverProfileId) return 0;
  return bookings.filter(
    (job) =>
      isAssignedOpenJob(job, driverProfileId) &&
      isBookingOnLocalDay(job.collectionDate, day)
  ).length;
}

export function technicianJobsOnDay<T extends Job>(
  bookings: T[],
  driverProfileId: string | undefined,
  day: string
): T[] {
  if (!driverProfileId) return [];
  return bookings.filter(
    (job) =>
      isAssignedOpenJob(job, driverProfileId) &&
      isBookingOnLocalDay(job.collectionDate, day)
  );
}

const SLOT_ORDER = { MORNING: 0, AFTERNOON: 1 } as const;

export function technicianUpcomingJobs<T extends Job>(
  bookings: T[],
  driverProfileId: string | undefined,
  today: string
): T[] {
  if (!driverProfileId) return [];
  return bookings
    .filter((job) => {
      if (!isAssignedOpenJob(job, driverProfileId)) return false;
      const day = bookingCalendarDate(job.collectionDate);
      return day != null && day > today;
    })
    .sort((a, b) => {
      const dayA = bookingCalendarDate(a.collectionDate) ?? "";
      const dayB = bookingCalendarDate(b.collectionDate) ?? "";
      if (dayA !== dayB) return dayA.localeCompare(dayB);
      return SLOT_ORDER[a.collectionSlot] - SLOT_ORDER[b.collectionSlot];
    });
}
