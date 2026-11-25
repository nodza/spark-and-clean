import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { Booking } from "@/models/Booking";
import { RugAsset } from "@/models/RugAsset";
import { WorkshopActivity } from "@/models/WorkshopActivity";
import { WORKSHOP_ACTIVITY_ACTIONS } from "@/types/workshop";
import type { WorkshopActivityAction } from "@/types/workshop";

type Params = { params: Promise<{ tagCode: string }> };

function authorizeWorkshop(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "workshop") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (session.mustChangePassword) {
    return NextResponse.json(
      { error: "Choose a new password before continuing." },
      { status: 403 }
    );
  }
  return null;
}

function normalizeTagCode(value: string) {
  const tagCode = value.trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9-]{2,63}$/.test(tagCode) ? tagCode : null;
}

function isWorkshopAction(value: unknown): value is WorkshopActivityAction {
  return (
    typeof value === "string" &&
    (WORKSHOP_ACTIVITY_ACTIONS as readonly string[]).includes(value)
  );
}

function activityRow(doc: Record<string, unknown>) {
  return {
    id: String(doc._id),
    bookingId: String(doc.bookingId),
    tagCode: String(doc.tagCode),
    action: doc.action,
    actorUserId: String(doc.actorUserId),
    actorName: String(doc.actorName),
    actorEmail: String(doc.actorEmail),
    occurredAt: new Date(doc.occurredAt as Date).toISOString(),
  };
}

async function findCurrentTaggedBooking(tagCode: string) {
  const asset = await RugAsset.findOne({ tagCode })
    .select({ currentBookingId: 1 })
    .lean();
  const selection = {
    id: 1,
    rug: 1,
    addOns: 1,
    notes: 1,
    deactivatedAt: 1,
  } as const;

  if (asset?.currentBookingId) {
    const current = await Booking.findOne({
      id: asset.currentBookingId,
      "rug.tagCode": tagCode,
    })
      .select(selection)
      .lean();
    if (current) return current;
  }

  return Booking.findOne({ "rug.tagCode": tagCode })
    .select(selection)
    .sort({ updatedAt: -1 })
    .lean();
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const denied = authorizeWorkshop(await getSession());
    if (denied) return denied;

    const { tagCode: rawTagCode } = await params;
    const tagCode = normalizeTagCode(rawTagCode);
    if (!tagCode) {
      return NextResponse.json({ error: "Invalid rug tag" }, { status: 400 });
    }

    await connectDB();
    const booking = await findCurrentTaggedBooking(tagCode);
    if (!booking) {
      return NextResponse.json({ error: "Rug not found" }, { status: 404 });
    }

    const activity = await WorkshopActivity.find({ tagCode })
      .sort({ occurredAt: -1 })
      .lean();

    const notes = Array.isArray(booking.notes)
      ? booking.notes
          .map((note) => ({
            id: String(note.id),
            body: String(note.body),
            author: String(note.author),
            createdAt: String(note.createdAt),
          }))
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      : [];

    return NextResponse.json({
      rug: {
        bookingId: booking.id,
        tagCode,
        type: booking.rug.type,
        color: booking.rug.color ?? "",
        specialNotes: booking.rug.specialNotes ?? "",
        widthM: booking.rug.widthM ?? null,
        lengthM: booking.rug.lengthM ?? null,
        areaSqM: booking.rug.areaSqM ?? null,
        addOns: booking.addOns ?? {},
        notes,
      },
      activity: activity.map((entry) =>
        activityRow(entry as unknown as Record<string, unknown>)
      ),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to look up rug";
    console.error("[api/workshop/rugs/[tagCode] GET]", message);
    return NextResponse.json({ error: "Failed to look up rug" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const actor = await getSession();
    const denied = authorizeWorkshop(actor);
    if (denied) return denied;
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tagCode: rawTagCode } = await params;
    const tagCode = normalizeTagCode(rawTagCode);
    if (!tagCode) {
      return NextResponse.json({ error: "Invalid rug tag" }, { status: 400 });
    }

    const body: unknown = await request.json().catch(() => null);
    const action =
      typeof body === "object" && body !== null && "action" in body
        ? body.action
        : null;
    if (!isWorkshopAction(action)) {
      return NextResponse.json(
        { error: "Choose a valid workshop activity." },
        { status: 400 }
      );
    }

    await connectDB();
    const booking = await findCurrentTaggedBooking(tagCode);
    if (!booking) {
      return NextResponse.json({ error: "Rug not found" }, { status: 404 });
    }
    if (booking.deactivatedAt) {
      return NextResponse.json(
        { error: "This booking is deactivated." },
        { status: 409 }
      );
    }

    const created = await WorkshopActivity.create({
      bookingId: booking.id,
      tagCode,
      action,
      actorUserId: actor.id,
      actorName: actor.name?.trim() || actor.email,
      actorEmail: actor.email,
      occurredAt: new Date(),
    });

    return NextResponse.json(
      { activity: activityRow(created.toObject() as Record<string, unknown>) },
      { status: 201 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to record workshop activity";
    console.error("[api/workshop/rugs/[tagCode] POST]", message);
    return NextResponse.json(
      { error: "Failed to record workshop activity" },
      { status: 500 }
    );
  }
}
