import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { Driver } from "@/models/Driver";
import { User } from "@/models/User";
import { getSession } from "@/lib/session";
import { toClientBooking } from "@/lib/serialize";
import { statusAfterDriverAssign } from "@/lib/bookingAssignment";
import {
  isBookingStatus,
  isPaymentStatus,
} from "@/lib/bookingPatchFields";
import { isAssignableDriverPair } from "@/lib/assignableDriver";
import {
  isHttpError,
  requireFullAdminSession,
} from "@/lib/adminAuth";
import { isClientRole, isFullAccount } from "@/types/user";
import type { BookingStatus } from "@/types/booking";
import { technicianFieldUpdate } from "@/lib/fieldStatus";

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

/**
 * Persist status / paymentStatus / assignedDriverId (null / omit via $unset).
 *
 * Assign rule: first assign from BOOKED may set SCHEDULED; later statuses keep
 * their status. Full admin for depot moves. Technicians may only
 * (BOOKED|SCHEDULED) → COLLECTED or READY → DELIVERED on their own job,
 * and may save width/length when collecting a rug that has no size yet.
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
      if (!session.driverProfileId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (session.role === "admin") {
      requireFullAdminSession(session);
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (wantsStatus && !isBookingStatus(body.status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }
    if (wantsPayment && !isPaymentStatus(body.paymentStatus)) {
      return NextResponse.json(
        { error: "Invalid paymentStatus" },
        { status: 400 }
      );
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

    const $set: Record<string, unknown> = {};
    const $unset: Record<string, ""> = {};

    if (session.role === "technician") {
      const widthProvided = Object.prototype.hasOwnProperty.call(body, "widthM");
      const lengthProvided = Object.prototype.hasOwnProperty.call(
        body,
        "lengthM"
      );
      const existingRug = existing.rug as
        | { widthM?: unknown; lengthM?: unknown }
        | null
        | undefined;
      const decision = technicianFieldUpdate({
        driverProfileId: session.driverProfileId,
        assignedDriverId: existing.assignedDriverId,
        from: existing.status as BookingStatus,
        to: body.status as BookingStatus,
        existingWidth: existingRug?.widthM,
        existingLength: existingRug?.lengthM,
        widthProvided,
        lengthProvided,
        widthM: widthProvided ? body.widthM : undefined,
        lengthM: lengthProvided ? body.lengthM : undefined,
      });
      if (!decision.ok) {
        return NextResponse.json(
          { error: decision.error },
          { status: decision.status }
        );
      }
      Object.assign($set, decision.set);
    } else if (wantsStatus) {
      $set.status = body.status as BookingStatus;
    }
    if (wantsPayment) {
      $set.paymentStatus = body.paymentStatus;
    }
    if (wantsAssign) {
      const nextDriver =
        body.assignedDriverId === null || body.assignedDriverId === ""
          ? null
          : String(body.assignedDriverId);

      if (nextDriver === null) {
        $unset.assignedDriverId = "";
      } else {
        const [driver, tech] = await Promise.all([
          Driver.findOne({ id: nextDriver }).select({ id: 1, isActive: 1 }).lean(),
          User.findOne({
            role: "technician",
            driverProfileId: nextDriver,
          })
            .select({ _id: 1, disabledAt: 1, isActive: 1 })
            .lean(),
        ]);
        if (!isAssignableDriverPair(driver, tech)) {
          return NextResponse.json(
            { error: "Unknown or inactive driver" },
            { status: 400 }
          );
        }
        $set.assignedDriverId = nextDriver;
      }

      // New assignee should see prior ops field notes as unread.
      $set.fieldThreadReadAt = null;

      if (!wantsStatus) {
        const nextStatus = statusAfterDriverAssign(
          existing.status as BookingStatus,
          nextDriver
        );
        if (nextStatus) $set.status = nextStatus;
      }
    }

    const update: Record<string, unknown> = {};
    if (Object.keys($set).length > 0) update.$set = $set;
    if (Object.keys($unset).length > 0) update.$unset = $unset;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const doc = await Booking.findOneAndUpdate({ id }, update, {
      new: true,
      runValidators: true,
    }).lean();

    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(toClientBooking(doc as Record<string, unknown>));
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Failed to update booking";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
