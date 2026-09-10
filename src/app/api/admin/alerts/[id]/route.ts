import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { OpsAlert } from "@/models/OpsAlert";
import { toClientOpsAlert } from "@/lib/opsAlertSerialize";
import { isHttpError, requireFullAdmin } from "@/lib/adminAuth";

type Params = { params: Promise<{ id: string }> };

/** Dismiss an alert — persists so refresh / other admins no longer see it. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireFullAdmin();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    if (body?.dismissed !== true && body?.action !== "dismiss") {
      return NextResponse.json(
        { error: "Send { dismissed: true } to dismiss" },
        { status: 400 }
      );
    }

    await connectDB();
    const doc = await OpsAlert.findOneAndUpdate(
      { id },
      { $set: { dismissedAt: new Date() } },
      { new: true }
    ).lean();

    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(toClientOpsAlert(doc as Record<string, unknown>));
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Failed to dismiss alert";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
