import { validateDimensionMeters } from "@/lib/bookingValidation";

function coerceMeters(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Both sides are required. Price is never accepted here — only metres.
 */
export function readMeasuredMeters(
  widthRaw: unknown,
  lengthRaw: unknown
):
  | { ok: true; widthM: number; lengthM: number }
  | { ok: false; error: string } {
  const widthMissing = widthRaw == null || widthRaw === "";
  const lengthMissing = lengthRaw == null || lengthRaw === "";
  if (widthMissing || lengthMissing) {
    return { ok: false, error: "Enter both width and length in metres." };
  }

  const widthM = coerceMeters(widthRaw);
  const lengthM = coerceMeters(lengthRaw);
  if (widthM == null) {
    return { ok: false, error: "Enter a valid width in metres." };
  }
  if (lengthM == null) {
    return { ok: false, error: "Enter a valid length in metres." };
  }

  const widthErr = validateDimensionMeters(widthM, "Width");
  if (widthErr) return { ok: false, error: widthErr };
  const lengthErr = validateDimensionMeters(lengthM, "Length");
  if (lengthErr) return { ok: false, error: lengthErr };
  return { ok: true, widthM, lengthM };
}
