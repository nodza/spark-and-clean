import { NextResponse } from "next/server";

/**
 * Guest JWT sessions are intentionally not used.
 * Guests track a booking at /booking/[id] with no account and no cookie.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Guest sessions are not used. Track your order with the booking ID — no account required.",
    },
    { status: 410 }
  );
}
