import { Types } from "mongoose";
import { hasRugDimensions } from "@/lib/bookingEstimate";
import { readMeasuredMeters } from "@/lib/measuredSize";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { Coupon } from "@/models/Coupon";
import {
  derivePaymentStatus,
  sumSucceededPaidCents,
} from "@/lib/payments/ledger";
import {
  estimateQuoteMidpointCents,
  type CouponDiscount,
} from "@/lib/promotion/applyCoupon";
import { confirmBookingQuote } from "@/lib/promotion/confirmCoupon";
import { selectedAddOnKinds } from "@/lib/techUi";
import type { MeasuredQuote, PaymentStatus } from "@/types/booking";

export const COUPON_REAPPLY_ERROR =
  "The coupon on this booking could not be reapplied.";

export const MEASUREMENT_CONFLICT_ERROR =
  "The payment total changed while the price was saving. Please try again.";

const WRITE_ATTEMPTS = 5;
const LEDGER_CURRENCY = "ZAR";

const PRICE_KEYS = new Set([
  "estimatedPriceMin",
  "estimatedPriceMax",
  "billing",
  "paymentStatus",
  "promotion",
  "measuredQuote",
  "refundRequired",
  "couponCode",
  "amountDueCents",
]);

export type MeasurementCoupon = {
  couponId: string;
  code: string;
  coupon: CouponDiscount;
};

type AddOnSource = Partial<{
  odourRemoval: boolean;
  stainProtection: boolean;
  stainTreatment: boolean;
  fabricProtection: boolean;
}>;

export type MeasurementBooking = {
  id?: unknown;
  rug?: { type?: unknown } | null;
  addOns?: AddOnSource | null;
  couponCode?: unknown;
  promotion?: {
    couponId?: unknown;
    code?: unknown;
    loyaltyPunchedAt?: unknown;
  } | null;
  billing?: { currency?: unknown; amountPaidCents?: number; amountDueCents?: number } | null;
};

export type MeasurementWrite = {
  set: Record<string, unknown>;
  unset?: Record<string, "">;
};

function pricingAddOns(addOns: AddOnSource | null | undefined): {
  odourRemoval: boolean;
  stainProtection: boolean;
} {
  const kinds = selectedAddOnKinds(addOns);
  return {
    odourRemoval: kinds.includes("odour"),
    stainProtection: kinds.includes("stain"),
  };
}

/**
 * Re-price from the measured size the same way the booking wizard does.
 * The original estimatedPriceMin / estimatedPriceMax are not part of the write.
 */
export function priceAfterMeasurement(input: {
  rugType: string;
  addOns?: AddOnSource | null;
  widthM: number;
  lengthM: number;
  coupon: MeasurementCoupon | null;
  amountPaidCents: number;
  measuredAt: string;
  currency?: string;
}): { ok: true; write: MeasurementWrite } | { ok: false; error: string } {
  if (!hasRugDimensions(input.widthM, input.lengthM)) {
    return { ok: false, error: "Enter both width and length in metres." };
  }

  const quote = confirmBookingQuote({
    coupon: input.coupon,
    rug: {
      type: input.rugType,
      widthM: input.widthM,
      lengthM: input.lengthM,
    },
    addOns: pricingAddOns(input.addOns),
  });
  if ("error" in quote) {
    return { ok: false, error: quote.error };
  }

  const amountDueCents = quote.promotion
    ? quote.promotion.amountDueCents
    : estimateQuoteMidpointCents(quote.estimatedPriceMin, quote.estimatedPriceMax);
  const amountPaidCents = Math.max(0, Math.round(input.amountPaidCents));
  const paymentStatus: PaymentStatus = derivePaymentStatus(
    amountPaidCents,
    amountDueCents
  );
  const refundRequired = amountPaidCents > amountDueCents;
  const currency =
    typeof input.currency === "string" && input.currency.trim()
      ? input.currency.trim().toUpperCase()
      : LEDGER_CURRENCY;

  const measuredQuote: MeasuredQuote = {
    estimatedPriceMin: quote.estimatedPriceMin,
    estimatedPriceMax: quote.estimatedPriceMax,
    amountDueCents,
    discountCents: quote.promotion?.discountCents ?? 0,
    measuredAt: input.measuredAt,
  };

  const set: Record<string, unknown> = {
    "rug.widthM": input.widthM,
    "rug.lengthM": input.lengthM,
    "rug.areaSqM": quote.areaSqM,
    measuredQuote,
    refundRequired,
    paymentStatus,
    billing: {
      currency,
      amountDueCents,
      amountPaidCents,
    },
  };

  if (quote.promotion) {
    set["promotion.couponId"] = quote.promotion.couponId;
    set["promotion.code"] = quote.promotion.code;
    set["promotion.discountCents"] = quote.promotion.discountCents;
    set["promotion.amountDueCents"] = quote.promotion.amountDueCents;
    set.couponCode = quote.promotion.code;
    return { ok: true, write: { set } };
  }

  return {
    ok: true,
    write: {
      set,
      unset: {
        "promotion.amountDueCents": "",
        "promotion.discountCents": "",
      },
    },
  };
}

function couponIdentity(booking: MeasurementBooking): {
  couponId: string;
  code: string;
} | null {
  const couponId =
    typeof booking.promotion?.couponId === "string"
      ? booking.promotion.couponId.trim()
      : "";
  const promoCode =
    typeof booking.promotion?.code === "string" ? booking.promotion.code.trim() : "";
  const legacy =
    typeof booking.couponCode === "string" ? booking.couponCode.trim() : "";
  const code = promoCode || legacy;
  if (!couponId && !code) return null;
  return { couponId, code };
}

function isObjectIdHex(value: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(value) && Types.ObjectId.isValid(value);
}

/**
 * Load the coupon already stored on the booking.
 * Active, date, and redemption checks are not repeated — the code was redeemed at confirm.
 */
export async function loadMeasurementCoupon(
  booking: MeasurementBooking
): Promise<
  | { ok: true; coupon: MeasurementCoupon | null }
  | { ok: false; error: string }
> {
  const identity = couponIdentity(booking);
  if (!identity) return { ok: true, coupon: null };

  const clauses: Record<string, unknown>[] = [];
  if (identity.couponId && isObjectIdHex(identity.couponId)) {
    clauses.push({ _id: identity.couponId });
  }
  if (identity.code) clauses.push({ code: identity.code });
  if (clauses.length === 0) {
    return { ok: false, error: COUPON_REAPPLY_ERROR };
  }

  await connectDB();
  const filter = clauses.length === 1 ? clauses[0] : { $or: clauses };
  const doc = await Coupon.findOne(filter).select("code type value").lean();
  if (!doc) return { ok: false, error: COUPON_REAPPLY_ERROR };

  const type =
    doc.type === "PERCENT" || doc.type === "FIXED_CENTS" ? doc.type : null;
  const value = typeof doc.value === "number" ? doc.value : NaN;
  const code = typeof doc.code === "string" ? doc.code.trim() : identity.code;
  if (!type || !Number.isFinite(value) || !code) {
    return { ok: false, error: COUPON_REAPPLY_ERROR };
  }

  return {
    ok: true,
    coupon: {
      couponId: identity.couponId || String(doc._id),
      code,
      coupon: { type, value },
    },
  };
}

/** Drop any price the caller tried to send. Size and job status are kept. */
export function withoutPostedPrice(
  extra: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!extra) return {};
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(extra)) {
    if (
      PRICE_KEYS.has(key) ||
      key.startsWith("billing.") ||
      key.startsWith("promotion.") ||
      key.startsWith("measuredQuote.")
    ) {
      continue;
    }
    next[key] = value;
  }
  return next;
}

function paidUnchangedFilter(bookingId: string, seenPaid: number) {
  if (seenPaid === 0) {
    return {
      id: bookingId,
      $or: [
        { "billing.amountPaidCents": seenPaid },
        { billing: { $exists: false } },
        { billing: null },
      ],
    };
  }
  return { id: bookingId, "billing.amountPaidCents": seenPaid };
}

/**
 * Save the measured size and the recalculated amount due.
 * Amount paid is the ledger sum. Payment status is derived from that sum.
 * `extraSet` may include job status; posted prices in it are ignored.
 */
export async function commitMeasuredSize(input: {
  bookingId: string;
  widthM: number;
  lengthM: number;
  extraSet?: Record<string, unknown>;
  measuredAt?: string;
}): Promise<
  | { ok: true; doc: Record<string, unknown> }
  | { ok: false; status: 400 | 404 | 409; error: string }
> {
  const meters = readMeasuredMeters(input.widthM, input.lengthM);
  if (!meters.ok) return { ok: false, status: 400, error: meters.error };

  const bookingId = input.bookingId.trim();
  if (!bookingId) return { ok: false, status: 404, error: "Not found" };

  await connectDB();
  const measuredAt = input.measuredAt || new Date().toISOString();
  const jobSet = withoutPostedPrice(input.extraSet);

  for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt += 1) {
    const booking = (await Booking.findOne({ id: bookingId }).lean()) as
      | (MeasurementBooking & Record<string, unknown>)
      | null;
    if (!booking) return { ok: false, status: 404, error: "Not found" };

    const loaded = await loadMeasurementCoupon(booking);
    if (!loaded.ok) return { ok: false, status: 409, error: loaded.error };

    const rawPaid = booking.billing?.amountPaidCents;
    const seenPaid =
      typeof rawPaid === "number" && Number.isFinite(rawPaid) && rawPaid >= 0
        ? Math.round(rawPaid)
        : 0;
    const amountPaidCents = await sumSucceededPaidCents(bookingId);
    const rugType =
      booking.rug && typeof booking.rug.type === "string" ? booking.rug.type : "";
    const currency =
      typeof booking.billing?.currency === "string"
        ? booking.billing.currency
        : undefined;

    const priced = priceAfterMeasurement({
      rugType,
      addOns: booking.addOns,
      widthM: meters.widthM,
      lengthM: meters.lengthM,
      coupon: loaded.coupon,
      amountPaidCents,
      measuredAt,
      currency,
    });
    if (!priced.ok) return { ok: false, status: 400, error: priced.error };

    const update: Record<string, unknown> = {
      $set: { ...jobSet, ...priced.write.set },
    };
    if (priced.write.unset && Object.keys(priced.write.unset).length > 0) {
      update.$unset = priced.write.unset;
    }

    const updated = await Booking.findOneAndUpdate(
      paidUnchangedFilter(bookingId, seenPaid),
      update,
      { new: true, runValidators: true }
    ).lean();

    if (updated) {
      return { ok: true, doc: updated as Record<string, unknown> };
    }
  }

  return { ok: false, status: 409, error: MEASUREMENT_CONFLICT_ERROR };
}
