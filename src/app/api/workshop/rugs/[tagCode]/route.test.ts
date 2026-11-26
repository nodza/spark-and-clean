import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const findBooking = vi.fn();
const findAsset = vi.fn();
const findActivity = vi.fn();
const createActivity = vi.fn();

vi.mock("@/lib/mongodb", () => ({
  connectDB: vi.fn(async () => undefined),
}));
vi.mock("@/lib/session", () => ({
  getSession: () => getSession(),
}));
vi.mock("@/models/Booking", () => ({
  Booking: { findOne: (...args: unknown[]) => findBooking(...args) },
}));
vi.mock("@/models/RugAsset", () => ({
  RugAsset: { findOne: (...args: unknown[]) => findAsset(...args) },
}));
vi.mock("@/models/WorkshopActivity", () => ({
  WorkshopActivity: {
    find: (...args: unknown[]) => findActivity(...args),
    create: (...args: unknown[]) => createActivity(...args),
  },
}));

const tagCode = "SC-RUG-101";
const workshopSession = {
  id: "507f1f77bcf86cd799439011",
  email: "worker@example.com",
  name: "Rug Worker",
  role: "workshop",
  mustChangePassword: false,
};
const booking = {
  id: "SC-2026-0001",
  rug: {
    tagCode,
    type: "Kilim",
    color: "Blue and cream",
    specialNotes: "Loose fringe near one corner.",
    widthM: 2,
    lengthM: 3,
    areaSqM: 6,
  },
  addOns: { odourRemoval: true, stainProtection: false },
  notes: [
    {
      id: "note1",
      body: "Keep away from direct sunlight.",
      author: "Ops",
      createdAt: "2026-11-16T08:00:00.000Z",
    },
    {
      id: "note2",
      body: "Handle fringe carefully.",
      author: "Ops",
      createdAt: "2026-11-17T08:00:00.000Z",
    },
  ],
  deactivatedAt: null,
};

function request(method = "GET", body?: unknown) {
  return new Request(`http://localhost/api/workshop/rugs/${tagCode}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function setBookingQuery(value: unknown) {
  findBooking.mockReturnValue({
    select: () => ({
      sort: () => ({ lean: async () => value }),
      lean: async () => value,
    }),
  });
}

describe("/api/workshop/rugs/[tagCode]", () => {
  beforeEach(() => {
    getSession.mockReset();
    findBooking.mockReset();
    findAsset.mockReset();
    findActivity.mockReset();
    createActivity.mockReset();
    getSession.mockResolvedValue(workshopSession);
    findAsset.mockReturnValue({
      select: () => ({ lean: async () => ({ currentBookingId: booking.id }) }),
    });
    setBookingQuery(booking);
    findActivity.mockReturnValue({
      sort: () => ({
        lean: async () => [
          {
            _id: "activity1",
            bookingId: booking.id,
            tagCode,
            action: "RECEIVED",
            actorUserId: workshopSession.id,
            actorName: workshopSession.name,
            actorEmail: workshopSession.email,
            occurredAt: new Date("2026-11-16T08:30:00.000Z"),
          },
        ],
      }),
    });
    createActivity.mockImplementation(async (doc: Record<string, unknown>) => ({
      toObject: () => ({
        _id: "activity2",
        ...doc,
      }),
    }));
  });

  it("only lets workshop accounts look up the rug", async () => {
    const { GET } = await import("./route");
    getSession.mockResolvedValue(null);
    expect(
      (
        await GET(request(), {
          params: Promise.resolve({ tagCode }),
        })
      ).status
    ).toBe(401);

    getSession.mockResolvedValue({ ...workshopSession, role: "technician" });
    expect(
      (
        await GET(request(), {
          params: Promise.resolve({ tagCode }),
        })
      ).status
    ).toBe(403);

    expect(findBooking).not.toHaveBeenCalled();
  });

  it("returns rug details and internal notes without customer or payment data", async () => {
    const { GET } = await import("./route");
    const response = await GET(request(), {
      params: Promise.resolve({ tagCode: tagCode.toLowerCase() }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.rug).toEqual({
      bookingId: booking.id,
      tagCode,
      type: "Kilim",
      color: "Blue and cream",
      specialNotes: "Loose fringe near one corner.",
      widthM: 2,
      lengthM: 3,
      areaSqM: 6,
      addOns: booking.addOns,
      notes: [booking.notes[1], booking.notes[0]],
    });
    expect(body.activity).toHaveLength(1);
    expect(JSON.stringify(body)).not.toMatch(/customer|paymentStatus|status/);
  });

  it("adds an immutable actor-attributed record without changing the booking", async () => {
    const { POST } = await import("./route");
    const response = await POST(request("POST", { action: "CLEANED" }), {
      params: Promise.resolve({ tagCode }),
    });
    expect(response.status).toBe(201);
    expect(createActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: booking.id,
        tagCode,
        action: "CLEANED",
        actorUserId: workshopSession.id,
        actorName: workshopSession.name,
        actorEmail: workshopSession.email,
        occurredAt: expect.any(Date),
      })
    );
    expect(findBooking).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: expect.anything() })
    );
    expect((await response.json()).activity.action).toBe("CLEANED");
  });

  it("blocks account password setup from workshop activity", async () => {
    const { POST } = await import("./route");
    getSession.mockResolvedValue({
      ...workshopSession,
      mustChangePassword: true,
    });
    const response = await POST(request("POST", { action: "RECEIVED" }), {
      params: Promise.resolve({ tagCode }),
    });
    expect(response.status).toBe(403);
    expect(createActivity).not.toHaveBeenCalled();
  });
});
