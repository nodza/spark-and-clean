import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { getSession } from "@/lib/session";
import { isHttpError } from "@/lib/adminAuth";
import {
  canAccessFieldThread,
  requireTechnicianSession,
} from "@/lib/fieldMessageAuth";
import {
  MAX_FIELD_MESSAGE_LEN,
  MAX_FIELD_MESSAGES_KEPT,
  normalizeFieldMessages,
  type FieldMessage,
} from "@/lib/fieldMessages";

type Params = { params: Promise<{ id: string }> };

async function loadOwnedBooking(id: string) {
  await connectDB();
  const doc = await Booking.findOne({ id })
    .select({
      id: 1,
      assignedDriverId: 1,
      fieldMessages: 1,
      fieldThreadReadAt: 1,
      suburb: 1,
      customer: 1,
      collectionDate: 1,
      collectionSlot: 1,
      status: 1,
    })
    .lean();
  return doc;
}

/**
 * Field thread for one job. Assigned technician or full admin only.
 * Never returned on public booking GET (stripped in toClientBooking).
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const doc = await loadOwnedBooking(id);
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const assigned =
      typeof doc.assignedDriverId === "string" ? doc.assignedDriverId : null;
    if (!canAccessFieldThread(session, assigned)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const messages = normalizeFieldMessages(doc.fieldMessages);

    // Opening the thread marks ops messages read for this driver.
    if (session.role === "technician") {
      const readAt = new Date().toISOString();
      await Booking.updateOne(
        { id },
        { $set: { fieldThreadReadAt: readAt } }
      );
      return NextResponse.json({ messages, fieldThreadReadAt: readAt });
    }

    return NextResponse.json({
      messages,
      fieldThreadReadAt:
        typeof doc.fieldThreadReadAt === "string" ? doc.fieldThreadReadAt : null,
    });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message =
      err instanceof Error ? err.message : "Failed to fetch messages";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Post to the field thread. Technician or full admin. */
export async function POST(request: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isFullAdmin =
      session.role === "admin" && session.adminTier === "full";
    const isTech = session.role === "technician";
    if (!isFullAdmin && !isTech) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (isTech && !session.driverProfileId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const payload = await request.json().catch(() => ({}));
    const text = typeof payload.body === "string" ? payload.body.trim() : "";

    if (!text) {
      return NextResponse.json(
        { error: "Message cannot be empty" },
        { status: 400 }
      );
    }
    if (text.length > MAX_FIELD_MESSAGE_LEN) {
      return NextResponse.json(
        {
          error: `Message must be at most ${MAX_FIELD_MESSAGE_LEN} characters`,
        },
        { status: 400 }
      );
    }

    const doc = await loadOwnedBooking(id);
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const assigned =
      typeof doc.assignedDriverId === "string" ? doc.assignedDriverId : null;
    if (!canAccessFieldThread(session, assigned)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const message: FieldMessage = {
      id: `msg_${Date.now()}_${randomBytes(3).toString("hex")}`,
      authorRole: isFullAdmin ? "admin" : "technician",
      authorName:
        session.name?.trim() ||
        session.email?.trim() ||
        (isFullAdmin ? "Ops" : "Driver"),
      body: text,
      createdAt: new Date().toISOString(),
    };

    // Persist with $set (not only $push) so messages survive refresh even if a
    // stale Mongoose model briefly lacked fieldMessages in the schema.
    const current = normalizeFieldMessages(doc.fieldMessages);
    const chronological = [...current].reverse();
    const nextMessages = [...chronological, message].slice(
      -MAX_FIELD_MESSAGES_KEPT
    );

    const $set: Record<string, unknown> = { fieldMessages: nextMessages };
    if (isTech) {
      $set.fieldThreadReadAt = message.createdAt;
    }

    const updated = await Booking.findOneAndUpdate(
      { id },
      { $set },
      { new: true, runValidators: true }
    )
      .select({ fieldMessages: 1, id: 1 })
      .lean();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const saved = normalizeFieldMessages(updated.fieldMessages).find(
      (row) => row.id === message.id
    );
    if (!saved) {
      console.error(
        "[api/bookings/[id]/messages POST] message missing after save",
        id
      );
      return NextResponse.json(
        { error: "Failed to save message" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: saved }, { status: 201 });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message =
      err instanceof Error ? err.message : "Failed to send message";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Explicit mark-read (also runs on GET for technicians). */
export async function PUT(_request: Request, { params }: Params) {
  try {
    const session = await requireTechnicianSession();
    const { id } = await params;
    const doc = await loadOwnedBooking(id);
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const assigned =
      typeof doc.assignedDriverId === "string" ? doc.assignedDriverId : null;
    if (assigned !== session.driverProfileId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const readAt = new Date().toISOString();
    await Booking.updateOne({ id }, { $set: { fieldThreadReadAt: readAt } });
    return NextResponse.json({ fieldThreadReadAt: readAt });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message =
      err instanceof Error ? err.message : "Failed to mark messages read";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
