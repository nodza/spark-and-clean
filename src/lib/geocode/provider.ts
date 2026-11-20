/**
 * Server-side South African address search.
 * Do not import this from a client component — the key must stay on the server.
 *
 * Provider: Google when GOOGLE_MAPS_API_KEY or GOOGLE_PLACES_API_KEY is set
 * (Places API New for suggestions, Geocoding API when an address is typed).
 * Mapbox Geocoding v6 is used when only MAPBOX_ACCESS_TOKEN is set.
 * GEOCODER_PROVIDER=google|mapbox picks one when that credential exists.
 * With no key, lookup returns configured:false and callers keep the suburb
 * or city centroid instead of inventing a pin.
 */

import {
  addressFromComponents,
  addressFromMapboxFeature,
  biasForCity,
  cleanPlaceId,
  cleanSearchQuery,
  cleanSessionToken,
  composeAddressQuery,
  googleResultIsSpecific,
  preciseCoordinates,
  suggestionFromPrediction,
  type AddressComponent,
  type AddressSuggestion,
  type GeocodedAddress,
  type MapboxFeature,
} from "@/lib/geocode/address";
import {
  textMayBeOutsideCollectionArea,
  type AreaBias,
} from "@/lib/serviceArea";
import { hasValidCoordinates } from "@/lib/jobMapCoords";

export type GeocoderProviderName = "google" | "mapbox";

export type GeocoderConfig =
  | { provider: "google"; apiKey: string }
  | { provider: "mapbox"; accessToken: string };

export interface SuggestResult {
  configured: boolean;
  suggestions: AddressSuggestion[];
  error?: "lookup_failed";
}

export interface ForwardResult {
  configured: boolean;
  result: GeocodedAddress | null;
  error?: "lookup_failed";
}

type FetchLike = typeof fetch;

const cache = new Map<string, GeocodedAddress>();
const CACHE_LIMIT = 200;

export function clearGeocodeCache(): void {
  cache.clear();
}

export function readGeocoderConfig(
  env: NodeJS.ProcessEnv = process.env
): GeocoderConfig | null {
  const choice = env.GEOCODER_PROVIDER?.trim().toLowerCase();
  const google =
    env.GOOGLE_MAPS_API_KEY?.trim() ||
    env.GOOGLE_PLACES_API_KEY?.trim() ||
    "";
  const mapbox = env.MAPBOX_ACCESS_TOKEN?.trim() || "";

  if (choice === "google") return google ? { provider: "google", apiKey: google } : null;
  if (choice === "mapbox") {
    return mapbox ? { provider: "mapbox", accessToken: mapbox } : null;
  }
  if (google) return { provider: "google", apiKey: google };
  if (mapbox) return { provider: "mapbox", accessToken: mapbox };
  return null;
}

export function isGeocoderConfigured(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return readGeocoderConfig(env) != null;
}

function remember(key: string, address: GeocodedAddress): GeocodedAddress {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, address);
  return address;
}

function cacheKey(provider: GeocoderProviderName, query: string): string {
  return `${provider}:${query.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function timeoutSignal(parent?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(8000);
  if (!parent) return timeout;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([parent, timeout]);
  }
  return timeout;
}

export async function suggestAddresses(
  input: {
    query: string;
    near?: string;
    sessionToken?: string;
    signal?: AbortSignal;
  },
  fetchImpl: FetchLike = fetch,
  env: NodeJS.ProcessEnv = process.env
): Promise<SuggestResult> {
  const config = readGeocoderConfig(env);
  if (!config) return { configured: false, suggestions: [] };
  const query = cleanSearchQuery(input.query);
  if (!query) return { configured: true, suggestions: [] };

  try {
    const suggestions =
      config.provider === "google"
        ? await suggestGoogle(config.apiKey, query, input, fetchImpl)
        : await suggestMapbox(config.accessToken, query, input, fetchImpl);
    return { configured: true, suggestions };
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      return { configured: true, suggestions: [] };
    }
    console.error(
      "[geocode] suggest failed",
      err instanceof Error ? err.message : "unknown"
    );
    return { configured: true, suggestions: [], error: "lookup_failed" };
  }
}

export async function forwardGeocode(
  input: { query: string; near?: string; signal?: AbortSignal },
  fetchImpl: FetchLike = fetch,
  env: NodeJS.ProcessEnv = process.env
): Promise<ForwardResult> {
  const config = readGeocoderConfig(env);
  if (!config) return { configured: false, result: null };
  const query = cleanSearchQuery(input.query);
  if (!query) return { configured: true, result: null };

  const key = cacheKey(config.provider, query);
  const cached = cache.get(key);
  if (cached) return { configured: true, result: cached };

  try {
    const result =
      config.provider === "google"
        ? await forwardGoogle(config.apiKey, query, input, fetchImpl)
        : await forwardMapbox(config.accessToken, query, input, fetchImpl);
    if (result) remember(key, result);
    return { configured: true, result };
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      return { configured: true, result: null };
    }
    console.error(
      "[geocode] forward failed",
      err instanceof Error ? err.message : "unknown"
    );
    return { configured: true, result: null, error: "lookup_failed" };
  }
}

/**
 * Nearest South African street for a pin the customer dropped.
 * Coordinates on the result stay on the dropped point.
 */
export async function reverseGeocode(
  input: { lat: number; lng: number; signal?: AbortSignal },
  fetchImpl: FetchLike = fetch,
  env: NodeJS.ProcessEnv = process.env
): Promise<ForwardResult> {
  const config = readGeocoderConfig(env);
  if (!config) return { configured: false, result: null };
  const dropped = preciseCoordinates(input.lat, input.lng);
  if (!dropped) return { configured: true, result: null };

  const key = cacheKey(config.provider, `reverse:${dropped.lat},${dropped.lng}`);
  const cached = cache.get(key);
  if (cached) return { configured: true, result: cached };

  try {
    const looked =
      config.provider === "google"
        ? await reverseGoogle(config.apiKey, dropped, input, fetchImpl)
        : await reverseMapbox(config.accessToken, dropped, input, fetchImpl);
    if (!looked) return { configured: true, result: null };
    const result = { ...looked, coordinates: dropped };
    remember(key, result);
    return { configured: true, result };
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      return { configured: true, result: null };
    }
    console.error(
      "[geocode] reverse failed",
      err instanceof Error ? err.message : "unknown"
    );
    return { configured: true, result: null, error: "lookup_failed" };
  }
}

export async function resolvePlace(
  input: { placeId: string; sessionToken?: string; signal?: AbortSignal },
  fetchImpl: FetchLike = fetch,
  env: NodeJS.ProcessEnv = process.env
): Promise<ForwardResult> {
  const config = readGeocoderConfig(env);
  if (!config) return { configured: false, result: null };
  const placeId = cleanPlaceId(input.placeId);
  if (!placeId) return { configured: true, result: null };

  try {
    if (config.provider === "mapbox") {
      // Geocoding v6 suggestions already include coordinates. There is no
      // separate retrieve-by-id that accepts those ids.
      return { configured: true, result: null };
    }
    const result = await googlePlaceDetails(
      config.apiKey,
      placeId,
      input,
      fetchImpl
    );
    return { configured: true, result };
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      return { configured: true, result: null };
    }
    console.error(
      "[geocode] place failed",
      err instanceof Error ? err.message : "unknown"
    );
    return { configured: true, result: null, error: "lookup_failed" };
  }
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readStoredCoordinates(value: unknown): { lat: number; lng: number } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const lat = (value as { lat?: unknown }).lat;
  const lng = (value as { lng?: unknown }).lng;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!hasValidCoordinates({ lat, lng })) return null;
  if (!preciseCoordinates(lat, lng)) return null;
  return { lat, lng };
}

/**
 * Fill a booking payload with a real pin when the client did not send one.
 * Invalid pins are dropped. A missing key or a failed lookup leaves coordinates
 * unset so the driver map uses the suburb or city centroid.
 */
export async function attachGeocodedCoordinates(
  payload: Record<string, unknown>,
  fetchImpl: FetchLike = fetch,
  env: NodeJS.ProcessEnv = process.env
): Promise<void> {
  const manual = payload.coordinatesManual === true;
  delete payload.coordinatesManual;

  const stored = readStoredCoordinates(payload.coordinates);
  if (!stored) delete payload.coordinates;
  if (manual && stored) return;
  if (stored) return;

  const query = composeAddressQuery({
    addressLine1: readString(payload.addressLine1),
    suburb: readString(payload.suburb),
    city: readString(payload.city),
    postalCode: readString(payload.postalCode),
  });
  if (!cleanSearchQuery(query)) return;

  try {
    const looked = await forwardGeocode(
      { query, near: readString(payload.city) },
      fetchImpl,
      env
    );
    if (!looked.result) return;
    payload.coordinates = looked.result.coordinates;
    if (!readString(payload.postalCode) && looked.result.postalCode) {
      payload.postalCode = looked.result.postalCode;
    }
    if (!readString(payload.suburb) && looked.result.suburb) {
      payload.suburb = looked.result.suburb;
    }
    if (!readString(payload.city) && looked.result.city) {
      payload.city = looked.result.city;
    }
  } catch (err) {
    console.error(
      "[geocode] booking lookup failed",
      err instanceof Error ? err.message : "unknown"
    );
  }
}

async function suggestGoogle(
  apiKey: string,
  query: string,
  input: { near?: string; sessionToken?: string; signal?: AbortSignal },
  fetchImpl: FetchLike
): Promise<AddressSuggestion[]> {
  const bias = biasForCity(input.near, query);
  const sessionToken = cleanSessionToken(input.sessionToken ?? "");
  const response = await fetchImpl(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      signal: timeoutSignal(input.signal),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify({
        input: withPlace(query, input.near),
        includedRegionCodes: ["za"],
        languageCode: "en",
        regionCode: "za",
        ...(sessionToken ? { sessionToken } : {}),
        ...(bias ? { locationBias: rectangleBias(bias) } : {}),
      }),
    }
  );
  const body = (await readJson(response)) as {
    suggestions?: Array<{
      placePrediction?: {
        placeId?: string;
        text?: { text?: string };
        structuredFormat?: {
          mainText?: { text?: string };
          secondaryText?: { text?: string };
        };
      };
    }>;
    error?: { message?: string };
  } | null;
  if (!response.ok || !body) {
    throw new Error(body?.error?.message || `Google autocomplete ${response.status}`);
  }

  const suggestions: AddressSuggestion[] = [];
  for (const entry of body.suggestions ?? []) {
    const prediction = entry.placePrediction;
    const placeId = prediction?.placeId ? cleanPlaceId(prediction.placeId) : null;
    if (!prediction || !placeId) continue;
    const label = prediction.text?.text || "";
    const secondary = prediction.structuredFormat?.secondaryText?.text || "";
    if (textMayBeOutsideCollectionArea(`${label} ${secondary}`)) continue;
    suggestions.push(
      suggestionFromPrediction({
        placeId,
        primary: prediction.structuredFormat?.mainText?.text || "",
        secondary: prediction.structuredFormat?.secondaryText?.text || "",
        label: prediction.text?.text || "",
      })
    );
    if (suggestions.length >= 6) break;
  }
  return suggestions;
}

async function googlePlaceDetails(
  apiKey: string,
  placeId: string,
  input: { sessionToken?: string; signal?: AbortSignal },
  fetchImpl: FetchLike
): Promise<GeocodedAddress | null> {
  const url = new URL(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`
  );
  const sessionToken = cleanSessionToken(input.sessionToken ?? "");
  if (sessionToken) url.searchParams.set("sessionToken", sessionToken);
  const response = await fetchImpl(url, {
    signal: timeoutSignal(input.signal),
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "id,formattedAddress,location,addressComponents,types",
    },
  });
  const body = (await readJson(response)) as {
    id?: string;
    formattedAddress?: string;
    types?: string[];
    location?: { latitude?: number; longitude?: number };
    addressComponents?: AddressComponent[];
    error?: { message?: string };
  } | null;
  if (!response.ok || !body) {
    throw new Error(body?.error?.message || `Google place ${response.status}`);
  }
  const lat = body.location?.latitude;
  const lng = body.location?.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  // The customer picked this place, so keep the pin even if the type list is broad.
  return addressFromComponents({
    placeId: body.id || placeId,
    components: body.addressComponents ?? [],
    latitude: lat,
    longitude: lng,
    formattedAddress: body.formattedAddress,
  });
}

interface GoogleGeocodeResult {
  place_id?: string;
  formatted_address?: string;
  types?: string[];
  address_components?: AddressComponent[];
  geometry?: { location?: { lat?: number; lng?: number } };
}

async function forwardGoogle(
  apiKey: string,
  query: string,
  input: { near?: string; signal?: AbortSignal },
  fetchImpl: FetchLike
): Promise<GeocodedAddress | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", withPlace(query, input.near));
  url.searchParams.set("components", "country:ZA");
  url.searchParams.set("region", "za");
  url.searchParams.set("language", "en");
  const bias = biasForCity(input.near, query);
  if (bias) {
    url.searchParams.set("bounds", rectangleParam(bias));
  }
  url.searchParams.set("key", apiKey);

  const response = await fetchImpl(url, { signal: timeoutSignal(input.signal) });
  const body = (await readJson(response)) as {
    status?: string;
    error_message?: string;
    results?: GoogleGeocodeResult[];
  } | null;
  if (!response.ok || !body) {
    throw new Error(`Google geocode ${response.status}`);
  }
  if (body.status === "ZERO_RESULTS") return null;
  if (body.status && body.status !== "OK") {
    throw new Error(body.error_message || body.status);
  }

  for (const match of body.results ?? []) {
    if (!googleResultIsSpecific(match.types)) continue;
    const lat = match.geometry?.location?.lat;
    const lng = match.geometry?.location?.lng;
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    const address = addressFromComponents({
      placeId: match.place_id || `google_${query}`,
      components: match.address_components ?? [],
      latitude: lat,
      longitude: lng,
      formattedAddress: match.formatted_address,
      types: match.types,
    });
    if (address) return address;
  }
  return null;
}

function pickGoogleResult(
  results: GoogleGeocodeResult[]
): GoogleGeocodeResult | null {
  return results.find((result) => googleResultIsSpecific(result.types)) ?? null;
}

async function reverseGoogle(
  apiKey: string,
  dropped: { lat: number; lng: number },
  input: { signal?: AbortSignal },
  fetchImpl: FetchLike
): Promise<GeocodedAddress | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${dropped.lat},${dropped.lng}`);
  url.searchParams.set("language", "en");
  url.searchParams.set("key", apiKey);

  const response = await fetchImpl(url, { signal: timeoutSignal(input.signal) });
  const body = (await readJson(response)) as {
    status?: string;
    error_message?: string;
    results?: GoogleGeocodeResult[];
  } | null;
  if (!response.ok || !body) {
    throw new Error(`Google reverse ${response.status}`);
  }
  if (body.status === "ZERO_RESULTS") return null;
  if (body.status && body.status !== "OK") {
    throw new Error(body.error_message || body.status);
  }

  const match = pickGoogleResult(body.results ?? []);
  if (!match) return null;
  return addressFromComponents({
    placeId: match.place_id || `google_reverse_${dropped.lat}_${dropped.lng}`,
    components: match.address_components ?? [],
    latitude: dropped.lat,
    longitude: dropped.lng,
    formattedAddress: match.formatted_address,
    types: match.types,
  });
}

function rectangleParam(bias: AreaBias): string {
  return `${bias.south},${bias.west}|${bias.north},${bias.east}`;
}

function rectangleBias(bias: AreaBias) {
  return {
    rectangle: {
      low: { latitude: bias.south, longitude: bias.west },
      high: { latitude: bias.north, longitude: bias.east },
    },
  };
}

function withPlace(query: string, near?: string): string {
  const place = (near ?? "").replace(/\s+/g, " ").trim();
  if (!place) return query;
  if (query.toLowerCase().includes(place.toLowerCase())) return query;
  const joined = `${query}, ${place}`;
  return joined.length > 180 ? query : joined;
}

async function mapboxForward(
  token: string,
  query: string,
  input: { near?: string; signal?: AbortSignal },
  fetchImpl: FetchLike,
  options: { autocomplete: boolean; limit: number; types: string }
): Promise<MapboxFeature[]> {
  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set("country", "za");
  url.searchParams.set("language", "en");
  url.searchParams.set("limit", String(options.limit));
  url.searchParams.set("autocomplete", options.autocomplete ? "true" : "false");
  url.searchParams.set("types", options.types);
  url.searchParams.set("permanent", "false");
  url.searchParams.set("q", withPlace(query, input.near));
  const bias = biasForCity(input.near, query);
  if (bias) {
    url.searchParams.set(
      "bbox",
      `${bias.west},${bias.south},${bias.east},${bias.north}`
    );
    const lat = (bias.south + bias.north) / 2;
    const lng = (bias.west + bias.east) / 2;
    url.searchParams.set("proximity", `${lng},${lat}`);
  }
  url.searchParams.set("access_token", token);

  const response = await fetchImpl(url, { signal: timeoutSignal(input.signal) });
  const body = (await readJson(response)) as {
    features?: MapboxFeature[];
    message?: string;
  } | null;
  if (!response.ok || !body) {
    throw new Error(body?.message || `Mapbox geocode ${response.status}`);
  }
  return body.features ?? [];
}

async function suggestMapbox(
  token: string,
  query: string,
  input: { near?: string; signal?: AbortSignal },
  fetchImpl: FetchLike
): Promise<AddressSuggestion[]> {
  const features = await mapboxForward(token, query, input, fetchImpl, {
    autocomplete: true,
    limit: 6,
    types: "address,street",
  });
  const suggestions: AddressSuggestion[] = [];
  for (const feature of features) {
    const address = addressFromMapboxFeature(feature);
    if (!address) continue;
    if (textMayBeOutsideCollectionArea(address.label)) continue;
    suggestions.push(address);
  }
  return suggestions;
}

async function forwardMapbox(
  token: string,
  query: string,
  input: { near?: string; signal?: AbortSignal },
  fetchImpl: FetchLike
): Promise<GeocodedAddress | null> {
  const addressFeatures = await mapboxForward(token, query, input, fetchImpl, {
    autocomplete: false,
    limit: 1,
    types: "address",
  });
  const address = addressFeatures
    .map((feature) => addressFromMapboxFeature(feature))
    .find((feature) => feature != null);
  if (address) return address;

  const streetFeatures = await mapboxForward(token, query, input, fetchImpl, {
    autocomplete: false,
    limit: 1,
    types: "street",
  });
  return (
    streetFeatures
      .map((feature) => addressFromMapboxFeature(feature))
      .find((feature) => feature != null) ?? null
  );
}

async function reverseMapbox(
  token: string,
  dropped: { lat: number; lng: number },
  input: { signal?: AbortSignal },
  fetchImpl: FetchLike
): Promise<GeocodedAddress | null> {
  const url = new URL("https://api.mapbox.com/search/geocode/v6/reverse");
  url.searchParams.set("longitude", String(dropped.lng));
  url.searchParams.set("latitude", String(dropped.lat));
  url.searchParams.set("country", "za");
  url.searchParams.set("language", "en");
  url.searchParams.set("limit", "1");
  url.searchParams.set("types", "address,street");
  url.searchParams.set("permanent", "false");
  url.searchParams.set("access_token", token);

  const response = await fetchImpl(url, { signal: timeoutSignal(input.signal) });
  const body = (await readJson(response)) as {
    features?: MapboxFeature[];
    message?: string;
  } | null;
  if (!response.ok || !body) {
    throw new Error(body?.message || `Mapbox reverse ${response.status}`);
  }
  for (const feature of body.features ?? []) {
    const address = addressFromMapboxFeature(feature);
    if (address) return address;
  }
  return null;
}

