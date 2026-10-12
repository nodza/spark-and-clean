import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { isHttpError, requireFullAdmin } from "@/lib/adminAuth";
import {
  bookingDeleteBlockReason,
  canDeleteBooking,
} from "@/lib/adminBookingDetails";
import { toPublicApiError } from "@/lib/publicApiError";
import type { BookingStatus, PaymentStatus } from "@/types/booking";

type Params = { params: Promise<{ id: string }> };

/**
 * Remove a booking that was never paid and never collected (and has no rug tag).
 * Full admin only.
 */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireFullAdmin();
    const { id } = await params;
    const bookingId = id.trim();
    if (!bookingId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await connectDB();
    const existing = await Booking.findOne({ id: bookingId })
      .select({ id: 1, status: 1, paymentStatus: 1, rug: 1 })
      .lean();
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const check = {
      status: existing.status as BookingStatus,
      paymentStatus: existing.paymentStatus as PaymentStatus,
      rug: existing.rug as { tagCode?: string | null } | undefined,
    };
    if (!canDeleteBooking(check)) {
      return NextResponse.json(
        {
          error:
            bookingDeleteBlockReason(check) ||
            "This booking cannot be deleted",
        },
        { status: 409 }
      );
    }

    const deleted = await Booking.deleteOne({
      id: bookingId,
      status: { $in: ["BOOKED", "SCHEDULED"] },
      paymentStatus: "UNPAID",
      $or: [
        { "rug.tagCode": { $exists: false } },
        { "rug.tagCode": null },
        { "rug.tagCode": "" },
      ],
    });

    if (deleted.deletedCount !== 1) {
      return NextResponse.json(
        { error: "This booking cannot be deleted" },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message =
      err instanceof Error ? err.message : "Failed to delete booking";
    console.error("[api/admin/bookings DELETE]", message);
    return NextResponse.json(
      { error: toPublicApiError(err, "Could not delete booking.") },
      { status: 500 }
    );
  }
}
