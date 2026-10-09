import { Types } from "mongoose";
import { Booking } from "@/models/Booking";
import { User } from "@/models/User";

export type LoyaltyPunchTarget = {
  id: string;
  userId?: unknown;
};

function userIdString(userId: unknown): string | null {
  if (typeof userId === "string") {
    const trimmed = userId.trim();
    return Types.ObjectId.isValid(trimmed) ? trimmed : null;
  }
  if (userId instanceof Types.ObjectId) {
    return userId.toHexString();
  }
  return null;
}

/**
 * Award one loyalty punch for a delivered booking that belongs to a user.
 * Guests (no userId) are skipped. A later call for the same booking does not
 * increment again — the claim is the booking's promotion.loyaltyPunchedAt flag.
 */
export async function punchOnce(booking: LoyaltyPunchTarget): Promise<boolean> {
  const userId = userIdString(booking.userId);
  if (!userId) return false;

  const claim = await Booking.updateOne(
    {
      id: booking.id,
      userId,
      $or: [
        { "promotion.loyaltyPunchedAt": { $exists: false } },
        { "promotion.loyaltyPunchedAt": null },
      ],
    },
    { $set: { "promotion.loyaltyPunchedAt": new Date() } }
  );

  if (claim.modifiedCount !== 1) return false;

  try {
    const updated = await User.updateOne(
      { _id: userId },
      { $inc: { "loyalty.punches": 1 } }
    );
    if (updated.matchedCount !== 1) {
      throw new Error("Could not award the loyalty punch.");
    }
  } catch (err) {
    await Booking.updateOne(
      { id: booking.id, userId },
      { $unset: { "promotion.loyaltyPunchedAt": "" } }
    );
    throw err;
  }
  return true;
}
