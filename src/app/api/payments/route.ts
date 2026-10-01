import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isClientRole, isFullAccount } from "@/types/user";
import { listPaymentsForClient } from "@/lib/payments/listClientPayments";
import { toPublicApiError } from "@/lib/publicApiError";

/**
 * Client payment history — session user only.
 * Technicians / other roles get 403; anonymous get 401.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session || !isFullAccount(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isClientRole(session.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payments = await listPaymentsForClient({
      userId: session.id,
      email: session.email,
    });

    return NextResponse.json({ payments });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load payments";
    console.error("[api/payments GET]", message);
    return NextResponse.json(
      {
        error: toPublicApiError(err, "Could not load payment history."),
      },
      { status: 500 }
    );
  }
}
