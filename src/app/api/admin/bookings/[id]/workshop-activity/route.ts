import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { isHttpError, requireFullAdmin } from "@/lib/adminAuth";
import { WorkshopActivity } from "@/models/WorkshopActivity";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireFullAdmin();
    const { id } = await params;
    await connectDB();
    const entries = await WorkshopActivity.find({ bookingId: id })
      .sort({ occurredAt: -1 })
      .lean();

    return NextResponse.json({
      activity: entries.map((entry) => ({
        id: String(entry._id),
        bookingId: entry.bookingId,
        tagCode: entry.tagCode,
        action: entry.action,
        actorUserId: String(entry.actorUserId),
        actorName: entry.actorName,
        actorEmail: entry.actorEmail,
        occurredAt: entry.occurredAt.toISOString(),
      })),
    });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/admin/bookings/[id]/workshop-activity]", err);
    return NextResponse.json(
      { error: "Failed to load workshop activity" },
      { status: 500 }
    );
  }
}
