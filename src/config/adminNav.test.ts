import { describe, expect, it } from "vitest";
import { visibleAdminNavItems } from "@/config/adminNav";

describe("visibleAdminNavItems", () => {
  it("hides all items until auth is ready", () => {
    expect(
      visibleAdminNavItems({ ready: false, marketingOnly: false })
    ).toEqual([]);
  });

  it("shows shipped marketing-safe items to marketing-only admins", () => {
    expect(
      visibleAdminNavItems({ ready: true, marketingOnly: true }).map((i) => i.key)
    ).toEqual(["overview", "pricing"]);
  });

  it("shows all shipped items to full admins", () => {
    expect(
      visibleAdminNavItems({ ready: true, marketingOnly: false }).map((i) => i.key)
    ).toEqual([
      "overview",
      "bookings",
      "assignments",
      "technicians",
      "clients",
      "pricing",
      "analytics",
    ]);
  });
});
