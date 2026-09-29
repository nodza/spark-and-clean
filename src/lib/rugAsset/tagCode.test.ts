import { describe, expect, it } from "vitest";
import { generateRugTagCode } from "@/lib/rugAsset/tagCode";

describe("generateRugTagCode", () => {
  it("generates unique eight-character Crockford-ish tag codes", () => {
    const codes = Array.from({ length: 1000 }, () => generateRugTagCode());

    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((code) => /^SC-RUG-[0-9A-HJKMNP-TV-Z]{8}$/.test(code))).toBe(
      true
    );
  });

  it("does not generate booking-style Cape Town references", () => {
    const bookingReference = /^SC-CPT-\d{4}-\d{4}-\d{4}$/;

    expect(
      Array.from({ length: 1000 }, () => generateRugTagCode()).some((code) =>
        bookingReference.test(code)
      )
    ).toBe(false);
  });
});