"use client";

import Link from "next/link";
import {
  CalendarDays,
  LayoutGrid,
  Search,
  Tag,
  UserCog,
  Users,
} from "lucide-react";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { SidebarNavGroup, SidebarNavItem } from "@/components/ui/sidebar-nav";
import { useAuth } from "@/components/auth/AuthProvider";

export type AdminNavKey =
  | "overview"
  | "bookings"
  | "technicians"
  | "clients"
  | "pricing";

function initials(name?: string, email?: string) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function AdminUserFooter() {
  const { user } = useAuth();
  const label =
    user?.adminTier === "marketing-only"
      ? "Marketing admin"
      : "Operations manager";
  return (
    <div className="flex items-center gap-[11px]">
      <div
        className="flex size-[36px] flex-none items-center justify-center rounded-full text-[14px] font-extrabold"
        style={{ background: "#6cf3d5", color: "#000b49" }}
      >
        {initials(user?.name, user?.email)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="truncate text-[13px] font-bold text-white">
          {user?.name || user?.email || "Admin"}
        </div>
        <div
          className="mt-[3px] text-[11px]"
          style={{ color: "rgba(255,255,255,.5)" }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

export function AdminPortalShell({
  pageTitle,
  active,
  bookingsBadge,
  topbarActions,
  children,
}: {
  pageTitle: string;
  active: AdminNavKey;
  bookingsBadge?: number | string;
  topbarActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const isFullAdmin = user?.role === "admin" && user.adminTier === "full";

  const sidebar = (
    <SidebarNavGroup>
      <SidebarNavItem
        icon={<LayoutGrid size={17} strokeWidth={1.8} />}
        label="Overview"
        active={active === "overview"}
        href="/admin"
      />
      <SidebarNavItem
        icon={<CalendarDays size={17} strokeWidth={1.8} />}
        label="Bookings"
        badge={bookingsBadge}
        active={active === "bookings"}
        href="/admin/bookings"
      />
      {isFullAdmin ? (
        <SidebarNavItem
          icon={<UserCog size={17} strokeWidth={1.8} />}
          label="Technicians"
          active={active === "technicians"}
          href="/admin/technicians"
        />
      ) : null}
      <SidebarNavItem
        icon={<Users size={17} strokeWidth={1.8} />}
        label="Clients"
        active={active === "clients"}
      />
      <SidebarNavItem
        icon={<Tag size={17} strokeWidth={1.8} />}
        label="Pricing & coupons"
        active={active === "pricing"}
      />
    </SidebarNavGroup>
  );

  return (
    <PortalLayout
      portalLabel="OPERATIONS"
      portalLabelColor="#ffdc39"
      sidebar={sidebar}
      sidebarFooter={<AdminUserFooter />}
      pageTitle={pageTitle}
      topbarActions={topbarActions}
    >
      {children}
    </PortalLayout>
  );
}

export function AdminSearchTopbar() {
  return (
    <div className="flex items-center gap-[10px]">
      <div className="ds-search w-[260px]">
        <Search size={13} className="flex-none" style={{ color: "#9aa0a6" }} />
        <input
          placeholder="Search bookings, clients"
          className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#9aa0a6]"
        />
      </div>
      <Link href="/book/rug">
        <button
          className="flex items-center gap-[8px] rounded-full px-[16px] py-[9px] text-[13px] font-extrabold text-white transition-colors duration-150 hover:bg-[#0a1a6b]"
          style={{ background: "#000b49" }}
        >
          + New booking
        </button>
      </Link>
    </div>
  );
}
