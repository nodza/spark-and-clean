import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { getSession } from "@/lib/session";
import { attachUnclaimedBookingsByEmail } from "@/lib/attachGuestBookings";
import { toClientBooking } from "@/lib/serialize";
import { isClientRole, isFullAccount } from "@/types/user";

type Params = { params: Promise<{ id: string }> };

/**
 * Attach this booking (and every other unclaimed booking with the same email)
 * to the signed-in client. Does not create a new booking or change the
 * reference id. Existing accounts must opt in — never silent-claim on login.
 */
export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const session = await getSession();

    if (!session || !isFullAccount(session) || !isClientRole(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const doc = await Booking.findOne({ id }).lean();
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const booking = toClientBooking(doc as Record<string, unknown>);
    const email = booking.customer.email.toLowerCase();

    if (email !== session.email.toLowerCase()) {
      return NextResponse.json(
        { error: "This booking belongs to a different email address." },
        { status: 403 }
      );
    }

    if (booking.userId && booking.userId !== session.id) {
      return NextResponse.json(
        { error: "This booking is already linked to another account." },
        { status: 409 }
      );
    }

    const attached = await attachUnclaimedBookingsByEmail(session.id, email);

    const updated = await Booking.findOne({ id }).lean();
    return NextResponse.json({
      booking: updated
        ? toClientBooking(updated as Record<string, unknown>)
        : booking,
      attachedBookingIds: attached.ids,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to attach booking";
    console.error("[api/bookings/[id]/claim]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
