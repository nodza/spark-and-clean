import { isValidCalendarDate } from "@/lib/johannesburgDate";
import { bookingCalendarDate } from "@/lib/localCalendarDate";
import { hasRugTagCode } from "@/lib/fieldStatus";
import {
  validateCustomerName,
  validateEmail,
  validateSaPhone,
} from "@/lib/bookingValidation";
import { SERVICE_CITIES, type ServiceCity } from "@/types/user";
import type { BookingStatus, PaymentStatus } from "@/types/booking";

export type BookingDetailsPatch = {
  customer: {
    name: string;
    phone: string;
    email: string;
  };
  addressLine1: string;
  suburb: string;
  city: ServiceCity;
  collectionDate: string;
  collectionSlot: "MORNING" | "AFTERNOON";
};

export type BookingDeleteCheck = {
  status: BookingStatus | string;
  paymentStatus: PaymentStatus | string;
  rug?: { tagCode?: string | null } | null;
};

/** Why Delete is blocked — null when delete is allowed. */
export function bookingDeleteBlockReason(
  booking: BookingDeleteCheck
): string | null {
  if (booking.paymentStatus !== "UNPAID") {
    return "A payment has been recorded";
  }
  if (booking.status !== "BOOKED" && booking.status !== "SCHEDULED") {
    return "Already collected or past collection";
  }
  if (hasRugTagCode(booking.rug?.tagCode)) {
    return "A rug tag is attached";
  }
  return null;
}

export function canDeleteBooking(booking: BookingDeleteCheck): boolean {
  return bookingDeleteBlockReason(booking) == null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Full-admin list edit: contact + address + collection window only.
 * Rejects status, payment, driver, coupon, and rug fields by ignoring them.
 */
export function sanitizeBookingDetailsPatch(
  body: unknown
): { ok: true; patch: BookingDetailsPatch } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid request body" };
  }
  const raw = body as Record<string, unknown>;
  const customerRaw =
    raw.customer && typeof raw.customer === "object" && !Array.isArray(raw.customer)
      ? (raw.customer as Record<string, unknown>)
      : null;
  if (!customerRaw) {
    return { ok: false, error: "Customer details are required" };
  }

  const name = readString(customerRaw.name).replace(/\s+/g, " ");
  const phone = readString(customerRaw.phone);
  const email = readString(customerRaw.email).toLowerCase();
  const addressLine1 = readString(raw.addressLine1);
  const suburb = readString(raw.suburb);
  const city = readString(raw.city);
  const collectionSlot = readString(raw.collectionSlot);
  const collectionDateRaw = readString(raw.collectionDate);
  const collectionDate =
    bookingCalendarDate(collectionDateRaw) ?? collectionDateRaw;

  const nameErr = validateCustomerName(name);
  if (nameErr) return { ok: false, error: nameErr };
  const phoneErr = validateSaPhone(phone);
  if (phoneErr) return { ok: false, error: phoneErr };
  const emailErr = validateEmail(email);
  if (emailErr) return { ok: false, error: emailErr };

  if (!addressLine1) {
    return { ok: false, error: "Enter a street address for collection." };
  }
  if (addressLine1.length > 160) {
    return { ok: false, error: "Street address is too long." };
  }
  if (!suburb) {
    return { ok: false, error: "Enter a suburb." };
  }
  if (suburb.length > 80) {
    return { ok: false, error: "Suburb is too long." };
  }
  if (!(SERVICE_CITIES as readonly string[]).includes(city)) {
    return { ok: false, error: "Choose Johannesburg or Cape Town." };
  }
  if (!isValidCalendarDate(collectionDate)) {
    return { ok: false, error: "Enter a valid collection date." };
  }
  if (collectionSlot !== "MORNING" && collectionSlot !== "AFTERNOON") {
    return { ok: false, error: "Choose morning or afternoon." };
  }

  return {
    ok: true,
    patch: {
      customer: { name, phone, email },
      addressLine1,
      suburb,
      city: city as ServiceCity,
      collectionDate,
      collectionSlot,
    },
  };
}
