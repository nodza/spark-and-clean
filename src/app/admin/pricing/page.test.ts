import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CouponActions } from "./page";

describe("CouponActions", () => {
  it("uses icon-only action buttons without visible Edit/Delete labels", () => {
    const coupon = {
      id: "coupon-1",
      code: "SPRING10",
      type: "PERCENT" as const,
      value: 10,
      active: true,
      maxRedemptions: null,
      redeemedCount: 0,
      validFrom: null,
      validTo: null,
      city: null,
    };

    const html = renderToStaticMarkup(
      React.createElement(CouponActions, {
        coupon,
        busy: false,
        onToggle: () => undefined,
        onEdit: () => undefined,
        onDelete: () => undefined,
      })
    );

    expect(html).toContain('aria-label="Edit SPRING10"');
    expect(html).toContain('aria-label="Delete SPRING10"');
    expect(html).not.toContain(">Edit<");
    expect(html).not.toContain(">Delete<");
    expect(html).not.toContain('title="This coupon has been used"');
  });

  it("shows why delete is unavailable when the coupon has been used", () => {
    const coupon = {
      id: "coupon-1",
      code: "SPRING10",
      type: "PERCENT" as const,
      value: 10,
      active: true,
      maxRedemptions: null,
      redeemedCount: 1,
      validFrom: null,
      validTo: null,
      city: null,
      ownerName: null,
    };

    const html = renderToStaticMarkup(
      React.createElement(CouponActions, {
        coupon,
        busy: false,
        onToggle: () => undefined,
        onEdit: () => undefined,
        onDelete: () => undefined,
      })
    );

    expect(html).toContain('title="This coupon has been used"');
    expect(html).toContain("pointer-events-none");
  });
});
