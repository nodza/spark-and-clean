import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { getSession } from "@/lib/session";
import { isHttpError } from "@/lib/adminAuth";
import { canAccessFieldThread } from "@/lib/fieldMessageAuth";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  MAX_FIELD_MESSAGE_LEN,
  MAX_FIELD_MESSAGES_KEPT,
  fieldThreadReadWatermark,
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
    })
    .lean();
  return doc;
}

/**
 * Field thread for one job. Assigned technician or full admin only.
 * Never returned on public booking GET (stripped in toClientBooking).
 * Tech GET marks read up to the watermark of returned messages only.
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
    let fieldThreadReadAt =
      typeof doc.fieldThreadReadAt === "string" ? doc.fieldThreadReadAt : null;

    if (session.role === "technician") {
      const watermark = fieldThreadReadWatermark(messages);
      if (watermark) {
        await Booking.updateOne(
          {
            id,
            $or: [
              { fieldThreadReadAt: { $exists: false } },
              { fieldThreadReadAt: null },
              { fieldThreadReadAt: { $lt: watermark } },
            ],
          },
          { $set: { fieldThreadReadAt: watermark } }
        );
        fieldThreadReadAt = watermark;
      }
    }

    return NextResponse.json({ messages, fieldThreadReadAt });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message =
      err instanceof Error ? err.message : "Failed to fetch messages";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Post to the field thread. Technician or full admin. Atomic $push like notes. */
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

    const rate = checkRateLimit(
      `field-msg:${session.id}:${id}`,
      30,
      60 * 1000
    );
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many messages. Try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds) },
        }
      );
    }

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

    const update: Record<string, unknown> = {
      $push: {
        fieldMessages: {
          $each: [message],
          $slice: -MAX_FIELD_MESSAGES_KEPT,
        },
      },
    };
    if (isTech) {
      update.$set = { fieldThreadReadAt: message.createdAt };
    }

    const updated = await Booking.findOneAndUpdate({ id }, update, {
      new: true,
      runValidators: true,
    })
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
