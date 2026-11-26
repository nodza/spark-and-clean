import { isBookingDeactivated } from "@/lib/adminBookingDetails";
import {
  bookingCalendarDate,
  johannesburgCalendarDate,
} from "@/lib/localCalendarDate";
import { hasDeliverySchedule } from "@/lib/deliverySchedule";
import { Booking } from "@/models/Booking";
import { toClientBooking } from "@/lib/serialize";
import type { Booking as ClientBooking } from "@/types/booking";
import {
  notifyCollectionReminder,
  notifyOutForDelivery,
} from "@/lib/email/bookingNotifications";

/** 08:00 Africa/Johannesburg. SAST is UTC+2 all year, so the UTC hour is 6. */
export const CUSTOMER_EMAIL_LOCAL_HOUR = 8;
export const CUSTOMER_EMAIL_LOCAL_MINUTE = 0;

export function shiftCalendarDate(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function isCollectionReminderDue(
  booking: Pick<ClientBooking, "status" | "collectionDate" | "deactivatedAt" | "customer">,
  tomorrowIso: string
): boolean {
  if (isBookingDeactivated(booking)) return false;
  if (booking.status !== "BOOKED" && booking.status !== "SCHEDULED") return false;
  if (!booking.customer?.email?.includes("@")) return false;
  return bookingCalendarDate(booking.collectionDate) === tomorrowIso;
}

export function isOutForDeliveryDue(
  booking: Pick<
    ClientBooking,
    "status" | "deliveryDate" | "deliverySlot" | "deactivatedAt" | "customer"
  >,
  todayIso: string
): boolean {
  if (isBookingDeactivated(booking)) return false;
  if (booking.status !== "READY") return false;
  if (!hasDeliverySchedule(booking)) return false;
  if (!booking.customer?.email?.includes("@")) return false;
  return bookingCalendarDate(booking.deliveryDate ?? "") === todayIso;
}

const BOOKING_FIELDS = {
  id: 1,
  userId: 1,
  customer: 1,
  suburb: 1,
  addressLine1: 1,
  city: 1,
  collectionDate: 1,
  collectionSlot: 1,
  deliveryDate: 1,
  deliverySlot: 1,
  deliveryDriverId: 1,
  assignedDriverId: 1,
  rug: 1,
  addOns: 1,
  estimatedPriceMin: 1,
  estimatedPriceMax: 1,
  measuredQuote: 1,
  billing: 1,
  promotion: 1,
  couponCode: 1,
  status: 1,
  paymentStatus: 1,
  createdAt: 1,
  deactivatedAt: 1,
} as const;

/**
 * Fixed morning job: collection reminders for tomorrow, and "on the way back"
 * for rugs whose delivery day is today.
 */
export async function runScheduledCustomerEmails(
  now: Date = new Date()
): Promise<{ reminders: number; deliveries: number }> {
  const today = johannesburgCalendarDate(now);
  const tomorrow = shiftCalendarDate(today, 1);
  const yesterday = shiftCalendarDate(today, -1);
  const dayAfterTomorrow = shiftCalendarDate(tomorrow, 1);

  const [collectionDocs, deliveryDocs] = await Promise.all([
    Booking.find({
      status: { $in: ["BOOKED", "SCHEDULED"] },
      collectionDate: { $gte: yesterday, $lt: dayAfterTomorrow },
      deactivatedAt: null,
    })
      .select(BOOKING_FIELDS)
      .lean(),
    Booking.find({
      status: "READY",
      deliveryDate: { $gte: yesterday, $lt: tomorrow },
      deactivatedAt: null,
    })
      .select(BOOKING_FIELDS)
      .lean(),
  ]);

  let reminders = 0;
  for (const doc of collectionDocs) {
    const booking = toClientBooking(doc as Record<string, unknown>);
    if (!isCollectionReminderDue(booking, tomorrow)) continue;
    await notifyCollectionReminder(booking);
    reminders += 1;
  }

  let deliveries = 0;
  for (const doc of deliveryDocs) {
    const booking = toClientBooking(doc as Record<string, unknown>);
    if (!isOutForDeliveryDue(booking, today)) continue;
    await notifyOutForDelivery(booking);
    deliveries += 1;
  }

  return { reminders, deliveries };
}
