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
  | { ok: false; error: "duplicate_provider_ref" | "booking_not_found" | "invalid_amount" };

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
 * amountDue: E8 promotion.amountDueCents when set; else estimate midpoint.
 * Missing billing does not block — helpers still resolve due/paid.
 */
export function resolveAmountDueCents(booking: BookingPaymentInput): number {
  const promo = booking.promotion?.amountDueCents;
  if (typeof promo === "number" && Number.isFinite(promo) && promo >= 0) {
    return Math.round(promo);
  }
  return estimateMidpointCents(
    booking.estimatedPriceMin,
    booking.estimatedPriceMax
  );
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
 * UNPAID: paid <= 0; DEPOSIT: 0 < paid < due; PAID: paid >= due.
 */
export function derivePaymentStatus(
  amountPaidCents: number,
  amountDueCents: number
): PaymentStatus {
  const paid = Math.max(0, amountPaidCents);
  const due = Math.max(0, amountDueCents);
  if (paid <= 0) return "UNPAID";
  if (due > 0 && paid < due) return "DEPOSIT";
  if (due <= 0 && paid > 0) return "PAID";
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
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === 11000
  );
}

/** Sum succeeded charge kinds for a booking (refunds are not added). */
export async function sumSucceededPaidCents(
  bookingId: string
): Promise<number> {
  await connectDB();
  const rows = await Payment.find({
    bookingId,
    status: "SUCCEEDED",
    kind: { $in: ["DEPOSIT", "BALANCE"] },
  })
    .select({ amountCents: 1 })
    .lean();

  return rows.reduce((sum, row) => {
    const cents = Number(row.amountCents);
    return sum + (Number.isFinite(cents) ? cents : 0);
  }, 0);
}

/**
 * Persist a succeeded transfer, recompute billing + paymentStatus.
 * Duplicate providerRef is rejected; amountPaidCents does not double.
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

  await connectDB();

  const booking = await Booking.findOne({ id: bookingId }).lean();
  if (!booking) {
    return { ok: false, error: "booking_not_found" };
  }

  const currency = (input.currency || "ZAR").trim() || "ZAR";
  const createdAt = new Date().toISOString();
  const userId =
    typeof input.userId === "string" && input.userId.trim()
      ? input.userId.trim()
      : undefined;

  try {
    await Payment.create({
      provider: String(input.provider).trim(),
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
    if (isMongoDuplicateKeyError(err)) {
      return { ok: false, error: "duplicate_provider_ref" };
    }
    throw err;
  }

  const amountDueCents = resolveAmountDueCents({
    estimatedPriceMin: Number(booking.estimatedPriceMin),
    estimatedPriceMax: Number(booking.estimatedPriceMax),
    billing: booking.billing as BookingBilling | undefined,
    promotion: booking.promotion as { amountDueCents?: number } | undefined,
  });
  const amountPaidCents = await sumSucceededPaidCents(bookingId);
  const paymentStatus = derivePaymentStatus(amountPaidCents, amountDueCents);
  const billing: BookingBilling = {
    currency,
    amountDueCents,
    amountPaidCents,
  };

  await Booking.updateOne(
    { id: bookingId },
    {
      $set: {
        billing,
        paymentStatus,
      },
    }
  );

  return {
    ok: true,
    payment: {
      provider: String(input.provider).trim(),
      providerRef,
      bookingId,
      ...(userId ? { userId } : {}),
      kind: input.kind,
      amountCents: Math.round(amountCents),
      currency,
      status: "SUCCEEDED",
      createdAt,
    },
    billing,
    paymentStatus,
  };
}
