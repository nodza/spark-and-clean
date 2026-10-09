import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { isHttpError, requireFullAdminSession } from "@/lib/adminAuth";
import { getSession } from "@/lib/session";
import { Booking } from "@/models/Booking";
import { RugAsset } from "@/models/RugAsset";
import { toClientBooking } from "@/lib/serialize";
import {
  inCareLinkConflict,
  isLinkableTargetStatus,
  normalizeTagCode,
  RUG_TAG_CODE_PATTERN,
  sameRugCustomer,
} from "@/lib/rugAsset/linkTag";

/**
 * Link an existing RugAsset tag onto a new booking (repeat clean).
 *
 * - Updates asset.currentBookingId and copies tagCode/assetId onto the new booking.
 * - Leaves the previous booking’s rug.tagCode for history.
 * - Does not copy paymentStatus, coupon, promotion, or billing.
 * - Target must be BOOKED or SCHEDULED and the same customer as the rug.
 * - Rejects when the tag is IN_CARE on another open job (409).
 * - `dryRun: true` validates and returns the target customer without writing.
 *
 * Full admin only.
 */
export async function POST(request: Request) {
  try {
    requireFullAdminSession(await getSession());

    let body: { bookingId?: unknown; tagCode?: unknown; dryRun?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const bookingId =
      typeof body.bookingId === "string" ? body.bookingId.trim() : "";
    const tagCode =
      typeof body.tagCode === "string" ? normalizeTagCode(body.tagCode) : "";
    const dryRun = body.dryRun === true;

    if (!bookingId || !tagCode) {
      return NextResponse.json(
        { error: "bookingId and tagCode are required" },
        { status: 400 }
      );
    }
    if (!RUG_TAG_CODE_PATTERN.test(tagCode)) {
      return NextResponse.json({ error: "Invalid tag code" }, { status: 400 });
    }

    await connectDB();

    const [asset, booking] = await Promise.all([
      RugAsset.findOne({ tagCode }),
      Booking.findOne({ id: bookingId }).lean(),
    ]);

    if (!asset) {
      return NextResponse.json({ error: "No rug found for that tag" }, { status: 404 });
    }
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (asset.status === "RETIRED") {
      return NextResponse.json(
        { error: "This tag is retired and cannot be reused" },
        { status: 409 }
      );
    }

    const existingTag = booking.rug?.tagCode?.trim().toUpperCase() || "";
    if (existingTag && existingTag !== tagCode) {
      return NextResponse.json(
        { error: "This booking already has a different tag" },
        { status: 409 }
      );
    }

    const targetCustomer = {
      userId: booking.userId,
      email: booking.customer?.email,
    };
    const customerName =
      typeof booking.customer?.name === "string" ? booking.customer.name : "";

    // Idempotent: already linked to this booking.
    if (
      existingTag === tagCode &&
      asset.currentBookingId === bookingId &&
      String(booking.rug?.assetId ?? "") === String(asset._id)
    ) {
      return NextResponse.json({
        dryRun,
        booking: toClientBooking(booking as Record<string, unknown>),
        tagCode,
        assetId: String(asset._id),
        customerName,
        bookingStatus: booking.status,
        previousBookingId: null,
      });
    }

    if (!isLinkableTargetStatus(booking.status)) {
      return NextResponse.json(
        {
          error:
            "Tags can only be linked to a BOOKED or SCHEDULED booking.",
        },
        { status: 409 }
      );
    }

    let currentJob:
      | {
          userId?: unknown;
          status?: unknown;
          customer?: { email?: unknown };
        }
      | null = null;
    if (asset.currentBookingId && asset.currentBookingId !== bookingId) {
      currentJob = await Booking.findOne({ id: asset.currentBookingId })
        .select({ id: 1, status: 1, userId: 1, "customer.email": 1 })
        .lean();
      const conflict = inCareLinkConflict({
        assetStatus: asset.status,
        assetCurrentBookingId: asset.currentBookingId,
        targetBookingId: bookingId,
        currentBookingStatus: currentJob?.status,
      });
      if (conflict) {
        return NextResponse.json({ error: conflict }, { status: 409 });
      }
    }

    if (
      !sameRugCustomer(targetCustomer, {
        userId: asset.ownerUserId,
        email: asset.ownerEmail,
      }) ||
      (currentJob &&
        !sameRugCustomer(targetCustomer, {
          userId: currentJob.userId,
          email: currentJob.customer?.email,
        }))
    ) {
      return NextResponse.json(
        {
          error:
            "This tag belongs to another customer. You can only link it to that customer's bookings.",
        },
        { status: 409 }
      );
    }

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        tagCode,
        assetId: String(asset._id),
        bookingId,
        customerName,
        bookingStatus: booking.status,
        previousBookingId:
          asset.currentBookingId && asset.currentBookingId !== bookingId
            ? asset.currentBookingId
            : null,
      });
    }

    const previousCurrentBookingId = asset.currentBookingId ?? null;
    const previousStatus = asset.status;

    const claimFilter: Record<string, unknown> = { _id: asset._id };
    if (previousCurrentBookingId) {
      claimFilter.currentBookingId = previousCurrentBookingId;
    } else {
      claimFilter.$or = [
        { currentBookingId: null },
        { currentBookingId: { $exists: false } },
      ];
    }

    const claimed = await RugAsset.findOneAndUpdate(
      claimFilter,
      {
        $set: {
          currentBookingId: bookingId,
          status: "IN_CARE",
        },
      },
      { new: true }
    );
    if (!claimed) {
      return NextResponse.json(
        { error: "This tag was just linked to another booking" },
        { status: 409 }
      );
    }

    // Only set tag fields — never paymentStatus, coupon, promotion, or billing.
    const updated = await Booking.findOneAndUpdate(
      {
        id: bookingId,
        status: { $in: ["BOOKED", "SCHEDULED"] },
        $or: [
          { "rug.tagCode": { $exists: false } },
          { "rug.tagCode": null },
          { "rug.tagCode": "" },
          { "rug.tagCode": tagCode },
        ],
      },
      {
        $set: {
          "rug.tagCode": tagCode,
          "rug.assetId": claimed._id,
        },
      },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      await RugAsset.updateOne(
        { _id: asset._id, currentBookingId: bookingId },
        {
          $set: {
            currentBookingId: previousCurrentBookingId ?? null,
            status: previousStatus,
          },
        }
      );
      return NextResponse.json(
        { error: "The booking changed before the tag could be linked" },
        { status: 409 }
      );
    }

    // Previous booking keeps rug.tagCode for history — do not clear it.

    return NextResponse.json({
      dryRun: false,
      booking: toClientBooking(updated as Record<string, unknown>),
      tagCode,
      assetId: String(claimed._id),
      customerName:
        typeof updated.customer?.name === "string"
          ? updated.customer.name
          : customerName,
      bookingStatus: updated.status,
      previousBookingId:
        previousCurrentBookingId && previousCurrentBookingId !== bookingId
          ? previousCurrentBookingId
          : null,
    });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message =
      err instanceof Error ? err.message : "Failed to link rug tag";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
