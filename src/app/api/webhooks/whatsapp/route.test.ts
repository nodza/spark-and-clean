import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  updateOne: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({ connectDB: mocks.connectDB }));
vi.mock("@/models/NotificationAttempt", () => ({
  NotificationAttempt: { updateOne: mocks.updateOne },
}));

import { GET, POST } from "./route";

const APP_SECRET = "test-app-secret";
const VERIFY_TOKEN = "test-verify-token";
const booking = { id: "SC-1", status: "READY", paymentStatus: "UNPAID" };

function signedPost(body: string, signature?: string) {
  const digest = createHmac("sha256", APP_SECRET).update(body).digest("hex");
  return POST(
    new Request("http://localhost/api/webhooks/whatsapp", {
      method: "POST",
      headers: {
        "x-hub-signature-256": signature ?? `sha256=${digest}`,
        "content-type": "application/json",
      },
      body,
    })
  );
}

function statusPayload(id: string, status: string) {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: { statuses: [{ id, status }] },
          },
        ],
      },
    ],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("WHATSAPP_APP_SECRET", APP_SECRET);
  vi.stubEnv("WHATSAPP_VERIFY_TOKEN", VERIFY_TOKEN);
  mocks.connectDB.mockResolvedValue(undefined);
  mocks.updateOne.mockResolvedValue({ matchedCount: 1 });
});

describe("GET /api/webhooks/whatsapp", () => {
  it("returns the Meta challenge only for the configured verify token", async () => {
    const accepted = GET(
      new Request(
        `http://localhost/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=challenge-123`
      )
    );
    expect(accepted.status).toBe(200);
    expect(await accepted.text()).toBe("challenge-123");

    const rejected = GET(
      new Request(
        "http://localhost/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=challenge-123"
      )
    );
    expect(rejected.status).toBe(403);
  });
});

describe("POST /api/webhooks/whatsapp", () => {
  it("updates the matching notification attempt to delivered only", async () => {
    const originalBooking = structuredClone(booking);
    const response = await signedPost(statusPayload("wamid.123", "delivered"));

    expect(response.status).toBe(200);
    expect(mocks.updateOne).toHaveBeenCalledWith(
      { providerMessageId: "wamid.123" },
      { $set: { result: "delivered" } }
    );
    expect(booking).toEqual(originalBooking);
  });

  it("returns 401 for a bad signature without connecting or writing", async () => {
    const response = await signedPost(
      statusPayload("wamid.123", "delivered"),
      "sha256=" + "0".repeat(64)
    );

    expect(response.status).toBe(401);
    expect(mocks.connectDB).not.toHaveBeenCalled();
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it("acknowledges an unknown message id without booking side effects", async () => {
    mocks.updateOne.mockResolvedValue({ matchedCount: 0 });
    const originalBooking = structuredClone(booking);
    const response = await signedPost(statusPayload("wamid.unknown", "failed"));

    expect(response.status).toBe(200);
    expect(mocks.updateOne).toHaveBeenCalledWith(
      { providerMessageId: "wamid.unknown" },
      { $set: { result: "failed" } }
    );
    expect(booking).toEqual(originalBooking);
  });

  it("maps a read receipt to delivered", async () => {
    const response = await signedPost(statusPayload("wamid.read", "read"));

    expect(response.status).toBe(200);
    expect(mocks.updateOne).toHaveBeenCalledWith(
      { providerMessageId: "wamid.read" },
      { $set: { result: "delivered" } }
    );
  });
});