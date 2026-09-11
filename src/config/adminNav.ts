import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarDays,
  LayoutGrid,
  MapPinned,
  Truck,
  Users,
} from "lucide-react";

/**
 * Ops admin navigation (E4).
 * Only items with `shipped: true` are rendered — never link to a 404.
 * Update `shipped` when the route lands.
 */
export type AdminNavKey =
  | "dashboard"
  | "bookings"
  | "today"
  | "technicians"
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
    key: "dashboard",
    label: "Dashboard",
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
    key: "today",
    label: "Today",
    href: "/admin/assignments",
    shipped: false,
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
    match: (p) =>
      p.startsWith("/admin/technicians"),
  },
  {
    key: "vehicles",
    label: "Vehicles",
    href: "/admin/vehicles",
    shipped: false,
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
  "/admin": "Dashboard",
  "/admin/bookings": "Bookings",
  "/admin/assignments": "Today",
  "/admin/technicians": "Technicians",
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
