import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { Payment } from "@/models/Payment";

export const CLIENT_PAYMENT_HISTORY_LIMIT = 200;

export type ClientPaymentRow = {
  id: string;
  createdAt: string;
  bookingId: string;
  kind: string;
  amountCents: number;
  currency: string;
  provider: string;
  status: string;
};

/**
 * Linked account, or the same email while the booking is still unclaimed.
 * Matches clientOwnsBooking — a claimed booking is not owned by email alone.
 */
function ownedBookingsFilter(userId: string, email: string) {
  const clauses: Record<string, unknown>[] = [{ userId }];
  if (email) {
    clauses.push({
      "customer.email": email,
      $or: [{ userId: { $exists: false } }, { userId: null }],
    });
  }
  return clauses.length === 1 ? clauses[0] : { $or: clauses };
}

/**
 * Payments for the signed-in client: by payment.userId, or by bookings they own
 * (covers ledger rows written before userId was stored on Payment).
 * Newest first. Includes PENDING / FAILED / SUCCEEDED / REFUNDED.
 */
export async function listPaymentsForClient(input: {
  userId: string;
  email: string;
}): Promise<ClientPaymentRow[]> {
  await connectDB();

  const email = input.email.trim().toLowerCase();
  const ownedBookings = await Booking.find(
    ownedBookingsFilter(input.userId, email)
  )
    .select({ id: 1 })
    .lean();

  const bookingIds = ownedBookings
    .map((row) => (typeof row.id === "string" ? row.id : ""))
    .filter(Boolean);

  const filter =
    bookingIds.length > 0
      ? {
          $or: [{ userId: input.userId }, { bookingId: { $in: bookingIds } }],
        }
      : { userId: input.userId };

  const docs = await Payment.find(filter)
    .sort({ createdAt: -1 })
    .limit(CLIENT_PAYMENT_HISTORY_LIMIT)
    .lean();

  return docs.map((doc) => {
    const raw = doc as Record<string, unknown>;
    const id =
      raw._id && typeof raw._id === "object" && "toString" in raw._id
        ? String((raw._id as { toString: () => string }).toString())
        : String(raw.providerRef || "");
    return {
      id,
      createdAt: String(raw.createdAt || ""),
      bookingId: String(raw.bookingId || ""),
      kind: String(raw.kind || ""),
      amountCents: Number(raw.amountCents) || 0,
      currency: String(raw.currency || "ZAR"),
      provider: String(raw.provider || ""),
      status: String(raw.status || ""),
    };
  });
}
