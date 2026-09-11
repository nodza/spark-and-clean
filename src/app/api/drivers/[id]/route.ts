import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Driver } from "@/models/Driver";
import { toClientDriver } from "@/lib/serialize";
import { getSession } from "@/lib/session";
import { Types } from "mongoose";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();
    const session = await getSession();
    
    // Allow viewing - don't require admin role for GET
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Try multiple lookup strategies
    let driver = null;
    
    // Strategy 1: Lookup by business id field
    driver = await Driver.findOne({ id: params.id }).lean();
    
    // Strategy 2: Lookup by MongoDB _id if it's a valid ObjectId
    if (!driver && Types.ObjectId.isValid(params.id)) {
      driver = await Driver.findById(params.id).lean();
    }
    
    // Strategy 3: Lookup by name (case-insensitive)
    if (!driver) {
      driver = await Driver.findOne({ name: { $regex: params.id, $options: "i" } }).lean();
    }
    
    if (!driver) {
      console.error(`[api/drivers/[id]] Driver not found for id: "${params.id}". Tried: id field, ObjectId, name`);
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    console.log(`[api/drivers/[id]] Found driver: ${(driver as any).name} (lookup: ${params.id})`);
    return NextResponse.json(toClientDriver(driver as Record<string, unknown>));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch driver";
    console.error("[api/drivers/[id] GET]", message, { id: params.id });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    const session = await getSession();
    
    // Only admins can update driver details
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const updates = await request.json();
    
    // Only allow specific fields to be updated
    const allowedFields = ["phone", "email", "isActive", "notes", "vehicle", "city"];
    const sanitizedUpdates: Record<string, unknown> = {};
    
    for (const field of allowedFields) {
      if (field in updates) {
        sanitizedUpdates[field] = updates[field];
      }
    }

    // Try lookup by business id first, then by MongoDB _id
    let driver = await Driver.findOneAndUpdate(
      { id: params.id },
      { $set: sanitizedUpdates },
      { new: true }
    ).lean();
    
    if (!driver && Types.ObjectId.isValid(params.id)) {
      driver = await Driver.findByIdAndUpdate(
        params.id,
        { $set: sanitizedUpdates },
        { new: true }
      ).lean();
    }

    if (!driver) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    return NextResponse.json(toClientDriver(driver as Record<string, unknown>));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update driver";
    console.error("[api/drivers/[id] PATCH]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
