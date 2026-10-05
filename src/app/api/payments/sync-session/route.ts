import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { getSession } from "@/lib/session";
import { toClientBooking } from "@/lib/serialize";
import { clientOwnsBooking } from "@/lib/payments/checkoutAccess";
import { isClientRole, isFullAccount } from "@/types/user";
import { toPublicApiError } from "@/lib/publicApiError";

/**
 * Read the booking's stored paymentStatus for the signed-in owner.
 * This route does not record a payment. POST /api/webhooks/stripe is the
 * only automatic writer, so a browser return cannot mark a booking paid.
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !isFullAccount(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isClientRole(session.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as {
      bookingId?: unknown;
    } | null;
    const bookingId =
      typeof body?.bookingId === "string" ? body.bookingId.trim() : "";
    if (!bookingId) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    await connectDB();
    const doc = await Booking.findOne({ id: bookingId }).lean();
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const booking = toClientBooking(doc as Record<string, unknown>);
    if (
      !clientOwnsBooking(session, {
        userId: booking.userId,
        customer: { email: booking.customer.email },
      })
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      applied: false,
      paymentStatus: booking.paymentStatus,
    });
  } catch (err) {
    console.error(
      "[api/payments/sync-session]",
      err instanceof Error ? err.message : "Failed to read payment status"
    );
    return NextResponse.json(
      { error: toPublicApiError(err, "Could not refresh the booking.") },
      { status: 500 }
    );
  }
}
