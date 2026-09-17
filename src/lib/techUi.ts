import type { Booking, BookingStatus } from "@/types/booking";
import { APP_TIMEZONE, bookingCalendarDate } from "@/lib/localCalendarDate";

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

export function rugSummary(booking: Booking): string {
  const size =
    typeof booking.rug.widthM === "number" &&
    typeof booking.rug.lengthM === "number" &&
    booking.rug.widthM > 0 &&
    booking.rug.lengthM > 0
      ? `${booking.rug.widthM}m × ${booking.rug.lengthM}m`
      : "size TBD";
  return `${booking.suburb} · ${booking.rug.type} · ${size}`;
}

const SLOT_ORDER = { MORNING: 0, AFTERNOON: 1 } as const;

export function sortJobsBySlotThenId<T extends Booking>(jobs: T[]): T[] {
  return [...jobs].sort((a, b) => {
    const slot = SLOT_ORDER[a.collectionSlot] - SLOT_ORDER[b.collectionSlot];
    if (slot !== 0) return slot;
    return a.id.localeCompare(b.id);
  });
}
