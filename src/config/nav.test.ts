import { describe, expect, it } from "vitest";
import {
  getMarketingDesktopNavItems,
  getMarketingMobileMenuItems,
  getMarketingNavItems,
  isMarketingNavAction,
} from "@/config/nav";

describe("getMarketingDesktopNavItems", () => {
  it("shows core links only while auth is not ready", () => {
    expect(getMarketingDesktopNavItems({ ready: false }).map((i) => i.id)).toEqual([
      "home",
      "services",
      "contact",
    ]);
  });

  it("adds Login when logged out", () => {
    expect(
      getMarketingDesktopNavItems({ ready: true, role: null }).map((i) => i.id)
    ).toEqual(["home", "services", "contact", "login"]);
  });

  it("adds My Bookings for clients (not Sign up / Log out)", () => {
    expect(
      getMarketingDesktopNavItems({ ready: true, role: "client" }).map((i) => i.id)
    ).toEqual(["home", "services", "contact", "portal"]);
  });

  it("shows only core links for staff", () => {
    expect(
      getMarketingDesktopNavItems({ ready: true, role: "admin" }).map((i) => i.id)
    ).toEqual(["home", "services", "contact"]);
  });
});

describe("getMarketingNavItems / mobile menu", () => {
  it("includes login, signup, and view booking when logged out", () => {
    expect(getMarketingNavItems({ ready: true, role: null }).map((i) => i.id)).toEqual([
      "home",
      "services",
      "contact",
      "login",
      "signup",
      "view-booking",
    ]);
  });

  it("includes logout for clients and staff", () => {
    const client = getMarketingNavItems({ ready: true, role: "client" });
    expect(client.map((i) => i.id)).toEqual([
      "home",
      "services",
      "contact",
      "portal",
      "logout",
    ]);
    expect(isMarketingNavAction(client.at(-1)!)).toBe(true);

    expect(
      getMarketingNavItems({ ready: true, role: "technician" }).map((i) => i.id)
    ).toEqual(["home", "services", "contact", "logout"]);
  });

  it("includes book in the mobile menu list", () => {
    const items = getMarketingMobileMenuItems({ ready: true, role: null });
    expect(items.map((i) => i.id)).toContain("book");
  });
});
