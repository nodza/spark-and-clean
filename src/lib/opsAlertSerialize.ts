import type { OpsAlert } from "@/types/opsAlert";

export function toClientOpsAlert(doc: Record<string, unknown>): OpsAlert {
  const dismissed = doc.dismissedAt;
  let dismissedAt: string | null = null;
  if (dismissed instanceof Date) {
    dismissedAt = dismissed.toISOString();
  } else if (typeof dismissed === "string" && dismissed.length > 0) {
    dismissedAt = dismissed;
  }

  const created = doc.createdAt;
  const createdAt =
    created instanceof Date
      ? created.toISOString()
      : typeof created === "string"
        ? created
        : new Date().toISOString();

  return {
    id: String(doc.id),
    type: "NEW_BOOKING",
    bookingId: String(doc.bookingId),
    title: String(doc.title ?? ""),
    meta: String(doc.meta ?? ""),
    dismissedAt,
    createdAt,
  };
}
