import type Stripe from "stripe";
import { recordSuccess, type RecordSuccessResult } from "@/lib/payments/ledger";

/** Ledger provider id. Checkout requests say STRIPE; rows are stored as stripe. */
const STRIPE_PROVIDER = "stripe";

type Ignored = { ok: true; applied: false };
type FulfillResult = RecordSuccessResult | Ignored;

function isPayableKind(
  kind: string | undefined
): kind is "DEPOSIT" | "BALANCE" {
  return kind === "DEPOSIT" || kind === "BALANCE";
}

/**
 * A paid Checkout Session may update the ledger.
 * The browser return URL does not call this. Unpaid sessions (including
 * checkout.session.completed for a delayed payment method) are ignored.
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
}): Promise<FulfillResult> {
  if (session.payment_status !== "paid") {
    return { ok: true, applied: false };
  }

  const bookingId = (
    session.metadata?.bookingId ||
    session.client_reference_id ||
    ""
  ).trim();
  const kind = session.metadata?.kind;
  const paymentIntent = session.payment_intent;
  const providerRef = (
    typeof paymentIntent === "string"
      ? paymentIntent
      : paymentIntent?.id || session.id || ""
  ).trim();

  if (!providerRef || !bookingId || !isPayableKind(kind)) {
    return { ok: true, applied: false };
  }

  return recordSuccess({
    provider: STRIPE_PROVIDER,
    providerRef,
    bookingId,
    kind,
    amountCents: Number(session.amount_total),
    currency: session.currency || "ZAR",
  });
}

/**
 * payment_intent.succeeded for the same charge as Checkout.
 * providerRef is the PaymentIntent id, so this and checkout.session.completed
 * insert one ledger row.
 */
export async function fulfillSucceededPaymentIntent(intent: {
  id?: string | null;
  amount?: number | null;
  amount_received?: number | null;
  currency?: string | null;
  status?: string | null;
  metadata?: Stripe.Metadata | null;
}): Promise<FulfillResult> {
  if (intent.status && intent.status !== "succeeded") {
    return { ok: true, applied: false };
  }

  const bookingId = (intent.metadata?.bookingId || "").trim();
  const kind = intent.metadata?.kind;
  const providerRef = (intent.id || "").trim();
  if (!providerRef || !bookingId || !isPayableKind(kind)) {
    return { ok: true, applied: false };
  }

  const received = Number(intent.amount_received);
  const amountCents =
    Number.isFinite(received) && received > 0 ? received : Number(intent.amount);

  return recordSuccess({
    provider: STRIPE_PROVIDER,
    providerRef,
    bookingId,
    kind,
    amountCents,
    currency: intent.currency || "ZAR",
  });
}

/**
 * Apply one verified Stripe event.
 * Idempotent on providerRef (PaymentIntent id, else Checkout Session id):
 * replaying the same event id hits that same providerRef and does not add cents.
 * Unrelated event types are ignored.
 */
export async function applyStripeEvent(event: Stripe.Event): Promise<FulfillResult> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return fulfillPaidCheckoutSession(event.data.object);
    case "payment_intent.succeeded":
      return fulfillSucceededPaymentIntent(event.data.object);
    default:
      return { ok: true, applied: false };
  }
}
