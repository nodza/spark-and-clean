import { OpsAlert } from "@/models/OpsAlert";

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === 11000
  );
}

/** Create a shared NEW_BOOKING ops alert after a booking is saved. In-app only. */
export async function createNewBookingAlert(booking: {
  id: string;
  customer?: { name?: string };
  suburb?: string;
}): Promise<void> {
  const id = `alert_new_${booking.id}`;
  const name = booking.customer?.name?.trim() || "Customer";
  const suburb = booking.suburb?.trim() || "—";

  try {
    await OpsAlert.create({
      id,
      type: "NEW_BOOKING",
      bookingId: booking.id,
      title: `New booking ${booking.id}`,
      meta: `${name} · ${suburb}`,
      dismissedAt: null,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) return;
    throw err;
  }
}
