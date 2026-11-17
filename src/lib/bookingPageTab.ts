export type BookingPageTab = "tracking" | "items" | "invoice";

/** Deep link from a transactional email (`?tab=invoice`) or a checkout return. */
export function initialBookingTab(
  checkout: string | null,
  tab: string | null
): BookingPageTab {
  if (tab === "invoice" || tab === "items" || tab === "tracking") return tab;
  if (checkout === "success" || checkout === "cancel") return "invoice";
  return "tracking";
}
