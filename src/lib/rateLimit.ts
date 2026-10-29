import { createHash } from "node:crypto";
import { connectDB } from "@/lib/mongodb";
import { RateLimitCounter } from "@/models/RateLimitCounter";

type RateLimitState = {
  count: number;
  resetAt: Date;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

function hashKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

function rateLimitResult(
  state: RateLimitState | null,
  limit: number,
  now: number
): RateLimitResult {
  if (!state || state.resetAt.getTime() <= now || state.count < limit) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((state.resetAt.getTime() - now) / 1000)
    ),
  };
}

async function incrementCounter(key: string, windowMs: number) {
  await connectDB();
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);
  const activeWindow = {
    $gt: [{ $ifNull: ["$resetAt", new Date(0)] }, now],
  };

  const updated = await RateLimitCounter.findOneAndUpdate(
    { _id: hashKey(key) },
    [
      {
        $set: {
          count: {
            $cond: [
              activeWindow,
              { $add: [{ $ifNull: ["$count", 0] }, 1] },
              1,
            ],
          },
          resetAt: { $cond: [activeWindow, "$resetAt", resetAt] },
          expiresAt: { $cond: [activeWindow, "$resetAt", resetAt] },
        },
      },
    ],
    { upsert: true, new: true, updatePipeline: true }
  ).lean();

  if (!updated) {
    throw new Error("Could not update rate-limit counter");
  }

  return { count: updated.count, resetAt: updated.resetAt };
}

export async function getRateLimitStatus(
  key: string,
  limit: number
): Promise<RateLimitResult> {
  await connectDB();
  const state = await RateLimitCounter.findById(hashKey(key))
    .select({ count: 1, resetAt: 1 })
    .lean();
  return rateLimitResult(
    state ? { count: state.count, resetAt: state.resetAt } : null,
    limit,
    Date.now()
  );
}

export async function recordRateLimitFailure(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const state = await incrementCounter(key, windowMs);
  return rateLimitResult(state, limit, Date.now());
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const state = await incrementCounter(key, windowMs);
  return rateLimitResult(state, limit + 1, Date.now());
}

export async function clearRateLimit(key: string): Promise<void> {
  await connectDB();
  await RateLimitCounter.deleteOne({ _id: hashKey(key) });
}

export function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function tooManyAttemptsMessage(retryAfterSeconds: number) {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Too many attempts. Try again in ${minutes} ${
    minutes === 1 ? "minute" : "minutes"
  }.`;
}
