import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { isHttpError, requireFullAdmin } from "@/lib/adminAuth";
import { listPaymentsForBooking } from "@/lib/payments/listBookingPayments";
import { toPublicApiError } from "@/lib/publicApiError";

type Params = { params: Promise<{ id: string }> };

/**
 * Gateway receipts for one booking. Full admin only.
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    await requireFullAdmin();
    const { id } = await params;
    const bookingId = id.trim();
    if (!bookingId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await connectDB();
    const booking = await Booking.findOne({ id: bookingId })
      .select({ id: 1 })
      .lean();
    if (!booking) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const payments = await listPaymentsForBooking(bookingId);
    return NextResponse.json({ payments });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Failed to fetch payments";
    console.error("[api/admin/bookings/payments GET]", message);
    return NextResponse.json(
      { error: toPublicApiError(err, "Could not load payments.") },
      { status: 500 }
    );
  }
}
