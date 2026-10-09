import { randomBytes } from "crypto";
import { Types } from "mongoose";
import { Booking } from "@/models/Booking";
import { Coupon } from "@/models/Coupon";
import { User } from "@/models/User";
import { isDuplicateCouponCode } from "@/lib/coupon";
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
    await User.updateOne({ _id: userId }, { $inc: { "loyalty.punches": 1 } });
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

async function rewardCodeAlreadySaved(
  userId: string,
  code: string
): Promise<boolean> {
  const saved = await Coupon.findOne({ code, ownerUserId: userId })
    .select("_id")
    .lean();
  return Boolean(saved);
}

async function createPersonalRewardCoupon(userId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newRewardCode();
    try {
      await Coupon.create({
        code,
        type: LOYALTY_REWARD_TYPE,
        value: LOYALTY_REWARD_VALUE_CENTS,
        active: true,
        maxRedemptions: 1,
        redeemedCount: 0,
        ownerUserId: userId,
      });
      return code;
    } catch (err) {
      if (await rewardCodeAlreadySaved(userId, code)) return code;
      if (isDuplicateCouponCode(err) && attempt < 4) continue;
      throw err;
    }
  }
  throw new Error("Could not create a reward coupon");
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
 * Spend N punches for a single-use coupon only that client can preview.
 * The spend is conditional on punches >= N, so a short balance is left unchanged.
 */
export async function redeemLoyaltyReward(
  userId: string
): Promise<LoyaltyRedeemResult> {
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
    { new: true }
  ).lean();

  if (!spent) {
    return { ok: false, error: LOYALTY_REDEEM_SHORT_MESSAGE };
  }

  const punches = loyaltyCount(spent.loyalty?.punches);
  const rewardsRedeemed = loyaltyCount(spent.loyalty?.rewardsRedeemed);

  try {
    const code = await createPersonalRewardCoupon(userId);
    return { ok: true, code, punches, rewardsRedeemed };
  } catch (err) {
    await User.updateOne(
      {
        _id: userId,
        "loyalty.rewardsRedeemed": { $gte: 1 },
      },
      {
        $inc: {
          "loyalty.punches": LOYALTY_PUNCHES_PER_REWARD,
          "loyalty.rewardsRedeemed": -1,
        },
      }
    );
    throw err;
  }
}
