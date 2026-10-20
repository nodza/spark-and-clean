import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  connectDB: vi.fn(),
  bookingFindOne: vi.fn(),
  bookingFindOneAndUpdate: vi.fn(),
  bookingUpdateOne: vi.fn(),
  punchOnce: vi.fn(),
  sendBookingStatus: vi.fn(),
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
vi.mock("@/lib/promotion/loyalty", () => ({
  punchOnce: mocks.punchOnce,
}));
vi.mock("@/lib/whatsapp/sendBookingStatus", () => ({
  NOTIFIABLE_BOOKING_STATUSES: ["SCHEDULED", "COLLECTED", "READY", "DELIVERED"],
  sendBookingStatus: mocks.sendBookingStatus,
}));

import { PATCH } from "./route";

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

function sarahBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "SC-SARAH",
    userId: sarahId,
    status: "READY",
    paymentStatus: "UNPAID",
    assignedDriverId: "driver_mark",
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
  mocks.sendBookingStatus.mockResolvedValue({ result: "sent" });
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
    expect(mocks.sendBookingStatus).toHaveBeenCalledWith(
      {
        id: "SC-SARAH",
        customer: { phone: "0820000000" },
      },
      "DELIVERED"
    );
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
    expect(mocks.sendBookingStatus).toHaveBeenCalledWith(
      {
        id: "SC-SARAH",
        customer: { phone: "0820000000" },
      },
      "DELIVERED"
    );
  });

  it("does not punch when status becomes COLLECTED", async () => {
    mocks.bookingFindOne.mockImplementation(() =>
      lean(sarahBooking({ status: "SCHEDULED" }))
    );

    const res = await patch({ status: "COLLECTED" });

    expect(res.status).toBe(200);
    expect(mocks.punchOnce).not.toHaveBeenCalled();
    expect(mocks.sendBookingStatus).toHaveBeenCalledWith(
      {
        id: "SC-SARAH",
        customer: { phone: "0820000000" },
      },
      "COLLECTED"
    );
  });

  it("restores the previous status when the punch cannot be saved", async () => {
    mocks.punchOnce.mockRejectedValue(new Error("Could not award the loyalty punch."));

    const res = await patch({ status: "DELIVERED" });
    const payload = await res.json();

    expect(res.status).toBe(500);
    expect(payload.error).toBe("Could not award the loyalty punch.");
    expect(mocks.bookingUpdateOne).toHaveBeenCalledWith(
      { id: "SC-SARAH", status: "DELIVERED" },
      { $set: { status: "READY" } }
    );
    expect(mocks.sendBookingStatus).not.toHaveBeenCalled();
  });

  it("does not punch when only paymentStatus becomes PAID", async () => {
    const res = await patch({ paymentStatus: "PAID" });

    expect(res.status).toBe(200);
    expect(mocks.punchOnce).not.toHaveBeenCalled();
    expect(mocks.sendBookingStatus).not.toHaveBeenCalled();
  });

  it("sends the SCHEDULED status after an admin marks a booking scheduled", async () => {
    mocks.bookingFindOne.mockImplementation(() =>
      lean(sarahBooking({ status: "BOOKED" }))
    );

    const res = await patch({ status: "SCHEDULED" });

    expect(res.status).toBe(200);
    expect(mocks.sendBookingStatus).toHaveBeenCalledWith(
      {
        id: "SC-SARAH",
        customer: { phone: "0820000000" },
      },
      "SCHEDULED"
    );
  });

  it("keeps READY after the WhatsApp sender throws", async () => {
    mocks.bookingFindOne.mockImplementation(() =>
      lean(sarahBooking({ status: "BOOKED" }))
    );
    mocks.sendBookingStatus.mockRejectedValue(new Error("WhatsApp is down"));

    const res = await patch({ status: "READY" });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.status).toBe("READY");
    expect(mocks.sendBookingStatus).toHaveBeenCalledWith(
      { id: "SC-SARAH", customer: { phone: "0820000000" } },
      "READY"
    );
  });

  it("does not send again when SCHEDULED is saved a second time", async () => {
    let storedBooking = sarahBooking({ status: "BOOKED" });
    mocks.bookingFindOne.mockImplementation(() => lean(storedBooking));
    mocks.bookingFindOneAndUpdate.mockImplementation((_filter, update) => {
      const set = (update as { $set?: Record<string, unknown> }).$set ?? {};
      storedBooking = { ...storedBooking, ...set };
      return lean(storedBooking);
    });

    const first = await patch({ status: "SCHEDULED" });
    const second = await patch({ status: "SCHEDULED" });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mocks.sendBookingStatus).toHaveBeenCalledTimes(1);
    expect(mocks.sendBookingStatus).toHaveBeenCalledWith(
      { id: "SC-SARAH", customer: { phone: "0820000000" } },
      "SCHEDULED"
    );
  });

  it("does not send a WhatsApp notification for DRYING", async () => {
    const res = await patch({ status: "DRYING" });

    expect(res.status).toBe(200);
    expect(mocks.sendBookingStatus).not.toHaveBeenCalled();
  });

  it("does not fail the status update when WhatsApp notification persistence fails", async () => {
    mocks.sendBookingStatus.mockRejectedValue(new Error("attempt storage down"));

    const res = await patch({ status: "DELIVERED" });

    expect(res.status).toBe(200);
    expect(mocks.sendBookingStatus).toHaveBeenCalledTimes(1);
  });
});
