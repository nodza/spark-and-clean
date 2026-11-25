import { describe, expect, it } from "vitest";
import { normalizeBookingHandover } from "@/lib/handover";

describe("normalizeBookingHandover", () => {
  it("leaves a collection and delivery booking unchanged", () => {
    const payload: Record<string, unknown> = {
      addressLine1: "1 Main",
      suburb: "Sea Point",
      city: "Cape Town",
      collectionSlot: "MORNING",
      collectionDate: "2026-10-06",
    };
    expect(normalizeBookingHandover(payload)).toBeNull();
    expect(payload).toMatchObject({
      handoverIn: "collection",
      handoverOut: "delivery",
      addressLine1: "1 Main",
      collectionSlot: "MORNING",
    });
    expect(payload.branchKey).toBeUndefined();
  });

  it("stores the branch and drops the collection slot for an office-only booking", () => {
    const payload: Record<string, unknown> = {
      handoverIn: "dropoff",
      handoverOut: "collect",
      branchKey: "gauteng",
      collectionDate: "2026-10-06",
      collectionSlot: "MORNING",
      addressLine1: "",
      suburb: "",
      city: "",
    };
    expect(normalizeBookingHandover(payload)).toBeNull();
    expect(payload.collectionSlot).toBeUndefined();
    expect(payload.addressLine1).toContain("Kya Sand");
    expect(payload.suburb).toBe("Kya Sand");
    expect(payload.city).toBe("Gauteng");
    expect(payload.branchKey).toBe("gauteng");
  });

  it("keeps the customer address when only the return is office collect", () => {
    const payload: Record<string, unknown> = {
      handoverIn: "collection",
      handoverOut: "collect",
      branchKey: "cape-town",
      collectionSlot: "AFTERNOON",
      collectionDate: "2026-10-06",
      addressLine1: "18 Fredman Drive",
      suburb: "Sandton",
      city: "Johannesburg",
      deliveryDate: "2026-10-09",
      deliverySlot: "MORNING",
    };
    expect(normalizeBookingHandover(payload)).toBeNull();
    expect(payload.addressLine1).toBe("18 Fredman Drive");
    expect(payload.collectionSlot).toBe("AFTERNOON");
    expect(payload.deliveryDate).toBeUndefined();
    expect(payload.deliverySlot).toBeUndefined();
    expect(payload.branchKey).toBe("cape-town");
  });

  it("asks for a branch when a leg is at the office", () => {
    expect(
      normalizeBookingHandover({
        handoverIn: "dropoff",
        handoverOut: "delivery",
        collectionDate: "2026-10-06",
        addressLine1: "1 Main",
        suburb: "Sea Point",
        city: "Cape Town",
      })
    ).toBe("Choose a branch.");
  });
});
