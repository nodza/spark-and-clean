import { describe, expect, it } from "vitest";
import { telHref } from "@/lib/phone";

describe("telHref", () => {
  it("normalizes a South African 0xx number to +27", () => {
    expect(telHref("082 555 1234")).toBe("tel:+27825551234");
  });

  it("preserves an already international number", () => {
    expect(telHref("+27 74 281 5432")).toBe("tel:+27742815432");
  });
});
