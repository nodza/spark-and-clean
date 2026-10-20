import { describe, expect, it } from "vitest";
import {
  clientCity,
  clientDirectoryFilter,
  clientIsInactive,
  clientMatchesSearch,
  CLIENT_DIRECTORY_SELECT,
  directoryWindow,
  toClientDirectoryRow,
} from "@/lib/clientDirectory";

describe("toClientDirectoryRow", () => {
  it("keeps a switched-off client and leaves missing phone and city blank", () => {
    const row = toClientDirectoryRow({
      _id: "client-off",
      role: "client",
      name: "Ada Lovelace",
      email: "ada@example.com",
      disabledAt: new Date("2026-01-01T00:00:00.000Z"),
      passwordHash: "secret-hash",
      password: "plaintext",
      mustChangePassword: true,
      sessionsInvalidatedAt: new Date(),
    });

    expect(row).toEqual({
      id: "client-off",
      name: "Ada Lovelace",
      phone: "",
      email: "ada@example.com",
      city: "",
      inactive: true,
    });
  });

  it("marks isActive false as inactive even without disabledAt", () => {
    expect(
      clientIsInactive({ isActive: false, disabledAt: null })
    ).toBe(true);
    const row = toClientDirectoryRow({
      _id: "legacy",
      role: "CUSTOMER",
      email: "legacy@example.com",
      isActive: false,
    });
    expect(row?.inactive).toBe(true);
    expect(row?.phone).toBe("");
    expect(row?.city).toBe("");
  });

  it("uses preferred city, then the default address city", () => {
    expect(
      clientCity({
        preferredCity: "Cape Town",
        addresses: [{ city: "Johannesburg", isDefault: true }],
      })
    ).toBe("Cape Town");
    expect(
      clientCity({
        preferredCity: "  ",
        addresses: [
          { city: "Johannesburg", isDefault: false },
          { city: "Cape Town", isDefault: true },
        ],
      })
    ).toBe("Cape Town");
    expect(clientCity({})).toBe("");
  });

  it("drops office staff and drivers", () => {
    expect(
      toClientDirectoryRow({
        _id: "admin",
        role: "admin",
        email: "admin@sparkandclean.co.za",
        name: "Spark Admin (Full)",
      })
    ).toBeNull();
    expect(
      toClientDirectoryRow({
        _id: "driver",
        role: "technician",
        email: "thabo@sparkandclean.co.za",
        name: "Thabo Mbeki",
        driverProfileId: "driver_1",
      })
    ).toBeNull();
  });

  it("does not select password fields", () => {
    expect(CLIENT_DIRECTORY_SELECT).not.toMatch(/password/i);
    expect(CLIENT_DIRECTORY_SELECT).not.toMatch(/sessionsInvalidatedAt/);
  });
});

describe("client search", () => {
  const ada = {
    name: "Ada Lovelace",
    phone: "082 555 1234",
    email: "ada@example.com",
  };
  const noPhone = { name: "No Phone", phone: "", email: "nophone@example.com" };

  it("matches part of a name, phone, or email and keeps people with a blank phone", () => {
    expect(clientMatchesSearch(ada, "love")).toBe(true);
    expect(clientMatchesSearch(ada, "555")).toBe(true);
    expect(clientMatchesSearch(ada, "082555")).toBe(true);
    expect(clientMatchesSearch(ada, "ADA@")).toBe(true);
    expect(clientMatchesSearch(ada, "nomatch")).toBe(false);
    expect(clientMatchesSearch(noPhone, "")).toBe(true);
    expect(clientMatchesSearch(noPhone, "nophone")).toBe(true);
  });

  it("lists every client role and does not filter on login or disabled state", () => {
    const filter = clientDirectoryFilter("  Sarah  ");
    expect(filter.role).toEqual({ $in: ["client", "CUSTOMER"] });
    expect(filter).not.toHaveProperty("disabledAt");
    expect(filter).not.toHaveProperty("lastLoginAt");
    expect(filter).not.toHaveProperty("isActive");
    const or = filter.$or as Record<string, RegExp>[];
    expect(or.map((clause) => Object.keys(clause)[0])).toEqual([
      "name",
      "phone",
      "email",
    ]);
    expect(or[0].name.test("sarah jenkins")).toBe(true);
  });

  it("matches a spaced phone number from the digits alone", () => {
    const filter = clientDirectoryFilter("082555");
    const or = filter.$or as Record<string, RegExp>[];
    expect(or[1].phone.test("082 555 1234")).toBe(false);
    expect(or[3].phone.test("082 555 1234")).toBe(true);
  });

  it("returns the unfiltered client role when the search is empty", () => {
    expect(clientDirectoryFilter("   ")).toEqual({
      role: { $in: ["client", "CUSTOMER"] },
    });
  });
});

describe("directoryWindow", () => {
  it("pages through the list and clamps a page past the end", () => {
    expect(directoryWindow(25, { page: 2, limit: 10 })).toEqual({
      page: 2,
      limit: 10,
      skip: 10,
    });
    expect(directoryWindow(5, { page: 9, limit: 10 })).toEqual({
      page: 1,
      limit: 10,
      skip: 0,
    });
    expect(directoryWindow(0, { page: 1, limit: 10 })).toEqual({
      page: 1,
      limit: 10,
      skip: 0,
    });
  });
});
