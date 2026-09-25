import { describe, expect, it } from "vitest";
import {
  fieldThreadReadWatermark,
  hasUnreadOpsFieldMessage,
  normalizeFieldMessages,
  toFieldMessage,
} from "@/lib/fieldMessages";

describe("toFieldMessage", () => {
  it("rejects unknown authorRole instead of coercing to admin", () => {
    expect(
      toFieldMessage({
        id: "x",
        authorRole: "customer",
        authorName: "Nope",
        body: "hi",
        createdAt: "2026-09-02T12:00:00.000Z",
      })
    ).toBeNull();
  });
});

describe("normalizeFieldMessages", () => {
  it("returns empty for non-arrays", () => {
    expect(normalizeFieldMessages(undefined)).toEqual([]);
    expect(normalizeFieldMessages(null)).toEqual([]);
  });

  it("sorts newest first, maps roles, and drops invalid roles", () => {
    const list = normalizeFieldMessages([
      {
        id: "a",
        authorRole: "technician",
        authorName: "Thabo",
        body: "No one home",
        createdAt: "2026-09-01T10:00:00.000Z",
      },
      {
        id: "bad",
        authorRole: "ghost",
        authorName: "X",
        body: "skip",
        createdAt: "2026-09-03T10:00:00.000Z",
      },
      {
        id: "b",
        authorRole: "admin",
        authorName: "Ops",
        body: "Gate on the left",
        createdAt: "2026-09-02T10:00:00.000Z",
      },
    ]);
    expect(list.map((m) => m.id)).toEqual(["b", "a"]);
    expect(list[0].authorRole).toBe("admin");
  });
});

describe("hasUnreadOpsFieldMessage", () => {
  const messages = normalizeFieldMessages([
    {
      id: "1",
      authorRole: "admin",
      authorName: "Ops",
      body: "Gate on the left",
      createdAt: "2026-09-02T12:00:00.000Z",
    },
    {
      id: "2",
      authorRole: "technician",
      authorName: "Thabo",
      body: "No one home",
      createdAt: "2026-09-02T13:00:00.000Z",
    },
  ]);

  it("is unread when never read", () => {
    expect(hasUnreadOpsFieldMessage(messages, null)).toBe(true);
  });

  it("is read when readAt is after the ops message", () => {
    expect(
      hasUnreadOpsFieldMessage(messages, "2026-09-02T12:30:00.000Z")
    ).toBe(false);
  });

  it("stays unread when readAt is before the ops message", () => {
    expect(
      hasUnreadOpsFieldMessage(messages, "2026-09-02T11:00:00.000Z")
    ).toBe(true);
  });

  it("ignores technician-only threads for unread", () => {
    const techOnly = normalizeFieldMessages([
      {
        id: "t",
        authorRole: "technician",
        authorName: "Thabo",
        body: "No one home",
        createdAt: "2026-09-02T13:00:00.000Z",
      },
    ]);
    expect(hasUnreadOpsFieldMessage(techOnly, null)).toBe(false);
  });
});

describe("fieldThreadReadWatermark", () => {
  it("returns null for an empty thread", () => {
    expect(fieldThreadReadWatermark([])).toBeNull();
  });

  it("uses the newest createdAt among returned messages", () => {
    const messages = normalizeFieldMessages([
      {
        id: "old",
        authorRole: "admin",
        authorName: "Ops",
        body: "earlier",
        createdAt: "2026-09-02T10:00:00.000Z",
      },
      {
        id: "new",
        authorRole: "technician",
        authorName: "Thabo",
        body: "later",
        createdAt: "2026-09-02T12:00:00.000Z",
      },
    ]);
    expect(fieldThreadReadWatermark(messages)).toBe(
      "2026-09-02T12:00:00.000Z"
    );
  });
});
