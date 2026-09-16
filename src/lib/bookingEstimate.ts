import type { Booking } from "@/types/booking";

export const ODOUR_RATE = 25;
export const STAIN_PROTECTION_RATE = 40;
export const BASE_RATE = 80;

export type BookingEstimate = {
  area: number;
  dimensionsSkipped: boolean;
  basePrice: number;
  odourPrice: number;
  stainProtectPrice: number;
  totalMin: number;
  totalMax: number;
};

export function hasRugDimensions(
  widthM?: number | null,
  lengthM?: number | null
): boolean {
  return (
    typeof widthM === "number" &&
    typeof lengthM === "number" &&
    widthM > 0 &&
    lengthM > 0 &&
    Number.isFinite(widthM) &&
    Number.isFinite(lengthM)
  );
}

export function estimateBookingPrice(
  data: Pick<Partial<Booking>, "rug" | "addOns">
): BookingEstimate {
  const addOns = data.addOns || { odourRemoval: false, stainProtection: false };
  const area =
    typeof data.rug?.areaSqM === "number" && Number.isFinite(data.rug.areaSqM)
      ? data.rug.areaSqM
      : 0;
  const dimensionsSkipped = !hasRugDimensions(
    data.rug?.widthM,
    data.rug?.lengthM
  );

  const typeMultiplier = data.rug?.type === "Persian" ? 1.5 : 1.0;
  const basePrice = Math.round(area * BASE_RATE * typeMultiplier) || 0;
  const odourPrice =
    addOns.odourRemoval && !dimensionsSkipped
      ? Math.round(area * ODOUR_RATE)
      : 0;
  const stainProtectPrice =
    addOns.stainProtection && !dimensionsSkipped
      ? Math.round(area * STAIN_PROTECTION_RATE)
      : 0;

  const totalMin = basePrice + odourPrice + stainProtectPrice;
  const totalMax = Math.round(totalMin * 1.2);

  return {
    area,
    dimensionsSkipped,
    basePrice,
    odourPrice,
    stainProtectPrice,
    totalMin,
    totalMax,
  };
}
