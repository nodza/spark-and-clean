import { describe, expect, it } from "vitest";
import { TECH_BOTTOM_NAV, techNavKeyForPath } from "@/config/techNav";

describe("TECH_BOTTOM_NAV", () => {
  it("keeps Today, Map, and Messages reachable", () => {
    expect(TECH_BOTTOM_NAV.map((tab) => [tab.label, tab.href])).toEqual([
      ["Today", "/tech/dashboard"],
      ["Map", "/tech/map"],
      ["Messages", "/tech/messages"],
    ]);
  });
});

describe("techNavKeyForPath", () => {
  it("treats a job as part of Today", () => {
    expect(techNavKeyForPath("/tech/dashboard")).toBe("today");
    expect(techNavKeyForPath("/tech/job/SC-100")).toBe("today");
  });

  it("highlights Map and Messages on their routes", () => {
    expect(techNavKeyForPath("/tech/map")).toBe("map");
    expect(techNavKeyForPath("/tech/messages")).toBe("messages");
  });

  it("does not claim profile or completed", () => {
    expect(techNavKeyForPath("/tech/profile")).toBeNull();
    expect(techNavKeyForPath("/tech/completed")).toBeNull();
  });
});
