import { describe, expect, it } from "vitest";
import { suburbOrCityCentroid, type LatLngTuple } from "@/lib/jobMapCoords";
import {
  distanceKm,
  groupPickupsIntoZones,
  PICKUP_ZONE_RADIUS_KM,
  pickupPosition,
  type PickupZoneBooking,
  type PickupZoneScope,
} from "@/lib/pickupZones";

const scope: PickupZoneScope = {
  collectionDate: "2026-10-14",
  slot: "MORNING",
};

const seaPoint: LatLngTuple = [-33.9167, 18.3833];

function booking(
  partial: Partial<PickupZoneBooking> & Pick<PickupZoneBooking, "id">
): PickupZoneBooking {
  return {
    suburb: "Sea Point",
    city: "Cape Town",
    collectionDate: "2026-10-14",
    collectionSlot: "MORNING",
    status: "SCHEDULED",
    ...partial,
  };
}

describe("groupPickupsIntoZones", () => {
  it("puts Sea Point and a pickup 2 km away in one zone, and Durbanville in another", () => {
    const nearby: LatLngTuple = [seaPoint[0] + 0.018, seaPoint[1]];
    const twentyKmNorth: LatLngTuple = [seaPoint[0] + 0.18, seaPoint[1]];
    expect(distanceKm(seaPoint, nearby)).toBeCloseTo(2, 0);
    expect(distanceKm(seaPoint, nearby)).toBeLessThanOrEqual(
      PICKUP_ZONE_RADIUS_KM
    );
    expect(distanceKm(seaPoint, twentyKmNorth)).toBeCloseTo(20, 0);
    expect(distanceKm(seaPoint, twentyKmNorth)).toBeGreaterThan(
      PICKUP_ZONE_RADIUS_KM
    );

    const zones = groupPickupsIntoZones(
      [
        booking({
          id: "sea",
          coordinates: { lat: seaPoint[0], lng: seaPoint[1] },
        }),
        booking({
          id: "sea-near",
          suburb: "Three Anchor Bay",
          coordinates: { lat: nearby[0], lng: nearby[1] },
        }),
        booking({
          id: "durbanville",
          suburb: "Durbanville",
          city: "Cape Town",
        }),
        booking({
          id: "far",
          suburb: "Sea Point",
          coordinates: { lat: twentyKmNorth[0], lng: twentyKmNorth[1] },
        }),
      ],
      scope
    );

    expect(zones.map((zone) => zone.bookingIds)).toEqual([
      ["durbanville"],
      ["far"],
      ["sea", "sea-near"],
    ]);

    const seaZone = zones.find((zone) => zone.id === "cpt-sea");
    expect(seaZone?.suburbs).toEqual(["Sea Point", "Three Anchor Bay"]);
    expect(seaZone?.centroid).toEqual([
      (nearby[0] + seaPoint[0]) / 2,
      (nearby[1] + seaPoint[1]) / 2,
    ]);

    const durbanville = zones.find((zone) => zone.id === "cpt-durbanville");
    expect(durbanville?.suburbs).toEqual(["Durbanville"]);
    expect(durbanville?.centroid).toEqual(
      suburbOrCityCentroid("Durbanville", "Cape Town")
    );
    expect(
      distanceKm(durbanville!.centroid, seaPoint)
    ).toBeGreaterThan(PICKUP_ZONE_RADIUS_KM);
  });

  it("keeps a Cape Town booking and a Sandton booking in different zones", () => {
    const zones = groupPickupsIntoZones(
      [
        booking({ id: "ct", suburb: "Sea Point", city: "Cape Town" }),
        booking({ id: "jhb", suburb: "Sandton", city: "Johannesburg" }),
        booking({ id: "sandton", suburb: "Sandton", city: "" }),
      ],
      scope
    );

    expect(zones).toHaveLength(2);
    expect(zones.map((zone) => zone.bookingIds)).toEqual([
      ["ct"],
      ["jhb", "sandton"],
    ]);
    expect(zones[0].id.startsWith("cpt-")).toBe(true);
    expect(zones[1].id.startsWith("jhb-")).toBe(true);
    expect(zones[0].centroid).toEqual(
      suburbOrCityCentroid("Sea Point", "Cape Town")
    );
    expect(zones[1].centroid).toEqual(
      suburbOrCityCentroid("Sandton", "Johannesburg")
    );
    expect(zones[0].suburbs).toEqual(["Sea Point"]);
    expect(zones[1].suburbs).toEqual(["Sandton"]);
  });

  it("does not share a zone when a Johannesburg pin sits beside a Cape Town pin", () => {
    const zones = groupPickupsIntoZones(
      [
        booking({
          id: "ct",
          suburb: "Sea Point",
          city: "Cape Town",
          coordinates: { lat: -33.92, lng: 18.41 },
        }),
        booking({
          id: "jhb",
          suburb: "Sandton",
          city: "Johannesburg",
          coordinates: { lat: -33.92, lng: 18.42 },
        }),
      ],
      scope
    );

    expect(distanceKm([-33.92, 18.41], [-33.92, 18.42])).toBeLessThan(
      PICKUP_ZONE_RADIUS_KM
    );
    expect(zones.map((zone) => zone.id)).toEqual(["cpt-ct", "jhb-jhb"]);
    expect(zones.map((zone) => zone.bookingIds)).toEqual([["ct"], ["jhb"]]);
  });

  it("places a Claremont booking with no coordinates on the Claremont centroid", () => {
    const claremont = suburbOrCityCentroid("Claremont", "Cape Town");
    const zones = groupPickupsIntoZones(
      [
        booking({
          id: "claremont",
          suburb: "Claremont",
          city: "Cape Town",
        }),
      ],
      scope
    );

    expect(zones).toEqual([
      {
        id: "cpt-claremont",
        suburbs: ["Claremont"],
        bookingIds: ["claremont"],
        centroid: claremont,
      },
    ]);
    expect(
      pickupPosition(booking({ id: "claremont", suburb: "Claremont" }))
    ).toEqual(claremont);
    expect(zones[0].centroid).toEqual([-33.98, 18.465]);
  });

  it("uses stored coordinates and ignores an invalid pair", () => {
    const stored: LatLngTuple = [-33.99, 18.47];
    const withStored = groupPickupsIntoZones(
      [
        booking({
          id: "stored",
          suburb: "Claremont",
          coordinates: { lat: stored[0], lng: stored[1] },
        }),
      ],
      scope
    );
    expect(withStored[0].centroid).toEqual(stored);
    expect(withStored[0].centroid).not.toEqual(
      suburbOrCityCentroid("Claremont", "Cape Town")
    );

    const invalid = groupPickupsIntoZones(
      [
        booking({
          id: "invalid",
          suburb: "Claremont",
          coordinates: { lat: Number.NaN, lng: 18.4 },
        }),
      ],
      scope
    );
    expect(invalid[0].centroid).toEqual(
      suburbOrCityCentroid("Claremont", "Cape Town")
    );
  });

  it("returns the same zone membership for the same bookings", () => {
    const rows = [
      booking({ id: "b", suburb: "Claremont" }),
      booking({
        id: "a",
        suburb: "Sea Point",
        coordinates: { lat: seaPoint[0], lng: seaPoint[1] },
      }),
      booking({ id: "c", suburb: "Sandton", city: "Johannesburg" }),
    ];

    const first = groupPickupsIntoZones(rows, scope);
    const second = groupPickupsIntoZones(rows, scope);
    const reversed = groupPickupsIntoZones([...rows].reverse(), scope);

    expect(second).toEqual(first);
    expect(reversed).toEqual(first);
    expect(first.map((zone) => zone.bookingIds)).toEqual([
      ["a"],
      ["b"],
      ["c"],
    ]);
  });

  it("joins the earliest first stop within 8 km, not the nearer later seed", () => {
    const anchor: LatLngTuple = [-33.9, 18.4];
    const laterSeed: LatLngTuple = [anchor[0] + 0.108, anchor[1]];
    const between: LatLngTuple = [anchor[0] + 0.063, anchor[1]];

    expect(distanceKm(anchor, laterSeed)).toBeGreaterThan(PICKUP_ZONE_RADIUS_KM);
    expect(distanceKm(anchor, between)).toBeLessThanOrEqual(
      PICKUP_ZONE_RADIUS_KM
    );
    expect(distanceKm(laterSeed, between)).toBeLessThan(
      distanceKm(anchor, between)
    );

    const zones = groupPickupsIntoZones(
      [
        booking({
          id: "c-between",
          coordinates: { lat: between[0], lng: between[1] },
        }),
        booking({
          id: "a-anchor",
          coordinates: { lat: anchor[0], lng: anchor[1] },
        }),
        booking({
          id: "b-later",
          coordinates: { lat: laterSeed[0], lng: laterSeed[1] },
        }),
      ],
      scope
    );

    expect(zones.map((zone) => zone.bookingIds)).toEqual([
      ["a-anchor", "c-between"],
      ["b-later"],
    ]);
  });

  it("keeps only BOOKED and SCHEDULED pickups in that slot and Johannesburg day", () => {
    const pin = { lat: seaPoint[0], lng: seaPoint[1] };
    const zones = groupPickupsIntoZones(
      [
        booking({ id: "booked", status: "BOOKED", coordinates: pin }),
        booking({
          id: "scheduled",
          status: "SCHEDULED",
          suburb: "Green Point",
          coordinates: pin,
        }),
        booking({ id: "collected", status: "COLLECTED", coordinates: pin }),
        booking({ id: "cancelled", status: "CANCELLED", coordinates: pin }),
        booking({
          id: "afternoon",
          collectionSlot: "AFTERNOON",
          coordinates: pin,
        }),
        booking({
          id: "other-day",
          collectionDate: "2026-10-15",
          coordinates: pin,
        }),
        booking({
          id: "late-utc-same-day",
          collectionDate: "2026-10-13T22:30:00.000Z",
          suburb: "Gardens",
          coordinates: pin,
        }),
        booking({
          id: "next-johannesburg-day",
          collectionDate: "2026-10-14T22:30:00.000Z",
          coordinates: pin,
        }),
      ],
      scope
    );

    expect(zones).toHaveLength(1);
    expect(zones[0].bookingIds).toEqual([
      "booked",
      "late-utc-same-day",
      "scheduled",
    ]);
    expect(zones[0].suburbs).toEqual(["Sea Point", "Gardens", "Green Point"]);
  });

  it("returns no zones when the day and slot have no pickups", () => {
    expect(
      groupPickupsIntoZones(
        [booking({ id: "pm", collectionSlot: "AFTERNOON" })],
        scope
      )
    ).toEqual([]);
    expect(groupPickupsIntoZones([], scope)).toEqual([]);
  });
});
