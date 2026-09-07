import { createHash, randomBytes } from "node:crypto";
import { RESET_TOKEN_TTL_MS } from "@/lib/passwordRules";

export {
  FORGOT_PASSWORD_PUBLIC_MESSAGE,
  MIN_PASSWORD_LENGTH,
  RESET_TOKEN_TTL_MS,
  validatePasswordStrength,
} from "@/lib/passwordRules";

export function generateResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function resetTokenExpiresAt(from = Date.now()): Date {
  return new Date(from + RESET_TOKEN_TTL_MS);
}
