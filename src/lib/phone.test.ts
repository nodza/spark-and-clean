import { describe, expect, it } from "vitest";
import { driverProfileHref, telHref, toE164Digits } from "@/lib/phone";

describe("telHref", () => {
  it("normalizes a South African 0xx number to +27", () => {
    expect(telHref("082 555 1234")).toBe("tel:+27825551234");
  });

  it("preserves an already international number", () => {
    expect(telHref("+27 74 281 5432")).toBe("tel:+27742815432");
  });

  it("strips non-digits before building the href", () => {
    expect(toE164Digits("(082) 555-1234")).toBe("27825551234");
    expect(telHref("(082) 555-1234")).toBe("tel:+27825551234");
  });
});

describe("driverProfileHref", () => {
  it("uses the drivers redirect path for canonical tech profile URLs", () => {
    expect(driverProfileHref("driver_1")).toBe("/admin/drivers/driver_1");
  });
});
