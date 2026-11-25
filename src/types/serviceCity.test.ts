import { describe, expect, it } from "vitest";
import {
  formatServiceAreaLabel,
  normalizeServiceCity,
  SERVICE_CITIES,
} from "@/types/user";

describe("SERVICE_CITIES", () => {
  it("lists Gauteng and Cape Town", () => {
    expect(SERVICE_CITIES).toEqual(["Gauteng", "Cape Town"]);
  });
});

describe("normalizeServiceCity", () => {
  it("maps Johannesburg aliases to Gauteng", () => {
    expect(normalizeServiceCity("Gauteng")).toBe("Gauteng");
    expect(normalizeServiceCity("Johannesburg")).toBe("Gauteng");
    expect(normalizeServiceCity("jhb")).toBe("Gauteng");
    expect(normalizeServiceCity("Cape Town")).toBe("Cape Town");
    expect(normalizeServiceCity("Pretoria")).toBeNull();
  });
});

describe("formatServiceAreaLabel", () => {
  it("shows Gauteng for legacy Johannesburg and leaves other towns", () => {
    expect(formatServiceAreaLabel("Johannesburg")).toBe("Gauteng");
    expect(formatServiceAreaLabel("Pretoria")).toBe("Pretoria");
    expect(formatServiceAreaLabel("Cape Town")).toBe("Cape Town");
  });
});
