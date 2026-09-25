import { randomInt } from "node:crypto";

const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TAG_CODE_LENGTH = 8;

export function generateRugTagCode(): string {
  let suffix = "";
  for (let index = 0; index < TAG_CODE_LENGTH; index += 1) {
    suffix += CROCKFORD_ALPHABET[randomInt(CROCKFORD_ALPHABET.length)];
  }
  return `SC-RUG-${suffix}`;
}