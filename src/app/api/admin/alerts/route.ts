import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { OpsAlert } from "@/models/OpsAlert";
import { toClientOpsAlert } from "@/lib/opsAlertSerialize";
import { isHttpError, requireFullAdmin } from "@/lib/adminAuth";

/** Undismissed in-app ops alerts for the admin dashboard. */
export async function GET() {
  try {
    await requireFullAdmin();
    await connectDB();

    const docs = await OpsAlert.find({ dismissedAt: null })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return NextResponse.json({
      alerts: docs.map((d) => toClientOpsAlert(d as Record<string, unknown>)),
    });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Failed to fetch alerts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
