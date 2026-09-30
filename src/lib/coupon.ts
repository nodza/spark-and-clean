import { SERVICE_CITIES, type ServiceCity } from "@/types/user";

export const COUPON_TYPES = ["PERCENT", "FIXED_CENTS"] as const;
export type CouponType = (typeof COUPON_TYPES)[number];

/** Exact case. spark10 does not match SPARK10. */
export const COUPON_CODE_PATTERN = /^[A-Za-z0-9]{2,32}$/;

export const DUPLICATE_COUPON_MESSAGE = "A coupon with that code already exists";
export const INACTIVE_COUPON_MESSAGE = "This coupon is no longer active";
export const UNKNOWN_COUPON_MESSAGE = "That coupon code isn't valid";

const MAX_FIXED_CENTS = 10_000_000;
const MAX_REDEMPTIONS = 1_000_000;

/** A stored coupon with active: false cannot be applied. */
export function inactiveCouponMessage(active: unknown): string | null {
  if (active === false) return INACTIVE_COUPON_MESSAGE;
  return null;
}

/** Checkout may apply a code only when it is on the list and active. */
export function couponApplyError(doc: { active?: unknown } | null): string | null {
  if (!doc) return UNKNOWN_COUPON_MESSAGE;
  return inactiveCouponMessage(doc.active);
}

export function sanitizeCouponActivePatch(
  body: unknown
): { ok: true; active: boolean } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid body" };
  }
  const active = (body as Record<string, unknown>).active;
  if (typeof active !== "boolean") {
    return { ok: false, error: "Active must be true or false" };
  }
  return { ok: true, active };
}

export type CouponCreateInput = {
  code: string;
  type: CouponType;
  value: number;
  active: boolean;
  maxRedemptions: number | null;
  validFrom: Date | null;
  validTo: Date | null;
  city: ServiceCity | null;
};

/** Trim only. Letter case is part of the code. */
export function normalizeCouponCode(raw: string): string {
  return raw.trim();
}

export function couponValueError(type: CouponType, value: number): string | null {
  if (type === "PERCENT") {
    if (!Number.isInteger(value) || value < 1 || value > 100) {
      return "Percent must be a whole number from 1 to 100";
    }
    return null;
  }
  if (!Number.isInteger(value) || value < 1) {
    return "Fixed discount must be a positive number of cents";
  }
  if (value > MAX_FIXED_CENTS) {
    return "Fixed discount is too large";
  }
  return null;
}

export function isDuplicateCouponCode(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const rec = err as { code?: unknown; message?: unknown; cause?: unknown };
  if (rec.code === 11000) return true;
  if (typeof rec.message === "string" && rec.message.includes("E11000")) {
    return true;
  }
  if (rec.cause && rec.cause !== err) return isDuplicateCouponCode(rec.cause);
  return false;
}

function parseOptionalDate(
  raw: unknown,
  label: string
): { ok: true; value: Date | null } | { ok: false; error: string } {
  if (raw == null || raw === "") return { ok: true, value: null };
  if (typeof raw !== "string") {
    return { ok: false, error: `${label} must be a date` };
  }
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return { ok: false, error: `${label} is not a valid date` };
    }
    return { ok: true, value: date };
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: `${label} is not a valid date` };
  }
  return { ok: true, value: date };
}

function parseMaxRedemptions(
  raw: unknown
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (raw == null || raw === "") return { ok: true, value: null };
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1) {
    return {
      ok: false,
      error: "Max redemptions must be a positive whole number",
    };
  }
  if (raw > MAX_REDEMPTIONS) {
    return { ok: false, error: "Max redemptions is too large" };
  }
  return { ok: true, value: raw };
}

export function sanitizeCouponCreate(
  body: unknown
): { ok: true; coupon: CouponCreateInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid body" };
  }
  const raw = body as Record<string, unknown>;

  if (typeof raw.code !== "string") {
    return { ok: false, error: "Code is required" };
  }
  const code = normalizeCouponCode(raw.code);
  if (!COUPON_CODE_PATTERN.test(code)) {
    return { ok: false, error: "Code must be 2–32 letters or numbers" };
  }

  if (raw.type !== "PERCENT" && raw.type !== "FIXED_CENTS") {
    return { ok: false, error: "Discount must be a percent or a fixed amount" };
  }
  const type: CouponType = raw.type;

  if (typeof raw.value !== "number" || Number.isNaN(raw.value)) {
    return { ok: false, error: "Value is required" };
  }
  const valueError = couponValueError(type, raw.value);
  if (valueError) return { ok: false, error: valueError };

  let active = true;
  if ("active" in raw && raw.active !== undefined) {
    if (typeof raw.active !== "boolean") {
      return { ok: false, error: "Active must be true or false" };
    }
    active = raw.active;
  }

  const max = parseMaxRedemptions(raw.maxRedemptions);
  if (!max.ok) return max;

  const validFrom = parseOptionalDate(raw.validFrom, "Valid from");
  if (!validFrom.ok) return validFrom;
  const validTo = parseOptionalDate(raw.validTo, "Valid to");
  if (!validTo.ok) return validTo;
  if (
    validFrom.value &&
    validTo.value &&
    validTo.value.getTime() < validFrom.value.getTime()
  ) {
    return { ok: false, error: "Valid to must be on or after valid from" };
  }

  let city: ServiceCity | null = null;
  if (raw.city != null && raw.city !== "") {
    if (
      typeof raw.city !== "string" ||
      !(SERVICE_CITIES as readonly string[]).includes(raw.city)
    ) {
      return { ok: false, error: "City must be Johannesburg or Cape Town" };
    }
    city = raw.city as ServiceCity;
  }

  return {
    ok: true,
    coupon: {
      code,
      type,
      value: raw.value,
      active,
      maxRedemptions: max.value,
      validFrom: validFrom.value,
      validTo: validTo.value,
      city,
    },
  };
}

function toIso(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

export type ClientCoupon = {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  active: boolean;
  maxRedemptions: number | null;
  redeemedCount: number;
  validFrom: string | null;
  validTo: string | null;
  city: ServiceCity | null;
  createdAt: string | null;
};

export function toClientCoupon(doc: Record<string, unknown>): ClientCoupon {
  const type: CouponType = doc.type === "FIXED_CENTS" ? "FIXED_CENTS" : "PERCENT";
  const max =
    typeof doc.maxRedemptions === "number" &&
    Number.isInteger(doc.maxRedemptions) &&
    doc.maxRedemptions >= 1
      ? doc.maxRedemptions
      : null;
  const city =
    typeof doc.city === "string" &&
    (SERVICE_CITIES as readonly string[]).includes(doc.city)
      ? (doc.city as ServiceCity)
      : null;
  const redeemed =
    typeof doc.redeemedCount === "number" && Number.isFinite(doc.redeemedCount)
      ? doc.redeemedCount
      : 0;

  return {
    id: String(doc._id ?? doc.id ?? ""),
    code: typeof doc.code === "string" ? doc.code : "",
    type,
    value: typeof doc.value === "number" ? doc.value : 0,
    active: doc.active !== false,
    maxRedemptions: max,
    redeemedCount: redeemed,
    validFrom: toIso(doc.validFrom),
    validTo: toIso(doc.validTo),
    city,
    createdAt: toIso(doc.createdAt),
  };
}

export function formatCouponDiscount(type: CouponType, value: number): string {
  if (type === "PERCENT") return `${value}%`;
  return `R${(value / 100).toFixed(2)}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** South African numeric date: DD/MM/YYYY. */
export function formatCouponDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${pad2(date.getUTCDate())}/${pad2(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
}

export function formatCouponWindow(
  validFrom: string | null,
  validTo: string | null
): string {
  if (!validFrom && !validTo) return "Always";
  if (validFrom && validTo) {
    return `${formatCouponDate(validFrom)} - ${formatCouponDate(validTo)}`;
  }
  if (validFrom) return `From ${formatCouponDate(validFrom)}`;
  return `Until ${formatCouponDate(validTo as string)}`;
}
