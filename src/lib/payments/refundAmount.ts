/** Rands typed by an admin, as integer cents. Blank or zero is not an amount. */
export function parseRandToCents(raw: string): number | null {
  let cleaned = raw
    .trim()
    .replace(/^R/i, "")
    .trim()
    .replace(/[\s\u00a0\u202f]/g, "");
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    cleaned =
      lastComma > lastDot
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (lastComma !== -1) {
    const parts = cleaned.split(",");
    cleaned =
      parts.length === 2 && parts[1].length <= 2
        ? `${parts[0].replace(/\./g, "")}.${parts[1]}`
        : cleaned.replace(/,/g, "");
  }

  if (!/^\d{1,9}(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents < 1) return null;
  return cents;
}

export function refundedCentsForSource(
  rows: {
    kind: string;
    status: string;
    amountCents: number;
    sourceProviderRef?: string;
  }[],
  sourceRef: string
): number {
  return rows.reduce((sum, row) => {
    if (row.kind.trim().toUpperCase() !== "REFUND") return sum;
    if (row.status.trim().toUpperCase() !== "SUCCEEDED") return sum;
    if ((row.sourceProviderRef || "") !== sourceRef) return sum;
    const cents = Number(row.amountCents);
    return sum + (Number.isFinite(cents) ? cents : 0);
  }, 0);
}
