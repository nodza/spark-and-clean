import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  connectDB: vi.fn(),
  driverFindOne: vi.fn(),
  driverFindOneAndUpdate: vi.fn(),
  driverDeleteOne: vi.fn(),
  userUpdateMany: vi.fn(),
  userDeleteMany: vi.fn(),
  bookingCount: vi.fn(),
  vehicleExists: vi.fn(),
  vehicleFind: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/mongodb", () => ({ connectDB: mocks.connectDB }));
vi.mock("@/models/Driver", () => ({
  Driver: {
    findOne: mocks.driverFindOne,
    findOneAndUpdate: mocks.driverFindOneAndUpdate,
    deleteOne: mocks.driverDeleteOne,
  },
}));
vi.mock("@/models/User", () => ({
  User: {
    updateMany: mocks.userUpdateMany,
    deleteMany: mocks.userDeleteMany,
    findOne: vi.fn(),
  },
}));
vi.mock("@/models/Booking", () => ({
  Booking: {
    countDocuments: mocks.bookingCount,
  },
}));
vi.mock("@/models/Vehicle", () => ({
  Vehicle: {
    exists: mocks.vehicleExists,
    find: mocks.vehicleFind,
  },
}));

import { DELETE, PATCH } from "./route";

const driverId = "driver_thabo";

function query(result: unknown) {
  const lean = vi.fn().mockResolvedValue(result);
  return { lean, select: vi.fn(() => ({ lean })) };
}

function driverDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: driverId,
    name: "Thabo Mokoena",
    phone: "082 000 0000",
    email: "thabo@example.com",
    isActive: true,
    ...overrides,
  };
}

function patch(body: Record<string, unknown>, id = driverId) {
  return PATCH(
    new Request(`http://localhost/api/drivers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  );
}

function remove(id = driverId) {
  return DELETE(
    new Request(`http://localhost/api/drivers/${id}`, { method: "DELETE" }),
    { params: Promise.resolve({ id }) }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.connectDB.mockResolvedValue(undefined);
  mocks.getSession.mockResolvedValue({
    id: "admin-1",
    email: "ops@example.com",
    role: "admin",
    adminTier: "full",
  });
  mocks.driverFindOne.mockImplementation(() => query(driverDoc()));
  mocks.driverFindOneAndUpdate.mockImplementation((_filter, update) => {
    const set = (update as { $set?: Record<string, unknown> }).$set ?? {};
    return query(driverDoc(set));
  });
  mocks.userUpdateMany.mockResolvedValue({ modifiedCount: 1 });
  mocks.userDeleteMany.mockResolvedValue({ deletedCount: 1 });
  mocks.driverDeleteOne.mockResolvedValue({ deletedCount: 1 });
  mocks.bookingCount.mockResolvedValue(0);
  mocks.vehicleExists.mockResolvedValue(null);
  mocks.vehicleFind.mockImplementation(() => query([]));
});

describe("PATCH /api/drivers/[id]", () => {
  it("saves name and phone on the driver and the technician login", async () => {
    const res = await patch({
      name: "  Thabo   Nkosi  ",
      phone: " 071 555 0101 ",
    });

    expect(res.status).toBe(200);
    expect(mocks.driverFindOneAndUpdate).toHaveBeenCalledWith(
      { id: driverId },
      { $set: { name: "Thabo Nkosi", phone: "071 555 0101" } },
      { new: true, runValidators: true }
    );
    expect(mocks.userUpdateMany).toHaveBeenCalledWith(
      { role: "technician", driverProfileId: driverId },
      { $set: { name: "Thabo Nkosi", phone: "071 555 0101" } }
    );
    const body = await res.json();
    expect(body.email).toBe("thabo@example.com");
  });

  it("still toggles the technician login when only isActive changes", async () => {
    const res = await patch({ isActive: false });

    expect(res.status).toBe(200);
    expect(mocks.userUpdateMany).toHaveBeenCalledWith(
      { role: "technician", driverProfileId: driverId },
      {
        $set: {
          disabledAt: expect.any(Date),
          isActive: false,
        },
      }
    );
  });

  it("rejects a name that is too short and does not write", async () => {
    const res = await patch({ name: "T" });

    expect(res.status).toBe(400);
    expect(mocks.driverFindOneAndUpdate).not.toHaveBeenCalled();
    expect(mocks.userUpdateMany).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/drivers/[id]", () => {
  it("refuses while an open job is still assigned and leaves records in place", async () => {
    mocks.bookingCount.mockResolvedValue(1);

    const res = await remove();
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/not Delivered or Cancelled/i);
    expect(mocks.bookingCount).toHaveBeenCalledWith({
      assignedDriverId: driverId,
      status: { $nin: ["DELIVERED", "CANCELLED"] },
    });
    expect(mocks.userDeleteMany).not.toHaveBeenCalled();
    expect(mocks.driverDeleteOne).not.toHaveBeenCalled();
  });

  it("refuses while a vehicle lists them as the standing driver", async () => {
    mocks.vehicleExists.mockResolvedValue({ _id: "vehicle-1" });

    const res = await remove();
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/Vehicles page/);
    expect(mocks.userDeleteMany).not.toHaveBeenCalled();
    expect(mocks.driverDeleteOne).not.toHaveBeenCalled();
    expect(mocks.vehicleExists).toHaveBeenCalledWith({
      assignedDriverId: driverId,
    });
  });

  it("removes the login and driver profile when only closed jobs remain", async () => {
    const res = await remove();

    expect(res.status).toBe(200);
    expect(mocks.bookingCount).toHaveBeenCalledWith({
      assignedDriverId: driverId,
      status: { $nin: ["DELIVERED", "CANCELLED"] },
    });
    expect(mocks.userDeleteMany).toHaveBeenCalledWith({
      role: "technician",
      driverProfileId: driverId,
    });
    expect(mocks.driverDeleteOne).toHaveBeenCalledWith({ id: driverId });
  });

  it("returns 404 when the driver profile does not exist", async () => {
    mocks.driverFindOne.mockImplementation(() => query(null));

    const res = await remove();

    expect(res.status).toBe(404);
    expect(mocks.userDeleteMany).not.toHaveBeenCalled();
    expect(mocks.bookingCount).not.toHaveBeenCalled();
  });
});
