import { ASSIGNMENT_SLOT_CAPACITY } from "@/config/assignmentBoard";
import { isUnassignedDriver } from "@/lib/bookingAttention";
import { isBookingOnJohannesburgDay } from "@/lib/johannesburgDate";
import type { Booking, BookingStatus } from "@/types/booking";

export const ASSIGNMENT_BOARD_STATUSES: BookingStatus[] = [
  "BOOKED",
  "SCHEDULED",
];

export const ASSIGNMENT_SLOTS = ["MORNING", "AFTERNOON"] as const;
export type AssignmentSlot = (typeof ASSIGNMENT_SLOTS)[number];

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
>;

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
  return ASSIGNMENT_BOARD_STATUSES.includes(status);
}

export function customerSurname(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] || name.trim();
}

export function collectionsForAssignmentDay<T extends AssignmentBoardJob>(
  bookings: T[],
  day: string
): T[] {
  return bookings.filter(
    (booking) =>
      isAssignmentBoardStatus(booking.status) &&
      isBookingOnJohannesburgDay(booking.collectionDate, day)
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
  const slot: AssignmentSlot =
    job.collectionSlot === "AFTERNOON" ? "AFTERNOON" : "MORNING";
  slots[slot].push(job);
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
    const driverId = job.assignedDriverId;
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
