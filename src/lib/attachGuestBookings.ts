import { Types } from "mongoose";
import { Booking } from "@/models/Booking";

/**
 * Attach unclaimed guest bookings to a registered client.
 *
 * Rule: every booking whose `customer.email` matches (case-insensitive) and
 * that has no `userId` is linked to this user. The booking `id` (reference)
 * never changes — conversion must not create a second booking.
 */
export async function attachUnclaimedBookingsByEmail(
  userId: string,
  email: string
): Promise<{ count: number; ids: string[] }> {
  const emailNorm = email.trim().toLowerCase();
  if (!emailNorm || !Types.ObjectId.isValid(userId)) {
    return { count: 0, ids: [] };
  }

  const oid = new Types.ObjectId(userId);
  const filter = {
    "customer.email": emailNorm,
    $or: [{ userId: { $exists: false } }, { userId: null }],
  };

  const docs = await Booking.find(filter).select("id").lean();
  const ids = docs.map((d) => String(d.id));
  if (ids.length === 0) return { count: 0, ids: [] };

  await Booking.updateMany(filter, {
    $set: { userId: oid, "customer.id": userId },
  });

  return { count: ids.length, ids };
}

export function isUnclaimed(booking: { userId?: unknown } | null | undefined) {
  return !booking?.userId;
}
