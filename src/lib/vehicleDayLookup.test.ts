import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dayFind: vi.fn(),
  vehicleFind: vi.fn(),
}));

vi.mock("@/models/VehicleDayUse", () => ({
  VehicleDayUse: { find: mocks.dayFind },
}));
vi.mock("@/models/Vehicle", () => ({
  Vehicle: { find: mocks.vehicleFind },
}));

import { listDayVehiclesForDriver } from "@/lib/vehicleDay";

function dayChain(rows: unknown[]) {
  const lean = vi.fn().mockResolvedValue(rows);
  const select = vi.fn(() => ({ lean }));
  const sort = vi.fn(() => ({ select }));
  return { sort, select, lean };
}

function vehicleChain(rows: unknown[]) {
  const lean = vi.fn().mockResolvedValue(rows);
  const select = vi.fn(() => ({ lean }));
  return { select, lean };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listDayVehiclesForDriver", () => {
  it("returns every day-log vehicle for that driver and date", async () => {
    mocks.dayFind.mockReturnValue(
      dayChain([
        { vehicleId: "vehicle_np200" },
        { vehicleId: "vehicle_quantum" },
      ])
    );
    mocks.vehicleFind.mockReturnValue(
      vehicleChain([
        { id: "vehicle_np200", label: "Nissan NP200", plate: "CA 123-456" },
        {
          id: "vehicle_quantum",
          label: "Toyota Quantum",
          plate: "CA 555-001",
        },
      ])
    );

    await expect(
      listDayVehiclesForDriver("driver_thabo", "2026-10-14")
    ).resolves.toEqual([
      { label: "Nissan NP200", plate: "CA 123-456" },
      { label: "Toyota Quantum", plate: "CA 555-001" },
    ]);
    expect(mocks.dayFind).toHaveBeenCalledWith({
      driverId: "driver_thabo",
      date: "2026-10-14",
    });
  });

  it("returns an empty list when that date has no day-log rows", async () => {
    mocks.dayFind.mockReturnValue(dayChain([]));

    await expect(
      listDayVehiclesForDriver("driver_thabo", "2026-10-15")
    ).resolves.toEqual([]);
    expect(mocks.vehicleFind).not.toHaveBeenCalled();
  });
});
