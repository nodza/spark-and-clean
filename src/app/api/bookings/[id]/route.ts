import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { getSession } from "@/lib/session";
import { toClientBooking } from "@/lib/serialize";
import { statusAfterDriverAssign } from "@/lib/bookingAssignment";
import type { BookingStatus, PaymentStatus } from "@/types/booking";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const doc = await Booking.findOne({ id }).lean();
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const booking = toClientBooking(doc as Record<string, unknown>);

    if (session.role === "client") {
      if (booking.customer.email.toLowerCase() !== session.email.toLowerCase()) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (session.role === "technician") {
      if (
        booking.assignedDriverId &&
        session.driverProfileId &&
        booking.assignedDriverId !== session.driverProfileId
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json(booking);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch booking";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Persist status / paymentStatus / assignedDriverId (including null to unassign).
 *
 * Assign rule: first assign from BOOKED may set SCHEDULED; COLLECTED+ (and
 * already-SCHEDULED) keep their status — never silently reset to SCHEDULED.
 *
 * Auth: technicians may only PATCH status on their assigned jobs.
 * Admin payment/assign/status ops require full admin (marketing-only → 403).
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const wantsStatus = body.status !== undefined && body.status !== null;
    const wantsPayment =
      body.paymentStatus !== undefined && body.paymentStatus !== null;
    const wantsAssign = Object.prototype.hasOwnProperty.call(
      body,
      "assignedDriverId"
    );

    if (!wantsStatus && !wantsPayment && !wantsAssign) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    if (session.role === "client") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (session.role === "technician") {
      if (wantsPayment || wantsAssign) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (session.role === "admin") {
      // Ops writes require full admin when tiers exist
      if (session.adminTier !== "full") {
        return NextResponse.json(
          { error: "Full admin required for booking updates" },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await connectDB();
    const existing = await Booking.findOne({ id }).lean();
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (session.role === "technician") {
      if (existing.assignedDriverId !== session.driverProfileId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const updates: Record<string, unknown> = {};

    if (wantsStatus) {
      updates.status = body.status as BookingStatus;
    }
    if (wantsPayment) {
      updates.paymentStatus = body.paymentStatus as PaymentStatus;
    }
    if (wantsAssign) {
      const nextDriver =
        body.assignedDriverId === null || body.assignedDriverId === ""
          ? null
          : String(body.assignedDriverId);
      updates.assignedDriverId = nextDriver;

      if (!wantsStatus) {
        const nextStatus = statusAfterDriverAssign(
          existing.status as BookingStatus,
          nextDriver
        );
        if (nextStatus) updates.status = nextStatus;
      }
    }

    const doc = await Booking.findOneAndUpdate(
      { id },
      { $set: updates },
      { new: true }
    ).lean();

    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(toClientBooking(doc as Record<string, unknown>));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update booking";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
