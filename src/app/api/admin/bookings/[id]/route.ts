import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { isHttpError, requireFullAdmin } from "@/lib/adminAuth";
import {
  bookingDeactivateBlockReason,
  canDeactivateBooking,
} from "@/lib/adminBookingDetails";
import { toClientBooking } from "@/lib/serialize";
import { toPublicApiError } from "@/lib/publicApiError";
import type { BookingStatus, PaymentStatus } from "@/types/booking";

type Params = { params: Promise<{ id: string }> };

/**
 * Deactivate a booking that was never paid and never collected (and has no rug
 * tag).
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
      .select({ id: 1, status: 1, paymentStatus: 1, rug: 1, deactivatedAt: 1 })
      .lean();
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const check = {
      status: existing.status as BookingStatus,
      paymentStatus: existing.paymentStatus as PaymentStatus,
      rug: existing.rug as { tagCode?: string | null } | undefined,
      deactivatedAt: (existing as { deactivatedAt?: Date | null }).deactivatedAt,
    };
    if (!canDeactivateBooking(check)) {
      return NextResponse.json(
        {
          error:
            bookingDeactivateBlockReason(check) ||
            "This booking cannot be deactivated",
        },
        { status: 409 }
      );
    }

    const updated = await Booking.findOneAndUpdate(
      {
        id: bookingId,
        status: { $in: ["BOOKED", "SCHEDULED"] },
        paymentStatus: "UNPAID",
        $and: [
          {
            $or: [
              { deactivatedAt: { $exists: false } },
              { deactivatedAt: null },
            ],
          },
          {
            $or: [
              { "rug.tagCode": { $exists: false } },
              { "rug.tagCode": null },
              { "rug.tagCode": "" },
            ],
          },
        ],
      },
      {
        $set: { deactivatedAt: new Date() },
        $unset: { assignedDriverId: "" },
      },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return NextResponse.json(
        { error: "This booking cannot be deactivated" },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      booking: toClientBooking(updated as Record<string, unknown>),
    });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message =
      err instanceof Error ? err.message : "Failed to deactivate booking";
    console.error("[api/admin/bookings DELETE]", message);
    return NextResponse.json(
      { error: toPublicApiError(err, "Could not deactivate booking.") },
      { status: 500 }
    );
  }
}
