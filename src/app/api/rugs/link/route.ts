import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { isHttpError, requireFullAdminSession } from "@/lib/adminAuth";
import { getSession } from "@/lib/session";
import { Booking } from "@/models/Booking";
import { RugAsset } from "@/models/RugAsset";
import { toClientBooking } from "@/lib/serialize";
import {
  inCareLinkConflict,
  normalizeTagCode,
  RUG_TAG_CODE_PATTERN,
} from "@/lib/rugAsset/linkTag";

/**
 * Link an existing RugAsset tag onto a new booking (repeat clean).
 *
 * - Updates asset.currentBookingId and copies tagCode/assetId onto the new booking.
 * - Leaves the previous booking’s rug.tagCode for history.
 * - Does not copy paymentStatus, coupon, promotion, or billing.
 * - Rejects when the tag is IN_CARE on another non-delivered job (409).
 *
 * Full admin only.
 */
export async function POST(request: Request) {
  try {
    requireFullAdminSession(await getSession());

    let body: { bookingId?: unknown; tagCode?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const bookingId =
      typeof body.bookingId === "string" ? body.bookingId.trim() : "";
    const tagCode =
      typeof body.tagCode === "string" ? normalizeTagCode(body.tagCode) : "";

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

    // Idempotent: already linked to this booking.
    if (
      existingTag === tagCode &&
      asset.currentBookingId === bookingId &&
      String(booking.rug?.assetId ?? "") === String(asset._id)
    ) {
      return NextResponse.json({
        booking: toClientBooking(booking as Record<string, unknown>),
        tagCode,
        assetId: String(asset._id),
      });
    }

    if (asset.currentBookingId && asset.currentBookingId !== bookingId) {
      const currentJob = await Booking.findOne({ id: asset.currentBookingId })
        .select({ id: 1, status: 1 })
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
      booking: toClientBooking(updated as Record<string, unknown>),
      tagCode,
      assetId: String(claimed._id),
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
