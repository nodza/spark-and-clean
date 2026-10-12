import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireFullAdmin: vi.fn(),
  connectDB: vi.fn(),
  bookingFindOne: vi.fn(),
  bookingDeleteOne: vi.fn(),
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
    deleteOne: mocks.bookingDeleteOne,
  },
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
      }),
    }),
  });
  mocks.bookingDeleteOne.mockResolvedValue({ deletedCount: 1 });
});

describe("DELETE /api/admin/bookings/[id]", () => {
  it("deletes a SCHEDULED unpaid booking with no tag", async () => {
    const res = await remove();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mocks.bookingDeleteOne).toHaveBeenCalledWith(
      expect.objectContaining({
        id: bookingId,
        status: { $in: ["BOOKED", "SCHEDULED"] },
        paymentStatus: "UNPAID",
      })
    );
  });

  it("rejects delete when a deposit was recorded", async () => {
    mocks.bookingFindOne.mockReturnValue({
      select: () => ({
        lean: async () => ({
          id: bookingId,
          status: "BOOKED",
          paymentStatus: "DEPOSIT",
          rug: {},
        }),
      }),
    });

    const res = await remove();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "A payment has been recorded",
    });
    expect(mocks.bookingDeleteOne).not.toHaveBeenCalled();
  });

  it("rejects delete when a rug tag is attached", async () => {
    mocks.bookingFindOne.mockReturnValue({
      select: () => ({
        lean: async () => ({
          id: bookingId,
          status: "BOOKED",
          paymentStatus: "UNPAID",
          rug: { tagCode: "SC-RUG-1" },
        }),
      }),
    });

    const res = await remove();
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/tag/i);
    expect(mocks.bookingDeleteOne).not.toHaveBeenCalled();
  });
});
