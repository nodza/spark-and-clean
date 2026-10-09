import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { toPublicApiError } from "@/lib/publicApiError";
import {
  listOpenRewardCodes,
  redeemLoyaltyReward,
} from "@/lib/promotion/loyalty";
import { LOYALTY_PUNCHES_PER_REWARD } from "@/lib/promotion/loyaltyReward";
import { isPersistedClient } from "@/types/user";

function clientSession(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session || !isPersistedClient(session)) {
    if (!session || session.guest || session.id?.startsWith("guest:")) {
      return {
        error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { id: session.id };
}

/** Codes this client can still type at checkout. */
export async function GET() {
  try {
    const session = await getSession();
    const caller = clientSession(session);
    if ("error" in caller) return caller.error;

    await connectDB();
    const codes = await listOpenRewardCodes(caller.id);
    return NextResponse.json(
      { codes },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[api/loyalty/redeem GET]", err);
    return NextResponse.json(
      { error: toPublicApiError(err, "Could not load reward codes") },
      { status: 500 }
    );
  }
}

/** Spend N loyalty punches for a personal coupon the client can type at checkout. */
export async function POST() {
  try {
    const session = await getSession();
    const caller = clientSession(session);
    if ("error" in caller) return caller.error;

    await connectDB();
    const result = await redeemLoyaltyReward(caller.id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      code: result.code,
      punches: result.punches,
      rewardsRedeemed: result.rewardsRedeemed,
      punchesPerReward: LOYALTY_PUNCHES_PER_REWARD,
    });
  } catch (err) {
    console.error("[api/loyalty/redeem]", err);
    return NextResponse.json(
      { error: toPublicApiError(err, "Could not redeem punches") },
      { status: 500 }
    );
  }
}
