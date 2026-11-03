import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOneAndUpdate: vi.fn(),
  findById: vi.fn(),
  deleteOne: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({ connectDB: vi.fn() }));
vi.mock("@/models/RateLimitCounter", () => ({
  RateLimitCounter: {
    findOneAndUpdate: (...args: unknown[]) =>
      mocks.findOneAndUpdate(...args),
    findById: (...args: unknown[]) => mocks.findById(...args),
    deleteOne: (...args: unknown[]) => mocks.deleteOne(...args),
  },
}));

import {
  checkRateLimit,
  clearRateLimit,
  getRateLimitStatus,
  recordRateLimitFailure,
  tooManyAttemptsMessage,
} from "./rateLimit";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Mongo-backed rate limiter", () => {
  it("allows the configured number of requests and blocks the next", async () => {
    let count = 0;
    mocks.findOneAndUpdate.mockReturnValue({
      lean: async () => ({
        count: ++count,
        resetAt: new Date(Date.now() + 60_000),
      }),
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(checkRateLimit("register:127.0.0.1", 5, 60_000)).resolves
        .toMatchObject({ allowed: true, retryAfterSeconds: 0 });
    }

    await expect(checkRateLimit("register:127.0.0.1", 5, 60_000)).resolves
      .toMatchObject({ allowed: false });
    expect(mocks.findOneAndUpdate).toHaveBeenCalledTimes(6);
  });

  it("blocks login when the failure counter has reached its limit", async () => {
    mocks.findById.mockReturnValue({
      select: () => ({
        lean: async () => ({
          count: 5,
          resetAt: new Date(Date.now() + 30_000),
        }),
      }),
    });

    await expect(getRateLimitStatus("login:email:test@example.com", 5)).resolves
      .toMatchObject({ allowed: false, retryAfterSeconds: 30 });
  });

  it("records login failures atomically and reports the reset delay", async () => {
    mocks.findOneAndUpdate.mockReturnValue({
      lean: async () => ({
        count: 5,
        resetAt: new Date(Date.now() + 30_000),
      }),
    });

    await expect(
      recordRateLimitFailure("login:ip:127.0.0.1", 5, 900_000)
    ).resolves.toMatchObject({ allowed: false, retryAfterSeconds: 30 });

    const [filter, pipeline, options] = mocks.findOneAndUpdate.mock.calls[0];
    expect(filter._id).toMatch(/^[a-f0-9]{64}$/);
    expect(pipeline[0].$set.count.$cond[2]).toBe(1);
    expect(options).toMatchObject({ upsert: true, new: true });
  });

  it("clears a counter without storing the raw key", async () => {
    mocks.deleteOne.mockResolvedValue({ deletedCount: 1 });

    await clearRateLimit("login:email:test@example.com");

    expect(mocks.deleteOne.mock.calls[0][0]._id).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("tooManyAttemptsMessage", () => {
  it("uses a readable minute count", () => {
    expect(tooManyAttemptsMessage(1)).toBe(
      "Too many attempts. Try again in 1 minute."
    );
    expect(tooManyAttemptsMessage(61)).toBe(
      "Too many attempts. Try again in 2 minutes."
    );
  });
});
