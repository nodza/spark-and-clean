/**
 * Punches spent for one personal reward.
 * The portal card is "one rug free, up to R500", so the coupon is a fixed
 * R500 (FIXED_CENTS), typed in the same Apply box as SPARK10.
 */
export const LOYALTY_PUNCHES_PER_REWARD = 5;

export const LOYALTY_REWARD_TYPE = "FIXED_CENTS" as const;

/** R500, stored as cents. */
export const LOYALTY_REWARD_VALUE_CENTS = 50_000;

export const LOYALTY_REDEEM_SHORT_MESSAGE = `You need ${LOYALTY_PUNCHES_PER_REWARD} punches to redeem a reward.`;
