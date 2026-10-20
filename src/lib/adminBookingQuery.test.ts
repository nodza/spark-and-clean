import { describe, expect, it } from "vitest";
import type { Booking } from "@/types/booking";
import {
  applyBookingListQuery,
  bookingFiltersToSearchParams,
  bookingListHref,
  countBookingsByStatus,
  EMPTY_BOOKING_FILTERS,
  parseBookingListQuery,
} from "@/lib/adminBookingQuery";

function booking(partial: Partial<Booking> & Pick<Booking, "id">): Booking {
  return {
    customer: {
      id: "c",
      name: "Ada Lovelace",
      phone: "082 555 1234",
      email: "ada@example.com",
    },
    suburb: "Durbanville",
    addressLine1: "1 Main",
    city: "Cape Town",
    collectionDate: "2025-12-05",
    collectionSlot: "MORNING",
    rug: { type: "Persian", widthM: 2, lengthM: 3, areaSqM: 6 },
    addOns: { odourRemoval: false, stainProtection: false },
    estimatedPriceMin: 100,
    estimatedPriceMax: 200,
    status: "BOOKED",
    paymentStatus: "UNPAID",
    createdAt: "2025-12-01T09:00:00Z",
    ...partial,
  };
}

const seed: Booking[] = [
  booking({
    id: "SC-2025-0001",
    suburb: "Durbanville",
    paymentStatus: "UNPAID",
    createdAt: "2025-12-01T09:00:00Z",
    collectionDate: "2025-12-05",
  }),
  booking({
    id: "SC-2025-0002",
    customer: {
      id: "c2",
      name: "Mike Ross",
      phone: "071 222 9876",
      email: "mike.ross@example.com",
    },
    suburb: "Sea Point",
    paymentStatus: "DEPOSIT",
    assignedDriverId: "driver_1",
    createdAt: "2025-12-01T10:30:00Z",
    collectionDate: "2025-12-04",
  }),
  booking({
    id: "SC-2025-0003",
    suburb: "City Bowl",
    paymentStatus: "PAID",
    assignedDriverId: "driver_2",
    createdAt: "2025-12-02T08:00:00Z",
    collectionDate: "2025-12-06T08:00:00.000Z",
  }),
];

describe("admin booking query", () => {
  it("defaults sort to newest createdAt and omits it from the URL", () => {
    const parsed = parseBookingListQuery(new URLSearchParams());
    expect(parsed.sort).toBe("created");
    expect(bookingFiltersToSearchParams(parsed).toString()).toBe("");
  });

  it("round-trips shareable filters including assigned=0 and payment=UNPAID", () => {
    const href = bookingListHref({
      payment: "UNPAID",
      assigned: "0",
      suburb: "Durbanville",
      on: "2025-12-05",
    });
    expect(href).toBe(
      "/admin/bookings?payment=UNPAID&on=2025-12-05&suburb=Durbanville&assigned=0"
    );
    const parsed = parseBookingListQuery(new URLSearchParams(href.split("?")[1]));
    const rows = applyBookingListQuery(seed, parsed);
    expect(rows.map((b) => b.id)).toEqual(["SC-2025-0001"]);
  });

  it("maps date=today onto the on filter", () => {
    const parsed = parseBookingListQuery(
      new URLSearchParams("date=today&assigned=0")
    );
    expect(parsed.assigned).toBe("0");
    expect(parsed.on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("searches id, name, email, and phone digits", () => {
    const byPhone = applyBookingListQuery(seed, {
      ...EMPTY_BOOKING_FILTERS,
      q: "071222",
    });
    expect(byPhone.map((b) => b.id)).toEqual(["SC-2025-0002"]);

    const byId = applyBookingListQuery(seed, {
      ...EMPTY_BOOKING_FILTERS,
      q: "0003",
    });
    expect(byId.map((b) => b.id)).toEqual(["SC-2025-0003"]);
  });

  it("searches street, suburb, and city including partial address", () => {
    const withStreet = [
      ...seed,
      booking({
        id: "SC-2025-0042",
        addressLine1: "42 Protea Way",
        suburb: "Observatory",
        city: "Cape Town",
      }),
    ];

    expect(
      applyBookingListQuery(withStreet, {
        ...EMPTY_BOOKING_FILTERS,
        q: "42 Protea",
      }).map((b) => b.id)
    ).toEqual(["SC-2025-0042"]);

    expect(
      applyBookingListQuery(withStreet, {
        ...EMPTY_BOOKING_FILTERS,
        q: "Prote",
      }).map((b) => b.id)
    ).toEqual(["SC-2025-0042"]);

    expect(
      applyBookingListQuery(withStreet, {
        ...EMPTY_BOOKING_FILTERS,
        q: "Observatory",
      }).map((b) => b.id)
    ).toEqual(["SC-2025-0042"]);
  });

  it("counts bookings per status without applying the status filter", () => {
    const all = countBookingsByStatus(seed, EMPTY_BOOKING_FILTERS);
    expect(all.all).toBe(3);
    expect(all.byStatus.BOOKED).toBe(3);
    expect(all.byStatus.COLLECTED).toBe(0);

    const unpaid = countBookingsByStatus(seed, {
      ...EMPTY_BOOKING_FILTERS,
      payment: "UNPAID",
    });
    expect(unpaid.all).toBe(1);
    expect(unpaid.byStatus.BOOKED).toBe(1);
  });

  it("hides CANCELLED from the active All list but keeps them under the Cancelled filter", () => {
    const withCancelled = [
      ...seed,
      booking({
        id: "SC-2025-0099",
        status: "CANCELLED",
        paymentStatus: "UNPAID",
        createdAt: "2025-12-03T09:00:00Z",
        collectionDate: "2025-12-07",
      }),
    ];

    const active = applyBookingListQuery(withCancelled, EMPTY_BOOKING_FILTERS);
    expect(active.map((b) => b.id)).not.toContain("SC-2025-0099");
    expect(active).toHaveLength(3);

    const cancelled = applyBookingListQuery(withCancelled, {
      ...EMPTY_BOOKING_FILTERS,
      status: "CANCELLED",
    });
    expect(cancelled.map((b) => b.id)).toEqual(["SC-2025-0099"]);

    const counts = countBookingsByStatus(withCancelled, EMPTY_BOOKING_FILTERS);
    expect(counts.all).toBe(3);
    expect(counts.byStatus.CANCELLED).toBe(1);
    expect(counts.deactivated).toBe(0);
  });

  it("hides deactivated bookings from the active list and exposes them via deactivated=1", () => {
    const withDeactivated = [
      ...seed,
      booking({
        id: "SC-2025-0088",
        status: "BOOKED",
        paymentStatus: "UNPAID",
        deactivatedAt: "2025-12-03T12:00:00Z",
        createdAt: "2025-12-03T09:00:00Z",
        collectionDate: "2025-12-07",
      }),
    ];

    const active = applyBookingListQuery(withDeactivated, EMPTY_BOOKING_FILTERS);
    expect(active.map((b) => b.id)).not.toContain("SC-2025-0088");

    const archived = applyBookingListQuery(withDeactivated, {
      ...EMPTY_BOOKING_FILTERS,
      deactivated: "1",
    });
    expect(archived.map((b) => b.id)).toEqual(["SC-2025-0088"]);
    expect(archived[0]?.status).toBe("BOOKED");

    const counts = countBookingsByStatus(withDeactivated, EMPTY_BOOKING_FILTERS);
    expect(counts.all).toBe(3);
    expect(counts.deactivated).toBe(1);
    expect(counts.byStatus.BOOKED).toBe(3);
  });

  it("toggles to soonest collectionDate", () => {
    const rows = applyBookingListQuery(seed, {
      ...EMPTY_BOOKING_FILTERS,
      sort: "collection",
    });
    expect(rows.map((b) => b.id)).toEqual([
      "SC-2025-0002",
      "SC-2025-0001",
      "SC-2025-0003",
    ]);
  });

  it("filters by SA calendar day for evening-UTC ISO collection timestamps", () => {
    // Picking 2 Oct in SA was historically stored as 1 Oct 22:00 UTC.
    const withOffset = [
      ...seed,
      booking({
        id: "SC-2026-1002",
        collectionDate: "2026-10-01T22:00:00.000Z",
        createdAt: "2026-10-01T10:00:00Z",
      }),
    ];

    const rows = applyBookingListQuery(withOffset, {
      ...EMPTY_BOOKING_FILTERS,
      on: "2026-10-02",
    });
    expect(rows.map((b) => b.id)).toEqual(["SC-2026-1002"]);
  });
});
