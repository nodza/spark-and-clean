/**
 * Field channel (tech ↔ ops) — separate from ops-only InternalNote.
 *
 * Why not reuse Booking.notes with visibleToDriver?
 * Internal notes stay ops-only (E4). Field messages need authorRole + unread for
 * the van inbox. Two stores on the same booking doc, both stripped from public
 * payloads — not two unrelated collections.
 */
export const MAX_FIELD_MESSAGE_LEN = 1000;
export const MAX_FIELD_MESSAGES_KEPT = 200;
/** Poll interval so both van and admin see the other side without refresh. */
export const FIELD_MESSAGE_POLL_MS = 5_000;

/** Inbox only considers open/active van stops (not delivered/cancelled history). */
export const FIELD_INBOX_STATUSES = [
  "BOOKED",
  "SCHEDULED",
  "COLLECTED",
  "CLEANING",
  "DRYING",
  "READY",
] as const;

export const FIELD_INBOX_LIMIT = 100;

export type FieldMessageAuthorRole = "admin" | "technician";

export type FieldMessage = {
  id: string;
  authorRole: FieldMessageAuthorRole;
  authorName: string;
  body: string;
  createdAt: string;
};

export function toFieldMessage(
  raw: Record<string, unknown>
): FieldMessage | null {
  if (raw.authorRole !== "admin" && raw.authorRole !== "technician") {
    return null;
  }
  const role = raw.authorRole;
  return {
    id: String(raw.id),
    authorRole: role,
    authorName: String(
      raw.authorName ?? (role === "admin" ? "Ops" : "Driver")
    ),
    body: String(raw.body ?? ""),
    createdAt: String(raw.createdAt ?? ""),
  };
}

export function normalizeFieldMessages(raw: unknown): FieldMessage[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[])
    .map(toFieldMessage)
    .filter((message): message is FieldMessage => message != null)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Unread = ops message newer than the driver's last read timestamp. */
export function hasUnreadOpsFieldMessage(
  messages: FieldMessage[],
  readAt: string | null | undefined
): boolean {
  const cutoff = readAt && !Number.isNaN(Date.parse(readAt)) ? readAt : null;
  return messages.some(
    (message) =>
      message.authorRole === "admin" &&
      (!cutoff || message.createdAt > cutoff)
  );
}

export function latestOpsFieldMessage(
  messages: FieldMessage[]
): FieldMessage | undefined {
  return messages.find((message) => message.authorRole === "admin");
}

/**
 * Mark-read watermark = newest createdAt among messages the client actually
 * received — never wall-clock `now`, so a concurrent ops post stays unread.
 */
export function fieldThreadReadWatermark(
  messages: FieldMessage[]
): string | null {
  if (messages.length === 0) return null;
  let max = messages[0].createdAt;
  for (let i = 1; i < messages.length; i += 1) {
    if (messages[i].createdAt > max) max = messages[i].createdAt;
  }
  return max || null;
}

export type TechInboxItem = {
  jobId: string;
  customerName: string;
  suburb: string;
  collectionDate: string;
  collectionSlot: string;
  status: string;
  preview: string;
  latestAt: string;
  unread: boolean;
};
