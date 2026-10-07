export type TechNavKey = "today" | "map" | "messages";

export type TechNavItem = {
  key: TechNavKey;
  label: string;
  href: string;
};

/**
 * Persistent phone tabs after a technician signs in.
 * Messages points at the field inbox (`/tech/messages`).
 */
export const TECH_BOTTOM_NAV: readonly TechNavItem[] = [
  { key: "today", label: "Today", href: "/tech/dashboard" },
  { key: "map", label: "Map", href: "/tech/map" },
  { key: "messages", label: "Messages", href: "/tech/messages" },
];

export function techNavKeyForPath(pathname: string): TechNavKey | null {
  if (
    pathname === "/tech/dashboard" ||
    pathname.startsWith("/tech/job/")
  ) {
    return "today";
  }
  if (pathname === "/tech/map" || pathname.startsWith("/tech/map/")) {
    return "map";
  }
  if (
    pathname === "/tech/messages" ||
    pathname.startsWith("/tech/messages/")
  ) {
    return "messages";
  }
  return null;
}
