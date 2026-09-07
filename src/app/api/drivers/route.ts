import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Driver } from "@/models/Driver";
import { getSession } from "@/lib/session";
import { toClientDriver } from "@/lib/serialize";

/** Driver directory — full admin operations only. */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.role !== "admin" || session.adminTier === "marketing-only") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
