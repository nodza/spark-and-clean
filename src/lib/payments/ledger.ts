import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import {
  Payment,
  type PaymentKind,
  type PaymentProvider,
} from "@/models/Payment";
import type {
  BookingBilling,
  PaymentStatus,
} from "@/types/booking";
import { amountDueCentsForBooking } from "@/lib/payments/deposit";

export type BookingPaymentInput = {
  estimatedPriceMin: number;
  estimatedPriceMax: number;
  billing?: BookingBilling | null;
  promotion?: { amountDueCents?: number } | null;
};

export type RecordSuccessInput = {
  provider: PaymentProvider;
  providerRef: string;
  bookingId: string;
  userId?: string;
  kind: PaymentKind;
  amountCents: number;
  currency?: string;
};

export type RecordSuccessResult =
  | {
      ok: true;
      payment: {
        provider: string;
        providerRef: string;
        bookingId: string;
        userId?: string;
        kind: PaymentKind;
        amountCents: number;
        currency: string;
        status: "SUCCEEDED";
        createdAt: string;
      };
      billing: BookingBilling;
      paymentStatus: PaymentStatus;
    }
  | {
      ok: false;
      error:
        | "duplicate_provider_ref"
        | "booking_not_found"
        | "invalid_amount"
        | "invalid_currency";
    };

const LEDGER_CURRENCY = "ZAR";
const BILLING_WRITE_ATTEMPTS = 5;

/** Estimate midpoint in cents (rand prices → cents). */
export function estimateMidpointCents(
  estimatedPriceMin: number,
  estimatedPriceMax: number
): number {
  const min = Number(estimatedPriceMin);
  const max = Number(estimatedPriceMax);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return 0;
  return Math.max(0, Math.round(((min + max) / 2) * 100));
}

/**
 * amountDue: E8 promotion.amountDueCents when set; else the first saved
 * billing snapshot; else the estimate midpoint.
 */
export function resolveAmountDueCents(booking: BookingPaymentInput): number {
  return amountDueCentsForBooking(booking);
}

export function resolveAmountPaidCents(booking: BookingPaymentInput): number {
  const paid = booking.billing?.amountPaidCents;
  if (typeof paid === "number" && Number.isFinite(paid) && paid >= 0) {
    return Math.round(paid);
  }
  return 0;
}

/**
 * Derive booking.paymentStatus from cents paid vs cents due.
 * Due of 0 is PAID. Otherwise UNPAID when nothing is paid,
 * DEPOSIT when paid is short, and PAID when paid covers the due amount.
 */
export function derivePaymentStatus(
  amountPaidCents: number,
  amountDueCents: number
): PaymentStatus {
  const paid = Math.max(0, amountPaidCents);
  const due = Math.max(0, amountDueCents);
  if (due <= 0) return "PAID";
  if (paid <= 0) return "UNPAID";
  if (paid < due) return "DEPOSIT";
  return "PAID";
}

/** Pure recompute from a booking snapshot (missing billing → paid 0, due = midpoint). */
export function recomputeBookingPaymentStatus(
  booking: BookingPaymentInput
): PaymentStatus {
  return derivePaymentStatus(
    resolveAmountPaidCents(booking),
    resolveAmountDueCents(booking)
  );
}

export function isMongoDuplicateKeyError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  if ("code" in err && (err as { code: unknown }).code === 11000) return true;
  if ("cause" in err) {
    return isMongoDuplicateKeyError((err as { cause: unknown }).cause);
  }
  return false;
}

/**
 * Net succeeded cents for a booking. Deposits and balance payments add;
 * refunds subtract. The booking snapshot never stores a negative paid total.
 */
export async function sumSucceededPaidCents(
  bookingId: string
): Promise<number> {
  await connectDB();
  const rows = await Payment.find({
    bookingId,
    status: "SUCCEEDED",
    kind: { $in: ["DEPOSIT", "BALANCE", "REFUND"] },
  })
    .select({ amountCents: 1, kind: 1 })
    .lean();

  const net = rows.reduce((sum, row) => {
    const cents = Number(row.amountCents);
    if (!Number.isFinite(cents)) return sum;
    return row.kind === "REFUND" ? sum - cents : sum + cents;
  }, 0);
  return Math.max(0, net);
}

type LedgerBooking = BookingPaymentInput & {
  id?: string;
  userId?: unknown;
  billing?: BookingBilling | null;
};

/** ObjectId, string, or anything String()-able from a lean booking. */
export function ledgerUserId(value: unknown): string | undefined {
  if (value == null) return undefined;
  const id = String(value).trim();
  return id.length > 0 && id !== "undefined" ? id : undefined;
}

function toPaymentInput(booking: LedgerBooking): BookingPaymentInput {
  return {
    estimatedPriceMin: Number(booking.estimatedPriceMin),
    estimatedPriceMax: Number(booking.estimatedPriceMax),
    billing: booking.billing,
    promotion: booking.promotion,
  };
}

/**
 * Write the ledger sum onto the booking only while paid cents are still the
 * value we read. A slower writer then retries instead of clobbering a newer total.
 */
async function applyLedgerToBooking(
  bookingId: string
): Promise<
  | { ok: true; billing: BookingBilling; paymentStatus: PaymentStatus }
  | { ok: false; error: "booking_not_found" }
> {
  for (let attempt = 0; attempt < BILLING_WRITE_ATTEMPTS; attempt += 1) {
    const booking = (await Booking.findOne({ id: bookingId }).lean()) as
      | LedgerBooking
      | null;
    if (!booking) return { ok: false, error: "booking_not_found" };

    const snapshot = toPaymentInput(booking);
    const amountDueCents = resolveAmountDueCents(snapshot);
    const seenPaid = resolveAmountPaidCents(snapshot);
    const amountPaidCents = await sumSucceededPaidCents(bookingId);
    const paymentStatus = derivePaymentStatus(amountPaidCents, amountDueCents);
    const billing: BookingBilling = {
      currency: LEDGER_CURRENCY,
      amountDueCents,
      amountPaidCents,
    };

    const paidStillUnchanged =
      seenPaid === 0
        ? [
            { "billing.amountPaidCents": seenPaid },
            { billing: { $exists: false } },
            { billing: null },
          ]
        : [{ "billing.amountPaidCents": seenPaid }];

    const updated = await Booking.updateOne(
      { id: bookingId, $or: paidStillUnchanged },
      { $set: { billing, paymentStatus } }
    );

    if (updated.matchedCount > 0) {
      return { ok: true, billing, paymentStatus };
    }
  }

  throw new Error("Could not update booking billing");
}

type StoredPayment = {
  provider?: string;
  providerRef?: string;
  bookingId?: string;
  userId?: string;
  kind?: PaymentKind;
  amountCents?: number;
  currency?: string;
  status?: string;
  createdAt?: string;
};

/**
 * Persist a succeeded transfer and recompute billing + paymentStatus.
 * A duplicate providerRef does not add the amount again. If that row already
 * succeeded for this booking, the booking snapshot is reconciled from the ledger
 * so a retry after a partial write still marks the booking paid.
 */
export async function recordSuccess(
  input: RecordSuccessInput
): Promise<RecordSuccessResult> {
  const amountCents = Number(input.amountCents);
  if (!Number.isFinite(amountCents) || amountCents < 0) {
    return { ok: false, error: "invalid_amount" };
  }

  const providerRef = String(input.providerRef || "").trim();
  const bookingId = String(input.bookingId || "").trim();
  if (!providerRef || !bookingId) {
    return { ok: false, error: "invalid_amount" };
  }

  const currency = (input.currency || LEDGER_CURRENCY).trim().toUpperCase();
  if (currency !== LEDGER_CURRENCY) {
    return { ok: false, error: "invalid_currency" };
  }

  await connectDB();

  const booking = (await Booking.findOne({ id: bookingId }).lean()) as
    | LedgerBooking
    | null;
  if (!booking) {
    return { ok: false, error: "booking_not_found" };
  }

  const snapshotCurrency = String(booking.billing?.currency || "")
    .trim()
    .toUpperCase();
  if (snapshotCurrency && snapshotCurrency !== LEDGER_CURRENCY) {
    return { ok: false, error: "invalid_currency" };
  }

  const createdAt = new Date().toISOString();
  const userId =
    ledgerUserId(input.userId) ?? ledgerUserId(booking.userId);
  const provider = String(input.provider).trim();

  try {
    await Payment.create({
      provider,
      providerRef,
      bookingId,
      ...(userId ? { userId } : {}),
      kind: input.kind,
      amountCents: Math.round(amountCents),
      currency,
      status: "SUCCEEDED",
      createdAt,
    });
  } catch (err) {
    if (!isMongoDuplicateKeyError(err)) throw err;

    const existing = (await Payment.findOne({ providerRef }).lean()) as
      | StoredPayment
      | null;
    if (
      !existing ||
      existing.bookingId !== bookingId ||
      existing.status !== "SUCCEEDED"
    ) {
      return { ok: false, error: "duplicate_provider_ref" };
    }

    const applied = await applyLedgerToBooking(bookingId);
    if (!applied.ok) return applied;

    return {
      ok: true,
      payment: {
        provider: String(existing.provider || provider),
        providerRef,
        bookingId,
        ...(existing.userId ? { userId: existing.userId } : {}),
        kind: existing.kind || input.kind,
        amountCents: Math.round(Number(existing.amountCents) || 0),
        currency: LEDGER_CURRENCY,
        status: "SUCCEEDED",
        createdAt: existing.createdAt || createdAt,
      },
      billing: applied.billing,
      paymentStatus: applied.paymentStatus,
    };
  }

  const applied = await applyLedgerToBooking(bookingId);
  if (!applied.ok) return applied;

  return {
    ok: true,
    payment: {
      provider,
      providerRef,
      bookingId,
      ...(userId ? { userId } : {}),
      kind: input.kind,
      amountCents: Math.round(amountCents),
      currency,
      status: "SUCCEEDED",
      createdAt,
    },
    billing: applied.billing,
    paymentStatus: applied.paymentStatus,
  };
}
