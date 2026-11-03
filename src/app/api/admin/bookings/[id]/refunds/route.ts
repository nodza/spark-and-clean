import { NextResponse } from "next/server";
import { isHttpError, requireFullAdmin } from "@/lib/adminAuth";
import { refundBookingPayment } from "@/lib/payments/refundBooking";
import { toPublicApiError } from "@/lib/publicApiError";

type Params = { params: Promise<{ id: string }> };

/**
 * Refund part or all of one succeeded payment. Full admin only.
 * Card payments go through Stripe. Ozow refunds are recorded with a reference.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    await requireFullAdmin();
    const { id } = await params;
    const bookingId = id.trim();
    if (!bookingId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = (await request.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Enter the refund details." },
        { status: 400 }
      );
    }

    const result = await refundBookingPayment({
      bookingId,
      sourceProviderRef: String(body.sourceProviderRef ?? ""),
      amountCents: Number(body.amountCents),
      reason: String(body.reason ?? ""),
      reference: body.reference == null ? undefined : String(body.reference),
      idempotencyKey: String(body.idempotencyKey ?? ""),
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.message,
          ...(result.field ? { field: result.field } : {}),
        },
        { status: result.status }
      );
    }

    return NextResponse.json({
      paymentStatus: result.paymentStatus,
      billing: result.billing,
      payment: result.payment,
      ...(result.synced ? { synced: true } : {}),
    });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Failed to record refund";
    console.error("[api/admin/bookings/refunds POST]", message);
    return NextResponse.json(
      { error: toPublicApiError(err, "Could not record the refund.") },
      { status: 500 }
    );
  }
}
