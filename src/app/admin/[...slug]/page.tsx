"use client";

import Link from "next/link";
import {
  AdminPortalShell,
} from "@/components/admin/AdminPortalShell";

/**
 * Catch-all for unknown /admin/* deep links.
 * Keeps ops chrome visible instead of a blank marketing 404.
 * More specific routes (bookings, analytics, technicians, login) win.
 */
export default function AdminUnknownDeepLink() {
  return (
    <AdminPortalShell pageTitle="Page not found">
      <div className="portal-page">
        <div className="ds-card max-w-lg">
          <div
            className="text-[18px] font-extrabold"
            style={{ color: "#000b49" }}
          >
            This ops page isn’t available
          </div>
          <p className="text-meta mt-[8px]" style={{ color: "#9aa0a6" }}>
            The link may be outdated, or this section hasn’t shipped yet. Use
            the sidebar to move between live ops screens.
          </p>
          <Link
            href="/admin"
            className="mt-[18px] inline-flex min-h-11 items-center rounded-full px-[18px] text-[13px] font-extrabold text-white transition-colors hover:bg-[#0a1a6b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#000b49]"
            style={{ background: "#000b49" }}
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </AdminPortalShell>
  );
}
