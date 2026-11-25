import { bookingCalendarDate, johannesburgCalendarDate } from "@/lib/localCalendarDate";
import { isBookingDeactivated } from "@/lib/adminBookingDetails";
import { listPaymentsForBooking } from "@/lib/payments/listBookingPayments";
import { netSucceededCents } from "@/lib/payments/ledger";
import { LOYALTY_PUNCHES_PER_REWARD } from "@/lib/promotion/loyaltyReward";
import { Driver } from "@/models/Driver";
import { User } from "@/models/User";
import type { Booking } from "@/types/booking";
import {
  bookingConfirmedEmail,
  collectionReminderEmail,
  deliveredEmail,
  loyaltyRewardEmail,
  outForDeliveryEmail,
  type DriverMailContact,
} from "@/lib/email/copy";
import { sendTransactionalEmail } from "@/lib/email/sendTransactionalEmail";
import { isDriverDelivery } from "@/lib/handover";

async function driverContact(driverId: string | undefined): Promise<DriverMailContact | null> {
  const id = driverId?.trim();
  if (!id) return null;
  const driver = await Driver.findOne({ id }).select({ name: 1, phone: 1 }).lean();
  if (!driver || typeof driver.name !== "string" || !driver.name.trim()) return null;
  const phone = typeof driver.phone === "string" ? driver.phone.trim() : "";
  return phone ? { name: driver.name.trim(), phone } : { name: driver.name.trim() };
}

function customerEmail(booking: Booking): string {
  return booking.customer?.email?.trim().toLowerCase() ?? "";
}

/**
 * Booking confirmed, for guests and signed-in clients. One email per booking.
 */
export async function notifyBookingConfirmed(booking: Booking): Promise<void> {
  try {
    if (isBookingDeactivated(booking)) return;
    await sendTransactionalEmail({
      dedupeKey: `booking:${booking.id}:booking_confirmed`,
      kind: "booking_confirmed",
      to: customerEmail(booking),
      bookingId: booking.id,
      email: bookingConfirmedEmail(booking),
    });
  } catch (err) {
    console.error("[email] booking confirmed", booking.id, err);
  }
}

/** Day-before collection reminder. The morning job calls this once per booking. */
export async function notifyCollectionReminder(booking: Booking): Promise<void> {
  try {
    if (isBookingDeactivated(booking)) return;
    const day = bookingCalendarDate(booking.collectionDate) ?? booking.collectionDate;
    const driver = await driverContact(booking.assignedDriverId);
    await sendTransactionalEmail({
      dedupeKey: `booking:${booking.id}:collection_reminder:${day}`,
      kind: "collection_reminder",
      to: customerEmail(booking),
      bookingId: booking.id,
      email: collectionReminderEmail(booking, driver),
    });
  } catch (err) {
    console.error("[email] collection reminder", booking.id, err);
  }
}

/**
 * Rug is going back to the customer: 08:00 on the delivery morning, or as soon
 * as ops schedules a return for today. There is no separate out-for-delivery
 * status — READY plus today's delivery date is the van leaving.
 */
export async function notifyOutForDelivery(booking: Booking): Promise<void> {
  try {
    if (isBookingDeactivated(booking)) return;
    if (!isDriverDelivery(booking)) return;
    if (booking.status !== "READY") return;
    const day = bookingCalendarDate(booking.deliveryDate ?? "");
    if (!day) return;
    const driver = await driverContact(
      booking.deliveryDriverId || booking.assignedDriverId
    );
    const payments = await listPaymentsForBooking(booking.id);
    const paid = netSucceededCents(
      payments
        .filter((row) => row.status === "SUCCEEDED")
        .map((row) => ({ kind: row.kind, amountCents: row.amountCents }))
    );
    await sendTransactionalEmail({
      dedupeKey: `booking:${booking.id}:out_for_delivery:${day}`,
      kind: "out_for_delivery",
      to: customerEmail(booking),
      bookingId: booking.id,
      email: outForDeliveryEmail(booking, driver, paid),
    });
  } catch (err) {
    console.error("[email] out for delivery", booking.id, err);
  }
}

/** Delivered invoice. Saving DELIVERED again does not call this. */
export async function notifyDelivered(
  booking: Booking,
  clientUserId?: string | null
): Promise<void> {
  try {
    if (isBookingDeactivated(booking)) return;
    const payments = await listPaymentsForBooking(booking.id);
    const punches = await loyaltyPunches(clientUserId || booking.userId);
    await sendTransactionalEmail({
      dedupeKey: `booking:${booking.id}:delivered`,
      kind: "delivered",
      to: customerEmail(booking),
      bookingId: booking.id,
      email: deliveredEmail(booking, payments, punches),
    });
  } catch (err) {
    console.error("[email] delivered", booking.id, err);
  }
}

async function loyaltyPunches(userId: string | null | undefined): Promise<number | null> {
  if (!userId) return null;
  const user = await User.findById(userId).select({ loyalty: 1 }).lean();
  const punches = user?.loyalty?.punches;
  if (typeof punches !== "number" || !Number.isFinite(punches) || punches < 0) {
    return 0;
  }
  return punches;
}

/**
 * Sent when a delivery punch fills a loyalty card (every 5th punch).
 * The address is the booking's customer email.
 */
export async function notifyLoyaltyReward(input: {
  userId: string;
  booking: Booking;
}): Promise<void> {
  try {
    const user = await User.findById(input.userId)
      .select({ name: 1, loyalty: 1 })
      .lean();
    const punches =
      typeof user?.loyalty?.punches === "number" ? user.loyalty.punches : 0;
    const redeemed =
      typeof user?.loyalty?.rewardsRedeemed === "number"
        ? user.loyalty.rewardsRedeemed
        : 0;
    if (punches < LOYALTY_PUNCHES_PER_REWARD) return;
    if (punches % LOYALTY_PUNCHES_PER_REWARD !== 0) return;
    const card = redeemed + punches / LOYALTY_PUNCHES_PER_REWARD;
    await sendTransactionalEmail({
      dedupeKey: `loyalty:${input.userId}:card:${card}`,
      kind: "loyalty_reward",
      to: customerEmail(input.booking),
      bookingId: input.booking.id,
      email: loyaltyRewardEmail({
        bookingId: input.booking.id,
        name:
          input.booking.customer.name ||
          (typeof user?.name === "string" ? user.name : undefined),
      }),
    });
  } catch (err) {
    console.error("[email] loyalty reward", input.booking.id, err);
  }
}

/**
 * After a booking patch has been saved. Email failures are logged and do not
 * surface to the status update.
 */
export async function notifyAfterBookingUpdate(input: {
  previousStatus: string;
  booking: Booking;
  /** Set when this request wrote a delivery date. */
  deliveryDateSet?: string | null;
  /** Account that owns the delivered booking, for the stamp card. */
  clientUserId?: string | null;
  /** Set only when this delivery awarded a new loyalty punch. */
  loyaltyUserId?: string | null;
}): Promise<void> {
  const { booking } = input;
  if (
    input.previousStatus !== "DELIVERED" &&
    booking.status === "DELIVERED"
  ) {
    await notifyDelivered(booking, input.clientUserId);
  }

  const deliveryDay = input.deliveryDateSet
    ? bookingCalendarDate(input.deliveryDateSet)
    : null;
  if (deliveryDay && deliveryDay === johannesburgCalendarDate() && booking.status === "READY") {
    await notifyOutForDelivery(booking);
  }

  if (input.loyaltyUserId) {
    await notifyLoyaltyReward({
      userId: input.loyaltyUserId,
      booking,
    });
  }
}
