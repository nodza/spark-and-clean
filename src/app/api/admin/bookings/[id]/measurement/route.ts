import { NextResponse } from "next/server";
import { isHttpError, requireFullAdmin } from "@/lib/adminAuth";
import { commitMeasuredSize } from "@/lib/measuredPrice";
import { readMeasuredMeters } from "@/lib/measuredSize";
import { connectDB } from "@/lib/mongodb";
import { toPublicApiError } from "@/lib/publicApiError";
import { toClientBooking } from "@/lib/serialize";

type Params = { params: Promise<{ id: string }> };

/**
 * Full admin corrects the measured size. The server recalculates the amount
 * due from rug type, add-ons, and the booking coupon. A posted price is ignored.
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

    const raw =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : null;
    if (!raw) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const meters = readMeasuredMeters(raw.widthM, raw.lengthM);
    if (!meters.ok) {
      return NextResponse.json({ error: meters.error }, { status: 400 });
    }

    await connectDB();
    const committed = await commitMeasuredSize({
      bookingId,
      widthM: meters.widthM,
      lengthM: meters.lengthM,
    });
    if (!committed.ok) {
      return NextResponse.json(
        { error: committed.error },
        { status: committed.status }
      );
    }

    return NextResponse.json({
      booking: toClientBooking(committed.doc),
    });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message =
      err instanceof Error ? err.message : "Failed to save measured size";
    console.error("[api/admin/bookings/measurement PATCH]", message);
    return NextResponse.json(
      { error: toPublicApiError(err, "Could not save the measured size.") },
      { status: 500 }
    );
  }
}
