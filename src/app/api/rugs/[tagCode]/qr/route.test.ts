import { beforeEach, describe, expect, it, vi } from "vitest";
import jsQR from "jsqr";
import { PNG } from "pngjs";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  connectDB: vi.fn(),
  rugAssetFindOne: vi.fn(),
  bookingFindOne: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/mongodb", () => ({ connectDB: mocks.connectDB }));
vi.mock("@/models/RugAsset", () => ({
  RugAsset: { findOne: mocks.rugAssetFindOne },
}));
vi.mock("@/models/Booking", () => ({
  Booking: { findOne: mocks.bookingFindOne },
}));

import { GET } from "./route";

const tagCode = "SC-RUG-ABC12345";

function getQr() {
  return GET(new Request(`http://localhost/api/rugs/${tagCode}/qr`), {
    params: Promise.resolve({ tagCode }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.connectDB.mockResolvedValue(undefined);
  mocks.rugAssetFindOne.mockReturnValue({
    lean: () =>
      Promise.resolve({ tagCode, currentBookingId: "SC-BOOKING-1" }),
  });
  mocks.bookingFindOne.mockReturnValue({
    select: () => ({
      lean: () => Promise.resolve({ assignedDriverId: "driver_thabo" }),
    }),
  });
});

describe("GET /api/rugs/[tagCode]/qr", () => {
  it("returns a QR image that decodes to the tag code for its assigned technician", async () => {
    mocks.getSession.mockResolvedValue({
      role: "technician",
      driverProfileId: "driver_thabo",
    });

    const response = await getQr();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    const png = PNG.sync.read(Buffer.from(await response.arrayBuffer()));
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    expect(decoded?.data).toBe(tagCode);
    expect(decoded?.data).not.toMatch(/stripe|https?:\/\//i);
  });

  it("allows a full admin to print a tag QR", async () => {
    mocks.getSession.mockResolvedValue({ role: "admin", adminTier: "full" });

    const response = await getQr();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(mocks.bookingFindOne).not.toHaveBeenCalled();
  });

  it("returns 403 when a technician is not assigned to the current booking", async () => {
    mocks.getSession.mockResolvedValue({
      role: "technician",
      driverProfileId: "driver_sipho",
    });

    const response = await getQr();

    expect(response.status).toBe(403);
  expect(response.headers.get("Content-Type")).not.toContain("image/png");
  });

  it("denies non-full admins", async () => {
    mocks.getSession.mockResolvedValue({
      role: "admin",
      adminTier: "marketing-only",
    });

    const response = await getQr();

    expect(response.status).toBe(403);
  expect(response.headers.get("Content-Type")).not.toContain("image/png");
  });
});