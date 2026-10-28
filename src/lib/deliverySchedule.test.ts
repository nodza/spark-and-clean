import { describe, expect, it } from "vitest";
import {
  effectiveDeliveryDriverId,
  formatClientDeliveryLine,
  hasDeliverySchedule,
  isReadyNeedingDeliverySchedule,
  sanitizeDeliverySchedulePatch,
  technicianOwnsJob,
} from "@/lib/deliverySchedule";

describe("hasDeliverySchedule", () => {
  it("requires a calendar day and a slot", () => {
    expect(
      hasDeliverySchedule({
        deliveryDate: "2026-10-28",
        deliverySlot: "MORNING",
      })
    ).toBe(true);
    expect(hasDeliverySchedule({ deliveryDate: "2026-10-28" })).toBe(false);
    expect(hasDeliverySchedule({ deliverySlot: "AFTERNOON" })).toBe(false);
  });
});

describe("isReadyNeedingDeliverySchedule", () => {
  it("flags READY without a delivery window", () => {
    expect(
      isReadyNeedingDeliverySchedule({
        status: "READY",
        assignedDriverId: "d1",
      })
    ).toBe(true);
    expect(
      isReadyNeedingDeliverySchedule({
        status: "READY",
        deliveryDate: "2026-10-28",
        deliverySlot: "AFTERNOON",
      })
    ).toBe(false);
    expect(
      isReadyNeedingDeliverySchedule({
        status: "SCHEDULED",
      })
    ).toBe(false);
  });
});

describe("effectiveDeliveryDriverId", () => {
  it("falls back to the collecting driver", () => {
    expect(
      effectiveDeliveryDriverId({ assignedDriverId: "collect" })
    ).toBe("collect");
    expect(
      effectiveDeliveryDriverId({
        assignedDriverId: "collect",
        deliveryDriverId: "deliver",
      })
    ).toBe("deliver");
  });
});

describe("formatClientDeliveryLine", () => {
  it("matches Delivery: <day> <date>, morning|afternoon", () => {
    expect(
      formatClientDeliveryLine({
        deliveryDate: "2026-10-28",
        deliverySlot: "MORNING",
      })
    ).toBe("Delivery: Wed 28 Oct, morning");
    expect(
      formatClientDeliveryLine({
        deliveryDate: "2026-10-28",
        deliverySlot: "AFTERNOON",
      })
    ).toBe("Delivery: Wed 28 Oct, afternoon");
  });
});

describe("sanitizeDeliverySchedulePatch", () => {
  it("accepts date, slot, and optional driver", () => {
    const parsed = sanitizeDeliverySchedulePatch({
      deliveryDate: "2026-10-28",
      deliverySlot: "MORNING",
      deliveryDriverId: "driver_1",
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.patch).toEqual({
        deliveryDate: "2026-10-28",
        deliverySlot: "MORNING",
        deliveryDriverId: "driver_1",
      });
    }
  });

  it("rejects a missing slot", () => {
    expect(
      sanitizeDeliverySchedulePatch({
        deliveryDate: "2026-10-28",
      }).ok
    ).toBe(false);
  });
});

describe("technicianOwnsJob", () => {
  it("lets the delivery driver open a scheduled READY return", () => {
    const job = {
      status: "READY" as const,
      assignedDriverId: "collector",
      deliveryDriverId: "returner",
      deliveryDate: "2026-10-28",
      deliverySlot: "MORNING" as const,
    };
    expect(technicianOwnsJob(job, "returner")).toBe(true);
    expect(technicianOwnsJob(job, "collector")).toBe(true);
    expect(technicianOwnsJob(job, "other")).toBe(false);
  });
});
