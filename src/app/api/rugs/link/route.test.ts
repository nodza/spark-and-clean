import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  connectDB: vi.fn(),
  bookingFindOne: vi.fn(),
  bookingFindOneAndUpdate: vi.fn(),
  rugAssetFindOne: vi.fn(),
  rugAssetFindOneAndUpdate: vi.fn(),
  rugAssetUpdateOne: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSession: mocks.getSession }));
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
    updateOne: mocks.rugAssetUpdateOne,
  },
}));

import { POST } from "./route";

const tagCode = "SC-RUG-ABC12345";
const assetId = "asset-1";

const newBooking = {
  id: "SC-2026-0002",
  status: "BOOKED",
  userId: "user-ada",
  paymentStatus: "UNPAID",
  couponCode: undefined,
  rug: { type: "Wool", photos: [], tagCode: undefined, assetId: undefined },
  customer: { name: "Ada Lovelace", email: "client@example.com" },
};

const oldBooking = {
  id: "SC-2025-0001",
  status: "DELIVERED",
  paymentStatus: "PAID",
  couponCode: "OLDCOUPON",
  rug: { type: "Wool", photos: ["/uploads/old.jpg"], tagCode, assetId },
};

function post(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/rugs/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

function leanSelect(result: unknown) {
  return {
    select: () => ({
      lean: () => Promise.resolve(result),
    }),
    lean: () => Promise.resolve(result),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ role: "admin", adminTier: "full" });
  mocks.connectDB.mockResolvedValue(undefined);
  mocks.rugAssetUpdateOne.mockResolvedValue({ acknowledged: true });
});

describe("POST /api/rugs/link", () => {
  it("links an existing tag onto a new booking without copying payment or coupon", async () => {
    mocks.rugAssetFindOne.mockResolvedValue({
      _id: assetId,
      tagCode,
      status: "IN_CARE",
      currentBookingId: oldBooking.id,
      ownerUserId: "user-ada",
      ownerEmail: "client@example.com",
    });
    mocks.bookingFindOne.mockImplementation((filter: { id?: string }) => {
      if (filter?.id === newBooking.id) {
        return leanSelect({ ...newBooking, rug: { ...newBooking.rug } });
      }
      if (filter?.id === oldBooking.id) {
        return leanSelect({
          id: oldBooking.id,
          status: oldBooking.status,
          userId: "user-ada",
          customer: { email: "client@example.com", name: "Ada Lovelace" },
        });
      }
      return leanSelect(null);
    });
    mocks.rugAssetFindOneAndUpdate.mockResolvedValue({
      _id: assetId,
      tagCode,
      status: "IN_CARE",
      currentBookingId: newBooking.id,
    });
    mocks.bookingFindOneAndUpdate.mockImplementation((_filter, update) => ({
      lean: () =>
        Promise.resolve({
          ...newBooking,
          paymentStatus: "UNPAID",
          couponCode: undefined,
          rug: {
            ...newBooking.rug,
            tagCode: update.$set["rug.tagCode"],
            assetId: update.$set["rug.assetId"],
          },
        }),
    }));

    const response = await post({ bookingId: newBooking.id, tagCode });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.tagCode).toBe(tagCode);
    expect(payload.assetId).toBe(assetId);
    expect(payload.previousBookingId).toBe(oldBooking.id);
    expect(payload.booking.rug.tagCode).toBe(tagCode);
    expect(payload.booking.paymentStatus).toBe("UNPAID");
    expect(payload.booking.couponCode).toBeUndefined();
    expect(payload.customerName).toBe("Ada Lovelace");
    expect(payload.bookingStatus).toBe("BOOKED");

    expect(mocks.rugAssetFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: assetId, currentBookingId: oldBooking.id },
      { $set: { currentBookingId: newBooking.id, status: "IN_CARE" } },
      { new: true }
    );
    expect(mocks.bookingFindOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: newBooking.id }),
      {
        $set: {
          "rug.tagCode": tagCode,
          "rug.assetId": assetId,
        },
      },
      { new: true, runValidators: true }
    );
    const bookingUpdate = mocks.bookingFindOneAndUpdate.mock.calls[0][1];
    expect(JSON.stringify(bookingUpdate)).not.toMatch(/paymentStatus|coupon/i);
  });

  it("rejects linking when the tag is IN_CARE on another active job", async () => {
    mocks.rugAssetFindOne.mockResolvedValue({
      _id: assetId,
      tagCode,
      status: "IN_CARE",
      currentBookingId: "SC-ACTIVE",
    });
    mocks.bookingFindOne.mockImplementation((filter: { id?: string }) => {
      if (filter?.id === newBooking.id) {
        return leanSelect({ ...newBooking });
      }
      if (filter?.id === "SC-ACTIVE") {
        return leanSelect({ id: "SC-ACTIVE", status: "CLEANING" });
      }
      return leanSelect(null);
    });

    const response = await post({ bookingId: newBooking.id, tagCode });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toMatch(/IN_CARE on active booking SC-ACTIVE/);
    expect(mocks.rugAssetFindOneAndUpdate).not.toHaveBeenCalled();
    expect(mocks.bookingFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("leaves a previous booking historically tagged (does not clear old tagCode)", async () => {
    mocks.rugAssetFindOne.mockResolvedValue({
      _id: assetId,
      tagCode,
      status: "RETURNED",
      currentBookingId: oldBooking.id,
      ownerUserId: "user-ada",
      ownerEmail: "client@example.com",
    });
    mocks.bookingFindOne.mockImplementation((filter: { id?: string }) => {
      if (filter?.id === newBooking.id) {
        return leanSelect({ ...newBooking });
      }
      if (filter?.id === oldBooking.id) {
        return leanSelect({
          id: oldBooking.id,
          status: "DELIVERED",
          userId: "user-ada",
          customer: { email: "client@example.com" },
        });
      }
      return leanSelect(null);
    });
    mocks.rugAssetFindOneAndUpdate.mockResolvedValue({
      _id: assetId,
      currentBookingId: newBooking.id,
    });
    mocks.bookingFindOneAndUpdate.mockImplementation((_filter, update) => ({
      lean: () =>
        Promise.resolve({
          ...newBooking,
          rug: {
            ...newBooking.rug,
            tagCode: update.$set["rug.tagCode"],
            assetId: update.$set["rug.assetId"],
          },
        }),
    }));

    const response = await post({ bookingId: newBooking.id, tagCode });
    expect(response.status).toBe(200);
    expect(mocks.bookingFindOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.bookingFindOneAndUpdate.mock.calls[0][0].id).toBe(newBooking.id);
    // No update targeting the previous booking — its rug.tagCode stays.
    expect(
      mocks.bookingFindOneAndUpdate.mock.calls.every(
        ([filter]) => filter.id !== oldBooking.id
      )
    ).toBe(true);
  });

  it("denies marketing-only admins", async () => {
    mocks.getSession.mockResolvedValue({ role: "admin", adminTier: "marketing-only" });

    const response = await post({ bookingId: newBooking.id, tagCode });
    expect(response.status).toBe(403);
    expect(mocks.connectDB).not.toHaveBeenCalled();
  });

  it("rejects a delivered or cancelled target booking", async () => {
    mocks.rugAssetFindOne.mockResolvedValue({
      _id: assetId,
      tagCode,
      status: "IN_CARE",
      currentBookingId: oldBooking.id,
      ownerUserId: "user-ada",
      ownerEmail: "client@example.com",
    });
    mocks.bookingFindOne.mockImplementation((filter: { id?: string }) => {
      if (filter?.id === newBooking.id) {
        return leanSelect({ ...newBooking, status: "DELIVERED" });
      }
      return leanSelect(null);
    });

    const response = await post({ bookingId: newBooking.id, tagCode });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Tags can only be linked to a BOOKED or SCHEDULED booking.",
    });
    expect(mocks.rugAssetFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("rejects linking a tag onto a different customer's booking", async () => {
    mocks.rugAssetFindOne.mockResolvedValue({
      _id: assetId,
      tagCode,
      status: "IN_CARE",
      currentBookingId: oldBooking.id,
      ownerUserId: "user-ada",
      ownerEmail: "client@example.com",
    });
    mocks.bookingFindOne.mockImplementation((filter: { id?: string }) => {
      if (filter?.id === newBooking.id) {
        return leanSelect({
          ...newBooking,
          userId: "user-other",
          customer: { name: "Other Person", email: "other@example.com" },
        });
      }
      if (filter?.id === oldBooking.id) {
        return leanSelect({
          id: oldBooking.id,
          status: "DELIVERED",
          userId: "user-ada",
          customer: { email: "client@example.com" },
        });
      }
      return leanSelect(null);
    });

    const response = await post({ bookingId: newBooking.id, tagCode });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/another customer/);
    expect(mocks.rugAssetFindOneAndUpdate).not.toHaveBeenCalled();
    expect(mocks.bookingFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("previews the target customer without writing", async () => {
    mocks.rugAssetFindOne.mockResolvedValue({
      _id: assetId,
      tagCode,
      status: "IN_CARE",
      currentBookingId: oldBooking.id,
      ownerUserId: "user-ada",
      ownerEmail: "client@example.com",
    });
    mocks.bookingFindOne.mockImplementation((filter: { id?: string }) => {
      if (filter?.id === newBooking.id) {
        return leanSelect({ ...newBooking });
      }
      if (filter?.id === oldBooking.id) {
        return leanSelect({
          id: oldBooking.id,
          status: "DELIVERED",
          userId: "user-ada",
          customer: { email: "client@example.com" },
        });
      }
      return leanSelect(null);
    });

    const response = await post({
      bookingId: newBooking.id,
      tagCode,
      dryRun: true,
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      dryRun: true,
      tagCode,
      bookingId: newBooking.id,
      customerName: "Ada Lovelace",
      bookingStatus: "BOOKED",
      previousBookingId: oldBooking.id,
    });
    expect(mocks.rugAssetFindOneAndUpdate).not.toHaveBeenCalled();
    expect(mocks.bookingFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("returns 404 when the tag does not exist", async () => {
    mocks.rugAssetFindOne.mockResolvedValue(null);
    mocks.bookingFindOne.mockReturnValue(leanSelect(newBooking));

    const response = await post({ bookingId: newBooking.id, tagCode });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "No rug found for that tag" });
  });
});
