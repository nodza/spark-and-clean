import type { Coordinates } from "@/types/booking";
import {
  suburbOrCityCentroid,
  suburbServiceCity,
  type MappedServiceCity,
} from "@/lib/jobMapCoords";
import {
  biasForText,
  collectionAreaOf,
  type AreaBias,
} from "@/lib/serviceArea";

/**
 * A place the customer can pick, or the structured result of a typed address.
 * Coordinates are omitted until a geocoder (or a manual pin) supplies them.
 */
export interface AddressSuggestion {
  placeId: string;
  label: string;
  addressLine1: string;
  suburb: string;
  city: string;
  postalCode: string;
  coordinates?: Coordinates;
}

export interface GeocodedAddress extends AddressSuggestion {
  coordinates: Coordinates;
}

/** @deprecated Use AddressSuggestion. Kept so older imports stay readable. */
export type ParsedAddress = AddressSuggestion;

export interface AddressParts {
  addressLine1?: string;
  suburb?: string;
  city?: string;
  postalCode?: string;
}

/** Rough South Africa bounds, padded so coastal and border addresses still pass. */
export function isSouthAfricanCoordinate(lat: number, lng: number): boolean {
  return lat >= -35.2 && lat <= -21.7 && lng >= 16.2 && lng <= 33.1;
}

export function roundCoordinate(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** Finite coordinates inside South Africa, rounded so the same point stays stable. */
export function preciseCoordinates(
  lat: number,
  lng: number
): Coordinates | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const coordinates = {
    lat: roundCoordinate(lat),
    lng: roundCoordinate(lng),
  };
  if (!isSouthAfricanCoordinate(coordinates.lat, coordinates.lng)) return null;
  return coordinates;
}

export function formatAddressLabel(parts: {
  addressLine1?: string;
  suburb?: string;
  city?: string;
  postalCode?: string;
}): string {
  return [parts.addressLine1, parts.suburb, parts.city, parts.postalCode]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

export function composeAddressQuery(parts: AddressParts): string {
  const bits = [parts.addressLine1, parts.suburb, parts.city, parts.postalCode]
    .map((part) => (part ?? "").trim())
    .filter(Boolean);
  if (bits.length === 0) return "";
  const joined = bits.join(", ");
  if (/south africa/i.test(joined)) return joined;
  return `${joined}, South Africa`;
}

/** Fixed suburb, then city, centre. Same inputs always return the same point. */
export function centroidCoordinates(suburb: string, city = ""): Coordinates {
  const [lat, lng] = suburbOrCityCentroid(suburb, city);
  return { lat, lng };
}

const CITY_ALIASES: Record<string, MappedServiceCity> = {
  "cape town": "Cape Town",
  cpt: "Cape Town",
  "city of cape town": "Cape Town",
  johannesburg: "Johannesburg",
  jhb: "Johannesburg",
  joburg: "Johannesburg",
  "city of johannesburg": "Johannesburg",
};

function cleanPlaceName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Keep the town Google or Mapbox named. Municipality is only a fallback. */
function friendlyCity(locality: string, municipality: string): string {
  if (locality.trim()) return locality.trim();
  const cleaned = municipality
    .replace(/^city of\s+/i, "")
    .replace(/\s+metropolitan municipality$/i, "")
    .replace(/\s+local municipality$/i, "")
    .replace(/\s+district municipality$/i, "")
    .trim();
  if (/^tshwane$/i.test(cleaned)) return "Pretoria";
  if (/^johannesburg$/i.test(cleaned)) return "Johannesburg";
  if (/^cape town$/i.test(cleaned)) return "Cape Town";
  return cleaned;
}

/**
 * Turn geocoder locality fields into the suburb + service city we store.
 * A known suburb in the city slot (Sandton, Sea Point) is moved to suburb.
 */
export function assignSuburbAndCity(
  suburb: string,
  city: string,
  region = ""
): { suburb: string; city: string } {
  let nextSuburb = cleanPlaceName(suburb);
  let nextCity = cleanPlaceName(city);
  const regionName = cleanPlaceName(region).toLowerCase();

  if (/^south africa$/i.test(nextCity) || nextCity.toLowerCase() === "za") {
    nextCity = "";
  }

  const cityIsSuburb = suburbServiceCity(nextCity);
  if (cityIsSuburb && !nextSuburb) {
    nextSuburb = nextCity;
    nextCity = cityIsSuburb;
  } else if (cityIsSuburb) {
    nextCity = cityIsSuburb;
  }

  const alias = CITY_ALIASES[nextCity.toLowerCase()];
  if (alias) nextCity = alias;

  const fromSuburb = suburbServiceCity(nextSuburb);
  if (!nextCity && fromSuburb) nextCity = fromSuburb;
  if (
    fromSuburb &&
    (regionName === "western cape" || regionName === "gauteng") &&
    (nextCity === region || /^western cape$|^gauteng$/i.test(nextCity))
  ) {
    nextCity = fromSuburb;
  }

  return { suburb: nextSuburb, city: nextCity };
}

export function cleanSearchQuery(value: string): string | null {
  const cleaned = value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 3 || cleaned.length > 180) return null;
  if (!/[a-z0-9]/i.test(cleaned)) return null;
  return cleaned;
}

export function cleanPlaceId(value: string): string | null {
  const cleaned = value.trim();
  if (cleaned.length < 4 || cleaned.length > 512) return null;
  if (!/^[A-Za-z0-9_.:~-]+$/.test(cleaned)) return null;
  return cleaned;
}

export function cleanSessionToken(value: string): string | undefined {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > 128) return undefined;
  if (!/^[A-Za-z0-9-]+$/.test(cleaned)) return undefined;
  return cleaned;
}

/**
 * Search bias for the collection area the customer named.
 * Cape Town covers the whole metro. Any Gauteng town covers the province,
 * not a circle around the Johannesburg centre.
 */
export function biasForCity(city?: string, query?: string): AreaBias | null {
  return biasForText(`${city ?? ""} ${query ?? ""}`);
}

function manualPlaceId(line: string, suburb: string, city: string): string {
  return `manual_${line}_${suburb}_${city}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 120);
}

/**
 * Split a typed address. "Street, Suburb, City" and an optional 4-digit code.
 * Two parts are accepted when the last part is a known suburb.
 */
export function parseAddressString(input: string): AddressSuggestion | null {
  const parts = input
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) return null;

  let postalCode = "";
  if (/^\d{4}$/.test(parts[parts.length - 1]) && parts.length >= 3) {
    postalCode = parts.pop() ?? "";
  }

  if (parts.length < 2) return null;

  let addressLine1 = "";
  let suburb = "";
  let city = "";

  if (parts.length >= 3) {
    city = parts[parts.length - 1];
    suburb = parts[parts.length - 2];
    addressLine1 = parts.slice(0, -2).join(", ");
  } else {
    const tail = parts[1];
    const tailCity = assignSuburbAndCity("", tail).city;
    const tailIsKnownSuburb = Boolean(suburbServiceCity(tail));
    if (tailIsKnownSuburb) {
      addressLine1 = parts[0];
      suburb = tail;
      city = tailCity;
    } else if (CITY_ALIASES[tail.toLowerCase()]) {
      return null;
    } else {
      addressLine1 = parts[0];
      suburb = tail;
    }
  }

  const assigned = assignSuburbAndCity(suburb, city);
  if (!addressLine1 || !assigned.suburb) return null;

  const suggestion: AddressSuggestion = {
    placeId: manualPlaceId(addressLine1, assigned.suburb, assigned.city),
    addressLine1,
    suburb: assigned.suburb,
    city: assigned.city,
    postalCode,
    label: formatAddressLabel({
      addressLine1,
      suburb: assigned.suburb,
      city: assigned.city,
      postalCode,
    }),
  };
  return suggestion;
}

/** Fill suburb and city when they were typed into the street field. */
export function enrichFreeTextAddress(parts: AddressParts): AddressParts {
  if (parts.suburb?.trim() && parts.city?.trim()) return {};
  const parsed = parseAddressString(parts.addressLine1 ?? "");
  if (!parsed) return {};
  return {
    addressLine1: parsed.addressLine1,
    suburb: parts.suburb?.trim() || parsed.suburb,
    city: parts.city?.trim() || parsed.city,
    postalCode: parts.postalCode?.trim() || parsed.postalCode || undefined,
  };
}

export interface AddressComponent {
  longText?: string;
  shortText?: string;
  long_name?: string;
  short_name?: string;
  types?: string[];
}

function componentText(component: AddressComponent): string {
  return (
    component.longText ||
    component.long_name ||
    component.shortText ||
    component.short_name ||
    ""
  ).trim();
}

function pickComponent(
  components: AddressComponent[],
  ...types: string[]
): string {
  for (const type of types) {
    const match = components.find((component) =>
      component.types?.includes(type)
    );
    const text = match ? componentText(match) : "";
    if (text) return text;
  }
  return "";
}

export function componentsAreSouthAfrica(
  components: AddressComponent[]
): boolean {
  const country = components.find((component) =>
    component.types?.includes("country")
  );
  if (!country) return true;
  const short = (country.shortText || country.short_name || "")
    .trim()
    .toUpperCase();
  if (short) return short === "ZA";
  const long = componentText(country).toLowerCase();
  return long === "south africa";
}

const SPECIFIC_GOOGLE_TYPES = new Set([
  "street_address",
  "premise",
  "subpremise",
  "route",
  "street_number",
  "establishment",
  "point_of_interest",
]);

export function googleResultIsSpecific(types: string[] | undefined): boolean {
  return (types ?? []).some((type) => SPECIFIC_GOOGLE_TYPES.has(type));
}

function streetLine(components: AddressComponent[]): string {
  const unit = pickComponent(components, "subpremise");
  const number = pickComponent(components, "street_number");
  const route = pickComponent(components, "route");
  const street = [number, route].filter(Boolean).join(" ");
  const unitLabel =
    unit && /^\d+[a-z]?$/i.test(unit) ? `Unit ${unit}` : unit;
  if (unitLabel && street) return `${unitLabel}, ${street}`;
  return street || pickComponent(components, "premise", "establishment");
}

export function addressFromComponents(input: {
  placeId: string;
  components: AddressComponent[];
  latitude: number;
  longitude: number;
  formattedAddress?: string;
  types?: string[];
}): GeocodedAddress | null {
  if (!componentsAreSouthAfrica(input.components)) return null;
  if (input.types && !googleResultIsSpecific(input.types)) return null;
  const coordinates = preciseCoordinates(input.latitude, input.longitude);
  if (!coordinates) return null;

  const postalCode = pickComponent(input.components, "postal_code");
  const region = pickComponent(
    input.components,
    "administrative_area_level_1"
  );
  const municipality = pickComponent(
    input.components,
    "administrative_area_level_2"
  );
  const locality = pickComponent(
    input.components,
    "locality",
    "postal_town"
  );
  const suburb = pickComponent(
    input.components,
    "sublocality_level_1",
    "sublocality",
    "neighborhood"
  );
  const area = collectionAreaOf({
    region,
    municipality,
    city: locality || municipality,
    suburb,
    latitude: coordinates.lat,
    longitude: coordinates.lng,
  });
  if (area === "outside") return null;
  const city = friendlyCity(locality, municipality);
  const assigned = assignSuburbAndCity(suburb, city, region);
  const addressLine1 =
    streetLine(input.components) ||
    input.formattedAddress?.split(",")[0]?.trim() ||
    "";
  if (!addressLine1 && !assigned.suburb) return null;

  const postal = /^\d{4}$/.test(postalCode) ? postalCode : "";
  return {
    placeId: input.placeId,
    addressLine1: addressLine1 || assigned.suburb,
    suburb: assigned.suburb,
    city: assigned.city,
    postalCode: postal,
    coordinates,
    label: formatAddressLabel({
      addressLine1: addressLine1 || assigned.suburb,
      suburb: assigned.suburb,
      city: assigned.city,
      postalCode: postal,
    }),
  };
}

export interface MapboxFeature {
  geometry?: { coordinates?: unknown };
  properties?: {
    mapbox_id?: string;
    feature_type?: string;
    name?: string;
    full_address?: string;
    place_formatted?: string;
    coordinates?: { latitude?: number; longitude?: number };
    context?: {
      address?: { name?: string };
      street?: { name?: string };
      neighborhood?: { name?: string };
      locality?: { name?: string };
      place?: { name?: string };
      district?: { name?: string };
      postcode?: { name?: string };
      region?: { name?: string };
      country?: { country_code?: string; name?: string };
    };
  };
}

const MAPBOX_SPECIFIC = new Set([
  "address",
  "street",
  "block",
  "secondary_address",
]);

export function addressFromMapboxFeature(
  feature: MapboxFeature
): GeocodedAddress | null {
  const properties = feature.properties;
  if (!properties) return null;
  const featureType = properties.feature_type ?? "";
  if (featureType && !MAPBOX_SPECIFIC.has(featureType)) return null;

  const country = properties.context?.country?.country_code?.toUpperCase();
  if (country && country !== "ZA") return null;

  const pair = geometryPair(feature);
  if (!pair) return null;
  const coordinates = preciseCoordinates(pair.lat, pair.lng);
  if (!coordinates) return null;

  const context = properties.context ?? {};
  const addressLine1 =
    context.address?.name ||
    (featureType === "street" ? context.street?.name || properties.name : "") ||
    properties.name ||
    "";
  const suburb =
    context.neighborhood?.name ||
    context.locality?.name ||
    "";
  const city = context.place?.name || "";
  const region = context.region?.name || "";
  const municipality = context.district?.name || "";
  const area = collectionAreaOf({
    region,
    municipality,
    city: city || municipality,
    suburb,
    latitude: coordinates.lat,
    longitude: coordinates.lng,
  });
  if (area === "outside") return null;
  const assigned = assignSuburbAndCity(
    suburb,
    friendlyCity(city, municipality),
    region
  );
  const postalRaw = context.postcode?.name?.trim() ?? "";
  const postalCode = /^\d{4}$/.test(postalRaw) ? postalRaw : "";
  if (!addressLine1 && !assigned.suburb) return null;

  const line = addressLine1 || assigned.suburb;
  return {
    placeId: properties.mapbox_id || `mapbox_${line}_${assigned.suburb}`,
    addressLine1: line,
    suburb: assigned.suburb,
    city: assigned.city,
    postalCode,
    coordinates,
    label:
      stripCountry(properties.full_address || "") ||
      formatAddressLabel({
        addressLine1: line,
        suburb: assigned.suburb,
        city: assigned.city,
        postalCode,
      }),
  };
}

function geometryPair(
  feature: MapboxFeature
): { lat: number; lng: number } | null {
  const named = feature.properties?.coordinates;
  if (
    named &&
    typeof named.latitude === "number" &&
    typeof named.longitude === "number"
  ) {
    return { lat: named.latitude, lng: named.longitude };
  }
  const pair = feature.geometry?.coordinates;
  if (
    Array.isArray(pair) &&
    typeof pair[0] === "number" &&
    typeof pair[1] === "number"
  ) {
    return { lat: pair[1], lng: pair[0] };
  }
  return null;
}

export function stripCountry(value: string): string {
  return value.replace(/,?\s*South Africa$/i, "").trim();
}

/** Preview lines for a Google suggestion before place details are loaded. */
export function suggestionFromPrediction(input: {
  placeId: string;
  primary: string;
  secondary: string;
  label: string;
}): AddressSuggestion {
  const secondary = stripCountry(input.secondary);
  const parts = secondary
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const postalCode = parts.find((part) => /^\d{4}$/.test(part)) ?? "";
  const named = parts.filter((part) => !/^\d{4}$/.test(part));
  const cityGuess = named.length >= 2 ? named[1] : (named[0] ?? "");
  const suburbGuess =
    named.length >= 2
      ? named[0]
      : suburbServiceCity(cityGuess)
        ? cityGuess
        : "";
  const assigned = assignSuburbAndCity(
    suburbGuess,
    suburbServiceCity(cityGuess) ? "" : cityGuess
  );
  const addressLine1 = input.primary.trim() || stripCountry(input.label);
  return {
    placeId: input.placeId,
    addressLine1,
    suburb: assigned.suburb,
    city: assigned.city,
    postalCode,
    label:
      stripCountry(input.label) ||
      formatAddressLabel({
        addressLine1,
        suburb: assigned.suburb,
        city: assigned.city,
        postalCode,
      }),
  };
}
