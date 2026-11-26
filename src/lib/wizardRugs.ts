import { estimateBookingPrice } from "@/lib/bookingEstimate";
import { newBookingRugId } from "@/lib/bookingRugs";
import type { RugAddOns, RugDetails } from "@/types/booking";

export type WizardRug = {
  id: string;
  type: string;
  widthM: number | null;
  lengthM: number | null;
  areaSqM: number;
  photos: string[];
  labelPhotos: string[];
  addOns: RugAddOns;
};

export type WizardRugQuoteLine = {
  id: string;
  type: string;
  totalMin: number;
  totalMax: number;
  dimensionsSkipped: boolean;
};

export function emptyWizardRug(): WizardRug {
  return {
    id: newBookingRugId(),
    type: "",
    widthM: null,
    lengthM: null,
    areaSqM: 0,
    photos: [],
    labelPhotos: [],
    addOns: { odourRemoval: false, stainProtection: false },
  };
}

export function wizardRugDetails(rug: WizardRug): RugDetails {
  return {
    type: rug.type,
    widthM: rug.widthM,
    lengthM: rug.lengthM,
    areaSqM: rug.areaSqM,
    photos: rug.photos,
    labelPhotos: rug.labelPhotos,
  };
}

export function patchWizardRug(
  rug: WizardRug,
  patch: {
    rug?: Partial<RugDetails> | null;
    addOns?: { odourRemoval?: boolean; stainProtection?: boolean } | null;
  }
): WizardRug {
  const next: WizardRug = { ...rug, addOns: { ...rug.addOns } };
  if (patch.rug) {
    if (typeof patch.rug.type === "string") next.type = patch.rug.type;
    if ("widthM" in patch.rug) next.widthM = patch.rug.widthM ?? null;
    if ("lengthM" in patch.rug) next.lengthM = patch.rug.lengthM ?? null;
    if (typeof patch.rug.areaSqM === "number" && Number.isFinite(patch.rug.areaSqM)) {
      next.areaSqM = patch.rug.areaSqM;
    }
    if (Array.isArray(patch.rug.photos)) next.photos = patch.rug.photos;
    if (Array.isArray(patch.rug.labelPhotos)) next.labelPhotos = patch.rug.labelPhotos;
  }
  if (patch.addOns) {
    next.addOns = {
      odourRemoval: patch.addOns.odourRemoval === true,
      stainProtection: patch.addOns.stainProtection === true,
    };
  }
  return next;
}

/** Price each rug. The coupon is not applied here. */
export function quoteWizardRugs(rugs: WizardRug[]): {
  lines: WizardRugQuoteLine[];
  totalMin: number;
  totalMax: number;
  dimensionsSkipped: boolean;
} {
  const lines = rugs.map((rug) => {
    const estimate = estimateBookingPrice({
      rug: {
        type: rug.type,
        widthM: rug.widthM,
        lengthM: rug.lengthM,
        areaSqM: rug.areaSqM,
      },
      addOns: rug.addOns,
    });
    return {
      id: rug.id,
      type: rug.type,
      totalMin: estimate.totalMin,
      totalMax: estimate.totalMax,
      dimensionsSkipped: estimate.dimensionsSkipped,
    };
  });
  return {
    lines,
    totalMin: lines.reduce((sum, line) => sum + line.totalMin, 0),
    totalMax: lines.reduce((sum, line) => sum + line.totalMax, 0),
    dimensionsSkipped: lines.some((line) => line.dimensionsSkipped),
  };
}
