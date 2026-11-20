import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { isHttpError, requireFullAdmin } from "@/lib/adminAuth";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({ active: z.boolean() });

function jsonError(err: unknown) {
  if (isHttpError(err)) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message =
    err instanceof Error ? err.message : "Failed to update workshop account";
  console.error("[api/admin/workshop-staff/[id]]", message);
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireFullAdmin();
    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json(
        { error: "Workshop account not found" },
        { status: 404 }
      );
    }
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Provide an active status." },
        { status: 400 }
      );
    }

    await connectDB();
    const user = await User.findById(id);
    if (!user || user.role !== "workshop") {
      return NextResponse.json(
        { error: "Workshop account not found" },
        { status: 404 }
      );
    }

    const currentlyActive = !user.disabledAt && user.isActive !== false;
    if (currentlyActive !== parsed.data.active) {
      user.disabledAt = parsed.data.active ? null : new Date();
      user.isActive = parsed.data.active;
      if (!parsed.data.active) user.sessionsInvalidatedAt = new Date();
      await user.save();
    }

    return NextResponse.json({
      workshopStaff: {
        id: String(user._id),
        name: user.name ?? "",
        email: user.email,
        active: !user.disabledAt && user.isActive !== false,
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
