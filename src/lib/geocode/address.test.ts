import { describe, expect, it } from "vitest";
import {
  addressFromComponents,
  addressFromMapboxFeature,
  assignSuburbAndCity,
  centroidCoordinates,
  composeAddressQuery,
  enrichFreeTextAddress,
  parseAddressString,
  preciseCoordinates,
  suggestionFromPrediction,
} from "@/lib/geocode/address";
import * as addressAutocomplete from "@/lib/addressAutocomplete";

const beachComponents = [
  { longText: "10", types: ["street_number"] },
  { longText: "Beach Road", types: ["route"] },
  { longText: "Sea Point", types: ["sublocality_level_1", "sublocality"] },
  { longText: "Cape Town", types: ["locality", "political"] },
  { longText: "Western Cape", types: ["administrative_area_level_1"] },
  { longText: "South Africa", shortText: "ZA", types: ["country", "political"] },
  { longText: "8005", types: ["postal_code"] },
];

describe("parseAddressString", () => {
  it("splits street, suburb, city, and postal code", () => {
    expect(parseAddressString("10 Beach Road, Sea Point, Cape Town, 8005")).toMatchObject({
      addressLine1: "10 Beach Road",
      suburb: "Sea Point",
      city: "Cape Town",
      postalCode: "8005",
    });
  });

  it("treats a known suburb as the suburb when the city is omitted", () => {
    expect(parseAddressString("12 Rivonia Road, Sandton")).toMatchObject({
      addressLine1: "12 Rivonia Road",
      suburb: "Sandton",
      city: "Johannesburg",
    });
  });

  it("returns null when there is no suburb", () => {
    expect(parseAddressString("10 Beach Road")).toBeNull();
  });
});

describe("enrichFreeTextAddress", () => {
  it("fills suburb and city typed into the street field", () => {
    expect(
      enrichFreeTextAddress({
        addressLine1: "10 Beach Road, Sea Point, Cape Town",
      })
    ).toMatchObject({
      addressLine1: "10 Beach Road",
      suburb: "Sea Point",
      city: "Cape Town",
    });
  });

  it("leaves an address that already has suburb and city alone", () => {
    expect(
      enrichFreeTextAddress({
        addressLine1: "10 Beach Road",
        suburb: "Sea Point",
        city: "Cape Town",
      })
    ).toEqual({});
  });
});

describe("assignSuburbAndCity", () => {
  it("moves a known suburb out of the city field", () => {
    expect(assignSuburbAndCity("", "Sandton")).toEqual({
      suburb: "Sandton",
      city: "Johannesburg",
    });
    expect(assignSuburbAndCity("Sea Point", "Cape Town", "Western Cape")).toEqual({
      suburb: "Sea Point",
      city: "Cape Town",
    });
  });

  it("keeps Pretoria instead of folding it into Johannesburg", () => {
    expect(assignSuburbAndCity("Hatfield", "Pretoria", "Gauteng")).toEqual({
      suburb: "Hatfield",
      city: "Pretoria",
    });
  });
});

describe("addressFromComponents", () => {
  it("stores the street, suburb, city, postal code, and a stable pin", () => {
    const first = addressFromComponents({
      placeId: "ChIJbeach",
      components: beachComponents,
      latitude: -33.9181204,
      longitude: 18.3845104,
      formattedAddress: "10 Beach Road, Sea Point, Cape Town, 8005, South Africa",
      types: ["street_address"],
    });
    const second = addressFromComponents({
      placeId: "ChIJbeach",
      components: beachComponents,
      latitude: -33.9181204,
      longitude: 18.3845104,
      types: ["street_address"],
    });

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      addressLine1: "10 Beach Road",
      suburb: "Sea Point",
      city: "Cape Town",
      postalCode: "8005",
      coordinates: { lat: -33.91812, lng: 18.38451 },
    });
  });

  it("rejects a result outside South Africa", () => {
    expect(
      addressFromComponents({
        placeId: "outside",
        components: [
          { long_name: "10 Downing Street", types: ["route"] },
          { long_name: "London", types: ["locality"] },
          { short_name: "GB", long_name: "United Kingdom", types: ["country"] },
        ],
        latitude: 51.5034,
        longitude: -0.1276,
        types: ["street_address"],
      })
    ).toBeNull();
  });

  it("keeps a Pretoria street and rejects places outside Cape Town and Gauteng", () => {
    expect(
      addressFromComponents({
        placeId: "pretoria",
        components: [
          { long_name: "12", types: ["street_number"] },
          { long_name: "Burnett Street", types: ["route"] },
          { long_name: "Hatfield", types: ["sublocality_level_1"] },
          { long_name: "Pretoria", types: ["locality"] },
          {
            long_name: "City of Tshwane Metropolitan Municipality",
            types: ["administrative_area_level_2"],
          },
          { long_name: "Gauteng", types: ["administrative_area_level_1"] },
          { short_name: "ZA", long_name: "South Africa", types: ["country"] },
        ],
        latitude: -25.7486,
        longitude: 28.2381,
        types: ["street_address"],
      })
    ).toMatchObject({
      addressLine1: "12 Burnett Street",
      suburb: "Hatfield",
      city: "Pretoria",
    });

    expect(
      addressFromComponents({
        placeId: "benoni",
        components: [
          { long_name: "5", types: ["street_number"] },
          { long_name: "Ampthill Avenue", types: ["route"] },
          { long_name: "Benoni", types: ["locality"] },
          { long_name: "Ekurhuleni", types: ["administrative_area_level_2"] },
          { long_name: "Gauteng", types: ["administrative_area_level_1"] },
          { short_name: "ZA", long_name: "South Africa", types: ["country"] },
        ],
        latitude: -26.1885,
        longitude: 28.3207,
        types: ["street_address"],
      })
    ).toMatchObject({ city: "Benoni", addressLine1: "5 Ampthill Avenue" });

    expect(
      addressFromComponents({
        placeId: "somerset",
        components: [
          { long_name: "8", types: ["street_number"] },
          { long_name: "Church Street", types: ["route"] },
          { long_name: "Somerset West", types: ["locality"] },
          { long_name: "City of Cape Town", types: ["administrative_area_level_2"] },
          { long_name: "Western Cape", types: ["administrative_area_level_1"] },
          { short_name: "ZA", long_name: "South Africa", types: ["country"] },
        ],
        latitude: -34.078,
        longitude: 18.843,
        types: ["street_address"],
      })
    ).toMatchObject({ city: "Somerset West" });

    expect(
      addressFromComponents({
        placeId: "durban",
        components: [
          { long_name: "1", types: ["street_number"] },
          { long_name: "Florida Road", types: ["route"] },
          { long_name: "Durban", types: ["locality"] },
          { long_name: "KwaZulu-Natal", types: ["administrative_area_level_1"] },
          { short_name: "ZA", long_name: "South Africa", types: ["country"] },
        ],
        latitude: -29.8587,
        longitude: 31.0218,
        types: ["street_address"],
      })
    ).toBeNull();

    expect(
      addressFromComponents({
        placeId: "stellenbosch",
        components: [
          { long_name: "1", types: ["street_number"] },
          { long_name: "Dorp Street", types: ["route"] },
          { long_name: "Stellenbosch", types: ["locality"] },
          { long_name: "Stellenbosch Local Municipality", types: ["administrative_area_level_2"] },
          { long_name: "Western Cape", types: ["administrative_area_level_1"] },
          { short_name: "ZA", long_name: "South Africa", types: ["country"] },
        ],
        latitude: -33.9321,
        longitude: 18.8602,
        types: ["street_address"],
      })
    ).toBeNull();
  });

  it("rejects a city-only result so the suburb centre can be used instead", () => {
    expect(
      addressFromComponents({
        placeId: "city",
        components: [
          { long_name: "Cape Town", types: ["locality"] },
          { short_name: "ZA", long_name: "South Africa", types: ["country"] },
        ],
        latitude: -33.9249,
        longitude: 18.4241,
        types: ["locality", "political"],
      })
    ).toBeNull();
  });
});

describe("addressFromMapboxFeature", () => {
  const feature = {
    geometry: { coordinates: [18.38451, -33.91812] },
    properties: {
      mapbox_id: "addr-beach",
      feature_type: "address",
      name: "10 Beach Road",
      full_address: "10 Beach Road, Sea Point, Cape Town, 8005, South Africa",
      context: {
        address: { name: "10 Beach Road" },
        street: { name: "Beach Road" },
        neighborhood: { name: "Sea Point" },
        postcode: { name: "8005" },
        place: { name: "Cape Town" },
        region: { name: "Western Cape" },
        country: { country_code: "ZA", name: "South Africa" },
      },
    },
  };

  it("reads a South African address and repeats the same coordinates", () => {
    const first = addressFromMapboxFeature(feature);
    const second = addressFromMapboxFeature(feature);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      placeId: "addr-beach",
      addressLine1: "10 Beach Road",
      suburb: "Sea Point",
      city: "Cape Town",
      postalCode: "8005",
      coordinates: { lat: -33.91812, lng: 18.38451 },
    });
  });

  it("drops a city-level feature", () => {
    expect(
      addressFromMapboxFeature({
        properties: {
          feature_type: "place",
          name: "Cape Town",
          coordinates: { latitude: -33.9249, longitude: 18.4241 },
          context: { country: { country_code: "ZA" } },
        },
      })
    ).toBeNull();
  });
});

describe("suggestionFromPrediction", () => {
  it("previews suburb and city before place details load", () => {
    expect(
      suggestionFromPrediction({
        placeId: "ChIJbeach",
        primary: "10 Beach Road",
        secondary: "Sea Point, Cape Town, South Africa",
        label: "10 Beach Road, Sea Point, Cape Town, South Africa",
      })
    ).toMatchObject({
      addressLine1: "10 Beach Road",
      suburb: "Sea Point",
      city: "Cape Town",
      label: "10 Beach Road, Sea Point, Cape Town",
    });
  });
});

describe("centroid fallback", () => {
  it("is the fixed suburb centre, and the same address always matches", () => {
    const first = centroidCoordinates("Sea Point", "Cape Town");
    const second = centroidCoordinates("sea point", "Cape Town");
    expect(first).toEqual({ lat: -33.9167, lng: 18.3833 });
    expect(second).toEqual(first);
    expect(preciseCoordinates(first.lat, first.lng)).toEqual(first);
  });
});

describe("composeAddressQuery", () => {
  it("adds South Africa once", () => {
    expect(
      composeAddressQuery({
        addressLine1: "10 Beach Road",
        suburb: "Sea Point",
        city: "Cape Town",
        postalCode: "8005",
      })
    ).toBe("10 Beach Road, Sea Point, Cape Town, 8005, South Africa");
  });
});

describe("addressAutocomplete client module", () => {
  it("does not export the old random geocoder", () => {
    expect(addressAutocomplete).not.toHaveProperty("mockGeocodeForCity");
    expect(addressAutocomplete).not.toHaveProperty("geocodeSelectedAddress");
  });
});
