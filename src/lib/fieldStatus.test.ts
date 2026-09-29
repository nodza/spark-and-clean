import { describe, expect, it } from "vitest";
import {
  bothDimensionsEmpty,
  formatRugSizeLabel,
  isAllowedVanTransition,
  isDepotStatus,
  parseOptionalCollectDimensions,
  technicianFieldUpdate,
} from "@/lib/fieldStatus";

const thabo = "driver_1";
const sipho = "driver_2";

function vanUpdate(
  partial: Partial<Parameters<typeof technicianFieldUpdate>[0]>
) {
  return technicianFieldUpdate({
    driverProfileId: thabo,
    assignedDriverId: thabo,
    from: "SCHEDULED",
    to: "COLLECTED",
    existingWidth: null,
    existingLength: null,
    widthProvided: false,
    lengthProvided: false,
    widthM: undefined,
    lengthM: undefined,
    ...partial,
  });
}

describe("van status transitions", () => {
  it("allows collect from BOOKED or SCHEDULED and deliver from READY", () => {
    expect(isAllowedVanTransition("BOOKED", "COLLECTED")).toBe(true);
    expect(isAllowedVanTransition("SCHEDULED", "COLLECTED")).toBe(true);
    expect(isAllowedVanTransition("READY", "DELIVERED")).toBe(true);
  });

  it("rejects deliver while the rug is still at the depot", () => {
    for (const from of ["COLLECTED", "CLEANING", "DRYING"] as const) {
      expect(isDepotStatus(from)).toBe(true);
      expect(isAllowedVanTransition(from, "DELIVERED")).toBe(false);
      const result = vanUpdate({ from, to: "DELIVERED" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(400);
    }
  });

  it("rejects SCHEDULED → DELIVERED", () => {
    const result = vanUpdate({ to: "DELIVERED" });
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "That status change is not allowed from the van.",
    });
  });

  it("rejects Sipho collecting Thabo’s job", () => {
    const result = vanUpdate({
      driverProfileId: sipho,
      assignedDriverId: thabo,
    });
    expect(result).toEqual({
      ok: false,
      status: 403,
      error: "Forbidden",
    });
  });

  it("lets Thabo mark his SCHEDULED job collected", () => {
    const result = vanUpdate({});
    expect(result).toEqual({ ok: true, set: { status: "COLLECTED" } });
  });

  it("lets a READY job be marked delivered", () => {
    const result = vanUpdate({ from: "READY", to: "DELIVERED" });
    expect(result).toEqual({ ok: true, set: { status: "DELIVERED" } });
  });
});

describe("collect dimensions", () => {
  it("saves 2 × 3 m as 6 m²", () => {
    const parsed = parseOptionalCollectDimensions("2", "3");
    expect(parsed).toEqual({
      ok: true,
      dimensions: { widthM: 2, lengthM: 3, areaSqM: 6 },
    });

    const result = vanUpdate({
      widthProvided: true,
      lengthProvided: true,
      widthM: 2,
      lengthM: 3,
    });
    expect(result).toEqual({
      ok: true,
      set: {
        status: "COLLECTED",
        "rug.widthM": 2,
        "rug.lengthM": 3,
        "rug.areaSqM": 6,
      },
    });
    expect(formatRugSizeLabel({ widthM: 2, lengthM: 3, areaSqM: 6 })).toBe(
      "2m × 3m (6 m²)"
    );
  });

  it("skips size when both fields are blank", () => {
    expect(parseOptionalCollectDimensions("  ", "")).toEqual({
      ok: true,
      dimensions: null,
    });
    expect(bothDimensionsEmpty(null, null)).toBe(true);
    const result = vanUpdate({
      widthProvided: true,
      lengthProvided: true,
      widthM: null,
      lengthM: null,
    });
    expect(result).toEqual({ ok: true, set: { status: "COLLECTED" } });
  });

  it("requires both sides when one is filled", () => {
    const parsed = parseOptionalCollectDimensions("2", "");
    expect(parsed.ok).toBe(false);
    const result = vanUpdate({
      widthProvided: true,
      lengthProvided: false,
      widthM: 2,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("does not overwrite a size that is already on the booking", () => {
    const result = vanUpdate({
      existingWidth: 1.5,
      existingLength: 2,
      widthProvided: true,
      lengthProvided: true,
      widthM: 2,
      lengthM: 3,
    });
    expect(result.ok).toBe(false);
  });
});
