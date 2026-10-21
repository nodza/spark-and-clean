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

import { PATCH } from "./route";

const bookingId = "SC-CPT-2026-1008-5661";

const body = {
  customer: {
    name: "Sarah Jenkins",
    phone: "0821234567",
    email: "sarah.j@example.com",
  },
  addressLine1: "12 Beach Road",
  suburb: "Green Point",
  city: "Cape Town",
  collectionDate: "2026-10-20",
  collectionSlot: "AFTERNOON",
};

function patch(payload: unknown, id = bookingId) {
  return PATCH(
    new Request(`http://localhost/api/admin/bookings/${id}/details`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
    { params: Promise.resolve({ id }) }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireFullAdmin.mockResolvedValue(undefined);
  mocks.connectDB.mockResolvedValue(undefined);
  mocks.bookingFindOne.mockReturnValue({
    select: () => ({
      lean: async () => ({
        id: bookingId,
        customer: { id: "c1", name: "Old", phone: "0820000000", email: "old@x.com" },
      }),
    }),
  });
  mocks.bookingFindOneAndUpdate.mockReturnValue({
    lean: async () => ({
      id: bookingId,
      status: "BOOKED",
      paymentStatus: "UNPAID",
      assignedDriverId: "driver_thabo",
      customer: {
        id: "c1",
        name: body.customer.name,
        phone: body.customer.phone,
        email: body.customer.email,
      },
      addressLine1: body.addressLine1,
      suburb: body.suburb,
      city: body.city,
      collectionDate: body.collectionDate,
      collectionSlot: body.collectionSlot,
      rug: { type: "Persian", areaSqM: 6 },
      addOns: {},
      estimatedPriceMin: 400,
      estimatedPriceMax: 500,
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
    }),
  });
});

describe("PATCH /api/admin/bookings/[id]/details", () => {
  it("updates contact and collection fields only", async () => {
    const res = await patch(body);
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.booking.suburb).toBe("Green Point");
    expect(payload.booking.status).toBe("BOOKED");
    expect(payload.booking.assignedDriverId).toBe("driver_thabo");
    expect(mocks.bookingFindOneAndUpdate).toHaveBeenCalledWith(
      { id: bookingId },
      {
        $set: {
          "customer.name": body.customer.name,
          "customer.phone": body.customer.phone,
          "customer.email": body.customer.email,
          addressLine1: body.addressLine1,
          suburb: body.suburb,
          city: body.city,
          collectionDate: body.collectionDate,
          collectionSlot: body.collectionSlot,
        },
      },
      { new: true, runValidators: true }
    );
    const setKeys = Object.keys(
      mocks.bookingFindOneAndUpdate.mock.calls[0][1].$set
    );
    expect(setKeys).not.toContain("status");
    expect(setKeys).not.toContain("paymentStatus");
    expect(setKeys).not.toContain("assignedDriverId");
  });

  it("denies marketing-only admins before querying", async () => {
    const forbidden = Object.assign(new Error("Forbidden"), { status: 403 });
    mocks.requireFullAdmin.mockRejectedValue(forbidden);
    const res = await patch(body);
    expect(res.status).toBe(403);
    expect(mocks.connectDB).not.toHaveBeenCalled();
  });
});
