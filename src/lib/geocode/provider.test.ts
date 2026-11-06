import { afterEach, describe, expect, it, vi } from "vitest";
import {
  attachGeocodedCoordinates,
  clearGeocodeCache,
  forwardGeocode,
  reverseGeocode,
  suggestAddresses,
} from "@/lib/geocode/provider";

const emptyEnv = {
  GEOCODER_PROVIDER: "",
  GOOGLE_MAPS_API_KEY: "",
  GOOGLE_PLACES_API_KEY: "",
  MAPBOX_ACCESS_TOKEN: "",
} as unknown as NodeJS.ProcessEnv;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("geocoder provider", () => {
  afterEach(() => {
    clearGeocodeCache();
  });

  it("does not call the network when no key is configured", async () => {
    const fetchImpl = vi.fn();
    const suggestions = await suggestAddresses(
      { query: "10 Beach Road Sea Point" },
      fetchImpl,
      emptyEnv
    );
    const forward = await forwardGeocode(
      { query: "10 Beach Road, Sea Point, Cape Town, South Africa" },
      fetchImpl,
      emptyEnv
    );
    expect(suggestions).toEqual({ configured: false, suggestions: [] });
    expect(forward).toEqual({ configured: false, result: null });
    const reverse = await reverseGeocode(
      { lat: -33.91812, lng: 18.38451 },
      fetchImpl,
      emptyEnv
    );
    expect(reverse).toEqual({ configured: false, result: null });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("asks Google for South African suggestions and geocodes the same address twice to the same pin", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("places:autocomplete")) {
        const body = JSON.parse(String(init?.body));
        expect(body.includedRegionCodes).toEqual(["za"]);
        expect(body.regionCode).toBe("za");
        return jsonResponse({
          suggestions: [
            {
              placePrediction: {
                placeId: "ChIJbeach",
                text: { text: "10 Beach Road, Sea Point, Cape Town, South Africa" },
                structuredFormat: {
                  mainText: { text: "10 Beach Road" },
                  secondaryText: { text: "Sea Point, Cape Town, South Africa" },
                },
              },
            },
          ],
        });
      }
      const geocodeUrl = new URL(url);
      expect(geocodeUrl.searchParams.get("components")).toBe("country:ZA");
      expect(geocodeUrl.searchParams.get("region")).toBe("za");
      expect(geocodeUrl.searchParams.get("key")).toBe("test-google-key");
      return jsonResponse({
        status: "OK",
        results: [
          {
            place_id: "ChIJbeach",
            formatted_address: "10 Beach Road, Sea Point, Cape Town, 8005, South Africa",
            types: ["street_address"],
            geometry: { location: { lat: -33.9181204, lng: 18.3845104 } },
            address_components: [
              { long_name: "10", types: ["street_number"] },
              { long_name: "Beach Road", types: ["route"] },
              { long_name: "Sea Point", types: ["sublocality_level_1"] },
              { long_name: "Cape Town", types: ["locality"] },
              { long_name: "South Africa", short_name: "ZA", types: ["country"] },
              { long_name: "8005", types: ["postal_code"] },
            ],
          },
        ],
      });
    });

    const env = { ...emptyEnv, GOOGLE_MAPS_API_KEY: "test-google-key" };
    const suggestions = await suggestAddresses(
      { query: "10 Beach Road" },
      fetchImpl,
      env
    );
    expect(suggestions.configured).toBe(true);
    expect(suggestions.suggestions[0]).toMatchObject({
      placeId: "ChIJbeach",
      addressLine1: "10 Beach Road",
      suburb: "Sea Point",
      city: "Cape Town",
    });
    expect(suggestions.suggestions[0]?.coordinates).toBeUndefined();

    const query = "10 Beach Road, Sea Point, Cape Town, 8005, South Africa";
    const first = await forwardGeocode({ query }, fetchImpl, env);
    const second = await forwardGeocode({ query }, fetchImpl, env);
    expect(first.result).toEqual(second.result);
    expect(first.result?.coordinates).toEqual({ lat: -33.91812, lng: 18.38451 });
    expect(first.result?.postalCode).toBe("8005");
    const geocodeCalls = fetchImpl.mock.calls.filter(([called]) =>
      String(called).includes("/geocode/json")
    );
    expect(geocodeCalls).toHaveLength(1);
  });

  it("limits Mapbox results to South Africa and keeps address-level pins", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      expect(url.searchParams.get("country")).toBe("za");
      expect(url.searchParams.get("access_token")).toBe("test-mapbox-token");
      return jsonResponse({
        features: [
          {
            geometry: { coordinates: [28.0472, -26.107] },
            properties: {
              mapbox_id: "addr-rivonia",
              feature_type: "address",
              name: "12 Rivonia Road",
              full_address: "12 Rivonia Road, Sandton, Johannesburg, 2196, South Africa",
              coordinates: { latitude: -26.107, longitude: 28.0472 },
              context: {
                address: { name: "12 Rivonia Road" },
                neighborhood: { name: "Sandton" },
                postcode: { name: "2196" },
                place: { name: "Johannesburg" },
                region: { name: "Gauteng" },
                country: { country_code: "ZA", name: "South Africa" },
              },
            },
          },
        ],
      });
    });

    const looked = await forwardGeocode(
      { query: "12 Rivonia Road, Sandton, Johannesburg, South Africa" },
      fetchImpl,
      { ...emptyEnv, MAPBOX_ACCESS_TOKEN: "test-mapbox-token" }
    );
    expect(looked.result).toMatchObject({
      addressLine1: "12 Rivonia Road",
      suburb: "Sandton",
      city: "Johannesburg",
      postalCode: "2196",
      coordinates: { lat: -26.107, lng: 28.0472 },
    });
  });

  it("reads a dropped South African pin back into a street and keeps that pin", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      expect(url.searchParams.get("latlng")).toBe("-33.91812,18.38451");
      expect(url.searchParams.get("key")).toBe("test-google-key");
      return jsonResponse({
        status: "OK",
        results: [
          {
            place_id: "ChIJbeach",
            formatted_address:
              "10 Beach Road, Sea Point, Cape Town, 8005, South Africa",
            types: ["street_address"],
            geometry: { location: { lat: -33.91801, lng: 18.3844 } },
            address_components: [
              { long_name: "10", types: ["street_number"] },
              { long_name: "Beach Road", types: ["route"] },
              { long_name: "Sea Point", types: ["sublocality_level_1"] },
              { long_name: "Cape Town", types: ["locality"] },
              { long_name: "South Africa", short_name: "ZA", types: ["country"] },
              { long_name: "8005", types: ["postal_code"] },
            ],
          },
        ],
      });
    });

    const env = { ...emptyEnv, GOOGLE_MAPS_API_KEY: "test-google-key" };
    const first = await reverseGeocode(
      { lat: -33.9181204, lng: 18.3845104 },
      fetchImpl,
      env
    );
    const second = await reverseGeocode(
      { lat: -33.91812, lng: 18.38451 },
      fetchImpl,
      env
    );
    expect(first.result).toEqual(second.result);
    expect(first.result).toMatchObject({
      addressLine1: "10 Beach Road",
      suburb: "Sea Point",
      city: "Cape Town",
      postalCode: "8005",
      coordinates: { lat: -33.91812, lng: 18.38451 },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const outside = await reverseGeocode(
      { lat: 40.7, lng: -74 },
      fetchImpl,
      env
    );
    expect(outside).toEqual({ configured: true, result: null });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("reverse geocodes a dropped pin with Mapbox and stays inside South Africa", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      expect(url.pathname).toContain("/reverse");
      expect(url.searchParams.get("country")).toBe("za");
      expect(url.searchParams.get("latitude")).toBe("-26.107");
      expect(url.searchParams.get("longitude")).toBe("28.0472");
      return jsonResponse({
        features: [
          {
            geometry: { coordinates: [28.0471, -26.1069] },
            properties: {
              mapbox_id: "addr-rivonia",
              feature_type: "address",
              name: "12 Rivonia Road",
              full_address:
                "12 Rivonia Road, Sandton, Johannesburg, 2196, South Africa",
              coordinates: { latitude: -26.1069, longitude: 28.0471 },
              context: {
                address: { name: "12 Rivonia Road" },
                neighborhood: { name: "Sandton" },
                postcode: { name: "2196" },
                place: { name: "Johannesburg" },
                region: { name: "Gauteng" },
                country: { country_code: "ZA", name: "South Africa" },
              },
            },
          },
        ],
      });
    });

    const looked = await reverseGeocode(
      { lat: -26.107, lng: 28.0472 },
      fetchImpl,
      { ...emptyEnv, MAPBOX_ACCESS_TOKEN: "test-mapbox-token" }
    );
    expect(looked.result).toMatchObject({
      addressLine1: "12 Rivonia Road",
      suburb: "Sandton",
      city: "Johannesburg",
      postalCode: "2196",
      coordinates: { lat: -26.107, lng: 28.0472 },
    });
  });

  it("leaves coordinates unset when lookup is unavailable, and keeps a real pin", async () => {
    const payload: Record<string, unknown> = {
      addressLine1: "10 Beach Road",
      suburb: "Sea Point",
      city: "Cape Town",
      coordinates: { lat: 0, lng: 0 },
      coordinatesManual: true,
    };
    await attachGeocodedCoordinates(payload, vi.fn(), emptyEnv);
    expect(payload.coordinates).toBeUndefined();
    expect(payload.coordinatesManual).toBeUndefined();

    const fetchImpl = vi.fn();
    const pinned: Record<string, unknown> = {
      addressLine1: "10 Beach Road",
      suburb: "Sea Point",
      city: "Cape Town",
      coordinates: { lat: -33.91812, lng: 18.38451 },
    };
    await attachGeocodedCoordinates(pinned, fetchImpl, {
      ...emptyEnv,
      GOOGLE_MAPS_API_KEY: "test-google-key",
    });
    expect(pinned.coordinates).toEqual({ lat: -33.91812, lng: 18.38451 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("geocodes a typed address on save when the booking has no pin", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        status: "OK",
        results: [
          {
            place_id: "ChIJbeach",
            types: ["street_address"],
            geometry: { location: { lat: -33.91812, lng: 18.38451 } },
            address_components: [
              { long_name: "10", types: ["street_number"] },
              { long_name: "Beach Road", types: ["route"] },
              { long_name: "Sea Point", types: ["sublocality"] },
              { long_name: "Cape Town", types: ["locality"] },
              { long_name: "South Africa", short_name: "ZA", types: ["country"] },
              { long_name: "8005", types: ["postal_code"] },
            ],
          },
        ],
      })
    );
    const payload: Record<string, unknown> = {
      addressLine1: "10 Beach Road",
      suburb: "Sea Point",
      city: "Cape Town",
    };
    await attachGeocodedCoordinates(payload, fetchImpl, {
      ...emptyEnv,
      GOOGLE_MAPS_API_KEY: "test-google-key",
    });
    expect(payload.coordinates).toEqual({ lat: -33.91812, lng: 18.38451 });
    expect(payload.postalCode).toBe("8005");
    expect(payload.addressLine1).toBe("10 Beach Road");
  });
});
