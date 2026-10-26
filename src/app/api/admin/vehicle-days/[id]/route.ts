import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { VehicleDayUse } from "@/models/VehicleDayUse";
import { isHttpError, requireFullAdmin } from "@/lib/adminAuth";
import { toPublicApiError } from "@/lib/publicApiError";

type Params = { params: Promise<{ id: string }> };

/** Full admin — remove one day-log row. Does not change the standing register. */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireFullAdmin();
    const { id } = await params;
    const entryId = id.trim();
    if (!entryId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await connectDB();
    const deleted = await VehicleDayUse.findOneAndDelete({ id: entryId }).lean();
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message =
      err instanceof Error ? err.message : "Failed to delete vehicle day use";
    console.error("[api/admin/vehicle-days DELETE]", message);
    return NextResponse.json(
      { error: toPublicApiError(err, "Could not delete vehicle day use.") },
      { status: 500 }
    );
  }
}
