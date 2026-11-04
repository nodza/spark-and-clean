import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  createRugPhotoUpload: vi.fn(),
  deleteRugPhoto: vi.fn(),
  findSavedPhoto: vi.fn(),
}));

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: (...args: unknown[]) => mocks.checkRateLimit(...args),
}));
vi.mock("@/lib/mongodb", () => ({ connectDB: vi.fn() }));
vi.mock("@/models/Booking", () => ({
  Booking: {
    findOne: (...args: unknown[]) => mocks.findSavedPhoto(...args),
  },
}));
vi.mock("@/lib/s3RugPhotos", () => ({
  assertRugPhotoContentType: (value: unknown) => {
    if (value !== "image/jpeg" && value !== "image/png" && value !== "image/webp") {
      throw new Error("Use a JPG, PNG, or WebP image.");
    }
    return value;
  },
  createRugPhotoUpload: (...args: unknown[]) => mocks.createRugPhotoUpload(...args),
  deleteRugPhoto: (...args: unknown[]) => mocks.deleteRugPhoto(...args),
}));

import { DELETE, POST } from "./route";

const PHOTO_KEY =
  "rug-photos/2026/10/11111111-1111-4111-8111-111111111111.jpg";

function post(body: unknown, ip = "203.0.113.8") {
  return POST(
    new Request("http://localhost/api/uploads/rug-photos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 });
  mocks.createRugPhotoUpload.mockResolvedValue({
    key: PHOTO_KEY,
    uploadUrl: "https://bucket.example/upload",
    contentType: "image/jpeg",
  });
  mocks.deleteRugPhoto.mockResolvedValue(undefined);
  mocks.findSavedPhoto.mockReturnValue({
    select: () => ({ lean: async () => null }),
  });
});

describe("POST /api/uploads/rug-photos", () => {
  it("returns a presigned upload for a guest", async () => {
    const res = await post({ contentType: "image/jpeg", size: 1200 });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      key: expect.stringMatching(/^rug-photos\/\d{4}\/\d{2}\/.+\.jpg$/),
      uploadUrl: "https://bucket.example/upload",
    });
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(
      "rug-photo:203.0.113.8",
      30,
      15 * 60 * 1000
    );
    expect(mocks.createRugPhotoUpload).toHaveBeenCalledWith("image/jpeg", 1200);
  });

  it("refuses a file that is not a JPG, PNG, or WebP", async () => {
    const res = await post({ contentType: "image/gif", size: 1200 });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Use a JPG, PNG, or WebP image.",
    });
    expect(mocks.createRugPhotoUpload).not.toHaveBeenCalled();
  });

  it("refuses an oversized file", async () => {
    const res = await post({ contentType: "image/png", size: 5 * 1024 * 1024 + 1 });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/5 MB/);
    expect(mocks.createRugPhotoUpload).not.toHaveBeenCalled();
  });

  it("rate-limits extra upload requests", async () => {
    mocks.checkRateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 60 });
    const res = await post({ contentType: "image/webp", size: 100 });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(mocks.createRugPhotoUpload).not.toHaveBeenCalled();
  });
});

function remove(body: unknown) {
  return DELETE(
    new Request("http://localhost/api/uploads/rug-photos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("DELETE /api/uploads/rug-photos", () => {
  it("deletes a photo that is not on a booking", async () => {
    const res = await remove({ key: PHOTO_KEY });
    expect(res.status).toBe(204);
    expect(mocks.deleteRugPhoto).toHaveBeenCalledWith(PHOTO_KEY);
  });

  it("keeps a photo that is already saved on a booking", async () => {
    mocks.findSavedPhoto.mockReturnValue({
      select: () => ({ lean: async () => ({ _id: "booking" }) }),
    });
    const res = await remove({ key: PHOTO_KEY });
    expect(res.status).toBe(409);
    expect(mocks.deleteRugPhoto).not.toHaveBeenCalled();
  });
});
