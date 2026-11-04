import { NextResponse } from "next/server";
import { canTechnicianEditSize } from "@/lib/fieldStatus";
import { commitMeasuredSize } from "@/lib/measuredPrice";
import { readMeasuredMeters } from "@/lib/measuredSize";
import { connectDB } from "@/lib/mongodb";
import { toPublicApiError } from "@/lib/publicApiError";
import { toClientBooking } from "@/lib/serialize";
import { getSession } from "@/lib/session";
import { Booking } from "@/models/Booking";

type Params = { params: Promise<{ id: string }> };

const LOCKED_SIZE_ERROR =
  "Size can only be changed while the pickup is still scheduled.";

/**
 * Assigned driver corrects width and length while the job is SCHEDULED.
 * The server recalculates the amount due. A posted price is ignored.
 * After the rug is collected, this route refuses the change.
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.role !== "technician" || !session.driverProfileId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
    const existing = await Booking.findOne({ id: bookingId })
      .select({ status: 1, assignedDriverId: 1 })
      .lean();
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (existing.assignedDriverId !== session.driverProfileId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!canTechnicianEditSize(existing.status)) {
      return NextResponse.json({ error: LOCKED_SIZE_ERROR }, { status: 409 });
    }

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

    return NextResponse.json(toClientBooking(committed.doc));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save measured size";
    console.error("[api/bookings/measurement PATCH]", message);
    return NextResponse.json(
      { error: toPublicApiError(err, "Could not save the measured size.") },
      { status: 500 }
    );
  }
}
