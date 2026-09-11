"use client";

import * as React from "react";
import Image from "next/image";
import { Menu, X } from "lucide-react";
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
 * PortalLayout — 248px navy sidebar + sticky topbar + scrollable main.
 *
 * Desktop (lg+): fixed sidebar.
 * Narrow ops tablet / mobile: off-canvas drawer toggled from the topbar.
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
  const [navOpen, setNavOpen] = React.useState(false);
  const closeNav = React.useCallback(() => setNavOpen(false), []);

  React.useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeNav();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [navOpen, closeNav]);

  // Close drawer when viewport grows to desktop sidebar
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (mq.matches) setNavOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const sidebarInner = (
    <>
      <div
        className="flex-none px-[22px] pb-[20px] pt-[24px]"
        style={{ borderBottom: "1px solid rgba(255,255,255,.09)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <Image
            src="/uploads/spark-and-clean-22.png"
            alt="Spark & Clean"
            width={160}
            height={56}
            className="h-[56px] w-auto object-contain"
            priority
          />
          <button
            type="button"
            onClick={closeNav}
            className="lg:hidden -mr-1 -mt-1 flex size-11 flex-none items-center justify-center rounded-[9px] text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6cf3d5]"
            aria-label="Close navigation"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>
        <div
          className="mt-[12px] text-[10px] font-extrabold tracking-[0.2em] uppercase"
          style={{ color: portalLabelColor }}
        >
          {portalLabel}
        </div>
      </div>

      <nav
        className="flex-1 overflow-y-auto px-[12px] py-[18px]"
        aria-label="Portal"
        onClick={(e) => {
          // Close drawer after choosing a link (tablet / mobile)
          const t = e.target as HTMLElement | null;
          if (t?.closest("a[href]")) closeNav();
        }}
      >
        {sidebar}
      </nav>

      <div
        className="flex-none px-[18px] py-[15px]"
        style={{ borderTop: "1px solid rgba(255,255,255,.09)" }}
      >
        {sidebarFooter}
      </div>
    </>
  );

  return (
    <div
      className={cn("flex h-screen w-full overflow-hidden", className)}
      style={{ background: "#f5f7fa" }}
    >
      {/* Desktop sidebar */}
      <aside
        className="hidden h-full w-[248px] flex-none flex-col overflow-hidden lg:flex"
        style={{ background: "#000b49" }}
        aria-label="Primary"
      >
        {sidebarInner}
      </aside>

      {/* Tablet / mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-40 lg:hidden",
          navOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!navOpen}
      >
        <button
          type="button"
          className={cn(
            "absolute inset-0 bg-[#000b49]/40 transition-opacity duration-200",
            navOpen ? "opacity-100" : "opacity-0"
          )}
          aria-label="Dismiss navigation"
          tabIndex={navOpen ? 0 : -1}
          onClick={closeNav}
        />
        <aside
          id="portal-nav-drawer"
          className={cn(
            "absolute inset-y-0 left-0 flex w-[min(248px,88vw)] flex-col overflow-hidden shadow-2xl transition-transform duration-200 ease-out",
            navOpen ? "translate-x-0" : "-translate-x-full"
          )}
          style={{ background: "#000b49" }}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          {...(!navOpen ? { inert: true } : {})}
        >
          {sidebarInner}
        </aside>
      </div>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div
          className="z-10 flex flex-none items-center gap-3 bg-white px-4 py-[14px] sm:gap-4 sm:px-6 lg:px-[32px]"
          style={{
            borderBottom: "1px solid #e3e7ed",
            position: "sticky",
            top: 0,
          }}
        >
          <button
            type="button"
            className="lg:hidden flex size-11 flex-none items-center justify-center rounded-[9px] text-[#000b49] transition-colors hover:bg-[#f5f7fa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#000b49]"
            aria-label="Open navigation"
            aria-expanded={navOpen}
            aria-controls="portal-nav-drawer"
            onClick={() => setNavOpen(true)}
          >
            <Menu size={22} strokeWidth={2} />
          </button>
          <span className="min-w-0 flex-1 truncate text-[16px] font-extrabold text-[#000b49]">
            {pageTitle}
          </span>
          {topbarActions ? (
            <div className="flex min-w-0 flex-none items-center gap-[10px] overflow-x-auto">
              {topbarActions}
            </div>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
      </main>
    </div>
  );
}
