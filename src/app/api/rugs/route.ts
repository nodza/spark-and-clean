import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { isHttpError, requireFullAdminSession } from "@/lib/adminAuth";
import { requireTechnicianSession } from "@/lib/fieldMessageAuth";
import { Booking } from "@/models/Booking";
import { RugAsset } from "@/models/RugAsset";
import { toClientBooking } from "@/lib/serialize";
import { isVanCollectStatus } from "@/lib/fieldStatus";
import { generateRugTagCode } from "@/lib/rugAsset/tagCode";
import { getSession } from "@/lib/session";
import type { BookingStatus } from "@/types/booking";

const LOOKUP_FIELDS = { id: 1, customer: 1, rug: 1, status: 1 } as const;

function bookingHasTag(
  booking: { rug?: { tagCode?: string | null } } | null | undefined,
  tagCode: string
) {
  return booking?.rug?.tagCode?.trim().toUpperCase() === tagCode;
}

export async function GET(request: Request) {
  try {
    requireFullAdminSession(await getSession());

    const params = new URL(request.url).searchParams;
    const tagCode = (params.get("tagCode") || params.get("q") || "")
      .trim()
      .toUpperCase();
    if (!tagCode || !/^[A-Z0-9][A-Z0-9-]{2,63}$/.test(tagCode)) {
      return NextResponse.json({ results: [] });
    }

    await connectDB();
    const asset = await RugAsset.findOne({ tagCode }).lean();

    let booking =
      asset?.currentBookingId
        ? await Booking.findOne({ id: asset.currentBookingId })
            .select(LOOKUP_FIELDS)
            .lean()
        : null;

    // Stale currentBookingId (tag moved/reused) — ignore and fall back.
    if (booking && !bookingHasTag(booking, tagCode)) {
      booking = null;
    }

    if (!booking) {
      booking = await Booking.findOne({ "rug.tagCode": tagCode })
        .select(LOOKUP_FIELDS)
        .sort({ updatedAt: -1 })
        .lean();
    }
    if (!booking) return NextResponse.json({ results: [] });

    const thumbnails = [
      ...(asset?.photoUrls ?? []),
      ...(booking.rug?.photos ?? []),
    ].filter((photo, index, photos) => Boolean(photo) && photos.indexOf(photo) === index);

    return NextResponse.json({
      results: [
        {
          tagCode,
          customer: booking.customer?.name ?? "",
          bookingId: booking.id,
          status: booking.status,
          thumbnails,
        },
      ],
    });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Failed to search rug tags" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireTechnicianSession();
    let body: { bookingId?: unknown; tagCode?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const bookingId =
      typeof body.bookingId === "string" ? body.bookingId.trim() : "";
    const suppliedTagCode =
      typeof body.tagCode === "string" ? body.tagCode.trim().toUpperCase() : "";
    if (!bookingId || (body.tagCode !== undefined && !suppliedTagCode)) {
      return NextResponse.json(
        { error: "bookingId and a valid tagCode are required" },
        { status: 400 }
      );
    }
    if (suppliedTagCode && !/^[A-Z0-9][A-Z0-9-]{2,63}$/.test(suppliedTagCode)) {
      return NextResponse.json({ error: "Invalid tag code" }, { status: 400 });
    }

    await connectDB();
    const booking = await Booking.findOne({ id: bookingId }).lean();
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (booking.assignedDriverId !== session.driverProfileId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!isVanCollectStatus(booking.status as BookingStatus)) {
      return NextResponse.json(
        { error: "Tags can only be attached before collection" },
        { status: 409 }
      );
    }

    const currentTagCode = booking.rug?.tagCode?.trim();
    if (currentTagCode) {
      if (suppliedTagCode && currentTagCode.toUpperCase() !== suppliedTagCode) {
        return NextResponse.json(
          { error: "This rug already has a different tag" },
          { status: 409 }
        );
      }
      return NextResponse.json(toClientBooking(booking as Record<string, unknown>));
    }

    const tagCode = suppliedTagCode || generateRugTagCode();
    let asset = await RugAsset.findOne({ tagCode });
    let createdAsset = false;
    let claimedAsset = false;
    const previousAssetStatus = asset?.status;

    if (asset) {
      if (asset.currentBookingId && asset.currentBookingId !== bookingId) {
        return NextResponse.json(
          { error: "This tag is already attached to another booking" },
          { status: 409 }
        );
      }
      if (asset.status === "RETIRED") {
        return NextResponse.json(
          { error: "This tag is retired and cannot be reused" },
          { status: 409 }
        );
      }
      if (!asset.currentBookingId) {
        asset = await RugAsset.findOneAndUpdate(
          { _id: asset._id, currentBookingId: null },
          { $set: { currentBookingId: bookingId, status: "IN_CARE" } },
          { new: true }
        );
        if (!asset) {
          return NextResponse.json(
            { error: "This tag was just attached to another booking" },
            { status: 409 }
          );
        }
        claimedAsset = true;
      }
    } else {
      asset = await RugAsset.create({
        tagCode,
        ownerUserId: booking.userId,
        ownerEmail: booking.customer.email,
        type: booking.rug.type,
        photoUrls: booking.rug.photos ?? [],
        currentBookingId: bookingId,
        status: "IN_CARE",
      });
      createdAsset = true;
    }

    const updated = await Booking.findOneAndUpdate(
      {
        id: bookingId,
        assignedDriverId: session.driverProfileId,
        status: { $in: ["BOOKED", "SCHEDULED"] },
        $or: [
          { "rug.tagCode": { $exists: false } },
          { "rug.tagCode": null },
          { "rug.tagCode": "" },
        ],
      },
      {
        $set: {
          "rug.tagCode": tagCode,
          "rug.assetId": asset._id,
        },
      },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      if (createdAsset) {
        await RugAsset.deleteOne({ _id: asset._id, currentBookingId: bookingId });
      } else if (claimedAsset) {
        await RugAsset.updateOne(
          { _id: asset._id, currentBookingId: bookingId },
          {
            $set: {
              currentBookingId: null,
              status: previousAssetStatus ?? "IN_CARE",
            },
          }
        );
      }
      return NextResponse.json(
        { error: "The booking changed before the tag could be attached" },
        { status: 409 }
      );
    }

    return NextResponse.json(toClientBooking(updated as Record<string, unknown>));
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err && typeof err === "object" && "code" in err && err.code === 11000) {
      return NextResponse.json(
        { error: "This tag code is already in use" },
        { status: 409 }
      );
    }
    const message = err instanceof Error ? err.message : "Failed to attach rug tag";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
