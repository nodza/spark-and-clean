import { accountIsDisabled } from "@/lib/adminAuth";
import { adminNewBookingEmail, driverAssignedEmail } from "@/lib/email/copy";
import { sendTransactionalEmail } from "@/lib/email/sendTransactionalEmail";
import { Driver } from "@/models/Driver";
import { User } from "@/models/User";
import type { Booking } from "@/types/booking";

function cleanId(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function addressOf(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** Stable for one saved assignment. A later change of driver gets a new key. */
export function driverAssignmentDedupeKey(input: {
  bookingId: string;
  previousDriverId: string;
  nextDriverId: string;
  previousUpdatedAt?: unknown;
}): string {
  const from = input.previousDriverId || "none";
  let stamp = "new";
  if (input.previousUpdatedAt instanceof Date && !Number.isNaN(input.previousUpdatedAt.getTime())) {
    stamp = input.previousUpdatedAt.toISOString();
  } else if (typeof input.previousUpdatedAt === "string" && input.previousUpdatedAt.trim()) {
    stamp = input.previousUpdatedAt.trim();
  }
  return `booking:${input.bookingId}:driver_assigned:${from}:${input.nextDriverId}:${stamp}`;
}

/**
 * One email to every active full admin. Marketing-only admins are not the ops team.
 * A missing inbox or a failed send does not affect the booking.
 */
export async function notifyAdminTeamNewBooking(booking: Booking): Promise<void> {
  try {
    // "ADMIN" is a legacy stored role, outside the current enum.
    const admins = await User.find({
      role: { $in: ["admin", "ADMIN"] },
      adminTier: "full",
      disabledAt: null,
      isActive: { $ne: false },
    } as never)
      .select({ email: 1 })
      .lean();

    for (const admin of admins) {
      const to = addressOf(admin.email);
      if (!to.includes("@")) continue;
      try {
        await sendTransactionalEmail({
          dedupeKey: `booking:${booking.id}:admin_new_booking:${to}`,
          kind: "admin_new_booking",
          to,
          bookingId: booking.id,
          email: adminNewBookingEmail(booking),
        });
      } catch (err) {
        console.error("[email] admin new booking", booking.id, to, err);
      }
    }
  } catch (err) {
    console.error("[email] admin new booking", booking.id, err);
  }
}

async function assignedDriverEmail(driverId: string): Promise<string> {
  const tech = await User.findOne({
    role: "technician",
    driverProfileId: driverId,
  })
    .select({ email: 1, disabledAt: 1 })
    .lean();

  if (tech) {
    if (accountIsDisabled(tech)) return "";
    const email = addressOf(tech.email);
    if (email.includes("@")) return email;
  }

  const driver = await Driver.findOne({ id: driverId })
    .select({ email: 1, isActive: 1 })
    .lean();
  if (!driver || driver.isActive === false) return "";
  const email = addressOf(driver.email);
  return email.includes("@") ? email : "";
}

/**
 * Email the newly assigned driver. Same driver, an unassign, or any other
 * edit does not send. Used by the Assignments board and Pickup zones, which
 * both save `assignedDriverId` on the booking.
 */
export async function notifyDriverAssigned(input: {
  booking: Booking;
  previousDriverId?: string | null;
  nextDriverId?: string | null;
  previousUpdatedAt?: unknown;
}): Promise<void> {
  const previous = cleanId(input.previousDriverId);
  const next = cleanId(input.nextDriverId);
  if (!next || next === previous) return;

  try {
    const to = await assignedDriverEmail(next);
    if (!to) {
      console.log(`[email] no address for driver ${next}; assignment email skipped`);
      return;
    }
    await sendTransactionalEmail({
      dedupeKey: driverAssignmentDedupeKey({
        bookingId: input.booking.id,
        previousDriverId: previous,
        nextDriverId: next,
        previousUpdatedAt: input.previousUpdatedAt,
      }),
      kind: "driver_assigned",
      to,
      bookingId: input.booking.id,
      email: driverAssignedEmail(input.booking),
    });
  } catch (err) {
    console.error("[email] driver assigned", input.booking.id, err);
  }
}
