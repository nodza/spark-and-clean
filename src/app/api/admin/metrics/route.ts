import { NextResponse } from "next/server";
import { isHttpError, requireFullAdmin } from "@/lib/adminAuth";
import { getAdminMetrics } from "@/lib/adminMetrics";
import { toPublicApiError } from "@/lib/publicApiError";

export async function GET() {
  try {
    await requireFullAdmin();
    return NextResponse.json(await getAdminMetrics());
  } catch (err) {
    if (isHttpError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Failed to fetch admin metrics";
    console.error("[api/admin/metrics GET]", message);
    return NextResponse.json(
      { error: toPublicApiError(err, "Could not load admin metrics.") },
      { status: 500 }
    );
  }
}
