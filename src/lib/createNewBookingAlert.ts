import { OpsAlert } from "@/models/OpsAlert";

/** Create a shared NEW_BOOKING ops alert after a booking is saved. In-app only. */
export async function createNewBookingAlert(booking: {
  id: string;
  customer?: { name?: string };
  suburb?: string;
}): Promise<void> {
  const id = `alert_${booking.id}_${Date.now()}`;
  const name = booking.customer?.name?.trim() || "Customer";
  const suburb = booking.suburb?.trim() || "—";

  await OpsAlert.create({
    id,
    type: "NEW_BOOKING",
    bookingId: booking.id,
    title: `New booking ${booking.id}`,
    meta: `${name} · ${suburb}`,
    dismissedAt: null,
  });
}
