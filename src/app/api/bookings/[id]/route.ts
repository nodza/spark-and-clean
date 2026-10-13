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
import { hasRugTagCode, technicianFieldUpdate } from "@/lib/fieldStatus";
import { clientOwnsBooking } from "@/lib/payments/checkoutAccess";
import { punchOnce } from "@/lib/promotion/loyalty";
import { creditReferrerOnce } from "@/lib/referral";

type Params = { params: Promise<{ id: string }> };

const TECHNICIAN_PHONE_STATUSES = new Set<BookingStatus>([
  "COLLECTED",
  "CLEANING",
  "DRYING",
  "READY",
  "DELIVERED",
]);

/**
 * Staff phone stays off a public tracking link until the rug is collected,
 * unless the signed-in client owns the booking.
 */
function canShareTechnicianPhone(
  session: Awaited<ReturnType<typeof getSession>>,
  booking: { status: BookingStatus; userId?: string; customer: { email: string } }
): boolean {
  if (session?.role === "admin" || session?.role === "technician") return true;
  if (clientOwnsBooking(session, booking)) return true;
  return TECHNICIAN_PHONE_STATUSES.has(booking.status);
}

/** Name and phone for the customer. Other driver fields stay off this payload. */
async function customerTechnician(driverId?: string) {
  const id = driverId?.trim();
  if (!id) return null;
  const driver = await Driver.findOne({ id }).select({ name: 1, phone: 1 }).lean();
  if (!driver || typeof driver.name !== "string") return null;
  const name = driver.name.trim();
  if (!name) return null;
  const phone = typeof driver.phone === "string" ? driver.phone.trim() : "";
  return phone ? { name, phone } : { name };
}

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

    const technician = await customerTechnician(booking.assignedDriverId);
    const sharedTechnician =
      technician?.phone &&
      !canShareTechnicianPhone(session, {
        status: booking.status,
        userId: booking.userId,
        customer: booking.customer,
      })
        ? { name: technician.name }
        : technician;
    return NextResponse.json(
      sharedTechnician ? { ...booking, technician: sharedTechnician } : booking
    );
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
 * may save width/length when collecting a rug that has no size yet, and
 * cannot collect until a rug tag is attached.
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

    const existingRug = existing.rug as
      | { widthM?: unknown; lengthM?: unknown; tagCode?: unknown }
      | null
      | undefined;
    if (
      wantsStatus &&
      body.status === "COLLECTED" &&
      !hasRugTagCode(existingRug?.tagCode)
    ) {
      return NextResponse.json(
        { error: "Attach a rug tag before marking this job collected." },
        { status: 409 }
      );
    }

    const $set: Record<string, unknown> = {};
    const $unset: Record<string, ""> = {};

    if (session.role === "technician") {
      const widthProvided = Object.prototype.hasOwnProperty.call(body, "widthM");
      const lengthProvided = Object.prototype.hasOwnProperty.call(
        body,
        "lengthM"
      );
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
        tagCode: existingRug?.tagCode,
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

    if ($set.status === "DELIVERED") {
      try {
        const delivered = {
          id: String(existing.id),
          userId: existing.userId,
        };
        await punchOnce(delivered);
        await creditReferrerOnce(delivered);
      } catch (err) {
        await Booking.updateOne(
          { id: String(existing.id), status: "DELIVERED" },
          { $set: { status: existing.status } }
        );
        throw err;
      }
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
