import { isValidCalendarDate } from "@/lib/johannesburgDate";
import { isBookingDeactivated } from "@/lib/adminBookingDetails";
import { isUnassignedDriver } from "@/lib/bookingAttention";
import {
  bookingCalendarDate,
  formatBookingCollection,
} from "@/lib/localCalendarDate";
import type { Booking, BookingStatus } from "@/types/booking";

export type DeliverySlot = "MORNING" | "AFTERNOON";

export type DeliverySchedulePatch = {
  deliveryDate: string;
  deliverySlot: DeliverySlot;
  deliveryDriverId: string | null;
};

export type DeliveryScheduleFields = Pick<
  Booking,
  | "status"
  | "assignedDriverId"
  | "deliveryDate"
  | "deliverySlot"
  | "deliveryDriverId"
  | "deactivatedAt"
>;

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function hasDeliverySchedule(
  booking: Pick<Booking, "deliveryDate" | "deliverySlot">
): boolean {
  const day = bookingCalendarDate(booking.deliveryDate ?? "");
  return (
    day != null &&
    (booking.deliverySlot === "MORNING" || booking.deliverySlot === "AFTERNOON")
  );
}

/** READY rugs waiting for an admin to set delivery date + slot. */
export function isReadyNeedingDeliverySchedule(
  booking: DeliveryScheduleFields
): boolean {
  if (isBookingDeactivated(booking)) return false;
  if (booking.status !== "READY") return false;
  return !hasDeliverySchedule(booking);
}

/** Driver who returns the rug — defaults to the collecting driver. */
export function effectiveDeliveryDriverId(
  booking: Pick<Booking, "assignedDriverId" | "deliveryDriverId">
): string | undefined {
  const delivery = booking.deliveryDriverId?.trim();
  if (delivery) return delivery;
  const collecting = booking.assignedDriverId?.trim();
  return collecting || undefined;
}

export function isDeliveryStop(status: BookingStatus): boolean {
  return status === "READY";
}

/** Calendar day for the active stop (collection or scheduled delivery). */
export function jobStopDate(
  booking: Pick<
    Booking,
    "status" | "collectionDate" | "deliveryDate" | "deliverySlot"
  >
): string | null {
  if (isDeliveryStop(booking.status) && hasDeliverySchedule(booking)) {
    return bookingCalendarDate(booking.deliveryDate ?? "");
  }
  return bookingCalendarDate(booking.collectionDate);
}

/** Slot for the active stop. */
export function jobStopSlot(
  booking: Pick<
    Booking,
    "status" | "collectionSlot" | "deliveryDate" | "deliverySlot"
  >
): DeliverySlot {
  if (
    isDeliveryStop(booking.status) &&
    (booking.deliverySlot === "MORNING" || booking.deliverySlot === "AFTERNOON")
  ) {
    return booking.deliverySlot;
  }
  return booking.collectionSlot === "AFTERNOON" ? "AFTERNOON" : "MORNING";
}

/** Driver responsible for the active stop. */
export function jobStopDriverId(
  booking: Pick<
    Booking,
    "status" | "assignedDriverId" | "deliveryDriverId" | "deliveryDate" | "deliverySlot"
  >
): string | undefined {
  if (isDeliveryStop(booking.status) && hasDeliverySchedule(booking)) {
    return effectiveDeliveryDriverId(booking);
  }
  return booking.assignedDriverId?.trim() || undefined;
}

/**
 * Technician may open / update a job they collect, or a READY return assigned
 * to them as the delivery driver.
 */
export function technicianOwnsJob(
  booking: Pick<
    Booking,
    "status" | "assignedDriverId" | "deliveryDriverId" | "deliveryDate" | "deliverySlot"
  >,
  driverProfileId: string | null | undefined
): boolean {
  const id = driverProfileId?.trim();
  if (!id) return false;
  if (booking.assignedDriverId === id) return true;
  if (
    isDeliveryStop(booking.status) &&
    hasDeliverySchedule(booking) &&
    effectiveDeliveryDriverId(booking) === id
  ) {
    return true;
  }
  return false;
}

/** Client-facing line: "Delivery: Wed 15 Oct, morning" */
export function formatClientDeliveryLine(
  booking: Pick<Booking, "deliveryDate" | "deliverySlot">
): string | null {
  if (!hasDeliverySchedule(booking)) return null;
  const day = formatBookingCollection(booking.deliveryDate!, "EEE d MMM", "");
  if (!day) return null;
  const slot =
    booking.deliverySlot === "AFTERNOON" ? "afternoon" : "morning";
  return `Delivery: ${day}, ${slot}`;
}

/**
 * Full-admin schedule: date + morning/afternoon + optional delivery driver
 * (null clears to fall back to the collecting driver).
 */
export function sanitizeDeliverySchedulePatch(
  body: unknown
): { ok: true; patch: DeliverySchedulePatch } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid request body" };
  }
  const raw = body as Record<string, unknown>;

  const deliveryDateRaw = readString(raw.deliveryDate);
  const deliveryDate =
    bookingCalendarDate(deliveryDateRaw) ?? deliveryDateRaw;
  const deliverySlot = readString(raw.deliverySlot);

  if (!isValidCalendarDate(deliveryDate)) {
    return { ok: false, error: "Enter a valid delivery date." };
  }
  if (deliverySlot !== "MORNING" && deliverySlot !== "AFTERNOON") {
    return { ok: false, error: "Choose morning or afternoon for delivery." };
  }

  let deliveryDriverId: string | null = null;
  if (Object.prototype.hasOwnProperty.call(raw, "deliveryDriverId")) {
    if (raw.deliveryDriverId === null || raw.deliveryDriverId === "") {
      deliveryDriverId = null;
    } else if (typeof raw.deliveryDriverId === "string") {
      const id = raw.deliveryDriverId.trim();
      if (!id) {
        deliveryDriverId = null;
      } else {
        deliveryDriverId = id;
      }
    } else {
      return { ok: false, error: "Choose a delivery driver." };
    }
  }

  return {
    ok: true,
    patch: {
      deliveryDate,
      deliverySlot,
      deliveryDriverId,
    },
  };
}

export function isUnassignedDeliveryToday(
  booking: DeliveryScheduleFields,
  today: string
): boolean {
  if (isBookingDeactivated(booking)) return false;
  if (booking.status !== "READY") return false;
  if (!hasDeliverySchedule(booking)) return false;
  if (bookingCalendarDate(booking.deliveryDate ?? "") !== today) return false;
  return isUnassignedDriver(effectiveDeliveryDriverId(booking));
}
