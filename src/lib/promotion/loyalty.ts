import { randomBytes } from "crypto";
import { Types, type ClientSession } from "mongoose";
import { Booking } from "@/models/Booking";
import { Coupon } from "@/models/Coupon";
import { User } from "@/models/User";
import { isDuplicateCouponCode } from "@/lib/coupon";
import { runInTransaction } from "@/lib/promotion/runInTransaction";
import {
  LOYALTY_PUNCHES_PER_REWARD,
  LOYALTY_REDEEM_SHORT_MESSAGE,
  LOYALTY_REWARD_TYPE,
  LOYALTY_REWARD_VALUE_CENTS,
} from "@/lib/promotion/loyaltyReward";

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
/**
 * Client who should receive the delivery punch.
 * A booking left on a deleted user id is relinked to the client with the same email,
 * so the referral stored on that account can be paid.
 */
export async function deliveryClientId(booking: {
  id: string;
  userId?: unknown;
  email?: unknown;
}): Promise<string | null> {
  const linked = userIdString(booking.userId);
  if (linked) {
    const owner = await User.findOne({ _id: linked, role: "client" })
      .select("_id")
      .lean();
    if (owner?._id) return linked;
  }

  const email =
    typeof booking.email === "string" ? booking.email.trim().toLowerCase() : "";
  if (!email) return null;

  const byEmail = await User.findOne({ email, role: "client" })
    .select("_id")
    .lean();
  if (!byEmail?._id) return null;

  const id = String(byEmail._id);
  await Booking.updateOne(
    { id: booking.id },
    { $set: { userId: byEmail._id, "customer.id": id } }
  );
  return id;
}

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

export type LoyaltyRedeemResult =
  | {
      ok: true;
      code: string;
      punches: number;
      rewardsRedeemed: number;
    }
  | { ok: false; error: string };

function loyaltyCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function newRewardCode(): string {
  return `RWD${randomBytes(6).toString("hex").toUpperCase()}`;
}

async function insertRewardCoupon(
  userId: string,
  code: string,
  session: ClientSession
): Promise<void> {
  await Coupon.create(
    [
      {
        code,
        type: LOYALTY_REWARD_TYPE,
        value: LOYALTY_REWARD_VALUE_CENTS,
        active: true,
        maxRedemptions: 1,
        redeemedCount: 0,
        ownerUserId: userId,
      },
    ],
    { session }
  );
}

/** Unused personal reward codes still belonging to this client. */
export async function listOpenRewardCodes(userId: string): Promise<string[]> {
  const docs = await Coupon.find({
    ownerUserId: userId,
    active: { $ne: false },
    redeemedCount: { $lt: 1 },
  })
    .select("code")
    .sort({ createdAt: 1 })
    .lean();

  return docs
    .map((doc) => (typeof doc.code === "string" ? doc.code : ""))
    .filter((code) => code.length > 0);
}

/**
 * Spend N punches and create that client's coupon in one transaction.
 * A short balance commits nothing. A failed coupon insert rolls the spend back.
 */
export async function redeemLoyaltyReward(
  userId: string
): Promise<LoyaltyRedeemResult> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newRewardCode();
    try {
      return await runInTransaction(async (session) => {
        const spent = await User.findOneAndUpdate(
          {
            _id: userId,
            "loyalty.punches": { $gte: LOYALTY_PUNCHES_PER_REWARD },
          },
          {
            $inc: {
              "loyalty.punches": -LOYALTY_PUNCHES_PER_REWARD,
              "loyalty.rewardsRedeemed": 1,
            },
          },
          { new: true, session }
        ).lean();

        if (!spent) {
          return { ok: false, error: LOYALTY_REDEEM_SHORT_MESSAGE } as const;
        }

        await insertRewardCoupon(userId, code, session);
        return {
          ok: true as const,
          code,
          punches: loyaltyCount(spent.loyalty?.punches),
          rewardsRedeemed: loyaltyCount(spent.loyalty?.rewardsRedeemed),
        };
      });
    } catch (err) {
      if (isDuplicateCouponCode(err) && attempt < 4) continue;
      throw err;
    }
  }
  throw new Error("Could not create a reward coupon");
}
