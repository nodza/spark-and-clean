import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  connectDB: vi.fn(),
  bookingFindOne: vi.fn(),
  bookingFindOneAndUpdate: vi.fn(),
  bookingUpdateOne: vi.fn(),
  driverFindOne: vi.fn(),
  punchOnce: vi.fn(),
  creditReferrerOnce: vi.fn(),
  deliveryClientId: vi.fn(),
  listDayVehiclesForDriver: vi.fn(),
  vehiclesByDriverId: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/mongodb", () => ({ connectDB: mocks.connectDB }));
vi.mock("@/models/Booking", () => ({
  Booking: {
    findOne: mocks.bookingFindOne,
    findOneAndUpdate: mocks.bookingFindOneAndUpdate,
    updateOne: mocks.bookingUpdateOne,
  },
}));
vi.mock("@/models/Driver", () => ({
  Driver: { findOne: mocks.driverFindOne },
}));
vi.mock("@/lib/promotion/loyalty", () => ({
  punchOnce: mocks.punchOnce,
  deliveryClientId: (...args: unknown[]) => mocks.deliveryClientId(...args),
}));
vi.mock("@/lib/referral", () => ({
  creditReferrerOnce: mocks.creditReferrerOnce,
}));
vi.mock("@/lib/vehicleDay", () => ({
  listDayVehiclesForDriver: mocks.listDayVehiclesForDriver,
}));
vi.mock("@/lib/vehicleStore", () => ({
  vehiclesByDriverId: mocks.vehiclesByDriverId,
}));

import { GET, PATCH } from "./route";

const sarahId = "507f1f77bcf86cd799439011";

function lean(result: unknown) {
  return { lean: vi.fn().mockResolvedValue(result) };
}

function patch(body: Record<string, unknown>, id = "SC-SARAH") {
  return PATCH(
    new Request(`http://localhost/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  );
}

function get(id = "SC-SARAH") {
  return GET(new Request(`http://localhost/api/bookings/${id}`), {
    params: Promise.resolve({ id }),
  });
}

function driverLean(result: unknown) {
  return {
    select: vi.fn(() => ({
      lean: vi.fn().mockResolvedValue(result),
    })),
  };
}

function sarahBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "SC-SARAH",
    userId: sarahId,
    status: "READY",
    paymentStatus: "UNPAID",
    assignedDriverId: "driver_mark",
    collectionDate: "2026-10-26",
    customer: {
      id: "sarah",
      name: "Sarah",
      phone: "0820000000",
      email: "sarah@example.com",
    },
    rug: { type: "Persian", areaSqM: 6, tagCode: "SC-RUG-1" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.connectDB.mockResolvedValue(undefined);
  mocks.punchOnce.mockResolvedValue(true);
  mocks.creditReferrerOnce.mockResolvedValue(true);
  mocks.listDayVehiclesForDriver.mockResolvedValue([]);
  mocks.vehiclesByDriverId.mockResolvedValue(new Map());
  mocks.driverFindOne.mockImplementation(() =>
    driverLean({ name: "Mark", phone: "0821111111" })
  );
  mocks.deliveryClientId.mockImplementation(
    async (booking: { userId?: unknown }) => booking.userId ?? null
  );
  mocks.bookingUpdateOne.mockResolvedValue({ modifiedCount: 1 });
  mocks.getSession.mockResolvedValue({
    id: "admin-1",
    email: "ops@example.com",
    role: "admin",
    adminTier: "full",
  });
  mocks.bookingFindOne.mockImplementation(() => lean(sarahBooking()));
  mocks.bookingFindOneAndUpdate.mockImplementation((_filter, update) => {
    const set = (update as { $set?: Record<string, unknown> }).$set ?? {};
    return lean(sarahBooking(set));
  });
});

describe("PATCH /api/bookings/[id] loyalty punch", () => {
  it("punches once when Sarah's booking is marked DELIVERED", async () => {
    const res = await patch({ status: "DELIVERED" });

    expect(res.status).toBe(200);
    expect(mocks.punchOnce).toHaveBeenCalledTimes(1);
    expect(mocks.punchOnce).toHaveBeenCalledWith({
      id: "SC-SARAH",
      userId: sarahId,
    });
    expect(mocks.creditReferrerOnce).toHaveBeenCalledTimes(1);
    expect(mocks.creditReferrerOnce).toHaveBeenCalledWith({
      id: "SC-SARAH",
      userId: sarahId,
    });
    expect(mocks.punchOnce.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.creditReferrerOnce.mock.invocationCallOrder[0]
    );
  });

  it("punches the client the booking was relinked to", async () => {
    const nomsaId = "507f1f77bcf86cd799439099";
    mocks.deliveryClientId.mockResolvedValue(nomsaId);

    const res = await patch({ status: "DELIVERED" });

    expect(res.status).toBe(200);
    expect(mocks.punchOnce).toHaveBeenCalledWith({
      id: "SC-SARAH",
      userId: nomsaId,
    });
    expect(mocks.creditReferrerOnce).toHaveBeenCalledWith({
      id: "SC-SARAH",
      userId: nomsaId,
    });
  });

  it("calls the same punch when a technician marks the job delivered", async () => {
    mocks.getSession.mockResolvedValue({
      id: "tech-1",
      email: "mark@example.com",
      role: "technician",
      driverProfileId: "driver_mark",
    });

    const res = await patch({ status: "DELIVERED" });

    expect(res.status).toBe(200);
    expect(mocks.punchOnce).toHaveBeenCalledTimes(1);
    expect(mocks.punchOnce).toHaveBeenCalledWith({
      id: "SC-SARAH",
      userId: sarahId,
    });
  });

  it("does not punch when status becomes COLLECTED", async () => {
    mocks.bookingFindOne.mockImplementation(() =>
      lean(sarahBooking({ status: "SCHEDULED" }))
    );

    const res = await patch({ status: "COLLECTED" });

    expect(res.status).toBe(200);
    expect(mocks.punchOnce).not.toHaveBeenCalled();
    expect(mocks.creditReferrerOnce).not.toHaveBeenCalled();
  });

  it("lets a full admin mark a job collected without a rug tag", async () => {
    mocks.bookingFindOne.mockImplementation(() =>
      lean(
        sarahBooking({
          status: "SCHEDULED",
          rug: { type: "Persian", areaSqM: 6 },
        })
      )
    );

    const res = await patch({ status: "COLLECTED" });

    expect(res.status).toBe(200);
    expect(mocks.bookingFindOneAndUpdate).toHaveBeenCalled();
  });

  it("refuses a technician who marks a job collected without a rug tag", async () => {
    mocks.getSession.mockResolvedValue({
      id: "tech-1",
      email: "mark@example.com",
      role: "technician",
      driverProfileId: "driver_mark",
    });
    mocks.bookingFindOne.mockImplementation(() =>
      lean(
        sarahBooking({
          status: "SCHEDULED",
          rug: { type: "Persian", areaSqM: 6 },
        })
      )
    );

    const res = await patch({ status: "COLLECTED" });
    const payload = await res.json();

    expect(res.status).toBe(409);
    expect(payload.error).toBe(
      "Attach a rug tag before marking this job collected."
    );
    expect(mocks.bookingFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("restores the previous status when the punch cannot be saved", async () => {
    mocks.punchOnce.mockRejectedValue(new Error("Could not award the loyalty punch."));

    const res = await patch({ status: "DELIVERED" });
    const payload = await res.json();

    expect(res.status).toBe(500);
    expect(payload.error).toBe("Could not award the loyalty punch.");
    expect(mocks.creditReferrerOnce).not.toHaveBeenCalled();
    expect(mocks.bookingUpdateOne).toHaveBeenCalledWith(
      { id: "SC-SARAH", status: "DELIVERED" },
      { $set: { status: "READY" } }
    );
  });

  it("keeps DELIVERED when the referrer credit cannot be saved", async () => {
    mocks.creditReferrerOnce.mockRejectedValue(
      new Error("Could not credit the referrer.")
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await patch({ status: "DELIVERED" });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.status).toBe("DELIVERED");
    expect(mocks.punchOnce).toHaveBeenCalledTimes(1);
    expect(mocks.creditReferrerOnce).toHaveBeenCalledTimes(1);
    expect(mocks.bookingUpdateOne).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("does not punch when only paymentStatus becomes PAID", async () => {
    const res = await patch({ paymentStatus: "PAID" });

    expect(res.status).toBe(200);
    expect(mocks.punchOnce).not.toHaveBeenCalled();
    expect(mocks.creditReferrerOnce).not.toHaveBeenCalled();
  });
});

describe("GET /api/bookings/[id] job vehicles", () => {
  const quantum = { label: "Toyota Quantum", plate: "CA 555-001" };
  const np200 = { label: "Nissan NP200", plate: "CA 123-456" };

  beforeEach(() => {
    mocks.listDayVehiclesForDriver.mockResolvedValue([quantum]);
    mocks.vehiclesByDriverId.mockResolvedValue(
      new Map([["driver_mark", np200]])
    );
  });

  it("attaches day-log and standing vehicles for a full admin", async () => {
    const res = await get();
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.dayVehicles).toEqual([quantum]);
    expect(payload.standingVehicle).toEqual(np200);
    expect(mocks.listDayVehiclesForDriver).toHaveBeenCalledWith(
      "driver_mark",
      "2026-10-26"
    );
  });

  it("attaches day-log and standing vehicles for the assigned technician", async () => {
    mocks.getSession.mockResolvedValue({
      id: "tech-1",
      email: "mark@example.com",
      role: "technician",
      driverProfileId: "driver_mark",
    });

    const res = await get();
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.dayVehicles).toEqual([quantum]);
    expect(payload.standingVehicle).toEqual(np200);
  });

  it("omits job vehicles on a public tracking GET", async () => {
    mocks.getSession.mockResolvedValue(null);

    const res = await get();
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload).not.toHaveProperty("dayVehicles");
    expect(payload).not.toHaveProperty("standingVehicle");
    expect(mocks.listDayVehiclesForDriver).not.toHaveBeenCalled();
  });

  it("omits job vehicles for the owning client", async () => {
    mocks.getSession.mockResolvedValue({
      id: sarahId,
      email: "sarah@example.com",
      role: "client",
    });

    const res = await get();
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload).not.toHaveProperty("dayVehicles");
    expect(payload).not.toHaveProperty("standingVehicle");
    expect(mocks.listDayVehiclesForDriver).not.toHaveBeenCalled();
  });

  it("still returns the booking when day-log lookup fails", async () => {
    mocks.listDayVehiclesForDriver.mockRejectedValue(
      new Error("vehicleDayUses unavailable")
    );
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const res = await get();
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.id).toBe("SC-SARAH");
    expect(payload.dayVehicles).toEqual([]);
    expect(payload.standingVehicle).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
