import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const bookingUpdateOne = vi.fn();
const userUpdateOne = vi.fn();
const userFindOne = vi.fn();

vi.mock("@/models/Booking", () => ({
  Booking: {
    updateOne: (...args: unknown[]) => bookingUpdateOne(...args),
  },
}));

vi.mock("@/models/User", () => ({
  User: {
    updateOne: (...args: unknown[]) => userUpdateOne(...args),
    findOne: (...args: unknown[]) => userFindOne(...args),
  },
}));

import { deliveryClientId, punchOnce } from "@/lib/promotion/loyalty";

const sarahId = "507f1f77bcf86cd799439011";

describe("punchOnce", () => {
  beforeEach(() => {
    bookingUpdateOne.mockReset();
    userUpdateOne.mockReset();
    userFindOne.mockReset();
    userUpdateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
  });

  it("adds one punch the first time a user's booking is claimed", async () => {
    bookingUpdateOne.mockResolvedValue({ modifiedCount: 1 });

    await expect(
      punchOnce({ id: "SC-SARAH", userId: sarahId })
    ).resolves.toBe(true);

    expect(bookingUpdateOne).toHaveBeenCalledWith(
      {
        id: "SC-SARAH",
        userId: sarahId,
        $or: [
          { "promotion.loyaltyPunchedAt": { $exists: false } },
          { "promotion.loyaltyPunchedAt": null },
        ],
      },
      {
        $set: {
          "promotion.loyaltyPunchedAt": expect.any(Date),
        },
      }
    );
    expect(userUpdateOne).toHaveBeenCalledTimes(1);
    expect(userUpdateOne).toHaveBeenCalledWith(
      { _id: sarahId },
      { $inc: { "loyalty.punches": 1 } }
    );
  });

  it("does not add a second punch when the booking was already punched", async () => {
    bookingUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });
    bookingUpdateOne.mockResolvedValueOnce({ modifiedCount: 0 });

    await punchOnce({ id: "SC-SARAH", userId: sarahId });
    await expect(
      punchOnce({ id: "SC-SARAH", userId: sarahId })
    ).resolves.toBe(false);

    expect(userUpdateOne).toHaveBeenCalledTimes(1);
  });

  it("accepts the ObjectId userId stored on a booking", async () => {
    bookingUpdateOne.mockResolvedValue({ modifiedCount: 1 });

    await expect(
      punchOnce({ id: "SC-SARAH", userId: new Types.ObjectId(sarahId) })
    ).resolves.toBe(true);

    expect(userUpdateOne).toHaveBeenCalledWith(
      { _id: sarahId },
      { $inc: { "loyalty.punches": 1 } }
    );
  });

  it("releases the punch when the customer record is missing", async () => {
    bookingUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    userUpdateOne.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });

    await expect(punchOnce({ id: "SC-SARAH", userId: sarahId })).rejects.toThrow(
      "Could not award the loyalty punch."
    );

    expect(bookingUpdateOne).toHaveBeenLastCalledWith(
      { id: "SC-SARAH", userId: sarahId },
      { $unset: { "promotion.loyaltyPunchedAt": "" } }
    );
  });

  it("clears the punch flag if the user increment fails", async () => {
    bookingUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    userUpdateOne.mockRejectedValue(new Error("user write failed"));

    await expect(punchOnce({ id: "SC-SARAH", userId: sarahId })).rejects.toThrow(
      "user write failed"
    );

    expect(bookingUpdateOne).toHaveBeenLastCalledWith(
      { id: "SC-SARAH", userId: sarahId },
      { $unset: { "promotion.loyaltyPunchedAt": "" } }
    );
  });

  it("does not punch a guest booking", async () => {
    await expect(punchOnce({ id: "SC-GUEST" })).resolves.toBe(false);
    await expect(
      punchOnce({ id: "SC-GUEST", userId: null })
    ).resolves.toBe(false);

    expect(bookingUpdateOne).not.toHaveBeenCalled();
    expect(userUpdateOne).not.toHaveBeenCalled();
  });
});

function found(value: unknown) {
  return {
    select: () => ({
      lean: async () => value,
    }),
  };
}

describe("deliveryClientId", () => {
  const nomsaId = "507f1f77bcf86cd799439099";

  beforeEach(() => {
    bookingUpdateOne.mockReset();
    userFindOne.mockReset();
    bookingUpdateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  it("keeps the client already linked to the booking", async () => {
    userFindOne.mockReturnValue(found({ _id: sarahId }));

    await expect(
      deliveryClientId({
        id: "SC-NOMSA",
        userId: sarahId,
        email: "nomsa@gmail.com",
      })
    ).resolves.toBe(sarahId);

    expect(bookingUpdateOne).not.toHaveBeenCalled();
  });

  it("relinks a booking whose user was deleted to the client with that email", async () => {
    userFindOne
      .mockReturnValueOnce(found(null))
      .mockReturnValueOnce(found({ _id: nomsaId }));

    await expect(
      deliveryClientId({
        id: "SC-NOMSA",
        userId: "507f1f77bcf86cd799439012",
        email: "Nomsa@gmail.com",
      })
    ).resolves.toBe(nomsaId);

    expect(userFindOne).toHaveBeenLastCalledWith({
      email: "nomsa@gmail.com",
      role: "client",
    });
    expect(bookingUpdateOne).toHaveBeenCalledWith(
      { id: "SC-NOMSA" },
      { $set: { userId: nomsaId, "customer.id": nomsaId } }
    );
  });
});
