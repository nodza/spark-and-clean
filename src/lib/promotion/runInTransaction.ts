import mongoose from "mongoose";

/** Runs `work` in one Mongo transaction and always closes the session. */
export async function runInTransaction<T>(
  work: (session: mongoose.ClientSession) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let value: T | undefined;
    await session.withTransaction(async () => {
      value = await work(session);
    });
    if (value === undefined) {
      throw new Error("Transaction finished without a result");
    }
    return value;
  } finally {
    await session.endSession();
  }
}
