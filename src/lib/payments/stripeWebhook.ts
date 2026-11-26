import type Stripe from "stripe";
import {
  findSucceededTransfer,
  recordFailure,
  recordSuccess,
  type RecordFailureResult,
  type RecordSuccessResult,
} from "@/lib/payments/ledger";
import { getStripe } from "@/lib/payments/stripe";

/** Ledger provider id. Checkout requests say STRIPE; rows are stored as stripe. */
const STRIPE_PROVIDER = "stripe";

type Ignored = { ok: true; applied: false };
type RecordedFailure = { ok: true; applied: true };
type FulfillResult = RecordSuccessResult | RecordFailureResult | Ignored | RecordedFailure;

function isPayableKind(
  kind: string | undefined
): kind is "DEPOSIT" | "BALANCE" {
  return kind === "DEPOSIT" || kind === "BALANCE";
}

function stripeId(
  value: string | { id?: string | null } | null | undefined
): string {
  if (typeof value === "string") return value.trim();
  return (value?.id || "").trim();
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
  const providerRef = (stripeId(session.payment_intent) || session.id || "").trim();

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
 * A declined or abandoned attempt. providerRef is the PaymentIntent id when
 * Stripe has one, so checkout.session.async_payment_failed and
 * payment_intent.payment_failed share one row. The booking is left unchanged.
 */
async function recordStripeFailure(input: {
  providerRef: string;
  bookingId: string;
  kind: string | undefined;
  amountCents: number;
  currency?: string | null;
}): Promise<FulfillResult> {
  const providerRef = input.providerRef.trim();
  const bookingId = input.bookingId.trim();
  if (!providerRef || !bookingId || !isPayableKind(input.kind)) {
    return { ok: true, applied: false };
  }
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    return { ok: true, applied: false };
  }

  return recordFailure({
    provider: STRIPE_PROVIDER,
    providerRef,
    bookingId,
    kind: input.kind,
    amountCents: input.amountCents,
    currency: input.currency || "ZAR",
  });
}

export async function fulfillFailedCheckoutSession(session: {
  id?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  client_reference_id?: string | null;
  payment_intent?: string | { id?: string | null } | null;
  metadata?: Stripe.Metadata | null;
}): Promise<FulfillResult> {
  const bookingId = (
    session.metadata?.bookingId ||
    session.client_reference_id ||
    ""
  ).trim();
  return recordStripeFailure({
    providerRef: stripeId(session.payment_intent) || session.id || "",
    bookingId,
    kind: session.metadata?.kind,
    amountCents: Number(session.amount_total),
    currency: session.currency,
  });
}

export async function fulfillFailedPaymentIntent(intent: {
  id?: string | null;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  metadata?: Stripe.Metadata | null;
}): Promise<FulfillResult> {
  if (intent.status === "succeeded") {
    return { ok: true, applied: false };
  }
  return recordStripeFailure({
    providerRef: intent.id || "",
    bookingId: intent.metadata?.bookingId || "",
    kind: intent.metadata?.kind,
    amountCents: Number(intent.amount),
    currency: intent.currency,
  });
}

type RefundSlice = {
  id?: string | null;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  metadata?: Stripe.Metadata | null;
};

function refundCounts(status: string | null | undefined): boolean {
  const value = (status || "succeeded").trim().toLowerCase();
  return value === "succeeded" || value === "pending";
}

function normalizeRefunds(rows: RefundSlice[] | null | undefined): RefundSlice[] {
  if (!rows) return [];
  return rows.filter((row) => {
    const id = (row.id || "").trim();
    const amount = Number(row.amount);
    return Boolean(id) && Number.isFinite(amount) && amount > 0 && refundCounts(row.status);
  });
}

/**
 * charge.refunded carries the charge, including the newest refunds.
 * Each refund id is its own ledger row, so a second partial refund is new
 * and a replay of the same refund id is not.
 */
async function refundsOnCharge(charge: {
  id?: string | null;
  refunds?: { data?: RefundSlice[] | null } | null;
}): Promise<RefundSlice[]> {
  const inline = normalizeRefunds(charge.refunds?.data);
  if (inline.length > 0) return inline;

  const chargeId = (charge.id || "").trim();
  if (!chargeId) return [];
  const listed = await getStripe().refunds.list({ charge: chargeId, limit: 100 });
  return normalizeRefunds(listed.data);
}

export async function fulfillChargeRefunded(charge: {
  id?: string | null;
  currency?: string | null;
  payment_intent?: string | { id?: string | null } | null;
  metadata?: Stripe.Metadata | null;
  refunds?: { data?: RefundSlice[] | null } | null;
}): Promise<FulfillResult> {
  const paymentIntentId = stripeId(charge.payment_intent);
  let bookingId = (charge.metadata?.bookingId || "").trim();
  if (!bookingId && paymentIntentId) {
    const original = await findSucceededTransfer(paymentIntentId);
    bookingId = original?.bookingId || "";
  }
  if (!bookingId) return { ok: true, applied: false };

  const refunds = await refundsOnCharge(charge);
  if (refunds.length === 0) return { ok: true, applied: false };

  // Oldest first so a retry after a partial write continues cleanly.
  let last: RecordSuccessResult | null = null;
  for (const refund of [...refunds].reverse()) {
    const providerRef = (refund.id || "").trim();
    const reason =
      typeof refund.metadata?.reason === "string" ? refund.metadata.reason : undefined;
    const recorded = await recordSuccess({
      provider: STRIPE_PROVIDER,
      providerRef,
      bookingId,
      kind: "REFUND",
      amountCents: Number(refund.amount),
      currency: refund.currency || charge.currency || "ZAR",
      ...(paymentIntentId ? { sourceProviderRef: paymentIntentId } : {}),
      ...(reason ? { reason } : {}),
    });
    if (!recorded.ok) return recorded;
    last = recorded;
  }

  return last ?? { ok: true, applied: false };
}

/**
 * Apply one verified Stripe event.
 * Success, failure, and refund rows are idempotent on the Stripe object id
 * (PaymentIntent id, else Checkout Session id, or the Refund id).
 * Replaying the same id does not add the amount again.
 * Unrelated event types are ignored.
 */
export async function applyStripeEvent(event: Stripe.Event): Promise<FulfillResult> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return fulfillPaidCheckoutSession(event.data.object);
    case "checkout.session.async_payment_failed":
      return fulfillFailedCheckoutSession(event.data.object);
    case "payment_intent.succeeded":
      return fulfillSucceededPaymentIntent(event.data.object);
    case "payment_intent.payment_failed":
      return fulfillFailedPaymentIntent(event.data.object);
    case "charge.refunded":
      return fulfillChargeRefunded(event.data.object);
    default:
      return { ok: true, applied: false };
  }
}
