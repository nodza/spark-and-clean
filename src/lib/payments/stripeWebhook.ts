import type Stripe from "stripe";
import { recordSuccess } from "@/lib/payments/ledger";

/**
 * A paid Checkout Session is the only event that may update the ledger.
 * The browser return URL does not call this.
 * Booking userId is stamped inside recordSuccess from the booking it loads.
 */
export async function fulfillPaidCheckoutSession(session: {
  id?: string | null;
  payment_status?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  client_reference_id?: string | null;
  payment_intent?: string | { id?: string | null } | null;
  metadata?: Stripe.Metadata | null;
}) {
  if (session.payment_status !== "paid") {
    return { ok: true as const, applied: false };
  }

  const bookingId = (
    session.metadata?.bookingId ||
    session.client_reference_id ||
    ""
  ).trim();
  const kind = session.metadata?.kind;
  if (!bookingId || (kind !== "DEPOSIT" && kind !== "BALANCE")) {
    return { ok: true as const, applied: false };
  }

  const paymentIntent = session.payment_intent;
  const providerRef =
    typeof paymentIntent === "string"
      ? paymentIntent
      : paymentIntent?.id || session.id || "";

  return recordSuccess({
    provider: "stripe",
    providerRef,
    bookingId,
    kind,
    amountCents: Number(session.amount_total),
    currency: session.currency || "ZAR",
  });
}
