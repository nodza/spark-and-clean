import type { Coordinates } from "@/types/booking";

export type ServiceCity = "Cape Town" | "Johannesburg";

export interface ParsedAddress {
  /** Stable id for list keys / future Places place_id */
  placeId: string;
  addressLine1: string;
  suburb: string;
  city: ServiceCity;
  label: string;
}

export interface GeocodedAddress extends ParsedAddress {
  coordinates: Coordinates;
}

export interface AddressSearchOptions {
  /** Future Google Places / Mapbox API key. Phase 1 ignores this and uses mocks. */
  apiKey?: string;
  signal?: AbortSignal;
}

/** Approximate bounding boxes for Phase 1 mock geocoding */
const CITY_BOUNDS: Record<
  ServiceCity,
  { minLat: number; maxLat: number; minLng: number; maxLng: number }
> = {
  "Cape Town": {
    minLat: -34.15,
    maxLat: -33.72,
    minLng: 18.32,
    maxLng: 18.72,
  },
  Johannesburg: {
    minLat: -26.35,
    maxLat: -25.95,
    minLng: 27.85,
    maxLng: 28.25,
  },
};

/** Stubbed Places Autocomplete suggestions (Phase 1 — no Google/Mapbox API) */
const MOCK_PLACES: ParsedAddress[] = [
  {
    placeId: "mock_cpt_protea",
    addressLine1: "42 Protea Way",
    suburb: "Durbanville",
    city: "Cape Town",
    label: "42 Protea Way, Durbanville, Cape Town",
  },
  {
    placeId: "mock_cpt_beach",
    addressLine1: "10 Beach Road",
    suburb: "Sea Point",
    city: "Cape Town",
    label: "10 Beach Road, Sea Point, Cape Town",
  },
  {
    placeId: "mock_cpt_kloof",
    addressLine1: "15 Kloof Street",
    suburb: "City Bowl",
    city: "Cape Town",
    label: "15 Kloof Street, City Bowl, Cape Town",
  },
  {
    placeId: "mock_cpt_main",
    addressLine1: "88 Main Road",
    suburb: "Claremont",
    city: "Cape Town",
    label: "88 Main Road, Claremont, Cape Town",
  },
  {
    placeId: "mock_cpt_canterbury",
    addressLine1: "3 Canterbury Drive",
    suburb: "Bishopscourt",
    city: "Cape Town",
    label: "3 Canterbury Drive, Bishopscourt, Cape Town",
  },
  {
    placeId: "mock_cpt_lower_main",
    addressLine1: "22 Lower Main Road",
    suburb: "Observatory",
    city: "Cape Town",
    label: "22 Lower Main Road, Observatory, Cape Town",
  },
  {
    placeId: "mock_cpt_lagoon",
    addressLine1: "7 Lagoon Beach Drive",
    suburb: "Milnerton",
    city: "Cape Town",
    label: "7 Lagoon Beach Drive, Milnerton, Cape Town",
  },
  {
    placeId: "mock_jhb_rivonia",
    addressLine1: "12 Rivonia Road",
    suburb: "Sandton",
    city: "Johannesburg",
    label: "12 Rivonia Road, Sandton, Johannesburg",
  },
  {
    placeId: "mock_jhb_smuts",
    addressLine1: "45 Jan Smuts Avenue",
    suburb: "Rosebank",
    city: "Johannesburg",
    label: "45 Jan Smuts Avenue, Rosebank, Johannesburg",
  },
  {
    placeId: "mock_jhb_nicol",
    addressLine1: "8 William Nicol Drive",
    suburb: "Fourways",
    city: "Johannesburg",
    label: "8 William Nicol Drive, Fourways, Johannesburg",
  },
  {
    placeId: "mock_jhb_republic",
    addressLine1: "100 Republic Road",
    suburb: "Randburg",
    city: "Johannesburg",
    label: "100 Republic Road, Randburg, Johannesburg",
  },
  {
    placeId: "mock_jhb_bryanston",
    addressLine1: "21 Main Road",
    suburb: "Bryanston",
    city: "Johannesburg",
    label: "21 Main Road, Bryanston, Johannesburg",
  },
];

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function resolveServiceCity(city: string, suburb = ""): ServiceCity {
  if (
    /johannesburg|sandton|jhb/i.test(city) ||
    /sandton|rosebank|fourways|randburg|bryanston|midrand/i.test(suburb)
  ) {
    return "Johannesburg";
  }
  return "Cape Town";
}

/**
 * Phase 1 mock geocoder: random coordinates inside the selected city's bounding box.
 */
export function mockGeocodeForCity(city: string, suburb = ""): Coordinates {
  const bounds = CITY_BOUNDS[resolveServiceCity(city, suburb)];
  return {
    lat: Number(randomInRange(bounds.minLat, bounds.maxLat).toFixed(6)),
    lng: Number(randomInRange(bounds.minLng, bounds.maxLng).toFixed(6)),
  };
}

/**
 * Parse a free-text address into line items when the user does not pick a suggestion.
 * Expected rough format: "Street, Suburb, City"
 */
export function parseAddressString(input: string): ParsedAddress | null {
  const parts = input
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length < 2) return null;

  const cityRaw = parts[parts.length - 1];
  const suburb = parts.length >= 3 ? parts[parts.length - 2] : parts[1];
  const addressLine1 =
    parts.length >= 3 ? parts.slice(0, -2).join(", ") : parts[0];
  const city = resolveServiceCity(cityRaw, suburb);

  return {
    placeId: `manual_${addressLine1}_${suburb}_${city}`
      .toLowerCase()
      .replace(/\s+/g, "_"),
    addressLine1,
    suburb,
    city,
    label: `${addressLine1}, ${suburb}, ${city}`,
  };
}

async function searchMockPlaces(
  query: string,
  signal?: AbortSignal
): Promise<ParsedAddress[]> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 180);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  return MOCK_PLACES.filter(
    (place) =>
      place.label.toLowerCase().includes(q) ||
      place.addressLine1.toLowerCase().includes(q) ||
      place.suburb.toLowerCase().includes(q) ||
      place.city.toLowerCase().includes(q)
  ).slice(0, 6);
}

/**
 * Address autocomplete search.
 * Phase 1: mocked. When `apiKey` is provided later, swap in Google/Mapbox here.
 */
export async function searchAddressSuggestions(
  query: string,
  options: AddressSearchOptions = {}
): Promise<ParsedAddress[]> {
  const { apiKey, signal } = options;

  // Ready for real provider: keep the same return shape (placeId, line items, label).
  if (apiKey) {
    // TODO(Phase 2): call Google Places Autocomplete / Mapbox Geocoding with apiKey
    // and map responses into ParsedAddress[]. Fall through to mock until wired.
  }

  return searchMockPlaces(query, signal);
}

/** Resolve a selected (or parsed) address into populated fields + coordinates. */
export function geocodeSelectedAddress(place: ParsedAddress): GeocodedAddress {
  return {
    ...place,
    coordinates: mockGeocodeForCity(place.city, place.suburb),
  };
}
