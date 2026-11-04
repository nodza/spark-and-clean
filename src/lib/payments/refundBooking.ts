import { connectDB } from "@/lib/mongodb";
import {
  recordSuccess,
  sumSucceededPaidCents,
  type RecordSuccessResult,
} from "@/lib/payments/ledger";
import { getStripe } from "@/lib/payments/stripe";
import { Payment, type PaymentKind } from "@/models/Payment";
import type { BookingBilling, PaymentStatus } from "@/types/booking";

const REASON_MAX = 500;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_.:-]{8,255}$/;
const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9 ._:/-]{0,79}$/;

export type RefundBookingInput = {
  bookingId: string;
  sourceProviderRef: string;
  amountCents: number;
  reason: string;
  reference?: string;
  idempotencyKey?: string;
};

export type RefundField = "amount" | "reason" | "reference";

export type RefundBookingResult =
  | {
      ok: true;
      synced?: boolean;
      paymentStatus: PaymentStatus;
      billing: BookingBilling;
      payment: {
        provider: string;
        providerRef: string;
        kind: "REFUND";
        amountCents: number;
        status: "SUCCEEDED";
      };
    }
  | {
      ok: false;
      status: number;
      message: string;
      field?: RefundField;
    };

type SourcePayment = {
  provider?: string;
  providerRef?: string;
  bookingId?: string;
  kind?: PaymentKind;
  amountCents?: number;
  currency?: string;
  status?: string;
};

type StripeRefund = {
  id: string;
  amount: number;
  currency: string;
  status: string | null;
};

export type StripeRefundClient = {
  createRefund: (input: {
    paymentIntentId?: string;
    chargeId?: string;
    amountCents: number;
    idempotencyKey: string;
    metadata: Record<string, string>;
  }) => Promise<StripeRefund>;
  listRefunds: (paymentIntentId: string) => Promise<StripeRefund[]>;
};

function fail(
  status: number,
  message: string,
  field?: RefundField
): RefundBookingResult {
  return { ok: false, status, message, ...(field ? { field } : {}) };
}

function countsAsRefund(status: string | null | undefined): boolean {
  const value = (status || "").trim().toLowerCase();
  return value === "succeeded" || value === "pending";
}

function stripeErrorCode(err: unknown): string {
  if (typeof err !== "object" || err === null || !("code" in err)) return "";
  return String((err as { code?: unknown }).code || "");
}

async function defaultStripeClient(): Promise<StripeRefundClient> {
  const stripe = getStripe();
  return {
    async createRefund(input) {
      const refund = await stripe.refunds.create(
        {
          amount: input.amountCents,
          ...(input.paymentIntentId
            ? { payment_intent: input.paymentIntentId }
            : {}),
          ...(input.chargeId ? { charge: input.chargeId } : {}),
          reason: "requested_by_customer",
          metadata: input.metadata,
        },
        { idempotencyKey: input.idempotencyKey }
      );
      return {
        id: refund.id,
        amount: refund.amount,
        currency: refund.currency,
        status: refund.status,
      };
    },
    async listRefunds(paymentIntentId) {
      const list = await stripe.refunds.list({
        payment_intent: paymentIntentId,
        limit: 100,
      });
      return list.data.map((refund) => ({
        id: refund.id,
        amount: refund.amount,
        currency: refund.currency,
        status: refund.status,
      }));
    },
  };
}

function fromRecord(result: RecordSuccessResult): RefundBookingResult {
  if (!result.ok) {
    if (result.error === "booking_not_found") {
      return fail(404, "This booking could not be found.");
    }
    if (result.error === "invalid_currency") {
      return fail(400, "Only ZAR payments can be refunded.");
    }
    if (result.error === "duplicate_provider_ref") {
      return fail(
        409,
        "That reference is already on the ledger. Nothing was added again.",
        "reference"
      );
    }
    return fail(400, "Enter a refund amount greater than zero.", "amount");
  }
  return {
    ok: true,
    paymentStatus: result.paymentStatus,
    billing: result.billing,
    payment: {
      provider: result.payment.provider,
      providerRef: result.payment.providerRef,
      kind: "REFUND",
      amountCents: result.payment.amountCents,
      status: "SUCCEEDED",
    },
  };
}

async function refundedAgainst(
  bookingId: string,
  sourceProviderRef: string
): Promise<number> {
  const rows = await Payment.find({
    bookingId,
    kind: "REFUND",
    status: "SUCCEEDED",
    sourceProviderRef,
  })
    .select({ amountCents: 1 })
    .lean();
  return rows.reduce((sum, row) => {
    const cents = Number(row.amountCents);
    return sum + (Number.isFinite(cents) ? cents : 0);
  }, 0);
}

/**
 * Refund part or all of one succeeded charge and recompute payment status.
 * Stripe card payments are refunded through the Refunds API. Ozow and other
 * providers are recorded by hand with the reference the admin already issued.
 */
export async function refundBookingPayment(
  input: RefundBookingInput,
  deps?: { stripe?: StripeRefundClient }
): Promise<RefundBookingResult> {
  const bookingId = input.bookingId.trim();
  const sourceProviderRef = input.sourceProviderRef.trim();
  const reason = input.reason.trim();
  const amountCents = Number(input.amountCents);

  if (!bookingId || !sourceProviderRef) {
    return fail(404, "That payment is not on this booking.");
  }
  if (!Number.isInteger(amountCents) || amountCents < 1) {
    return fail(400, "Enter a refund amount greater than zero.", "amount");
  }
  if (!reason) {
    return fail(400, "Enter a reason for this refund.", "reason");
  }
  if (reason.length > REASON_MAX) {
    return fail(400, "Keep the reason under 500 characters.", "reason");
  }

  await connectDB();
  const source = (await Payment.findOne({
    bookingId,
    providerRef: sourceProviderRef,
  }).lean()) as SourcePayment | null;

  if (!source) {
    return fail(404, "That payment is not on this booking.");
  }
  if (
    source.status !== "SUCCEEDED" ||
    (source.kind !== "DEPOSIT" && source.kind !== "BALANCE")
  ) {
    return fail(400, "This payment cannot be refunded.");
  }

  const sourceAmount = Math.round(Number(source.amountCents) || 0);
  const already = await refundedAgainst(bookingId, sourceProviderRef);
  const netPaid = await sumSucceededPaidCents(bookingId);
  const maxCents = Math.min(Math.max(0, sourceAmount - already), netPaid);
  if (maxCents < 1) {
    return fail(400, "This payment has already been refunded.");
  }
  if (amountCents > maxCents) {
    return fail(
      400,
      "That amount is more than what is left to refund.",
      "amount"
    );
  }

  const provider = String(source.provider || "").trim().toLowerCase();
  const refundProvider = provider || "manual";

  if (provider === "stripe") {
    const idempotencyKey = (input.idempotencyKey || "").trim();
    if (!IDEMPOTENCY_KEY.test(idempotencyKey)) {
      return fail(400, "Could not start this refund. Refresh the page and try again.");
    }
    const paymentIntentId = sourceProviderRef.startsWith("pi_")
      ? sourceProviderRef
      : undefined;
    const chargeId = sourceProviderRef.startsWith("ch_")
      ? sourceProviderRef
      : undefined;
    if (!paymentIntentId && !chargeId) {
      return fail(400, "This Stripe payment cannot be refunded from here.");
    }

    const stripe = deps?.stripe ?? (await defaultStripeClient());
    const metadata = {
      bookingId,
      sourceProviderRef,
      reason,
    };

    let created: StripeRefund;
    try {
      created = await stripe.createRefund({
        paymentIntentId,
        chargeId,
        amountCents,
        idempotencyKey,
        metadata,
      });
    } catch (err) {
      if (stripeErrorCode(err) === "charge_already_refunded" && paymentIntentId) {
        const syncedResult = await syncStripeRefunds({
          stripe,
          bookingId,
          paymentIntentId,
          reason,
        });
        if (syncedResult) return syncedResult;
      }
      console.error(
        "[refundBooking] stripe",
        err instanceof Error ? err.message : "stripe refund failed"
      );
      const code = stripeErrorCode(err);
      if (code === "amount_too_large") {
        return fail(
          400,
          "That amount is more than Stripe can refund on this payment.",
          "amount"
        );
      }
      return fail(502, "Stripe could not refund this card. Nothing new was recorded.");
    }

    if (!countsAsRefund(created.status)) {
      return fail(502, "Stripe could not refund this card. Nothing new was recorded.");
    }
    const recordedAmount = Number(created.amount);
    const ledger = await recordSuccess({
      provider: "stripe",
      providerRef: created.id,
      bookingId,
      kind: "REFUND",
      amountCents:
        Number.isFinite(recordedAmount) && recordedAmount > 0
          ? recordedAmount
          : amountCents,
      currency: created.currency || "ZAR",
      reason,
      sourceProviderRef,
    });
    return fromRecord(ledger);
  }

  const reference = (input.reference || "").trim();
  if (!reference) {
    return fail(
      400,
      provider === "ozow"
        ? "Enter the Ozow refund reference."
        : "Enter the refund reference.",
      "reference"
    );
  }
  if (!REFERENCE.test(reference)) {
    return fail(
      400,
      "Use letters, numbers, and dashes for the reference.",
      "reference"
    );
  }

  const ledger = await recordSuccess({
    provider: refundProvider,
    providerRef: reference,
    bookingId,
    kind: "REFUND",
    amountCents,
    currency: "ZAR",
    reason,
    sourceProviderRef,
  });
  return fromRecord(ledger);
}

async function syncStripeRefunds(input: {
  stripe: StripeRefundClient;
  bookingId: string;
  paymentIntentId: string;
  reason: string;
}): Promise<RefundBookingResult | null> {
  let listed: StripeRefund[];
  try {
    listed = await input.stripe.listRefunds(input.paymentIntentId);
  } catch (err) {
    console.error(
      "[refundBooking] stripe list",
      err instanceof Error ? err.message : "stripe list failed"
    );
    return null;
  }

  let last: RefundBookingResult | null = null;
  for (const refund of listed) {
    if (!refund.id || !countsAsRefund(refund.status) || refund.amount < 1) continue;
    const recorded = await recordSuccess({
      provider: "stripe",
      providerRef: refund.id,
      bookingId: input.bookingId,
      kind: "REFUND",
      amountCents: refund.amount,
      currency: refund.currency || "ZAR",
      reason: input.reason,
      sourceProviderRef: input.paymentIntentId,
    });
    const result = fromRecord(recorded);
    if (!result.ok) return result;
    last = result;
  }
  if (!last || !last.ok) return null;
  return { ...last, synced: true };
}
