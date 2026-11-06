import { describe, expect, it } from "vitest";
import {
  CAPE_TOWN_BOUNDS,
  GAUTENG_BOUNDS,
  biasForText,
  coordinateInCollectionArea,
  isOutsideCollectionPlace,
  textMayBeOutsideCollectionArea,
} from "@/lib/serviceArea";

describe("collection area", () => {
  it("covers Gauteng towns and the Cape Town metro, not the rest of the country", () => {
    expect(coordinateInCollectionArea(-25.7479, 28.2293)).toBe(true);
    expect(coordinateInCollectionArea(-26.1885, 28.3207)).toBe(true);
    expect(coordinateInCollectionArea(-26.6731, 27.9261)).toBe(true);
    expect(coordinateInCollectionArea(-34.078, 18.843)).toBe(true);
    expect(coordinateInCollectionArea(-33.9249, 18.4241)).toBe(true);
    expect(coordinateInCollectionArea(-34.193, 18.433)).toBe(true);
    expect(coordinateInCollectionArea(-33.9321, 18.8602)).toBe(false);
    expect(coordinateInCollectionArea(-29.8587, 31.0218)).toBe(false);
  });

  it("biases a Gauteng town to the province and a Cape Town town to the metro", () => {
    expect(biasForText("Hatfield, Pretoria")).toEqual(GAUTENG_BOUNDS);
    expect(biasForText("Somerset West")).toEqual(CAPE_TOWN_BOUNDS);
    expect(biasForText("10 Main Road")).toBeNull();
  });

  it("blocks known cities outside the area and keeps Gauteng and Cape Town names", () => {
    expect(isOutsideCollectionPlace("Durban")).toBe(true);
    expect(isOutsideCollectionPlace("Stellenbosch")).toBe(true);
    expect(isOutsideCollectionPlace("Pretoria")).toBe(false);
    expect(isOutsideCollectionPlace("Centurion")).toBe(false);
    expect(isOutsideCollectionPlace("Khayelitsha")).toBe(false);
    expect(textMayBeOutsideCollectionArea("1 Florida Road, Durban")).toBe(true);
    expect(
      textMayBeOutsideCollectionArea("12 Burnett Street, Hatfield, Pretoria")
    ).toBe(false);
  });
});
