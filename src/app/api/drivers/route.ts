import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Driver } from "@/models/Driver";
import { toClientDriver } from "@/lib/serialize";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    await connectDB();
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admins see all drivers; others see only active drivers
    const filter = session.role === "admin" ? {} : { isActive: true };
    const docs = await Driver.find(filter).sort({ name: 1 }).lean();
    return NextResponse.json(
      docs.map((d) => toClientDriver(d as Record<string, unknown>))
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch drivers";
    console.error("[api/drivers GET]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
