import { NextResponse } from "next/server";
import { fulfillOzowNotification } from "@/lib/payments/ozowWebhook";
import type { OzowNotification } from "@/lib/payments/ozow";

export const runtime = "nodejs";

/**
 * Ozow transaction notification (ITN).
 * Verify Hash before ledger.recordSuccess — tampered callbacks must not mark PAID.
 */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  let notification: OzowNotification = {};

  try {
    if (contentType.includes("application/json")) {
      notification = (await request.json()) as OzowNotification;
    } else {
      const text = await request.text();
      const params = new URLSearchParams(text);
      notification = Object.fromEntries(params.entries()) as OzowNotification;
    }
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const result = await fulfillOzowNotification(notification);
    if (!result.ok) {
      if (result.error === "invalid_hash" || result.error === "site_mismatch") {
        console.error("[api/webhooks/ozow]", result.error);
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
    }
    // Ozow expects 200 once the notification is stored / acknowledged.
    return new NextResponse(null, { status: 200 });
  } catch (err) {
    console.error(
      "[api/webhooks/ozow]",
      err instanceof Error ? err.message : "Failed to record payment"
    );
    return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
  }
}
