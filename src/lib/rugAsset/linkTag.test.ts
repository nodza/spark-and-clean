import { describe, expect, it } from "vitest";
import {
  inCareLinkConflict,
  isLinkableTargetStatus,
  normalizeTagCode,
  sameRugCustomer,
} from "./linkTag";

describe("normalizeTagCode", () => {
  it("trims and uppercases", () => {
    expect(normalizeTagCode("  sc-rug-abc  ")).toBe("SC-RUG-ABC");
  });
});

describe("inCareLinkConflict", () => {
  it("rejects IN_CARE on another active non-delivered job", () => {
    expect(
      inCareLinkConflict({
        assetStatus: "IN_CARE",
        assetCurrentBookingId: "SC-OLD",
        targetBookingId: "SC-NEW",
        currentBookingStatus: "CLEANING",
      })
    ).toMatch(/IN_CARE on active booking SC-OLD/);
  });

  it("allows linking after the previous job was delivered", () => {
    expect(
      inCareLinkConflict({
        assetStatus: "IN_CARE",
        assetCurrentBookingId: "SC-OLD",
        targetBookingId: "SC-NEW",
        currentBookingStatus: "DELIVERED",
      })
    ).toBeNull();
  });

  it("allows linking when the asset is not IN_CARE", () => {
    expect(
      inCareLinkConflict({
        assetStatus: "RETURNED",
        assetCurrentBookingId: "SC-OLD",
        targetBookingId: "SC-NEW",
        currentBookingStatus: "READY",
      })
    ).toBeNull();
  });

  it("only allows a new link onto BOOKED or SCHEDULED", () => {
    expect(isLinkableTargetStatus("BOOKED")).toBe(true);
    expect(isLinkableTargetStatus("SCHEDULED")).toBe(true);
    for (const status of ["COLLECTED", "READY", "DELIVERED", "CANCELLED"]) {
      expect(isLinkableTargetStatus(status)).toBe(false);
    }
  });

  it("treats two bookings as the same customer by account or guest email", () => {
    expect(
      sameRugCustomer(
        { userId: "user-ada", email: "ada@example.com" },
        { userId: "user-ada", email: "new@example.com" }
      )
    ).toBe(true);
    expect(
      sameRugCustomer(
        { userId: "user-ada", email: "ada@example.com" },
        { userId: "user-other", email: "ada@example.com" }
      )
    ).toBe(false);
    expect(
      sameRugCustomer(
        { email: "Ada@Example.com" },
        { email: " ada@example.com " }
      )
    ).toBe(true);
    expect(
      sameRugCustomer({ email: "ada@example.com" }, { email: "other@example.com" })
    ).toBe(false);
  });

  it("allows idempotent link to the same booking", () => {
    expect(
      inCareLinkConflict({
        assetStatus: "IN_CARE",
        assetCurrentBookingId: "SC-NEW",
        targetBookingId: "SC-NEW",
        currentBookingStatus: "BOOKED",
      })
    ).toBeNull();
  });
});
