import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { getSession } from "@/lib/session";
import { toClientBooking } from "@/lib/serialize";
import { isClientRole, isFullAccount } from "@/types/user";
import type { BookingStatus, PaymentStatus } from "@/types/booking";

type Params = { params: Promise<{ id: string }> };

/**
 * Public tracking by booking reference (the ID is the capability).
 * A signed-in full client may only open their own bookings.
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const session = await getSession();

    await connectDB();
    const doc = await Booking.findOne({ id }).lean();
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const booking = toClientBooking(doc as Record<string, unknown>);

    if (isFullAccount(session) && isClientRole(session.role)) {
      const emailMatch =
        booking.customer.email.toLowerCase() === session.email.toLowerCase();
      const ownerMatch = booking.userId === session.id;
      if (!emailMatch && !ownerMatch) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (session?.role === "technician") {
      // Fail closed: missing profile or unassigned / other driver's job → 403
      if (
        !session.driverProfileId ||
        booking.assignedDriverId !== session.driverProfileId
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (session?.role === "admin" && session.adminTier === "marketing-only") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(booking);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch booking";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const $set: Record<string, unknown> = {};
    const $unset: Record<string, unknown> = {};

    if (body.status) $set.status = body.status as BookingStatus;
    if (body.paymentStatus) {
      $set.paymentStatus = body.paymentStatus as PaymentStatus;
    }
    if (body.assignedDriverId !== undefined) {
      if (body.assignedDriverId) {
        $set.assignedDriverId = body.assignedDriverId;
        if (!body.status) {
          $set.status = "SCHEDULED";
        }
      } else {
        $unset.assignedDriverId = 1;
      }
    }

    if (Object.keys($set).length === 0 && Object.keys($unset).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    if (session.role === "client") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (session.role === "admin" && session.adminTier === "marketing-only") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (session.role === "technician") {
      // Technicians may only update status on their assigned jobs
      if (!session.driverProfileId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (body.paymentStatus !== undefined || body.assignedDriverId !== undefined) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    await connectDB();

    if (session.role === "technician") {
      const existing = await Booking.findOne({ id }).lean();
      if (
        !existing ||
        !session.driverProfileId ||
        existing.assignedDriverId !== session.driverProfileId
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const updateOp: { $set?: Record<string, unknown>; $unset?: Record<string, unknown> } =
      {};
    if (Object.keys($set).length > 0) updateOp.$set = $set;
    if (Object.keys($unset).length > 0) updateOp.$unset = $unset;

    const doc = await Booking.findOneAndUpdate({ id }, updateOp, {
      new: true,
    }).lean();

    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(toClientBooking(doc as Record<string, unknown>));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update booking";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
