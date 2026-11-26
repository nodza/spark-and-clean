import { MAX_RUGS_PER_BOOKING, newBookingRugId } from "@/lib/bookingRugs";
import { parseRugPhotoKeys } from "@/lib/rugPhotos";
import type { RugAddOns } from "@/types/booking";

export type PostedRugLine = {
  id: string;
  type: string;
  widthM: number | null;
  lengthM: number | null;
  photos: string[];
  labelPhotos: string[];
  addOns: RugAddOns;
};

function readMeters(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function readAddOns(value: unknown): RugAddOns {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as { odourRemoval?: unknown; stainProtection?: unknown })
      : {};
  return {
    odourRemoval: raw.odourRemoval === true,
    stainProtection: raw.stainProtection === true,
  };
}

function readId(value: unknown): string {
  if (typeof value === "string" && /^[A-Za-z0-9-]{1,80}$/.test(value.trim())) {
    return value.trim();
  }
  return newBookingRugId();
}

/**
 * `rugs: null` means the client did not send a list, so confirm keeps using `rug`.
 * A list is repriced on the server. Posted line prices are not read.
 */
export function parsePostedRugs(
  value: unknown
): { ok: true; rugs: PostedRugLine[] | null } | { ok: false; error: string } {
  if (value == null) return { ok: true, rugs: null };
  if (!Array.isArray(value)) {
    return { ok: false, error: "Rugs must be a list." };
  }
  if (value.length < 1) return { ok: false, error: "Add a rug to this booking." };
  if (value.length > MAX_RUGS_PER_BOOKING) {
    return { ok: false, error: `A booking can include up to ${MAX_RUGS_PER_BOOKING} rugs.` };
  }

  const rugs: PostedRugLine[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: "Each rug needs a type." };
    }
    const raw = item as Record<string, unknown>;
    const type = typeof raw.type === "string" ? raw.type.trim() : "";
    if (!type) return { ok: false, error: "Each rug needs a type." };
    const photos = parseRugPhotoKeys(raw.photos);
    const labelPhotos = parseRugPhotoKeys(raw.labelPhotos);
    if (photos === null || labelPhotos === null) {
      return {
        ok: false,
        error: "Rug photos must be images uploaded for this booking.",
      };
    }
    let id = readId(raw.id);
    while (seen.has(id)) id = newBookingRugId();
    seen.add(id);
    rugs.push({
      id,
      type,
      widthM: readMeters(raw.widthM),
      lengthM: readMeters(raw.lengthM),
      photos: photos ?? [],
      labelPhotos: labelPhotos ?? [],
      addOns: readAddOns(raw.addOns),
    });
  }
  return { ok: true, rugs };
}
