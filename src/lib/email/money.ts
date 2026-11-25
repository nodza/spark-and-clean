/** Rand amounts in the email designs: space grouping and a period, e.g. R1 640.00. */
export function formatEmailRand(cents: number): string {
  const safe = Number.isFinite(cents) ? Math.round(cents) : 0;
  const sign = safe < 0 ? "-" : "";
  const abs = Math.abs(safe);
  const rands = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");
  const grouped = String(rands).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}R${grouped}.${fraction}`;
}
