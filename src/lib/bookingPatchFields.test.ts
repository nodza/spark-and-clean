import { describe, expect, it } from "vitest";
import {
  isBookingStatus,
  isPaymentStatus,
} from "@/lib/bookingPatchFields";

describe("bookingPatchFields", () => {
  it("allowlists known booking statuses", () => {
    expect(isBookingStatus("CLEANING")).toBe(true);
    expect(isBookingStatus("HACKED")).toBe(false);
    expect(isBookingStatus(null)).toBe(false);
  });

  it("allowlists known payment statuses", () => {
    expect(isPaymentStatus("UNPAID")).toBe(true);
    expect(isPaymentStatus("FREE")).toBe(false);
  });
});
