import { describe, expect, it } from "vitest";
import {
  sanitizeVehicleDayCreate,
  sanitizeVehicleDayDateQuery,
  toClientVehicleDayUse,
  vehicleDayConflictMessage,
} from "@/lib/vehicleDay";

describe("sanitizeVehicleDayCreate", () => {
  it("accepts a valid date, driver, and vehicle", () => {
    expect(
      sanitizeVehicleDayCreate({
        date: "2026-10-14",
        driverId: "driver_thabo",
        vehicleId: "vehicle_np200",
      })
    ).toEqual({
      ok: true,
      value: {
        date: "2026-10-14",
        driverId: "driver_thabo",
        vehicleId: "vehicle_np200",
      },
    });
  });

  it("rejects a bad date or missing ids", () => {
    expect(
      sanitizeVehicleDayCreate({
        date: "14-10-2026",
        driverId: "driver_thabo",
        vehicleId: "vehicle_np200",
      }).ok
    ).toBe(false);
    expect(
      sanitizeVehicleDayCreate({
        date: "2026-10-14",
        driverId: "",
        vehicleId: "vehicle_np200",
      }).ok
    ).toBe(false);
  });
});

describe("sanitizeVehicleDayDateQuery", () => {
  it("requires yyyy-MM-dd", () => {
    expect(sanitizeVehicleDayDateQuery("2026-10-14")).toEqual({
      ok: true,
      date: "2026-10-14",
    });
    expect(sanitizeVehicleDayDateQuery(null).ok).toBe(false);
  });
});

describe("vehicleDayConflictMessage", () => {
  it("maps the date+vehicle unique index to a clear 409 message", () => {
    expect(
      vehicleDayConflictMessage({
        code: 11000,
        keyPattern: { date: 1, vehicleId: 1 },
      })
    ).toMatch(/already logged/i);
  });
});

describe("toClientVehicleDayUse", () => {
  it("includes vehicle label and plate for the day list", () => {
    expect(
      toClientVehicleDayUse(
        {
          id: "vday_1",
          date: "2026-10-14",
          driverId: "driver_thabo",
          vehicleId: "vehicle_np200",
        },
        { label: "Nissan NP200", plate: "CA 123-456" }
      )
    ).toEqual({
      id: "vday_1",
      date: "2026-10-14",
      driverId: "driver_thabo",
      vehicleId: "vehicle_np200",
      driverName: "",
      label: "Nissan NP200",
      plate: "CA 123-456",
    });
    expect(
      toClientVehicleDayUse(
        {
          id: "vday_1",
          date: "2026-10-14",
          driverId: "driver_thabo",
          vehicleId: "vehicle_np200",
        },
        { label: "Nissan NP200", plate: "CA 123-456" },
        "Thabo"
      ).driverName
    ).toBe("Thabo");
  });
});
