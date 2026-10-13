import { randomBytes } from "crypto";
import { Types, type ClientSession } from "mongoose";
import { User } from "@/models/User";
import { runInTransaction } from "@/lib/promotion/runInTransaction";
import {
  REFERRAL_CODE_ALPHABET,
  REFERRAL_CODE_LENGTH,
  normalizeReferralCode,
  referralSharePath,
} from "@/lib/referralCode";

export { normalizeReferralCode, referralSharePath };

/** Readable unique code. Signup only stores it; the delivery punch is separate. */
export function newReferralCode(): string {
  const bytes = randomBytes(REFERRAL_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    code += REFERRAL_CODE_ALPHABET[bytes[i] % REFERRAL_CODE_ALPHABET.length];
  }
  return code;
}

function readStoredCode(value: unknown): string | null {
  return normalizeReferralCode(value);
}

function isDuplicateKey(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === 11000
  );
}

/**
 * One stable code per client. A second call returns the code already stored.
 * Technicians and unknown users get null.
 */
export async function ensureClientReferralCode(
  userId: string
): Promise<string | null> {
  if (!Types.ObjectId.isValid(userId)) return null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await User.findOne({ _id: userId, role: "client" })
      .select("referralCode")
      .lean();
    if (!current) return null;

    const existing = readStoredCode(current.referralCode);
    if (existing) return existing;

    const code = newReferralCode();
    try {
      const updated = await User.findOneAndUpdate(
        {
          _id: userId,
          role: "client",
          $or: [
            { referralCode: { $exists: false } },
            { referralCode: null },
            { referralCode: "" },
          ],
        },
        { $set: { referralCode: code } },
        { returnDocument: "after" }
      )
        .select("referralCode")
        .lean();

      const saved = readStoredCode(updated?.referralCode);
      if (saved) return saved;
    } catch (err) {
      if (!isDuplicateKey(err) || attempt === 4) throw err;
    }
  }

  throw new Error("Could not create a referral code");
}

/**
 * Client id that owns this code, or null when the ref is missing, unknown,
 * or not a client. A user cannot be attributed to themselves.
 */
export async function referrerIdForCode(
  raw: unknown,
  selfId?: string
): Promise<string | null> {
  const code = normalizeReferralCode(raw);
  if (!code) return null;

  const referrer = await User.findOne({ referralCode: code, role: "client" })
    .select("_id")
    .lean();
  if (!referrer?._id) return null;

  const id = String(referrer._id);
  if (selfId && id === selfId) return null;
  return id;
}

function userIdString(userId: unknown): string | null {
  if (typeof userId === "string") {
    const trimmed = userId.trim();
    return Types.ObjectId.isValid(trimmed) ? trimmed : null;
  }
  if (userId instanceof Types.ObjectId) return userId.toHexString();
  return null;
}

export type ReferralCreditTarget = {
  id: string;
  userId?: unknown;
};

/** Claim filter for the one referral punch. Shared so tests can cast it. */
export function referralRewardClaimFilter(friendId: Types.ObjectId) {
  return {
    _id: friendId,
    referredByUserId: { $exists: true, $type: "objectId" },
    $expr: { $ne: ["$referredByUserId", "$_id"] },
    $or: [
      { referralRewardedAt: { $exists: false } },
      { referralRewardedAt: null },
    ],
  };
}

/**
 * Credit the referrer once, when the referred client is first delivered.
 * The reward is one extra loyalty punch. It is not a coupon and not a Stripe payout.
 * referralRewardedAt on the friend blocks a second credit.
 * The claim and the punch commit together. A missing referrer releases the claim
 * and returns false. A write error aborts both, so a later delivery can retry
 * without paying twice.
 * A delivery does not credit someone as their own referrer.
 */
export async function creditReferrerOnce(
  booking: ReferralCreditTarget
): Promise<boolean> {
  const friendId = userIdString(booking.userId);
  if (!friendId) return false;

  const friendObjectId = new Types.ObjectId(friendId);

  return runInTransaction(async (session) => {
    const claimed = await User.findOneAndUpdate(
      referralRewardClaimFilter(friendObjectId),
      { $set: { referralRewardedAt: new Date() } },
      { returnDocument: "after", session }
    )
      .select("referredByUserId")
      .lean();

    if (!claimed) return false;

    const referrerId = userIdString(claimed.referredByUserId);
    if (!referrerId || referrerId === friendId) {
      await releaseReferralClaim(friendObjectId, session);
      return false;
    }

    const updated = await User.updateOne(
      { _id: referrerId },
      { $inc: { "loyalty.punches": 1 } },
      { session }
    );
    if (updated.matchedCount !== 1) {
      await releaseReferralClaim(friendObjectId, session);
      return false;
    }
    return true;
  });
}

/** Drop a claim only when this transaction knows the punch did not apply. */
async function releaseReferralClaim(
  friendId: Types.ObjectId,
  session: ClientSession
) {
  await User.updateOne(
    { _id: friendId },
    { $unset: { referralRewardedAt: "" } },
    { session }
  );
}
