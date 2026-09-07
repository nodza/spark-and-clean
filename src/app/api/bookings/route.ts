import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { getSession } from "@/lib/session";
import { toClientBooking } from "@/lib/serialize";

export async function GET() {
  try {
    await connectDB();
    const session = await getSession();

    const filter: Record<string, unknown> = {};
    if (session?.role === "client") {
      // Prefer userId when present; always allow email for guest / legacy bookings
      if (!session.guest && !session.id.startsWith("guest:")) {
        filter.$or = [
          { userId: session.id },
          { "customer.email": session.email.toLowerCase() },
        ];
      } else {
        filter["customer.email"] = session.email.toLowerCase();
      }
    } else if (session?.role === "technician" && session.driverProfileId) {
      filter.assignedDriverId = session.driverProfileId;
    }
    // admin: all bookings (empty filter)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const docs = await Booking.find(filter).sort({ createdAt: -1 }).lean();
    return NextResponse.json(
      docs.map((d) => toClientBooking(d as Record<string, unknown>))
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch bookings";
    console.error("[api/bookings GET]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const session = await getSession();
    const body = await request.json();

    const id =
      body.id ||
      `SC-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, "0")}`;

    const payload: Record<string, unknown> = {
      ...body,
      id,
      createdAt: body.createdAt || new Date().toISOString(),
      customer: {
        ...body.customer,
        email: body.customer?.email?.toLowerCase?.() ?? body.customer?.email,
      },
    };

    // Registered clients (not guests) get userId; guest matching still uses email
    if (
      session &&
      session.role === "client" &&
      !session.guest &&
      !session.id.startsWith("guest:")
    ) {
      payload.userId = session.id;
    } else if (body.userId) {
      payload.userId = body.userId;
    }

    const created = await Booking.findOneAndUpdate(
      { id },
      { $set: payload },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return NextResponse.json(
      toClientBooking(created as Record<string, unknown>)
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create booking";
    console.error("[api/bookings POST]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
