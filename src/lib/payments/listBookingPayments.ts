import { connectDB } from "@/lib/mongodb";
import { Payment } from "@/models/Payment";

/** Newest gateway rows returned for one booking. */
export const ADMIN_BOOKING_PAYMENTS_LIMIT = 100;

export type AdminBookingReceipt = {
  id: string;
  provider: string;
  providerRef: string;
  kind: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
};

/**
 * Ledger rows for one booking, newest first.
 * Includes pending, failed, succeeded, and refunded transfers.
 */
export async function listPaymentsForBooking(
  bookingId: string
): Promise<AdminBookingReceipt[]> {
  const id = bookingId.trim();
  if (!id) return [];

  await connectDB();
  const docs = await Payment.find({ bookingId: id })
    .sort({ createdAt: -1 })
    .limit(ADMIN_BOOKING_PAYMENTS_LIMIT)
    .lean();

  return docs.map((doc) => {
    const raw = doc as Record<string, unknown>;
    const objectId =
      raw._id && typeof raw._id === "object" && "toString" in raw._id
        ? String((raw._id as { toString: () => string }).toString())
        : "";
    return {
      id: objectId || String(raw.providerRef || ""),
      provider: String(raw.provider || ""),
      providerRef: String(raw.providerRef || ""),
      kind: String(raw.kind || ""),
      amountCents: Number(raw.amountCents) || 0,
      currency: String(raw.currency || "ZAR"),
      status: String(raw.status || ""),
      createdAt: String(raw.createdAt || ""),
    };
  });
}
