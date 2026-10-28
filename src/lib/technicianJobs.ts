import type { Booking, BookingStatus } from "@/types/booking";
import { isExcludedFromUnassignedQueue } from "@/lib/bookingAttention";
import {
  effectiveDeliveryDriverId,
  hasDeliverySchedule,
  jobStopDate,
  jobStopSlot,
} from "@/lib/deliverySchedule";
import {
  calendarDateInTimeZone,
  bookingCalendarDate,
  isBookingOnLocalDay,
} from "@/lib/localCalendarDate";

type Job = Pick<
  Booking,
  | "assignedDriverId"
  | "collectionDate"
  | "collectionSlot"
  | "deliveryDate"
  | "deliverySlot"
  | "deliveryDriverId"
  | "status"
  | "updatedAt"
>;

const JOHANNESBURG = "Africa/Johannesburg";
const PICKUP_STATUSES: BookingStatus[] = ["BOOKED", "SCHEDULED"];
const SLOT_ORDER = { MORNING: 0, AFTERNOON: 1 } as const;

function isAssignedOpenJob(job: Job, driverProfileId: string): boolean {
  return (
    job.assignedDriverId === driverProfileId &&
    !isExcludedFromUnassignedQueue(job.status as BookingStatus)
  );
}

function isDeliveryForDriver(job: Job, driverProfileId: string): boolean {
  if (job.status !== "READY") return false;
  if (!hasDeliverySchedule(job)) return false;
  return effectiveDeliveryDriverId(job) === driverProfileId;
}

export function countTechnicianJobsOnDay(
  bookings: Job[],
  driverProfileId: string | undefined,
  day: string
): number {
  if (!driverProfileId) return 0;
  return bookings.filter((job) => {
    if (isDeliveryForDriver(job, driverProfileId)) {
      return isBookingOnLocalDay(job.deliveryDate ?? "", day);
    }
    return (
      isAssignedOpenJob(job, driverProfileId) &&
      isBookingOnLocalDay(job.collectionDate, day)
    );
  }).length;
}

export function technicianJobsOnDay<T extends Job>(
  bookings: T[],
  driverProfileId: string | undefined,
  day: string
): T[] {
  if (!driverProfileId) return [];
  return bookings.filter((job) => {
    if (isDeliveryForDriver(job, driverProfileId)) {
      return isBookingOnLocalDay(job.deliveryDate ?? "", day);
    }
    return (
      isAssignedOpenJob(job, driverProfileId) &&
      isBookingOnLocalDay(job.collectionDate, day)
    );
  });
}

export function technicianUpcomingJobs<T extends Job>(
  bookings: T[],
  driverProfileId: string | undefined,
  today: string
): T[] {
  if (!driverProfileId) return [];
  return bookings
    .filter((job) => {
      if (isDeliveryForDriver(job, driverProfileId)) {
        const day = bookingCalendarDate(job.deliveryDate ?? "");
        return day != null && day > today;
      }
      if (!isAssignedOpenJob(job, driverProfileId)) return false;
      if (job.status === "READY") return false;
      const day = bookingCalendarDate(job.collectionDate);
      return day != null && day > today;
    })
    .sort((a, b) => {
      const dayA = jobStopDate(a) ?? "";
      const dayB = jobStopDate(b) ?? "";
      if (dayA !== dayB) return dayA.localeCompare(dayB);
      return SLOT_ORDER[jobStopSlot(a)] - SLOT_ORDER[jobStopSlot(b)];
    });
}

function sortByStopSlot<T extends Job>(a: T, b: T): number {
  return SLOT_ORDER[jobStopSlot(a)] - SLOT_ORDER[jobStopSlot(b)];
}

/**
 * Today's van stops: pickups on collection day, or READY returns on their
 * scheduled delivery day for this driver. Unscheduled READY never appears.
 */
export function technicianTodayStops<T extends Job>(
  bookings: T[],
  driverProfileId: string | undefined,
  today: string
): T[] {
  if (!driverProfileId) return [];
  return bookings
    .filter((job) => {
      if (job.status === "READY") {
        return (
          isDeliveryForDriver(job, driverProfileId) &&
          calendarDateInTimeZone(job.deliveryDate ?? "", JOHANNESBURG) === today
        );
      }
      return (
        job.assignedDriverId === driverProfileId &&
        PICKUP_STATUSES.includes(job.status as BookingStatus) &&
        calendarDateInTimeZone(job.collectionDate, JOHANNESBURG) === today
      );
    })
    .sort(sortByStopSlot);
}

export function technicianDoneToday<T extends Job>(
  bookings: T[],
  driverProfileId: string | undefined,
  today: string
): T[] {
  if (!driverProfileId) return [];
  return bookings
    .filter(
      (job) =>
        (job.assignedDriverId === driverProfileId ||
          job.deliveryDriverId === driverProfileId) &&
        job.status === "DELIVERED" &&
        calendarDateInTimeZone(job.updatedAt ?? "", JOHANNESBURG) === today
    )
    .sort(sortByStopSlot);
}
