import { describe, expect, it } from "vitest";
import {
  compactVehicleFromDisplay,
  formatAssignedDriverLine,
  formatVehicleCompact,
  formatVehicleFull,
  mongoDuplicateField,
  nextVehicleAssignments,
  overlayDriverVehicle,
  plateUniqueKey,
  platesClash,
  sanitizeVehicleAssign,
  sanitizeVehicleCreate,
  sanitizeVehiclePatch,
  vehicleConflictMessage,
} from "@/lib/vehicle";

describe("vehicle display", () => {
  it("formats full and compact labels for the seeded bakkies", () => {
    expect(formatVehicleFull("Nissan NP200", "CA 123-456")).toBe(
      "Nissan NP200 (CA 123-456)"
    );
    expect(formatVehicleCompact("Nissan NP200", "CA 123-456")).toBe(
      "NP200 CA 123-456"
    );
    expect(formatVehicleCompact("Toyota Hilux", "CA 987-654")).toBe(
      "Hilux CA 987-654"
    );
  });

  it("shows driver · vehicle on jobs without a job-level vehicleId", () => {
    expect(
      formatAssignedDriverLine("Thabo Mbeki", {
        label: "Nissan NP200",
        plate: "CA 123-456",
      })
    ).toBe("Thabo · NP200 CA 123-456");
    expect(
      formatAssignedDriverLine("Thabo", "Nissan NP200 (CA 123-456)")
    ).toBe("Thabo · NP200 CA 123-456");
    expect(formatAssignedDriverLine("Thabo")).toBe("Thabo");
  });

  it("compacts a legacy driver.vehicle string", () => {
    expect(compactVehicleFromDisplay("Nissan NP200 (CA 123-456)")).toBe(
      "NP200 CA 123-456"
    );
  });
});

describe("nextVehicleAssignments", () => {
  const fleet = [
    { id: "v1", assignedDriverId: "driver_a" },
    { id: "v2", assignedDriverId: "driver_b" },
    { id: "v3", assignedDriverId: null },
  ];

  it("clears the previous driver when a bakkie moves", () => {
    expect(nextVehicleAssignments(fleet, "v1", "driver_b")).toEqual([
      { id: "v1", assignedDriverId: "driver_b" },
      { id: "v2", assignedDriverId: null },
      { id: "v3", assignedDriverId: null },
    ]);
  });

  it("unassigns without touching other rows", () => {
    expect(nextVehicleAssignments(fleet, "v1", null)).toEqual([
      { id: "v1", assignedDriverId: null },
      { id: "v2", assignedDriverId: "driver_b" },
      { id: "v3", assignedDriverId: null },
    ]);
  });
});

describe("sanitizeVehicleCreate / assign", () => {
  it("normalizes label and plate", () => {
    expect(
      sanitizeVehicleCreate({
        label: "  Nissan   NP200 ",
        plate: "ca 123-456",
        assignedDriverId: "driver_1",
      })
    ).toEqual({
      ok: true,
      label: "Nissan NP200",
      plate: "CA 123-456",
      assignedDriverId: "driver_1",
    });
  });

  it("rejects empty fields", () => {
    expect(sanitizeVehicleCreate({ label: " ", plate: "CA 1" }).ok).toBe(false);
    expect(sanitizeVehicleCreate({ label: "Hilux", plate: "  " }).ok).toBe(false);
  });

  it("treats blank assignedDriverId as unassign", () => {
    expect(sanitizeVehicleAssign({ assignedDriverId: "" })).toEqual({
      ok: true,
      assignedDriverId: null,
    });
    expect(sanitizeVehicleAssign({ assignedDriverId: "driver_2" })).toEqual({
      ok: true,
      assignedDriverId: "driver_2",
    });
  });

  it("patches label and plate without requiring assignment", () => {
    expect(
      sanitizeVehiclePatch({ label: "  Ford Ranger ", plate: "ca 111-222" })
    ).toEqual({
      ok: true,
      label: "Ford Ranger",
      plate: "CA 111-222",
    });
  });
});

describe("overlayDriverVehicle", () => {
  it("never falls back to a free-text Driver.vehicle string", () => {
    const driver = {
      id: "driver_1",
      name: "Thabo Mbeki",
      vehicle: "Nissan NP200 (CA 123-456)",
    };
    expect(overlayDriverVehicle(driver, undefined).vehicle).toBeUndefined();
    expect(
      overlayDriverVehicle(driver, { label: "Toyota Hilux", plate: "CA 987-654" })
        .vehicle
    ).toBe("Toyota Hilux (CA 987-654)");
  });
});

describe("plate uniqueness", () => {
  it("treats mixed caps and spacing as the same plate", () => {
    expect(plateUniqueKey("ca 123-456")).toBe("CA123456");
    expect(plateUniqueKey("CA-123-456")).toBe("CA123456");
    expect(platesClash("ca 123-456", "CA 123-456")).toBe(true);
    expect(platesClash("CA 123-456", "CA 987-654")).toBe(false);
  });

  it("returns a clear 409 for a unique plate clash", () => {
    expect(
      vehicleConflictMessage(
        mongoDuplicateField({
          code: 11000,
          keyPattern: { plateKey: 1 },
          keyValue: { plateKey: "CA123456" },
        })
      )
    ).toEqual({
      status: 409,
      error: "A vehicle with this plate already exists",
    });
  });
});
