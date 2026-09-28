import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { getSession } from "@/lib/session";
import { toClientBooking } from "@/lib/serialize";
import { authorizeDepositCheckout } from "@/lib/payments/checkoutAccess";
import { isClientRole, isFullAccount } from "@/types/user";
import { amountDueCentsForBooking } from "@/lib/payments/deposit";
import { createDepositCheckoutSession } from "@/lib/payments/stripe";
import { toPublicApiError } from "@/lib/publicApiError";

/**
 * Start Stripe Checkout for a deposit. Does not write paymentStatus.
 * The webhook story records the transfer and derives DEPOSIT / PAID.
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const payload = body as {
      bookingId?: unknown;
      kind?: unknown;
      provider?: unknown;
    };

    if (payload.kind !== "DEPOSIT" || payload.provider !== "STRIPE") {
      return NextResponse.json(
        { error: "Only a Stripe deposit can be started here." },
        { status: 400 }
      );
    }

    const bookingId =
      typeof payload.bookingId === "string" ? payload.bookingId.trim() : "";
    if (!bookingId) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (!session || !isFullAccount(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isClientRole(session.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await connectDB();
    const doc = await Booking.findOne({ id: bookingId }).lean();
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const booking = toClientBooking(doc as Record<string, unknown>);
    const access = authorizeDepositCheckout(session, {
      userId: booking.userId,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      customer: { email: booking.customer.email },
    });
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const amountDueCents = amountDueCentsForBooking(booking);
    const checkout = await createDepositCheckoutSession({
      bookingId: booking.id,
      customerEmail: booking.customer.email,
      amountDueCents,
    });

    return NextResponse.json({
      client_secret: checkout.clientSecret,
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Failed to start checkout";
    if (raw === "DEPOSIT_AMOUNT_TOO_SMALL") {
      return NextResponse.json(
        { error: "There is nothing to collect as a deposit on this booking." },
        { status: 400 }
      );
    }
    if (raw.startsWith("Missing STRIPE_SECRET_KEY") || raw.startsWith("Missing APP_URL")) {
      console.error("[api/payments/create-session]", raw);
      return NextResponse.json(
        { error: "Card payments are not available right now." },
        { status: 503 }
      );
    }
    console.error("[api/payments/create-session]", raw);
    return NextResponse.json(
      { error: toPublicApiError(err, "Could not start checkout. Please try again.") },
      { status: 500 }
    );
  }
}
