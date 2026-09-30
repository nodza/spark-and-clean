import type Stripe from "stripe";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { recordSuccess } from "@/lib/payments/ledger";

/**
 * A paid Checkout Session is the only event that may update the ledger.
 * The browser return URL does not call this.
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

  await connectDB();
  const booking = await Booking.findOne({ id: bookingId })
    .select({ userId: 1 })
    .lean();
  const userId =
    booking && typeof booking.userId === "string" && booking.userId.trim()
      ? booking.userId.trim()
      : undefined;

  return recordSuccess({
    provider: "stripe",
    providerRef,
    bookingId,
    ...(userId ? { userId } : {}),
    kind,
    amountCents: Number(session.amount_total),
    currency: session.currency || "ZAR",
  });
}
