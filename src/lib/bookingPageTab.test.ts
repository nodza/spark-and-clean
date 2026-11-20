import { describe, expect, it } from "vitest";
import { initialBookingTab } from "@/lib/bookingPageTab";

describe("initialBookingTab", () => {
  it("opens the invoice from a delivered email and tracking otherwise", () => {
    expect(initialBookingTab(null, "invoice")).toBe("invoice");
    expect(initialBookingTab(null, "tracking")).toBe("tracking");
    expect(initialBookingTab("success", null)).toBe("invoice");
    expect(initialBookingTab(null, null)).toBe("tracking");
    expect(initialBookingTab(null, "nope")).toBe("tracking");
  });
});
