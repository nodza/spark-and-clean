/**
 * Client-side booking form validators (Phase 1).
 * Pure helpers — no React. Used by Step 1 / Step 3 and the wizard gate.
 */

export const MAX_RUG_DIMENSION_M = 20;
export const MIN_RUG_DIMENSION_M = 0.1;

export type FieldErrors = Record<string, string>;

/** Multi-word / multi-part names: "Sipho Bhekizizwe Dlamini", "John Smith Jr." */
export function validateCustomerName(raw: string): string | null {
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value) return "Enter your full name.";
  if (value.length < 2) return "Name looks too short — enter at least 2 characters.";
  if (value.length > 80) return "Name is too long — please shorten it.";

  // Letters (incl. accents), spaces, hyphens, apostrophes, periods
  if (!/^[\p{L}][\p{L}\s.'’-]*$/u.test(value)) {
    return "Use letters only — spaces, hyphens, and apostrophes are fine.";
  }

  return null;
}

/**
 * Strip disallowed characters while typing.
 * Keeps digits, spaces, dashes, parentheses, and a single leading +.
 */
export function sanitizePhoneInput(raw: string): string {
  const withoutLetters = raw.replace(/[^\d+\s\-()]/g, "");
  const plusCount = (withoutLetters.match(/\+/g) || []).length;
  if (plusCount === 0) return withoutLetters;
  // Only allow + at the start
  return withoutLetters.replace(/\+/g, (ch, i) => (i === 0 ? ch : ""));
}

/**
 * South African numbers: 060 / 071 / 082, +2760…, spaces/dashes OK.
 */
export function validateSaPhone(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Enter a phone number.";

  if (/[a-zA-Z]/.test(value)) {
    return "Phone numbers can’t include letters.";
  }

  if (/[^\d+\s\-()]/.test(value)) {
    return "Use digits only — spaces, dashes, or +27 are fine.";
  }

  const digits = value.replace(/\D/g, "");
  let national = digits;

  if (digits.startsWith("27")) {
    if (digits.length !== 11) {
      return "Use +27 followed by 9 digits (e.g. +27 82 123 4567).";
    }
    national = `0${digits.slice(2)}`;
  }

  if (!/^0\d{9}$/.test(national)) {
    return "Use a South African number like 082 123 4567 or +27 82 123 4567.";
  }

  // Common SA mobile / landline leading digits
  if (!/^0(6|7|8|1)\d{8}$/.test(national)) {
    return "Use a valid SA prefix (e.g. 060, 071, 082, or +2760).";
  }

  return null;
}

export function validateEmail(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Enter an email address.";
  if (value.length > 120) return "Email is too long.";
  // Practical email check — not RFC perfection
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
    return "Enter a valid email like name@example.com.";
  }
  return null;
}

export function validateDimensionMeters(
  value: number | null | undefined,
  label: string
): string | null {
  if (value === null || value === undefined) return null; // optional

  if (!Number.isFinite(value)) {
    return `Enter a valid ${label.toLowerCase()} in metres.`;
  }
  if (value < 0) {
    return `${label} can’t be negative. Try something like 2.5.`;
  }
  if (value === 0) {
    return `${label} must be greater than 0, or leave blank for on-site measure.`;
  }
  if (value < MIN_RUG_DIMENSION_M) {
    return `${label} looks too small — use at least ${MIN_RUG_DIMENSION_M}m, or leave blank.`;
  }
  if (value > MAX_RUG_DIMENSION_M) {
    return `${label} seems unrealistic (max ${MAX_RUG_DIMENSION_M}m). Double-check the measurement.`;
  }
  return null;
}

export function validateStep1Dimensions(rug?: {
  widthM?: number | null;
  lengthM?: number | null;
}): FieldErrors {
  const errors: FieldErrors = {};
  const widthErr = validateDimensionMeters(rug?.widthM ?? null, "Width");
  const lengthErr = validateDimensionMeters(rug?.lengthM ?? null, "Length");
  if (widthErr) errors.widthM = widthErr;
  if (lengthErr) errors.lengthM = lengthErr;
  return errors;
}

export function validateStep3Contact(data: {
  addressLine1?: string;
  suburb?: string;
  city?: string;
  customer?: { name?: string; phone?: string; email?: string };
}): FieldErrors {
  const errors: FieldErrors = {};
  const customer = data.customer || {};

  if (!data.addressLine1?.trim()) {
    errors.addressLine1 = "Enter a street address for collection.";
  }
  if (!data.suburb?.trim()) {
    errors.suburb = "Enter a suburb.";
  }
  if (!data.city?.trim()) {
    errors.city = "Enter a city.";
  }

  const nameErr = validateCustomerName(customer.name || "");
  if (nameErr) errors.name = nameErr;

  const phoneErr = validateSaPhone(customer.phone || "");
  if (phoneErr) errors.phone = phoneErr;

  const emailErr = validateEmail(customer.email || "");
  if (emailErr) errors.email = emailErr;

  return errors;
}

export function hasFieldErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
