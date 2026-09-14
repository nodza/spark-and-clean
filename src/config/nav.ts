import type { UserRole } from "@/types/user";

/**
 * Marketing chrome nav (SCW-34).
 * Shared source of truth for desktop nav and mobile menu.
 * Never includes /admin or /tech.
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

/**
 * Desktop center nav (historical layout):
 * Home / Services / Contact + Login (logged out) or My Bookings (client).
 * Sign up / Log out / View My Booking stay in the CTA strip or mobile menu.
 */
export function getMarketingDesktopNavItems({
  ready,
  role,
}: MarketingNavAuthInput): MarketingNavLink[] {
  const items: MarketingNavLink[] = [...MARKETING_CORE_LINKS];
  if (!ready) return items;

  if (role === "client") {
    items.push({
      id: "portal",
      label: "My Bookings",
      href: "/portal",
      emphasize: true,
    });
    return items;
  }

  if (role === "admin" || role === "technician") {
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

  if (role === "client") {
    return [
      {
        id: "portal",
        label: "My Bookings",
        href: "/portal",
        emphasize: true,
      },
      { id: "logout", label: "Log out", action: "logout" },
    ];
  }

  if (role === "admin" || role === "technician") {
    return [{ id: "logout", label: "Log out", action: "logout" }];
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
