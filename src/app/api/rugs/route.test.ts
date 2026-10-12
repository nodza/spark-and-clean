import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  requireTechnicianSession: vi.fn(),
  connectDB: vi.fn(),
  bookingFind: vi.fn(),
  bookingFindOne: vi.fn(),
  bookingFindOneAndUpdate: vi.fn(),
  rugAssetFindOne: vi.fn(),
  rugAssetFindOneAndUpdate: vi.fn(),
  rugAssetCreate: vi.fn(),
  rugAssetDeleteOne: vi.fn(),
  rugAssetUpdateOne: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/fieldMessageAuth", () => ({
  requireTechnicianSession: mocks.requireTechnicianSession,
}));
vi.mock("@/lib/mongodb", () => ({ connectDB: mocks.connectDB }));
vi.mock("@/models/Booking", () => ({
  Booking: {
    find: mocks.bookingFind,
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

import { GET, POST } from "./route";

const tagCode = "SC-RUG-ABC12345";
const bookingFixture = {
  id: "SC-DEMO-1",
  assignedDriverId: "driver_thabo",
  status: "SCHEDULED",
  customer: { name: "Ada Lovelace", email: "client@example.com" },
  rug: { type: "Wool", photos: [], tagCode: undefined, assetId: undefined },
};

function query(result: unknown) {
  const request = {
    select: vi.fn(() => request),
    sort: vi.fn(() => request),
    lean: vi.fn().mockResolvedValue(result),
  };
  return request;
}

function findQuery(results: unknown[]) {
  const request = {
    select: vi.fn(() => request),
    sort: vi.fn(() => request),
    lean: vi.fn().mockResolvedValue(results),
  };
  return request;
}

function post(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/rugs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

function search(value: string, key = "q") {
  return GET(new Request(`http://localhost/api/rugs?${key}=${encodeURIComponent(value)}`));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ role: "admin", adminTier: "full" });
  mocks.requireTechnicianSession.mockResolvedValue({
    role: "technician",
    driverProfileId: "driver_thabo",
  });
  mocks.connectDB.mockResolvedValue(undefined);
  mocks.bookingFind.mockImplementation(() =>
    findQuery([
      {
        id: "SC-2025-0001",
        customer: { name: "Ada Lovelace" },
        rug: { photos: ["/uploads/rug.jpg"], tagCode },
        status: "READY",
      },
    ])
  );
  mocks.bookingFindOne.mockImplementation((filter) => {
    if (filter?.id === "SC-DEMO-1") {
      return {
        lean: () =>
          Promise.resolve({
            ...bookingFixture,
            rug: { ...bookingFixture.rug },
          }),
      };
    }
    if (filter?.id === "SC-2025-0001") {
      return query({
        id: "SC-2025-0001",
        customer: { name: "Ada Lovelace" },
        rug: { photos: ["/uploads/rug.jpg"], tagCode },
        status: "READY",
      });
    }
    return query({
      id: "SC-2025-0001",
      customer: { name: "Ada Lovelace" },
      rug: { photos: ["/uploads/rug.jpg"], tagCode },
      status: "READY",
      paymentStatus: "PAID",
      couponCode: "HIDDEN-CODE",
    });
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

describe("GET /api/rugs", () => {
  it("returns the matching tag and only operational lookup fields", async () => {
    mocks.rugAssetFindOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          currentBookingId: "SC-2025-0001",
          photoUrls: ["/uploads/rug.jpg"],
        }),
    });
    const response = await search(tagCode.toLowerCase());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.results).toEqual([
      {
        tagCode,
        customer: "Ada Lovelace",
        bookingId: "SC-2025-0001",
        status: "READY",
        thumbnails: ["/uploads/rug.jpg"],
        isCurrent: true,
      },
    ]);
    expect(JSON.stringify(payload)).not.toMatch(/payment|coupon/i);
  });

  it("lists every historically tagged booking for one rug asset", async () => {
    mocks.rugAssetFindOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          currentBookingId: "SC-2026-0002",
          photoUrls: ["/uploads/asset.jpg"],
        }),
    });
    mocks.bookingFind.mockImplementation(() =>
      findQuery([
        {
          id: "SC-2026-0002",
          customer: { name: "Ada Lovelace" },
          rug: { photos: ["/uploads/new.jpg"], tagCode },
          status: "BOOKED",
        },
        {
          id: "SC-2025-0001",
          customer: { name: "Ada Lovelace" },
          rug: { photos: ["/uploads/old.jpg"], tagCode },
          status: "DELIVERED",
        },
      ])
    );

    const response = await search(tagCode);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.results).toEqual([
      {
        tagCode,
        customer: "Ada Lovelace",
        bookingId: "SC-2026-0002",
        status: "BOOKED",
        thumbnails: ["/uploads/asset.jpg", "/uploads/new.jpg"],
        isCurrent: true,
      },
      {
        tagCode,
        customer: "Ada Lovelace",
        bookingId: "SC-2025-0001",
        status: "DELIVERED",
        thumbnails: ["/uploads/old.jpg"],
        isCurrent: false,
      },
    ]);
  });

  it("accepts tagCode as an alternative query parameter", async () => {
    mocks.rugAssetFindOne.mockReturnValue({
      lean: () => Promise.resolve({ currentBookingId: "SC-2025-0001" }),
    });
    const response = await search(tagCode, "tagCode");
    expect(response.status).toBe(200);
    expect(mocks.rugAssetFindOne).toHaveBeenCalledWith({ tagCode });
  });

  it("ignores a stale currentBookingId and falls back to tagged bookings", async () => {
    mocks.rugAssetFindOne.mockReturnValue({
      lean: () => Promise.resolve({ currentBookingId: "SC-STALE" }),
    });
    mocks.bookingFind.mockImplementation(() =>
      findQuery([
        {
          id: "SC-2025-0099",
          customer: { name: "Ada Lovelace" },
          rug: { photos: ["/uploads/new.jpg"], tagCode },
          status: "IN_PLANT",
        },
      ])
    );

    const response = await search(tagCode);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.results).toEqual([
      {
        tagCode,
        customer: "Ada Lovelace",
        bookingId: "SC-2025-0099",
        status: "IN_PLANT",
        thumbnails: ["/uploads/new.jpg"],
        isCurrent: false,
      },
    ]);
    expect(mocks.bookingFind).toHaveBeenCalledWith({ "rug.tagCode": tagCode });
  });

  it("returns an empty result for an unknown tag", async () => {
    mocks.rugAssetFindOne.mockImplementation(() => ({
      lean: () => Promise.resolve(null),
    }));
    mocks.bookingFind.mockReturnValue(findQuery([]));

    const response = await search("SC-RUG-UNKNOWN");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ results: [] });
  });

  it("denies marketing-only admins before querying data", async () => {
    mocks.getSession.mockResolvedValue({ role: "admin", adminTier: "marketing-only" });

    const response = await search(tagCode);
    expect(response.status).toBe(403);
    expect(mocks.connectDB).not.toHaveBeenCalled();
  });
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
