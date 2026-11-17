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

  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.VITEST || process.env.NODE_ENV === "test") return;

  try {
    const { startCustomerEmailSchedule } = await import(
      "@/lib/email/customerEmailSchedule"
    );
    startCustomerEmailSchedule();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[email] Scheduler failed to start. ${message}`);
  }
}
