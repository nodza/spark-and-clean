import type { Booking, Coordinates } from "@/types/booking";
import { technicianTodayStops } from "@/lib/technicianJobs";

/** Leaflet-style [lat, lng]. */
export type LatLngTuple = [number, number];

export interface TodayMapPin<T extends Booking = Booking> {
  job: T;
  position: LatLngTuple;
}

/** Cape Town CBD — default when suburb/city are unknown. */
export const DEFAULT_MAP_CENTER: LatLngTuple = [-33.9249, 18.4241];

const CITY_CENTROIDS: Record<string, LatLngTuple> = {
  "cape town": DEFAULT_MAP_CENTER,
  johannesburg: [-26.2041, 28.0473],
  jhb: [-26.2041, 28.0473],
};

/**
 * Fixed suburb centroids (CPT + JHB). Keys are lowercased for lookup.
 * No jitter — pins stay put across reloads.
 */
const SUBURB_CENTROIDS: Record<string, LatLngTuple> = {
  // Cape Town
  durbanville: [-33.8333, 18.65],
  "sea point": [-33.9167, 18.3833],
  "city bowl": [-33.9249, 18.4241],
  claremont: [-33.98, 18.465],
  "camps bay": [-33.95, 18.3833],
  "green point": [-33.9067, 18.4167],
  rondebosch: [-33.9667, 18.4833],
  milnerton: [-33.8667, 18.5],
  woodstock: [-33.9333, 18.45],
  constantia: [-34.0333, 18.4333],
  bishopscourt: [-33.9833, 18.45],
  observatory: [-33.9333, 18.4667],
  gardens: [-33.9333, 18.4167],
  fresnaye: [-33.925, 18.3833],
  // Johannesburg
  sandton: [-26.1076, 28.0567],
  rosebank: [-26.146, 28.0436],
  fourways: [-26.0207, 28.0074],
  randburg: [-26.0936, 27.975],
  bryanston: [-26.05, 28.0167],
  midrand: [-25.989, 28.128],
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

export function hasValidCoordinates(
  coords?: Coordinates | null
): coords is Coordinates {
  return (
    !!coords &&
    typeof coords.lat === "number" &&
    typeof coords.lng === "number" &&
    Number.isFinite(coords.lat) &&
    Number.isFinite(coords.lng)
  );
}

/**
 * Resolve a fixed centroid for suburb, then city.
 * Johannesburg suburbs are recognized even if city is missing/wrong.
 */
export function suburbOrCityCentroid(
  suburb: string,
  city = ""
): LatLngTuple {
  const suburbKey = normalizeKey(suburb);
  const suburbHit = SUBURB_CENTROIDS[suburbKey];
  if (suburbHit) return suburbHit;

  const cityKey = normalizeKey(city);
  const cityHit = CITY_CENTROIDS[cityKey];
  if (cityHit) return cityHit;

  if (
    /johannesburg|sandton|jhb/i.test(city) ||
    /sandton|rosebank|fourways|randburg|bryanston|midrand/i.test(suburb)
  ) {
    return CITY_CENTROIDS.johannesburg;
  }

  return DEFAULT_MAP_CENTER;
}

/**
 * Prefer stored booking coordinates; otherwise a fixed suburb/city centroid.
 * Never applies random or hash jitter.
 */
export function positionForJob(
  job: Pick<Booking, "suburb" | "city" | "coordinates">
): LatLngTuple {
  if (hasValidCoordinates(job.coordinates)) {
    return [job.coordinates.lat, job.coordinates.lng];
  }
  return suburbOrCityCentroid(job.suburb, job.city);
}

/**
 * Today's map pins — same job set as F5.1 (`technicianTodayStops`),
 * one pin per stop, positions from stored coords or fixed centroids.
 */
export function todayMapPins<T extends Booking>(
  bookings: T[],
  driverProfileId: string | undefined,
  today: string
): TodayMapPin<T>[] {
  return technicianTodayStops(bookings, driverProfileId, today).map((job) => ({
    job,
    position: positionForJob(job),
  }));
}
