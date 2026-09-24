import type { Booking, BookingStatus, PaymentStatus } from "@/types/booking";
import { hasRugDimensions } from "@/lib/bookingEstimate";
import { APP_TIMEZONE, bookingCalendarDate } from "@/lib/localCalendarDate";

/** Same meaning as the booking wizard when the customer skips size. */
export const MEASURE_ON_PICKUP = "To be measured on pickup";

/** Design-aligned slot labels (Technician Portal.dc.html). */
export function slotTimeLabel(slot: Booking["collectionSlot"]): string {
  return slot === "MORNING" ? "08:00" : "12:00";
}

export function slotWindowLabel(slot: Booking["collectionSlot"]): string {
  return slot === "MORNING" ? "AM window" : "PM window";
}

export type TechStopKind = "collect" | "deliver" | "done" | "next";

export function techStopKind(status: BookingStatus): TechStopKind {
  if (status === "DELIVERED") return "done";
  if (status === "READY") return "deliver";
  if (status === "SCHEDULED" || status === "BOOKED") return "collect";
  return "collect";
}

/** Pill styles from the design TAG map. */
export function techTagClass(kind: TechStopKind): string {
  if (kind === "done") {
    return "border-[#bfe9dc] bg-[#eafaf5] text-[#0a7a63]";
  }
  if (kind === "deliver") {
    return "border-[#c3d3f5] bg-[#e8f0ff] text-[#2c4fa6]";
  }
  return "border-[#f0dc94] bg-[#fff6d6] text-[#8a6b00]";
}

export function techTagLabel(status: BookingStatus, isNext = false): string {
  if (isNext) return "NEXT";
  if (status === "DELIVERED") return "DONE";
  if (status === "READY") return "DELIVER";
  if (status === "COLLECTED" || status === "CLEANING" || status === "DRYING") {
    return "DEPOT";
  }
  return "COLLECT";
}

export function techAccentColor(kind: TechStopKind): string {
  if (kind === "done") return "#0a7a63";
  if (kind === "deliver") return "#2c4fa6";
  return "#ffdc39";
}

/** Long weekday label in en-ZA / Africa/Johannesburg. */
export function formatRouteDate(isoDate: string): string {
  try {
    const day = bookingCalendarDate(isoDate);
    if (!day) return isoDate;
    const [y, m, d] = day.split("-").map(Number);
    const ref = new Date(Date.UTC(y, m - 1, d, 10, 0, 0));
    return new Intl.DateTimeFormat("en-ZA", {
      timeZone: APP_TIMEZONE,
      weekday: "long",
      day: "numeric",
      month: "long",
    })
      .format(ref)
      .toUpperCase();
  } catch {
    return isoDate;
  }
}

/** Compact upcoming date e.g. "Wed, 18 Sep". */
export function formatUpcomingDate(isoDate: string): string {
  try {
    const day = bookingCalendarDate(isoDate);
    if (!day) return isoDate;
    const [y, m, d] = day.split("-").map(Number);
    const ref = new Date(Date.UTC(y, m - 1, d, 10, 0, 0));
    return new Intl.DateTimeFormat("en-ZA", {
      timeZone: APP_TIMEZONE,
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(ref);
  } catch {
    return isoDate;
  }
}

/** SA badge date e.g. "13/01/2026". */
export function formatBadgeDate(isoDate: string): string {
  const day = bookingCalendarDate(isoDate);
  if (!day) return isoDate;
  const [y, m, d] = day.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

function formatMeasure(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

export function rugDimensionLabel(
  rug: Pick<Booking["rug"], "widthM" | "lengthM" | "areaSqM">
): string {
  if (!hasRugDimensions(rug.widthM, rug.lengthM)) {
    return MEASURE_ON_PICKUP;
  }

  const width = rug.widthM as number;
  const length = rug.lengthM as number;
  const stored = rug.areaSqM;
  const area =
    typeof stored === "number" && Number.isFinite(stored) && stored > 0
      ? stored
      : width * length;

  return `${formatMeasure(width)}m × ${formatMeasure(length)}m (${formatMeasure(area)} m²)`;
}

type BookingAddOns = Partial<{
  odourRemoval: boolean;
  stainProtection: boolean;
  stainTreatment: boolean;
  fabricProtection: boolean;
}>;

/** Wizard names, including older stainTreatment / fabricProtection keys. */
export function bookingAddOnLabels(
  addOns: BookingAddOns | null | undefined
): string[] {
  if (!addOns) return [];
  const labels: string[] = [];
  if (addOns.odourRemoval || addOns.stainTreatment) {
    labels.push("Odour removal");
  }
  if (addOns.stainProtection || addOns.fabricProtection) {
    labels.push("Stain protection");
  }
  return labels;
}

/** Read-only payment pill. Technicians cannot change this status. */
export function paymentBadgeClass(status: PaymentStatus | string): string {
  if (status === "PAID") {
    return "border-[#bfe9dc] bg-[#eafaf5] text-[#0a7a63]";
  }
  if (status === "DEPOSIT") {
    return "border-[#c3d3f5] bg-[#e8f0ff] text-[#2c4fa6]";
  }
  return "border-[#f6c9c9] bg-[#fdecec] text-[#b33232]";
}

export function rugSummary(booking: Booking): string {
  return `${booking.suburb} · ${booking.rug.type} · ${rugDimensionLabel(booking.rug)}`;
}

const SLOT_ORDER = { MORNING: 0, AFTERNOON: 1 } as const;

export function sortJobsBySlotThenId<T extends Booking>(jobs: T[]): T[] {
  return [...jobs].sort((a, b) => {
    const slot = SLOT_ORDER[a.collectionSlot] - SLOT_ORDER[b.collectionSlot];
    if (slot !== 0) return slot;
    return a.id.localeCompare(b.id);
  });
}
