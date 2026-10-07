import { describe, expect, it } from "vitest";
import { inCareLinkConflict, normalizeTagCode } from "./linkTag";

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
