import {
  composeAddressQuery,
  enrichFreeTextAddress,
  parseAddressString,
  type AddressParts,
  type AddressSuggestion,
  type GeocodedAddress,
} from "@/lib/geocode/address";

export type { AddressParts, AddressSuggestion, GeocodedAddress };
export { composeAddressQuery, enrichFreeTextAddress, parseAddressString };

/** @deprecated Use AddressSuggestion. */
export type ParsedAddress = AddressSuggestion;

interface LookupEnvelope {
  configured?: boolean;
  suggestions?: AddressSuggestion[];
  result?: GeocodedAddress | null;
  error?: string;
}

async function readLookup(url: string, signal?: AbortSignal): Promise<LookupEnvelope> {
  const response = await fetch(url, {
    signal,
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const body = (await response.json().catch(() => null)) as LookupEnvelope | null;
  if (!body || typeof body !== "object") {
    return { configured: true, error: "lookup_failed" };
  }
  if (response.status === 429) {
    return { ...body, configured: body.configured !== false, error: "rate_limited" };
  }
  if (!response.ok) {
    return { configured: body.configured !== false, error: "lookup_failed" };
  }
  return body;
}

export async function fetchGeocoderStatus(
  signal?: AbortSignal
): Promise<{ configured: boolean }> {
  try {
    const body = await readLookup("/api/geocode", signal);
    return { configured: body.configured !== false };
  } catch {
    return { configured: true };
  }
}

export async function searchAddressSuggestions(
  query: string,
  options: { signal?: AbortSignal; near?: string; sessionToken?: string } = {}
): Promise<{ configured: boolean; suggestions: AddressSuggestion[]; error?: string }> {
  const params = new URLSearchParams({ q: query });
  if (options.near?.trim()) params.set("near", options.near.trim());
  if (options.sessionToken) params.set("sessionToken", options.sessionToken);
  try {
    const body = await readLookup(`/api/geocode?${params.toString()}`, options.signal);
    return {
      configured: body.configured !== false,
      suggestions: Array.isArray(body.suggestions) ? body.suggestions : [],
      error: body.error,
    };
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    return { configured: true, suggestions: [], error: "lookup_failed" };
  }
}

export async function geocodeTypedAddress(
  parts: AddressParts,
  options: { signal?: AbortSignal; near?: string } = {}
): Promise<{ configured: boolean; result: GeocodedAddress | null; error?: string }> {
  const query = composeAddressQuery(parts);
  const params = new URLSearchParams({ q: query, mode: "forward" });
  if (options.near?.trim()) params.set("near", options.near.trim());
  try {
    const body = await readLookup(`/api/geocode?${params.toString()}`, options.signal);
    return {
      configured: body.configured !== false,
      result: body.result ?? null,
      error: body.error,
    };
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    return { configured: true, result: null, error: "lookup_failed" };
  }
}

export async function reverseGeocodeCoordinates(
  coordinates: { lat: number; lng: number },
  options: { signal?: AbortSignal } = {}
): Promise<{ configured: boolean; result: GeocodedAddress | null; error?: string }> {
  const params = new URLSearchParams({
    mode: "reverse",
    lat: String(coordinates.lat),
    lng: String(coordinates.lng),
  });
  try {
    const body = await readLookup(`/api/geocode?${params.toString()}`, options.signal);
    return {
      configured: body.configured !== false,
      result: body.result ?? null,
      error: body.error,
    };
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    return { configured: true, result: null, error: "lookup_failed" };
  }
}

export async function resolveAddressPlace(
  placeId: string,
  options: { signal?: AbortSignal; sessionToken?: string } = {}
): Promise<{ configured: boolean; result: GeocodedAddress | null; error?: string }> {
  const params = new URLSearchParams({ placeId });
  if (options.sessionToken) params.set("sessionToken", options.sessionToken);
  try {
    const body = await readLookup(`/api/geocode?${params.toString()}`, options.signal);
    return {
      configured: body.configured !== false,
      result: body.result ?? null,
      error: body.error,
    };
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    return { configured: true, result: null, error: "lookup_failed" };
  }
}
