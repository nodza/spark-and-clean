/** Client-safe referral code helpers. No database imports. */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const CODE_PATTERN = new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`);

export const REFERRAL_CODE_ALPHABET = ALPHABET;
export const REFERRAL_CODE_LENGTH = CODE_LENGTH;

/** Readable codes only. Spaces and hyphens are ignored so a shared code still matches. */
export function normalizeReferralCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase().replace(/[\s-]/g, "");
  if (!CODE_PATTERN.test(code)) return null;
  return code;
}

export function referralSharePath(code: string): string {
  return `/signup?ref=${encodeURIComponent(code)}`;
}
