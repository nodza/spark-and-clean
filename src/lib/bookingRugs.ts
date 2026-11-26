import type {
  BookingRug,
  MeasuredQuote,
  RugAddOns,
  RugDetails,
} from "@/types/booking";
import { selectedAddOnKinds } from "@/lib/techUi";

/** Cap agreed for the wizard. Confirm of several rugs enforces it later. */
export const MAX_RUGS_PER_BOOKING = 8;

/** Stable id for a stored booking that only has the singular `rug` field. */
export const LEGACY_RUG_ID = "rug-1";

type AddOnSource = Partial<{
  odourRemoval: boolean;
  stainProtection: boolean;
  stainTreatment: boolean;
  fabricProtection: boolean;
}>;

export type RugListSource = {
  rug?: Partial<RugDetails> | null;
  rugs?: unknown;
  addOns?: AddOnSource | null;
  estimatedPriceMin?: unknown;
  estimatedPriceMax?: unknown;
  measuredQuote?: MeasuredQuote | null;
};

export function newBookingRugId(): string {
  return crypto.randomUUID();
}

export function rugAddOns(addOns: AddOnSource | null | undefined): RugAddOns {
  const kinds = selectedAddOnKinds(addOns);
  return {
    odourRemoval: kinds.includes("odour"),
    stainProtection: kinds.includes("stain"),
  };
}

function readMoney(value: unknown): number {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return amount;
}

function readMeters(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function readArea(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return value;
}

function readPhotos(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const photos = value.filter((item): item is string => typeof item === "string");
  return photos;
}

function readId(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

function readAssetId(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  const id = String(value).trim();
  return id || undefined;
}

function readMeasuredQuote(value: unknown): MeasuredQuote | undefined {
  if (!value || typeof value !== "object") return undefined;
  const quote = value as Partial<MeasuredQuote>;
  if (typeof quote.measuredAt !== "string" || !quote.measuredAt) return undefined;
  return {
    estimatedPriceMin: readMoney(quote.estimatedPriceMin),
    estimatedPriceMax: readMoney(quote.estimatedPriceMax),
    amountDueCents: readMoney(quote.amountDueCents),
    discountCents: readMoney(quote.discountCents),
    measuredAt: quote.measuredAt,
  };
}

function lineFromSingular(
  source: RugListSource,
  id: string
): BookingRug {
  const rug = source.rug ?? {};
  const tagCode = typeof rug.tagCode === "string" ? rug.tagCode.trim() : "";
  const assetId = readAssetId(rug.assetId);
  const measuredQuote = readMeasuredQuote(source.measuredQuote);
  const photos = readPhotos(rug.photos);
  const labelPhotos = readPhotos(rug.labelPhotos);
  return {
    id,
    type: typeof rug.type === "string" ? rug.type : "",
    widthM: readMeters(rug.widthM),
    lengthM: readMeters(rug.lengthM),
    areaSqM: readArea(rug.areaSqM),
    ...(photos ? { photos } : {}),
    ...(labelPhotos ? { labelPhotos } : {}),
    addOns: rugAddOns(source.addOns),
    estimatedPriceMin: readMoney(source.estimatedPriceMin),
    estimatedPriceMax: readMoney(source.estimatedPriceMax),
    ...(measuredQuote ? { measuredQuote } : {}),
    ...(tagCode ? { tagCode } : {}),
    ...(assetId ? { assetId } : {}),
  };
}

function lineFromStored(value: unknown, index: number): BookingRug | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const addOns =
    raw.addOns && typeof raw.addOns === "object"
      ? (raw.addOns as AddOnSource)
      : undefined;
  const tagCode = typeof raw.tagCode === "string" ? raw.tagCode.trim() : "";
  const assetId = readAssetId(raw.assetId);
  const measuredQuote = readMeasuredQuote(raw.measuredQuote);
  const photos = readPhotos(raw.photos);
  const labelPhotos = readPhotos(raw.labelPhotos);
  return {
    id: readId(raw.id, `rug-${index + 1}`),
    type: typeof raw.type === "string" ? raw.type : "",
    widthM: readMeters(raw.widthM),
    lengthM: readMeters(raw.lengthM),
    areaSqM: readArea(raw.areaSqM),
    ...(photos ? { photos } : {}),
    ...(labelPhotos ? { labelPhotos } : {}),
    addOns: rugAddOns(addOns),
    estimatedPriceMin: readMoney(raw.estimatedPriceMin),
    estimatedPriceMax: readMoney(raw.estimatedPriceMax),
    ...(measuredQuote ? { measuredQuote } : {}),
    ...(tagCode ? { tagCode } : {}),
    ...(assetId ? { assetId } : {}),
  };
}

/**
 * Rugs on a booking.
 * A row that only has `rug` becomes one line (`rug-1`).
 * A one-line `rugs` array still follows `rug` for size, photos, and tag,
 * because those writes still land on the singular field.
 */
export function bookingRugs(source: RugListSource): BookingRug[] {
  const stored = Array.isArray(source.rugs)
    ? source.rugs
        .map((line, index) => lineFromStored(line, index))
        .filter((line): line is BookingRug => line != null)
    : [];

  if (stored.length === 0) {
    return [lineFromSingular(source, LEGACY_RUG_ID)];
  }

  if (stored.length === 1 && source.rug) {
    const fromRug = lineFromSingular(source, stored[0].id);
    return [fromRug];
  }

  return stored;
}

/** Persist the singular confirm payload as a one-item rug list. */
export function singularBookingRug(input: {
  id?: string;
  rug: Partial<RugDetails> | null | undefined;
  addOns?: AddOnSource | null;
  estimatedPriceMin: number;
  estimatedPriceMax: number;
}): BookingRug {
  return lineFromSingular(
    {
      rug: input.rug,
      addOns: input.addOns,
      estimatedPriceMin: input.estimatedPriceMin,
      estimatedPriceMax: input.estimatedPriceMax,
    },
    input.id?.trim() || newBookingRugId()
  );
}
