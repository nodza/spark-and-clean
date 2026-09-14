import type { BookingStatus, PaymentStatus } from "@/types/booking";

export const BOOKING_STATUSES: readonly BookingStatus[] = [
  "BOOKED",
  "SCHEDULED",
  "COLLECTED",
  "CLEANING",
  "DRYING",
  "READY",
  "DELIVERED",
  "CANCELLED",
] as const;

export const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "UNPAID",
  "DEPOSIT",
  "PAID",
] as const;

export function isBookingStatus(value: unknown): value is BookingStatus {
  return (
    typeof value === "string" &&
    (BOOKING_STATUSES as readonly string[]).includes(value)
  );
}

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return (
    typeof value === "string" &&
    (PAYMENT_STATUSES as readonly string[]).includes(value)
  );
}
