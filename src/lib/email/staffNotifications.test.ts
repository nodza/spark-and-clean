import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Booking } from "@/types/booking";

type SentMail = {
  kind: string;
  to: string;
  bookingId?: string;
  dedupeKey?: string;
};

const mocks = vi.hoisted(() => ({
  send: vi.fn(async (_input: SentMail): Promise<string> => "logged"),
  userFind: vi.fn(),
  userFindOne: vi.fn(),
  driverFindOne: vi.fn(),
}));

vi.mock("@/lib/email/sendTransactionalEmail", () => ({
  sendTransactionalEmail: (input: SentMail) => mocks.send(input),
}));
vi.mock("@/models/User", () => ({
  User: {
    find: (...args: unknown[]) => mocks.userFind(...args),
    findOne: (...args: unknown[]) => mocks.userFindOne(...args),
  },
}));
vi.mock("@/models/Driver", () => ({
  Driver: { findOne: (...args: unknown[]) => mocks.driverFindOne(...args) },
}));

import {
  notifyAdminTeamNewBooking,
  notifyDriverAssigned,
} from "@/lib/email/staffNotifications";

function query(result: unknown) {
  return { select: () => ({ lean: async () => result }) };
}

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "SC-2418",
    customer: {
      id: "c1",
      name: "Nomsa Dlamini",
      phone: "0820000000",
      email: "nomsa@example.com",
    },
    suburb: "Sandton",
    addressLine1: "18 Fredman Drive",
    city: "Johannesburg",
    collectionDate: "2026-09-02",
    collectionSlot: "MORNING",
    rug: { type: "Persian", widthM: 2, lengthM: 3, areaSqM: 6 },
    addOns: { odourRemoval: false, stainProtection: false },
    estimatedPriceMin: 1000,
    estimatedPriceMax: 1000,
    status: "BOOKED",
    paymentStatus: "UNPAID",
    createdAt: "2026-08-26T08:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  mocks.send.mockClear();
  mocks.userFind.mockReset();
  mocks.userFindOne.mockReset();
  mocks.driverFindOne.mockReset();
  mocks.userFind.mockReturnValue(
    query([
      { email: "Ops@Example.com" },
      { email: "tapiwa@example.com" },
      { email: "" },
    ])
  );
  mocks.userFindOne.mockReturnValue(
    query({ email: "Thabo@Example.com", disabledAt: null })
  );
  mocks.driverFindOne.mockReturnValue(
    query({ email: "bakkie@example.com", isActive: true })
  );
});

describe("notifyAdminTeamNewBooking", () => {
  it("emails each active full admin once for that booking", async () => {
    await notifyAdminTeamNewBooking(booking());

    expect(mocks.userFind).toHaveBeenCalledWith({
      role: { $in: ["admin", "ADMIN"] },
      adminTier: "full",
      disabledAt: null,
      isActive: { $ne: false },
    });
    expect(mocks.send.mock.calls.map((call) => call[0].to)).toEqual([
      "ops@example.com",
      "tapiwa@example.com",
    ]);
    expect(mocks.send.mock.calls[0][0]).toMatchObject({
      kind: "admin_new_booking",
      bookingId: "SC-2418",
      dedupeKey: "booking:SC-2418:admin_new_booking:ops@example.com",
    });
  });

  it("still emails the other admins when one send fails", async () => {
    mocks.send.mockRejectedValueOnce(new Error("smtp down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(notifyAdminTeamNewBooking(booking())).resolves.toBeUndefined();
    expect(mocks.send.mock.calls.map((call) => call[0].to)).toEqual([
      "ops@example.com",
      "tapiwa@example.com",
    ]);
    errorSpy.mockRestore();
  });
});

describe("notifyDriverAssigned", () => {
  it("emails the technician login when the assigned driver changes", async () => {
    await notifyDriverAssigned({
      booking: booking({ assignedDriverId: "driver_thabo" }),
      previousDriverId: "",
      nextDriverId: "driver_thabo",
      previousUpdatedAt: "2026-09-01T08:00:00.000Z",
    });

    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send.mock.calls[0][0]).toMatchObject({
      kind: "driver_assigned",
      to: "thabo@example.com",
      dedupeKey:
        "booking:SC-2418:driver_assigned:none:driver_thabo:2026-09-01T08:00:00.000Z",
    });
    expect(mocks.driverFindOne).not.toHaveBeenCalled();
  });

  it("uses the driver profile email when the technician has no login address", async () => {
    mocks.userFindOne.mockReturnValue(query(null));
    await notifyDriverAssigned({
      booking: booking(),
      previousDriverId: "driver_mark",
      nextDriverId: "driver_thabo",
    });
    expect(mocks.send.mock.calls[0][0].to).toBe("bakkie@example.com");
  });

  it("does not email when the driver is unchanged, cleared, or has no address", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await notifyDriverAssigned({
      booking: booking(),
      previousDriverId: "driver_thabo",
      nextDriverId: "driver_thabo",
    });
    await notifyDriverAssigned({
      booking: booking(),
      previousDriverId: "driver_thabo",
      nextDriverId: null,
    });
    mocks.userFindOne.mockReturnValue(query({ email: "", disabledAt: null }));
    mocks.driverFindOne.mockReturnValue(query({ email: "", isActive: true }));
    await notifyDriverAssigned({
      booking: booking(),
      previousDriverId: "",
      nextDriverId: "driver_thabo",
    });
    expect(mocks.send).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("does not email a disabled technician login", async () => {
    mocks.userFindOne.mockReturnValue(
      query({ email: "thabo@example.com", disabledAt: new Date() })
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await notifyDriverAssigned({
      booking: booking(),
      nextDriverId: "driver_thabo",
    });
    expect(mocks.send).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("resolves when the send fails", async () => {
    mocks.send.mockRejectedValueOnce(new Error("smtp down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(
      notifyDriverAssigned({
        booking: booking(),
        nextDriverId: "driver_thabo",
      })
    ).resolves.toBeUndefined();
    errorSpy.mockRestore();
  });
});
