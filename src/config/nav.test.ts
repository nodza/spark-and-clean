import { describe, expect, it } from "vitest";
import {
  getMarketingDesktopNavItems,
  getMarketingMobileMenuItems,
  getMarketingNavItems,
  getWorkspaceNavLink,
  isMarketingNavAction,
} from "@/config/nav";

describe("getWorkspaceNavLink", () => {
  it("sends each role to their home workspace", () => {
    expect(getWorkspaceNavLink("client")).toMatchObject({
      href: "/portal",
      label: "My Bookings",
    });
    expect(getWorkspaceNavLink("admin")).toMatchObject({
      href: "/admin",
      label: "Dashboard",
    });
    expect(getWorkspaceNavLink("technician")).toMatchObject({
      href: "/tech/dashboard",
      label: "Dashboard",
    });
  });
});

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

  it("adds My Bookings for clients", () => {
    expect(
      getMarketingDesktopNavItems({ ready: true, role: "client" }).map((i) => i.id)
    ).toEqual(["home", "services", "contact", "portal"]);
  });

  it("adds Dashboard for admin and technician", () => {
    expect(
      getMarketingDesktopNavItems({ ready: true, role: "admin" }).map((i) => i.id)
    ).toEqual(["home", "services", "contact", "workspace"]);
    expect(
      getMarketingDesktopNavItems({ ready: true, role: "technician" }).map(
        (i) => i.id
      )
    ).toEqual(["home", "services", "contact", "workspace"]);
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

  it("includes workspace + logout for clients and staff", () => {
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
    ).toEqual(["home", "services", "contact", "workspace", "logout"]);

    expect(
      getMarketingNavItems({ ready: true, role: "admin" }).map((i) => i.id)
    ).toEqual(["home", "services", "contact", "workspace", "logout"]);
  });

  it("includes book in the mobile menu list", () => {
    const items = getMarketingMobileMenuItems({ ready: true, role: null });
    expect(items.map((i) => i.id)).toContain("book");
  });
});
