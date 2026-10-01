import { NextResponse } from "next/server";
import { isOzowConfigured, isStripeConfigured } from "@/lib/payments/ozow";

/** Which checkout providers have env credentials. No secrets returned. */
export async function GET() {
  return NextResponse.json({
    stripe: isStripeConfigured(),
    ozow: isOzowConfigured(),
  });
}
