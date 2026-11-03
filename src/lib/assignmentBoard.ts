import { ASSIGNMENT_SLOT_CAPACITY } from "@/config/assignmentBoard";
import { isUnassignedDriver } from "@/lib/bookingAttention";
import {
  effectiveDeliveryDriverId,
  hasDeliverySchedule,
  isDeliveryStop,
} from "@/lib/deliverySchedule";
import { isBookingOnJohannesburgDay } from "@/lib/johannesburgDate";
import type { Booking, BookingStatus } from "@/types/booking";

export const ASSIGNMENT_BOARD_COLLECTION_STATUSES: BookingStatus[] = [
  "BOOKED",
  "SCHEDULED",
];

/** @deprecated Use ASSIGNMENT_BOARD_COLLECTION_STATUSES */
export const ASSIGNMENT_BOARD_STATUSES = ASSIGNMENT_BOARD_COLLECTION_STATUSES;

export const ASSIGNMENT_SLOTS = ["MORNING", "AFTERNOON"] as const;
export type AssignmentSlot = (typeof ASSIGNMENT_SLOTS)[number];

export type AssignmentStopKind = "collection" | "delivery";

export type AssignmentBoardDriver = {
  id: string;
  name: string;
  phone?: string;
};

export type AssignmentBoardJob = Pick<
  Booking,
  | "id"
  | "suburb"
  | "customer"
  | "status"
  | "paymentStatus"
  | "assignedDriverId"
  | "collectionDate"
  | "collectionSlot"
  | "deliveryDate"
  | "deliverySlot"
  | "deliveryDriverId"
> & {
  stopKind: AssignmentStopKind;
  boardSlot: AssignmentSlot;
  boardDriverId?: string;
};

export type AssignmentBoardColumn = {
  key: string;
  driverId: string | null;
  title: string;
  slots: Record<AssignmentSlot, AssignmentBoardJob[]>;
  overCapacity: Record<AssignmentSlot, boolean>;
};

export function isAssignmentBoardStatus(
  status: BookingStatus
): status is "BOOKED" | "SCHEDULED" {
  return ASSIGNMENT_BOARD_COLLECTION_STATUSES.includes(status);
}

export function customerSurname(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] || name.trim();
}

function asBoardSlot(slot: string | undefined): AssignmentSlot {
  return slot === "AFTERNOON" ? "AFTERNOON" : "MORNING";
}

/**
 * Collections on the day plus READY deliveries scheduled for the day.
 */
export function jobsForAssignmentDay<
  T extends Pick<
    Booking,
    | "id"
    | "suburb"
    | "customer"
    | "status"
    | "paymentStatus"
    | "assignedDriverId"
    | "collectionDate"
    | "collectionSlot"
    | "deliveryDate"
    | "deliverySlot"
    | "deliveryDriverId"
  >,
>(bookings: T[], day: string): AssignmentBoardJob[] {
  const stops: AssignmentBoardJob[] = [];

  for (const booking of bookings) {
    if (
      isAssignmentBoardStatus(booking.status) &&
      isBookingOnJohannesburgDay(booking.collectionDate, day)
    ) {
      stops.push({
        ...booking,
        stopKind: "collection",
        boardSlot: asBoardSlot(booking.collectionSlot),
        boardDriverId: booking.assignedDriverId?.trim() || undefined,
      });
      continue;
    }

    if (
      isDeliveryStop(booking.status) &&
      hasDeliverySchedule(booking) &&
      isBookingOnJohannesburgDay(booking.deliveryDate ?? "", day)
    ) {
      stops.push({
        ...booking,
        stopKind: "delivery",
        boardSlot: asBoardSlot(booking.deliverySlot),
        boardDriverId: effectiveDeliveryDriverId(booking),
      });
    }
  }

  return stops;
}

/** @deprecated Prefer jobsForAssignmentDay (includes deliveries). */
export function collectionsForAssignmentDay<
  T extends Pick<
    Booking,
    | "id"
    | "suburb"
    | "customer"
    | "status"
    | "paymentStatus"
    | "assignedDriverId"
    | "collectionDate"
    | "collectionSlot"
    | "deliveryDate"
    | "deliverySlot"
    | "deliveryDriverId"
  >,
>(bookings: T[], day: string): AssignmentBoardJob[] {
  return jobsForAssignmentDay(bookings, day).filter(
    (stop) => stop.stopKind === "collection"
  );
}

function emptySlots(): Record<AssignmentSlot, AssignmentBoardJob[]> {
  return { MORNING: [], AFTERNOON: [] };
}

function slotOverCapacity(
  slots: Record<AssignmentSlot, AssignmentBoardJob[]>,
  limit: number
): Record<AssignmentSlot, boolean> {
  return {
    MORNING: slots.MORNING.length > limit,
    AFTERNOON: slots.AFTERNOON.length > limit,
  };
}

function pushIntoSlot(
  slots: Record<AssignmentSlot, AssignmentBoardJob[]>,
  job: AssignmentBoardJob
) {
  slots[job.boardSlot].push(job);
}

/**
 * Unassigned column first, then one column per active driver.
 * Jobs on inactive / unknown drivers sit in Unassigned (no extra column).
 */
export function buildAssignmentBoard(
  jobs: AssignmentBoardJob[],
  activeDrivers: AssignmentBoardDriver[],
  slotCapacity: number = ASSIGNMENT_SLOT_CAPACITY
): AssignmentBoardColumn[] {
  const unassigned = emptySlots();
  const byDriver = new Map<string, Record<AssignmentSlot, AssignmentBoardJob[]>>();

  for (const driver of activeDrivers) {
    byDriver.set(driver.id, emptySlots());
  }

  for (const job of jobs) {
    const driverId = job.boardDriverId;
    if (isUnassignedDriver(driverId) || !driverId || !byDriver.has(driverId)) {
      pushIntoSlot(unassigned, job);
      continue;
    }
    pushIntoSlot(byDriver.get(driverId)!, job);
  }

  const columns: AssignmentBoardColumn[] = [
    {
      key: "unassigned",
      driverId: null,
      title: "Unassigned",
      slots: unassigned,
      overCapacity: { MORNING: false, AFTERNOON: false },
    },
  ];

  for (const driver of activeDrivers) {
    const slots = byDriver.get(driver.id) ?? emptySlots();
    columns.push({
      key: driver.id,
      driverId: driver.id,
      title: driver.name,
      slots,
      overCapacity: slotOverCapacity(slots, slotCapacity),
    });
  }

  return columns;
}
