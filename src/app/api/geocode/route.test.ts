import { afterEach, describe, expect, it, vi } from "vitest";
import { clearGeocodeCache } from "@/lib/geocode/provider";
import { clearGeocodeRateLimit, GET } from "./route";

describe("GET /api/geocode", () => {
  afterEach(() => {
    clearGeocodeCache();
    clearGeocodeRateLimit();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reports that lookup is unavailable when no key is set", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "");
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    vi.stubEnv("MAPBOX_ACCESS_TOKEN", "");
    vi.stubEnv("GEOCODER_PROVIDER", "");

    const res = await GET(new Request("http://localhost/api/geocode"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ configured: false });

    const suggestions = await GET(
      new Request("http://localhost/api/geocode?q=10%20Beach%20Road")
    );
    expect(suggestions.status).toBe(200);
    expect(await suggestions.json()).toEqual({
      configured: false,
      suggestions: [],
    });
  });

  it("rejects a pin outside South Africa and does not leak the provider key", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "super-secret-key");
    const outside = await GET(
      new Request("http://localhost/api/geocode?mode=reverse&lat=40.7&lng=-74")
    );
    expect(outside.status).toBe(400);
    expect(await outside.json()).toEqual({ error: "Invalid coordinates" });

    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          status: "OK",
          results: [
            {
              place_id: "ChIJbeach",
              formatted_address:
                "10 Beach Road, Sea Point, Cape Town, 8005, South Africa",
              types: ["street_address"],
              geometry: { location: { lat: -33.91812, lng: 18.38451 } },
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
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchImpl);

    const res = await GET(
      new Request(
        "http://localhost/api/geocode?mode=reverse&lat=-33.91812&lng=18.38451"
      )
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(JSON.stringify(body)).not.toContain("super-secret-key");
    expect(body.result.addressLine1).toBe("10 Beach Road");
    expect(body.result.coordinates).toEqual({ lat: -33.91812, lng: 18.38451 });
  });

  it("rejects an oversized query", async () => {
    const res = await GET(
      new Request(`http://localhost/api/geocode?q=${"a".repeat(181)}`)
    );
    expect(res.status).toBe(400);
  });

  it("does not return the provider key", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "super-secret-key");
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
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
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchImpl);

    const res = await GET(
      new Request("http://localhost/api/geocode?q=10%20Beach%20Road%20Sea%20Point")
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(JSON.stringify(body)).not.toContain("super-secret-key");
    expect(body.suggestions[0].addressLine1).toBe("10 Beach Road");
    expect(body.suggestions[0].city).toBe("Cape Town");
  });
});
