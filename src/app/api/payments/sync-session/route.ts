import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { getSession } from "@/lib/session";
import { toClientBooking } from "@/lib/serialize";
import { clientOwnsBooking } from "@/lib/payments/checkoutAccess";
import { isClientRole, isFullAccount } from "@/types/user";
import {
  checkoutSessionIdFromClientSecret,
  getStripe,
  retrieveCheckoutSession,
} from "@/lib/payments/stripe";
import { fulfillPaidCheckoutSession } from "@/lib/payments/stripeWebhook";
import { toPublicApiError } from "@/lib/publicApiError";

/**
 * After the embedded form confirms, ask Stripe whether this session is paid
 * and write the ledger. The browser does not set paymentStatus itself.
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
      clientSecret?: unknown;
    } | null;
    const bookingId =
      typeof body?.bookingId === "string" ? body.bookingId.trim() : "";
    const clientSecret =
      typeof body?.clientSecret === "string" ? body.clientSecret.trim() : "";
    const checkoutSessionId = clientSecret
      ? checkoutSessionIdFromClientSecret(clientSecret)
      : null;
    if (!bookingId || (clientSecret && !checkoutSessionId)) {
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

    const checkout = checkoutSessionId
      ? await retrieveCheckoutSession(checkoutSessionId)
      : (
          await getStripe().checkout.sessions.list({ limit: 25 })
        ).data.find(
          (row) =>
            (row.metadata?.bookingId || row.client_reference_id) === bookingId &&
            row.payment_status === "paid"
        );
    if (!checkout) {
      return NextResponse.json({
        applied: false,
        paymentStatus: booking.paymentStatus,
      });
    }
    const checkoutBookingId = (
      checkout.metadata?.bookingId ||
      checkout.client_reference_id ||
      ""
    ).trim();
    if (checkoutBookingId !== bookingId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await fulfillPaidCheckoutSession(checkout);
    if (!result.ok) {
      return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
    }

    const updated = await Booking.findOne({ id: bookingId })
      .select({ paymentStatus: 1 })
      .lean();

    return NextResponse.json({
      applied: "applied" in result ? result.applied : true,
      paymentStatus:
        updated &&
        typeof updated === "object" &&
        "paymentStatus" in updated &&
        typeof updated.paymentStatus === "string"
          ? updated.paymentStatus
          : booking.paymentStatus,
    });
  } catch (err) {
    console.error(
      "[api/payments/sync-session]",
      err instanceof Error ? err.message : "Failed to sync payment"
    );
    return NextResponse.json(
      { error: toPublicApiError(err, "Could not update the booking.") },
      { status: 500 }
    );
  }
}
