import type { UserRole } from "@/types/user";
import { homeForRole } from "@/lib/accessControl";

/**
 * Marketing chrome nav (SCW-34).
 * Shared source of truth for desktop nav and mobile menu.
 * Anonymous visitors never see /admin or /tech.
 * Signed-in staff get a clear path back to their workspace from Home.
 */

export type MarketingNavLink = {
  id: string;
  label: string;
  href: string;
  emphasize?: boolean;
};

export type MarketingNavAction = {
  id: "logout";
  label: string;
  action: "logout";
};

export type MarketingNavItem = MarketingNavLink | MarketingNavAction;

export function isMarketingNavAction(
  item: MarketingNavItem
): item is MarketingNavAction {
  return "action" in item;
}

/** Always shown on marketing pages for every audience. */
export const MARKETING_CORE_LINKS: readonly MarketingNavLink[] = [
  { id: "home", label: "Home", href: "/" },
  {
    id: "services",
    label: "Services",
    href: "/services/automatic-rug-cleaning",
  },
  { id: "contact", label: "Contact", href: "/contact" },
] as const;

/** Primary booking CTA — kept outside the mobile drawer on the header bar. */
export const MARKETING_BOOK_CTA: MarketingNavLink = {
  id: "book",
  label: "Book a Collection",
  href: "/book/rug",
};

type MarketingNavAuthInput = {
  ready: boolean;
  role?: UserRole | null;
};

/** Signed-in workspace entry shown on the marketing header / Home. */
export function getWorkspaceNavLink(
  role: UserRole
): MarketingNavLink {
  if (role === "admin") {
    return {
      id: "workspace",
      label: "Dashboard",
      href: homeForRole("admin"),
      emphasize: true,
    };
  }
  if (role === "technician") {
    return {
      id: "workspace",
      label: "Dashboard",
      href: homeForRole("technician"),
      emphasize: true,
    };
  }
  return {
    id: "portal",
    label: "My Bookings",
    href: homeForRole("client"),
    emphasize: true,
  };
}

/**
 * Desktop center nav (historical layout):
 * Home / Services / Contact + Login (logged out) or workspace link (signed in).
 * Sign up / Log out / View My Booking stay in the CTA strip or mobile menu.
 */
export function getMarketingDesktopNavItems({
  ready,
  role,
}: MarketingNavAuthInput): MarketingNavLink[] {
  const items: MarketingNavLink[] = [...MARKETING_CORE_LINKS];
  if (!ready) return items;

  if (role === "client" || role === "admin" || role === "technician") {
    items.push(getWorkspaceNavLink(role));
    return items;
  }

  items.push({ id: "login", label: "Login", href: "/login" });
  return items;
}

/**
 * Auth-dependent items for the mobile drawer (and shared auth rules).
 * Empty while `!ready` to avoid flash.
 */
export function getMarketingAuthNavItems({
  ready,
  role,
}: MarketingNavAuthInput): MarketingNavItem[] {
  if (!ready) return [];

  if (role === "client" || role === "admin" || role === "technician") {
    return [
      getWorkspaceNavLink(role),
      { id: "logout", label: "Log out", action: "logout" },
    ];
  }

  return [
    { id: "login", label: "Login", href: "/login" },
    { id: "signup", label: "Sign up", href: "/signup" },
    { id: "view-booking", label: "View My Booking", href: "/login" },
  ];
}

/** Full role-filtered list excluding Book CTA. */
export function getMarketingNavItems(
  input: MarketingNavAuthInput
): MarketingNavItem[] {
  return [...MARKETING_CORE_LINKS, ...getMarketingAuthNavItems(input)];
}

/** Mobile drawer list including Book (matches acceptance criteria). */
export function getMarketingMobileMenuItems(
  input: MarketingNavAuthInput
): MarketingNavItem[] {
  return [...getMarketingNavItems(input), MARKETING_BOOK_CTA];
}
