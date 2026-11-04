import { beforeEach, describe, expect, it, vi } from "vitest";

const signed = vi.hoisted(() => ({
  command: null as { input?: { ContentLength?: number; ContentType?: string; Key?: string } } | null,
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = vi.fn().mockResolvedValue({});
  },
  PutObjectCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
  GetObjectCommand: class {
    constructor(public input: unknown) {}
  },
  DeleteObjectCommand: class {
    constructor(public input: unknown) {}
  },
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async (_client: unknown, command: { input?: object }) => {
    signed.command = command;
    return "https://bucket.example/signed";
  }),
}));

describe("createRugPhotoUpload", () => {
  beforeEach(() => {
    vi.resetModules();
    signed.command = null;
    process.env.AWS_REGION = "af-south-1";
    process.env.S3_BUCKET = "rug-photos-test";
    process.env.AWS_ACCESS_KEY_ID = "test-key";
    process.env.AWS_SECRET_ACCESS_KEY = "test-secret";
  });

  it("signs the upload for the exact file size", async () => {
    const { createRugPhotoUpload } = await import("./s3RugPhotos");
    const upload = await createRugPhotoUpload("image/jpeg", 1200);
    expect(upload.key).toMatch(/\.jpg$/);
    expect(signed.command?.input).toMatchObject({
      ContentType: "image/jpeg",
      ContentLength: 1200,
    });
  });
});
