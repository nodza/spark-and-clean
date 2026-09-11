import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { isHttpError, requireFullAdmin } from "@/lib/adminAuth";
import type { InternalNote } from "@/types/booking";

type Params = { params: Promise<{ id: string }> };

const MAX_NOTE_LEN = 1000;

function toNote(raw: Record<string, unknown>): InternalNote {
  return {
    id: String(raw.id),
    body: String(raw.body ?? ""),
    author: String(raw.author ?? "Ops"),
    createdAt: String(raw.createdAt ?? ""),
  };
}

/** Newest first. Full admin only — never part of public booking payloads. */
export async function GET(_request: Request, { params }: Params) {
  try {
    await requireFullAdmin();
    const { id } = await params;
    await connectDB();

    const doc = await Booking.findOne({ id }).select({ notes: 1, id: 1 }).lean();
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const notes = Array.isArray(doc.notes)
      ? (doc.notes as Record<string, unknown>[]).map(toNote)
      : [];
    notes.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    return NextResponse.json({ notes });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Failed to fetch notes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Add an internal note. Full admin only. */
export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireFullAdmin();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const text =
      typeof body.body === "string"
        ? body.body.trim()
        : typeof body.text === "string"
          ? body.text.trim()
          : "";

    if (!text) {
      return NextResponse.json(
        { error: "Note cannot be empty" },
        { status: 400 }
      );
    }
    if (text.length > MAX_NOTE_LEN) {
      return NextResponse.json(
        { error: `Note must be at most ${MAX_NOTE_LEN} characters` },
        { status: 400 }
      );
    }

    const note: InternalNote = {
      id: `note_${Date.now()}_${randomBytes(3).toString("hex")}`,
      body: text,
      author: session.name?.trim() || "Ops",
      createdAt: new Date().toISOString(),
    };

    await connectDB();
    const doc = await Booking.findOneAndUpdate(
      { id },
      { $push: { notes: note } },
      { new: true }
    )
      .select({ notes: 1, id: 1 })
      .lean();

    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ note }, { status: 201 });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Failed to add note";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
