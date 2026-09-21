import type { InternalNote } from "@/types/booking";

function toNote(raw: Record<string, unknown>): InternalNote {
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : `note_${String(raw.createdAt ?? "unknown")}`,
    body: String(raw.body ?? ""),
    author: String(raw.author ?? "Ops"),
    createdAt: String(raw.createdAt ?? ""),
  };
}

/** Normalize Driver.notes; legacy string becomes one Ops note. */
export function normalizeDriverNotes(
  raw: unknown,
  fallbackCreatedAt?: string
): InternalNote[] {
  if (Array.isArray(raw)) {
    return (raw as Record<string, unknown>[])
      .map(toNote)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  if (typeof raw === "string" && raw.trim()) {
    return [
      {
        id: "legacy_note",
        body: raw.trim(),
        author: "Ops",
        createdAt: fallbackCreatedAt || new Date(0).toISOString(),
      },
    ];
  }
  return [];
}
