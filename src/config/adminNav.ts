import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarDays,
  ContactRound,
  LayoutGrid,
  MapPinned,
  Tag,
  Truck,
  Users,
} from "lucide-react";

/**
 * Ops admin navigation (E4).
 * Only items with `shipped: true` are rendered — never link to a 404.
 * Update `shipped` when the route lands.
 */
export type AdminNavKey =
  | "overview"
  | "bookings"
  | "assignments"
  | "technicians"
  | "clients"
  | "pricing"
  | "vehicles"
  | "analytics";

export type AdminNavItem = {
  key: AdminNavKey;
  label: string;
  href: string;
  /** When false, item is omitted from the sidebar (page not shipped yet). */
  shipped: boolean;
  /** Full-tier ops only; marketing-only never sees these. */
  fullAdminOnly: boolean;
  icon: LucideIcon;
  /** Pathname match for active state (detail pages included). */
  match: (pathname: string) => boolean;
};

export const ADMIN_OPS_NAV: AdminNavItem[] = [
  {
    key: "overview",
    label: "Overview",
    href: "/admin",
    shipped: true,
    fullAdminOnly: false,
    icon: LayoutGrid,
    match: (p) => p === "/admin" || p === "/admin/",
  },
  {
    key: "bookings",
    label: "Bookings",
    href: "/admin/bookings",
    shipped: true,
    fullAdminOnly: true,
    icon: CalendarDays,
    match: (p) => p.startsWith("/admin/bookings"),
  },
  {
    key: "assignments",
    label: "Assignments",
    href: "/admin/assignments",
    shipped: true,
    fullAdminOnly: true,
    icon: MapPinned,
    match: (p) => p.startsWith("/admin/assignments"),
  },
  {
    key: "technicians",
    label: "Technicians",
    href: "/admin/technicians",
    shipped: true,
    fullAdminOnly: true,
    icon: Users,
    match: (p) => p.startsWith("/admin/technicians"),
  },
  {
    key: "clients",
    label: "Clients",
    href: "/admin/clients",
    shipped: true,
    fullAdminOnly: true,
    icon: ContactRound,
    match: (p) => p.startsWith("/admin/clients"),
  },
  {
    key: "pricing",
    label: "Pricing & coupons",
    href: "/admin/pricing",
    shipped: true,
    fullAdminOnly: false,
    icon: Tag,
    match: (p) => p.startsWith("/admin/pricing"),
  },
  {
    key: "vehicles",
    label: "Vehicles",
    href: "/admin/vehicles",
    shipped: true,
    fullAdminOnly: true,
    icon: Truck,
    match: (p) => p.startsWith("/admin/vehicles"),
  },
  {
    key: "analytics",
    label: "Analytics",
    href: "/admin/analytics",
    shipped: true,
    fullAdminOnly: true,
    icon: BarChart3,
    match: (p) => p.startsWith("/admin/analytics"),
  },
];

export const ADMIN_PAGE_TITLES: Record<string, string> = {
  "/admin": "Overview",
  "/admin/bookings": "Bookings",
  "/admin/assignments": "Assignments",
  "/admin/technicians": "Technicians",
  "/admin/clients": "Clients",
  "/admin/pricing": "Pricing & coupons",
  "/admin/vehicles": "Vehicles",
  "/admin/analytics": "Analytics",
};

export function resolveAdminNavKey(pathname: string): AdminNavKey | null {
  const hit = ADMIN_OPS_NAV.find((item) => item.match(pathname));
  return hit?.key ?? null;
}

export function resolveAdminPageTitle(pathname: string): string {
  if (ADMIN_PAGE_TITLES[pathname]) return ADMIN_PAGE_TITLES[pathname];
  if (pathname.startsWith("/admin/bookings/")) return "Booking detail";
  for (const [prefix, title] of Object.entries(ADMIN_PAGE_TITLES)) {
    if (prefix !== "/admin" && pathname.startsWith(prefix)) return title;
  }
  return "Operations";
}

/** Sidebar items for the signed-in admin. Hidden until auth is ready (no ops flash). */
export function visibleAdminNavItems(opts: {
  ready: boolean;
  marketingOnly: boolean;
}): AdminNavItem[] {
  if (!opts.ready) return [];
  return ADMIN_OPS_NAV.filter((item) => {
    if (!item.shipped) return false;
    if (opts.marketingOnly && item.fullAdminOnly) return false;
    return true;
  });
}
