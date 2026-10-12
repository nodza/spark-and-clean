import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DUPLICATE_COUPON_MESSAGE,
  formatCouponDate,
  formatCouponDiscount,
  formatCouponUses,
  formatCouponWindow,
  couponApplyError,
  couponClaimOwner,
  couponFormFieldErrors,
  inactiveCouponMessage,
  isDuplicateCouponCode,
  sanitizeCouponActivePatch,
  sanitizeCouponCreate,
} from "@/lib/coupon";

describe("sanitizeCouponCreate", () => {
  it("stores SPARK10 as a 10% coupon and keeps the letter case", () => {
    const parsed = sanitizeCouponCreate({
      code: " SPARK10 ",
      type: "PERCENT",
      value: 10,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.coupon).toMatchObject({
      code: "SPARK10",
      type: "PERCENT",
      value: 10,
      active: true,
      maxRedemptions: null,
      validFrom: null,
      validTo: null,
      city: null,
    });
  });

  it("rejects a code that checkout would not accept", () => {
    const parsed = sanitizeCouponCreate({
      code: "SPARK 10",
      type: "PERCENT",
      value: 10,
    });
    expect(parsed).toEqual({
      ok: false,
      error: "Code must be 2–32 letters or numbers",
    });
  });

  it("rejects percent outside 1–100 and non-integers", () => {
    expect(
      sanitizeCouponCreate({ code: "SPARK10", type: "PERCENT", value: 0 }).ok
    ).toBe(false);
    expect(
      sanitizeCouponCreate({ code: "SPARK10", type: "PERCENT", value: 101 }).ok
    ).toBe(false);
    expect(
      sanitizeCouponCreate({ code: "SPARK10", type: "PERCENT", value: 10.5 }).ok
    ).toBe(false);
  });

  it("accepts a fixed rand amount in cents and an optional city", () => {
    const parsed = sanitizeCouponCreate({
      code: "CAPE50",
      type: "FIXED_CENTS",
      value: 5000,
      city: "Cape Town",
      maxRedemptions: 25,
      active: false,
      validFrom: "2026-10-01",
      validTo: "2026-10-31",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.coupon.value).toBe(5000);
    expect(parsed.coupon.city).toBe("Cape Town");
    expect(parsed.coupon.maxRedemptions).toBe(25);
    expect(parsed.coupon.active).toBe(false);
    expect(parsed.coupon.validFrom?.toISOString()).toBe(
      "2026-10-01T12:00:00.000Z"
    );
    expect(parsed.coupon.validTo?.toISOString()).toBe(
      "2026-10-31T12:00:00.000Z"
    );
  });

  it("rejects an end date before the start date", () => {
    const parsed = sanitizeCouponCreate({
      code: "SPARK10",
      type: "PERCENT",
      value: 10,
      validFrom: "2026-11-01",
      validTo: "2026-10-01",
    });
    expect(parsed).toEqual({
      ok: false,
      error: "Valid to must be on or after valid from",
    });
  });
});

describe("coupon display", () => {
  it("formats percent, cents, and the validity window", () => {
    expect(formatCouponUses(0, null)).toBe("0 used");
    expect(formatCouponUses(2, 17)).toBe("2/17");
    expect(formatCouponDiscount("PERCENT", 10)).toBe("10%");
    expect(formatCouponDiscount("FIXED_CENTS", 1050)).toBe("R10.50");
    expect(formatCouponDate("2026-09-30T12:00:00.000Z")).toBe("30/09/2026");
    expect(formatCouponWindow(null, null)).toBe("Always");
    expect(
      formatCouponWindow(
        "2026-09-30T12:00:00.000Z",
        "2026-11-30T12:00:00.000Z"
      )
    ).toBe("30/09/2026 - 30/11/2026");
  });
});

describe("inactive coupons", () => {
  it("requires an active catalogue coupon", () => {
    expect(inactiveCouponMessage(false)).toBe("This coupon is no longer active");
    expect(couponApplyError(null)).toBe("That coupon code isn't valid");
    expect(couponApplyError({ active: false })).toBe(
      "This coupon is no longer active"
    );
    expect(couponApplyError({ active: true })).toBeNull();
  });

  it("rejects a code outside its dates, city, or redemption cap", () => {
    const now = new Date("2026-10-15T12:00:00.000Z");
    expect(
      couponApplyError(
        { active: true, validFrom: "2026-11-01T12:00:00.000Z" },
        { now }
      )
    ).toBe("This coupon isn't valid until 01/11/2026");
    expect(
      couponApplyError(
        { active: true, validTo: "2026-09-30T12:00:00.000Z" },
        { now }
      )
    ).toBe("This coupon has expired");
    expect(
      couponApplyError(
        { active: true, city: "Cape Town" },
        { now, city: "Johannesburg" }
      )
    ).toBe(
      "This coupon isn't valid in Johannesburg. It only applies in Cape Town."
    );
    expect(
      couponApplyError({ active: true, city: "Cape Town" }, { now, city: "" })
    ).toBe("This coupon only applies in Cape Town.");
    expect(
      couponApplyError(
        { active: true, city: "Cape Town" },
        { now, city: "cape town" }
      )
    ).toBeNull();
    expect(
      couponApplyError(
        { active: true, maxRedemptions: 10, redeemedCount: 10 },
        { now }
      )
    ).toBe("This coupon has been fully used (10/10)");
    expect(
      couponApplyError(
        { active: true, maxRedemptions: 1, redeemedCount: 1 },
        { now }
      )
    ).toBe("This coupon has been fully used (1/1)");
  });

  it("lets only the owner preview a personal reward code", () => {
    const sarah = "507f1f77bcf86cd799439011";
    const other = "507f1f77bcf86cd799439012";
    const personal = { active: true, ownerUserId: sarah };
    expect(couponApplyError(personal, { userId: other })).toBe(
      "That coupon code isn't valid"
    );
    expect(couponApplyError(personal)).toBe("That coupon code isn't valid");
    expect(couponApplyError(personal, { userId: sarah })).toBeNull();
    expect(couponApplyError({ active: true, ownerUserId: null })).toBeNull();
    expect(couponApplyError({ active: true })).toBeNull();
  });

  it("claims a personal code only for its owner and a catalogue code only with no owner", () => {
    const sarah = "507f1f77bcf86cd799439011";
    const other = "507f1f77bcf86cd799439012";
    expect(couponClaimOwner({ active: true }, null)).toEqual({
      ownerUserId: null,
    });
    expect(couponClaimOwner({ active: true, ownerUserId: sarah }, sarah)).toEqual({
      ownerUserId: sarah,
    });
    expect(couponClaimOwner({ active: true, ownerUserId: sarah }, other)).toBeNull();
    expect(couponClaimOwner({ active: true, ownerUserId: sarah }, null)).toBeNull();
  });

  it("accepts an active flag on update", () => {
    expect(sanitizeCouponActivePatch({ active: false })).toEqual({
      ok: true,
      active: false,
    });
    expect(sanitizeCouponActivePatch({ active: "no" }).ok).toBe(false);
  });
});

describe("coupon form validation", () => {
  it("surfaces field errors for the admin create modal", () => {
    expect(
      couponFormFieldErrors({
        code: "A",
        type: "PERCENT",
        value: "",
        maxRedemptions: "0",
        validFrom: "2026-11-01",
        validTo: "2026-10-01",
      })
    ).toEqual({
      code: "Code must be 2–32 letters or numbers",
      value: "Value is required",
      maxRedemptions: "Max redemptions must be a positive whole number",
      validTo: "Valid to must be on or after valid from",
    });
    expect(
      couponFormFieldErrors({
        code: "SPARK10",
        type: "PERCENT",
        value: "10",
        maxRedemptions: "",
        validFrom: "",
        validTo: "",
      })
    ).toEqual({});
  });
});

describe("duplicate coupon codes", () => {
  it("recognises a Mongo unique-index error", () => {
    expect(isDuplicateCouponCode({ code: 11000 })).toBe(true);
    expect(isDuplicateCouponCode({ cause: { code: 11000 } })).toBe(true);
    expect(isDuplicateCouponCode(new Error("nope"))).toBe(false);
    expect(DUPLICATE_COUPON_MESSAGE).toMatch(/already exists/);
  });
});

describe("coupon seed script", () => {
  it("defines SPARK10 at 10% outside the Next bundle", () => {
    const root = path.resolve(__dirname, "../..");
    const seed = readFileSync(path.join(root, "scripts/seed-coupons.cjs"), "utf8");
    expect(seed).toContain('code: "SPARK10"');
    expect(seed).toContain('type: "PERCENT"');
    expect(seed).toMatch(/value:\s*10/);

    const pkg = JSON.parse(
      readFileSync(path.join(root, "package.json"), "utf8")
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts["seed:coupons"]).toContain("scripts/seed-coupons.cjs");
    expect(pkg.scripts.seed).toContain("scripts/seed-coupons.cjs");

    const page = readFileSync(
      path.join(root, "src/app/admin/pricing/page.tsx"),
      "utf8"
    );
    expect(page).not.toContain("mongoose");
    expect(page).not.toContain("Coupon.create");
  });
});
