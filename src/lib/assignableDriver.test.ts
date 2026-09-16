import { describe, expect, it } from "vitest";
import { isAssignableDriverPair } from "@/lib/assignableDriver";

describe("isAssignableDriverPair", () => {
  it("rejects missing pairs, inactive drivers, and disabled logins", () => {
    expect(isAssignableDriverPair(null, null)).toBe(false);
    expect(isAssignableDriverPair({ isActive: false }, { disabledAt: null })).toBe(
      false
    );
    expect(
      isAssignableDriverPair({ isActive: true }, { disabledAt: new Date() })
    ).toBe(false);
    expect(isAssignableDriverPair({ isActive: true }, { disabledAt: null })).toBe(
      true
    );
    expect(isAssignableDriverPair(null, { disabledAt: null })).toBe(true);
  });
});
