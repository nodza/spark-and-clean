import { describe, expect, it } from "vitest";
import {
  FORGOT_PASSWORD_PUBLIC_MESSAGE,
  MIN_PASSWORD_LENGTH,
  validatePasswordStrength,
} from "@/lib/passwordRules";
import { generateResetToken, hashResetToken } from "@/lib/passwordReset";

describe("password strength", () => {
  it(`requires at least ${MIN_PASSWORD_LENGTH} characters`, () => {
    expect(validatePasswordStrength("short")).toMatch(/at least/);
    expect(validatePasswordStrength("a".repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });
});

describe("reset tokens", () => {
  it("hashes tokens (raw token never equals stored hash)", () => {
    const raw = generateResetToken();
    const hash = hashResetToken(raw);
    expect(hash).not.toEqual(raw);
    expect(hash).toHaveLength(64);
    expect(hashResetToken(raw)).toBe(hash);
  });

  it("different tokens produce different hashes", () => {
    expect(hashResetToken(generateResetToken())).not.toBe(
      hashResetToken(generateResetToken())
    );
  });
});

describe("forgot-password public message", () => {
  it("is stable for enumeration safety", () => {
    expect(FORGOT_PASSWORD_PUBLIC_MESSAGE.toLowerCase()).toContain(
      "if an account exists"
    );
  });
});
