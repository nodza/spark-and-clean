import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireFullAdmin: vi.fn(),
  connectDB: vi.fn(),
  bookingFindOne: vi.fn(),
  bookingFindOneAndUpdate: vi.fn(),
}));

vi.mock("@/lib/adminAuth", () => ({
  requireFullAdmin: mocks.requireFullAdmin,
  isHttpError: (err: unknown) =>
    err instanceof Error && "status" in err,
}));
vi.mock("@/lib/mongodb", () => ({ connectDB: mocks.connectDB }));
vi.mock("@/models/Booking", () => ({
  Booking: {
    findOne: mocks.bookingFindOne,
    findOneAndUpdate: mocks.bookingFindOneAndUpdate,
  },
}));
vi.mock("@/lib/serialize", () => ({
  toClientBooking: (doc: Record<string, unknown>) => doc,
}));

import { DELETE } from "./route";

const bookingId = "SC-CPT-2026-1008-5661";

function remove(id = bookingId) {
  return DELETE(new Request(`http://localhost/api/admin/bookings/${id}`), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireFullAdmin.mockResolvedValue(undefined);
  mocks.connectDB.mockResolvedValue(undefined);
  mocks.bookingFindOne.mockReturnValue({
    select: () => ({
      lean: async () => ({
        id: bookingId,
        status: "SCHEDULED",
        paymentStatus: "UNPAID",
        rug: { type: "Wool", areaSqM: 4 },
        deactivatedAt: null,
      }),
    }),
  });
  mocks.bookingFindOneAndUpdate.mockReturnValue({
    lean: async () => ({
      id: bookingId,
      status: "SCHEDULED",
      paymentStatus: "UNPAID",
      deactivatedAt: new Date("2026-10-14T08:00:00.000Z"),
    }),
  });
});

describe("DELETE /api/admin/bookings/[id]", () => {
  it("deactivates a SCHEDULED unpaid booking without changing status", async () => {
    const res = await remove();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.booking.status).toBe("SCHEDULED");
    expect(body.booking.deactivatedAt).toBe("2026-10-14T08:00:00.000Z");
    expect(mocks.bookingFindOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: bookingId,
        status: { $in: ["BOOKED", "SCHEDULED"] },
        paymentStatus: "UNPAID",
      }),
      {
        $set: { deactivatedAt: expect.any(Date) },
        $unset: { assignedDriverId: "" },
      },
      { new: true, runValidators: true }
    );
  });

  it("rejects deactivate when a deposit was recorded", async () => {
    mocks.bookingFindOne.mockReturnValue({
      select: () => ({
        lean: async () => ({
          id: bookingId,
          status: "BOOKED",
          paymentStatus: "DEPOSIT",
          rug: {},
          deactivatedAt: null,
        }),
      }),
    });

    const res = await remove();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "A payment has been recorded",
    });
    expect(mocks.bookingFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("rejects deactivate when a rug tag is attached", async () => {
    mocks.bookingFindOne.mockReturnValue({
      select: () => ({
        lean: async () => ({
          id: bookingId,
          status: "BOOKED",
          paymentStatus: "UNPAID",
          rug: { tagCode: "SC-RUG-1" },
          deactivatedAt: null,
        }),
      }),
    });

    const res = await remove();
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/tag/i);
    expect(mocks.bookingFindOneAndUpdate).not.toHaveBeenCalled();
  });
});
