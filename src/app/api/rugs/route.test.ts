import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTechnicianSession: vi.fn(),
  connectDB: vi.fn(),
  bookingFindOne: vi.fn(),
  bookingFindOneAndUpdate: vi.fn(),
  rugAssetFindOne: vi.fn(),
  rugAssetFindOneAndUpdate: vi.fn(),
  rugAssetCreate: vi.fn(),
  rugAssetDeleteOne: vi.fn(),
  rugAssetUpdateOne: vi.fn(),
}));

vi.mock("@/lib/fieldMessageAuth", () => ({
  requireTechnicianSession: mocks.requireTechnicianSession,
}));
vi.mock("@/lib/mongodb", () => ({ connectDB: mocks.connectDB }));
vi.mock("@/models/Booking", () => ({
  Booking: {
    findOne: mocks.bookingFindOne,
    findOneAndUpdate: mocks.bookingFindOneAndUpdate,
  },
}));
vi.mock("@/models/RugAsset", () => ({
  RugAsset: {
    findOne: mocks.rugAssetFindOne,
    findOneAndUpdate: mocks.rugAssetFindOneAndUpdate,
    create: mocks.rugAssetCreate,
    deleteOne: mocks.rugAssetDeleteOne,
    updateOne: mocks.rugAssetUpdateOne,
  },
}));

import { POST } from "./route";

const bookingFixture = {
  id: "SC-DEMO-1",
  assignedDriverId: "driver_thabo",
  status: "SCHEDULED",
  customer: { email: "client@example.com" },
  rug: { type: "Wool", photos: [], tagCode: undefined, assetId: undefined },
};

function post(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/rugs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireTechnicianSession.mockResolvedValue({
    role: "technician",
    driverProfileId: "driver_thabo",
  });
  mocks.connectDB.mockResolvedValue(undefined);
  mocks.bookingFindOne.mockReturnValue({
    lean: () => Promise.resolve({ ...bookingFixture, rug: { ...bookingFixture.rug } }),
  });
  mocks.rugAssetFindOne.mockResolvedValue(null);
  mocks.rugAssetCreate.mockResolvedValue({ _id: "asset-1" });
  mocks.bookingFindOneAndUpdate.mockImplementation((_filter, update) => ({
    lean: () =>
      Promise.resolve({
        ...bookingFixture,
        rug: {
          ...bookingFixture.rug,
          tagCode: update.$set["rug.tagCode"],
          assetId: update.$set["rug.assetId"],
        },
      }),
  }));
});

describe("POST /api/rugs", () => {
  it("creates a generated tag asset and links it to the assigned booking", async () => {
    const response = await post({ bookingId: "SC-DEMO-1" });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.rug.tagCode).toMatch(/^SC-RUG-[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(result.rug.assetId).toBe("asset-1");
    expect(mocks.rugAssetCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        tagCode: result.rug.tagCode,
        currentBookingId: "SC-DEMO-1",
        ownerEmail: "client@example.com",
        type: "Wool",
      })
    );
    expect(mocks.bookingFindOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "SC-DEMO-1",
        assignedDriverId: "driver_thabo",
        status: { $in: ["BOOKED", "SCHEDULED"] },
      }),
      {
        $set: {
          "rug.tagCode": result.rug.tagCode,
          "rug.assetId": "asset-1",
        },
      },
      { new: true, runValidators: true }
    );
  });

  it("claims a pre-printed code asset and links it to the booking", async () => {
    mocks.rugAssetFindOne.mockResolvedValue({
      _id: "asset-roll-1",
      currentBookingId: null,
      status: "RETURNED",
    });
    mocks.rugAssetFindOneAndUpdate.mockResolvedValue({ _id: "asset-roll-1" });

    const response = await post({
      bookingId: "SC-DEMO-1",
      tagCode: "roll-001234",
    });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.rug.tagCode).toBe("ROLL-001234");
    expect(result.rug.assetId).toBe("asset-roll-1");
    expect(mocks.rugAssetFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: "asset-roll-1", currentBookingId: null },
      { $set: { currentBookingId: "SC-DEMO-1", status: "IN_CARE" } },
      { new: true }
    );
    expect(mocks.rugAssetCreate).not.toHaveBeenCalled();
  });

  it("returns 403 when a different technician tries to tag the booking", async () => {
    mocks.requireTechnicianSession.mockResolvedValue({
      role: "technician",
      driverProfileId: "driver_sipho",
    });

    const response = await post({ bookingId: "SC-DEMO-1" });

    expect(response.status).toBe(403);
    expect(mocks.rugAssetFindOne).not.toHaveBeenCalled();
    expect(mocks.rugAssetCreate).not.toHaveBeenCalled();
    expect(mocks.bookingFindOneAndUpdate).not.toHaveBeenCalled();
  });
});
