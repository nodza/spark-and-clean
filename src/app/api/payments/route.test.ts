import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const listPaymentsForClient = vi.fn();

vi.mock("@/lib/session", () => ({
  getSession: () => getSession(),
}));

vi.mock("@/lib/payments/listClientPayments", () => ({
  listPaymentsForClient: (...args: unknown[]) => listPaymentsForClient(...args),
}));

describe("GET /api/payments", () => {
  beforeEach(() => {
    getSession.mockReset();
    listPaymentsForClient.mockReset();
    listPaymentsForClient.mockResolvedValue([
      {
        id: "p1",
        createdAt: "2026-09-29T10:00:00.000Z",
        bookingId: "SC-1",
        kind: "DEPOSIT",
        amountCents: 7500,
        currency: "ZAR",
        provider: "stripe",
        status: "SUCCEEDED",
      },
      {
        id: "p2",
        createdAt: "2026-09-28T10:00:00.000Z",
        bookingId: "SC-1",
        kind: "DEPOSIT",
        amountCents: 7500,
        currency: "ZAR",
        provider: "stripe",
        status: "FAILED",
      },
    ]);
    vi.resetModules();
  });

  it("returns the session client's payments newest first", async () => {
    getSession.mockResolvedValue({
      id: "user-sarah",
      email: "sarah@example.com",
      role: "client",
    });
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      payments: [
        expect.objectContaining({
          bookingId: "SC-1",
          kind: "DEPOSIT",
          amountCents: 7500,
          status: "SUCCEEDED",
        }),
        expect.objectContaining({ status: "FAILED" }),
      ],
    });
    expect(listPaymentsForClient).toHaveBeenCalledWith({
      userId: "user-sarah",
      email: "sarah@example.com",
    });
  });

  it("returns 401 for anonymous callers", async () => {
    getSession.mockResolvedValue(null);
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(401);
    expect(listPaymentsForClient).not.toHaveBeenCalled();
  });

  it("returns 403 for a technician", async () => {
    getSession.mockResolvedValue({
      id: "tech-1",
      email: "thabo@example.com",
      role: "technician",
    });
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(403);
    expect(listPaymentsForClient).not.toHaveBeenCalled();
  });

  it("logs and returns 500 when listing fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    getSession.mockResolvedValue({
      id: "user-sarah",
      email: "sarah@example.com",
      role: "client",
    });
    listPaymentsForClient.mockRejectedValue(new Error("buffering timed out"));
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(500);
    expect(consoleError).toHaveBeenCalledWith(
      "[api/payments GET]",
      "buffering timed out"
    );
    consoleError.mockRestore();
  });
});
