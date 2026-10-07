import { hasRugDimensions, estimateBookingPrice } from "@/lib/bookingEstimate";
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

export type ConfirmedBookingQuote = {
  promotion: Required<
    Pick<BookingPromotion, "couponId" | "code" | "discountCents" | "amountDueCents">
  > | null;
  estimatedPriceMin: number;
  estimatedPriceMax: number;
  areaSqM: number;
  dimensionsSkipped: boolean;
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
  const { areaSqM, dimensionsSkipped, estimate } = quoteFromRug(input);

  if (input.coupon) {
    if (dimensionsSkipped) {
      return {
        error: "Rug width and length are required to apply a coupon",
      };
    }
    const applied = applyCoupon(
      input.coupon.coupon,
      estimate.totalMin,
      estimate.totalMax
    );
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
      areaSqM,
      dimensionsSkipped,
    };
  }

  return {
    promotion: null,
    estimatedPriceMin: estimate.totalMin,
    estimatedPriceMax: estimate.totalMax,
    areaSqM,
    dimensionsSkipped,
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
