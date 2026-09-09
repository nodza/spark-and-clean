import { randomBytes } from "node:crypto";

const ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";

/** Readable one-time password for admin-created technician logins. */
export function generateTemporaryPassword(length = 12): string {
  const size = Math.max(8, length);
  const bytes = randomBytes(size);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
