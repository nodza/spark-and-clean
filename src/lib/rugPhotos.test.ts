import { describe, expect, it } from "vitest";
import {
  buildRugPhotoKey,
  canViewBookingPhotos,
  isRugPhotoKey,
  parseRugPhotoKeys,
  rugPhotoSizeError,
} from "./rugPhotos";

const KEY = "rug-photos/2026/10/11111111-1111-4111-8111-111111111111.jpg";

describe("rug photo keys", () => {
  it("builds a private key for the upload month", () => {
    const key = buildRugPhotoKey(
      "image/png",
      new Date("2026-10-30T08:00:00Z"),
      "11111111-1111-4111-8111-111111111111"
    );
    expect(key).toBe(
      "rug-photos/2026/10/11111111-1111-4111-8111-111111111111.png"
    );
    expect(isRugPhotoKey(key)).toBe(true);
  });

  it("rejects blob links and anything that is not our key", () => {
    expect(isRugPhotoKey("blob:http://localhost:3000/abc")).toBe(false);
    expect(isRugPhotoKey("https://cdn.example/rug.jpg")).toBe(false);
    expect(isRugPhotoKey("rug-photos/../../secret.jpg")).toBe(false);
    expect(parseRugPhotoKeys(["blob:http://localhost/x"])).toBeNull();
    expect(parseRugPhotoKeys([KEY])).toEqual([KEY]);
    expect(parseRugPhotoKeys(undefined)).toBeUndefined();
  });

  it("refuses an oversized photo", () => {
    expect(rugPhotoSizeError(5 * 1024 * 1024 + 1)).toMatch(/5 MB/);
    expect(rugPhotoSizeError(5 * 1024 * 1024)).toBeNull();
  });
});

describe("canViewBookingPhotos", () => {
  const booking = {
    userId: "client-1",
    assignedDriverId: "driver-1",
    customer: { email: "owner@example.com" },
  };

  it("allows a full admin, the assigned technician, and the owning client", () => {
    expect(
      canViewBookingPhotos(
        { id: "ops", email: "ops@example.com", role: "admin", adminTier: "full" },
        booking
      )
    ).toBe(true);
    expect(
      canViewBookingPhotos(
        {
          id: "tech",
          email: "tech@example.com",
          role: "technician",
          driverProfileId: "driver-1",
        },
        booking
      )
    ).toBe(true);
    expect(
      canViewBookingPhotos(
        { id: "client-1", email: "owner@example.com", role: "client" },
        booking
      )
    ).toBe(true);
  });

  it("hides photos from other clients, other technicians, and a public link", () => {
    expect(canViewBookingPhotos(null, booking)).toBe(false);
    expect(
      canViewBookingPhotos(
        { id: "client-2", email: "other@example.com", role: "client" },
        booking
      )
    ).toBe(false);
    expect(
      canViewBookingPhotos(
        {
          id: "tech-2",
          email: "other-tech@example.com",
          role: "technician",
          driverProfileId: "driver-2",
        },
        booking
      )
    ).toBe(false);
    expect(
      canViewBookingPhotos(
        {
          id: "ops",
          email: "ops@example.com",
          role: "admin",
          adminTier: "marketing-only",
        },
        booking
      )
    ).toBe(false);
  });
});
