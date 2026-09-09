import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { getSession } from "@/lib/session";
import { toClientBooking } from "@/lib/serialize";
import { isClientRole, isFullAccount, isPersistedClient } from "@/types/user";

export async function GET() {
  try {
    await connectDB();
    const session = await getSession();

    if (!session || !isFullAccount(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const filter: Record<string, unknown> = {};
    if (isPersistedClient(session)) {
      filter.$or = [
        { userId: session.id },
        { "customer.email": session.email.toLowerCase() },
      ];
    } else if (session.role === "technician" && session.driverProfileId) {
      filter.assignedDriverId = session.driverProfileId;
    }
    // admin: all bookings (empty filter)

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

    const rest = { ...(body as Record<string, unknown>) };
    delete rest.userId;

    const payload: Record<string, unknown> = {
      ...rest,
      id,
      createdAt: body.createdAt || new Date().toISOString(),
      customer: {
        ...body.customer,
        email: body.customer?.email?.toLowerCase?.() ?? body.customer?.email,
      },
    };

    // Only a full client session may stamp userId. Guests stay unclaimed.
    if (session && isFullAccount(session) && isClientRole(session.role)) {
      payload.userId = session.id;
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
