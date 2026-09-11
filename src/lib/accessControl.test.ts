import { describe, expect, it } from "vitest";
import {
  canAccessPath,
  homeForRole,
  isAdminFullOnlyPath,
  resolvePostLoginPath,
} from "@/lib/accessControl";
import type { SessionUser } from "@/lib/sessionJwt";

const client: SessionUser = {
  id: "c1",
  email: "a@b.com",
  role: "client",
};
const adminFull: SessionUser = {
  id: "a1",
  email: "admin@b.com",
  role: "admin",
  adminTier: "full",
};
const adminMarketing: SessionUser = {
  id: "a2",
  email: "mkt@b.com",
  role: "admin",
  adminTier: "marketing-only",
};
const tech: SessionUser = {
  id: "t1",
  email: "tech@b.com",
  role: "technician",
  driverProfileId: "driver_1",
};

describe("accessControl", () => {
  it("maps role homes", () => {
    expect(homeForRole("client")).toBe("/portal");
    expect(homeForRole("admin")).toBe("/admin");
    expect(homeForRole("technician")).toBe("/tech/dashboard");
  });

  it("marks admin full-only paths", () => {
    expect(isAdminFullOnlyPath("/admin/analytics")).toBe(true);
    expect(isAdminFullOnlyPath("/admin/bookings/x")).toBe(true);
    expect(isAdminFullOnlyPath("/admin/technicians")).toBe(true);
    expect(isAdminFullOnlyPath("/admin/assignments")).toBe(true);
    expect(isAdminFullOnlyPath("/admin/vehicles")).toBe(true);
    expect(isAdminFullOnlyPath("/admin")).toBe(false);
  });

  it("redirects anonymous users to the right login with next=", () => {
    const adminHit = canAccessPath(null, "/admin");
    expect(adminHit.ok).toBe(false);
    if (!adminHit.ok) expect(adminHit.redirectTo).toContain("/admin/login?next=");

    const techHit = canAccessPath(null, "/tech/dashboard");
    expect(techHit.ok).toBe(false);
    if (!techHit.ok) expect(techHit.redirectTo).toContain("/tech/login?next=");

    expect(canAccessPath(null, "/admin/login").ok).toBe(true);
    expect(canAccessPath(null, "/tech/login").ok).toBe(true);
  });

  it("sends wrong-role users to their own home", () => {
    const hit = canAccessPath(client, "/admin");
    expect(hit.ok).toBe(false);
    if (!hit.ok) expect(hit.redirectTo).toContain("/portal");
  });

  it("denies marketing-only admin on full-only routes", () => {
    const hit = canAccessPath(adminMarketing, "/admin/analytics");
    expect(hit.ok).toBe(false);
    if (!hit.ok) expect(hit.redirectTo).toContain("/admin?access=denied");

    expect(canAccessPath(adminMarketing, "/admin").ok).toBe(true);
    expect(canAccessPath(adminFull, "/admin/analytics").ok).toBe(true);
  });

  it("honors next= only when role allows", () => {
    expect(resolvePostLoginPath("client", "/admin")).toBe("/portal");
    expect(resolvePostLoginPath("admin", "/admin/analytics", "full")).toBe(
      "/admin/analytics"
    );
    expect(
      resolvePostLoginPath("admin", "/admin/analytics", "marketing-only")
    ).toBe("/admin?access=denied");
    expect(resolvePostLoginPath("technician", "/tech/job/1")).toBe(
      "/tech/job/1"
    );
    expect(resolvePostLoginPath("client", "/portal")).toBe("/portal");
  });

  it("allows public login routes", () => {
    expect(canAccessPath(null, "/login").ok).toBe(true);
    expect(canAccessPath(null, "/admin/login").ok).toBe(true);
    expect(canAccessPath(null, "/tech/login").ok).toBe(true);
    expect(canAccessPath(null, "/tech").ok).toBe(true);
    expect(canAccessPath(null, "/signup").ok).toBe(true);
    expect(canAccessPath(null, "/book/rug").ok).toBe(true);
  });

  it("redirects /dashboard to /portal", () => {
    const hit = canAccessPath(client, "/dashboard");
    expect(hit.ok).toBe(false);
    if (!hit.ok) expect(hit.redirectTo).toBe("/portal");
  });

  it("allows technicians on tech app paths", () => {
    expect(canAccessPath(tech, "/tech/dashboard").ok).toBe(true);
  });
});
