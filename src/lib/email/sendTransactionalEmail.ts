import { createHash } from "crypto";
import { connectDB } from "@/lib/mongodb";
import { EmailSendLog } from "@/models/EmailSendLog";
import { deliverEmail } from "@/lib/email/deliver";
import type { TransactionalEmail } from "@/lib/email/layout";

export type SendEmailResult = "sent" | "logged" | "failed" | "skipped";

export type SendTransactionalEmailInput = {
  /** Unique per event. A second call with the same key does not send again. */
  dedupeKey: string;
  /** Open string so later admin/driver mail can add kinds without a migration. */
  kind: string;
  to: string;
  bookingId?: string;
  email: TransactionalEmail;
  /**
   * Password reset still throws when delivery fails so the caller can log it.
   * Booking status mail must leave this false — a failed email never rolls
   * back the status change.
   */
  throwOnFailure?: boolean;
};

function isDuplicateKey(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === 11000
  );
}

export function passwordResetDedupeKey(resetUrl: string): string {
  const digest = createHash("sha256").update(resetUrl).digest("hex");
  return `password_reset:${digest}`;
}

/**
 * Claim a send-log row, then deliver. The unique key is the lock: a repeat
 * event (saving the same status again, or the morning job running twice)
 * finds the row and does not send.
 */
export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput
): Promise<SendEmailResult> {
  const to = input.to.trim().toLowerCase();
  if (!to || !to.includes("@")) return "skipped";

  const row = {
    dedupeKey: input.dedupeKey,
    kind: input.kind,
    bookingId: input.bookingId,
    to,
    subject: input.email.subject,
    status: "pending" as const,
  };

  try {
    await connectDB();
    await EmailSendLog.create(row);
  } catch (err) {
    if (isDuplicateKey(err)) return "skipped";
    console.error("[email] send log failed", input.kind, err);
    if (input.throwOnFailure) throw err;
    return "failed";
  }

  try {
    const mode = await deliverEmail({ to, email: input.email });
    await EmailSendLog.updateOne(
      { dedupeKey: input.dedupeKey },
      { $set: { status: mode === "smtp" ? "sent" : "logged" }, $unset: { error: "" } }
    );
    return mode === "smtp" ? "sent" : "logged";
  } catch (err) {
    const message = err instanceof Error ? err.message : "Email delivery failed";
    await EmailSendLog.updateOne(
      { dedupeKey: input.dedupeKey },
      { $set: { status: "failed", error: message.slice(0, 500) } }
    ).catch((updateErr) => {
      console.error("[email] could not record a failed send", updateErr);
    });
    console.error("[email] send failed", input.kind, input.dedupeKey, message);
    if (input.throwOnFailure) throw err;
    return "failed";
  }
}
