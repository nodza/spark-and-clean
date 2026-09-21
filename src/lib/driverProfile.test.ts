import { describe, expect, it } from "vitest";
import { MAX_DRIVER_NOTE_LEN, sanitizeDriverPatch, technicianLoginFields } from "@/lib/driverProfile";

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

  it("trims notes and enforces the max length", () => {
    expect(sanitizeDriverPatch({ notes: "  keep  " })).toEqual({
      ok: true,
      updates: { notes: "keep" },
    });
    expect(
      sanitizeDriverPatch({ notes: "x".repeat(MAX_DRIVER_NOTE_LEN + 1) }).ok
    ).toBe(false);
  });

  it("ignores vehicle on the driver patch (assignment lives on Vehicle)", () => {
    expect(sanitizeDriverPatch({ vehicle: "Nissan NP200" }).ok).toBe(false);
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
