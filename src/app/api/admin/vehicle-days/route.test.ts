import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireFullAdmin: vi.fn(),
  connectDB: vi.fn(),
  driverFindOne: vi.fn(),
  userFindOne: vi.fn(),
  vehicleFindOne: vi.fn(),
  vehicleFind: vi.fn(),
  dayFind: vi.fn(),
  dayCreate: vi.fn(),
}));

vi.mock("@/lib/adminAuth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/adminAuth")>();
  return {
    ...actual,
    requireFullAdmin: mocks.requireFullAdmin,
  };
});
vi.mock("@/lib/mongodb", () => ({ connectDB: mocks.connectDB }));
vi.mock("@/models/Driver", () => ({
  Driver: { findOne: mocks.driverFindOne },
}));
vi.mock("@/models/User", () => ({
  User: { findOne: mocks.userFindOne },
}));
vi.mock("@/models/Vehicle", () => ({
  Vehicle: {
    findOne: mocks.vehicleFindOne,
    find: mocks.vehicleFind,
  },
}));
vi.mock("@/models/VehicleDayUse", () => ({
  VehicleDayUse: {
    find: mocks.dayFind,
    create: mocks.dayCreate,
  },
}));

import { GET, POST } from "./route";

const date = "2026-10-14";
const thabo = "driver_thabo";
const sipho = "driver_sipho";
const np200 = "vehicle_np200";
const quantum = "vehicle_quantum";

function post(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/admin/vehicle-days", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

function get(dateValue: string) {
  return GET(
    new Request(
      `http://localhost/api/admin/vehicle-days?date=${encodeURIComponent(dateValue)}`
    )
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireFullAdmin.mockResolvedValue(undefined);
  mocks.connectDB.mockResolvedValue(undefined);
  mocks.driverFindOne.mockImplementation((filter: { id?: string }) => ({
    lean: async () =>
      filter.id === thabo || filter.id === sipho
        ? { id: filter.id, isActive: true, name: "Tech" }
        : null,
  }));
  mocks.userFindOne.mockReturnValue({
    select: () => ({
      lean: async () => ({ disabledAt: null, isActive: true }),
    }),
  });
  mocks.vehicleFindOne.mockImplementation((filter: { id?: string }) => ({
    select: () => ({
      lean: async () => {
        if (filter.id === np200) {
          return { id: np200, label: "Nissan NP200", plate: "CA 111-111" };
        }
        if (filter.id === quantum) {
          return { id: quantum, label: "Toyota Quantum", plate: "CA 222-222" };
        }
        return null;
      },
    }),
  }));
  mocks.dayCreate.mockImplementation(async (doc: Record<string, unknown>) => ({
    toObject: () => doc,
  }));
});

describe("POST /api/admin/vehicle-days", () => {
  it("lets one driver log two different vehicles on the same date", async () => {
    const first = await post({ date, driverId: thabo, vehicleId: np200 });
    const second = await post({ date, driverId: thabo, vehicleId: quantum });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(mocks.dayCreate).toHaveBeenCalledTimes(2);
    expect((await first.json()).entry).toMatchObject({
      driverId: thabo,
      vehicleId: np200,
      label: "Nissan NP200",
      plate: "CA 111-111",
    });
    expect((await second.json()).entry).toMatchObject({
      driverId: thabo,
      vehicleId: quantum,
      label: "Toyota Quantum",
    });
  });

  it("returns 409 when the same vehicle is logged to another driver that day", async () => {
    mocks.dayCreate.mockRejectedValueOnce({
      code: 11000,
      keyPattern: { date: 1, vehicleId: 1 },
    });

    const res = await post({ date, driverId: sipho, vehicleId: np200 });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "That vehicle is already logged to a driver on this date",
    });
  });

  it("rejects an unknown vehicle or inactive driver", async () => {
    const missingVehicle = await post({
      date,
      driverId: thabo,
      vehicleId: "vehicle_missing",
    });
    expect(missingVehicle.status).toBe(404);

    mocks.driverFindOne.mockReturnValueOnce({
      lean: async () => ({ id: thabo, isActive: false }),
    });
    const inactive = await post({ date, driverId: thabo, vehicleId: np200 });
    expect(inactive.status).toBe(400);
    expect(mocks.dayCreate).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/vehicle-days", () => {
  it("returns both vehicles for a driver with label and plate", async () => {
    mocks.dayFind.mockReturnValue({
      sort: () => ({
        lean: async () => [
          {
            id: "vday_1",
            date,
            driverId: thabo,
            vehicleId: np200,
          },
          {
            id: "vday_2",
            date,
            driverId: thabo,
            vehicleId: quantum,
          },
        ],
      }),
    });
    mocks.vehicleFind.mockReturnValue({
      select: () => ({
        lean: async () => [
          { id: np200, label: "Nissan NP200", plate: "CA 111-111" },
          { id: quantum, label: "Toyota Quantum", plate: "CA 222-222" },
        ],
      }),
    });

    const res = await get(date);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      date,
      entries: [
        {
          id: "vday_1",
          date,
          driverId: thabo,
          vehicleId: np200,
          label: "Nissan NP200",
          plate: "CA 111-111",
        },
        {
          id: "vday_2",
          date,
          driverId: thabo,
          vehicleId: quantum,
          label: "Toyota Quantum",
          plate: "CA 222-222",
        },
      ],
    });
  });
});
