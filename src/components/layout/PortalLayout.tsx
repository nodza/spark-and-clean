import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface PortalLayoutProps {
  /** "CLIENT PORTAL" | "OPERATIONS" etc. — eyebrow below logo */
  portalLabel: string;
  /** Color of portalLabel text — teal (#6cf3d5) for client, yellow (#ffdc39) for admin */
  portalLabelColor?: string;
  /** Sidebar nav items and groups */
  sidebar: React.ReactNode;
  /** User footer (avatar + name + optional logout) */
  sidebarFooter: React.ReactNode;
  /** Page title shown in the sticky topbar */
  pageTitle: string;
  /** Optional topbar right slot (search bar, action button, etc.) */
  topbarActions?: React.ReactNode;
  /** Page content */
  children: React.ReactNode;
  className?: string;
}

/**
 * PortalLayout — Fixed 248px navy sidebar + sticky topbar + scrollable main.
 *
 * Spec (Admin Portal.dc.html, Client Portal.dc.html):
 *   Sidebar    248px wide (unified), background #000b49
 *   Topbar     sticky, white, 1px #e3e7ed border-bottom, padding 14px 32px
 *   Main bg    #f5f7fa
 *   Page pad   28px 32px 56px (via .portal-page on child)
 */
export function PortalLayout({
  portalLabel,
  portalLabelColor = "#6cf3d5",
  sidebar,
  sidebarFooter,
  pageTitle,
  topbarActions,
  children,
  className,
}: PortalLayoutProps) {
  return (
    <div className={cn("flex h-screen w-full overflow-hidden", className)} style={{ background: "#f5f7fa" }}>
      {/* ─── Sidebar ──────────────────────────────────────────────────────── */}
      <aside
        className="flex h-full flex-col overflow-hidden flex-none"
        style={{ width: 248, background: "#000b49" }}
      >
        {/* Logo + label */}
        <div className="flex-none px-[22px] pb-[20px] pt-[24px]" style={{ borderBottom: "1px solid rgba(255,255,255,.09)" }}>
          <Image
            src="/uploads/spark-and-clean-22.png"
            alt="Spark & Clean"
            width={160}
            height={56}
            className="h-[56px] w-auto object-contain"
            priority
          />
          <div
            className="mt-[12px] text-[10px] font-extrabold tracking-[0.2em] uppercase"
            style={{ color: portalLabelColor }}
          >
            {portalLabel}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-[12px] py-[18px]">
          {sidebar}
        </nav>

        {/* User footer */}
        <div
          className="flex-none px-[18px] py-[15px]"
          style={{ borderTop: "1px solid rgba(255,255,255,.09)" }}
        >
          {sidebarFooter}
        </div>
      </aside>

      {/* ─── Main area ────────────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Sticky topbar */}
        <div
          className="z-10 flex flex-none items-center gap-4 bg-white px-[32px] py-[14px]"
          style={{ borderBottom: "1px solid #e3e7ed", position: "sticky", top: 0 }}
        >
          <span className="flex-1 text-[16px] font-extrabold text-[#000b49]">{pageTitle}</span>
          {topbarActions}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
