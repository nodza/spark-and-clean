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

export type FieldMessageAuthorRole = "admin" | "technician";

export type FieldMessage = {
  id: string;
  authorRole: FieldMessageAuthorRole;
  authorName: string;
  body: string;
  createdAt: string;
};

export function toFieldMessage(raw: Record<string, unknown>): FieldMessage {
  const role = raw.authorRole === "technician" ? "technician" : "admin";
  return {
    id: String(raw.id),
    authorRole: role,
    authorName: String(raw.authorName ?? (role === "admin" ? "Ops" : "Driver")),
    body: String(raw.body ?? ""),
    createdAt: String(raw.createdAt ?? ""),
  };
}

export function normalizeFieldMessages(raw: unknown): FieldMessage[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[])
    .map(toFieldMessage)
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
