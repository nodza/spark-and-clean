import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  reminder: vi.fn(async (_booking: { id: string }) => undefined),
  delivery: vi.fn(async (_booking: { id: string }) => undefined),
}));

vi.mock("@/models/Booking", () => ({
  Booking: { find: (query: { status?: unknown }) => mocks.find(query) },
}));
vi.mock("@/lib/email/bookingNotifications", () => ({
  notifyCollectionReminder: (booking: { id: string }) => mocks.reminder(booking),
  notifyOutForDelivery: (booking: { id: string }) => mocks.delivery(booking),
}));

import {
  isCollectionReminderDue,
  isOutForDeliveryDue,
  runScheduledCustomerEmails,
  shiftCalendarDate,
} from "@/lib/email/scheduledCustomerEmails";
import type { Booking } from "@/types/booking";

const now = new Date("2026-11-17T06:00:00.000Z");
const today = "2026-11-17";
const tomorrow = "2026-11-18";

function booking(overrides: Partial<Booking>): Booking {
  return {
    id: "SC-1",
    customer: {
      id: "c",
      name: "Amina",
      phone: "082",
      email: "amina@example.com",
    },
    suburb: "Sea Point",
    addressLine1: "1 Main",
    city: "Cape Town",
    collectionDate: tomorrow,
    collectionSlot: "MORNING",
    rug: { type: "Wool", widthM: 2, lengthM: 2, areaSqM: 4 },
    addOns: { odourRemoval: false, stainProtection: false },
    estimatedPriceMin: 500,
    estimatedPriceMax: 500,
    status: "SCHEDULED",
    paymentStatus: "UNPAID",
    createdAt: "2026-11-01T08:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  mocks.find.mockReset();
  mocks.reminder.mockClear();
  mocks.delivery.mockClear();
});

describe("scheduled customer emails", () => {
  it("selects tomorrow's open collections and today's ready returns", () => {
    expect(shiftCalendarDate(today, 1)).toBe(tomorrow);
    expect(isCollectionReminderDue(booking({}), tomorrow)).toBe(true);
    expect(
      isCollectionReminderDue(booking({ status: "COLLECTED" }), tomorrow)
    ).toBe(false);
    expect(
      isCollectionReminderDue(
        booking({ deactivatedAt: "2026-11-16T00:00:00.000Z" }),
        tomorrow
      )
    ).toBe(false);
    expect(
      isOutForDeliveryDue(
        booking({
          status: "READY",
          deliveryDate: today,
          deliverySlot: "MORNING",
        }),
        today
      )
    ).toBe(true);
    expect(
      isOutForDeliveryDue(
        booking({ status: "READY", deliveryDate: tomorrow, deliverySlot: "MORNING" }),
        today
      )
    ).toBe(false);
  });

  it("sends one reminder and one out-for-delivery email from the morning job", async () => {
    mocks.find.mockImplementation((query: { status?: unknown }) => {
      const ready = query.status === "READY";
      const docs = ready
        ? [
            booking({
              id: "SC-OUT",
              status: "READY",
              deliveryDate: today,
              deliverySlot: "MORNING",
            }),
            booking({
              id: "SC-LATER",
              status: "READY",
              deliveryDate: tomorrow,
              deliverySlot: "MORNING",
            }),
          ]
        : [
            booking({ id: "SC-GO", collectionDate: tomorrow, status: "BOOKED" }),
            booking({ id: "SC-DONE", collectionDate: tomorrow, status: "COLLECTED" }),
          ];
      return { select: () => ({ lean: async () => docs }) };
    });

    const result = await runScheduledCustomerEmails(now);
    expect(result).toEqual({ reminders: 1, deliveries: 1 });
    expect(mocks.reminder).toHaveBeenCalledTimes(1);
    expect(mocks.delivery).toHaveBeenCalledTimes(1);
    expect(mocks.reminder.mock.calls[0][0]).toMatchObject({ id: "SC-GO" });
    expect(mocks.delivery.mock.calls[0][0]).toMatchObject({ id: "SC-OUT" });
  });
});
