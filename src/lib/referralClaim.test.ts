import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { User } from "@/models/User";
import { referralRewardClaimFilter } from "@/lib/referral";

const janeId = "507f1f77bcf86cd799439012";

describe("referral claim filter", () => {
  it("keeps $expr and $type after mongoose casts it", () => {
    const friendId = new Types.ObjectId(janeId);
    const query = User.findOneAndUpdate(referralRewardClaimFilter(friendId), {
      $set: { referralRewardedAt: new Date() },
    });

    const casted = query.cast() as {
      _id: Types.ObjectId;
      referredByUserId: { $exists: boolean; $type: string };
      $expr: { $ne: string[] };
      $or: Array<Record<string, unknown>>;
    };

    expect(casted._id.toHexString()).toBe(janeId);
    expect(casted.referredByUserId).toEqual({
      $exists: true,
      $type: "objectId",
    });
    expect(casted.$expr).toEqual({ $ne: ["$referredByUserId", "$_id"] });
    expect(casted.$or).toEqual([
      { referralRewardedAt: { $exists: false } },
      { referralRewardedAt: null },
    ]);
  });

  it("declares a unique sparse index for referralCode", () => {
    const indexes = User.schema.indexes();
    const referral = indexes.find(
      ([fields]) => (fields as { referralCode?: number }).referralCode === 1
    );

    expect(referral?.[1]).toMatchObject({ unique: true, sparse: true });
  });
});
