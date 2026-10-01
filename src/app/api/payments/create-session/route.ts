import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { getSession } from "@/lib/session";
import { toClientBooking } from "@/lib/serialize";
import { authorizeCheckout } from "@/lib/payments/checkoutAccess";
import { isClientRole, isFullAccount } from "@/types/user";
import { amountDueCentsForBooking, chargeAmountCents } from "@/lib/payments/deposit";
import { createOzowHostedPayment } from "@/lib/payments/ozow";
import { createDepositCheckoutSession } from "@/lib/payments/stripe";
import { toPublicApiError } from "@/lib/publicApiError";
import type { PaymentKind } from "@/models/Payment";

const PROVIDERS = new Set(["STRIPE", "OZOW"]);
const KINDS = new Set(["DEPOSIT", "BALANCE"]);

/**
 * Start Stripe or Ozow checkout. Does not write paymentStatus.
 * Webhooks / Ozow notify call ledger.recordSuccess.
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

    const provider =
      typeof payload.provider === "string"
        ? payload.provider.trim().toUpperCase()
        : "";
    const kindRaw =
      typeof payload.kind === "string" ? payload.kind.trim().toUpperCase() : "";

    if (!PROVIDERS.has(provider) || !KINDS.has(kindRaw)) {
      return NextResponse.json(
        {
          error:
            "provider must be STRIPE or OZOW, and kind must be DEPOSIT or BALANCE.",
        },
        { status: 400 }
      );
    }

    const kind = kindRaw as Extract<PaymentKind, "DEPOSIT" | "BALANCE">;

    if (provider === "STRIPE" && kind !== "DEPOSIT") {
      return NextResponse.json(
        { error: "Stripe checkout currently supports DEPOSIT only." },
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
    const access = authorizeCheckout(
      session,
      {
        userId: booking.userId,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        customer: { email: booking.customer.email },
      },
      kind
    );
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const amountCents = chargeAmountCents(kind, booking);
    if (amountCents < 1) {
      return NextResponse.json(
        {
          error:
            kind === "DEPOSIT"
              ? "There is nothing to collect as a deposit on this booking."
              : "There is no remaining balance on this booking.",
        },
        { status: 400 }
      );
    }

    if (provider === "STRIPE") {
      const checkout = await createDepositCheckoutSession({
        bookingId: booking.id,
        customerEmail: booking.customer.email,
        amountDueCents: amountDueCentsForBooking(booking),
      });
      return NextResponse.json({
        client_secret: checkout.clientSecret,
        provider: "STRIPE",
        kind,
      });
    }

    const hosted = await createOzowHostedPayment({
      bookingId: booking.id,
      customerEmail: booking.customer.email,
      customerName: booking.customer.name,
      kind,
      amountCents,
    });

    return NextResponse.json({
      url: hosted.url,
      provider: "OZOW",
      kind,
      amountCents: hosted.amountCents,
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Failed to start checkout";
    if (raw === "DEPOSIT_AMOUNT_TOO_SMALL" || raw === "OZOW_AMOUNT_TOO_SMALL") {
      return NextResponse.json(
        { error: "There is nothing to collect on this booking." },
        { status: 400 }
      );
    }
    if (
      raw.startsWith("Missing STRIPE_SECRET_KEY") ||
      raw.startsWith("Missing APP_URL") ||
      raw.startsWith("Missing OZOW_")
    ) {
      console.error("[api/payments/create-session]", raw);
      return NextResponse.json(
        { error: "That payment method is not available right now." },
        { status: 503 }
      );
    }
    console.error("[api/payments/create-session]", raw);
    return NextResponse.json(
      {
        error: toPublicApiError(
          err,
          "Could not start checkout. Please try again."
        ),
      },
      { status: 500 }
    );
  }
}
