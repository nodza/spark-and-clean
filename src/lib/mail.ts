/**
 * Outbound email. Password reset uses the shared transactional layout.
 * Booking mail lives in src/lib/email/bookingNotifications.ts.
 *
 * Env:
 * - APP_URL — public origin for links
 * - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM — required in staging/production
 *
 * Local/dev without SMTP: the message is printed to the server log.
 */

import { passwordResetEmail } from "@/lib/email/copy";
import {
  passwordResetDedupeKey,
  sendTransactionalEmail,
} from "@/lib/email/sendTransactionalEmail";

export { getAppBaseUrl } from "@/lib/email/appUrl";

export type SendPasswordResetEmailInput = {
  to: string;
  resetUrl: string;
  expiresInMinutes: number;
};

export async function sendPasswordResetEmail(
  input: SendPasswordResetEmailInput
): Promise<{ mode: "smtp" | "log" }> {
  const result = await sendTransactionalEmail({
    dedupeKey: passwordResetDedupeKey(input.resetUrl),
    kind: "password_reset",
    to: input.to,
    email: passwordResetEmail({
      resetUrl: input.resetUrl,
      expiresInMinutes: input.expiresInMinutes,
    }),
    throwOnFailure: true,
  });
  return { mode: result === "logged" ? "log" : "smtp" };
}
