/** Rand range shown for an estimate or a measured quote. Whole rands, en-ZA grouping. */
export function formatQuoteRange(min: number, max: number): string {
  const fmt = (value: number) =>
    new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 })
      .format(Number.isFinite(value) ? value : 0)
      .replace(/[\u00a0\u202f]/g, " ");
  const low = Number.isFinite(min) ? min : 0;
  const high = Number.isFinite(max) ? max : 0;
  if (low === high) return `R${fmt(low)}`;
  return `R${fmt(low)} – R${fmt(high)}`;
}

/** Cents as rands with two decimals, e.g. R396.00. */
export function formatRandCents(cents: number): string {
  const safe = Number.isFinite(cents) ? cents : 0;
  const amount = new Intl.NumberFormat("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe / 100);
  return `R${amount.replace(/[\u00a0\u202f]/g, " ")}`;
}

/**
 * Bookings list value. After measurement this is the final quote,
 * otherwise the original estimate midpoint.
 */
export function quotedValueRand(booking: {
  estimatedPriceMin: number;
  estimatedPriceMax: number;
  measuredQuote?: {
    estimatedPriceMin: number;
    estimatedPriceMax: number;
  } | null;
}): number {
  const quote = booking.measuredQuote;
  if (
    quote &&
    Number.isFinite(quote.estimatedPriceMin) &&
    Number.isFinite(quote.estimatedPriceMax)
  ) {
    return (quote.estimatedPriceMin + quote.estimatedPriceMax) / 2;
  }
  return (Number(booking.estimatedPriceMin) + Number(booking.estimatedPriceMax)) / 2;
}
