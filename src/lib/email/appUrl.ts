/**
 * Public origin for links inside emails.
 * APP_URL wins; Vercel previews fall back to VERCEL_URL.
 */
export function getAppBaseUrl(): string {
  const fromEnv = process.env.APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function bookingPageUrl(bookingId: string, tab?: "invoice" | "tracking"): string {
  const id = encodeURIComponent(bookingId.trim());
  const path = `${getAppBaseUrl()}/booking/${id}`;
  if (!tab || tab === "tracking") return path;
  return `${path}?tab=${tab}`;
}

export function adminBookingUrl(bookingId: string): string {
  return `${getAppBaseUrl()}/admin/bookings/${encodeURIComponent(bookingId.trim())}`;
}

export function techJobUrl(bookingId: string): string {
  return `${getAppBaseUrl()}/tech/job/${encodeURIComponent(bookingId.trim())}`;
}
