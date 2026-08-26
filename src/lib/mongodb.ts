import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
};

global.mongooseCache = cached;

const green = (msg: string) => `\x1b[32m${msg}\x1b[0m`;
const red = (msg: string) => `\x1b[31m${msg}\x1b[0m`;

/**
 * Reuses a single Mongoose connection across Next.js hot reloads / serverless invocations.
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error(
      "Missing MONGODB_URI. Add it to .env (or .env.local) and restart the dev server."
    );
  }

  if (cached.conn) {
    console.log(green("✓ [MongoDB] Reusing existing connection"));
    return cached.conn;
  }

  if (!cached.promise) {
    console.log(green("[MongoDB] Connecting to db…"));
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 15_000,
      })
      .then((m) => {
        console.log(green("✓ [MongoDB] Connected to db successfully"));
        return m;
      })
      .catch((err) => {
        cached.promise = null;
        const message = err instanceof Error ? err.message : String(err);
        // Log message only — logging full Error objects triggers noisy Next source-map spam
        console.error(red(`[MongoDB] Connection failed: ${message}`));
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

/** Startup helper: retries once after a short delay (Atlas / DNS can be flaky on first boot). */
export async function connectDBWithRetry(retries = 1): Promise<typeof mongoose> {
  try {
    return await connectDB();
  } catch (err) {
    if (retries <= 0) throw err;
    console.log(green("[MongoDB] Retrying connection in 2s…"));
    await new Promise((r) => setTimeout(r, 2000));
    return connectDBWithRetry(retries - 1);
  }
}
