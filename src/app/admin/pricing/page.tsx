"use client";

import { AdminPortalShell } from "@/components/admin/AdminPortalShell";

export default function AdminPricingPage() {
  return (
    <AdminPortalShell pageTitle="Pricing & coupons" active="pricing">
      <div className="portal-page">
        <div className="ds-card max-w-lg">
          <div
            className="text-[18px] font-extrabold"
            style={{ color: "#000b49" }}
          >
            Pricing & coupons
          </div>
          <p className="text-meta mt-[8px]" style={{ color: "#9aa0a6" }}>
            Rate cards and coupon codes haven’t shipped yet. Checkout still
            accepts a promo code on the booking form.
          </p>
        </div>
      </div>
    </AdminPortalShell>
  );
}
