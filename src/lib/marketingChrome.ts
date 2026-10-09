const IMMERSIVE_PREFIXES = [
  "/admin",
  "/dashboard",
  "/portal",
  "/tech",
  "/booking",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/signup",
] as const;

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Full-screen app routes that own their chrome.
 * Includes the technician app (`/tech`, `/tech/*`), same outcome as `/booking/*`.
 */
export function isImmersiveAppPath(pathname: string) {
  return IMMERSIVE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

/** Public booking wizard. Header stays; marketing footer does not. */
export function isBookingMarketingPath(pathname: string) {
  return pathname === "/book" || pathname.startsWith("/book/");
}

export function hidesMarketingHeader(pathname: string) {
  return isImmersiveAppPath(pathname);
}

export function hidesMarketingFooter(pathname: string) {
  return hidesMarketingHeader(pathname) || isBookingMarketingPath(pathname);
}
