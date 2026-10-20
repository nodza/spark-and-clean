import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { isHttpError, requireFullAdmin } from "@/lib/adminAuth";
import { sanitizeBookingDetailsPatch } from "@/lib/adminBookingDetails";
import { toClientBooking } from "@/lib/serialize";
import { toPublicApiError } from "@/lib/publicApiError";

type Params = { params: Promise<{ id: string }> };

/**
 * Correct customer / address / collection window from the bookings list.
 * Does not change status, payment, driver, coupon, or rug fields.
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireFullAdmin();
    const { id } = await params;
    const bookingId = id.trim();
    if (!bookingId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsed = sanitizeBookingDetailsPatch(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    await connectDB();
    const existing = await Booking.findOne({ id: bookingId })
      .select({ id: 1, customer: 1 })
      .lean();
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await Booking.findOneAndUpdate(
      { id: bookingId },
      {
        $set: {
          "customer.name": parsed.patch.customer.name,
          "customer.phone": parsed.patch.customer.phone,
          "customer.email": parsed.patch.customer.email,
          addressLine1: parsed.patch.addressLine1,
          suburb: parsed.patch.suburb,
          city: parsed.patch.city,
          collectionDate: parsed.patch.collectionDate,
          collectionSlot: parsed.patch.collectionSlot,
        },
      },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      booking: toClientBooking(updated as Record<string, unknown>),
    });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message =
      err instanceof Error ? err.message : "Failed to update booking details";
    console.error("[api/admin/bookings/details PATCH]", message);
    return NextResponse.json(
      { error: toPublicApiError(err, "Could not save booking details.") },
      { status: 500 }
    );
  }
}
