import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Driver } from "@/models/Driver";
import { toClientDriver } from "@/lib/serialize";

export async function GET() {
  try {
    await connectDB();
    const docs = await Driver.find({ isActive: true }).sort({ name: 1 }).lean();
    return NextResponse.json(
      docs.map((d) => toClientDriver(d as Record<string, unknown>))
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch drivers";
    console.error("[api/drivers GET]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
