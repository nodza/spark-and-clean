import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { isHttpError } from "@/lib/adminAuth";
import { requireTechnicianSession } from "@/lib/fieldMessageAuth";
import {
  hasUnreadOpsFieldMessage,
  latestOpsFieldMessage,
  normalizeFieldMessages,
  type TechInboxItem,
} from "@/lib/fieldMessages";

/**
 * Inbox: assigned jobs with at least one unread ops field message.
 * Opening /tech/job/[id] (GET messages) clears unread for that job.
 */
export async function GET() {
  try {
    const session = await requireTechnicianSession();
    const driverId = session.driverProfileId!;

    await connectDB();
    const docs = await Booking.find({ assignedDriverId: driverId })
      .select({
        id: 1,
        fieldMessages: 1,
        fieldThreadReadAt: 1,
        suburb: 1,
        customer: 1,
        collectionDate: 1,
        collectionSlot: 1,
        status: 1,
      })
      .lean();

    const items: TechInboxItem[] = [];
    for (const doc of docs) {
      const messages = normalizeFieldMessages(doc.fieldMessages);
      const readAt =
        typeof doc.fieldThreadReadAt === "string"
          ? doc.fieldThreadReadAt
          : null;
      if (!hasUnreadOpsFieldMessage(messages, readAt)) continue;

      const latest = latestOpsFieldMessage(messages);
      if (!latest) continue;

      const customer =
        doc.customer && typeof doc.customer === "object"
          ? (doc.customer as { name?: string })
          : {};

      items.push({
        jobId: String(doc.id),
        customerName: String(customer.name || "Customer"),
        suburb: String(doc.suburb || ""),
        collectionDate: String(doc.collectionDate || ""),
        collectionSlot: String(doc.collectionSlot || ""),
        status: String(doc.status || ""),
        preview: latest.body,
        latestAt: latest.createdAt,
        unread: true,
      });
    }

    items.sort((a, b) => (a.latestAt < b.latestAt ? 1 : -1));

    return NextResponse.json({
      items,
      unreadCount: items.length,
    });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message =
      err instanceof Error ? err.message : "Failed to load inbox";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
