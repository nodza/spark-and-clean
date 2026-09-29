import type { BookingStatus } from "@/types/booking";
import { validateDimensionMeters } from "@/lib/bookingValidation";

/** Van may only collect from the door, or deliver a rug that is ready. */
const VAN_COLLECT_FROM: readonly BookingStatus[] = ["BOOKED", "SCHEDULED"];

export const DEPOT_STATUSES: readonly BookingStatus[] = [
  "COLLECTED",
  "CLEANING",
  "DRYING",
];

export type CollectDimensions = {
  widthM: number;
  lengthM: number;
  areaSqM: number;
};

export type TechnicianFieldUpdate =
  | { ok: true; set: Record<string, unknown> }
  | { ok: false; status: 400 | 403; error: string };

export function isVanCollectStatus(status: BookingStatus): boolean {
  return VAN_COLLECT_FROM.includes(status);
}

export function isVanDeliverStatus(status: BookingStatus): boolean {
  return status === "READY";
}

export function isDepotStatus(status: BookingStatus): boolean {
  return DEPOT_STATUSES.includes(status);
}

export function isAllowedVanTransition(
  from: BookingStatus,
  to: BookingStatus
): boolean {
  if (to === "COLLECTED") return isVanCollectStatus(from);
  if (to === "DELIVERED") return isVanDeliverStatus(from);
  return false;
}

export function isRecordedDimension(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** True when neither side was measured — pickup can still capture size. */
export function bothDimensionsEmpty(widthM: unknown, lengthM: unknown): boolean {
  return !isRecordedDimension(widthM) && !isRecordedDimension(lengthM);
}

export function rugAreaSqM(widthM: number, lengthM: number): number {
  return Number((widthM * lengthM).toFixed(2));
}

export function formatRugSizeLabel(rug: {
  widthM?: number | null;
  lengthM?: number | null;
  areaSqM?: number | null;
}): string {
  if (!isRecordedDimension(rug.widthM) || !isRecordedDimension(rug.lengthM)) {
    return "To be measured on collection";
  }
  const area =
    typeof rug.areaSqM === "number" &&
    Number.isFinite(rug.areaSqM) &&
    rug.areaSqM > 0
      ? rug.areaSqM
      : rugAreaSqM(rug.widthM, rug.lengthM);
  return `${rug.widthM}m × ${rug.lengthM}m (${area} m²)`;
}

function parseMeterText(raw: string): number | null {
  const value = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Blank + blank skips measurement (measure on pickup).
 * One side filled, or an invalid metre value, is an error.
 */
export function parseOptionalCollectDimensions(
  widthRaw: string,
  lengthRaw: string
):
  | { ok: true; dimensions: CollectDimensions | null }
  | { ok: false; widthError?: string; lengthError?: string } {
  const widthBlank = widthRaw.trim() === "";
  const lengthBlank = lengthRaw.trim() === "";
  if (widthBlank && lengthBlank) {
    return { ok: true, dimensions: null };
  }

  const errors: { widthError?: string; lengthError?: string } = {};
  if (widthBlank) {
    errors.widthError = "Enter width as well, or leave both blank.";
  }
  if (lengthBlank) {
    errors.lengthError = "Enter length as well, or leave both blank.";
  }

  if (!widthBlank) {
    const width = parseMeterText(widthRaw);
    if (width === null) {
      errors.widthError = "Enter a valid width in metres.";
    } else {
      const err = validateDimensionMeters(width, "Width");
      if (err) errors.widthError = err;
    }
  }
  if (!lengthBlank) {
    const length = parseMeterText(lengthRaw);
    if (length === null) {
      errors.lengthError = "Enter a valid length in metres.";
    } else {
      const err = validateDimensionMeters(length, "Length");
      if (err) errors.lengthError = err;
    }
  }

  if (errors.widthError || errors.lengthError) {
    return { ok: false, ...errors };
  }

  const width = parseMeterText(widthRaw);
  const length = parseMeterText(lengthRaw);
  if (width === null || length === null) {
    return {
      ok: false,
      widthError: width === null ? "Enter a valid width in metres." : undefined,
      lengthError:
        length === null ? "Enter a valid length in metres." : undefined,
    };
  }

  return {
    ok: true,
    dimensions: {
      widthM: width,
      lengthM: length,
      areaSqM: rugAreaSqM(width, length),
    },
  };
}

function readMeter(
  value: unknown,
  label: string
): { ok: true; value: number } | { ok: false; error: string } {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return {
      ok: false,
      error: `Enter a valid ${label.toLowerCase()} in metres.`,
    };
  }
  const err = validateDimensionMeters(value, label);
  if (err) return { ok: false, error: err };
  return { ok: true, value };
}

function dimensionWasSent(provided: boolean, value: unknown): boolean {
  if (!provided) return false;
  return value !== null && value !== "";
}

/**
 * Technician PATCH: own job only, and only the van transition list.
 * Optional width/length are stored only when collecting a rug that has no size yet.
 * Admins are not gated here — depot moves stay on the admin status control.
 */
export function technicianFieldUpdate(input: {
  driverProfileId: string | null | undefined;
  assignedDriverId: unknown;
  from: BookingStatus;
  to: BookingStatus;
  existingWidth: unknown;
  existingLength: unknown;
  widthProvided: boolean;
  lengthProvided: boolean;
  widthM: unknown;
  lengthM: unknown;
}): TechnicianFieldUpdate {
  if (
    typeof input.driverProfileId !== "string" ||
    input.driverProfileId.length === 0 ||
    input.assignedDriverId !== input.driverProfileId
  ) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  if (!isAllowedVanTransition(input.from, input.to)) {
    return {
      ok: false,
      status: 400,
      error: "That status change is not allowed from the van.",
    };
  }

  const set: Record<string, unknown> = { status: input.to };
  const widthSent = dimensionWasSent(input.widthProvided, input.widthM);
  const lengthSent = dimensionWasSent(input.lengthProvided, input.lengthM);

  if (!widthSent && !lengthSent) {
    return { ok: true, set };
  }

  if (input.to !== "COLLECTED") {
    return {
      ok: false,
      status: 400,
      error: "Size can only be saved when marking the rug collected.",
    };
  }

  if (!bothDimensionsEmpty(input.existingWidth, input.existingLength)) {
    return {
      ok: false,
      status: 400,
      error: "This rug already has a size.",
    };
  }

  if (!widthSent || !lengthSent) {
    return {
      ok: false,
      status: 400,
      error: "Enter both width and length, or leave both blank.",
    };
  }

  const width = readMeter(input.widthM, "Width");
  if (!width.ok) return { ok: false, status: 400, error: width.error };
  const length = readMeter(input.lengthM, "Length");
  if (!length.ok) return { ok: false, status: 400, error: length.error };

  set["rug.widthM"] = width.value;
  set["rug.lengthM"] = length.value;
  set["rug.areaSqM"] = rugAreaSqM(width.value, length.value);
  return { ok: true, set };
}
