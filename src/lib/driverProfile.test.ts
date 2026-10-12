import { describe, expect, it } from "vitest";
import {
  sanitizeDriverPatch,
  technicianDeleteRefusal,
  technicianLoginFields,
} from "@/lib/driverProfile";

describe("sanitizeDriverPatch", () => {
  it("rejects a non-object body and an empty patch", () => {
    expect(sanitizeDriverPatch(null).ok).toBe(false);
    expect(sanitizeDriverPatch({}).ok).toBe(false);
  });

  it("requires isActive to be a boolean", () => {
    expect(sanitizeDriverPatch({ isActive: "false" }).ok).toBe(false);
    expect(sanitizeDriverPatch({ isActive: false })).toEqual({
      ok: true,
      updates: { isActive: false },
    });
  });

  it("rejects notes on PATCH (notes use dedicated API)", () => {
    expect(sanitizeDriverPatch({ notes: "keep" }).ok).toBe(false);
  });

  it("ignores vehicle on the driver patch (assignment lives on Vehicle)", () => {
    expect(sanitizeDriverPatch({ vehicle: "Nissan NP200" }).ok).toBe(false);
  });

  it("accepts a trimmed name and rejects a name that is not a string", () => {
    expect(sanitizeDriverPatch({ name: "  Thabo   Mokoena  " })).toEqual({
      ok: true,
      updates: { name: "Thabo Mokoena" },
    });
    expect(sanitizeDriverPatch({ name: 1 }).ok).toBe(false);
    expect(sanitizeDriverPatch({ name: " " }).ok).toBe(false);
  });
});

describe("technicianDeleteRefusal", () => {
  it("allows delete when there are no open jobs and no standing vehicle", () => {
    expect(
      technicianDeleteRefusal({ openJobCount: 0, hasStandingVehicle: false })
    ).toBeNull();
  });

  it("refuses while a job is still open", () => {
    const message = technicianDeleteRefusal({
      openJobCount: 1,
      hasStandingVehicle: false,
    });
    expect(message).toMatch(/not Delivered or Cancelled/i);
    expect(message).toMatch(/Nothing was removed/);
  });

  it("refuses while a vehicle still lists them and points at Vehicles", () => {
    const message = technicianDeleteRefusal({
      openJobCount: 0,
      hasStandingVehicle: true,
    });
    expect(message).toMatch(/Vehicles page/);
    expect(message).toMatch(/Nothing was removed/);
  });

  it("names both blockers when a job and a standing vehicle remain", () => {
    const message = technicianDeleteRefusal({
      openJobCount: 2,
      hasStandingVehicle: true,
    });
    expect(message).toMatch(/2 jobs/);
    expect(message).toMatch(/Vehicles page/);
  });
});

describe("technicianLoginFields", () => {
  it("clears disabledAt when activating and sets it when deactivating", () => {
    expect(technicianLoginFields(true)).toEqual({
      disabledAt: null,
      isActive: true,
    });
    const at = new Date("2026-09-16T09:00:00.000Z");
    expect(technicianLoginFields(false, at)).toEqual({
      disabledAt: at,
      isActive: false,
    });
  });
});
