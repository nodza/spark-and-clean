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
  /** Stored on refund rows. Ignored when blank. */
  reason?: string;
  /** Original charge a refund applies to. Ignored when blank. */
  sourceProviderRef?: string;
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

export type SettlementCents = {
  /** Deposits and balance payments. This is what settles the invoice. */
  collectedCents: number;
  /** Collected minus refunds. This is cash still held, never below zero. */
  netCents: number;
};

/**
 * A refund returns money. It does not reopen the invoice, so collected cents
 * ignore refund rows. Net cents are what is still held, for refund limits
 * and for the "refund the overpayment" flag.
 */
export function settlementFromRows(
  rows: { amountCents?: number; kind?: string }[]
): SettlementCents {
  let collected = 0;
  let refunded = 0;
  for (const row of rows) {
    const cents = Number(row.amountCents);
    if (!Number.isFinite(cents) || cents < 0) continue;
    if (row.kind === "REFUND") refunded += cents;
    else if (row.kind === "DEPOSIT" || row.kind === "BALANCE") collected += cents;
  }
  return {
    collectedCents: collected,
    netCents: Math.max(0, collected - refunded),
  };
}

export async function settlementForBooking(
  bookingId: string
): Promise<SettlementCents> {
  await connectDB();
  const rows = await Payment.find({
    bookingId,
    status: "SUCCEEDED",
    kind: { $in: ["DEPOSIT", "BALANCE", "REFUND"] },
  })
    .select({ amountCents: 1, kind: 1 })
    .lean();
  return settlementFromRows(rows);
}

/** Cash still held after refunds. Used to cap how much can be refunded. */
export async function sumSucceededPaidCents(
  bookingId: string
): Promise<number> {
  const settlement = await settlementForBooking(bookingId);
  return settlement.netCents;
}

/** Money collected toward the invoice. Refunds do not reduce this. */
export async function sumCollectedCents(bookingId: string): Promise<number> {
  const settlement = await settlementForBooking(bookingId);
  return settlement.collectedCents;
}

/**
 * Invoice fields from a ledger settlement.
 * Collected cents settle the invoice. Refunds stay in the ledger and only
 * reduce cash still held, so a refund cannot raise the balance still owed.
 */
export function invoiceFromSettlement(
  settlement: SettlementCents,
  amountDueCents: number
): {
  amountPaidCents: number;
  paymentStatus: PaymentStatus;
  refundRequired: boolean;
  refundDueCents: number;
} {
  const due = Math.max(0, amountDueCents);
  const amountPaidCents = settlement.collectedCents;
  const refundDueCents = Math.max(0, settlement.netCents - due);
  return {
    amountPaidCents,
    paymentStatus: derivePaymentStatus(amountPaidCents, due),
    refundRequired: refundDueCents > 0,
    refundDueCents,
  };
}

/**
 * Rewrite a booking whose stored amount paid was reduced by an older refund.
 * No-ops when nothing has been refunded, or the snapshot already matches.
 */
export async function healInvoiceSettlement(bookingId: string): Promise<boolean> {
  await connectDB();
  const rows = await Payment.find({
    bookingId,
    status: "SUCCEEDED",
    kind: { $in: ["DEPOSIT", "BALANCE", "REFUND"] },
  })
    .select({ amountCents: 1, kind: 1 })
    .lean();
  const settlement = settlementFromRows(rows);
  if (settlement.collectedCents === settlement.netCents) return false;

  const booking = (await Booking.findOne({ id: bookingId }).lean()) as
    | (LedgerBooking & { paymentStatus?: string; refundRequired?: boolean; refundDueCents?: number })
    | null;
  if (!booking) return false;

  const amountDueCents = resolveAmountDueCents(toPaymentInput(booking));
  const next = invoiceFromSettlement(settlement, amountDueCents);
  const currentDue = booking.billing?.amountDueCents;
  const currentRefundDue =
    typeof booking.refundDueCents === "number" && Number.isFinite(booking.refundDueCents)
      ? Math.round(booking.refundDueCents)
      : -1;
  if (
    resolveAmountPaidCents(booking) === next.amountPaidCents &&
    booking.paymentStatus === next.paymentStatus &&
    booking.refundRequired === next.refundRequired &&
    currentDue === amountDueCents &&
    currentRefundDue === next.refundDueCents
  ) {
    return false;
  }

  const applied = await applyLedgerToBooking(bookingId);
  return applied.ok;
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
    const settlement = await settlementForBooking(bookingId);
    const next = invoiceFromSettlement(settlement, amountDueCents);
    const amountPaidCents = next.amountPaidCents;
    const paymentStatus = next.paymentStatus;
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
      {
        $set: {
          billing,
          paymentStatus,
          refundRequired: next.refundRequired,
          refundDueCents: next.refundDueCents,
        },
      }
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

type PreparedLedger =
  | {
      ok: false;
      error: "invalid_amount" | "invalid_currency" | "booking_not_found";
    }
  | {
      ok: true;
      amountCents: number;
      providerRef: string;
      bookingId: string;
      currency: string;
      provider: string;
      userId?: string;
      annotations: { reason?: string; sourceProviderRef?: string };
    };

function ledgerAnnotations(input: RecordSuccessInput): {
  reason?: string;
  sourceProviderRef?: string;
} {
  const reason = input.reason?.trim().slice(0, 500) ?? "";
  const sourceProviderRef = input.sourceProviderRef?.trim() ?? "";
  return {
    ...(reason ? { reason } : {}),
    ...(sourceProviderRef ? { sourceProviderRef } : {}),
  };
}

/**
 * Shared checks for a ledger insert. Currency and amount are rejected before
 * any booking read. A blank provider ref is an invalid amount, matching the
 * original success path.
 */
async function prepareLedgerWrite(
  input: RecordSuccessInput
): Promise<PreparedLedger> {
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

  const userId = ledgerUserId(input.userId) ?? ledgerUserId(booking.userId);
  return {
    ok: true,
    amountCents: Math.round(amountCents),
    providerRef,
    bookingId,
    currency,
    provider: String(input.provider).trim(),
    ...(userId ? { userId } : {}),
    annotations: ledgerAnnotations(input),
  };
}

export type RecordFailureResult =
  | { ok: true; applied: boolean }
  | {
      ok: false;
      error:
        | "duplicate_provider_ref"
        | "booking_not_found"
        | "invalid_amount"
        | "invalid_currency";
    };

/**
 * Persist a failed attempt. Idempotent on providerRef.
 * Does not change booking status or paymentStatus — failed cents are not paid cents.
 * A later success for the same provider ref upgrades this row instead of inserting another.
 */
export async function recordFailure(
  input: RecordSuccessInput
): Promise<RecordFailureResult> {
  if (input.kind !== "DEPOSIT" && input.kind !== "BALANCE") {
    return { ok: false, error: "invalid_amount" };
  }

  const prepared = await prepareLedgerWrite(input);
  if (!prepared.ok) return prepared;
  if (prepared.amountCents <= 0) {
    return { ok: false, error: "invalid_amount" };
  }

  const createdAt = new Date().toISOString();
  try {
    await Payment.create({
      provider: prepared.provider,
      providerRef: prepared.providerRef,
      bookingId: prepared.bookingId,
      ...(prepared.userId ? { userId: prepared.userId } : {}),
      kind: input.kind,
      amountCents: prepared.amountCents,
      currency: prepared.currency,
      status: "FAILED",
      createdAt,
      ...prepared.annotations,
    });
  } catch (err) {
    if (!isMongoDuplicateKeyError(err)) throw err;
    const existing = (await Payment.findOne({
      providerRef: prepared.providerRef,
    }).lean()) as StoredPayment | null;
    if (!existing || existing.bookingId !== prepared.bookingId) {
      return { ok: false, error: "duplicate_provider_ref" };
    }
    // Replay of the same failure, or a failure after the charge already succeeded.
    // Leave the row and the booking as they are.
    if (existing.status === "FAILED" || existing.status === "SUCCEEDED") {
      return { ok: true, applied: false };
    }
    return { ok: false, error: "duplicate_provider_ref" };
  }

  return { ok: true, applied: true };
}

/**
 * Succeeded deposit or balance for a provider id, used when a refund event
 * has no booking metadata of its own.
 */
export async function findSucceededTransfer(providerRef: string): Promise<{
  bookingId: string;
  userId?: string;
} | null> {
  const ref = providerRef.trim();
  if (!ref) return null;
  await connectDB();
  const row = (await Payment.findOne({
    providerRef: ref,
    status: "SUCCEEDED",
    kind: { $in: ["DEPOSIT", "BALANCE"] },
  }).lean()) as StoredPayment | null;
  const bookingId = String(row?.bookingId || "").trim();
  if (!bookingId) return null;
  const userId = ledgerUserId(row?.userId);
  return { bookingId, ...(userId ? { userId } : {}) };
}

/**
 * Persist a succeeded transfer and recompute billing + paymentStatus.
 * A duplicate providerRef does not add the amount again. If that row already
 * succeeded for this booking and the same kind, the snapshot is reconciled
 * from the ledger. A FAILED row for the same id is upgraded to SUCCEEDED so a
 * declined card that is then paid does not block the receipt.
 */
export async function recordSuccess(
  input: RecordSuccessInput
): Promise<RecordSuccessResult> {
  const prepared = await prepareLedgerWrite(input);
  if (!prepared.ok) return prepared;

  const {
    amountCents,
    providerRef,
    bookingId,
    currency,
    provider,
    annotations,
  } = prepared;
  const userId = prepared.userId;
  const createdAt = new Date().toISOString();

  try {
    await Payment.create({
      provider,
      providerRef,
      bookingId,
      ...(userId ? { userId } : {}),
      kind: input.kind,
      amountCents,
      currency,
      status: "SUCCEEDED",
      createdAt,
      ...annotations,
    });
  } catch (err) {
    if (!isMongoDuplicateKeyError(err)) throw err;

    const existing = (await Payment.findOne({ providerRef }).lean()) as
      | StoredPayment
      | null;
    if (!existing || existing.bookingId !== bookingId) {
      return { ok: false, error: "duplicate_provider_ref" };
    }

    const kindMismatch = Boolean(existing.kind && existing.kind !== input.kind);
    if (existing.status === "FAILED") {
      if (kindMismatch) {
        return { ok: false, error: "duplicate_provider_ref" };
      }
      const upgraded = await Payment.updateOne(
        { providerRef, bookingId, status: "FAILED" },
        {
          $set: {
            status: "SUCCEEDED",
            amountCents,
            currency,
            kind: input.kind,
            provider,
            createdAt,
          },
        }
      );
      if (upgraded.matchedCount === 0) {
        const again = (await Payment.findOne({ providerRef }).lean()) as
          | StoredPayment
          | null;
        if (
          !again ||
          again.bookingId !== bookingId ||
          again.status !== "SUCCEEDED" ||
          (again.kind && again.kind !== input.kind)
        ) {
          return { ok: false, error: "duplicate_provider_ref" };
        }
      }
    } else if (existing.status !== "SUCCEEDED" || kindMismatch) {
      return { ok: false, error: "duplicate_provider_ref" };
    }

    const applied = await applyLedgerToBooking(bookingId);
    if (!applied.ok) return applied;

    const upgradedAmount = existing.status === "FAILED";
    return {
      ok: true,
      payment: {
        provider: String(existing.provider || provider),
        providerRef,
        bookingId,
        ...(existing.userId || userId
          ? { userId: existing.userId || userId }
          : {}),
        kind: existing.kind && !upgradedAmount ? existing.kind : input.kind,
        amountCents: upgradedAmount
          ? amountCents
          : Math.round(Number(existing.amountCents) || 0),
        currency: LEDGER_CURRENCY,
        status: "SUCCEEDED",
        createdAt: upgradedAmount ? createdAt : existing.createdAt || createdAt,
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
      amountCents,
      currency,
      status: "SUCCEEDED",
      createdAt,
    },
    billing: applied.billing,
    paymentStatus: applied.paymentStatus,
  };
}
