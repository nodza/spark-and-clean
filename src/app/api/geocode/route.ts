import { NextResponse } from "next/server";
import {
  cleanPlaceId,
  cleanSearchQuery,
  cleanSessionToken,
  preciseCoordinates,
} from "@/lib/geocode/address";
import {
  forwardGeocode,
  isGeocoderConfigured,
  resolvePlace,
  reverseGeocode,
  suggestAddresses,
} from "@/lib/geocode/provider";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 40;
const hits = new Map<string, number[]>();

export function clearGeocodeRateLimit(): void {
  hits.clear();
}

export function allowGeocodeRequest(ip: string, now = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return request.headers.get("x-real-ip")?.trim() || "local";
}

function readAxis(value: string | null): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!/^-?\d{1,3}(\.\d+)?$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function noStore(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Address search for the booking form.
 * The provider key is read on the server and is never returned.
 *
 * - no query: `{ configured }`
 * - `?q=` suggestions in Cape Town and Gauteng
 * - `?q=&mode=forward` one geocoded address
 * - `?placeId=` coordinates and address parts for a suggestion
 * - `?mode=reverse&lat=&lng=` street address for a pin dropped in South Africa
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode")?.trim().toLowerCase() ?? "";
  const near = url.searchParams.get("near")?.slice(0, 40) ?? "";
  const sessionToken = cleanSessionToken(url.searchParams.get("sessionToken") ?? "");
  const rawPlace = url.searchParams.get("placeId");
  const rawQuery = url.searchParams.get("q");

  if (rawPlace != null && rawPlace.trim() && !cleanPlaceId(rawPlace)) {
    return noStore({ error: "Invalid place" }, 400);
  }
  if (rawQuery != null && rawQuery.trim().length > 180) {
    return noStore({ error: "Address is too long" }, 400);
  }

  const placeId = rawPlace ? cleanPlaceId(rawPlace) : null;
  const query = rawQuery ? cleanSearchQuery(rawQuery) : null;
  const wantsReverse = mode === "reverse";
  const dropped = wantsReverse
    ? preciseCoordinates(
        readAxis(url.searchParams.get("lat")) ?? Number.NaN,
        readAxis(url.searchParams.get("lng")) ?? Number.NaN
      )
    : null;
  if (wantsReverse && !dropped) {
    return noStore({ error: "Invalid coordinates" }, 400);
  }
  const wantsLookup = Boolean(placeId || query || mode === "forward" || wantsReverse);

  if (!wantsLookup) {
    return noStore({ configured: isGeocoderConfigured() });
  }

  if (!allowGeocodeRequest(clientIp(request))) {
    return noStore(
      {
        configured: isGeocoderConfigured(),
        suggestions: [],
        result: null,
        error: "rate_limited",
      },
      429
    );
  }

  if (placeId) {
    const resolved = await resolvePlace({ placeId, sessionToken });
    return noStore({
      configured: resolved.configured,
      result: resolved.result,
      ...(resolved.error ? { error: resolved.error } : {}),
    });
  }

  if (wantsReverse && dropped) {
    const looked = await reverseGeocode({ lat: dropped.lat, lng: dropped.lng });
    return noStore({
      configured: looked.configured,
      result: looked.result,
      ...(looked.error ? { error: looked.error } : {}),
    });
  }

  if (mode === "forward") {
    const looked = await forwardGeocode({ query: query ?? "", near });
    return noStore({
      configured: looked.configured,
      result: looked.result,
      ...(looked.error ? { error: looked.error } : {}),
    });
  }

  const suggestions = await suggestAddresses({
    query: query ?? "",
    near,
    sessionToken,
  });
  return noStore({
    configured: suggestions.configured,
    suggestions: suggestions.suggestions,
    ...(suggestions.error ? { error: suggestions.error } : {}),
  });
}
