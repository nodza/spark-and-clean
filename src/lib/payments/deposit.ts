/**
 * Share of amount due collected up front. Change this one number to move
 * the deposit percent (Noel).
 */
export const DEPOSIT_FRACTION = 0.5;

type DueInput = {
  estimatedPriceMin: number;
  estimatedPriceMax: number;
  billing?: { amountDueCents?: number } | null;
  promotion?: { amountDueCents?: number } | null;
};

function estimateMidpointCents(minPrice: number, maxPrice: number): number {
  const min = Number(minPrice);
  const max = Number(maxPrice);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return 0;
  return Math.max(0, Math.round(((min + max) / 2) * 100));
}

/** Same due-cents rules as the ledger: promotion, then saved billing, then estimate midpoint. */
export function amountDueCentsForBooking(booking: DueInput): number {
  const promo = booking.promotion?.amountDueCents;
  if (typeof promo === "number" && Number.isFinite(promo) && promo >= 0) {
    return Math.round(promo);
  }
  const stored = booking.billing?.amountDueCents;
  if (
    booking.billing &&
    typeof stored === "number" &&
    Number.isFinite(stored) &&
    stored >= 0
  ) {
    return Math.round(stored);
  }
  return estimateMidpointCents(
    booking.estimatedPriceMin,
    booking.estimatedPriceMax
  );
}

/** Deposit charged at Checkout. */
export function depositAmountCents(amountDueCents: number): number {
  if (!Number.isFinite(amountDueCents) || amountDueCents <= 0) return 0;
  return Math.max(0, Math.round(DEPOSIT_FRACTION * amountDueCents));
}

/** Remaining cents after what has already been paid (balance Checkout amount). */
export function remainingBalanceCents(
  amountDueCents: number,
  amountPaidCents: number
): number {
  const due =
    Number.isFinite(amountDueCents) && amountDueCents > 0
      ? Math.round(amountDueCents)
      : 0;
  const paid =
    Number.isFinite(amountPaidCents) && amountPaidCents > 0
      ? Math.round(amountPaidCents)
      : 0;
  return Math.max(0, due - paid);
}

export function formatZarFromCents(cents: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(cents / 100);
}
