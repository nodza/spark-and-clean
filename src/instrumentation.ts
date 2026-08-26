/**
 * Runs once when the Next.js server starts (`npm run dev` / `npm start`).
 * Soft-fails so a bad network / Atlas blip does not kill the whole app.
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  try {
    const { connectDBWithRetry } = await import("@/lib/mongodb");
    await connectDBWithRetry(1);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[MongoDB] Startup connection failed — app will still run. ${message}`
    );
  }
}
