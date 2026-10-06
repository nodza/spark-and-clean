import { hasRugDimensions, estimateBookingPrice } from "@/lib/bookingEstimate";
import type { BookingPromotion } from "@/types/booking";
import { applyCoupon, estimateQuoteMidpointCents, type CouponDiscount } from "@/lib/promotion/applyCoupon";

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

export type ConfirmedCouponQuote = {
  promotion: Required<
    Pick<BookingPromotion, "couponId" | "code" | "discountCents" | "amountDueCents">
  >;
  estimatedPriceMin: number;
  estimatedPriceMax: number;
  areaSqM: number;
};

function readMeters(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Re-price a booking from rug size and add-ons, then apply the catalogue coupon.
 * Posted totals and a posted area are ignored so confirm cannot trust the client.
 */
export function confirmCouponQuote(input: {
  couponId: string;
  code: string;
  coupon: CouponDiscount;
  rug?: RugInput | null;
  addOns?: AddOnInput | null;
}): ConfirmedCouponQuote {
  const widthM = readMeters(input.rug?.widthM);
  const lengthM = readMeters(input.rug?.lengthM);
  const areaSqM =
    hasRugDimensions(widthM, lengthM) && widthM != null && lengthM != null
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
  const applied = applyCoupon(input.coupon, estimate.totalMin, estimate.totalMax);
  return {
    promotion: {
      couponId: input.couponId,
      code: input.code,
      discountCents: applied.discountCents,
      amountDueCents: estimateQuoteMidpointCents(
        applied.estimateMin,
        applied.estimateMax
      ),
    },
    estimatedPriceMin: applied.estimateMin,
    estimatedPriceMax: applied.estimateMax,
    areaSqM,
  };
}
