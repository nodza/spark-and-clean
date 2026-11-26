import { hasRugDimensions, estimateBookingPrice } from "@/lib/bookingEstimate";
import { MAX_RUGS_PER_BOOKING } from "@/lib/bookingRugs";
import type { BookingPromotion } from "@/types/booking";
import {
  applyCoupon,
  estimateQuoteMidpointCents,
  type CouponDiscount,
} from "@/lib/promotion/applyCoupon";

/** Hard ceiling so confirm cannot accept absurd client sizes. */
export const MAX_RUG_SIDE_M = 50;

type RugInput = {
  type?: unknown;
  widthM?: unknown;
  lengthM?: unknown;
  /** Ignored. Area is recomputed from width and length. */
  areaSqM?: unknown;
};

type AddOnInput = {
  odourRemoval?: unknown;
  stainProtection?: unknown;
};

export type ConfirmedRugLineQuote = {
  /** This rug before the booking coupon. */
  estimatedPriceMin: number;
  estimatedPriceMax: number;
  areaSqM: number;
  dimensionsSkipped: boolean;
};

export type ConfirmedBookingQuote = {
  promotion: Required<
    Pick<BookingPromotion, "couponId" | "code" | "discountCents" | "amountDueCents">
  > | null;
  /** Booking total after the coupon. One coupon is applied to the sum. */
  estimatedPriceMin: number;
  estimatedPriceMax: number;
  /** Sum of the rug prices before the coupon. */
  subtotalMin: number;
  subtotalMax: number;
  areaSqM: number;
  dimensionsSkipped: boolean;
  lines: ConfirmedRugLineQuote[];
};

type RugQuoteInput = RugInput & {
  addOns?: AddOnInput | null;
};

export type ConfirmedCouponQuote = ConfirmedBookingQuote & {
  promotion: NonNullable<ConfirmedBookingQuote["promotion"]>;
};

function readMeters(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value <= 0 || value > MAX_RUG_SIDE_M) return null;
  return value;
}

function quoteFromRug(input: {
  rug?: RugInput | null;
  addOns?: AddOnInput | null;
}): {
  widthM: number | null;
  lengthM: number | null;
  areaSqM: number;
  dimensionsSkipped: boolean;
  estimate: ReturnType<typeof estimateBookingPrice>;
} {
  const widthM = readMeters(input.rug?.widthM);
  const lengthM = readMeters(input.rug?.lengthM);
  const dimensionsSkipped = !hasRugDimensions(widthM, lengthM);
  const areaSqM =
    !dimensionsSkipped && widthM != null && lengthM != null
      ? Number((widthM * lengthM).toFixed(2))
      : 0;
  const estimate = estimateBookingPrice({
    rug: {
      type: typeof input.rug?.type === "string" ? input.rug.type : "",
      widthM,
      lengthM,
      areaSqM,
    },
    addOns: {
      odourRemoval: input.addOns?.odourRemoval === true,
      stainProtection: input.addOns?.stainProtection === true,
    },
  });
  return { widthM, lengthM, areaSqM, dimensionsSkipped, estimate };
}

export const RUG_LIST_COUPON_ERROR =
  "Rug width and length are required to apply a coupon";

/**
 * Price every rug, then apply the coupon once to the sum.
 * A fixed coupon is taken off the booking once. A percent is the percent of the sum.
 * Posted totals and posted areas are ignored.
 */
export function confirmRugsQuote(input: {
  coupon?: {
    couponId: string;
    code: string;
    coupon: CouponDiscount;
  } | null;
  rugs: RugQuoteInput[];
}):
  | {
      promotion: ConfirmedBookingQuote["promotion"];
      estimatedPriceMin: number;
      estimatedPriceMax: number;
      subtotalMin: number;
      subtotalMax: number;
      dimensionsSkipped: boolean;
      lines: ConfirmedRugLineQuote[];
    }
  | { error: string } {
  if (input.rugs.length < 1) {
    return { error: "Add a rug to this booking." };
  }
  if (input.rugs.length > MAX_RUGS_PER_BOOKING) {
    return { error: `A booking can include up to ${MAX_RUGS_PER_BOOKING} rugs.` };
  }

  const lines: ConfirmedRugLineQuote[] = input.rugs.map((rug) => {
    const quoted = quoteFromRug({ rug, addOns: rug.addOns });
    return {
      estimatedPriceMin: quoted.estimate.totalMin,
      estimatedPriceMax: quoted.estimate.totalMax,
      areaSqM: quoted.areaSqM,
      dimensionsSkipped: quoted.dimensionsSkipped,
    };
  });
  const subtotalMin = lines.reduce((sum, line) => sum + line.estimatedPriceMin, 0);
  const subtotalMax = lines.reduce((sum, line) => sum + line.estimatedPriceMax, 0);
  const dimensionsSkipped = lines.some((line) => line.dimensionsSkipped);

  if (input.coupon) {
    if (dimensionsSkipped) {
      return { error: RUG_LIST_COUPON_ERROR };
    }
    const applied = applyCoupon(input.coupon.coupon, subtotalMin, subtotalMax);
    return {
      promotion: {
        couponId: input.coupon.couponId,
        code: input.coupon.code,
        discountCents: applied.discountCents,
        amountDueCents: estimateQuoteMidpointCents(
          applied.estimateMin,
          applied.estimateMax
        ),
      },
      estimatedPriceMin: applied.estimateMin,
      estimatedPriceMax: applied.estimateMax,
      subtotalMin,
      subtotalMax,
      dimensionsSkipped,
      lines,
    };
  }

  return {
    promotion: null,
    estimatedPriceMin: subtotalMin,
    estimatedPriceMax: subtotalMax,
    subtotalMin,
    subtotalMax,
    dimensionsSkipped,
    lines,
  };
}

/**
 * Re-price a booking from rug size and add-ons.
 * Posted totals and a posted area are ignored so confirm cannot trust the client.
 * When `coupon` is set, dimensions are required and the catalogue discount is applied.
 */
export function confirmBookingQuote(input: {
  coupon?: {
    couponId: string;
    code: string;
    coupon: CouponDiscount;
  } | null;
  rug?: RugInput | null;
  addOns?: AddOnInput | null;
}): ConfirmedBookingQuote | { error: string } {
  const quoted = confirmRugsQuote({
    coupon: input.coupon,
    rugs: [{ ...input.rug, addOns: input.addOns }],
  });
  if ("error" in quoted) return quoted;
  const line = quoted.lines[0];
  return {
    promotion: quoted.promotion,
    estimatedPriceMin: quoted.estimatedPriceMin,
    estimatedPriceMax: quoted.estimatedPriceMax,
    subtotalMin: quoted.subtotalMin,
    subtotalMax: quoted.subtotalMax,
    areaSqM: line?.areaSqM ?? 0,
    dimensionsSkipped: line?.dimensionsSkipped ?? true,
    lines: quoted.lines,
  };
}

/**
 * Re-price with a catalogue coupon. Posted totals and a posted area are ignored.
 */
export function confirmCouponQuote(input: {
  couponId: string;
  code: string;
  coupon: CouponDiscount;
  rug?: RugInput | null;
  addOns?: AddOnInput | null;
}): ConfirmedCouponQuote {
  const quote = confirmBookingQuote({
    coupon: {
      couponId: input.couponId,
      code: input.code,
      coupon: input.coupon,
    },
    rug: input.rug,
    addOns: input.addOns,
  });
  if ("error" in quote) {
    throw new Error(quote.error);
  }
  if (!quote.promotion) {
    throw new Error("Coupon quote missing promotion");
  }
  return quote as ConfirmedCouponQuote;
}
