import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { clearSessionCookie, getSession } from "@/lib/session";
import { isClientRole, isFullAccount } from "@/types/user";

async function clientLoyalty(userId: string) {
  try {
    await connectDB();
    const doc = await User.findById(userId).select("loyalty").lean();
    const punches = doc?.loyalty?.punches;
    const rewardsRedeemed = doc?.loyalty?.rewardsRedeemed;
    return {
      punches: typeof punches === "number" && punches >= 0 ? punches : 0,
      rewardsRedeemed:
        typeof rewardsRedeemed === "number" && rewardsRedeemed >= 0
          ? rewardsRedeemed
          : 0,
    };
  } catch (err) {
    console.error("[api/auth/me] loyalty", err);
    return null;
  }
}

export async function GET() {
  const session = await getSession();
  if (!session || !isFullAccount(session)) {
    if (session && !isFullAccount(session)) {
      await clearSessionCookie();
    }
    return NextResponse.json({ user: null }, { status: 401 });
  }

  if (!isClientRole(session.role)) {
    return NextResponse.json({ user: session });
  }

  const loyalty = await clientLoyalty(session.id);
  return NextResponse.json({
    user: loyalty ? { ...session, loyalty } : session,
  });
}
