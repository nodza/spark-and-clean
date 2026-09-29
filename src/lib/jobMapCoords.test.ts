import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAP_CENTER,
  hasValidCoordinates,
  positionForJob,
  suburbOrCityCentroid,
  todayMapPins,
} from "@/lib/jobMapCoords";
import { technicianTodayStops } from "@/lib/technicianJobs";
import type { Booking } from "@/types/booking";

describe("hasValidCoordinates", () => {
  it("accepts finite lat/lng", () => {
    expect(hasValidCoordinates({ lat: -33.9, lng: 18.4 })).toBe(true);
  });

  it("rejects missing or non-finite values", () => {
    expect(hasValidCoordinates(undefined)).toBe(false);
    expect(hasValidCoordinates(null)).toBe(false);
    expect(hasValidCoordinates({ lat: NaN, lng: 18.4 })).toBe(false);
    expect(hasValidCoordinates({ lat: -33.9, lng: Infinity })).toBe(false);
  });
});

describe("suburbOrCityCentroid", () => {
  it("returns fixed CPT suburb centroids without jitter", () => {
    const a = suburbOrCityCentroid("Sea Point", "Cape Town");
    const b = suburbOrCityCentroid("sea point", "Cape Town");
    expect(a).toEqual([-33.9167, 18.3833]);
    expect(b).toEqual(a);
  });

  it("returns fixed JHB suburb centroids", () => {
    expect(suburbOrCityCentroid("Sandton", "Johannesburg")).toEqual([
      -26.1076, 28.0567,
    ]);
    expect(suburbOrCityCentroid("Rosebank")).toEqual([-26.146, 28.0436]);
  });

  it("falls back to city centroid when suburb is unknown", () => {
    expect(suburbOrCityCentroid("Unknownville", "Johannesburg")).toEqual([
      -26.2041, 28.0473,
    ]);
    expect(suburbOrCityCentroid("Unknownville", "Cape Town")).toEqual(
      DEFAULT_MAP_CENTER
    );
  });

  it("does not send Johannesburg jobs to Cape Town City Bowl", () => {
    const jhb = suburbOrCityCentroid("Mystery Suburb", "Johannesburg");
    expect(jhb[0]).toBeCloseTo(-26.2, 0);
    expect(jhb).not.toEqual(DEFAULT_MAP_CENTER);
  });
});

describe("positionForJob", () => {
  it("uses stored coordinates when present", () => {
    expect(
      positionForJob({
        suburb: "Sandton",
        city: "Johannesburg",
        coordinates: { lat: -26.11, lng: 28.05 },
      })
    ).toEqual([-26.11, 28.05]);
  });

  it("ignores suburb table when coordinates exist", () => {
    const stored = { lat: -33.9, lng: 18.4 };
    expect(
      positionForJob({
        suburb: "Sandton",
        city: "Johannesburg",
        coordinates: stored,
      })
    ).toEqual([stored.lat, stored.lng]);
  });

  it("falls back to suburb centroid when coordinates are missing", () => {
    expect(
      positionForJob({
        suburb: "Claremont",
        city: "Cape Town",
      })
    ).toEqual([-33.98, 18.465]);
  });

  it("is stable across repeated calls (no random noise)", () => {
    const job = { suburb: "Durbanville", city: "Cape Town" as const };
    const first = positionForJob(job);
    const second = positionForJob(job);
    expect(first).toEqual(second);
    expect(first).toEqual([-33.8333, 18.65]);
  });
});

describe("todayMapPins", () => {
  const today = "2026-09-23";
  const todayIso = "2026-09-23T08:00:00.000Z";
  const tomorrowIso = "2026-09-24T08:00:00.000Z";

  function booking(partial: Partial<Booking> & Pick<Booking, "id">): Booking {
    return {
      customer: {
        id: "c1",
        name: "Ada",
        phone: "0820000000",
        email: "ada@example.com",
      },
      suburb: "Sea Point",
      addressLine1: "10 Beach Road",
      city: "Cape Town",
      collectionDate: todayIso,
      collectionSlot: "MORNING",
      rug: { type: "Persian", widthM: 2, lengthM: 3, areaSqM: 6 },
      addOns: { odourRemoval: false, stainProtection: false },
      estimatedPriceMin: 100,
      estimatedPriceMax: 200,
      status: "SCHEDULED",
      paymentStatus: "UNPAID",
      assignedDriverId: "driver_1",
      createdAt: todayIso,
      ...partial,
    };
  }

  it("matches technicianTodayStops set and count (F5.1 Today)", () => {
    const bookings = [
      booking({ id: "today-am" }),
      booking({
        id: "tomorrow",
        collectionDate: tomorrowIso,
        status: "BOOKED",
      }),
      booking({
        id: "ready-return",
        status: "READY",
        collectionDate: tomorrowIso,
        suburb: "Sandton",
        city: "Johannesburg",
        coordinates: { lat: -26.11, lng: 28.05 },
      }),
      booking({ id: "other-driver", assignedDriverId: "driver_2" }),
      booking({ id: "delivered", status: "DELIVERED" }),
      booking({ id: "cleaning", status: "CLEANING" }),
    ];

    const stops = technicianTodayStops(bookings, "driver_1", today);
    const pins = todayMapPins(bookings, "driver_1", today);

    expect(pins).toHaveLength(stops.length);
    expect(pins.map((p) => p.job.id)).toEqual(stops.map((s) => s.id));
    expect(pins.map((p) => p.job.id)).toEqual(["today-am", "ready-return"]);
  });

  it("uses stored coordinates for pins when present", () => {
    const bookings = [
      booking({
        id: "with-coords",
        suburb: "Sandton",
        city: "Johannesburg",
        coordinates: { lat: -26.12345, lng: 28.05432 },
      }),
    ];
    const [pin] = todayMapPins(bookings, "driver_1", today);
    expect(pin.position).toEqual([-26.12345, 28.05432]);
  });

  it("does not move stored-coordinate pins across reloads", () => {
    const bookings = [
      booking({
        id: "stable",
        coordinates: { lat: -33.901, lng: 18.401 },
      }),
    ];
    const first = todayMapPins(bookings, "driver_1", today)[0].position;
    const second = todayMapPins(bookings, "driver_1", today)[0].position;
    expect(first).toEqual(second);
    expect(first).toEqual([-33.901, 18.401]);
  });
});
