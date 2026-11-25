import type { TransactionalEmail } from "@/lib/email/layout";
import { renderTransactionalEmail } from "@/lib/email/layout";

export type DeliveryMode = "smtp" | "log";

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.EMAIL_FROM);
}

export function smtpRequired(): boolean {
  const env = (process.env.APP_ENV || process.env.NODE_ENV || "").toLowerCase();
  return env === "production" || env === "staging" || env === "prod";
}

/**
 * Send one rendered email. Without SMTP outside staging/production, the
 * message is written to the server log and nothing is handed to a provider.
 */
export async function deliverEmail(input: {
  to: string;
  email: TransactionalEmail;
}): Promise<DeliveryMode> {
  const { html, text } = renderTransactionalEmail(input.email);

  if (!smtpConfigured()) {
    if (smtpRequired()) {
      console.error(
        "[email] SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM."
      );
      throw new Error("Email delivery is not configured");
    }
    console.log(
      [
        `[email] SMTP not configured — writing email to the log`,
        `To: ${input.to}`,
        `Subject: ${input.email.subject}`,
        text,
      ].join("\n")
    );
    return "log";
  }

  const nodemailer = await import("nodemailer");
  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: input.to,
    subject: input.email.subject,
    text,
    html,
  });
  return "smtp";
}
