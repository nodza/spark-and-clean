"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Search } from "lucide-react";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { SidebarNavGroup, SidebarNavItem } from "@/components/ui/sidebar-nav";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  ADMIN_OPS_NAV,
  type AdminNavKey,
  resolveAdminNavKey,
  resolveAdminPageTitle,
} from "@/config/adminNav";

export type { AdminNavKey };

function initials(name?: string, email?: string) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 1).toUpperCase();
}

function AdminUserFooter() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const displayName = user?.name || user?.email || "Admin";
  const roleLabel =
    user?.adminTier === "marketing-only" ? "Marketing" : "Admin";

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      router.replace("/admin/login");
    } catch {
      setLoggingOut(false);
    }
  };

  return (
    <div className="flex items-center gap-[11px]">
      <div
        className="flex size-[36px] flex-none items-center justify-center rounded-[8px] text-[14px] font-extrabold"
        style={{ background: "#ffdc39", color: "#000b49" }}
        aria-hidden
      >
        {initials(user?.name, user?.email)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold text-white">
          {displayName}
        </div>
        <div
          className="mt-[3px] text-[11px]"
          style={{ color: "rgba(255,255,255,.5)" }}
        >
          {roleLabel}
        </div>
      </div>
      <button
        type="button"
        onClick={() => void handleLogout()}
        disabled={loggingOut}
        aria-label="Log out"
        title="Log out"
        className="flex size-10 flex-none items-center justify-center rounded-[9px] text-white/55 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6cf3d5] disabled:cursor-wait disabled:opacity-60"
      >
        <LogOut size={18} strokeWidth={2} />
      </button>
    </div>
  );
}

/**
 * Ops admin chrome — sidebar nav on every /admin/* screen (except login).
 * Marketing-only admins never see the ops nav items (E6).
 */
export function AdminPortalShell({
  pageTitle,
  active,
  bookingsBadge,
  topbarActions,
  children,
}: {
  pageTitle?: string;
  /** Optional override; defaults from pathname. */
  active?: AdminNavKey;
  bookingsBadge?: number | string;
  topbarActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "/admin";
  const { user, ready } = useAuth();
  const isMarketingOnly = user?.adminTier === "marketing-only";

  const resolvedActive = active ?? resolveAdminNavKey(pathname) ?? undefined;
  const title = pageTitle ?? resolveAdminPageTitle(pathname);

  // E6: marketing-only never sees ops nav — including during auth load (no flash).
  // Full admins see shipped items once auth is ready.
  const visibleItems =
    !ready || isMarketingOnly
      ? []
      : ADMIN_OPS_NAV.filter((item) => item.shipped);

  const sidebar =
    visibleItems.length > 0 ? (
      <SidebarNavGroup label="OPERATIONS">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <SidebarNavItem
              key={item.key}
              icon={<Icon size={17} strokeWidth={1.8} />}
              label={item.label}
              href={item.href}
              active={resolvedActive === item.key}
              badge={item.key === "bookings" ? bookingsBadge : undefined}
            />
          );
        })}
      </SidebarNavGroup>
    ) : (
      <div className="px-[13px] py-[8px]" aria-busy={!ready}>
        <p className="text-[12px] leading-relaxed text-white/45">
          {!ready
            ? "Loading workspace…"
            : isMarketingOnly
              ? "Marketing workspace — ops screens are managed by full admins."
              : "No sections available."}
        </p>
      </div>
    );

  return (
    <PortalLayout
      portalLabel="OPERATIONS"
      portalLabelColor="#ffdc39"
      sidebar={sidebar}
      sidebarFooter={<AdminUserFooter />}
      pageTitle={title}
      topbarActions={topbarActions}
    >
      {children}
    </PortalLayout>
  );
}

export function AdminSearchTopbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search bookings, clients",
}: {
  /** When provided, wires the topbar search input (controlled). */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
} = {}) {
  const controlled = typeof onSearchChange === "function";
  return (
    <div className="flex min-w-0 items-center gap-[8px] sm:gap-[10px]">
      <div className="ds-search flex w-[min(220px,42vw)] sm:w-[min(280px,36vw)]">
        <Search size={13} className="flex-none" style={{ color: "#9aa0a6" }} />
        <input
          value={controlled ? (searchValue ?? "") : undefined}
          onChange={
            controlled ? (e) => onSearchChange(e.target.value) : undefined
          }
          placeholder={searchPlaceholder}
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#9aa0a6]"
          aria-label="Search bookings and clients"
        />
      </div>
      <Link href="/book/rug" className="flex-none">
        <button
          type="button"
          className="flex min-h-10 items-center gap-[8px] rounded-full px-[14px] py-[9px] text-[13px] font-extrabold text-white transition-colors duration-150 hover:bg-[#0a1a6b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#000b49]"
          style={{ background: "#000b49" }}
        >
          <span className="hidden sm:inline">+ New booking</span>
          <span className="sm:hidden">+ New</span>
        </button>
      </Link>
    </div>
  );
}

/** Explicit back link for detail screens — never router.back(). */
export function AdminBackLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-2 rounded-[9px] px-2 -ml-2 text-[13px] font-semibold text-[#000b49]/75 transition-colors hover:bg-[#f0f2f6] hover:text-[#000b49] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#000b49]"
    >
      <span aria-hidden="true">←</span>
      {label}
    </Link>
  );
}
