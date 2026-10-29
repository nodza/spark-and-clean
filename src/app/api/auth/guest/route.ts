import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const GUEST_LIMIT = 10;
const GUEST_WINDOW_MS = 15 * 60 * 1000;

/**
 * Guest JWT sessions are intentionally not used.
 * Guests track a booking at /booking/[id] with no account and no cookie.
 */
export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(
    `auth-guest:ip:${getClientIp(request)}`,
    GUEST_LIMIT,
    GUEST_WINDOW_MS
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many guest attempts. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  return NextResponse.json(
    {
      error:
        "Guest sessions are not used. Track your order with the booking ID — no account required.",
    },
    { status: 410 }
  );
}
