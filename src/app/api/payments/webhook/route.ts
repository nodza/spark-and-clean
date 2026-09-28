import { NextResponse } from "next/server";
import { getStripe } from "@/lib/payments/stripe";
import { fulfillPaidCheckoutSession } from "@/lib/payments/stripeWebhook";

export const runtime = "nodejs";

const FULFILL_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

/**
 * Stripe tells us a Checkout payment settled. Signature is required.
 * Unpaid sessions are ignored so a delayed payment method cannot mark a
 * booking paid before the money arrives.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!signature || !secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.text();
  let event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    console.error(
      "[api/payments/webhook] signature",
      err instanceof Error ? err.message : "invalid signature"
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (!FULFILL_EVENTS.has(event.type)) {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object;
  if (!session || !("payment_status" in session)) {
    return NextResponse.json({ received: true });
  }

  try {
    const result = await fulfillPaidCheckoutSession(session);
    if (!result.ok) {
      console.error("[api/payments/webhook]", result.error);
      return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
    }
    return NextResponse.json({ received: true, applied: result.applied ?? true });
  } catch (err) {
    console.error(
      "[api/payments/webhook]",
      err instanceof Error ? err.message : "Failed to record payment"
    );
    return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
  }
}
