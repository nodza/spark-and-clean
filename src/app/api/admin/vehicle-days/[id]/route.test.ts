import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireFullAdmin: vi.fn(),
  connectDB: vi.fn(),
  findOneAndDelete: vi.fn(),
}));

vi.mock("@/lib/adminAuth", () => ({
  requireFullAdmin: mocks.requireFullAdmin,
  isHttpError: (err: unknown) =>
    err instanceof Error && "status" in err,
}));
vi.mock("@/lib/mongodb", () => ({ connectDB: mocks.connectDB }));
vi.mock("@/models/VehicleDayUse", () => ({
  VehicleDayUse: { findOneAndDelete: mocks.findOneAndDelete },
}));

import { DELETE } from "./route";

function remove(id: string) {
  return DELETE(new Request(`http://localhost/api/admin/vehicle-days/${id}`), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireFullAdmin.mockResolvedValue(undefined);
  mocks.connectDB.mockResolvedValue(undefined);
  mocks.findOneAndDelete.mockReturnValue({
    lean: async () => ({ id: "vday_1" }),
  });
});

describe("DELETE /api/admin/vehicle-days/[id]", () => {
  it("removes a day-log row", async () => {
    const res = await remove("vday_1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mocks.findOneAndDelete).toHaveBeenCalledWith({ id: "vday_1" });
  });

  it("returns 404 when the row is missing", async () => {
    mocks.findOneAndDelete.mockReturnValue({ lean: async () => null });
    const res = await remove("vday_missing");
    expect(res.status).toBe(404);
  });
});
