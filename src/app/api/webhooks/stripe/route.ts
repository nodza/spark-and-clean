import { NextResponse } from "next/server";
import { getStripe } from "@/lib/payments/stripe";
import { applyStripeEvent } from "@/lib/payments/stripeWebhook";

export const runtime = "nodejs";

/**
 * Signature verification needs the exact request bytes.
 * App Router has no bodyParser switch — request.text() is the raw body.
 * Do not call request.json() before constructEvent.
 */
export const dynamic = "force-dynamic";

function logLabel(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "/api/webhooks/stripe";
  }
}

function failure(status: 400 | 500) {
  return NextResponse.json(
    { error: status === 400 ? "Invalid signature" : "Failed to record payment" },
    { status }
  );
}

/**
 * Signed Stripe events record the payment and derive paymentStatus.
 * The Checkout return URL does not.
 */
export async function POST(request: Request) {
  const label = logLabel(request);
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!secret) {
    console.error(label, "Missing STRIPE_WEBHOOK_SECRET");
    return failure(500);
  }
  if (!signature) {
    return failure(400);
  }

  const payload = await request.text();

  let event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid signature";
    if (message.startsWith("Missing STRIPE_SECRET_KEY")) {
      console.error(label, message);
      return failure(500);
    }
    console.error(label, "signature", message);
    return failure(400);
  }

  try {
    const result = await applyStripeEvent(event);
    if (!result.ok) {
      console.error(label, event.id, result.error);
      return failure(500);
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(
      label,
      event.id,
      err instanceof Error ? err.message : "Failed to record payment"
    );
    return failure(500);
  }
}
