import { isBookingOnJohannesburgDay } from "@/lib/johannesburgDate";
import {
  hasValidCoordinates,
  suburbOrCityCentroid,
  type LatLngTuple,
} from "@/lib/jobMapCoords";
import type { Booking, BookingStatus } from "@/types/booking";

/** A pickup joins a zone only when it is this close to that zone's first stop. */
export const PICKUP_ZONE_RADIUS_KM = 8;

const EARTH_RADIUS_KM = 6371;

/**
 * Cape Town sits near -34 and Johannesburg near -26.
 * Used only when the booking itself does not name a city or a known suburb.
 */
const JOHANNESBURG_LATITUDE_SPLIT = -30;

const ZONE_STATUSES: ReadonlySet<BookingStatus> = new Set([
  "BOOKED",
  "SCHEDULED",
]);

export type PickupSlot = "MORNING" | "AFTERNOON";

export type ServiceMetro = "Cape Town" | "Johannesburg";

export type PickupZoneScope = {
  collectionDate: string;
  slot: PickupSlot;
};

export type PickupZoneBooking = Pick<
  Booking,
  | "id"
  | "suburb"
  | "city"
  | "coordinates"
  | "status"
  | "collectionDate"
  | "collectionSlot"
>;

export type PickupZone = {
  id: string;
  suburbs: string[];
  bookingIds: string[];
  centroid: LatLngTuple;
};

type DraftZone = {
  id: string;
  metro: ServiceMetro;
  seed: LatLngTuple;
  suburbs: string[];
  bookingIds: string[];
  positions: LatLngTuple[];
};

function compareIds(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance. Stable for the same pair of points. */
export function distanceKm(origin: LatLngTuple, target: LatLngTuple): number {
  const [lat1, lng1] = origin;
  const [lat2, lng2] = target;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const originLat = toRadians(lat1);
  const targetLat = toRadians(lat2);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(originLat) * Math.cos(targetLat) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Stored coordinates when they are finite. Otherwise the fixed suburb/city
 * centroid — never a random offset.
 */
export function pickupPosition(
  booking: Pick<PickupZoneBooking, "suburb" | "city" | "coordinates">
): LatLngTuple {
  if (hasValidCoordinates(booking.coordinates)) {
    return [booking.coordinates.lat, booking.coordinates.lng];
  }
  const [lat, lng] = suburbOrCityCentroid(booking.suburb, booking.city);
  return [lat, lng];
}

/**
 * A named suburb in the centroid table is one place. City Bowl equals the Cape
 * Town default, so it is recognised by name.
 */
function namedSuburbCentroid(
  booking: Pick<PickupZoneBooking, "suburb" | "city">
): LatLngTuple | null {
  const suburb = booking.suburb.trim().toLowerCase();
  if (!suburb) return null;
  const named = suburbOrCityCentroid(booking.suburb, "");
  const unnamed = suburbOrCityCentroid("\u0000", "");
  const hasFixedPlace =
    suburb === "city bowl" ||
    named[0] !== unnamed[0] ||
    named[1] !== unnamed[1];
  if (!hasFixedPlace) return null;
  const [lat, lng] = suburbOrCityCentroid(booking.suburb, booking.city);
  return [lat, lng];
}

/**
 * Bookings that share a suburb name share one anchor. Known suburbs use the
 * fixed centroid. An unknown suburb uses the earliest stored pin in that
 * suburb, so scattered mock pins cannot split one place into single-booking
 * zones. A suburb with no pin falls through to the city centroid.
 */
function unknownSuburbAnchors(
  ordered: readonly PickupZoneBooking[]
): Map<string, LatLngTuple> {
  const anchors = new Map<string, LatLngTuple>();
  for (const booking of ordered) {
    const key = booking.suburb.trim().toLowerCase();
    if (!key || anchors.has(key) || namedSuburbCentroid(booking)) continue;
    if (hasValidCoordinates(booking.coordinates)) {
      anchors.set(key, [booking.coordinates.lat, booking.coordinates.lng]);
    }
  }
  return anchors;
}

function zoneAnchor(
  booking: PickupZoneBooking,
  unknownAnchors: Map<string, LatLngTuple>
): LatLngTuple {
  const named = namedSuburbCentroid(booking);
  if (named) return named;
  const shared = unknownAnchors.get(booking.suburb.trim().toLowerCase());
  if (shared) return shared;
  return pickupPosition(booking);
}

/**
 * Cape Town and Johannesburg are different zones even when two pins are close.
 * An explicit city wins. A known Johannesburg suburb is next. Latitude is only
 * the fallback for a booking that names neither.
 */
export function serviceMetro(
  booking: Pick<PickupZoneBooking, "suburb" | "city" | "coordinates">
): ServiceMetro {
  const city = booking.city.trim();
  if (/johannesburg|sandton|jhb/i.test(city)) return "Johannesburg";
  if (/cape town/i.test(city)) return "Cape Town";

  if (
    /sandton|rosebank|fourways|randburg|bryanston|midrand/i.test(booking.suburb)
  ) {
    return "Johannesburg";
  }

  const [lat] = pickupPosition(booking);
  return lat > JOHANNESBURG_LATITUDE_SPLIT ? "Johannesburg" : "Cape Town";
}

function zoneId(metro: ServiceMetro, seedBookingId: string): string {
  const prefix = metro === "Johannesburg" ? "jhb" : "cpt";
  return `${prefix}-${seedBookingId}`;
}

function addSuburb(suburbs: string[], suburb: string) {
  const trimmed = suburb.trim();
  if (!trimmed) return;
  const key = trimmed.toLowerCase();
  if (suburbs.some((name) => name.toLowerCase() === key)) return;
  suburbs.push(trimmed);
}

function meanLatLng(points: LatLngTuple[]): LatLngTuple {
  let lat = 0;
  let lng = 0;
  for (const [pointLat, pointLng] of points) {
    lat += pointLat;
    lng += pointLng;
  }
  return [lat / points.length, lng / points.length];
}

function inScope(booking: PickupZoneBooking, scope: PickupZoneScope): boolean {
  return (
    ZONE_STATUSES.has(booking.status) &&
    booking.collectionSlot === scope.slot &&
    isBookingOnJohannesburgDay(booking.collectionDate, scope.collectionDate)
  );
}

/**
 * Group one collection day's pickups in one slot into place zones.
 *
 * Bookings are considered in id order, so the same list always yields the same
 * zones. The customer is ignored. Every booking in one suburb shares one
 * place, even when stored pins are far apart. The earliest booking in a zone
 * is its first stop. A later pickup joins that zone when it is in the same
 * metro and within 8 km of that first stop. A pickup with no neighbour in
 * range is still returned; the screen decides whether a single booking is
 * offered as a zone. This does not assign a driver.
 */
export function groupPickupsIntoZones<T extends PickupZoneBooking>(
  bookings: readonly T[],
  scope: PickupZoneScope
): PickupZone[] {
  const ordered = bookings.filter((booking) => inScope(booking, scope));
  ordered.sort((a, b) => compareIds(a.id, b.id));
  const unknownAnchors = unknownSuburbAnchors(ordered);

  const zones: DraftZone[] = [];

  for (const booking of ordered) {
    const position = zoneAnchor(booking, unknownAnchors);
    const metro = serviceMetro(booking);
    const zone = zones.find(
      (candidate) =>
        candidate.metro === metro &&
        distanceKm(candidate.seed, position) <= PICKUP_ZONE_RADIUS_KM
    );

    if (zone) {
      zone.bookingIds.push(booking.id);
      zone.positions.push(position);
      addSuburb(zone.suburbs, booking.suburb);
      continue;
    }

    const suburbs: string[] = [];
    addSuburb(suburbs, booking.suburb);
    zones.push({
      id: zoneId(metro, booking.id),
      metro,
      seed: position,
      suburbs,
      bookingIds: [booking.id],
      positions: [position],
    });
  }

  return zones
    .map((zone) => ({
      id: zone.id,
      suburbs: zone.suburbs,
      bookingIds: zone.bookingIds,
      centroid: meanLatLng(zone.positions),
    }))
    .sort((a, b) => compareIds(a.id, b.id));
}
