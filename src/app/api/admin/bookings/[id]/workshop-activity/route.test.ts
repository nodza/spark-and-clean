import { beforeEach, describe, expect, it, vi } from "vitest";

const requireFullAdmin = vi.fn();
const findActivity = vi.fn();

vi.mock("@/lib/mongodb", () => ({
  connectDB: vi.fn(async () => undefined),
}));
vi.mock("@/lib/adminAuth", () => ({
  isHttpError: (err: unknown) =>
    typeof err === "object" && err !== null && "status" in err,
  requireFullAdmin: () => requireFullAdmin(),
}));
vi.mock("@/models/WorkshopActivity", () => ({
  WorkshopActivity: { find: (...args: unknown[]) => findActivity(...args) },
}));

describe("GET booking workshop activity", () => {
  beforeEach(() => {
    requireFullAdmin.mockReset();
    findActivity.mockReset();
    requireFullAdmin.mockResolvedValue(undefined);
    findActivity.mockReturnValue({
      sort: () => ({
        lean: async () => [
          {
            _id: "activity1",
            bookingId: "SC-2026-0001",
            tagCode: "SC-RUG-101",
            action: "CLEANED",
            actorUserId: "507f1f77bcf86cd799439011",
            actorName: "Rug Worker",
            actorEmail: "worker@example.com",
            occurredAt: new Date("2026-11-16T08:30:00.000Z"),
          },
        ],
      }),
    });
  });

  it("returns attributed audit records for full admins", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "SC-2026-0001" }),
    });
    expect(response.status).toBe(200);
    expect(findActivity).toHaveBeenCalledWith({ bookingId: "SC-2026-0001" });
    expect((await response.json()).activity[0]).toEqual(
      expect.objectContaining({
        action: "CLEANED",
        actorName: "Rug Worker",
        actorEmail: "worker@example.com",
      })
    );
  });

  it("enforces admin authorization", async () => {
    const { GET } = await import("./route");
    requireFullAdmin.mockRejectedValue(
      Object.assign(new Error("Forbidden"), { status: 403 })
    );
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "SC-2026-0001" }),
    });
    expect(response.status).toBe(403);
    expect(findActivity).not.toHaveBeenCalled();
  });
});
