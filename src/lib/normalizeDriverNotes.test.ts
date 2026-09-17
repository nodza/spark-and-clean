import { describe, expect, it } from "vitest";
import { normalizeDriverNotes } from "@/lib/normalizeDriverNotes";

describe("normalizeDriverNotes", () => {
  it("returns empty for missing notes", () => {
    expect(normalizeDriverNotes(undefined)).toEqual([]);
    expect(normalizeDriverNotes(null)).toEqual([]);
  });

  it("maps a legacy string to one Ops note", () => {
    const notes = normalizeDriverNotes(
      "Bakkie in for service",
      "2026-01-01T00:00:00.000Z"
    );
    expect(notes).toHaveLength(1);
    expect(notes[0].body).toBe("Bakkie in for service");
    expect(notes[0].author).toBe("Ops");
  });

  it("sorts array notes newest first", () => {
    const notes = normalizeDriverNotes([
      {
        id: "a",
        body: "old",
        author: "Ops",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "b",
        body: "new",
        author: "Admin",
        createdAt: "2026-06-01T00:00:00.000Z",
      },
    ]);
    expect(notes.map((n) => n.id)).toEqual(["b", "a"]);
  });
});
