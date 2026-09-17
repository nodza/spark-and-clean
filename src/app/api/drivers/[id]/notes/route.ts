import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { connectDB } from "@/lib/mongodb";
import { Driver } from "@/models/Driver";
import { isHttpError, requireFullAdmin } from "@/lib/adminAuth";
import { MAX_NOTE_LEN, MAX_NOTES_KEPT } from "@/lib/internalNotes";
import { normalizeDriverNotes } from "@/lib/normalizeDriverNotes";
import type { InternalNote } from "@/types/booking";

type Params = { params: Promise<{ id: string }> };

/** Newest first. Full admin only — never sent to tech app or customers. */
export async function GET(_request: Request, { params }: Params) {
  try {
    await requireFullAdmin();
    const { id } = await params;
    await connectDB();

    const doc = await Driver.findOne({ id })
      .select({ notes: 1, id: 1, updatedAt: 1 })
      .lean();
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const fallback =
      doc.updatedAt instanceof Date
        ? doc.updatedAt.toISOString()
        : typeof doc.updatedAt === "string"
          ? doc.updatedAt
          : undefined;

    return NextResponse.json({
      notes: normalizeDriverNotes(doc.notes, fallback),
    });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Failed to fetch notes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Add a technician/driver internal note. Independent of booking job notes. */
export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireFullAdmin();
    const { id } = await params;
    const payload = await request.json().catch(() => ({}));
    const text = typeof payload.body === "string" ? payload.body.trim() : "";

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
      author: session.name?.trim() || session.email?.trim() || "Ops",
      createdAt: new Date().toISOString(),
    };

    await connectDB();
    const existing = await Driver.findOne({ id })
      .select({ notes: 1, updatedAt: 1 })
      .lean();
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const fallback =
      existing.updatedAt instanceof Date
        ? existing.updatedAt.toISOString()
        : undefined;
    const current = normalizeDriverNotes(existing.notes, fallback);
    const chronological = [...current].reverse();
    const nextNotes = [...chronological, note].slice(-MAX_NOTES_KEPT);

    const doc = await Driver.findOneAndUpdate(
      { id },
      { $set: { notes: nextNotes } },
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
