import { describe, expect, it } from "vitest";
import { statusAfterDriverAssign } from "@/lib/bookingAssignment";

describe("statusAfterDriverAssign", () => {
  it("sets SCHEDULED when assigning from BOOKED", () => {
    expect(statusAfterDriverAssign("BOOKED", "driver_1")).toBe("SCHEDULED");
  });

  it("does not change status when already SCHEDULED", () => {
    expect(statusAfterDriverAssign("SCHEDULED", "driver_1")).toBeUndefined();
  });

  it("does not reset CLEANING (or later) to SCHEDULED", () => {
    expect(statusAfterDriverAssign("CLEANING", "driver_2")).toBeUndefined();
    expect(statusAfterDriverAssign("COLLECTED", "driver_2")).toBeUndefined();
    expect(statusAfterDriverAssign("DELIVERED", "driver_2")).toBeUndefined();
  });

  it("does not change status on unassign", () => {
    expect(statusAfterDriverAssign("CLEANING", null)).toBeUndefined();
    expect(statusAfterDriverAssign("BOOKED", null)).toBeUndefined();
  });
});
